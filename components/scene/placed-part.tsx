"use client";

import { useCursor } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Color, type Matrix4, type Object3D } from "three";
import { modelBounds } from "@/lib/models/snap";
import { SLOT_CATEGORY } from "@/lib/models/standard";
import type { BuildSlot } from "@/lib/schemas";
import { applyLook, cloneInstance, spinFans } from "./effects/instance";
import {
  DIM_OPACITY,
  ENTER,
  ENTER_SECONDS,
  FAN_RADIANS_PER_SECOND,
  GLOW_MAX,
  GLOW_MIN,
  GLOW_PERIOD_SECONDS,
  GLOW_STATIC,
  LEAVE_SECONDS,
  easeOut,
} from "./effects/motion";
import { BoxOutline } from "./effects/outline";
import type { ProblemSeverity } from "./effects/problems";

const GLOW_COLORS: Record<ProblemSeverity, Color> = {
  error: new Color("#ff2a2a"),
  warning: new Color("#ffb020"),
};
const ACTIVE_OUTLINE = "#a5b4fc";
/** Speed at which the dimmed state eases in and out (per second). */
const DIM_RATE = 8;

/** How a placed part reacts to the rest of the scene. */
export type PartLook = {
  /** Glows red or amber while the build has a problem with this slot. */
  glow?: ProblemSeverity | null;
  /** Dimmed while a ghost preview shows in its slot. */
  dim?: boolean;
  /** Outlined because its category is open in the picker. */
  outline?: boolean;
  /** Called when the part is clicked; without it the part ignores the pointer. */
  onSelect?: () => void;
};

/**
 * One model at its snapped place in the case. The outer group carries the placement (from the
 * attachment nodes) and is never animated; the model sits in an inner group that slides in, in a
 * copy with its own materials that fade, glow and dim. `leaving` keeps it visible while it fades
 * out, then calls `onGone`. `settled` is false while the scene is first mounting, so parts that
 * are there from the start appear without animation.
 */
export function PlacedPart({
  slot,
  object,
  matrix,
  settled,
  reducedMotion,
  leaving = false,
  slideIn = true,
  onGone,
  look = {},
  children,
}: {
  slot: BuildSlot;
  object: Object3D;
  matrix: Matrix4;
  settled: RefObject<boolean>;
  reducedMotion: boolean;
  leaving?: boolean;
  /** False for stand-ins that should simply appear (the placeholder board). */
  slideIn?: boolean;
  onGone?: () => void;
  look?: PartLook;
  /** Rendered inside the sliding group, next to the model. */
  children?: ReactNode;
}) {
  const { glow = null, dim = false, outline = false, onSelect } = look;
  const inner = useRef<Object3D>(null);
  const spec = ENTER[SLOT_CATEGORY[slot] as keyof typeof ENTER];

  const instance = useMemo(() => cloneInstance(object), [object]);
  useEffect(() => () => instance.dispose(), [instance]);

  // Animation state, mutated every frame (never React state).
  const fx = useRef({
    enter: 1,
    leave: 0,
    dim: 0,
    gone: false,
    applied: null as string | null,
    opacity: -1,
    glow: -1,
    glowKind: null as ProblemSeverity | null,
  });

  // Decided once, at mount: slide in only if the scene was already up (not on first load).
  const started = useRef(false);
  useLayoutEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!slideIn || leaving || reducedMotion || !settled.current) return;
    fx.current.enter = 0;
    const group = inner.current;
    if (group) {
      const offset = spec.distance * (1 - easeOut(0, spec.back));
      group.position.set(spec.from[0] * offset, spec.from[1] * offset, spec.from[2] * offset);
    }
  }, [slideIn, leaving, reducedMotion, settled, spec]);

  useFrame((state, delta) => {
    const f = fx.current;
    const group = inner.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);

    if (f.enter < 1) {
      f.enter = Math.min(1, f.enter + dt / ENTER_SECONDS);
      const offset = spec.distance * (1 - easeOut(f.enter, spec.back));
      group.position.set(spec.from[0] * offset, spec.from[1] * offset, spec.from[2] * offset);
    }
    if (leaving && !f.gone) {
      f.leave = reducedMotion ? 1 : Math.min(1, f.leave + dt / LEAVE_SECONDS);
      if (f.leave >= 1) {
        f.gone = true;
        onGone?.();
      }
    }
    const dimTarget = dim ? 1 : 0;
    if (f.dim !== dimTarget) {
      const step = reducedMotion ? 1 : dt * DIM_RATE;
      f.dim =
        f.dim < dimTarget ? Math.min(dimTarget, f.dim + step) : Math.max(dimTarget, f.dim - step);
    }

    let strength = 0;
    if (glow) {
      strength = reducedMotion
        ? GLOW_STATIC
        : GLOW_MIN +
          (GLOW_MAX - GLOW_MIN) *
            (0.5 + 0.5 * Math.sin((state.clock.elapsedTime * 2 * Math.PI) / GLOW_PERIOD_SECONDS));
    }
    const opacity = f.enter * (1 - f.leave) * (1 - f.dim * (1 - DIM_OPACITY));
    if (
      f.applied !== instance.root.uuid ||
      f.opacity !== opacity ||
      f.glow !== strength ||
      f.glowKind !== glow
    ) {
      f.applied = instance.root.uuid;
      f.opacity = opacity;
      f.glow = strength;
      f.glowKind = glow;
      applyLook(instance, opacity, glow ? GLOW_COLORS[glow] : null, strength);
    }

    if (!reducedMotion) {
      const spin = FAN_RADIANS_PER_SECOND * dt;
      spinFans(instance, spin);
    }
  });

  const [hovered, setHovered] = useState(false);
  const interactive = Boolean(onSelect) && !leaving;
  useCursor(hovered && interactive);

  const bounds = useMemo(() => {
    const box = modelBounds(object);
    return box.isEmpty() ? null : box;
  }, [object]);

  return (
    <group
      matrix={matrix}
      matrixAutoUpdate={false}
      userData={{ slot }}
      onClick={
        interactive
          ? (event) => {
              event.stopPropagation();
              onSelect?.();
            }
          : undefined
      }
      onPointerOver={
        interactive
          ? (event) => {
              event.stopPropagation();
              setHovered(true);
            }
          : undefined
      }
      onPointerOut={interactive ? () => setHovered(false) : undefined}
    >
      <group ref={inner}>
        <primitive object={instance.root} />
        {outline && bounds && !leaving ? (
          <BoxOutline
            min={[bounds.min.x, bounds.min.y, bounds.min.z]}
            max={[bounds.max.x, bounds.max.y, bounds.max.z]}
            color={ACTIVE_OUTLINE}
            opacity={0.9}
          />
        ) : null}
        {children}
      </group>
    </group>
  );
}
