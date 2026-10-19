import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const violations = async (page: import("@playwright/test").Page) =>
  (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);

test("loads with one h1, six sections and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page).toHaveTitle(/Digital Demand Pulse/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toContainText("Keytruda");
  for (const id of ["share", "movers", "spikes", "arabic", "checks", "method"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("the therapy group switch changes both charts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("group", { name: "Therapy group" }).getByRole("button", { name: "Type 2 diabetes" }).click();
  await expect(page.locator("#share h3").first()).toContainText("Type 2 diabetes");
  await expect(page.locator("#share svg[role=img]").first()).toHaveAttribute("aria-label", /Januvia/);
  await page.locator("#share").getByRole("button", { name: "Table", exact: true }).first().click();
  await expect(page.locator("#share table").first().locator("tbody tr")).toHaveCount(6);
});

test("the Arabic table shows the content gap and the workbook downloads", async ({ page, request }) => {
  await page.goto("/");
  await page.locator("#arabic").getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.locator("#arabic table")).toContainText("no Arabic article");
  const href = await page.getByRole("link", { name: /Download the Excel workbook/ }).getAttribute("href");
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
});

for (const scheme of ["light", "dark"] as const) {
  test(`axe finds no violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    expect(await violations(page)).toEqual([]);
  });
}

for (const width of [390, 320]) {
  test(`no sideways scroll at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
}
