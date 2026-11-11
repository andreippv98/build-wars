import { expect, test } from "@playwright/test";

const FE = "/gpu/rtx-5090/founders-edition";

test.describe("Graphics card pages", () => {
  test("the index lists chips and links to a chip page", async ({ page }) => {
    const response = await page.goto("/gpu");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    for (const name of ["RTX 5090", "RTX 4090", "RX 7900 XT"]) {
      await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible();
    }
    await page
      .getByRole("link", { name: /RTX 5090/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/gpu\/rtx-5090$/);
  });

  test("a chip page has the SEO basics, the index and a comparison table", async ({ page }) => {
    const response = await page.goto("/gpu/rtx-4090");
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.title()).toContain("Build Wars");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/gpu\/rtx-4090$/);
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((n) => JSON.parse(n.textContent ?? "null")));
    expect(blocks.flat().find((b) => b?.["@type"] === "Product")).toBeTruthy();

    const badge = page.getByRole("region", { name: "GPU index" });
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("Estimate");
    await expect(page.getByText("Pick a card model below to build with it.")).toBeVisible();

    const table = page.getByRole("table", { name: /card models/ });
    await expect(table).toBeVisible();
    const bodyRows = table.locator("tbody tr");
    await expect(bodyRows).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(bodyRows.nth(i).getByRole("rowheader").getByRole("link")).toHaveAttribute(
        "href",
        /^\/gpu\/rtx-4090\/.+/,
      );
    }
  });

  test("a chip with power spikes shows the row", async ({ page }) => {
    await page.goto("/gpu/rtx-3080-10gb");
    await expect(page.getByText("Power spikes", { exact: true })).toBeVisible();
    await expect(page.getByText("Known for large spikes")).toBeVisible();
  });

  test("a chip with 8 lanes shows the note", async ({ page }) => {
    await page.goto("/gpu/rtx-4060");
    await expect(page.getByText(/Uses 8 lanes/)).toBeVisible();
  });

  test("a board page has the SEO basics and a working build link", async ({ page }) => {
    const response = await page.goto(FE);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("Founders Edition");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/gpu\/rtx-5090\/founders-edition$/,
    );

    const psus = page.locator("section", { hasText: "Power supplies that fit" });
    await expect(psus.getByText("Corsair CX450")).toHaveCount(0);

    const link = page.getByRole("link", { name: "Build with this graphics card" });
    await expect(link).toHaveAttribute("href", "/build?gpu=nvidia-rtx-5090-founders-edition");
    await link.click();
    await expect(page.getByTestId("configurator")).toBeVisible();
    await expect(page.getByTestId("summary-slot-gpu")).toHaveAttribute("data-filled", "true");
  });

  test("wrong chip and board pairs are 404", async ({ page }) => {
    for (const path of [
      "/gpu/rtx-5090/does-not-exist",
      "/gpu/rtx-4090/founders-edition-typo",
      "/gpu/rtx-4060/founders-edition",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });

  test("the chip page has no horizontal page scroll on a phone", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto("/gpu/rtx-5070");
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
    await expect(page.getByText("Scroll sideways to compare")).toBeVisible();
    await context.close();
  });

  test("renders its content without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto("/gpu/rtx-4090");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("NVIDIA GeForce RTX 4090");
    await expect(page.getByRole("table", { name: /card models/ })).toBeVisible();
    await context.close();
  });
});
