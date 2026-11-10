import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { cloneDocument, dedup, meshopt, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { inspectModel, type ModelReport } from "@/lib/models/inspect";
import { MODEL_BUDGET } from "@/lib/models/standard";
import {
  MODEL_CATEGORIES,
  ModelEntrySchema,
  SlugSchema,
  type ModelCategory,
  type ModelEntry,
} from "@/lib/schemas";

/**
 * `pnpm models:import <file.glb> --category <category> --id <model-id> ...`
 * Validates a model against the model standard, optimises it, makes a low-detail version and
 * stores both. See docs/model-standard.md. Upload to object storage is not set up yet.
 */

const USAGE = `Usage:
  pnpm models:import <file.glb> --category <category> --id <model-id>
      [--part-ids a,b,c | --family "<maker>|<series>|<chip-id>,<chip-id>"]
      [--scale-to-data] [--license "..."] [--author "..."] [--source "..."]
      [--out public/models] [--dry-run]

Categories: ${MODEL_CATEGORIES.join(", ")}`;

/** Simplification target of the low-detail version. */
const LOD_RATIO = 0.5;
const LOD_ERROR = 0.01;

// ---------------------------------------------------------------- arguments

export type ImportArgs = {
  file: string;
  category: ModelCategory;
  id: string;
  appliesTo: ModelEntry["applies_to"];
  scaleToData: boolean;
  license?: string;
  author?: string;
  source?: string;
  out: string;
  dryRun: boolean;
};

/** Parses and validates the command line. Throws an Error with a plain-language message. */
export function parseImportArgs(argv: string[]): ImportArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const positional: string[] = [];
  const valueOptions = new Set([
    "category",
    "id",
    "part-ids",
    "family",
    "license",
    "author",
    "source",
    "out",
  ]);
  const flagOptions = new Set(["scale-to-data", "dry-run"]);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (flagOptions.has(name)) {
      flags.add(name);
    } else if (valueOptions.has(name)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Option --${name} needs a value.`);
      }
      values.set(name, value);
      i++;
    } else {
      throw new Error(`Unknown option --${name}.`);
    }
  }

  if (positional.length !== 1) throw new Error("Give exactly one .glb file to import.");
  const file = positional[0];
  if (!file.toLowerCase().endsWith(".glb")) throw new Error("The file must be a .glb file.");
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`File not found: ${file}`);
  }

  const category = values.get("category");
  if (!category || !(MODEL_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`--category must be one of: ${MODEL_CATEGORIES.join(", ")}.`);
  }

  const id = values.get("id");
  if (!id || !SlugSchema.safeParse(id).success) {
    throw new Error(
      "--id must be a lowercase slug such as rtx-5090-reference (letters, digits, hyphens).",
    );
  }

  const partIds = values.get("part-ids");
  const family = values.get("family");
  if ((partIds === undefined) === (family === undefined)) {
    throw new Error('Give exactly one of --part-ids or --family "<maker>|<series>|<chip-id>,...".');
  }
  let appliesTo: ModelEntry["applies_to"];
  if (partIds !== undefined) {
    const ids = partIds.split(",").map((s) => s.trim());
    const bad = ids.filter((s) => !SlugSchema.safeParse(s).success);
    if (bad.length > 0) throw new Error(`--part-ids has invalid part ids: ${bad.join(", ")}.`);
    appliesTo = { part_ids: ids };
  } else {
    if (category !== "gpu") throw new Error("--family can only be used with --category gpu.");
    const [maker, series, chips] = (family ?? "").split("|").map((s) => s.trim());
    const chipIds = (chips ?? "").split(",").map((s) => s.trim());
    if (
      !maker ||
      !series ||
      chipIds.length === 0 ||
      chipIds.some((c) => !SlugSchema.safeParse(c).success)
    ) {
      throw new Error(
        '--family must look like "ASUS|TUF|rtx-5090,rtx-5080" (maker|series|chip ids).',
      );
    }
    appliesTo = { family: { maker, series, chip_ids: chipIds } };
  }

  return {
    file,
    category: category as ModelCategory,
    id,
    appliesTo,
    scaleToData: flags.has("scale-to-data"),
    license: values.get("license"),
    author: values.get("author"),
    source: values.get("source"),
    out: values.get("out") ?? "public/models",
    dryRun: flags.has("dry-run"),
  };
}

// ---------------------------------------------------------------- validator

export type ValidatorIssue = { code: string; message: string; pointer?: string; severity: number };
export type ValidatorResult = { errors: ValidatorIssue[]; warnings: ValidatorIssue[] };

type GltfValidator = {
  validateBytes(
    data: Uint8Array,
    options?: Record<string, unknown>,
  ): Promise<{ issues: { messages: ValidatorIssue[] } }>;
};

/** Runs the official Khronos glTF validator on the file bytes. */
export async function runOfficialValidator(
  bytes: Uint8Array,
  name: string,
): Promise<ValidatorResult> {
  // gltf-validator ships no type declarations, so it is loaded through require.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const validator = require("gltf-validator") as GltfValidator;
  const report = await validator.validateBytes(bytes, { uri: name, maxIssues: 100 });
  const messages = report.issues.messages;
  return {
    errors: messages.filter((m) => m.severity === 0),
    warnings: messages.filter((m) => m.severity === 1),
  };
}

// ---------------------------------------------------------------- optimise

function createIO(): NodeIO {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
}

/** Names of nodes in `before` that are missing from `after`. */
export function lostNodes(before: string[], after: string[]): string[] {
  const remaining = new Set(after);
  return [...new Set(before)].filter((name) => !remaining.has(name));
}

function nodeNames(document: Document): string[] {
  return document
    .getRoot()
    .listNodes()
    .map((n) => n.getName());
}

/** dedup, prune (keeping empty nodes: they are the attachment points) and weld. */
export async function optimiseDocument(document: Document): Promise<void> {
  await document.transform(dedup(), prune({ keepLeaves: true }), weld());
}

/** A copy of an optimised document with about half the triangles. */
export async function makeLowDetail(optimised: Document): Promise<Document> {
  await MeshoptSimplifier.ready;
  const lod = cloneDocument(optimised);
  await lod.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio: LOD_RATIO, error: LOD_ERROR }),
  );
  return lod;
}

/** Meshopt-compresses the document in place (adds EXT_meshopt_compression). */
export async function compressDocument(document: Document): Promise<void> {
  await MeshoptEncoder.ready;
  document.createExtension(EXTMeshoptCompression).setRequired(true);
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));
}

// ---------------------------------------------------------------- storage

export type StoredFiles = { main: string; lod: string };

/**
 * Writes the two files to `<out>/<category>/<id>.glb` and `<id>.lod1.glb`. This is the one
 * place to replace when an object storage uploader exists.
 */
export function storeModelFiles(
  out: string,
  category: ModelCategory,
  id: string,
  files: { main: Uint8Array; lod: Uint8Array },
): StoredFiles {
  const dir = path.join(out, category);
  fs.mkdirSync(dir, { recursive: true });
  const main = path.join(dir, `${id}.glb`);
  const lod = path.join(dir, `${id}.lod1.glb`);
  fs.writeFileSync(main, files.main);
  fs.writeFileSync(lod, files.lod);
  return { main, lod };
}

// ---------------------------------------------------------------- manifest

/** The manifest entry to paste into data/models/manifest.json. Throws if it is not valid. */
export function buildManifestEntry(args: ImportArgs): ModelEntry {
  const entry: ModelEntry = {
    id: args.id,
    applies_to: args.appliesTo,
    category: args.category,
    file: `${args.category}/${args.id}.glb`,
    lod: [{ file: `${args.category}/${args.id}.lod1.glb` }],
    scale_to_data: args.scaleToData,
    ...(args.license ? { license: args.license } : {}),
    ...(args.author ? { author: args.author } : {}),
    ...(args.source ? { source: args.source } : {}),
    verified: false,
  };
  return ModelEntrySchema.parse(entry);
}

// ---------------------------------------------------------------- CLI

class ImportFailure extends Error {}

const ok = (text: string) => console.log(`✓ ${text}`);
const fail = (text: string) => {
  throw new ImportFailure(text);
};

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function mm(size: ModelReport["size"]): string {
  return size.map((n) => Math.round(n * 10) / 10).join(" x ") + " mm";
}

async function run(argv: string[]): Promise<void> {
  // 1. Arguments
  let args: ImportArgs;
  try {
    args = parseImportArgs(argv);
  } catch (error) {
    console.error(`✗ Arguments: ${(error as Error).message}\n\n${USAGE}`);
    throw new ImportFailure("");
  }
  ok(`Arguments: ${path.basename(args.file)} as ${args.category} "${args.id}"`);

  const bytes = new Uint8Array(fs.readFileSync(args.file));

  // 2. Official validator
  const validation = await runOfficialValidator(bytes, path.basename(args.file));
  for (const w of validation.warnings.slice(0, 10)) {
    console.log(`  warning: ${w.message}${w.pointer ? ` (${w.pointer})` : ""}`);
  }
  if (validation.errors.length > 0) {
    const lines = validation.errors
      .slice(0, 10)
      .map((e) => `  - ${e.message}${e.pointer ? ` (${e.pointer})` : ""}`);
    const more =
      validation.errors.length > 10 ? `\n  ... and ${validation.errors.length - 10} more` : "";
    fail(`glTF validator: the file is not a valid glTF.\n${lines.join("\n")}${more}`);
  }
  ok(`glTF validator: no errors (${validation.warnings.length} warnings)`);

  // 3. Standard checks
  const io = createIO();
  await MeshoptDecoder.ready;
  let document: Document;
  try {
    document = await io.readBinary(bytes);
  } catch (error) {
    return fail(`Reading the file failed: ${(error as Error).message}`);
  }
  const report = inspectModel(document, args.category);
  for (const c of report.checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.id}: ${c.message}`);
  const failed = report.checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    fail(
      `Model standard: ${failed.length} check${failed.length > 1 ? "s" : ""} failed (see above).`,
    );
  }
  ok("Model standard: all checks passed");

  // 4. Optimise and compress
  const namesBefore = nodeNames(document);
  await optimiseDocument(document);
  const lostMain = lostNodes(namesBefore, nodeNames(document));
  if (lostMain.length > 0) fail(`Optimising removed nodes: ${lostMain.join(", ")}.`);
  const trianglesAfter = inspectModel(document, args.category).triangles;

  // 5. Low detail (made from the optimised, uncompressed document)
  const lod = await makeLowDetail(document);
  const lostLod = lostNodes(namesBefore, nodeNames(lod));
  if (lostLod.length > 0) fail(`Low-detail version lost nodes: ${lostLod.join(", ")}.`);
  const trianglesLod = inspectModel(lod, args.category).triangles;

  await compressDocument(document);
  await compressDocument(lod);
  const main = await io.writeBinary(document);
  const lodBytes = await io.writeBinary(lod);
  ok(
    `Optimised with Meshopt: ${kb(bytes.length)} -> ${kb(main.length)}, low detail ${kb(lodBytes.length)}`,
  );

  // 6. Size budget
  if (main.length > MODEL_BUDGET.maxBytes) {
    const over = main.length - MODEL_BUDGET.maxBytes;
    fail(
      `Size budget: the compressed file is ${kb(main.length)}, ${kb(over)} over the limit of ${kb(MODEL_BUDGET.maxBytes)}. Reduce geometry or textures.`,
    );
  }
  ok(`Size budget: ${kb(main.length)} (limit ${kb(MODEL_BUDGET.maxBytes)})`);

  // 7. Store
  if (args.dryRun) {
    ok("Store: skipped (--dry-run), nothing written");
  } else {
    const stored = storeModelFiles(args.out, args.category, args.id, { main, lod: lodBytes });
    ok(`Store: wrote ${stored.main} and ${stored.lod}`);
  }

  // 8. Summary
  const entry = buildManifestEntry(args);
  console.log(`
Summary
  size       ${mm(report.size)}
  triangles  ${report.triangles} before, ${trianglesAfter} after, ${trianglesLod} low detail
  bytes      ${bytes.length} before, ${main.length} after, ${lodBytes.length} low detail

Manifest entry for data/models/manifest.json:
${JSON.stringify(entry, null, 2)}

Before setting "verified" to true: license, author and source are required, and the model
must be checked on the /dev/models page.`);
  if (!args.dryRun) {
    console.log("\nUpload skipped: no object storage configured yet. Files are in public/models/.");
  }
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    if (error instanceof ImportFailure) {
      if (error.message) console.error(`✗ ${error.message}`);
    } else {
      console.error(error);
    }
    console.error("\nImport stopped. Nothing was written.");
    process.exit(1);
  });
}
