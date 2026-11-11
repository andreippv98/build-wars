import { expect, type Page } from "@playwright/test";

export const SLOTS = ["cpu", "gpu", "ram", "motherboard", "psu"] as const;
export type Slot = (typeof SLOTS)[number];

export const REFERENCE = {
  cpu: "ryzen-7-9800x3d",
  gpu: "nvidia-rtx-5090-founders-edition",
  ram: "ddr5-32gb-2x16-6000-cl30",
  mb: "asus-rog-strix-x870-a-gaming-wifi",
  psu: "asus-rog-thor-1200p2",
} as const;

export const REFERENCE_QUERY =
  `cpu=${REFERENCE.cpu}&gpu=${REFERENCE.gpu}&ram=${REFERENCE.ram}` +
  `&mb=${REFERENCE.mb}&psu=${REFERENCE.psu}`;
export const REFERENCE_URL = `/build?${REFERENCE_QUERY}`;

export const BROKEN_URL =
  `/build?cpu=${REFERENCE.cpu}&gpu=${REFERENCE.gpu}&ram=${REFERENCE.ram}` +
  `&mb=msi-b550-tomahawk&psu=corsair-cx450`;

/** Open a build URL and wait for the client-rendered configurator. */
export async function openBuild(page: Page, url = "/build") {
  await page.goto(url);
  await expect(page.getByTestId("configurator")).toBeVisible();
}

/**
 * Opens a picker category and waits until it is open. The click is retried: right after a part
 * is chosen the list above re-lays out (blocked reasons appear and disappear), and a click
 * computed before that shift can land beside the header.
 */
export async function openCategory(page: Page, slot: Slot) {
  const header = page.getByTestId(`picker-category-${slot}`);
  await expect(async () => {
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
    await expect(header).toHaveAttribute("aria-expanded", "true", { timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}
