import type { SpecGroup } from "@/lib/parts/specs";

/** Spec groups, each a titled table of label / value rows with an optional note. */
export function SpecTable({ groups }: { groups: SpecGroup[] }) {
  return (
    <section aria-labelledby="specs-heading" className="flex flex-col gap-6">
      <h2 id="specs-heading" className="text-xl font-semibold tracking-tight">
        Specifications
      </h2>
      {groups.map((group) => (
        <div key={group.title} className="border-border overflow-hidden rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="bg-muted/40 border-border border-b px-4 py-2.5 text-left text-sm font-medium">
              {group.title}
            </caption>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.label} className="border-border border-b align-top last:border-b-0">
                  <th
                    scope="row"
                    className="text-muted-foreground w-2/5 px-4 py-2.5 font-normal break-words sm:w-1/3"
                  >
                    {row.label}
                  </th>
                  <td className="px-4 py-2.5 break-words">
                    <span className="font-medium">{row.value}</span>
                    {row.note && (
                      <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                        {row.note}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
