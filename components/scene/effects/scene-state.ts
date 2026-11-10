"use client";

import { useMemo } from "react";
import { partId, type SlotPart } from "@/lib/build";
import type { Build } from "@/lib/engine";
import { BUILD_SLOTS, type BuildSlot } from "@/lib/schemas";
import { useConfigurator } from "../../configurator/configurator-provider";
import { slotProblems, type Problem } from "./problems";

/** The id of the part in a slot, or null when it is empty. */
export function slotPartId(build: Build, slot: BuildSlot): string | null {
  const part = build[slot];
  return part ? partId(slot, part as SlotPart[BuildSlot] as never) : null;
}

/** What the scene shows besides the parts themselves, derived from the configurator state. */
export function useSceneState(): {
  activeSlot: BuildSlot | null;
  ghost: { slot: BuildSlot; id: string } | null;
  problems: Partial<Record<BuildSlot, Problem>>;
  empty: BuildSlot[];
} {
  const { build, evaluation, activeSlot, preview } = useConfigurator();
  const problems = useMemo(() => slotProblems(evaluation.issues), [evaluation.issues]);
  const ghost = useMemo(
    () => (preview && slotPartId(build, preview.slot) !== preview.id ? preview : null),
    [build, preview],
  );
  const empty = useMemo(() => BUILD_SLOTS.filter((slot) => !build[slot]), [build]);
  return { activeSlot, ghost, problems, empty };
}
