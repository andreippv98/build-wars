"use client";

import { useIsDesktop } from "./layout/use-is-desktop";
import { PhoneLayout } from "./layout/phone-layout";
import { PartPicker } from "./part-picker";
import { ScenePlaceholder } from "./scene-placeholder";
import { SummaryPanel } from "./summary-panel";

/** Three columns on desktop; scene + slot list + bottom sheets + sticky score bar on phones. */
export function ConfiguratorLayout() {
  const isDesktop = useIsDesktop();
  if (isDesktop === null) return <div className="flex-1" aria-busy="true" />;
  if (!isDesktop) return <PhoneLayout />;

  return (
    <div
      data-testid="configurator"
      data-layout="desktop"
      className="grid h-[calc(100dvh-3rem)] grid-cols-[minmax(260px,15%)_minmax(0,1fr)_minmax(300px,15%)]"
    >
      <aside className="bg-card/60 flex min-h-0 flex-col border-r">
        <PartPicker />
      </aside>
      <main className="flex min-h-0 min-w-0 flex-col">
        <ScenePlaceholder />
      </main>
      <aside className="bg-card/60 flex min-h-0 flex-col border-l">
        <SummaryPanel />
      </aside>
    </div>
  );
}
