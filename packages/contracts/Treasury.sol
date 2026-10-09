// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
interface ISettlementOracle { function rounds(uint256 round) external view returns(uint256,uint256,uint64,bytes32); function latest() external view returns(uint256); }
interface ILukasIndex { function getIndexUSD() external view returns(uint256,uint256); }
interface IPriceFeed { function decimals() external view returns(uint8); function latestRoundData() external view returns(uint80,int256,uint256,uint256,uint80); }

contract SimulationToken is ERC20 {
    uint8 private immutable precision;
    constructor(uint8 d) ERC20('Simulation Colombian Peso', 'SIMCOP') { precision=d; _mint(msg.sender, 10**uint256(d)*1_000_000_000); }
    function decimals() public view override returns(uint8) { return precision; }
}
contract SepoliaTestToken is ERC20 {
    uint8 private immutable precision;
    constructor(uint8 d) ERC20('Celo Sepolia Test Colombian Peso', 'TESTCOP') { require(block.chainid != 42220,'TEST_ONLY'); precision=d; _mint(msg.sender,10**uint256(d)*1_000_000_000); }
    function decimals() public view override returns(uint8) { return precision; }
}
// Fixture only. Never suitable as a mainnet feed.
contract FixtureOracle is Ownable {
    struct Round { uint256 index; uint256 price; uint64 sourceTime; bytes32 methodology; }
    mapping(uint256=>Round) public rounds;
    uint256 public latest;
    constructor(address publisher) Ownable(publisher) { require(block.chainid != 42220,'FIXTURE_NOT_MAINNET'); }
    function publish(uint256 index, uint256 price, uint64 sourceTime, bytes32 methodology) external onlyOwner {
        require(index>0 && index<=1e24 && price>0 && price<=1e24, 'PRICE');
        require(sourceTime<=block.timestamp, 'FUTURE');
        rounds[++latest]=Round(index,price,sourceTime,methodology);
    }
}
// Approved signed mirror trust mode. Signer attests to upstream source evidence;
// this verifies attestation/freshness, not an independent cross-chain proof.
contract SignedMirrorOracle is Ownable, EIP712 {
    struct Round { uint256 index; uint256 price; uint64 sourceTime; bytes32 methodology; }
    mapping(uint256=>Round) public rounds; uint256 public latest;
    bytes32 public immutable methodology; uint256 public immutable sourceChainId; address public immutable sourceContract;
    uint256 public immutable maximumAge;
    mapping(bytes32=>bool) public usedAttestation;
    event Mirrored(uint256 indexed round,bytes32 indexed sourceBlockHash,bytes32 snapshotHash,uint64 sourceTime);
    constructor(address publisher,bytes32 method,uint256 sourceChain,address source,uint256 age) Ownable(publisher) EIP712('LUKAS Price Mirror','1') { require(source!=address(0)&&age>0&&age<=3600,'SOURCE');methodology=method;sourceChainId=sourceChain;sourceContract=source;maximumAge=age; }
    function publish(uint256[5] calldata prices,uint64[5] calldata times,uint256 tokenPrice,uint64 tokenSourceTime,bytes32 sourceBlockHash,bytes calldata signature) external {
        uint64 oldest=type(uint64).max; uint256 index; uint256[5] memory weights=[uint256(4000),3000,1500,1000,500];
        for(uint256 k;k<5;k++){require(prices[k]>0&&prices[k]<=1e24&&times[k]<=block.timestamp&&block.timestamp-times[k]<=maximumAge,'SOURCE_PRICE');index+=prices[k]*weights[k];if(times[k]<oldest)oldest=times[k];}
        require(tokenPrice>0&&tokenPrice<=1e24&&tokenSourceTime<=block.timestamp&&block.timestamp-tokenSourceTime<=maximumAge&&sourceBlockHash!=bytes32(0),'PRICE');if(tokenSourceTime<oldest)oldest=tokenSourceTime;
        bytes32 snapshotHash=keccak256(abi.encode(prices,times,tokenPrice,tokenSourceTime));
        bytes32 digest=_hashTypedDataV4(keccak256(abi.encode(keccak256('Snapshot(bytes32 snapshotHash,uint256 sourceChainId,address sourceContract,bytes32 sourceBlockHash,bytes32 methodologyHash)'),snapshotHash,sourceChainId,sourceContract,sourceBlockHash,methodology)));
        require(!usedAttestation[digest]&&SignatureChecker.isValidSignatureNow(owner(),digest,signature),'ATTESTATION');usedAttestation[digest]=true;
        // Preserve upstream getIndexUSD's eight-decimal truncation before WAD normalization.
        rounds[++latest]=Round((index/10000/1e10)*1e10,tokenPrice,oldest,methodology);emit Mirrored(latest,sourceBlockHash,snapshotHash,oldest);
    }
}
contract NativeIndexOracle {
    struct Round { uint256 index; uint256 price; uint64 sourceTime; bytes32 methodology; }
    mapping(uint256=>Round) public rounds;uint256 public latest;
    ILukasIndex public immutable source; IPriceFeed public immutable tokenFeed; bytes32 public immutable methodology;
    constructor(address indexSource,address acceptedTokenFeed,bytes32 method){require(indexSource.code.length>0&&acceptedTokenFeed.code.length>0,'SOURCE');source=ILukasIndex(indexSource);tokenFeed=IPriceFeed(acceptedTokenFeed);methodology=method;}
    function capture() external {
        (uint256 index,uint256 sourceTime)=source.getIndexUSD();
        (uint80 roundId,int256 answer,,uint256 tokenTime,uint80 answeredInRound)=tokenFeed.latestRoundData();uint8 d=tokenFeed.decimals();
        require(index>0&&index<=1e14&&answer>0&&d<=18&&answeredInRound>=roundId&&sourceTime<=block.timestamp&&tokenTime<=block.timestamp,'PRICE');
        uint256 price=uint256(answer)*10**(18-d);require(price<=1e24&&sourceTime>0&&tokenTime>0,'PRICE');
        uint256 oldest=sourceTime<tokenTime?sourceTime:tokenTime;require(oldest<=type(uint64).max,'TIME');rounds[++latest]=Round(index*1e10,price,uint64(oldest),methodology);
    }
}
contract TreasuryVault is EIP712, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Intent { bytes32 obligationId; address vault; address referenceToken; address settlementToken; address recipient; uint256 amountLukasWad; uint256 maxSettlementAtomic; uint64 validAfter; uint64 deadline; uint256 policyEpoch; bytes32 methodologyHash; bytes32 salt; }
    struct TokenPolicy { uint8 decimals; bool enabled; uint256 perTxCap; uint256 dailyCap; }
    bytes32 public constant INTENT_TYPEHASH=keccak256('Intent(bytes32 obligationId,address vault,address referenceToken,address settlementToken,address recipient,uint256 amountLukasWad,uint256 maxSettlementAtomic,uint64 validAfter,uint64 deadline,uint256 policyEpoch,bytes32 methodologyHash,bytes32 salt)');
    address public executor;
    ISettlementOracle public immutable oracle;
    bytes32 public immutable methodology;
    uint256 public policyEpoch=1;
    uint256 public maximumOracleAge=300;
    mapping(address=>TokenPolicy) public tokens;
    mapping(address=>bool) public recipients;
    mapping(bytes32=>bool) public isPaid;
    mapping(bytes32=>bool) public canceled;
    mapping(address=>mapping(uint256=>uint256)) public dailySpent;
    event Payment(bytes32 indexed obligationId,address indexed token,address indexed recipient,uint256 amount,uint256 amountLukasWad,uint256 round,bytes32 intentHash);
    event OwnerAction(bytes32 indexed action,address indexed target,uint256 policyEpoch);
    constructor(address owner_,address executor_,address oracle_,bytes32 method) EIP712('LUKAS Treasury','1') Ownable(owner_) { require(executor_!=address(0)&&oracle_.code.length>0,'CONFIG');executor=executor_; oracle=ISettlementOracle(oracle_); methodology=method; }
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
        {
        uint256 beforeBalance=IERC20(i.settlementToken).balanceOf(i.recipient);
        uint256 vaultBefore=IERC20(i.settlementToken).balanceOf(address(this));
        IERC20(i.settlementToken).safeTransfer(i.recipient,amount);
        require(IERC20(i.settlementToken).balanceOf(i.recipient)==beforeBalance+amount,'TOKEN_BEHAVIOR');
        require(vaultBefore>=amount&&IERC20(i.settlementToken).balanceOf(address(this))==vaultBefore-amount,'TOKEN_BEHAVIOR');
        }
        emit Payment(i.obligationId,i.settlementToken,i.recipient,amount,i.amountLukasWad,round,intentHash(i));
    }
}
