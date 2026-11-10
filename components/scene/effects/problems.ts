import type { Issue } from "@/lib/engine";
import { BUILD_SLOTS, type BuildSlot } from "@/lib/schemas";

export type ProblemSeverity = "error" | "warning";
export type Problem = { severity: ProblemSeverity; issueIndex: number };

/**
 * The worst problem of each slot named by an issue: an error beats a warning, info is ignored.
 * `issueIndex` is the first issue of that severity, which the click handler scrolls to.
 */
export function slotProblems(issues: readonly Issue[]): Partial<Record<BuildSlot, Problem>> {
  const result: Partial<Record<BuildSlot, Problem>> = {};
  issues.forEach((issue, issueIndex) => {
    if (issue.severity !== "error" && issue.severity !== "warning") return;
    for (const slot of issue.slots) {
      const current = result[slot];
      if (!current || (current.severity === "warning" && issue.severity === "error")) {
        result[slot] = { severity: issue.severity, issueIndex };
      }
    }
  });
  return result;
}

/** `"gpu:error psu:warning"`, in build-slot order. */
export function problemsAttribute(problems: Partial<Record<BuildSlot, Problem>>): string {
  return BUILD_SLOTS.flatMap((slot) => {
    const problem = problems[slot];
    return problem ? [`${slot}:${problem.severity}`] : [];
  }).join(" ");
}
