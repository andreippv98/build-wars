import { checkCompatibility, estimatePower, type Build, type Issue } from "@/lib/engine";
import type { BuildSlot } from "@/lib/schemas";
import type { SlotPart } from "./catalog-index";

/** The build with one slot replaced. */
export function withPart<S extends BuildSlot>(build: Build, slot: S, part: SlotPart[S]): Build {
  return { ...build, [slot]: part };
}

/**
 * Why a part can't go into this build: the errors that would exist with it in its slot and that
 * involve that slot. The picker greys such parts out and shows the first message.
 *
 * `display_output` is left out: it means "a graphics card is still missing", which is no reason
 * to grey out a CPU.
 */
export function candidateBlockers<S extends BuildSlot>(
  build: Build,
  slot: S,
  part: SlotPart[S],
): Issue[] {
  const candidate = withPart(build, slot, part);
  return checkCompatibility(candidate, estimatePower(candidate)).filter(
    (issue) =>
      issue.severity === "error" && issue.rule !== "display_output" && issue.slots.includes(slot),
  );
}
