import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export type PartListItem = {
  href: string;
  name: string;
  /** Second line: "AM5, ATX, DDR5". */
  detail?: string;
  /** Small label, e.g. "Needs BIOS update". */
  badge?: string;
};

/** Items beyond this many go behind "Show all". */
export const PART_LIST_VISIBLE = 12;

function Item({ item }: { item: PartListItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="hover:bg-muted/50 flex items-start justify-between gap-3 rounded-lg px-3 py-2.5"
      >
        <span className="min-w-0">
          <span className="block font-medium break-words">{item.name}</span>
          {item.detail && (
            <span className="text-muted-foreground block text-sm break-words">{item.detail}</span>
          )}
        </span>
        {item.badge && (
          <Badge variant="outline" className="mt-0.5 h-auto shrink-0 py-0.5 whitespace-normal">
            {item.badge}
          </Badge>
        )}
      </Link>
    </li>
  );
}

/** A titled list of links to other part pages. Long lists fold behind a native <details>. */
export function PartList({
  title,
  items,
  empty,
  headingLevel = 2,
}: {
  title: string;
  items: PartListItem[];
  /** Text shown when there are no items. */
  empty: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  const shown = items.slice(0, PART_LIST_VISIBLE);
  const rest = items.slice(PART_LIST_VISIBLE);
  return (
    <section className="flex flex-col gap-3">
      <Heading className="text-xl font-semibold tracking-tight">{title}</Heading>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="border-border rounded-xl border p-1">
          <ul className="flex flex-col">
            {shown.map((item) => (
              <Item key={item.href} item={item} />
            ))}
          </ul>
          {rest.length > 0 && (
            <details className="group">
              <summary className="text-primary hover:bg-muted/50 cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium group-open:hidden">
                Show all {items.length}
              </summary>
              <ul className="flex flex-col">
                {rest.map((item) => (
                  <Item key={item.href} item={item} />
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
