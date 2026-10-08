import { installSafeErrors } from "./safe-errors.js";
if (process.argv[1]?.endsWith("/demo.ts")) installSafeErrors();
import { Store } from "../packages/core/storage.js";
import {
  clients,
  manifest,
  setup,
  idFromKey,
  zeroAddress,
  publishFixture,
} from "../packages/core/chain.js";
import {
  domain,
  intentTypes,
  methodologyHash,
  type Intent,
} from "../packages/core/domain.js";
import { tick } from "../apps/worker/worker.js";
export async function seed(
  store: Store,
  label = "supplier-demo",
  cap = 100000000000n,
) {
  const m = await setup(),
    c = clients();
  const block = await c.publicClient.getBlock();
  const epoch = (await c.publicClient.readContract({
    address: m.vault,
    abi: (await import("../packages/core/chain.js")).artifacts().TreasuryVault
      .abi,
    functionName: "policyEpoch",
    args: [],
  })) as bigint;
  const id = idFromKey(label);
  if (store.get(id)) return id;
  const intent: Intent = {
    obligationId: id,
    vault: m.vault,
    referenceToken: zeroAddress,
    settlementToken: m.token,
    recipient: m.recipient,
    amountLukasWad: 100n * 10n ** 18n,
    maxSettlementAtomic: cap,
    validAfter: block.timestamp,
    deadline: block.timestamp + 3600n,
    policyEpoch: epoch,
    methodologyHash,
    salt: idFromKey(`salt:${label}`),
  };
  store.create(id, intent);
  const signature = await c.owner.signTypedData({
    domain: domain(31337, m.vault),
    types: intentTypes,
    primaryType: "Intent",
    message: intent,
  });
  store.authorize(id, signature);
  return id;
}
if (process.argv[1]?.endsWith("demo.ts")) {
  const store = new Store();
  await setup();
  await publishFixture();
  const id = await seed(store);
  await seed(store, "over-cap-demo", 1n);
  if (process.argv[2] === "run") {
    for (let i = 0; i < 80; i++) {
      await tick(store);
      if (
        store.get(id)?.state === "RECONCILED" &&
        store.get(idFromKey("over-cap-demo"))?.state === "BLOCKED"
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    console.log(
      JSON.stringify(
        store.list().map((o) => ({
          id: o.id,
          state: o.state,
          reason: o.reason,
          receipt: o.receipt ? JSON.parse(o.receipt) : null,
        })),
        null,
        2,
      ),
    );
    if (store.get(id)?.state !== "RECONCILED") process.exitCode = 1;
  } else
    console.log(
      "Seeded owner-signed Simulation supplier obligation and blocked cap example.",
    );
  store.close();
}
