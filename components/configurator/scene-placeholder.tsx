"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { SLOT_LABELS, partName, type SlotPart } from "@/lib/build";
import { BUILD_SLOTS, type BuildSlot } from "@/lib/schemas";
import { useConfigurator } from "./configurator-provider";

// --- Layout table (SVG units; the picture is 800 x 600) -----------------------------------------

type Rect = { x: number; y: number; w: number; h: number };

const VIEW = { w: 800, h: 600 };
const CASE: Rect = { x: 30, y: 30, w: 740, h: 540 };
const PSU_BAY: Rect = { x: 50, y: 450, w: 700, h: 100 };

/** The area each slot occupies when empty (and where its outline sits). */
const SLOT_AREA: Record<BuildSlot, Rect> = {
  motherboard: { x: 70, y: 55, w: 500, h: 380 },
  cpu: { x: 110, y: 85, w: 130, h: 130 },
  ram: { x: 340, y: 85, w: 150, h: 170 },
  gpu: { x: 100, y: 275, w: 600, h: 90 },
  psu: { x: 70, y: 465, w: 330, h: 70 },
};

/** Motherboard footprint by form factor. */
const BOARD_SIZE: Record<string, { w: number; h: number }> = {
  "E-ATX": { w: 520, h: 400 },
  ATX: { w: 500, h: 380 },
  mATX: { w: 500, h: 300 },
  ITX: { w: 400, h: 300 },
};

const COOLER: Rect = { x: 125, y: 100, w: 100, h: 100 };
const RAM_STICK = { w: 16, gap: 8, h: 150, offsetX: 12, offsetY: 10 };
const RAM_DEFAULT_POSITIONS = 4;
const GPU_SCALE = { maxLengthMm: 380, minW: 220, maxW: 600, slotHeight: 30, minH: 40 };
const FAN_MAX = 3;
const NAME_CHAR_PX = 7.2;

const COLOR = {
  stroke: "#52525b",
  fill: "#27272a",
  fillHi: "#3f3f46",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  active: "#38bdf8",
  error: "#ef4444",
  warning: "#f59e0b",
};

type Problem = "error" | "warning" | "none";

