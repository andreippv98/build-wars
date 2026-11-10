/** Honest note about where the specs came from and whether they have been checked. */
export function DataStatus({ verified, sourceNotes }: { verified: boolean; sourceNotes: string }) {
  return (
    <section
      aria-label="Data status"
      className="border-border text-muted-foreground border-t pt-5 text-sm leading-relaxed"
    >
      <p className="text-foreground font-medium">
        {verified
          ? "Specs checked against the manufacturer's page."
          : "These specs have not been checked against the manufacturer's page yet."}
      </p>
      <p className="mt-1">Source notes: {sourceNotes}</p>
    </section>
  );
}
