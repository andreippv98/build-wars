import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/** The part's relative index as a large number, with what 100 means and an honesty badge. */
export function IndexBadge({
  value,
  verified,
  label,
  reference,
}: {
  value: number;
  verified: boolean;
  /** "CPU index" */
  label: string;
  /** What 100 means: "Ryzen 7 9800X3D = 100". */
  reference: string;
}) {
  return (
    <section
      aria-label={label}
      className="border-border bg-card flex w-full flex-col gap-1 rounded-xl border p-5 md:w-64"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        {!verified && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-400">
            Estimate
          </Badge>
        )}
      </div>
      <p className="text-6xl leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-1 text-sm">{reference}</p>
      {!verified && (
        <p className="text-muted-foreground mt-1 text-xs leading-snug">
          Placeholder value, not yet based on review data
        </p>
      )}
      <Link
        href="/how-scores-work"
        className="text-primary mt-2 w-fit text-sm underline underline-offset-4 hover:no-underline"
      >
        How scores work
      </Link>
    </section>
  );
}
