import Link from "next/link";
import { buildHref } from "@/lib/build";
import { boardName, type ComparisonColumn, type ComparisonTable } from "@/lib/parts/gpu";
import { watts } from "@/lib/parts/format";
import { partPath } from "@/lib/parts/routes";
import type { GpuChip } from "@/lib/schemas";

const HEADERS = [
  "Boost clock",
  "GPU index",
  "Board power",
  "Power connectors",
  "Length",
  "Thickness",
  "Fans",
  "Recommended PSU",
];

function deltaText(delta: number): string {
  if (delta === 0) return "Reference clock";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)} MHz vs reference`;
}

/**
 * Side-by-side table of every board model of one chip. The best value of a column is labelled
 * in words (never by colour alone), only where "best" is unambiguous and the boards differ.
 * On phones the table scrolls inside its own container with the first column kept in view.
 */
export function BoardComparison({ chip, rows: table }: { chip: GpuChip; rows: ComparisonTable }) {
  const { rows, ranges } = table;
  const differs = (column: ComparisonColumn) => ranges[column].min !== ranges[column].max;
  const cell = "px-3 py-2.5 align-top whitespace-nowrap";
  return (
    <section aria-labelledby="boards-heading" className="flex flex-col gap-3">
      <h2 id="boards-heading" className="text-xl font-semibold tracking-tight">
        Card models compared
      </h2>
      <p className="text-muted-foreground text-xs md:hidden">Scroll sideways to compare</p>
      <div className="border-border relative overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="bg-muted/40 border-border border-b px-4 py-2.5 text-left text-sm font-medium">
            All {rows.length} {chip.name} card models
          </caption>
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs">
              <th scope="col" className="bg-card sticky left-0 z-10 px-3 py-2.5 font-medium">
                Card
              </th>
              {HEADERS.map((header) => (
                <th key={header} scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap">
                  {header}
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 font-medium">
                <span className="sr-only">Build</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ board, index, boostDelta, connectors, thickness }) => (
              <tr key={board.id} className="border-border border-b align-top last:border-b-0">
                <th
                  scope="row"
                  className="bg-card sticky left-0 z-10 min-w-36 px-3 py-2.5 text-left font-medium"
                >
                  <Link
                    href={partPath.gpuBoard(chip, board)}
                    className="text-primary underline underline-offset-4 hover:no-underline"
                  >
                    {boardName(board)}
                  </Link>
                </th>
                <td className={cell}>
                  <span className="font-medium tabular-nums">{board.boost_mhz} MHz</span>
                  <span className="text-muted-foreground block text-xs">
                    {deltaText(boostDelta)}
                  </span>
                  {differs("boost_mhz") && board.boost_mhz === ranges.boost_mhz.max && (
                    <span className="text-xs font-medium">Fastest clock</span>
                  )}
                </td>
                <td className={`${cell} tabular-nums`}>{index}</td>
                <td className={`${cell} tabular-nums`}>{watts(board.power_w)}</td>
                <td className={cell}>{connectors}</td>
                <td className={cell}>
                  <span className="tabular-nums">{board.length_mm} mm</span>
                  {differs("length_mm") && board.length_mm === ranges.length_mm.min && (
                    <span className="block text-xs font-medium">Shortest</span>
                  )}
                </td>
                <td className={`${cell} tabular-nums`}>{thickness}</td>
                <td className={`${cell} tabular-nums`}>{board.fan_count}</td>
                <td className={`${cell} tabular-nums`}>{watts(board.rec_psu_w)}</td>
                <td className={cell}>
                  <Link
                    href={buildHref({ gpu: board.id })}
                    aria-label={`Build with ${boardName(board)}`}
                    className="text-primary text-xs underline underline-offset-4 hover:no-underline"
                  >
                    Build
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
