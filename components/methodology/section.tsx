import type { ReactNode } from "react";

/** A titled block of the methodology page. `id` makes the heading linkable. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="scroll-mt-16 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A formula or worked line, wrapping on a phone instead of scrolling the page. */
export function Formula({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p
      data-testid={testId}
      className="border-border bg-card rounded-lg border px-4 py-3 font-mono text-sm leading-relaxed break-words"
    >
      {children}
    </p>
  );
}
