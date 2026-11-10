"use client";

import { useEffect, useMemo, useState } from "react";
import type { Object3D } from "three";
import { partId, type SlotPart } from "@/lib/build";
import { loadGlb } from "@/lib/models/loader";
import { findModel, modelUrl } from "@/lib/models/lookup";
import { buildParametricModel } from "@/lib/models/parametric";
import { scaleToData } from "@/lib/models/scale";
import type { BuildSlot, ModelEntry } from "@/lib/schemas";

const MODELS_BASE_URL = process.env.NEXT_PUBLIC_MODELS_BASE_URL ?? "/models";

export type PartModel = {
  /** The model to draw. Starts as the parametric model; replaced when a real one has loaded. */
  object: Object3D;
  /** Which step of the lookup order produced `object`. */
  source: "exact" | "family" | "parametric";
  /** True while a real model is still downloading. */
  loading: boolean;
};

/**
 * The model loader as a hook: the plan's lookup order for one part.
 *   exact product model -> product family model (scaled to the part) -> parametric model.
 * The parametric model is shown immediately, the real one is fetched lazily and swapped in, and
 * a file that fails to load leaves the parametric model in place.
 * `part` null (an empty slot) gives null.
 */
export function usePartModel<S extends BuildSlot>(
  slot: S,
  part: SlotPart[S] | null,
  manifest: readonly ModelEntry[],
  options: { lowDetail?: boolean; includeUnverified?: boolean } = {},
): PartModel | null {
  const { lowDetail = false, includeUnverified = false } = options;
  const id = part ? partId(slot, part) : null;

  // `id` identifies the part; rebuilding only when it changes keeps the object stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parametric = useMemo(() => (part ? buildParametricModel(slot, part) : null), [slot, id]);

  const match = useMemo(
    () => (part ? findModel(manifest, slot, part, { includeUnverified }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manifest, slot, id, includeUnverified],
  );
  const url = useMemo(() => {
    if (!match) return null;
    const file = (lowDetail && match.entry.lod?.[0]?.file) || match.entry.file;
    return modelUrl(file, MODELS_BASE_URL);
  }, [match, lowDetail]);

  // Keyed by file AND part: two parts can share a family file but are scaled differently.
  const key = url ? `${url}|${id}` : null;
  const [loaded, setLoaded] = useState<{ key: string; object: Object3D } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !match || !part) return;
    let cancelled = false;
    loadGlb(url).then(
      (object) => {
        if (cancelled) return;
        if (match.entry.scale_to_data) scaleToData(object, slot, part);
        setLoaded({ key: `${url}|${id}`, object });
      },
      () => {
        if (!cancelled) setFailed(url);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, match, slot, id]);

  if (key && match && loaded?.key === key) {
    return { object: loaded.object, source: match.kind, loading: false };
  }
  if (!parametric) return null;
  return { object: parametric, source: "parametric", loading: Boolean(url) && failed !== url };
}
