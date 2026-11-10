"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Group } from "three";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  indexCatalog,
  partId,
  partName,
  SLOT_LABELS,
  type ClientCatalog,
  type SlotPart,
} from "@/lib/build";
import { describeModel, mismatchMessage } from "@/lib/models/describe";
import { findModel, modelUrl } from "@/lib/models/lookup";
import { buildCaseModel, buildParametricModel } from "@/lib/models/parametric";
import { dataDimensions, dimensionMismatches, scaleToData } from "@/lib/models/scale";
import { modelSize } from "@/lib/models/snap";
import { SLOT_CATEGORY } from "@/lib/models/standard";
import {
  BUILD_SLOTS,
  MODEL_CATEGORIES,
  type BuildSlot,
  type ModelCategory,
  type ModelEntry,
} from "@/lib/schemas";
import { useGlb } from "./glb";
import { ModelInfo } from "./model-info";
import { ModelViewer, type ViewMode } from "./model-viewer";

const MODELS_BASE_URL = process.env.NEXT_PUBLIC_MODELS_BASE_URL ?? "/models";

const CATEGORY_LABELS: Record<ModelCategory, string> = {
  gpu: "GPU",
  cpu_cooler: "CPU cooler",
  motherboard: "Motherboard",
  ram: "RAM",
  psu: "PSU",
  case: "Case",
  fan: "Fan",
};

const slotOf = (category: ModelCategory): BuildSlot | null =>
  BUILD_SLOTS.find((slot) => SLOT_CATEGORY[slot] === category) ?? null;

const isCategory = (value: string | null): value is ModelCategory =>
  value !== null && (MODEL_CATEGORIES as readonly string[]).includes(value);

type Source = { modelId: string | null; file: string; category: ModelCategory };

const noop = () => () => {};

/**
 * The dev-only model test page. The URL carries the state (`?model=<id>` or
 * `?file=<url>&category=<cat>`, plus `part=<id>`), which only exists in the browser, so the tool
 * renders after mount.
 */
export function ModelTest(props: { catalog: ClientCatalog; manifest: ModelEntry[] }) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted) {
    return (
      <div data-testid="dev-models" className="flex-1 p-4 text-sm text-zinc-400">
        Loading...
      </div>
    );
  }
  return <ModelTester {...props} />;
}

function initialState(manifest: readonly ModelEntry[]) {
  const params = new URLSearchParams(window.location.search);
  const entry = manifest.find((m) => m.id === params.get("model"));
  const category = params.get("category");
  const source: Source = entry
    ? { modelId: entry.id, file: modelUrl(entry.file, MODELS_BASE_URL), category: entry.category }
    : {
        modelId: null,
        file: params.get("file") ?? "",
        category: isCategory(category) ? category : "gpu",
      };
  return { source, partId: params.get("part"), entry: entry ?? null };
}

