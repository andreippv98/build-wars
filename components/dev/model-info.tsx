"use client";

import type { ModelDescription } from "@/lib/models/describe";
import type { ModelEntry } from "@/lib/schemas";

type Size = { x: number; y: number; z: number };

export type InfoProps = {
  description: ModelDescription | null;
  /** Size as authored, and after `scale_to_data` (equal when it is off). */
  sizeBefore: Size | null;
  sizeAfter: Size | null;
  scaleFactor: number;
  dataDims: { x?: number; y?: number; z?: number } | null;
  mismatches: string[];
  /** The manifest entry, or a draft for a file that is not in the manifest yet. */
  entry: ModelEntry | null;
  entryIsDraft: boolean;
};

const fmt = (value: number | undefined) => (value === undefined ? "-" : value.toFixed(1));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border border-t pt-3">
      <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The info panel under the controls: sizes, standard checks, nodes, manifest entry. */
export function ModelInfo(props: InfoProps) {
  const { description, entry } = props;
  const allGreen = description?.checks.every((c) => c.ok) ?? false;
  const reminders: { ok: boolean; text: string }[] = [
    { ok: Boolean(entry?.license), text: "license" },
    { ok: Boolean(entry?.author), text: "author" },
    { ok: Boolean(entry?.source), text: "source" },
    { ok: allGreen, text: "all standard checks green" },
    { ok: false, text: "looked at in the case, next to the parametric version" },
  ];

  return (
    <div className="flex flex-col gap-4 text-xs" data-testid="model-info">
      <Section title="Dimensions (mm)">
        {props.sizeBefore ? (
          <table className="w-full text-left font-mono">
            <thead className="text-muted-foreground">
              <tr>
                <th className="font-normal" />
                <th className="font-normal">X</th>
                <th className="font-normal">Y</th>
                <th className="font-normal">Z</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-muted-foreground pr-2">model</td>
                <td>{fmt(props.sizeBefore.x)}</td>
                <td>{fmt(props.sizeBefore.y)}</td>
                <td>{fmt(props.sizeBefore.z)}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground pr-2">scaled</td>
                <td>{fmt(props.sizeAfter?.x)}</td>
                <td>{fmt(props.sizeAfter?.y)}</td>
                <td>{fmt(props.sizeAfter?.z)}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground pr-2">catalog</td>
                <td>{fmt(props.dataDims?.x)}</td>
                <td>{fmt(props.dataDims?.y)}</td>
                <td>{fmt(props.dataDims?.z)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground">No model loaded.</p>
        )}
        {props.sizeBefore && props.scaleFactor !== 1 && (
          <p className="text-muted-foreground mt-1">
            scale_to_data stretches the length by x{props.scaleFactor.toFixed(3)}.
          </p>
        )}
        {props.sizeBefore && props.dataDims && (
          <ul className="mt-2 flex flex-col gap-1">
            {props.mismatches.length === 0 ? (
              <li className="text-emerald-400" data-testid="no-mismatch">
                Matches the catalog dimensions.
              </li>
            ) : (
              props.mismatches.map((message) => (
                <li key={message} className="text-amber-300" data-testid="mismatch">
                  {message}
                </li>
              ))
            )}
          </ul>
        )}
        {props.sizeBefore && !props.dataDims && (
          <p className="text-muted-foreground mt-1">The catalog has no dimensions to compare.</p>
        )}
      </Section>

      <Section title="Standard checks">
        {description ? (
          <ul className="flex flex-col gap-1.5">
            {description.checks.map((check) => (
              <li
                key={check.id}
                data-testid={`check-${check.id}`}
                data-ok={check.ok ? "true" : "false"}
                className={`flex gap-2 ${check.ok ? "text-emerald-400" : "text-red-400"}`}
              >
                <span aria-hidden className="w-8 shrink-0 font-mono">
                  {check.ok ? "pass" : "FAIL"}
                </span>
                <span>{check.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No model loaded.</p>
        )}
      </Section>

      <Section title={`Nodes${description ? ` (${description.nodes.length})` : ""}`}>
        {description && description.nodes.length > 0 ? (
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-left font-mono">
              <tbody>
                {description.nodes.map((node, i) => (
                  <tr key={`${node.name}-${i}`}>
                    <td className="max-w-[150px] truncate pr-2" title={node.name}>
                      {node.name}
                    </td>
                    <td className="text-muted-foreground whitespace-nowrap">
                      {node.position.x.toFixed(1)}, {node.position.y.toFixed(1)},{" "}
                      {node.position.z.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground">No named nodes.</p>
        )}
      </Section>

      <Section title={props.entryIsDraft ? "Manifest entry (draft)" : "Manifest entry"}>
        {entry ? (
          <pre className="bg-muted/40 max-h-64 overflow-auto rounded p-2 font-mono text-[11px]">
            {JSON.stringify(entry, null, 2)}
          </pre>
        ) : (
          <p className="text-muted-foreground">Nothing selected.</p>
        )}
        {props.entryIsDraft && (
          <p className="text-muted-foreground mt-1">
            This file is not in the manifest. Run <code>pnpm models:import</code> to add it.
          </p>
        )}
      </Section>

      <Section title="Before verified: true">
        <ul className="flex flex-col gap-1">
          {reminders.map((item) => (
            <li key={item.text} className={item.ok ? "text-emerald-400" : "text-muted-foreground"}>
              <span aria-hidden className="inline-block w-5 font-mono">
                {item.ok ? "[x]" : "[ ]"}
              </span>
              {item.text}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2">
          Set <code>verified: true</code> by hand in <code>data/models/manifest.json</code> once
          everything is ticked and you have looked at the model in the case.
        </p>
      </Section>
    </div>
  );
}
