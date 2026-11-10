import { expect, test } from "@playwright/test";
import { openBuild, REFERENCE_URL } from "../helpers";

test.describe("configurator on a phone", () => {
  test("uses the phone layout with a summary bar and no horizontal scroll", async ({ page }) => {
    await openBuild(page);
    await expect(page.getByTestId("configurator")).toHaveAttribute("data-layout", "phone");
    await expect(page.getByTestId("mobile-summary-bar")).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });

  test("picking a CPU from the parts sheet", async ({ page }) => {
    await openBuild(page);
    await page.getByTestId("mobile-slot-cpu").click();
    const sheet = page.getByTestId("parts-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("picker-search")).toBeVisible();
    await sheet.getByTestId("picker-row-ryzen-5-5600").click();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId("mobile-slot-cpu")).toContainText("5600");
    await expect(page).toHaveURL(/[?&]cpu=ryzen-5-5600(&|$)/);
  });

  test("the summary bar opens the summary sheet with the score", async ({ page }) => {
    await openBuild(page, REFERENCE_URL);
    await expect(page.getByTestId("compact-score")).toContainText("100");
    await page.getByTestId("mobile-summary-bar").click();
    const sheet = page.getByTestId("summary-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("build-score")).toHaveText("100");
  });
});
