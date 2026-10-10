"use client";
import { useEffect, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import packageJson from "../../../package.json";
import {
  formatDate,
  languageOptions,
  translations,
  translatedIdentity,
  translatedMode,
  translatedState,
  translatedTrustMode,
  type Language,
} from "./i18n";
import { staticDemoConfig, staticDemoData } from "./static-demo";
import {
  BrandMark,
  Button,
  DataItem,
  DataList,
  Field,
  Icon,
  MetricCard,
  SectionHeading,
  StatusPill,
  TextInput,
} from "./ui";

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
    [language, setLanguage] = useState<Language>("en"),
    [error, setError] = useState(""),
    [wallet, setWallet] = useState(""),
    [amount, setAmount] = useState("100"),
    [cap, setCap] = useState("50000"),
    [draft, setDraft] = useState<any>(),
    [busy, setBusy] = useState(false);
  const t = translations[language];

  useEffect(() => {
    const saved = window.localStorage.getItem("lukas-language");
    if (saved === "en" || saved === "es" || saved === "ar") {
      setLanguage(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("lukas-language", language);
  }, [language]);

  async function request(path: string, body?: unknown, key?: string) {
    if (STATIC_DEMO) throw new Error(t.errors.staticDemo);
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
    if (!r.ok) throw new Error(result.error ?? t.errors.requestFailed);
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
        t.errors.wallet(publicConfig?.chainId ?? "shown in the dashboard"),
      );
    return e;
  };
  async function connect() {
    const e = ethereum();
    const chain = await e.request({ method: "eth_chainId" });
    if (Number(BigInt(chain)) !== publicConfig?.chainId)
      throw new Error(t.errors.switchChain(publicConfig?.chainId ?? "?"));
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
      throw new Error(t.errors.switchBeforeSigning(data.config.chainId));
    const accounts = await e.request({ method: "eth_accounts" });
    if (accounts[0]?.toLowerCase() !== wallet.toLowerCase())
      throw new Error(t.errors.walletChanged);
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
      throw new Error(t.errors.chainMismatch);
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
    throw new Error(t.errors.pending(hash));
  }
  return (
    <main>
      <header className="topbar">
        <BrandMark homeLabel={t.common.brandHome} />
        <nav className="topbar__nav" aria-label={t.nav.primary}>
          <a className="topbar__link topbar__link--active" href="#overview">
            {t.nav.overview}
          </a>
          <a className="topbar__link" href="#obligations">
            {t.nav.obligations}
          </a>
          <a className="topbar__link" href="#controls">
            {t.nav.controls}
          </a>
        </nav>
        <div className="topbar__actions">
          <StatusPill tone={STATIC_DEMO ? "warning" : "success"} icon="pulse">
            {translatedMode(publicConfig?.mode, language)} ·{" "}
            {t.common.chain.toUpperCase()} {publicConfig?.chainId ?? "…"}
          </StatusPill>
          <span className="chain-chip">
            <Icon name="globe" size={14} /> {t.common.chain}{" "}
            {publicConfig?.chainId ?? "…"}
          </span>
          <label className="language-picker">
            <span className="sr-only">{t.common.language}</span>
            <select
              className="language-button"
              value={language}
              aria-label={t.common.language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.nativeLabel}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <section className="hero" id="overview">
        <div className="hero__copy">
          <h1>
            {t.hero.titleLine1}
            <br />
            {t.hero.titleLine2}
          </h1>
          <p className="hero__lede">{t.hero.lede}</p>
          <div className="notice">
            <span className="notice__mark">
              <Icon name={STATIC_DEMO ? "receipt" : "shield"} size={15} />
            </span>
            <span>
              {STATIC_DEMO
                ? t.hero.staticNotice
                : publicConfig?.chainId === 42220
                  ? t.hero.mainnetNotice
                  : publicConfig?.chainId === 11142220
                    ? t.hero.sepoliaNotice
                    : t.hero.localNotice}{" "}
              · {t.hero.runtimeNotice}
            </span>
          </div>
        </div>
        <aside className="hero__rail" aria-label={t.hero.statusLabel}>
          <div className="hero__rail-head">
            <span>{t.hero.statusLabel}</span>
            <StatusPill tone="success">
              {data ? t.common.ready : t.common.loading}
            </StatusPill>
          </div>
          <div className="hero__rail-value">{data ? "01" : "—"}</div>
          <p>{t.hero.queueCount}</p>
          <div className="hero__rail-divider" />
          <div className="hero__rail-row">
            <span>{t.hero.authorization}</span>
            <strong>
              <Icon name="lock" size={14} /> {t.common.bounded}
            </strong>
          </div>
          <div className="hero__rail-row">
            <span>{t.hero.settlementRail}</span>
            <strong>
              <Icon name="globe" size={14} /> {t.common.localToken}
            </strong>
          </div>
        </aside>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data ? (
        <div>
          <p>{t.actions.connect}</p>
          <button disabled={!publicConfig || busy} onClick={() => act(connect)}>
            {t.actions.connect}
          </button>
        </div>
      ) : (
        <>
          <section className="stats" aria-label={t.metrics.balance}>
            <MetricCard
              label={t.metrics.balance}
              value={
                <>
                  {formatUnits(
                    BigInt(data.balanceAtomic),
                    data.config.decimals,
                  )}{" "}
                  <small>{data.config.symbol ?? "SIMCOP"}</small>
                </>
              }
              note={t.metrics.balanceNote}
              tone="success"
              icon="wallet"
            />
            <MetricCard
              label={t.metrics.reference}
              value={`$${formatUnits(BigInt(data.snapshot.indexUsdWad), 18)}`}
              note={`${translatedTrustMode(data.snapshot.trustMode, language)} ${t.metrics.referenceNote}`}
              tone="warning"
              icon="pulse"
            />
            <MetricCard
              label={t.metrics.received}
              value={
                <>
                  {formatUnits(
                    BigInt(data.recipientBalanceAtomic),
                    data.config.decimals,
                  )}{" "}
                  <small>{data.config.symbol ?? "SIMCOP"}</small>
                </>
              }
              note={t.metrics.receivedNote}
              icon="receipt"
            />
            <MetricCard
              label={t.metrics.epoch}
              value={`0${data.policy.policyEpoch}`}
              note={data.policy.paused ? t.metrics.paused : t.metrics.active}
              tone={data.policy.paused ? "warning" : "success"}
              icon="shield"
            />
          </section>
          <section className="workspace">
            <article className="compose">
              <SectionHeading
                title={t.compose.schedule}
                description={t.compose.scheduleDescription}
                icon="shield"
              />
              <Button
                disabled={STATIC_DEMO || busy}
                onClick={() => act(connect)}
                variant={wallet ? "secondary" : "primary"}
                icon={wallet ? "check" : "wallet"}
              >
                {STATIC_DEMO
                  ? t.actions.staticDemo
                  : wallet
                    ? t.actions.connected
                    : t.actions.connect}
              </Button>
              <details>
                <summary>{t.compose.draftSummary}</summary>
                <label>
                  {t.compose.explicitTerms}
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    readOnly={STATIC_DEMO}
                    placeholder={t.compose.draftExample
                      .replace("0x…", data.config.recipient)
                      .replace(
                        "500 SIMCOP",
                        `500 ${data.config.symbol ?? "SIMCOP"}`,
                      )}
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
                  {t.actions.parse}
                </button>
                <p>{t.compose.draftHelp}</p>
              </details>
              <Field label={t.compose.lukas} hint={t.common.decimals}>
                <TextInput
                  value={amount}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setDraft(null);
                  }}
                  inputMode="decimal"
                />
              </Field>
              <Field
                label={t.compose.maxSettlementLabel(
                  data.config.symbol ?? "SIMCOP",
                )}
                hint={t.common.signedCap}
              >
                <TextInput
                  value={cap}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setCap(e.target.value);
                    setDraft(null);
                  }}
                  inputMode="decimal"
                />
              </Field>
              <Field
                label={t.compose.supplier}
                hint={t.common.allowlistedRecipient}
              >
                <TextInput
                  value={recipient || data.config.recipient}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setDraft(null);
                  }}
                />
              </Field>
              <Field label={t.compose.token} hint={t.common.allowlistedAsset}>
                <select aria-label={t.compose.token} disabled={STATIC_DEMO}>
                  <option>
                    {data.config.symbol ?? "SIMCOP"} · {data.config.token}
                  </option>
                </select>
              </Field>
              <Field label={t.compose.due} hint={t.common.isoTime}>
                <TextInput
                  placeholder="2026-10-30T12:00:00-05:00"
                  value={dueAt}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setDueAt(e.target.value);
                    setDraft(null);
                  }}
                />
              </Field>
              <Field label={t.compose.expiry} hint={t.common.defaultsOneHour}>
                <TextInput
                  placeholder="2026-10-30T13:00:00-05:00"
                  value={deadline}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => {
                    setDeadline(e.target.value);
                    setDraft(null);
                  }}
                />
              </Field>
              <Button
                disabled={!wallet || busy}
                onClick={() => act(prepare)}
                icon="arrow-up-right"
              >
                {t.actions.reviewTerms}
              </Button>
              {draft && (
                <div className="review" data-draft-id={draft.id}>
                  <h3>{t.compose.reviewTitle}</h3>
                  <DataList>
                    <DataItem
                      label={t.compose.quote}
                      value={`${formatUnits(BigInt(draft.message.amountLukasWad), 18)} LUKAS → ${formatUnits(BigInt(draft.quoteAtomic), data.config.decimals)} ${data.config.symbol ?? "SIMCOP"}`}
                    />
                    <DataItem
                      label={t.common.signedCap}
                      value={`${formatUnits(BigInt(draft.message.maxSettlementAtomic), data.config.decimals)} ${data.config.symbol ?? "SIMCOP"} · epoch ${draft.message.policyEpoch}`}
                    />
                    <DataItem
                      label={t.compose.validAfter}
                      value={`${formatDate(Number(draft.message.validAfter) * 1000, language)} (Bogotá)`}
                    />
                    <DataItem
                      label={t.compose.vaultRecipient}
                      value={`${draft.message.vault} / ${draft.message.recipient}`}
                      mono
                    />
                    <DataItem
                      label={t.compose.deadline}
                      value={`${formatDate(Number(draft.message.deadline) * 1000, language)} (Bogotá)`}
                    />
                  </DataList>
                  <p>
                    {t.compose.quoteHelp} {t.compose.methodology}{" "}
                    {draft.message.methodologyHash}.
                  </p>
                  <Button disabled={busy} onClick={() => act(sign)} icon="lock">
                    {t.actions.sign}
                  </Button>
                </div>
              )}
              <p className="hint">{t.compose.walletHelp}</p>
            </article>
            <article className="queue" id="obligations">
              <SectionHeading
                title={t.queue.title}
                description={t.queue.description}
                icon="receipt"
              />
              {data.obligations.length === 0 ? (
                <p>{t.queue.empty}</p>
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
                        {translatedState(o.state, language)}
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
                          {t.actions.cancel}
                        </button>
                      )}
                    {o.reason && (
                      <p className="reason">
                        {t.queue.unpaidReason}: {o.reason}
                      </p>
                    )}
                    {o.receipt && (
                      <details>
                        <summary>
                          {t.queue.chainReceipt} ·{" "}
                          {formatUnits(
                            BigInt(o.receipt.actualSettlementAtomic),
                            o.receipt.decimals,
                          )}{" "}
                          {o.receipt.symbol}
                        </summary>
                        <p className="mono">
                          {t.queue.transaction}: {o.receipt.transactionHash}
                          <br />
                          {t.queue.block}: {o.receipt.blockNumber}
                          <br />
                          {t.queue.recipient}: {o.receipt.recipient}
                          <br />
                          {t.queue.oracleRound}: {o.receipt.oracleRound}
                        </p>
                        <p>
                          {o.receipt.chainId === 31337
                            ? t.queue.localEvidence
                            : o.receipt.chainId === 11142220
                              ? t.queue.sepoliaEvidence
                              : t.queue.mainnetEvidence}
                        </p>
                      </details>
                    )}
                  </div>
                ))
              )}
            </article>
          </section>
          <section className="compose" id="controls">
            <SectionHeading
              title={t.controls.title}
              description={t.controls.description}
              icon="sliders"
            />
            <button
              disabled={!wallet || busy}
              onClick={() =>
                act(() =>
                  prepareControl(data.policy.paused ? "unpause" : "pause", []),
                )
              }
            >
              {data.policy.paused ? t.actions.resume : t.actions.pause}
            </button>
            <label>
              {t.controls.fundingAmount}
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
              {t.actions.fund}
            </button>
            <label>
              {t.controls.withdrawalAmount}
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
              {t.actions.withdraw}
            </button>
            <details>
              <summary>{t.controls.recipientsPolicy}</summary>
              <p>{t.controls.policyWarning}</p>
              <label>
                {t.controls.recipientToConfigure}
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
                {t.actions.allowRecipient}
              </button>
              <button
                disabled={!wallet || busy || !allowedRecipient}
                onClick={() =>
                  act(() =>
                    prepareControl("setRecipient", [allowedRecipient, false]),
                  )
                }
              >
                {t.actions.removeRecipient}
              </button>
              <label>
                {t.controls.perPaymentLimit}
                <input
                  value={perPaymentLimit}
                  readOnly={STATIC_DEMO}
                  onChange={(e) => setPerPaymentLimit(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label>
                {t.controls.dailyLimit}
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
                {t.actions.tokenLimits}
              </button>
              <label>
                {t.controls.sourceAge}
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
                {t.actions.sourcePolicy}
              </button>
              <label>
                {t.controls.executor}
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
                {t.actions.executorRotation}
              </button>
            </details>
            {data.pendingOwnerActions?.map((a: any) => (
              <button
                key={a.id}
                disabled={busy}
                onClick={() => setOwnerAction(a)}
              >
                {t.actions.resumeVerification}: {a.action} ·{" "}
                {a.transactionHash.slice(0, 14)}…
              </button>
            ))}
            {ownerAction && (
              <div className="review">
                <h3>{t.controls.reviewTitle}</h3>
                <p>
                  {ownerAction.action} · {t.controls.chain}{" "}
                  {ownerAction.chainId}
                </p>
                <p className="mono">
                  {t.controls.destination} {ownerAction.to}
                  <br />
                  {t.controls.arguments} {JSON.stringify(ownerAction.args)}
                </p>
                <button disabled={busy} onClick={() => act(submitControl)}>
                  {ownerAction.transactionHash
                    ? t.actions.verify
                    : t.actions.send}
                </button>
              </div>
            )}
          </section>
          <section className="compose readiness-panel">
            <SectionHeading
              title={t.readiness.title}
              description={t.readiness.description}
              icon="pulse"
            />
            <p className="readiness-copy">
              {t.common.source}:{" "}
              {translatedTrustMode(data.snapshot.trustMode, language)} ·{" "}
              {t.readiness.oldestComponent}{" "}
              {formatDate(
                data.snapshot.oldestComponentUpdatedAt * 1000,
                language,
              )}{" "}
              ·{" "}
              {Date.now() / 1000 - data.snapshot.oldestComponentUpdatedAt >
              data.policy.maximumOracleAgeSeconds
                ? t.readiness.stale
                : t.readiness.fresh}
            </p>
            <p>
              {t.readiness.policyEpoch} {data.policy.policyEpoch} ·{" "}
              {t.readiness.paused}{" "}
              {data.policy.paused ? t.common.trueValue : t.common.falseValue} ·{" "}
              {t.readiness.perPaymentCap}{" "}
              {formatUnits(
                BigInt(data.policy.tokenPolicy[2]),
                data.config.decimals,
              )}{" "}
              · {t.readiness.dailyCap}{" "}
              {formatUnits(
                BigInt(data.policy.tokenPolicy[3]),
                data.config.decimals,
              )}
            </p>
            <p className="mono">
              {t.readiness.agent} {data.config.executor}
              <br />
              {t.readiness.attribution} {data.agent.attributionCode}
              <br />
              {t.readiness.identity}:{" "}
              {translatedIdentity(data.agent.identity, language) ??
                t.readiness.unregistered}
            </p>
            <p>{t.readiness.eventNote}</p>
          </section>
          <footer>
            {t.footer.text} ·{" "}
            {publicConfig?.mainnetWrites
              ? t.footer.mainnetOn
              : t.footer.mainnetOff}{" "}
            · {t.footer.release} v{packageJson.version}
          </footer>
        </>
      )}
    </main>
  );
}
