"use client";

import { PartPicker } from "./part-picker";
import { ScenePlaceholder } from "./scene-placeholder";
import { SummaryPanel } from "./summary-panel";

/** Three areas on desktop; scene + bottom sheet + sticky score bar on phones. (Stub.) */
export function ConfiguratorLayout() {
  return (
    <div className="flex flex-1">
      <PartPicker />
      <ScenePlaceholder />
      <SummaryPanel />
    </div>
  );
}
