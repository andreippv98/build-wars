import Link from "next/link";
import { Breadcrumb, type Crumb } from "./breadcrumb";

export type PartIndexGroup = {
  heading: string;
  items: { href: string; name: string; detail?: string; value?: string }[];
};

/** Index page body: a heading, an intro and groups of links to part pages. */
export function PartIndex({
  trail,
  title,
  intro,
  groups,
}: {
  trail: Crumb[];
  title: string;
  intro: string;
  groups: PartIndexGroup[];
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:py-10">
      <Breadcrumb trail={trail} />
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>
      <p className="text-muted-foreground mt-3 max-w-prose text-base leading-relaxed sm:text-lg">
        {intro}
      </p>
      <div className="mt-10 flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.heading} className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight">{group.heading}</h2>
            <ul className="border-border divide-border divide-y rounded-xl border">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:bg-muted/50 flex items-start justify-between gap-4 px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium break-words">{item.name}</span>
                      {item.detail && (
                        <span className="text-muted-foreground block text-sm break-words">
                          {item.detail}
                        </span>
                      )}
                    </span>
                    {item.value && (
                      <span className="shrink-0 text-right text-sm tabular-nums">{item.value}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
