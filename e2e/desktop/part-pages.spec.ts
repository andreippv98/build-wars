import { expect, test } from "@playwright/test";

const CPU_9800X3D = "/cpu/ryzen-7-9800x3d";

test.describe("CPU pages", () => {
  test("a CPU page has the SEO basics and the index", async ({ page }) => {
    const response = await page.goto(CPU_9800X3D);
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("AMD Ryzen 7 9800X3D");
    const title = await page.title();
    expect(title).toContain("AMD Ryzen 7 9800X3D");
    expect(title).toContain("Build Wars");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/cpu\/ryzen-7-9800x3d$/,
    );

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((n) => JSON.parse(n.textContent ?? "null")));
    const product = blocks.flat().find((b) => b?.["@type"] === "Product");
    expect(product?.name).toBe("AMD Ryzen 7 9800X3D");

    const badge = page.getByRole("region", { name: "CPU index" });
    await expect(badge).toContainText("100");
    await expect(badge).toContainText("Estimate");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  });

  test("Build with this opens the configurator with the CPU selected", async ({ page }) => {
    await page.goto(CPU_9800X3D);
    const link = page.getByRole("link", { name: /Build with this/ });
    await expect(link).toHaveAttribute("href", "/build?cpu=ryzen-7-9800x3d");
    await link.click();
    await expect(page.getByTestId("configurator")).toBeVisible();
    await expect(page.getByTestId("summary-slot-cpu")).toHaveAttribute("data-filled", "true");
  });

  test("lists compatible motherboards only", async ({ page }) => {
    await page.goto(CPU_9800X3D);
    const boards = page.locator("section", { hasText: "Compatible motherboards" });
    await expect(boards.getByText("ASUS ROG Strix X870-A Gaming WiFi")).toBeVisible();
    await expect(boards.getByText("MSI MAG B550 Tomahawk")).toHaveCount(0);
  });

  test("flags boards that need a BIOS update", async ({ page }) => {
    await page.goto("/cpu/ryzen-5-5600");
    const b450 = page.getByRole("link", { name: /B450/ });
    await expect(b450).toBeVisible();
    await expect(b450).toContainText("Needs BIOS update");
  });

  test("an unknown CPU is a 404", async ({ page }) => {
    const response = await page.goto("/cpu/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("the index lists CPUs and links to a page", async ({ page }) => {
    await page.goto("/cpu");
    await expect(page.locator("h1")).toHaveCount(1);
    for (const name of ["AMD Ryzen 7 9800X3D", "AMD Ryzen 5 5600", "Intel Core i5-12400F"]) {
      await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    }
    await page.getByRole("link", { name: /AMD Ryzen 5 5600/ }).click();
    await expect(page).toHaveURL(/\/cpu\/ryzen-5-5600$/);
  });

  test("renders its content without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(CPU_9800X3D);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("AMD Ryzen 7 9800X3D");
    await expect(page.getByText("Boost clock")).toBeVisible();
    await expect(page.getByText("ASUS ROG Strix X870-A Gaming WiFi")).toBeVisible();
    await context.close();
  });
});
