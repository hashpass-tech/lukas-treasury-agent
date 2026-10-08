"use client";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
export default function Page() {
  const [data, setData] = useState<any>(),
    [error, setError] = useState(""),
    [wallet, setWallet] = useState(""),
    [amount, setAmount] = useState("100"),
    [cap, setCap] = useState("50000"),
    [draft, setDraft] = useState<any>(),
    [busy, setBusy] = useState(false);
  async function request(path: string, body?: unknown, key?: string) {
    const r = await fetch("/api" + path, {
      method: body ? "POST" : "GET",
      headers: body
        ? {
            "Content-Type": "application/json",
            ...(key ? { "Idempotency-Key": key } : {}),
          }
        : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error ?? "Request failed");
    return result;
  }
  useEffect(() => {
    const refresh = () =>
      request("/v1/treasury")
        .then(setData)
        .catch((e) => setError(e.message));
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const ethereum = () => {
    const e = (window as any).ethereum;
    if (!e)
      throw new Error(
        "Install an EVM wallet; add local RPC port 8545, chain 31337. The CLI demo works without a browser wallet.",
      );
    return e;
  };
  async function connect() {
    const e = ethereum();
    const chain = await e.request({ method: "eth_chainId" });
    if (chain !== "0x7a69")
      throw new Error("Switch your wallet to local Simulation chain 31337");
    const accounts = await e.request({ method: "eth_requestAccounts" });
    const challenge = await request("/auth/challenge", { wallet: accounts[0] });
    const signature = await e.request({
      method: "personal_sign",
      params: [challenge.message, accounts[0]],
    });
    await request("/auth/verify", { id: challenge.id, signature });
    setWallet(accounts[0]);
  }
  async function prepare() {
    const now = Date.now();
    setDraft(
      await request(
        "/v1/obligations",
        {
          recipient: data.config.recipient,
          amountLukasWad: parseUnits(amount, 18).toString(),
          maxSettlementAtomic: parseUnits(cap, 6).toString(),
          dueAt: new Date(now + 15000).toISOString(),
          deadline: new Date(now + 3600000).toISOString(),
        },
        crypto.randomUUID(),
      ),
    );
  }
  async function sign() {
    const e = ethereum();
    if ((await e.request({ method: "eth_chainId" })) !== "0x7a69")
      throw new Error("Switch to Simulation chain 31337 before signing");
    const accounts = await e.request({ method: "eth_accounts" });
    if (accounts[0]?.toLowerCase() !== wallet.toLowerCase())
      throw new Error("Owner wallet changed; reconnect before signing");
    const typed = {
      ...draft,
      types: {
        ...draft.types,
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
      },
    };
    delete typed.id;
    delete typed.quoteAtomic;
    const signature = await ethereum().request({
      method: "eth_signTypedData_v4",
      params: [wallet, JSON.stringify(typed)],
    });
    await request(`/v1/obligations/${draft.id}/authorize`, { signature });
    setDraft(null);
  }
  return (
    <main>
      <header>
        <a className="brand" href="/">
          L<span>U</span>KAS <small>TREASURY</small>
        </a>
        <span className="badge">SIMULATION · CHAIN 31337</span>
      </header>
      <section className="hero">
        <p className="eyebrow">REGIONAL VALUE. LOCAL SETTLEMENT.</p>
        <h1>
          A treasury that
          <br />
          keeps its commitments.
        </h1>
        <p>
          Schedule obligations in LUKAS. Settle in an allowlisted local-currency
          token, within terms you sign.
        </p>
        <div className="notice">
          Local EVM and synthetic prices · SIMCOP is a mock token ·
          JACK-inspired runtime; upstream integration pending licensing.
        </div>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data ? (
        <p>Connecting to local treasury…</p>
      ) : (
        <>
          <section className="stats">
            <article>
              <label>FUNDED TREASURY</label>
              <h2>
                {formatUnits(BigInt(data.balanceAtomic), 6)}{" "}
                <small>SIMCOP</small>
              </h2>
              <p>Read directly from the local token contract</p>
            </article>
            <article>
              <label>LUKAS REFERENCE VALUE</label>
              <h2>${formatUnits(BigInt(data.snapshot.indexUsdWad), 18)}</h2>
              <p>Fixture basket · USD per reference unit</p>
            </article>
            <article>
              <label>SUPPLIER RECEIVED</label>
              <h2>
                {formatUnits(BigInt(data.recipientBalanceAtomic), 6)}{" "}
                <small>SIMCOP</small>
              </h2>
              <p>Actual balance on the simulation EVM</p>
            </article>
          </section>
          <section className="workspace">
            <article className="compose">
              <p className="eyebrow">BOUNDED AUTHORIZATION</p>
              <h2>Schedule a supplier payment</h2>
              <p>
                One recipient. One token. One maximum. A signature authorizes
                only these terms.
              </p>
              <button disabled={busy} onClick={() => act(connect)}>
                {wallet ? "Wallet connected" : "Connect owner wallet"}
              </button>
              <label>
                LUKAS denomination
                <input
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setDraft(null);
                  }}
                  inputMode="decimal"
                />
              </label>
              <label>
                Maximum SIMCOP settlement
                <input
                  value={cap}
                  onChange={(e) => {
                    setCap(e.target.value);
                    setDraft(null);
                  }}
                  inputMode="decimal"
                />
              </label>
              <p className="mono">Recipient {data.config.recipient}</p>
              <button disabled={!wallet || busy} onClick={() => act(prepare)}>
                Review exact terms
              </button>
              {draft && (
                <div className="review" data-draft-id={draft.id}>
                  <h3>Review before signing</h3>
                  <p>
                    {formatUnits(BigInt(draft.message.amountLukasWad), 18)}{" "}
                    LUKAS → quoted {formatUnits(BigInt(draft.quoteAtomic), 6)}{" "}
                    SIMCOP
                  </p>
                  <p>
                    Maximum{" "}
                    {formatUnits(BigInt(draft.message.maxSettlementAtomic), 6)}{" "}
                    SIMCOP · policy epoch {draft.message.policyEpoch}
                  </p>
                  <p>
                    Due{" "}
                    {new Date(
                      Number(draft.message.validAfter) * 1000,
                    ).toLocaleString("en-US", {
                      timeZone: "America/Bogota",
                    })}{" "}
                    (Bogotá)
                  </p>
                  <p className="mono">
                    Vault {draft.message.vault}
                    <br />
                    Recipient {draft.message.recipient}
                    <br />
                    Token {draft.message.settlementToken}
                    <br />
                    Methodology {draft.message.methodologyHash}
                  </p>
                  <p>
                    Deadline{" "}
                    {new Date(
                      Number(draft.message.deadline) * 1000,
                    ).toLocaleString("en-US", {
                      timeZone: "America/Bogota",
                    })}{" "}
                    (Bogotá). Quote is indicative; execution uses a fresh
                    fixture round within your signed cap.
                  </p>
                  <button disabled={busy} onClick={() => act(sign)}>
                    Sign bounded obligation
                  </button>
                </div>
              )}
              <p className="hint">
                No browser wallet? Run <code>pnpm demo:run</code> to fund and
                sign with local-only test identities.
              </p>
            </article>
            <article className="queue">
              <p className="eyebrow">DURABLE PAYMENT QUEUE</p>
              <h2>Obligations & receipts</h2>
              {data.obligations.length === 0 ? (
                <p>No obligations yet. Create one or run the CLI demo.</p>
              ) : (
                data.obligations.map((o: any) => (
                  <div
                    className="obligation"
                    key={o.id}
                    data-obligation-id={o.id}
                  >
                    <div className="row">
                      <strong>
                        {formatUnits(BigInt(o.intent.amountLukasWad), 18)} LUKAS
                      </strong>
                      <span
                        className={
                          "status " +
                          (o.state === "RECONCILED"
                            ? "paid"
                            : o.state === "BLOCKED"
                              ? "blocked"
                              : "")
                        }
                      >
                        {o.state === "RECONCILED" ? "Settled" : o.state}
                      </span>
                    </div>
                    <p className="mono">
                      {o.id.slice(0, 18)}… · max{" "}
                      {formatUnits(BigInt(o.intent.maxSettlementAtomic), 6)}{" "}
                      SIMCOP
                    </p>
                    {o.reason && <p className="reason">Unpaid: {o.reason}</p>}
                    {o.receipt && (
                      <details>
                        <summary>
                          Chain-backed receipt ·{" "}
                          {formatUnits(
                            BigInt(o.receipt.actualSettlementAtomic),
                            6,
                          )}{" "}
                          SIMCOP
                        </summary>
                        <p className="mono">
                          Transaction: {o.receipt.transactionHash}
                          <br />
                          Block: {o.receipt.blockNumber}
                          <br />
                          Recipient: {o.receipt.recipient}
                          <br />
                          Oracle round: {o.receipt.oracleRound}
                        </p>
                        <p>
                          Local transaction; no mainnet evidence, identity
                          registration, or eligible attribution.
                        </p>
                      </details>
                    )}
                  </div>
                ))
              )}
            </article>
          </section>
          <footer>
            Powered by JACK principles · Owner controls custody · Daily caps
            reset at UTC midnight · Mainnet disabled
          </footer>
        </>
      )}
    </main>
  );
}
