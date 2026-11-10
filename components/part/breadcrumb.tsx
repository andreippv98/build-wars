import Link from "next/link";

export type Crumb = { name: string; href?: string };

/** Breadcrumb trail. The last crumb is the current page and has no `href`. */
export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground mb-5 text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {trail.map((crumb, index) => (
          <li key={crumb.name} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="hover:text-foreground underline-offset-4 hover:underline"
              >
                {crumb.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {crumb.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
