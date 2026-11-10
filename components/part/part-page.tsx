import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "./breadcrumb";

/**
 * Shell of every part page: breadcrumb, heading, lead sentence, the index badge and call to
 * action under it, a main column of sections and a side column that stacks below on phones.
 * The last crumb is the current page and has no `href`.
 */
export function PartPage({
  trail,
  title,
  lead,
  aside,
  actions,
  side,
  children,
}: {
  trail: Crumb[];
  title: string;
  lead: string;
  /** Header aside: the index badge. */
  aside?: ReactNode;
  /** The primary call to action, right under the lead. */
  actions?: ReactNode;
  /** Side column: more sections, ad slot. */
  side?: ReactNode;
  /** Main column sections. */
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:py-10">
      <Breadcrumb trail={trail} />

      <header className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-10">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-prose text-base leading-relaxed sm:text-lg">
            {lead}
          </p>
        </div>
        {aside && <div className="md:col-start-2 md:row-span-2 md:row-start-1">{aside}</div>}
        {actions && <div className="md:col-start-1 md:row-start-2">{actions}</div>}
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-10">{children}</div>
        {side && <aside className="flex min-w-0 flex-col gap-8">{side}</aside>}
      </div>
    </main>
  );
}
