import { expect, test, type Page } from "@playwright/test";
import { BROKEN_URL, REFERENCE, REFERENCE_URL, SLOTS, openBuild, openCategory } from "../helpers";

const scene = (page: Page) => page.getByTestId("scene");

/** Fails loudly (rather than skipping) when the browser cannot draw the 3D scene. */
async function openScene(page: Page, url: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openBuild(page, url);
  await expect(page.locator('[data-testid="scene"][data-renderer="webgl"]')).toBeVisible();
  await expect(scene(page).locator("canvas")).toBeVisible();
  return errors;
}

test.describe("3D scene", () => {
  test("renders with WebGL and offers a reset view button", async ({ page }) => {
    const errors = await openScene(page, "/build");
    await expect(page.getByTestId("scene-reset-view")).toBeVisible();
    await page.getByTestId("scene-reset-view").click();
    expect(errors).toEqual([]);
  });

  test("a full build lists every slot as drawn and none as empty", async ({ page }) => {
    const errors = await openScene(page, REFERENCE_URL);
    await expect(scene(page)).toHaveAttribute("data-empty", "");
    await expect(scene(page)).toHaveAttribute("data-problems", "");
    for (const slot of SLOTS) {
      await expect(scene(page)).toHaveAttribute("data-parts", new RegExp(`\\b${slot}:`));
    }
    expect(errors).toEqual([]);
  });

  test("an empty build lists all five slots as empty", async ({ page }) => {
    const errors = await openScene(page, "/build");
    await expect(scene(page)).toHaveAttribute("data-empty", "cpu gpu ram motherboard psu");
    await expect(scene(page)).toHaveAttribute("data-parts", "");
    await expect(scene(page)).toHaveAttribute("data-active-slot", "");
    expect(errors).toEqual([]);
  });

  test("opening a picker category focuses that slot", async ({ page }) => {
    const errors = await openScene(page, "/build");
    await openCategory(page, "gpu");
    await expect(scene(page)).toHaveAttribute("data-active-slot", "gpu");
    await openCategory(page, "ram");
    await expect(scene(page)).toHaveAttribute("data-active-slot", "ram");
    expect(errors).toEqual([]);
  });

  test("hovering a part in the list shows its ghost, leaving clears it", async ({ page }) => {
    const errors = await openScene(page, "/build");
    await openCategory(page, "gpu");
    const row = page.getByTestId(`picker-row-${REFERENCE.gpu}`);
    await row.hover();
    await expect(scene(page)).toHaveAttribute("data-ghost", `gpu:${REFERENCE.gpu}`);
    await page.getByTestId("picker-search").hover();
    await expect(scene(page)).toHaveAttribute("data-ghost", "");
    expect(errors).toEqual([]);
  });

  test("choosing a part fills the slot and clears the ghost", async ({ page }) => {
    const errors = await openScene(page, "/build");
    await openCategory(page, "gpu");
    await page.getByTestId(`picker-row-${REFERENCE.gpu}`).click();
    await expect(scene(page)).toHaveAttribute("data-parts", /gpu:/);
    await expect(scene(page)).toHaveAttribute("data-empty", "cpu ram motherboard psu");
    await expect(scene(page)).toHaveAttribute("data-ghost", "");
    await page.getByTestId("remove-gpu").click();
    await expect(scene(page)).toHaveAttribute("data-empty", "cpu gpu ram motherboard psu");
    expect(errors).toEqual([]);
  });

  test("a build with errors marks the slots with problems", async ({ page }) => {
    const errors = await openScene(page, BROKEN_URL);
    await expect(scene(page)).toHaveAttribute("data-problems", /\bpsu:error\b/);
    expect(errors).toEqual([]);
  });
});
