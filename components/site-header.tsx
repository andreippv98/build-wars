import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-border flex h-12 shrink-0 items-center justify-between border-b px-4">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        Build Wars
      </Link>
      <nav className="text-muted-foreground flex items-center gap-4 text-sm">
        <Link href="/build" className="hover:text-foreground">
          Build a PC
        </Link>
      </nav>
    </header>
  );
}