function ModelTester({ catalog, manifest }: { catalog: ClientCatalog; manifest: ModelEntry[] }) {
  const index = useMemo(() => indexCatalog(catalog), [catalog]);
  const [initial] = useState(() => initialState(manifest));
  const [source, setSource] = useState<Source>(initial.source);
  const [fileDraft, setFileDraft] = useState(initial.source.file);
  const [chosenPart, setChosenPart] = useState<string | null>(initial.partId);
  const [view, setView] = useState<ViewMode>("alone");
  const [showParametric, setShowParametric] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [applyScale, setApplyScale] = useState(initial.entry?.scale_to_data ?? false);
  const [wireframe, setWireframe] = useState(false);

  const { category } = source;
  const entry = manifest.find((m) => m.id === source.modelId) ?? null;
  const slot = slotOf(category);
  const parts = useMemo(
    () => (slot ? (index.parts[slot] as SlotPart[BuildSlot][]) : []),
    [index, slot],
  );

  // The part to compare with: the chosen one, else the first the manifest entry applies to.
  const part = useMemo(() => {
    if (!slot) return null;
    const byId = index.byId[slot] as Map<string, SlotPart[BuildSlot]>;
    const picked = chosenPart ? byId.get(chosenPart) : undefined;
    if (picked) return picked;
    if (entry) {
      const applies = parts.find((p) =>
        findModel([entry], slot, p as never, { includeUnverified: true }),
      );
      if (applies) return applies;
    }
    return parts[0] ?? null;
  }, [slot, index, chosenPart, entry, parts]);
  const currentPartId = slot && part ? partId(slot, part as never) : null;

  // Keep the URL in step with the controls.
  useEffect(() => {
    const params = new URLSearchParams();
    if (source.modelId) params.set("model", source.modelId);
    else if (source.file) {
      params.set("file", source.file);
      params.set("category", source.category);
    }
    if (chosenPart) params.set("part", chosenPart);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [source, chosenPart]);

  const url = source.file.trim() || null;
  const glb = useGlb(url);

  const parametric = useMemo(() => {
    if (category === "case") return buildCaseModel();
    if (!slot || !part) return null;
    return buildParametricModel(slot, part as never);
    // `part` identity is stable per id; the model only needs rebuilding when that changes.
  }, [category, slot, part]);

  // The model as drawn: a clone, stretched when `scale_to_data` is on.
  const model = useMemo(() => {
    if (!glb.object) return null;
    const copy = glb.object.clone(true);
    if (applyScale && slot && part) scaleToData(copy, slot, part as never);
    return copy;
  }, [glb.object, applyScale, slot, part]);

  const analysis = useMemo(() => {
    if (!glb.object) return null;
    const description = describeModel(glb.object, category);
    const before = modelSize(glb.object);
    const scale = model?.scale ?? glb.object.scale;
    const after = { x: before.x * scale.x, y: before.y * scale.y, z: before.z * scale.z };
    let mismatches: string[] = [];
    let dataDims: ReturnType<typeof dataDimensions> | null = null;
    if (slot && part && model) {
      dataDims = dataDimensions(slot, part as never);
      // Measure what is drawn: a wrapper makes the model's own scale count.
      const wrapper = new Group();
      wrapper.add(model.clone(true));
      mismatches = dimensionMismatches(wrapper, slot, part as never).map((m) =>
        mismatchMessage(category, m),
      );
      if (Object.keys(dataDims).length === 0) dataDims = null;
    }
    return {
      description,
      before: { x: before.x, y: before.y, z: before.z },
      after,
      scaleFactor: scale.x,
      mismatches,
      dataDims,
    };
  }, [glb.object, model, category, slot, part]);

  const lookup = useMemo(() => {
    if (!slot || !part) return null;
    const withAll = findModel(manifest, slot, part as never, { includeUnverified: true });
    const verified = findModel(manifest, slot, part as never);
    if (verified) {
      return {
        step: verified.kind === "exact" ? "exact" : "family (scaled)",
        entryId: verified.entry.id,
      };
    }
    if (withAll) {
      return { step: "parametric (this model is not verified)", entryId: withAll.entry.id };
    }
    return { step: "parametric (no manifest model applies to this part)", entryId: null };
  }, [manifest, slot, part]);

  const draftEntry = useMemo<ModelEntry | null>(() => {
    if (entry) return entry;
    if (!url) return null;
    return {
      id: "new-model-id",
      applies_to: { part_ids: [currentPartId ?? "part-id"] },
      category,
      file: url,
      scale_to_data: applyScale,
      verified: false,
    };
  }, [entry, url, category, currentPartId, applyScale]);

  const selectEntry = (id: string | null) => {
    const next = manifest.find((m) => m.id === id);
    if (!next) return;
    const file = modelUrl(next.file, MODELS_BASE_URL);
    setSource({ modelId: next.id, file, category: next.category });
    setFileDraft(file);
    setChosenPart(null);
    setApplyScale(next.scale_to_data);
  };
  const commitFile = () => {
    if (fileDraft === source.file && source.modelId === null) return;
    if (fileDraft === source.file) return;
    setSource({ modelId: null, file: fileDraft.trim(), category: source.category });
  };
  const setCategory = (next: ModelCategory | null) => {
    if (!next) return;
    setSource({ modelId: null, file: source.file, category: next });
    setChosenPart(null);
    if (next === "fan") setView("alone");
  };

  const manifestItems = manifest.map((m) => ({
    value: m.id,
    label: `${m.id} (${CATEGORY_LABELS[m.category]}, ${m.verified ? "verified" : "unverified"})`,
  }));
  const partItems = slot
    ? parts.map((p) => ({ value: partId(slot, p as never), label: partName(slot, p as never) }))
    : [];

  return (
    <div
      data-testid="dev-models"
      className="flex min-h-0 flex-1 flex-col bg-zinc-950 text-zinc-100 lg:h-[calc(100dvh_-_3rem)] lg:flex-none lg:flex-row"
    >
      <aside className="border-border flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-b p-4 lg:w-[340px] lg:border-r lg:border-b-0">
        <h1 className="text-sm font-semibold">Model test</h1>

        <section className="flex flex-col gap-2">
          <Label>Model from the manifest</Label>
          <Select
            items={manifestItems}
            value={source.modelId}
            onValueChange={selectEntry}
            disabled={manifest.length === 0}
          >
            <SelectTrigger className="w-full" data-testid="model-select">
              <SelectValue
                placeholder={
                  manifest.length === 0 ? "The manifest is empty" : "Not from the manifest"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {manifest.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="truncate">{m.id}</span>
                  <span className="text-muted-foreground text-xs">
                    {CATEGORY_LABELS[m.category]}
                  </span>
                  <Badge variant={m.verified ? "default" : "secondary"}>
                    {m.verified ? "verified" : "unverified"}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label htmlFor="file-input">File or URL</Label>
          <Input
            id="file-input"
            data-testid="file-input"
            value={fileDraft}
            placeholder="/models/gpu/sample-gpu.glb"
            onChange={(event) => setFileDraft(event.target.value)}
            onBlur={commitFile}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitFile();
            }}
          />
          <Label>Category</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as ModelCategory | null)}
            items={MODEL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          >
            <SelectTrigger className="w-full" data-testid="category-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="flex flex-col gap-2">
          <Label>Compare with part{slot ? ` (${SLOT_LABELS[slot].name})` : ""}</Label>
          <Select
            items={partItems}
            value={currentPartId}
            onValueChange={(v) => setChosenPart(v)}
            disabled={!slot}
          >
            <SelectTrigger className="w-full" data-testid="part-select">
              <SelectValue placeholder="No parts for this category" />
            </SelectTrigger>
            <SelectContent>
              {partItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-zinc-400">
            The public site would use:{" "}
            {lookup ? (
              <>
                <span className="font-medium text-zinc-100" data-testid="lookup-step">
                  {lookup.step}
                </span>
                {lookup.entryId && <span> ({lookup.entryId})</span>}
              </>
            ) : (
              <span data-testid="lookup-step">not applicable (no part to compare)</span>
            )}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <Label>View</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={view === "alone" ? "default" : "outline"}
              aria-pressed={view === "alone"}
              data-testid="view-alone"
              onClick={() => setView("alone")}
            >
              Alone
            </Button>
            <Button
              size="sm"
              variant={view === "case" ? "default" : "outline"}
              aria-pressed={view === "case"}
              data-testid="view-case"
              disabled={category === "fan"}
              onClick={() => setView("case")}
            >
              In the case
            </Button>
          </div>
          {(
            [
              ["Show parametric version", showParametric, setShowParametric, "opt-parametric"],
              ["Show attachment points", showPoints, setShowPoints, "opt-points"],
              ["Apply scale_to_data", applyScale, setApplyScale, "opt-scale"],
              ["Wireframe", wireframe, setWireframe, "opt-wireframe"],
            ] as const
          ).map(([label, checked, set, id]) => (
            <Label key={id} className="font-normal">
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => set(value === true)}
                data-testid={id}
              />
              {label}
            </Label>
          ))}
        </section>

        <ModelInfo
          description={analysis?.description ?? null}
          sizeBefore={analysis?.before ?? null}
          sizeAfter={analysis?.after ?? null}
          scaleFactor={analysis?.scaleFactor ?? 1}
          dataDims={analysis?.dataDims ?? null}
          mismatches={analysis?.mismatches ?? []}
          entry={draftEntry}
          entryIsDraft={!entry && draftEntry !== null}
        />
      </aside>

      <main className="min-h-[420px] min-w-0 flex-1">
        <ModelViewer
          category={category}
          slot={slot}
          part={part}
          view={view}
          model={model}
          parametric={parametric}
          showParametric={showParametric}
          showPoints={showPoints}
          wireframe={wireframe}
          glb={glb}
          url={url}
        />
      </main>
    </div>
  );
}
