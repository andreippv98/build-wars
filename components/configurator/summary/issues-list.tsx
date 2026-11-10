"use client";

import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { useConfigurator } from "@/components/configurator/configurator-provider";
import { BUILD_SLOTS } from "@/lib/schemas";
import { issueIds } from "./format";

const STYLE = {
  error: { label: "Error", Icon: OctagonAlert, cls: "text-red-400" },
  warning: { label: "Warning", Icon: AlertTriangle, cls: "text-amber-400" },
  info: { label: "Note", Icon: Info, cls: "text-muted-foreground" },
} as const;

export function IssuesList() {
  const { build, evaluation } = useConfigurator();
  const { issues } = evaluation;
  const ids = issueIds(issues);
  const chosen = BUILD_SLOTS.filter((slot) => build[slot]).length;

  return (
    <section aria-labelledby="summary-issues-heading" className="flex flex-col gap-2">
      <h2 id="summary-issues-heading" className="text-sm font-semibold">
        Problems
      </h2>
      {issues.length > 0 ? (
        <ul data-testid="issue-list" className="flex flex-col gap-2">
          {issues.map((issue, i) => {
            const { label, Icon, cls } = STYLE[issue.severity];
            return (
              <li
                key={ids[i]}
                id={ids[i]}
                data-testid={`issue-${issue.severity}`}
                data-rule={issue.rule}
                className="border-border flex scroll-mt-4 gap-2 rounded-lg border p-2.5"
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${cls}`} aria-hidden />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${cls}`}>{label}</p>
                  <p className="text-sm break-words">{issue.message}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : chosen >= 2 ? (
        <p data-testid="no-issues" className="text-muted-foreground text-sm">
          No problems found
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">Add parts to check that they work together</p>
      )}
    </section>
  );
}
