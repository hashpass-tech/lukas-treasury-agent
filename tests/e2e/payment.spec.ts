import { test, expect } from "@playwright/test";
import { clients } from "../../packages/core/chain.js";
test.beforeEach(async ({ page }) => {
  const c = clients();
  await page.exposeFunction(
    "testWalletRequest",
    async ({ method, params }: { method: string; params: any[] }) => {
      if (method === "eth_chainId") return "0x7a69";
      if (method === "eth_requestAccounts" || method === "eth_accounts")
        return [c.owner.account.address];
      if (method === "personal_sign")
        return c.owner.signMessage({ message: params[0] });
      if (method === "eth_signTypedData_v4") {
        const typed = JSON.parse(params[1]);
        delete typed.types.EIP712Domain;
        return c.owner.signTypedData(typed);
      }
      throw new Error(`Unsupported ${method}`);
    },
  );
  await page.addInitScript(() => {
    (window as any).ethereum = {
      request: (args: any) => (window as any).testWalletRequest(args),
    };
  });
});
test("owner reviews, signs and sees a real local settled receipt", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("SIMULATION · CHAIN 31337")).toBeVisible();
  await page.getByRole("button", { name: "Connect owner wallet" }).click();
  await expect(
    page.getByRole("button", { name: "Wallet connected" }),
  ).toBeVisible();
  await page.getByLabel("LUKAS denomination").fill("1");
  await page.getByRole("button", { name: "Review exact terms" }).click();
  await expect(
    page.getByRole("heading", { name: "Review before signing" }),
  ).toBeVisible();
  const id = await page.locator(".review").getAttribute("data-draft-id");
  await page.getByRole("button", { name: "Sign bounded obligation" }).click();
  await expect(
    page.locator(`[data-obligation-id="${id}"]`).filter({ hasText: "Settled" }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .locator(`[data-obligation-id="${id}"]`)
    .filter({ hasText: "Settled" })
    .locator("summary")
    .click();
  await expect(
    page
      .getByText(
        "Local transaction; no mainnet evidence, identity registration, or eligible attribution.",
      )
      .first(),
  ).toBeVisible();
});
test("over-cap obligation remains visibly unpaid", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Connect owner wallet" }).click();
  await expect(
    page.getByRole("button", { name: "Wallet connected" }),
  ).toBeVisible();
  await page.getByLabel("LUKAS denomination").fill("2");
  await page.getByLabel("Maximum SIMCOP settlement").fill("0.000001");
  await page.getByRole("button", { name: "Review exact terms" }).click();
  const id = await page.locator(".review").getAttribute("data-draft-id");
  await page.getByRole("button", { name: "Sign bounded obligation" }).click();
  await expect(
    page
      .locator(`[data-obligation-id="${id}"]`)
      .filter({ hasText: "Unpaid: MAX_SETTLEMENT_EXCEEDED" }),
  ).toBeVisible({ timeout: 30000 });
});
