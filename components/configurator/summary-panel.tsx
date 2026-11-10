"use client";

import { Separator } from "@/components/ui/separator";
import { IssuesList } from "./summary/issues-list";
import { PartsList } from "./summary/parts-list";
import { PowerBlock } from "./summary/power-block";
import { ScoreBlock } from "./summary/score-block";
import { ShareBlock } from "./summary/share-block";

/** Right panel: selected parts, Build Score, power, issues, save / share. */
export function SummaryPanel() {
  return (
    <div
      data-testid="summary-panel"
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4"
    >
      <PartsList />
      <Separator />
      <ScoreBlock />
      <PowerBlock />
      <IssuesList />
      <Separator />
      <ShareBlock />
    </div>
  );
}
