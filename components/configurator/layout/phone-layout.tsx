"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SLOT_LABELS, partName, type SlotPart } from "@/lib/build";
import { BUILD_SLOTS, type BuildSlot } from "@/lib/schemas";
import { useConfigurator } from "../configurator-provider";
import { PartPicker } from "../part-picker";
import { ScenePlaceholder } from "../scene-placeholder";
import { CompactScore } from "../summary/compact-score";
import { SummaryPanel } from "../summary-panel";

function SheetHeaderBar({ title }: { title: string }) {
  return (
    <DrawerHeader className="flex-row items-center justify-between border-b pb-3 text-left">
      <DrawerTitle>{title}</DrawerTitle>
      <DrawerClose
        render={<Button variant="ghost" size="icon" aria-label={`Close ${title.toLowerCase()}`} />}
      >
        <XIcon />
      </DrawerClose>
    </DrawerHeader>
  );
}

/** Scene on top, five slot buttons, two bottom sheets and a sticky score bar. */
export function PhoneLayout() {
  const { activeSlot, setActiveSlot, selection, build, evaluation } = useConfigurator();
  const [summaryOpen, setSummaryOpen] = useState(false);

  // The parts sheet is open exactly while a category is active.
  const partsOpen = activeSlot !== null;

  // Something in the summary picked a category: swap the summary sheet for the parts sheet.
  if (activeSlot !== null && summaryOpen) setSummaryOpen(false);

  // A part was chosen: close the parts sheet.
  const selectionKey = JSON.stringify(selection);
  const lastKey = useRef(selectionKey);
  useEffect(() => {
    if (lastKey.current === selectionKey) return;
    lastKey.current = selectionKey;
    setActiveSlot(null);
  }, [selectionKey, setActiveSlot]);

  const problem = (slot: BuildSlot): "error" | "warning" | "none" => {
    const named = evaluation.issues.filter((i) => i.slots.includes(slot));
    if (named.some((i) => i.severity === "error")) return "error";
    return named.length > 0 ? "warning" : "none";
  };

  return (
    <div data-testid="configurator" data-layout="phone" className="flex flex-1 flex-col">
      <div className="h-[45dvh] shrink-0">
        <ScenePlaceholder onSlotClick={(slot) => setActiveSlot(slot)} />
      </div>

      <ul className="flex flex-col gap-2 p-3 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {BUILD_SLOTS.map((slot) => {
          const part = build[slot];
          const state = problem(slot);
          return (
            <li key={slot}>
              <button
                type="button"
                data-testid={`mobile-slot-${slot}`}
                onClick={() => setActiveSlot(slot)}
                className="bg-card hover:bg-muted focus-visible:ring-ring/50 flex min-h-[52px] w-full items-center gap-3 rounded-lg border px-4 py-2 text-left outline-none focus-visible:ring-3"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-muted-foreground text-xs">{SLOT_LABELS[slot].name}</span>
                  <span className={part ? "truncate text-sm font-medium" : "truncate text-sm"}>
                    {part ? partName(slot, part as SlotPart[typeof slot]) : SLOT_LABELS[slot].add}
                  </span>
                </span>
                {state !== "none" && (
                  <span
                    role="img"
                    aria-label={state === "error" ? "Has an error" : "Has a warning"}
                    className={
                      state === "error"
                        ? "size-2.5 shrink-0 rounded-full bg-red-500"
                        : "size-2.5 shrink-0 rounded-full bg-amber-400"
                    }
                  />
                )}
                <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur">
        <button
          type="button"
          data-testid="mobile-summary-bar"
          onClick={() => setSummaryOpen(true)}
          className="focus-visible:ring-ring/50 flex min-h-14 w-full items-center gap-3 px-4 pb-[env(safe-area-inset-bottom)] text-left outline-none focus-visible:ring-3"
        >
          <span className="min-w-0 flex-1">
            <CompactScore />
          </span>
          <ChevronUpIcon className="text-muted-foreground size-5 shrink-0" />
          <span className="sr-only">Open your build summary</span>
        </button>
      </div>

      <Drawer open={partsOpen} onOpenChange={(open) => !open && setActiveSlot(null)}>
        <DrawerContent data-testid="parts-sheet" className="h-[85dvh] max-h-[calc(100dvh-1rem)]">
          <SheetHeaderBar title="Choose parts" />
          <div className="flex min-h-0 flex-1 flex-col">
            <PartPicker />
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DrawerContent data-testid="summary-sheet" className="h-[90dvh] max-h-[calc(100dvh-1rem)]">
          <SheetHeaderBar title="Your build" />
          <div className="flex min-h-0 flex-1 flex-col">
            <SummaryPanel />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
