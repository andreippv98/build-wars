"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfigurator } from "@/components/configurator/configurator-provider";

const CONFIRM_MS = 2000;

export function ShareBlock() {
  const { sharePath } = useConfigurator();
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (manualUrl) input.current?.select();
  }, [manualUrl]);

  async function share() {
    const url = window.location.origin + sharePath;
    try {
      await navigator.clipboard.writeText(url);
      setManualUrl(null);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), CONFIRM_MS);
    } catch {
      setManualUrl(url);
    }
  }

  return (
    <section aria-label="Save and share" className="flex flex-col gap-2">
      <Button variant="outline" className="min-h-11" onClick={share} data-testid="share-button">
        {copied ? <Check /> : <Link2 />}
        <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
      </Button>
      {manualUrl && (
        <input
          ref={input}
          readOnly
          value={manualUrl}
          aria-label="Link to this build"
          onFocus={(e) => e.currentTarget.select()}
          className="border-input min-h-11 w-full rounded-lg border bg-transparent px-2.5 text-sm"
        />
      )}
      <Button className="min-h-11" disabled data-testid="save-button">
        Save build
      </Button>
      <p className="text-muted-foreground text-xs">Sign in to save builds: coming soon</p>
    </section>
  );
}
