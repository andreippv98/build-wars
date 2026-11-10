import cpus from "@/data/cpus.json";
import rtx30 from "@/data/gpus/rtx-30.json";
import rtx40 from "@/data/gpus/rtx-40.json";
import rtx50 from "@/data/gpus/rtx-50.json";
import rx6000 from "@/data/gpus/rx-6000.json";
import rx7000 from "@/data/gpus/rx-7000.json";
import motherboards from "@/data/motherboards.json";
import psus from "@/data/psus.json";
import { partPath } from "./routes";

/**
 * Every part page that exists, from the catalog files imported statically (no file system, so
 * this also runs in `proxy.ts`). `proxy.ts` answers 404 for any other part URL: under Cache
 * Components a `notFound()` inside the page comes after the response has started and would be
 * sent with status 200, which search engines treat as a soft 404.
 *
 * A new file under `data/gpus/` must be added to GPU_FILES; a test compares this list with the
 * catalog on disk and fails until it is.
 */
const GPU_FILES = [rtx30, rtx40, rtx50, rx6000, rx7000];

let cached: Set<string> | undefined;

export function knownPartPaths(): Set<string> {
  if (cached) return cached;
  const paths = new Set<string>();
  for (const cpu of cpus) paths.add(partPath.cpu(cpu));
  for (const board of motherboards) paths.add(partPath.motherboard(board));
  for (const psu of psus) paths.add(partPath.psu(psu));
  for (const file of GPU_FILES) {
    const chips = new Map(file.chips.map((chip) => [chip.id, chip]));
    for (const chip of file.chips) paths.add(partPath.gpuChip(chip));
    for (const board of file.boards) {
      const chip = chips.get(board.chip_id);
      if (chip) paths.add(partPath.gpuBoard(chip, board));
    }
  }
  cached = paths;
  return paths;
}
