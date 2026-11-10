"use client";

import { Canvas } from "@react-three/fiber";
import {
  Component,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { BuildSlot } from "@/lib/schemas";
import { ScenePlaceholder } from "../configurator/scene-placeholder";
import { BUILD_SLOTS } from "@/lib/schemas";
import { BuildScene, type SceneStatus } from "./build-scene";
import { problemsAttribute } from "./effects/problems";
import { useSceneState } from "./effects/scene-state";

/** True when the browser can create a WebGL context. Checked once. */
let webglSupport: boolean | undefined;
function hasWebGL(): boolean {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noop = () => () => {};

/** Falls back to the 2D view if the 3D scene throws (lost context, driver trouble). */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The centre of the configurator: the 3D open case, or the 2D side view where WebGL is
 * unavailable. `lowDetail` (phones) turns shadows off, caps the pixel ratio and asks the model
 * loader for low-detail files.
 */
export function Scene({
  lowDetail = false,
  onSlotClick,
}: {
  lowDetail?: boolean;
  onSlotClick?: (slot: BuildSlot) => void;
}) {
  const webgl = useSyncExternalStore(noop, hasWebGL, () => null);
  const { activeSlot, ghost, problems, empty } = useSceneState();
  const resetView = useRef<(() => void) | null>(null);
  const fallback = <ScenePlaceholder onSlotClick={onSlotClick} />;
  const [status, setStatus] = useState<SceneStatus>({});
  const onStatus = useCallback<NonNullable<Parameters<typeof BuildScene>[0]["onStatus"]>>(
    (slot, source) =>
      setStatus((current) => {
        if ((current[slot] ?? null) === source) return current;
        const next = { ...current };
        if (source) next[slot] = source;
        else delete next[slot];
        return next;
      }),
    [],
  );
  // e.g. "cpu:parametric gpu:family": which model each filled slot is drawn with.
  const parts = BUILD_SLOTS.filter((slot) => status[slot])
    .map((slot) => `${slot}:${status[slot]}`)
    .join(" ");
  if (webgl === null) return <div data-testid="scene" className="h-full w-full bg-[#09090b]" />;
  if (!webgl) return fallback;

  return (
    <SceneBoundary fallback={fallback}>
      <div
        data-testid="scene"
        data-renderer="webgl"
        data-parts={parts}
        data-active-slot={activeSlot ?? ""}
        data-ghost={ghost ? `${ghost.slot}:${ghost.id}` : ""}
        data-problems={problemsAttribute(problems)}
        data-empty={empty.join(" ")}
        className="relative h-full w-full"
      >
        <Canvas
          shadows={!lowDetail}
          dpr={lowDetail ? [1, 1.5] : [1, 2]}
          camera={{ position: [260, 120, 1080], fov: 36, near: 10, far: 6000 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <BuildScene
            lowDetail={lowDetail}
            onStatus={onStatus}
            onSlotClick={onSlotClick}
            resetRef={resetView}
          />
        </Canvas>
        <button
          type="button"
          data-testid="scene-reset-view"
          onClick={() => resetView.current?.()}
          className="absolute top-3 right-3 rounded-md border border-white/15 bg-black/50 px-2.5 py-1 text-xs font-medium text-zinc-200 backdrop-blur-sm hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none"
        >
          Reset view
        </button>
      </div>
    </SceneBoundary>
  );
}
