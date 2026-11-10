import { describe, expect, it } from "vitest";
import { slotEnvelope, type SlotCategory } from "./envelope";
import { DIMENSIONS } from "./standard";

const CATEGORIES: SlotCategory[] = ["gpu", "ram", "cpu_cooler", "psu", "motherboard"];

function size(category: SlotCategory) {
  const { min, max } = slotEnvelope(category);
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
}

describe("slotEnvelope", () => {
  it.each(CATEGORIES)("%s: is non-empty on every axis", (category) => {
    for (const extent of size(category)) expect(extent).toBeGreaterThan(0);
  });

  it("gpu: two slots thick, DIMENSIONS.gpuHeight tall, rising from the board", () => {
    const { min, max } = slotEnvelope("gpu");
    expect(min).toEqual([0, -2 * DIMENSIONS.slotPitch, 0]);
    expect(max[1]).toBe(0);
    expect(max[2]).toBe(DIMENSIONS.gpuHeight);
  });

  it("ram: one stick, centred on its connector, sized by DIMENSIONS.ramStick", () => {
    const { length, thickness, bareHeight } = DIMENSIONS.ramStick;
    expect(size("ram")).toEqual([thickness, length, bareHeight]);
    const { min, max } = slotEnvelope("ram");
    expect(min[0]).toBe(-max[0]);
    expect(min[1]).toBe(-max[1]);
    expect(min[2]).toBe(0);
  });

  it("cpu_cooler: about 90 x 130 x 160, centred on the socket", () => {
    expect(size("cpu_cooler")).toEqual([90, 130, 160]);
    const { min, max } = slotEnvelope("cpu_cooler");
    expect(min[0]).toBe(-max[0]);
    expect(min[1]).toBe(-max[1]);
  });

  it("psu: DIMENSIONS.psu from its rear bottom corner", () => {
    const { length, height, width } = DIMENSIONS.psu;
    expect(slotEnvelope("psu")).toEqual({ min: [0, 0, 0], max: [length, height, width] });
  });

  it("motherboard: the ATX outline, spanning +X and -Y from the top rear corner", () => {
    const { width, height } = DIMENSIONS.motherboard.ATX;
    const { min, max } = slotEnvelope("motherboard");
    expect(min.slice(0, 2)).toEqual([0, -height]);
    expect(max.slice(0, 2)).toEqual([width, 0]);
    expect(min[2]).toBe(0);
  });
});
