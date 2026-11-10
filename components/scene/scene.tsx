"use client";

import { Canvas } from "@react-three/fiber";
import { Component, useSyncExternalStore, type ReactNode } from "react";
import type { BuildSlot } from "@/lib/schemas";
import { ScenePlaceholder } from "../configurator/scene-placeholder";
import { BuildScene } from "./build-scene";

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
  const fallback = <ScenePlaceholder onSlotClick={onSlotClick} />;
  if (webgl === null) return <div data-testid="scene" className="h-full w-full bg-[#09090b]" />;
  if (!webgl) return fallback;

  return (
    <SceneBoundary fallback={fallback}>
      <div data-testid="scene" data-renderer="webgl" className="relative h-full w-full">
        <Canvas
          shadows={!lowDetail}
          dpr={lowDetail ? [1, 1.5] : [1, 2]}
          camera={{ position: [260, 120, 1080], fov: 36, near: 10, far: 6000 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <BuildScene lowDetail={lowDetail} />
        </Canvas>
      </div>
    </SceneBoundary>
  );
}
