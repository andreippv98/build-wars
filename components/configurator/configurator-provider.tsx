"use client";

import { useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  candidateBlockers,
  indexCatalog,
  parseSelection,
  resolveBuild,
  selectionToQuery,
  type BuildSelection,
  type CatalogIndex,
  type ClientCatalog,
  type SlotPart,
} from "@/lib/build";
import { evaluateBuild, type Build, type BuildEvaluation, type Issue } from "@/lib/engine";
import type { BuildSlot } from "@/lib/schemas";

/** Everything the configurator's panels and scene share. Read it with `useConfigurator()`. */
export type ConfiguratorState = {
  /** Lookup tables over the catalog; `index.parts[slot]` lists what can be picked. */
  index: CatalogIndex;
  /** Chosen part ids. Mirrors the URL. */
  selection: BuildSelection;
  /** The chosen parts as records. */
  build: Build;
  /** Issues, power and score for `build`, recomputed on every change. */
  evaluation: BuildEvaluation;
  /** Put a part in a slot (replacing what was there). `id` is `partId(slot, part)`. */
  select: (slot: BuildSlot, id: string) => void;
  /** Empty a slot. */
  remove: (slot: BuildSlot) => void;
  /** Empty every slot. */
  clear: () => void;
  /** The category open in the picker; the scene focuses on it. Null = none. */
  activeSlot: BuildSlot | null;
  setActiveSlot: (slot: BuildSlot | null) => void;
  /** The part hovered in the picker, shown as a ghost in the scene. Null = none. */
  preview: { slot: BuildSlot; id: string } | null;
  setPreview: (preview: { slot: BuildSlot; id: string } | null) => void;
  /** Errors that would block this part from the current build; empty = it can be picked. */
  blockersFor: <S extends BuildSlot>(slot: S, part: SlotPart[S]) => Issue[];
  /** Path and query that reproduce this build, e.g. `/build?cpu=...`. */
  sharePath: string;
};

const ConfiguratorContext = createContext<ConfiguratorState | null>(null);

export function useConfigurator(): ConfiguratorState {
  const state = useContext(ConfiguratorContext);
  if (!state) throw new Error("useConfigurator must be used inside <ConfiguratorProvider>");
  return state;
}

export function ConfiguratorProvider({
  catalog,
  children,
}: {
  catalog: ClientCatalog;
  children: ReactNode;
}) {
  const index = useMemo(() => indexCatalog(catalog), [catalog]);

  // The URL is the single source of truth for the selection, so refresh, back and shared links
  // all work. `history.replaceState` keeps `useSearchParams` in sync without a navigation.
  const searchParams = useSearchParams();
  const selection = useMemo(() => parseSelection(searchParams), [searchParams]);
  const { build } = useMemo(() => resolveBuild(selection, index), [selection, index]);
  const evaluation = useMemo(() => evaluateBuild(build), [build]);

  const write = useCallback(
    (next: BuildSelection) => {
      // Keep parameters that are not slots (e.g. a future ?challenge=).
      const params = new URLSearchParams(searchParams.toString());
      for (const key of new URLSearchParams(selectionToQuery(selection)).keys()) {
        params.delete(key);
      }
      for (const [key, value] of new URLSearchParams(selectionToQuery(next))) {
        params.set(key, value);
      }
      const query = params.toString();
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    },
    [searchParams, selection],
  );

  const select = useCallback(
    (slot: BuildSlot, id: string) => write({ ...selection, [slot]: id }),
    [selection, write],
  );
  const remove = useCallback(
    (slot: BuildSlot) => {
      const next = { ...selection };
      delete next[slot];
      write(next);
    },
    [selection, write],
  );
  const clear = useCallback(() => write({}), [write]);

  const [activeSlot, setActiveSlot] = useState<BuildSlot | null>(null);
  const [preview, setPreview] = useState<ConfiguratorState["preview"]>(null);

  const blockersFor = useCallback<ConfiguratorState["blockersFor"]>(
    (slot, part) => candidateBlockers(build, slot, part),
    [build],
  );

  const state = useMemo<ConfiguratorState>(() => {
    const query = selectionToQuery(selection);
    return {
      index,
      selection,
      build,
      evaluation,
      select,
      remove,
      clear,
      activeSlot,
      setActiveSlot,
      preview,
      setPreview,
      blockersFor,
      sharePath: query ? `/build?${query}` : "/build",
    };
  }, [
    index,
    selection,
    build,
    evaluation,
    select,
    remove,
    clear,
    activeSlot,
    preview,
    blockersFor,
  ]);

  return <ConfiguratorContext.Provider value={state}>{children}</ConfiguratorContext.Provider>;
}
