import fs from "node:fs";
import { chromium } from "@playwright/test";
import { clients } from "../packages/core/chain.js";
import { assertLocal } from "../packages/core/chain.js";
assertLocal();
fs.mkdirSync("docs/demo", { recursive: true });
const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: true,
  }),
  context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    recordVideo: { dir: ".local/capture", size: { width: 1440, height: 1100 } },
  }),
  page = await context.newPage(),
  c = clients();
await page.exposeFunction(
  "testWalletRequest",
  async ({ method, params }: { method: string; params: any[] }) => {
    if (method === "eth_chainId") return "0x7a69";
    if (["eth_accounts", "eth_requestAccounts"].includes(method))
      return [c.owner.account.address];
    if (method === "personal_sign")
      return c.owner.signMessage({ message: params[0] });
    if (method === "eth_signTypedData_v4") {
      const typed = JSON.parse(params[1]);
      delete typed.types.EIP712Domain;
      return c.owner.signTypedData(typed);
    }
    throw new Error("UNSUPPORTED_DEMO_WALLET_METHOD");
  },
);
await page.addInitScript(() => {
  (window as any).ethereum = {
    request: (args: any) => (window as any).testWalletRequest(args),
  };
});
await page.goto("http://127.0.0.1:3000");
await page.evaluate(() => {
  const note = document.createElement("div");
  note.textContent =
    "LOCAL SIMULATION · automated test wallet · real local EVM settlement · no mainnet evidence";
  note.style.cssText =
    "position:fixed;bottom:0;left:0;right:0;background:#10241e;color:white;padding:12px;text-align:center;z-index:1000";
  document.body.appendChild(note);
});
await page.getByRole("button", { name: "Connect owner wallet" }).click();
await page.getByRole("button", { name: "Wallet connected" }).waitFor();
await page.getByLabel("LUKAS denomination").fill("1");
await page.getByRole("button", { name: "Review exact terms" }).click();
const id = await page.locator("[data-draft-id]").getAttribute("data-draft-id");
await page.screenshot({ path: "docs/demo/review.png", fullPage: true });
await page.getByRole("button", { name: "Sign bounded obligation" }).click();
const row = page.locator(`[data-obligation-id="${id}"]`);
await row.filter({ hasText: "Settled" }).waitFor({ timeout: 35000 });
await row.locator("summary").click();
await page.screenshot({ path: "docs/demo/settled.png", fullPage: true });
await page.getByLabel("Maximum SIMCOP settlement").fill("0.000001");
await page.getByRole("button", { name: "Review exact terms" }).click();
const blocked = await page
  .locator("[data-draft-id]")
  .getAttribute("data-draft-id");
await page.getByRole("button", { name: "Sign bounded obligation" }).click();
await page
  .locator(`[data-obligation-id="${blocked}"]`)
  .filter({ hasText: "MAX_SETTLEMENT_EXCEEDED" })
  .waitFor({ timeout: 35000 });
await page.screenshot({ path: "docs/demo/blocked.png", fullPage: true });
const video = page.video()!;
await context.close();
await video.saveAs("docs/demo/local-simulation.webm");
await browser.close();
console.log(
  "Captured labeled local simulation video and review/settled/blocked screenshots in docs/demo; no real-network evidence implied.",
);
