"use client";

import { useEffect, useState } from "react";
import type { Object3D } from "three";
import { loadGlb } from "@/lib/models/loader";

export type GlbState = {
  status: "none" | "loading" | "loaded" | "failed";
  object: Object3D | null;
  error: string | null;
};

/** Loads a `.glb` by URL for the test page; `null` means no model. */
export function useGlb(url: string | null): GlbState {
  const [result, setResult] = useState<{
    url: string;
    object: Object3D | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    loadGlb(url).then(
      (object) => {
        if (!cancelled) setResult({ url, object, error: null });
      },
      (error: unknown) => {
        if (!cancelled)
          setResult({
            url,
            object: null,
            error: error instanceof Error ? error.message : String(error),
          });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return { status: "none", object: null, error: null };
  if (result?.url !== url) return { status: "loading", object: null, error: null };
  if (result.error !== null) return { status: "failed", object: null, error: result.error };
  return { status: "loaded", object: result.object, error: null };
}
