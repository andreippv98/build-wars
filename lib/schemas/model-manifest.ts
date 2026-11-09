import { z } from "zod";
import { SlugSchema } from "./parts";

/** 3D model manifest (`data/models/manifest.json`). See "3D model loading system" in the plan. */

export const MODEL_CATEGORIES = [
  "gpu",
  "cpu_cooler",
  "motherboard",
  "ram",
  "psu",
  "case",
  "fan",
] as const;
export const ModelCategorySchema = z.enum(MODEL_CATEGORIES);
export type ModelCategory = z.infer<typeof ModelCategorySchema>;

/** Exact product match: lookup step 1. */
export const ModelAppliesToPartsSchema = z.strictObject({
  part_ids: z.array(SlugSchema).min(1),
});

/** Product family match (GPU boards): lookup step 2. Matches board `maker` + `series` + `chip_id`. */
export const ModelAppliesToFamilySchema = z.strictObject({
  family: z.strictObject({
    maker: z.string().min(1),
    series: z.string().min(1),
    chip_ids: z.array(SlugSchema).min(1),
  }),
});

export const ModelEntrySchema = z
  .strictObject({
    id: SlugSchema,
    applies_to: z.union([ModelAppliesToPartsSchema, ModelAppliesToFamilySchema]),
    category: ModelCategorySchema,
    /** Path or URL of the `.glb` file. */
    file: z.string().min(1),
    /** Lower-detail versions for phones, most detailed first. */
    lod: z.array(z.strictObject({ file: z.string().min(1) })).optional(),
    /** Stretch the model to the part's real dimensions. */
    scale_to_data: z.boolean(),
    license: z.string().min(1).optional(),
    author: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    /** Checked on `/dev/models` and approved. Only verified models are used on the public site. */
    verified: z.boolean(),
  })
  .refine((m) => !m.verified || (m.license && m.author && m.source), {
    message: "license, author and source are required before a model can be verified",
  });
export type ModelEntry = z.infer<typeof ModelEntrySchema>;

export const ModelManifestSchema = z.array(ModelEntrySchema);
export type ModelManifest = z.infer<typeof ModelManifestSchema>;
