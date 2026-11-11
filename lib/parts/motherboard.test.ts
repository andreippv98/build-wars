import { describe, expect, it } from "vitest";
import { makeMotherboard } from "@/lib/engine/test-fixtures";
import type { Chipset } from "@/lib/schemas";
import { metaDescription } from "@/lib/seo/metadata";
import {
  motherboardDescription,
  motherboardLead,
  motherboardSpecs,
  motherboardTitle,
  motherboardsBySocket,
  otherMotherboards,
} from "./motherboard";

const chipset: Chipset = {
  id: "test-chipset",
  vendor: "amd",
  name: "X999",
  socket: "AM5",
  cpu_support: [{ cpu_generation: "ryzen-9000", needs_bios_update: false }],
  source_notes: "test",
  verified: false,
};

const labels = (board = makeMotherboard()) =>
  motherboardSpecs(board, chipset).flatMap((g) => g.rows.map((r) => r.label));
const value = (label: string, board = makeMotherboard()) =>
  motherboardSpecs(board, chipset)
    .flatMap((g) => g.rows)
    .find((r) => r.label === label)?.value;

describe("motherboardSpecs", () => {
  it("shows every catalog field in order", () => {
    expect(labels()).toEqual([
      "Model",
      "Maker",
      "Chipset",
      "Socket",
      "Form factor",
      "Memory type",
      "Memory slots",
      "Max memory",
      "Max memory speed",
      "Main graphics slot",
      "CPU power connectors",
    ]);
    expect(motherboardSpecs(makeMotherboard(), chipset).map((g) => g.title)).toEqual([
      "Overview",
      "Memory",
      "Expansion and power",
    ]);
  });

  it("formats values with units", () => {
    expect(value("Chipset")).toBe("X999");
    expect(value("Memory slots")).toBe("4 slots");
    expect(value("Max memory")).toBe("192 GB");
    expect(value("Max memory speed")).toBe("DDR5-8000");
    expect(value("Main graphics slot")).toBe("PCIe 5");
  });

  it("words the EPS connectors for one and two", () => {
    expect(value("CPU power connectors", makeMotherboard({ eps_required: 1 }))).toBe(
      "1 x 8-pin EPS",
    );
    expect(value("CPU power connectors", makeMotherboard({ eps_required: 2 }))).toBe(
      "2 x 8-pin EPS",
    );
  });
});

describe("motherboardTitle, motherboardLead and motherboardDescription", () => {
  const a = makeMotherboard({ maker: "Maker A", model: "Board One" });
  const b = makeMotherboard({ maker: "Maker B", model: "Board Two", form_factor: "mATX" });

  it("are unique per board and name it", () => {
    const fns = [
      (board: typeof a) => motherboardTitle(board),
      (board: typeof a) => motherboardLead(board, chipset),
      (board: typeof a) => motherboardDescription(board, chipset),
    ];
    for (const fn of fns) {
      expect(fn(a)).toContain("Maker A Board One");
      expect(fn(b)).toContain("Maker B Board Two");
      expect(fn(a)).not.toBe(fn(b));
    }
  });

  it("keeps the description within 160 characters", () => {
    const long = makeMotherboard({
      maker: "Very Long Maker Name Incorporated",
      model: "Extreme Edition Special Wi-Fi 7 Overclocking Board",
      max_mem_gb: 256,
      ram_slots: 4,
    });
    expect(metaDescription(motherboardDescription(long, chipset)).length).toBeLessThanOrEqual(160);
    expect(metaDescription(motherboardDescription(a, chipset)).length).toBeLessThanOrEqual(160);
  });
});

describe("otherMotherboards", () => {
  const base = makeMotherboard({ id: "base", model: "Base", chipset_id: "test-chipset" });
  const sameChipset = makeMotherboard({ id: "same", model: "Same", chipset_id: "test-chipset" });
  const otherChipset = makeMotherboard({ id: "other", model: "Other", chipset_id: "x-chipset" });
  const otherSocket = makeMotherboard({ id: "am4", model: "Am4", socket: "AM4" });

  it("keeps the same socket, drops the board itself, same chipset first", () => {
    expect(
      otherMotherboards([otherChipset, base, otherSocket, sameChipset], base).map((b) => b.id),
    ).toEqual(["same", "other"]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makeMotherboard({ id: `m${i}`, model: `M${i}` }),
    );
    expect(otherMotherboards(many, base)).toHaveLength(6);
    expect(otherMotherboards(many, base, 3)).toHaveLength(3);
  });
});

describe("motherboardsBySocket", () => {
  it("groups by socket in the fixed socket order and sorts boards by name", () => {
    const groups = motherboardsBySocket([
      makeMotherboard({ id: "a", maker: "Z", model: "A", socket: "AM4" }),
      makeMotherboard({ id: "b", maker: "M", model: "B", socket: "AM5" }),
      makeMotherboard({ id: "c", maker: "A", model: "C", socket: "AM4" }),
      makeMotherboard({ id: "d", maker: "Q", model: "D", socket: "LGA1700" }),
    ]);
    expect(groups.map((g) => g.socket)).toEqual(["AM5", "LGA1700", "AM4"]);
    expect(groups[2].boards.map((b) => b.id)).toEqual(["c", "a"]);
  });
});
