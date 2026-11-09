import { z } from "zod";
import { ModelEntrySchema } from "./model-manifest";
import {
  ChipsetSchema,
  CpuSchema,
  GpuBoardSchema,
  GpuChipSchema,
  MotherboardSchema,
  PsuSchema,
  RamKitSchema,
} from "./parts";

/**
 * The whole catalog in memory. Keys match the database table names.
 *
 * On disk (`data/`):
 *   cpus.json, chipsets.json, motherboards.json, ram-kits.json, psus.json  -> JSON arrays
 *   gpus/*.json            -> one `GpuFile` ({ chips, boards }) per chip series
 *   models/manifest.json   -> JSON array of model entries
 */
export const CatalogSchema = z.strictObject({
  cpus: z.array(CpuSchema),
  gpu_chips: z.array(GpuChipSchema),
  gpu_boards: z.array(GpuBoardSchema),
  chipsets: z.array(ChipsetSchema),
  motherboards: z.array(MotherboardSchema),
  ram_kits: z.array(RamKitSchema),
  psus: z.array(PsuSchema),
  models: z.array(ModelEntrySchema),
});
export type Catalog = z.infer<typeof CatalogSchema>;

/** A problem found by validation. `file` is relative to the data directory when known. */
export type CatalogIssue = {
  file?: string;
  /** e.g. `motherboards[3].chipset_id` */
  path: string;
  message: string;
};
