"use client";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { staticDemoConfig, staticDemoData } from "./static-demo";

const STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";

export default function Page() {
  const [data, setData] = useState<any>(
      STATIC_DEMO ? staticDemoData : undefined,
    ),
    [publicConfig, setPublicConfig] = useState<any>(
      STATIC_DEMO ? staticDemoConfig : undefined,
    ),
    [recipient, setRecipient] = useState(""),
    [dueAt, setDueAt] = useState(""),
    [deadline, setDeadline] = useState(""),
    [ownerAction, setOwnerAction] = useState<any>(),
    [withdrawAmount, setWithdrawAmount] = useState(""),
    [fundAmount, setFundAmount] = useState(""),
    [allowedRecipient, setAllowedRecipient] = useState(""),
    [perPaymentLimit, setPerPaymentLimit] = useState(""),
    [dailyLimit, setDailyLimit] = useState(""),
    [oracleAge, setOracleAge] = useState("300"),
    [nextExecutor, setNextExecutor] = useState(""),
    [draftText, setDraftText] = useState(""),
    [language, setLanguage] = useState<"en" | "es">("en"),
    [error, setError] = useState(""),
    [wallet, setWallet] = useState(""),
    [amount, setAmount] = useState("100"),
    [cap, setCap] = useState("50000"),
    [draft, setDraft] = useState<any>(),
    [busy, setBusy] = useState(false);
  async function request(path: string, body?: unknown, key?: string) {
    if (STATIC_DEMO)
      throw new Error("This GitHub Pages build is a read-only static demo.");
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
    if (STATIC_DEMO) return;
    const refresh = () =>
      request("/v1/treasury")
        .then(setData)
        .catch((e) => setError(e.message));
    request("/v1/config")
      .then(setPublicConfig)
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
        `Install an EVM wallet and connect to chain ${publicConfig?.chainId ?? "shown in the dashboard"}.`,
      );
    return e;
  };
  async function connect() {
    const e = ethereum();
    const chain = await e.request({ method: "eth_chainId" });
    if (Number(BigInt(chain)) !== publicConfig?.chainId)
      throw new Error(`Switch your wallet to chain ${publicConfig?.chainId}`);
    const accounts = await e.request({ method: "eth_requestAccounts" });
    const challenge = await request("/auth/challenge", { wallet: accounts[0] });
    const signature = await e.request({
      method: "personal_sign",
      params: [challenge.message, accounts[0]],
    });
    await request("/auth/verify", { id: challenge.id, signature });
    setWallet(accounts[0]);
    setData(await request("/v1/treasury"));
  }
  async function prepare() {
    const now = Date.now();
    setDraft(
      await request(
        "/v1/obligations",
        {
          recipient: recipient || data.config.recipient,
          amountLukasWad: parseUnits(amount, 18).toString(),
          maxSettlementAtomic: parseUnits(cap, data.config.decimals).toString(),
          dueAt: dueAt || new Date(now + 15000).toISOString(),
          deadline: deadline || new Date(now + 3600000).toISOString(),
        },
        crypto.randomUUID(),
      ),
    );
  }
  async function sign() {
    const e = ethereum();
    if (
      Number(BigInt(await e.request({ method: "eth_chainId" }))) !==
      data.config.chainId
    )
      throw new Error(`Switch to chain ${data.config.chainId} before signing`);
    const accounts = await e.request({ method: "eth_accounts" });
    if (accounts[0]?.toLowerCase() !== wallet.toLowerCase())
      throw new Error("Owner wallet changed; reconnect before signing");
    const typed = {
      domain: draft.domain,
      primaryType: draft.primaryType,
      message: draft.message,
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
    const signature = await ethereum().request({
      method: "eth_signTypedData_v4",
      params: [wallet, JSON.stringify(typed)],
    });
    await request(
      `/v1/obligations/${draft.id}/authorize`,
      { signature },
      draft.id,
    );
    setDraft(null);
  }
  const strings = {
    en: {
      connect: "Connect owner wallet",
      schedule: "Schedule a supplier payment",
      pause: "Pause treasury",
      resume: "Resume treasury",
      withdraw: "Prepare withdrawal",
      readiness: "Operator readiness",
      balance: "FUNDED TREASURY",
    },
    es: {
      connect: "Conectar billetera del propietario",
      schedule: "Programar pago a proveedor",
      pause: "Pausar tesorería",
      resume: "Reanudar tesorería",
      withdraw: "Preparar retiro",
      readiness: "Estado del operador",
      balance: "SALDO DE TESORERÍA",
    },
  }[language];
  async function prepareControl(action: string, args: unknown[]) {
    setOwnerAction(
      await request(`/v1/treasuries/${data.config.vault}/policy/prepare`, {
        action,
        args,
      }),
    );
  }
  async function submitControl() {
    const e = ethereum();
    if (
      Number(BigInt(await e.request({ method: "eth_chainId" }))) !==
      ownerAction.chainId
    )
      throw new Error("CHAIN_MISMATCH");
    const hash =
      ownerAction.transactionHash ??
      (await e.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: ownerAction.from,
            to: ownerAction.to,
            data: ownerAction.data,
            value: ownerAction.value,
          },
        ],
      }));
    setOwnerAction({ ...ownerAction, transactionHash: hash });
    await request(`/v1/actions/${ownerAction.id}/submitted`, { hash });
    for (let n = 0; n < 60; n++) {
      const receipt = await e.request({
        method: "eth_getTransactionReceipt",
        params: [hash],
      });
      if (receipt) {
        await request(`/v1/actions/${ownerAction.id}/verify`, { hash });
        setOwnerAction(null);
        setData(await request("/v1/treasury"));
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(
      `Transaction pending: ${hash}; verify the chain result before retrying.`,
    );
  }
  return (
    <main>
      <header>
        <a className="brand" href="./">
          L<span>U</span>KAS <small>TREASURY</small>
        </a>
        <span className="badge">
          {publicConfig?.mode ?? "Connecting"} · CHAIN{" "}
          {publicConfig?.chainId ?? "…"}
        </span>
        <button
          onClick={() => setLanguage(language === "en" ? "es" : "en")}
          aria-label="Change language"
        >
          {language === "en" ? "Español" : "English"}
        </button>
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
          {STATIC_DEMO
            ? "GitHub Pages static demo · API and wallet actions disabled"
            : publicConfig?.chainId === 42220
              ? "Celo mainnet · reviewed assets and oracle policy required"
              : publicConfig?.chainId === 11142220
                ? "Celo Sepolia · TESTCOP synthetic test asset · no event credit"
                : "Local EVM and synthetic prices · SIMCOP is a mock token"}{" "}
          · JACK-inspired runtime; upstream integration pending licensing.
        </div>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data ? (
        <div>
          <p>Connect to load your treasury.</p>
          <button disabled={!publicConfig || busy} onClick={() => act(connect)}>
            {strings.connect}
          </button>
        </div>
      ) : (
        <>
          <section className="stats">
            <article>
              <label>{strings.balance}</label>
              <h2>
                {formatUnits(BigInt(data.balanceAtomic), data.config.decimals)}{" "}
                <small>{data.config.symbol ?? "SIMCOP"}</small>
              </h2>
              <p>Read directly from the deployed token contract</p>
            </article>
            <article>
              <label>LUKAS REFERENCE VALUE</label>
              <h2>${formatUnits(BigInt(data.snapshot.indexUsdWad), 18)}</h2>
              <p>{data.snapshot.trustMode} basket · USD per reference unit</p>
            </article>
            <article>
              <label>SUPPLIER RECEIVED</label>
              <h2>
                {formatUnits(
                  BigInt(data.recipientBalanceAtomic),
                  data.config.decimals,
                )}{" "}
                <small>{data.config.symbol ?? "SIMCOP"}</small>
              </h2>
              <p>Actual balance on the configured chain</p>
            </article>
          </section>
          <section className="workspace">
            <article className="compose">
              <p className="eyebrow">BOUNDED AUTHORIZATION</p>
              <h2>{strings.schedule}</h2>
              <p>
                One recipient. One token. One maximum. A signature authorizes
                only these terms.
              </p>
              <button
                disabled={STATIC_DEMO || busy}
                onClick={() => act(connect)}
              >
                {STATIC_DEMO
                  ? "Read-only static demo"
                  : wallet
                    ? "Wallet connected"
                    : strings.connect}
              </button>
              <details>
                <summary>Optional text draft · deterministic parser</summary>
                <label>
                  Explicit payment terms
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    readOnly={STATIC_DEMO}
                    placeholder={`pay 1 LUKAS to ${data.config.recipient} max 500 ${data.config.symbol ?? "SIMCOP"} due 2026-10-30T10:00:00-05:00 until 2026-10-30T11:00:00-05:00`}
                  />
                </label>
                <button
                  disabled={!wallet || busy}
                  onClick={() =>
                    act(async () => {
                      const p = await request("/v1/intents/parse", {
                        text: draftText,
                      });
                      setAmount(formatUnits(BigInt(p.amountLukasWad), 18));
                      setCap(
                        formatUnits(
                          BigInt(p.maxSettlementAtomic),
                          data.config.decimals,
                        ),
                      );
                      setRecipient(p.recipient);
                      setDueAt(p.dueAt);
                      setDeadline(p.deadline);
                      setDraft(null);
                    })
                  }
                >
                  Parse into review form
                </button>
                <p>Produces a draft only. It cannot sign or send money.</p>
              </details>
              <label>
                LUKAS denomination
                <input
                  value={amount}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setDraft(null);
                  }}
                  inputMode="decimal"
                />
              </label>
              <label>
                Maximum {data.config.symbol ?? "SIMCOP"} settlement
                <input
                  value={cap}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setCap(e.target.value);
                    setDraft(null);
                  }}
                  inputMode="decimal"
                />
              </label>
              <label>
                Supplier wallet
                <input
                  value={recipient || data.config.recipient}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setDraft(null);
                  }}
                />
              </label>
              <label>
                Settlement token
                <select aria-label="Settlement token" disabled={STATIC_DEMO}>
                  <option>
                    {data.config.symbol ?? "SIMCOP"} · {data.config.token}
                  </option>
                </select>
              </label>
              <label>
                Due time (ISO-8601 with timezone; default in 15 seconds)
                <input
                  placeholder="2026-10-30T12:00:00-05:00"
                  value={dueAt}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setDueAt(e.target.value);
                    setDraft(null);
                  }}
                />
              </label>
              <label>
                Expiry (ISO-8601 with timezone; default in 1 hour)
                <input
                  placeholder="2026-10-30T13:00:00-05:00"
                  value={deadline}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setDeadline(e.target.value);
                    setDraft(null);
                  }}
                />
              </label>
              <button disabled={!wallet || busy} onClick={() => act(prepare)}>
                Review exact terms
              </button>
              {draft && (
                <div className="review" data-draft-id={draft.id}>
                  <h3>Review before signing</h3>
                  <p>
                    {formatUnits(BigInt(draft.message.amountLukasWad), 18)}{" "}
                    LUKAS → quoted{" "}
                    {formatUnits(
                      BigInt(draft.quoteAtomic),
                      data.config.decimals,
                    )}{" "}
                    {data.config.symbol ?? "SIMCOP"}
                  </p>
                  <p>
                    Maximum{" "}
                    {formatUnits(
                      BigInt(draft.message.maxSettlementAtomic),
                      data.config.decimals,
                    )}{" "}
                    {data.config.symbol ?? "SIMCOP"} · policy epoch{" "}
                    {draft.message.policyEpoch}
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
                    accepted round within your signed cap.
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
                      {formatUnits(
                        BigInt(o.intent.maxSettlementAtomic),
                        data.config.decimals,
                      )}{" "}
                      {data.config.symbol ?? "SIMCOP"}
                    </p>
                    {wallet &&
                      !["RECONCILED", "CANCELED", "EXPIRED"].includes(
                        o.state,
                      ) && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            act(async () =>
                              setOwnerAction(
                                await request(
                                  `/v1/obligations/${o.id}/cancel/prepare`,
                                  {},
                                ),
                              ),
                            )
                          }
                        >
                          Prepare cancellation
                        </button>
                      )}
                    {o.reason && <p className="reason">Unpaid: {o.reason}</p>}
                    {o.receipt && (
                      <details>
                        <summary>
                          Chain-backed receipt ·{" "}
                          {formatUnits(
                            BigInt(o.receipt.actualSettlementAtomic),
                            o.receipt.decimals,
                          )}{" "}
                          {o.receipt.symbol}
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
                          {o.receipt.chainId === 31337
                            ? "Local transaction; no mainnet evidence, identity registration, or eligible attribution."
                            : o.receipt.chainId === 11142220
                              ? "Celo Sepolia test receipt; no mainnet event credit."
                              : "Celo mainnet receipt. Confirm the wallet, attribution and identity against the event registration."}
                        </p>
                      </details>
                    )}
                  </div>
                ))
              )}
            </article>
          </section>
          <section className="compose">
            <h2>Owner controls</h2>
            <p>
              Only your wallet can pause, withdraw, cancel or change policy. A
              prepared action becomes effective after its successful chain
              transaction is verified.
            </p>
            <button
              disabled={!wallet || busy}
              onClick={() =>
                act(() =>
                  prepareControl(data.policy.paused ? "unpause" : "pause", []),
                )
              }
            >
              {data.policy.paused ? strings.resume : strings.pause}
            </button>
            <label>
              Funding amount
              <input
                value={fundAmount}
                readOnly={STATIC_DEMO}
                onChange={(e) => setFundAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <button
              disabled={!wallet || busy || !fundAmount}
              onClick={() =>
                act(() =>
                  prepareControl("fund", [
                    parseUnits(fundAmount, data.config.decimals).toString(),
                  ]),
                )
              }
            >
              Prepare treasury funding
            </button>
            <label>
              Withdrawal amount
              <input
                value={withdrawAmount}
                readOnly={STATIC_DEMO}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <button
              disabled={!wallet || busy || !withdrawAmount}
              onClick={() =>
                act(() =>
                  prepareControl("withdraw", [
                    data.config.token,
                    wallet,
                    parseUnits(withdrawAmount, data.config.decimals).toString(),
                  ]),
                )
              }
            >
              {strings.withdraw}
            </button>
            <details>
              <summary>Recipients and policy</summary>
              <p>
                Changing recipients, token limits, executor or source age
                invalidates existing authorizations. Review and sign replacement
                obligations after the change.
              </p>
              <label>
                Recipient to configure
                <input
                  value={allowedRecipient}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => setAllowedRecipient(e.target.value)}
                />
              </label>
              <button
                disabled={!wallet || busy || !allowedRecipient}
                onClick={() =>
                  act(() =>
                    prepareControl("setRecipient", [allowedRecipient, true]),
                  )
                }
              >
                Allow recipient
              </button>
              <button
                disabled={!wallet || busy || !allowedRecipient}
                onClick={() =>
                  act(() =>
                    prepareControl("setRecipient", [allowedRecipient, false]),
                  )
                }
              >
                Remove recipient
              </button>
              <label>
                Per-payment token limit
                <input
                  value={perPaymentLimit}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => setPerPaymentLimit(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label>
                Daily token limit
                <input
                  value={dailyLimit}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <button
                disabled={!wallet || busy || !perPaymentLimit || !dailyLimit}
                onClick={() =>
                  act(() =>
                    prepareControl("setToken", [
                      data.config.token,
                      data.config.decimals,
                      true,
                      parseUnits(
                        perPaymentLimit,
                        data.config.decimals,
                      ).toString(),
                      parseUnits(dailyLimit, data.config.decimals).toString(),
                    ]),
                  )
                }
              >
                Prepare token limits
              </button>
              <label>
                Maximum source age (seconds)
                <input
                  value={oracleAge}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => setOracleAge(e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <button
                disabled={!wallet || busy}
                onClick={() =>
                  act(() => prepareControl("configurePolicy", [oracleAge]))
                }
              >
                Prepare source freshness policy
              </button>
              <label>
                Replacement executor
                <input
                  value={nextExecutor}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => setNextExecutor(e.target.value)}
                />
              </label>
              <button
                disabled={!wallet || busy || !nextExecutor}
                onClick={() =>
                  act(() => prepareControl("setExecutor", [nextExecutor]))
                }
              >
                Prepare executor rotation
              </button>
            </details>
            {data.pendingOwnerActions?.map((a: any) => (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => setOwnerAction(a)}
              >
                Resume verification: {a.action} ·{" "}
                {a.transactionHash.slice(0, 14)}…
              </button>
            ))}
            {ownerAction && (
              <div className="review">
                <h3>Review owner transaction</h3>
                <p>
                  {ownerAction.action} · chain {ownerAction.chainId}
                </p>
                <p className="mono">
                  Destination {ownerAction.to}
                  <br />
                  Arguments {JSON.stringify(ownerAction.args)}
                </p>
                <button disabled={busy} onClick={() => act(submitControl)}>
                  {ownerAction.transactionHash
                    ? "Verify submitted owner transaction"
                    : "Send reviewed owner transaction"}
                </button>
              </div>
            )}
          </section>
          <section className="compose">
            <h2>{strings.readiness}</h2>
            <p>
              Source: {data.snapshot.trustMode} · oldest component{" "}
              {new Date(
                data.snapshot.oldestComponentUpdatedAt * 1000,
              ).toLocaleString()}{" "}
              ·{" "}
              {Date.now() / 1000 - data.snapshot.oldestComponentUpdatedAt >
              data.policy.maximumOracleAgeSeconds
                ? "STALE — execution blocked"
                : "fresh"}
            </p>
            <p>
              Policy epoch {data.policy.policyEpoch} · paused{" "}
              {String(data.policy.paused)} · per-payment cap{" "}
              {formatUnits(
                BigInt(data.policy.tokenPolicy[2]),
                data.config.decimals,
              )}{" "}
              · daily cap{" "}
              {formatUnits(
                BigInt(data.policy.tokenPolicy[3]),
                data.config.decimals,
              )}
            </p>
            <p className="mono">
              Agent {data.config.executor}
              <br />
              Attribution {data.agent.attributionCode}
              <br />
              ERC-8004 identity: {data.agent.identity ?? "unregistered"}
            </p>
            <p>
              Local/testnet transactions do not count toward the event. Mainnet
              requires reviewed asset/oracle provenance, identity and explicit
              operator authorization.
            </p>
          </section>
          <footer>
            Powered by JACK principles · Owner controls custody · Daily caps
            reset at UTC midnight ·{" "}
            {publicConfig?.mainnetWrites
              ? "Reviewed mainnet writes enabled"
              : "Mainnet writes disabled"}
          </footer>
        </>
      )}
    </main>
  );
}