function truncate(text: string, widthPx: number): string {
  const max = Math.max(4, Math.floor(widthPx / NAME_CHAR_PX));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

type Drawn = { rect: Rect; label: string; nodes: ReactNode };

/** Draws the part for a slot from its data alone. Returns the shape's rectangle and its nodes. */
function drawPart<S extends BuildSlot>(
  slot: S,
  part: SlotPart[S],
  ctx: { boardSlots: number | null },
): Drawn {
  const area = SLOT_AREA[slot];
  const label = partName(slot, part);
  switch (slot) {
    case "motherboard": {
      const board = part as SlotPart["motherboard"];
      const size = BOARD_SIZE[board.form_factor] ?? BOARD_SIZE.ATX;
      const rect = { x: area.x, y: area.y, w: size.w, h: size.h };
      return {
        rect,
        label,
        nodes: (
          <>
            <rect {...rect} rx={10} fill={COLOR.fill} stroke={COLOR.stroke} strokeWidth={2} />
            <text
              x={rect.x + rect.w / 2}
              y={rect.y + rect.h - 18}
              textAnchor="middle"
              fontSize={13}
              fill={COLOR.muted}
            >
              {truncate(`${label} (${board.form_factor})`, rect.w - 40)}
            </text>
          </>
        ),
      };
    }
    case "cpu": {
      const rect = { ...area };
      return {
        rect,
        label,
        nodes: (
          <>
            <rect {...rect} rx={8} fill={COLOR.fillHi} stroke={COLOR.stroke} strokeWidth={2} />
            <rect
              {...COOLER}
              rx={8}
              fill="#52525b"
              stroke="#71717a"
              strokeWidth={1.5}
              opacity={0.9}
            />
            <circle
              cx={COOLER.x + COOLER.w / 2}
              cy={COOLER.y + COOLER.h / 2}
              r={26}
              fill="none"
              stroke="#a1a1aa"
              strokeWidth={2}
            />
            <text
              x={rect.x + rect.w / 2}
              y={rect.y + rect.h + 16}
              textAnchor="middle"
              fontSize={12}
              fill={COLOR.text}
            >
              {truncate(label, rect.w + 40)}
            </text>
          </>
        ),
      };
    }
    case "ram": {
      const kit = part as SlotPart["ram"];
      const positions = ctx.boardSlots ?? RAM_DEFAULT_POSITIONS;
      const pitch = RAM_STICK.w + RAM_STICK.gap;
      const rect = { ...area, w: Math.max(positions * pitch + RAM_STICK.offsetX * 2, 60) };
      const filled = Math.min(kit.sticks, positions);
      const sticks = Array.from({ length: positions }, (_, i) => {
        const x = rect.x + RAM_STICK.offsetX + i * pitch;
        const on = i < filled;
        return (
          <rect
            key={i}
            x={x}
            y={rect.y + RAM_STICK.offsetY}
            width={RAM_STICK.w}
            height={RAM_STICK.h}
            rx={3}
            fill={on ? "#6366f1" : "none"}
            stroke={on ? "#a5b4fc" : COLOR.stroke}
            strokeDasharray={on ? undefined : "3 3"}
            strokeWidth={1.5}
          />
        );
      });
      return {
        rect,
        label,
        nodes: (
          <>
            <rect {...rect} rx={8} fill={COLOR.fill} stroke={COLOR.stroke} strokeWidth={2} />
            {sticks}
            <text
              x={rect.x + rect.w / 2}
              y={rect.y + rect.h - 6}
              textAnchor="middle"
              fontSize={11}
              fill={COLOR.text}
            >
              {truncate(label, rect.w + 60)}
            </text>
          </>
        ),
      };
    }
    case "gpu": {
      const { board } = part as SlotPart["gpu"];
      const ratio = Math.min(1, board.length_mm / GPU_SCALE.maxLengthMm);
      const w = Math.min(
        GPU_SCALE.maxW,
        Math.max(GPU_SCALE.minW, Math.round(ratio * GPU_SCALE.maxW)),
      );
      const h = Math.min(area.h, Math.max(GPU_SCALE.minH, board.slots * GPU_SCALE.slotHeight));
      const rect = { x: area.x, y: area.y + (area.h - h) / 2, w, h };
      const fans = Math.min(FAN_MAX, Math.max(0, board.fan_count));
      const fanR = Math.max(8, h / 2 - 8);
      const fanNodes = Array.from({ length: fans }, (_, i) => {
        const step = rect.w / (fans + 0.5);
        const cx = rect.x + step * (i + 0.75);
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={rect.y + h / 2}
              r={fanR}
              fill="#18181b"
              stroke="#71717a"
              strokeWidth={1.5}
            />
            <circle cx={cx} cy={rect.y + h / 2} r={fanR / 4} fill="#71717a" />
          </g>
        );
      });
      return {
        rect,
        label,
        nodes: (
          <>
            <rect {...rect} rx={8} fill={COLOR.fillHi} stroke={COLOR.stroke} strokeWidth={2} />
            {fanNodes}
            <text
              x={rect.x + rect.w / 2}
              y={rect.y + h + 16}
              textAnchor="middle"
              fontSize={12}
              fill={COLOR.text}
            >
              {truncate(label, rect.w)}
            </text>
          </>
        ),
      };
    }
    case "psu": {
      const psu = part as SlotPart["psu"];
      const rect = { ...area };
      return {
        rect,
        label,
        nodes: (
          <>
            <rect {...rect} rx={8} fill={COLOR.fillHi} stroke={COLOR.stroke} strokeWidth={2} />
            <circle
              cx={rect.x + rect.w - 40}
              cy={rect.y + rect.h / 2}
              r={24}
              fill="#18181b"
              stroke="#71717a"
              strokeWidth={1.5}
            />
            <text x={rect.x + 14} y={rect.y + 28} fontSize={20} fontWeight={600} fill={COLOR.text}>
              {psu.watts} W
            </text>
            <text x={rect.x + 14} y={rect.y + 52} fontSize={12} fill={COLOR.muted}>
              {truncate(label, rect.w - 90)}
            </text>
          </>
        ),
      };
    }
    default:
      return { rect: area, label, nodes: null };
  }
}

function problemColor(problem: Problem): string | null {
  return problem === "error" ? COLOR.error : problem === "warning" ? COLOR.warning : null;
}

