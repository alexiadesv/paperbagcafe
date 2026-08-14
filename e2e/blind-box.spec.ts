import { expect, test } from "@playwright/test";

test("creates, seals, sends, and opens a toast blind box", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "begin making" }).click();
  await expect(page).toHaveURL(/\/make$/);

  await page.getByRole("button", { name: /Pressed toast/i }).click();
  await page.getByRole("button", { name: "make" }).click();
  await expect(page.getByRole("heading", { name: "Pressed toast" })).toBeVisible();
  await page.getByRole("button", { name: "star" }).click();
  await page.getByLabel("Stamp bread").click();
  await page.getByRole("button", { name: "chocolate" }).click();
  await page.getByRole("button", { name: "next" }).click();
  await page.getByRole("button", { name: "toast", exact: true }).click();
  await page.getByRole("button", { name: "all done!" }).click();

  await page.getByRole("button", { name: "seal" }).click();
  await page.getByLabel("to").fill("Mochi");
  await page.getByLabel("from").fill("Bean");
  await page.getByRole("button", { name: "seal it" }).click();
  await expect(page).toHaveURL(/\/sent$/, { timeout: 10_000 });

  await page.getByRole("button", { name: "tear here to send" }).click();
  await expect(page.getByLabel("secret link")).toBeVisible();
  await page.getByRole("button", { name: "open it" }).click();
  await expect(page.getByRole("heading", { name: "Your blind box is here" })).toBeVisible();
  await page.getByRole("button", { name: /tap to open/i }).click();
  await expect(page.getByRole("heading", { name: "A tiny café made this for you" })).toBeVisible();
  await expect(page.getByRole("img", { name: "star toast" })).toBeVisible();
});
