"use client";

import { useConfigurator } from "@/components/configurator/configurator-provider";

const STATUS_BAR = { green: "bg-emerald-500", amber: "bg-amber-400", red: "bg-red-500" } as const;
const STATUS_TEXT = {
  green: "text-emerald-400",
  amber: "text-amber-400",
  red: "text-red-400",
} as const;

export function PowerBlock() {
  const { evaluation } = useConfigurator();
  const { power } = evaluation;
  const h = power.headroom;

  return (
    <section aria-labelledby="summary-power-heading" className="flex flex-col gap-3">
      <h2 id="summary-power-heading" className="text-sm font-semibold">
        Power
      </h2>
      {power.peakW === 0 ? (
        <p className="text-muted-foreground text-sm">
          Add parts to see how much power your build needs
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted-foreground text-xs">Estimated gaming draw</dt>
              <dd className="text-xl font-semibold tabular-nums">
                <span data-testid="power-peak">{power.peakW}</span> W
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Recommended PSU</dt>
              <dd className="text-xl font-semibold tabular-nums">
                <span data-testid="power-recommended">{power.recommendedPsuW}</span> W
              </dd>
            </div>
          </dl>
          {h ? (
            <div className="flex flex-col gap-1.5">
              <div
                role="meter"
                aria-label="Power supply headroom"
                aria-valuemin={0}
                aria-valuemax={h.psuW}
                aria-valuenow={Math.min(power.peakW, h.psuW)}
                aria-valuetext={`Estimated draw ${power.peakW} W of a ${h.psuW} W power supply`}
                data-testid="headroom-bar"
                data-status={h.status}
                className="bg-muted relative h-3 w-full overflow-hidden rounded-full"
              >
                <div
                  className={`h-full ${STATUS_BAR[h.status]}`}
                  style={{ width: `${Math.min(100, (power.peakW / h.psuW) * 100)}%` }}
                />
                {power.recommendedPsuW <= h.psuW && (
                  <div
                    aria-hidden
                    className="bg-foreground absolute inset-y-0 w-0.5"
                    style={{ left: `${(power.recommendedPsuW / h.psuW) * 100}%` }}
                  />
                )}
              </div>
              <div className="text-muted-foreground flex justify-between text-xs tabular-nums">
                <span>0 W</span>
                <span>{h.psuW} W PSU</span>
              </div>
              <p className={`text-sm font-medium ${STATUS_TEXT[h.status]}`}>
                {h.status === "green" && `${h.spareW} W to spare`}
                {h.status === "amber" &&
                  `Works, but below the recommended ${power.recommendedPsuW} W`}
                {h.status === "red" &&
                  `Too small: ${Math.abs(h.spareW)} W short of the estimated peak`}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Choose a power supply to see headroom</p>
          )}
        </>
      )}
    </section>
  );
}