export function ScenePlaceholder({ onSlotClick }: { onSlotClick?: (slot: BuildSlot) => void }) {
  const { build, evaluation, activeSlot, setActiveSlot, preview, index } = useConfigurator();

  const problems: Record<BuildSlot, Problem> = {
    cpu: "none",
    gpu: "none",
    ram: "none",
    motherboard: "none",
    psu: "none",
  };
  for (const issue of evaluation.issues) {
    for (const slot of issue.slots) {
      if (issue.severity === "error") problems[slot] = "error";
      else if (problems[slot] === "none") problems[slot] = "warning";
    }
  }

  const activate = (slot: BuildSlot) => (onSlotClick ?? setActiveSlot)(slot);
  const boardSlots = build.motherboard?.ram_slots ?? null;

  const ghost = preview
    ? (index.byId[preview.slot].get(preview.id) as SlotPart[BuildSlot] | undefined)
    : undefined;

  return (
    <div
      data-testid="scene"
      className="relative flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-[#09090b]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 60% 55% at 50% 45%, rgba(148,163,184,0.22), rgba(9,9,11,0) 70%)",
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className="h-full w-full p-2 sm:p-6"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Side view of your PC case"
      >
        <rect
          {...CASE}
          rx={18}
          fill="#111113"
          stroke="#3f3f46"
          strokeWidth={3}
          className="pointer-events-none"
        />
        <rect
          {...PSU_BAY}
          rx={10}
          fill="#0c0c0e"
          stroke="#27272a"
          strokeWidth={2}
          className="pointer-events-none"
        />

        {BUILD_SLOTS.map((slot) => {
          const part = build[slot] as SlotPart[BuildSlot] | undefined;
          const drawn = part ? drawPart(slot, part, { boardSlots }) : null;
          const ghostDrawn =
            ghost && preview?.slot === slot ? drawPart(slot, ghost, { boardSlots }) : null;
          const area = SLOT_AREA[slot];
          const rect = drawn?.rect ?? area;
          const problem = problems[slot];
          const color = problemColor(problem);
          const active = activeSlot === slot;
          const state = part ? "filled" : "empty";
          const name = drawn?.label ?? SLOT_LABELS[slot].add;

          const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              activate(slot);
            }
          };

          return (
            <g
              key={slot}
              role="button"
              tabIndex={0}
              aria-label={part ? `${SLOT_LABELS[slot].name}: ${name}` : SLOT_LABELS[slot].add}
              aria-pressed={active}
              data-testid={`scene-slot-${slot}`}
              data-state={state}
              data-problem={problem}
              onClick={() => activate(slot)}
              onKeyDown={onKeyDown}
              className="group cursor-pointer outline-none"
            >
              <title>{name}</title>
              {/* Hit area. */}
              <rect {...area} fill="transparent" />
              {drawn ? (
                drawn.nodes
              ) : (
                <g className="group-hover:opacity-80 motion-safe:transition-opacity">
                  <rect
                    {...area}
                    rx={10}
                    fill="none"
                    stroke={COLOR.stroke}
                    strokeWidth={2}
                    strokeDasharray="8 6"
                  />
                  <text
                    x={area.x + area.w / 2}
                    y={area.y + area.h / 2 + 4}
                    textAnchor="middle"
                    fontSize={34}
                    fill={COLOR.muted}
                  >
                    +
                  </text>
                  <text
                    x={area.x + area.w / 2}
                    y={area.y + area.h / 2 + 28}
                    textAnchor="middle"
                    fontSize={13}
                    fill={COLOR.muted}
                  >
                    {SLOT_LABELS[slot].short}
                  </text>
                </g>
              )}

              {ghostDrawn && (
                <g opacity={0.45} className="pointer-events-none" data-ghost="true">
                  {ghostDrawn.nodes}
                  <text
                    x={ghostDrawn.rect.x + ghostDrawn.rect.w / 2}
                    y={ghostDrawn.rect.y - 6}
                    textAnchor="middle"
                    fontSize={12}
                    fill={COLOR.active}
                  >
                    {truncate(ghostDrawn.label, ghostDrawn.rect.w + 80)}
                  </text>
                </g>
              )}

              {/* Outlines: keyboard focus, active slot, problem glow. */}
              <rect
                x={rect.x - 4}
                y={rect.y - 4}
                width={rect.w + 8}
                height={rect.h + 8}
                rx={12}
                fill="none"
                stroke={COLOR.active}
                strokeWidth={3}
                className="pointer-events-none opacity-0 group-focus-visible:opacity-100"
              />
              {active && (
                <rect
                  x={rect.x - 4}
                  y={rect.y - 4}
                  width={rect.w + 8}
                  height={rect.h + 8}
                  rx={12}
                  fill="none"
                  stroke={COLOR.active}
                  strokeWidth={3}
                  className="pointer-events-none"
                  data-active="true"
                />
              )}
              {color && (
                <>
                  <rect
                    x={rect.x - 2}
                    y={rect.y - 2}
                    width={rect.w + 4}
                    height={rect.h + 4}
                    rx={10}
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    className="pointer-events-none"
                    style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                  />
                  <g
                    role="img"
                    aria-label={problem === "error" ? "Has an error" : "Has a warning"}
                    className="pointer-events-none"
                  >
                    <circle cx={rect.x + rect.w - 2} cy={rect.y + 2} r={11} fill={color} />
                    <text
                      x={rect.x + rect.w - 2}
                      y={rect.y + 7}
                      textAnchor="middle"
                      fontSize={15}
                      fontWeight={700}
                      fill="#09090b"
                    >
                      !
                    </text>
                  </g>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
