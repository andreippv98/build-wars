import { describe, expect, it } from "vitest";
import { makePsu } from "@/lib/engine/test-fixtures";
import { metaDescription } from "@/lib/seo/metadata";
import {
  efficiencyLabel,
  modularLabel,
  otherPsus,
  psuDescription,
  psuLead,
  psuSpecs,
  psusByWattage,
  psuTitle,
} from "./psu";

const labels = (psu = makePsu()) => psuSpecs(psu).flatMap((g) => g.rows.map((r) => r.label));
const rowOf = (label: string, psu = makePsu()) =>
  psuSpecs(psu)
    .flatMap((g) => g.rows)
    .find((r) => r.label === label);

describe("psuSpecs", () => {
  it("shows every catalog field in order", () => {
    expect(labels()).toEqual([
      "Model",
      "Maker",
      "Wattage",
      "Efficiency",
      "ATX 3.x",
      "Cables",
      "CPU power (8-pin EPS)",
      "PCIe 8-pin (6+2)",
      "PCIe 6-pin",
      "12V-2x6 / 12VHPWR",
    ]);
    expect(psuSpecs(makePsu()).map((g) => g.title)).toEqual(["Overview", "Connectors"]);
  });

  it("formats values", () => {
    expect(rowOf("Model")?.value).toBe("Testmaker Test 1000");
    expect(rowOf("Wattage")?.value).toBe("1000 W");
    expect(rowOf("Efficiency")?.value).toBe("80 Plus Gold");
    expect(rowOf("ATX 3.x")?.value).toBe("Yes");
    expect(rowOf("Cables")?.value).toBe("Fully modular");
    expect(rowOf("CPU power (8-pin EPS)")?.value).toBe("2");
    expect(rowOf("PCIe 8-pin (6+2)")?.value).toBe("4");
    expect(rowOf("PCIe 6-pin")?.value).toBe("0");
    expect(rowOf("12V-2x6 / 12VHPWR")?.value).toBe("1");
  });

  it("adds the adapter note only when there is no 12V-2x6 connector", () => {
    expect(rowOf("12V-2x6 / 12VHPWR", makePsu({ conn_12v2x6_count: 0 }))?.note).toBe(
      "Cards with this connector need an adapter",
    );
    expect(rowOf("12V-2x6 / 12VHPWR", makePsu({ conn_12v2x6_count: 2 }))?.note).toBeUndefined();
  });
});

describe("efficiencyLabel and modularLabel", () => {
  it("label every efficiency tier", () => {
    expect(efficiencyLabel("white")).toBe("80 Plus White");
    expect(efficiencyLabel("bronze")).toBe("80 Plus Bronze");
    expect(efficiencyLabel("silver")).toBe("80 Plus Silver");
    expect(efficiencyLabel("gold")).toBe("80 Plus Gold");
    expect(efficiencyLabel("platinum")).toBe("80 Plus Platinum");
    expect(efficiencyLabel("titanium")).toBe("80 Plus Titanium");
  });

  it("label every modularity value", () => {
    expect(modularLabel("full")).toBe("Fully modular");
    expect(modularLabel("semi")).toBe("Semi-modular");
    expect(modularLabel("none")).toBe("Non-modular (fixed cables)");
  });
});

describe("psuLead", () => {
  it("uses a or an before the wattage", () => {
    expect(psuLead(makePsu({ watts: 750 }))).toContain("is a 750 W");
    expect(psuLead(makePsu({ watts: 850 }))).toContain("is an 850 W");
    expect(psuLead(makePsu({ watts: 1000 }))).toContain("is a 1000 W");
    expect(psuLead(makePsu({ watts: 1100 }))).toContain("is an 1100 W");
  });

  it("names the native 12V-2x6 connector only when there is one", () => {
    expect(psuLead(makePsu({ conn_12v2x6_count: 1 }))).toContain("with a native 12V-2x6 connector");
    expect(psuLead(makePsu({ conn_12v2x6_count: 0 }))).not.toContain("12V-2x6");
  });
});

describe("psuTitle, psuLead and psuDescription", () => {
  const a = makePsu({ maker: "Maker A", model: "Alpha 750", watts: 750 });
  const b = makePsu({ maker: "Maker B", model: "Beta 1000", watts: 1000, atx3: false });

  it("are unique per PSU and name it", () => {
    for (const fn of [psuTitle, psuLead, psuDescription]) {
      expect(fn(a)).toContain("Maker A Alpha 750");
      expect(fn(b)).toContain("Maker B Beta 1000");
      expect(fn(a)).not.toBe(fn(b));
    }
  });

  it("keeps the description within 160 characters", () => {
    const long = makePsu({
      maker: "A Very Long Maker Name Corporation International",
      model: "Super Extreme Edition Platinum Titanium Special 1200",
      watts: 1200,
      eps_count: 4,
      pcie_8pin_count: 12,
      pcie_6pin_count: 3,
      conn_12v2x6_count: 2,
    });
    expect(metaDescription(psuDescription(long)).length).toBeLessThanOrEqual(160);
    expect(metaDescription(psuDescription(a)).length).toBeLessThanOrEqual(160);
  });

  it("states the ATX 3.x answer", () => {
    expect(psuDescription(a)).toContain("ATX 3.x");
    expect(psuDescription(b)).toContain("not ATX 3.x");
  });
});

describe("otherPsus", () => {
  const base = makePsu({ id: "base", maker: "B", model: "Base", watts: 750 });
  const near = makePsu({ id: "near", maker: "N", model: "Near", watts: 800 });
  const far = makePsu({ id: "far", maker: "F", model: "Far", watts: 1200 });
  const same = makePsu({ id: "same", maker: "S", model: "Same", watts: 750 });

  it("drops the PSU itself and sorts closest wattage first, ties by name", () => {
    expect(otherPsus([far, base, near, same], base).map((p) => p.id)).toEqual([
      "same",
      "near",
      "far",
    ]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makePsu({ id: `p${i}`, maker: "M", model: `P${i}`, watts: 500 + i * 50 }),
    );
    expect(otherPsus(many, base)).toHaveLength(6);
    expect(otherPsus(many, base, 3)).toHaveLength(3);
  });
});

describe("psusByWattage", () => {
  it("groups by wattage in order, highest wattage first inside a group, omitting empty groups", () => {
    const groups = psusByWattage([
      makePsu({ id: "a", maker: "A", model: "A", watts: 500 }),
      makePsu({ id: "b", maker: "B", model: "B", watts: 850 }),
      makePsu({ id: "c", maker: "C", model: "C", watts: 750 }),
      makePsu({ id: "d", maker: "D", model: "D", watts: 1200 }),
      makePsu({ id: "e", maker: "E", model: "E", watts: 850 }),
    ]);
    expect(groups.map((g) => g.heading)).toEqual([
      "1000 W and above",
      "750 to 999 W",
      "Under 550 W",
    ]);
    expect(groups[0].psus.map((p) => p.id)).toEqual(["d"]);
    expect(groups[1].psus.map((p) => p.id)).toEqual(["b", "e", "c"]);
    expect(groups[2].psus.map((p) => p.id)).toEqual(["a"]);
  });

  it("puts 550 to 749 W in its own group", () => {
    const groups = psusByWattage([makePsu({ watts: 650 })]);
    expect(groups.map((g) => g.heading)).toEqual(["550 to 749 W"]);
  });
});
