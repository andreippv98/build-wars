import { describe, expect, it } from "vitest";
import { ghz, listWords, mb, memSpeed, plural, vendorName, watts, yesNo } from "./format";

describe("formatters", () => {
  it("formats units", () => {
    expect(watts(250)).toBe("250 W");
    expect(ghz(5.25)).toBe("5.25 GHz");
    expect(ghz(4)).toBe("4 GHz");
    expect(mb(96)).toBe("96 MB");
  });
  it("names vendors", () => {
    expect(vendorName("amd")).toBe("AMD");
    expect(vendorName("intel")).toBe("Intel");
    expect(vendorName("nvidia")).toBe("NVIDIA");
    expect(vendorName("other")).toBe("Other");
  });
  it("formats booleans and memory speeds", () => {
    expect(yesNo(true)).toBe("Yes");
    expect(yesNo(false)).toBe("No");
    expect(memSpeed("DDR5", 5600)).toBe("DDR5-5600");
  });
  it("joins words and pluralises", () => {
    expect(listWords([])).toBe("");
    expect(listWords(["a"])).toBe("a");
    expect(listWords(["a", "b"])).toBe("a and b");
    expect(listWords(["a", "b", "c"])).toBe("a, b and c");
    expect(plural(1, "core")).toBe("1 core");
    expect(plural(8, "core")).toBe("8 cores");
  });
});
