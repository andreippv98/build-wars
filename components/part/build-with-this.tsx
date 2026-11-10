import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The primary call to action: opens the configurator with this part loaded. */
export function BuildWithThis({
  href,
  label = "Build with this part",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ size: "lg" }),
        "h-12 w-full px-6 text-base font-semibold sm:w-auto",
      )}
    >
      {label}
    </Link>
  );
}
