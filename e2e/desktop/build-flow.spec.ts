import { expect, test } from "@playwright/test";
import {
  BROKEN_URL,
  openBuild,
  REFERENCE,
  REFERENCE_QUERY,
  REFERENCE_URL,
  SLOTS,
} from "../helpers";

test.describe("configurator on desktop", () => {
  test("empty state shows three areas, empty slots and a missing-parts message", async ({
    page,
  }) => {
    await openBuild(page);
    await expect(page.getByTestId("configurator")).toHaveAttribute("data-layout", "desktop");
    await expect(page.getByTestId("part-picker")).toBeVisible();
    await expect(page.getByTestId("scene")).toBeVisible();
    await expect(page.getByTestId("summary-panel")).toBeVisible();
    for (const slot of SLOTS) {
      await expect(page.getByTestId(`scene-slot-${slot}`)).toHaveAttribute("data-state", "empty");
    }
    await expect(page.getByTestId("score-missing")).toBeVisible();
    await expect(page.getByTestId("build-score")).toHaveCount(0);
  });

  test("builds the reference PC through the picker", async ({ page }) => {
    await openBuild(page);

    // CPU, using search.
    await page.getByTestId("picker-category-cpu").click();
    const count = page.getByTestId("picker-count");
    await expect(count).toHaveText(/^\d+ parts$/);
    const before = Number((await count.innerText()).split(" ")[0]);
    expect(before).toBeGreaterThan(1);
    await page.getByTestId("picker-search").fill("9800");
    await expect(count).toHaveText(/^1 part$/);
    await expect(page.getByTestId(`picker-row-${REFERENCE.cpu}`)).toBeVisible();
    await expect(page.getByTestId("picker-row-ryzen-5-5600")).toHaveCount(0);
    await page.getByTestId(`picker-row-${REFERENCE.cpu}`).click();
    await expect(page.getByTestId(`picker-row-${REFERENCE.cpu}`)).toHaveAttribute(
      "data-selected",
      "true",
    );

    const rest = [
      ["gpu", REFERENCE.gpu],
      ["ram", REFERENCE.ram],
      ["motherboard", REFERENCE.mb],
      ["psu", REFERENCE.psu],
    ] as const;
    for (const [slot, id] of rest) {
      await page.getByTestId(`picker-category-${slot}`).click();
      const row = page.getByTestId(`picker-row-${id}`);
      await expect(row).toHaveAttribute("data-blocked", "false");
      await row.click();
      await expect(row).toHaveAttribute("data-selected", "true");
    }

    await expect(page).toHaveURL(new RegExp(`\\?${REFERENCE_QUERY}$`));
    await expect(page.getByTestId("build-score")).toHaveText("100");
    await expect(page.getByTestId("score-band")).toHaveText("Enthusiast");
    await expect(page.getByTestId("power-peak")).toContainText("812");
    await expect(page.getByTestId("power-recommended")).toContainText("1100");
    await expect(page.getByTestId("headroom-bar")).toHaveAttribute("data-status", "green");
    await expect(page.getByTestId("issue-error")).toHaveCount(0);
    await expect(page.getByTestId("issue-warning")).toHaveCount(0);
    for (const slot of SLOTS) {
      await expect(page.getByTestId(`scene-slot-${slot}`)).toHaveAttribute("data-state", "filled");
    }
  });

  test("a build URL survives a reload", async ({ page }) => {
    await openBuild(page, REFERENCE_URL);
    await expect(page.getByTestId("build-score")).toHaveText("100");
    await page.reload();
    await expect(page.getByTestId("configurator")).toBeVisible();
    await expect(page.getByTestId("build-score")).toHaveText("100");
    for (const slot of SLOTS) {
      await expect(page.getByTestId(`summary-slot-${slot}`)).toHaveAttribute("data-filled", "true");
    }
    await expect(page).toHaveURL(new RegExp(`\\?${REFERENCE_QUERY}$`));
  });

  test("incompatible parts are blocked in the picker", async ({ page }) => {
    await openBuild(page, `/build?cpu=${REFERENCE.cpu}`);
    await page.getByTestId("picker-category-motherboard").click();
    const blocked = page.getByTestId("picker-row-msi-b550-tomahawk");
    await expect(blocked).toHaveAttribute("data-blocked", "true");
    await expect(blocked).toContainText(/socket/i);
    const urlBefore = page.url();
    // aria-disabled rows make a plain click wait forever, so force it.
    await blocked.click({ force: true });
    await expect(page.getByTestId("scene-slot-motherboard")).toHaveAttribute("data-state", "empty");
    expect(page.url()).toBe(urlBefore);
    await expect(page.getByTestId("picker-row-asus-rog-strix-x870-a-gaming-wifi")).toHaveAttribute(
      "data-blocked",
      "false",
    );
  });

  test("a broken build shows errors, a red headroom bar and a not-final score", async ({
    page,
  }) => {
    await openBuild(page, BROKEN_URL);
    const errors = page.getByTestId("issue-error");
    for (const rule of ["cpu_socket", "ram_type", "psu_wattage", "gpu_power_connectors"]) {
      await expect(errors.and(page.locator(`[data-rule="${rule}"]`))).toHaveCount(1);
    }
    await expect(page.getByTestId("score-not-final")).toBeVisible();
    await expect(page.getByTestId("headroom-bar")).toHaveAttribute("data-status", "red");
    await expect(page.getByTestId("scene-slot-psu")).toHaveAttribute("data-problem", "error");
  });

  test("an older CPU on a board that needs a BIOS update gives a warning", async ({ page }) => {
    await openBuild(page, "/build?cpu=ryzen-5-5600&mb=msi-b450-tomahawk-max");
    const warning = page
      .getByTestId("issue-warning")
      .and(page.locator('[data-rule="cpu_generation"]'));
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/BIOS update/i);
  });

  test("removing a part and clearing the build", async ({ page }) => {
    await openBuild(page, REFERENCE_URL);
    await expect(page.getByTestId("build-score")).toHaveText("100");

    await page.getByTestId("remove-gpu").click();
    await expect(page.getByTestId("score-missing")).toBeVisible();
    await expect(page.getByTestId("build-score")).toHaveCount(0);
    await expect(page.getByTestId("summary-slot-gpu")).toHaveAttribute("data-filled", "false");
    await expect.poll(() => new URL(page.url()).searchParams.has("gpu")).toBe(false);
    expect(new URL(page.url()).searchParams.get("cpu")).toBe(REFERENCE.cpu);

    await page.getByTestId("clear-build").click();
    await expect.poll(() => new URL(page.url()).search).toBe("");
    for (const slot of SLOTS) {
      await expect(page.getByTestId(`scene-slot-${slot}`)).toHaveAttribute("data-state", "empty");
      await expect(page.getByTestId(`summary-slot-${slot}`)).toHaveAttribute(
        "data-filled",
        "false",
      );
    }
  });

  test("unknown or malformed ids in the URL do not crash the page", async ({ page }) => {
    await openBuild(page, "/build?cpu=does-not-exist&gpu=%3Cscript%3E");
    for (const slot of SLOTS) {
      await expect(page.getByTestId(`scene-slot-${slot}`)).toHaveAttribute("data-state", "empty");
    }
    await expect(page.getByTestId("score-missing")).toBeVisible();
  });

  test("the share button copies the absolute build URL", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openBuild(page, REFERENCE_URL);
    await page.getByTestId("share-button").click();
    await expect(page.getByTestId("share-button")).toContainText("Link copied");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(`${baseURL}${REFERENCE_URL}`);
  });
});
