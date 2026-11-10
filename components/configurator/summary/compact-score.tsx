"use client";

import { useConfigurator } from "@/components/configurator/configurator-provider";
import { plural } from "./format";

/** One-line score for the phone's sticky bar: the number, the band, an error / warning count. */
export function CompactScore() {
  const { evaluation } = useConfigurator();
  const { score, hasErrors, issues } = evaluation;
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  return (
    <div data-testid="compact-score" className="flex min-w-0 flex-1 items-center gap-3">
      {score.displayScore === null ? (
        <span className="text-muted-foreground text-sm">Add parts to see your score</span>
      ) : (
        <>
          <span
            className={`text-3xl leading-none font-semibold tabular-nums ${
              hasErrors ? "text-muted-foreground/60" : ""
            }`}
          >
            {score.displayScore}
          </span>
          <span className="truncate text-sm font-medium">
            {hasErrors ? "Not final" : score.band?.label}
          </span>
        </>
      )}
      <span className="ml-auto shrink-0 text-sm font-medium">
        {errors > 0 ? (
          <span className="text-red-400">{plural(errors, "error", "errors")}</span>
        ) : warnings > 0 ? (
          <span className="text-amber-400">{plural(warnings, "warning", "warnings")}</span>
        ) : null}
      </span>
    </div>
  );
}
