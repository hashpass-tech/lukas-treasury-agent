// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

contract SimulationToken is ERC20 {
    uint8 private immutable precision;
    constructor(uint8 d) ERC20('Simulation Colombian Peso', 'SIMCOP') { precision=d; _mint(msg.sender, 10**uint256(d)*1_000_000_000); }
    function decimals() public view override returns(uint8) { return precision; }
}
// Fixture only. Never suitable as a mainnet feed.
contract FixtureOracle is Ownable {
    struct Round { uint256 index; uint256 price; uint64 sourceTime; bytes32 methodology; }
    mapping(uint256=>Round) public rounds;
    uint256 public latest;
    constructor(address publisher) Ownable(publisher) {}
    function publish(uint256 index, uint256 price, uint64 sourceTime, bytes32 methodology) external onlyOwner {
        require(index>0 && index<=1e24 && price>0 && price<=1e24, 'PRICE');
        require(sourceTime<=block.timestamp, 'FUTURE');
        rounds[++latest]=Round(index,price,sourceTime,methodology);
    }
}
contract TreasuryVault is EIP712, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Intent { bytes32 obligationId; address vault; address referenceToken; address settlementToken; address recipient; uint256 amountLukasWad; uint256 maxSettlementAtomic; uint64 validAfter; uint64 deadline; uint256 policyEpoch; bytes32 methodologyHash; bytes32 salt; }
    struct TokenPolicy { uint8 decimals; bool enabled; uint256 perTxCap; uint256 dailyCap; }
    bytes32 public constant INTENT_TYPEHASH=keccak256('Intent(bytes32 obligationId,address vault,address referenceToken,address settlementToken,address recipient,uint256 amountLukasWad,uint256 maxSettlementAtomic,uint64 validAfter,uint64 deadline,uint256 policyEpoch,bytes32 methodologyHash,bytes32 salt)');
    address public executor;
    FixtureOracle public immutable oracle;
    bytes32 public immutable methodology;
    uint256 public policyEpoch=1;
    uint256 public maximumOracleAge=300;
    mapping(address=>TokenPolicy) public tokens;
    mapping(address=>bool) public recipients;
    mapping(bytes32=>bool) public isPaid;
    mapping(bytes32=>bool) public canceled;
    mapping(address=>mapping(uint256=>uint256)) public dailySpent;
    event Payment(bytes32 indexed obligationId,address indexed token,address indexed recipient,uint256 amount,uint256 amountLukasWad,uint256 round,bytes32 intentHash);
    constructor(address owner_,address executor_,address oracle_,bytes32 method) EIP712('LUKAS Treasury','1') Ownable(owner_) { executor=executor_; oracle=FixtureOracle(oracle_); methodology=method; }
    function setToken(address token,uint8 d,bool enabled,uint256 perTx,uint256 daily) external onlyOwner { require(d<=18 && ERC20(token).decimals()==d && perTx>0 && daily>=perTx,'TOKEN'); tokens[token]=TokenPolicy(d,enabled,perTx,daily); policyEpoch++; }
    function setRecipient(address recipient,bool allowed) external onlyOwner { require(recipient!=address(0),'RECIPIENT'); recipients[recipient]=allowed; policyEpoch++; }
    function setExecutor(address next) external onlyOwner { require(next!=address(0),'EXECUTOR'); executor=next; policyEpoch++; }
    function configurePolicy(uint256 age) external onlyOwner { require(age>0 && age<=3600,'AGE'); maximumOracleAge=age; policyEpoch++; }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function cancelIntent(bytes32 id) external onlyOwner { canceled[id]=true; }
    function withdraw(address token,address recipient,uint256 amount) external onlyOwner nonReentrant { IERC20(token).safeTransfer(recipient,amount); }
    function intentHash(Intent calldata i) public view returns(bytes32) { return _hashTypedDataV4(keccak256(abi.encode(INTENT_TYPEHASH,i))); }
    function previewPayment(Intent calldata i,uint256 round) public view returns(uint256) {
        (uint256 index,uint256 price,uint64 sourceTime,bytes32 method)=oracle.rounds(round);
        require(index>0 && price>0 && sourceTime<=block.timestamp && block.timestamp-sourceTime<=maximumOracleAge,'PRICE_STALE');
        require(method==methodology && i.methodologyHash==methodology,'METHODOLOGY');
        require(i.amountLukasWad>0 && i.amountLukasWad<=1e30,'AMOUNT');
        // Explicit bounds keep numerator <= 1e72, below uint256 maximum.
        uint256 numerator=i.amountLukasWad*index*10**tokens[i.settlementToken].decimals;
        uint256 denominator=1e18*price;
        return numerator/denominator+(numerator%denominator==0?0:1);
    }
    function executePayment(Intent calldata i,bytes calldata signature,uint256 round) external whenNotPaused nonReentrant {
        require(msg.sender==executor,'EXECUTOR');
        require(i.vault==address(this) && i.referenceToken==address(0),'VAULT');
        require(SignatureChecker.isValidSignatureNow(owner(),intentHash(i),signature),'SIGNATURE');
        require(i.policyEpoch==policyEpoch,'EPOCH');
        require(block.timestamp>=i.validAfter && block.timestamp<=i.deadline,'WINDOW');
        require(!isPaid[i.obligationId] && !canceled[i.obligationId],'REPLAY');
        TokenPolicy memory t=tokens[i.settlementToken];
        require(t.enabled && recipients[i.recipient],'ALLOWLIST');
        uint256 amount=previewPayment(i,round);
        uint256 day=block.timestamp/86400;
        require(amount<=i.maxSettlementAtomic && amount<=t.perTxCap && dailySpent[i.settlementToken][day]+amount<=t.dailyCap,'CAP');
        isPaid[i.obligationId]=true;
        dailySpent[i.settlementToken][day]+=amount;
        uint256 beforeBalance=IERC20(i.settlementToken).balanceOf(i.recipient);
        IERC20(i.settlementToken).safeTransfer(i.recipient,amount);
        require(IERC20(i.settlementToken).balanceOf(i.recipient)==beforeBalance+amount,'TOKEN_BEHAVIOR');
        emit Payment(i.obligationId,i.settlementToken,i.recipient,amount,i.amountLukasWad,round,intentHash(i));
    }
}
