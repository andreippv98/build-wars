import Link from "next/link";
import { PART_SECTIONS } from "@/lib/parts/routes";

export function SiteHeader() {
  return (
    <header className="border-border flex h-12 shrink-0 items-center justify-between border-b px-4">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Build Wars
      </Link>
      <nav
        aria-label="Main"
        className="text-muted-foreground flex items-center gap-4 overflow-x-auto text-sm whitespace-nowrap"
      >
        {Object.values(PART_SECTIONS).map((section) => (
          <Link
            key={section.path}
            href={section.path}
            className="hover:text-foreground hidden md:inline"
          >
            {section.title}
          </Link>
        ))}
        <Link href="/how-scores-work" className="hover:text-foreground hidden sm:inline">
          How scores work
        </Link>
        <Link href="/build" className="text-foreground font-medium">
          Build a PC
        </Link>
      </nav>
    </header>
  );
}
