"use client";

import { Badge } from "@/components/ui/badge";
import { useConfigurator } from "@/components/configurator/configurator-provider";
import { missingMessage } from "./format";

export function ScoreBlock() {
  const { evaluation } = useConfigurator();
  const { score, hasErrors } = evaluation;

  return (
    <section aria-labelledby="summary-score-heading" className="flex flex-col gap-1">
      <h2 id="summary-score-heading" className="text-sm font-semibold">
        Build Score
      </h2>
      {score.displayScore === null ? (
        <p data-testid="score-missing" className="text-muted-foreground py-2 text-sm">
          {missingMessage(score.missing)}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              data-testid="build-score"
              className={`text-6xl leading-none font-semibold tabular-nums sm:text-7xl ${
                hasErrors ? "text-muted-foreground/60 line-through decoration-1" : ""
              }`}
            >
              {score.displayScore}
            </span>
            {score.isEstimate && (
              <Badge variant="outline" data-testid="score-estimate">
                Estimate
              </Badge>
            )}
          </div>
          {hasErrors ? (
            <p data-testid="score-not-final" className="text-sm font-medium text-red-400">
              Not final: fix the errors below
            </p>
          ) : (
            score.band && (
              <div className="flex flex-col gap-0.5">
                <p data-testid="score-band" className="text-base font-semibold">
                  {score.band.label}
                </p>
                <p className="text-muted-foreground text-sm">{score.band.meaning}</p>
              </div>
            )
          )}
          {score.isEstimate && (
            <p className="text-muted-foreground text-xs">
              Based on placeholder performance data, not review averages yet
            </p>
          )}
        </>
      )}
    </section>
  );
}
