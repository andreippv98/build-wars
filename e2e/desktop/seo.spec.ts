import { expect, test } from "@playwright/test";

test.describe("sitemap and robots", () => {
  test("sitemap.xml lists parts and pages, never /dev or a query string", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("/cpu/ryzen-7-9800x3d</loc>");
    expect(body).toContain("/how-scores-work</loc>");
    expect(body).toMatch(/<loc>[^<]*\/gpu\/[^/<]+\/[^/<]+<\/loc>/);
    expect(body).not.toContain("/dev");
    // No URL carries a query string (the XML declaration itself contains "?").
    const locs = [...body.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
    expect(locs.length).toBeGreaterThan(10);
    expect(locs.filter((loc) => loc.includes("?"))).toEqual([]);
    expect(body).not.toContain("lastmod");
  });

  test("robots.txt blocks /dev/ and names the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/Disallow: \/dev\//);
    expect(body).toMatch(/Disallow: \/api\//);
    expect(body).toMatch(/Disallow: \/me\//);
    expect(body).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });
});

test.describe("/how-scores-work", () => {
  test("has the metadata and content of the methodology page", async ({ page }) => {
    await page.goto("/how-scores-work");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/how-scores-work$/,
    );
    await expect(page.getByTestId("reference-score")).toHaveText("100");
    for (const label of ["Enthusiast", "High-end", "Mid-range", "Entry", "Basic"]) {
      await expect(page.getByRole("rowheader", { name: label })).toBeVisible();
    }
    // G = 100, C = 40, R = 1 with the 0.7 / 0.3 weights: about 76 (a plain average gives 82).
    await expect(page.getByTestId("worked-geometric")).toHaveText("76");
    await expect(page.getByTestId("worked-average")).toHaveText("82");
  });

  test("'Open the reference build' opens the configurator at Build Score 100", async ({ page }) => {
    await page.goto("/how-scores-work");
    await page.getByRole("link", { name: "Open the reference build" }).click();
    await expect(page).toHaveURL(/\/build\?.*cpu=ryzen-7-9800x3d/);
    await expect(page.getByTestId("configurator")).toBeVisible();
    await expect(page.getByTestId("build-score")).toHaveText("100");
  });
});

test.describe("home page", () => {
  test("has one h1, the start link and the four section links", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Start a build" })).toHaveAttribute(
      "href",
      "/build",
    );
    const main = page.getByRole("main");
    for (const href of ["/cpu", "/gpu", "/motherboard", "/psu", "/how-scores-work"]) {
      await expect(main.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the home page renders its content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("link", { name: "Start a build" })).toBeVisible();
    await expect(page.getByRole("main").locator('a[href="/cpu"]')).toBeVisible();
  });

  test("the methodology page renders its content", async ({ page }) => {
    await page.goto("/how-scores-work");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByTestId("reference-score")).toHaveText("100");
    await expect(page.getByTestId("worked-geometric")).toHaveText("76");
    await expect(page.getByRole("rowheader", { name: "Enthusiast" })).toBeVisible();
  });
});
