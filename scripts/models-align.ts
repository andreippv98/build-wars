/**
 * Brings a foreign .glb into the model standard's frame without touching its geometry:
 * everything in the scene is put under one new node that rotates, scales and moves it, and the
 * attachment nodes asked for are added at the scene root.
 *
 *   pnpm models:align <in.glb> <out.glb> --rotate <x>,<y>,<z> --length-mm <mm>
 *        --anchor <x>,<y>,<z> [--add-node <name>[@x,y,z]]...
 *
 *   --rotate      degrees about X, then Y, then Z (applied in that order), so the model ends up
 *                 in the standard's axes: +X toward the case front, +Y up, +Z toward the viewer
 *   --length-mm   the size the model must have along X after rotation; sets the uniform scale
 *   --anchor      which point of the rotated, scaled bounding box becomes the origin, per axis:
 *                 min | max | center, optionally with an offset in mm, e.g. "min+12,max,min-8"
 *   --add-node    an empty attachment node at the origin, or at the given position in mm
 *
 * Then run `pnpm models:import` on the output. See docs/model-standard.md.
 */
import { NodeIO, type vec3 } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { alignDocument, parseAnchor, type AlignOptions } from "@/lib/models/align";

async function main(argv: string[]): Promise<number> {
  const [input, output, ...rest] = argv;
  if (!input || !output) {
    console.error(
      "Usage: pnpm models:align <in.glb> <out.glb> --rotate x,y,z --length-mm mm --anchor x,y,z [--add-node name[@x,y,z]]",
    );
    return 1;
  }
  const options: AlignOptions = {
    rotateDeg: [0, 0, 0],
    lengthMm: 0,
    anchor: [parseAnchor("min"), parseAnchor("max"), parseAnchor("min")],
    addNodes: [],
  };
  const numbers = (text: string): vec3 => {
    const parts = text.split(",").map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
      throw new Error(`Expected three numbers, got "${text}".`);
    }
    return parts as vec3;
  };
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i];
    const value = rest[i + 1];
    if (value === undefined) throw new Error(`${flag} needs a value.`);
    if (flag === "--rotate") options.rotateDeg = numbers(value);
    else if (flag === "--length-mm") options.lengthMm = Number(value);
    else if (flag === "--anchor") {
      const parts = value.split(",");
      if (parts.length !== 3) throw new Error(`--anchor needs three values, got "${value}".`);
      options.anchor = parts.map(parseAnchor) as AlignOptions["anchor"];
    } else if (flag === "--add-node") {
      const [name, at] = value.split("@");
      options.addNodes.push({ name, position: at ? numbers(at) : [0, 0, 0] });
    } else throw new Error(`Unknown option ${flag}.`);
  }
  if (!(options.lengthMm > 0)) throw new Error("--length-mm is required and must be positive.");

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  const { sizeMm } = alignDocument(document, options);
  await io.write(output, document);
  console.log(
    `Wrote ${output}: ${sizeMm.map((n) => n.toFixed(1)).join(" x ")} mm (X x Y x Z), ` +
      `nodes added: ${options.addNodes.map((n) => n.name).join(", ") || "none"}`,
  );
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
