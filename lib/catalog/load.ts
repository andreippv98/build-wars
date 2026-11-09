import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { validateCatalog } from "@/lib/catalog/validate";
import {
  ChipsetSchema,
  CpuSchema,
  GpuFileSchema,
  ModelEntrySchema,
  MotherboardSchema,
  PsuSchema,
  RamKitSchema,
  type Catalog,
  type CatalogIssue,
  type GpuFile,
} from "@/lib/schemas";

export type LoadResult = {
  /** Present only when every file parsed and passed its schema. */
  catalog?: Catalog;
  /** Schema issues (with `file` set) followed by cross-reference issues from `validateCatalog`. */
  issues: CatalogIssue[];
};

/**
 * Reads and validates the catalog from a data directory (Node only; uses `node:fs`).
 * Layout is documented on `CatalogSchema`. Missing files count as empty collections, except that
 * an unreadable or non-JSON file is an issue. GPU files are read in alphabetical order and their
 * chips / boards concatenated. Cross-reference checks run only if all schemas passed.
 */
export async function loadCatalog(dataDir: string): Promise<LoadResult> {
  const issues: CatalogIssue[] = [];

  /** Reads one JSON file. `undefined` = missing (empty) or already reported as an issue. */
  async function readJson(file: string): Promise<unknown> {
    let text: string;
    try {
      text = await readFile(path.join(dataDir, file), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      issues.push({ file, path: "", message: `Cannot read file: ${(error as Error).message}` });
      return undefined;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      issues.push({ file, path: "", message: `Not valid JSON: ${(error as Error).message}` });
      return undefined;
    }
  }

  function report(file: string, prefix: string, raw: unknown, error: z.ZodError) {
    for (const issue of error.issues) {
      const segments = issue.path as (string | number)[];
      const p = prefix + formatPath(segments, prefix === "");
      const id = recordId(raw, segments, prefix === "");
      issues.push({
        file,
        path: p,
        message: id ? `Record "${id}": ${issue.message}` : issue.message,
      });
    }
  }

  async function readArray<T>(
    file: string,
    collection: string,
    schema: z.ZodType<T>,
  ): Promise<T[]> {
    const raw = await readJson(file);
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      issues.push({ file, path: collection, message: "The file must contain a JSON array." });
      return [];
    }
    const out: T[] = [];
    raw.forEach((record, index) => {
      const result = schema.safeParse(record);
      if (result.success) {
        out.push(result.data);
      } else {
        // Re-root the record's issues under `<collection>[<index>]`.
        for (const issue of result.error.issues) {
          const id = recordId(record, issue.path as (string | number)[], false, true);
          issues.push({
            file,
            path: `${collection}[${index}]${formatPath(issue.path as (string | number)[], false)}`,
            message: id ? `Record "${id}": ${issue.message}` : issue.message,
          });
        }
      }
    });
    return out;
  }

  const cpus = await readArray("cpus.json", "cpus", CpuSchema);
  const chipsets = await readArray("chipsets.json", "chipsets", ChipsetSchema);
  const motherboards = await readArray("motherboards.json", "motherboards", MotherboardSchema);
  const ram_kits = await readArray("ram-kits.json", "ram_kits", RamKitSchema);
  const psus = await readArray("psus.json", "psus", PsuSchema);
  const models = await readArray("models/manifest.json", "models", ModelEntrySchema);

  const gpu_chips: GpuFile["chips"] = [];
  const gpu_boards: GpuFile["boards"] = [];
  let gpuFiles: string[] = [];
  try {
    gpuFiles = (await readdir(path.join(dataDir, "gpus")))
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      issues.push({
        file: "gpus",
        path: "",
        message: `Cannot read folder: ${(error as Error).message}`,
      });
    }
  }
  for (const name of gpuFiles) {
    const file = `gpus/${name}`;
    const raw = await readJson(file);
    if (raw === undefined) continue;
    const result = GpuFileSchema.safeParse(raw);
    if (result.success) {
      gpu_chips.push(...result.data.chips);
      gpu_boards.push(...result.data.boards);
    } else {
      report(file, "", raw, result.error);
    }
  }

  if (issues.length > 0) return { issues };

  const catalog: Catalog = {
    cpus,
    gpu_chips,
    gpu_boards,
    chipsets,
    motherboards,
    ram_kits,
    psus,
    models,
  };
  return { catalog, issues: validateCatalog(catalog) };
}

/** `[1, "vram_gb"]` -> `[1].vram_gb`; with `rootIsKey` the first segment has no leading dot. */
function formatPath(segments: (string | number)[], rootIsKey: boolean): string {
  return segments
    .map((seg, i) =>
      typeof seg === "number" ? `[${seg}]` : i === 0 && rootIsKey ? seg : `.${seg}`,
    )
    .join("");
}

/**
 * Finds the `id` of the record an issue belongs to. For array files the record is `raw` itself
 * (`isRecord`) or `raw[segments[0]]`; for gpu files it is `raw[segments[0]][segments[1]]`.
 */
function recordId(
  raw: unknown,
  segments: (string | number)[],
  gpuFile: boolean,
  isRecord = false,
): string | undefined {
  let record: unknown = raw;
  if (!isRecord) {
    if (!gpuFile) record = (raw as unknown[] | undefined)?.[segments[0] as number];
    else {
      const list = (raw as Record<string, unknown> | null)?.[segments[0] as string];
      record = Array.isArray(list) ? list[segments[1] as number] : undefined;
    }
  }
  if (record && typeof record === "object" && "id" in record) {
    const id = (record as { id: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}
