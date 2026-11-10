"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { Box3, Vector3, type PerspectiveCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BUILD_SLOTS, type BuildSlot } from "@/lib/schemas";
import {
  CAMERA_HOLD_SECONDS,
  CAMERA_NUDGE,
  CAMERA_PADDING,
  CAMERA_SECONDS,
  CAMERA_SECONDS_LOW_DETAIL,
  easeInOut,
} from "./motion";

type Pose = { position: Vector3; target: Vector3 };
type Step = { pose: Pose; seconds: number; delay: number };
type Tween = { from: Pose; steps: Step[]; index: number; time: number };

const centre = new Vector3();
const extent = new Vector3();
const direction = new Vector3();

/**
 * Moves the orbit camera: to frame the slot the user is working on, back to the overview, and a
 * short look at a part that was just added. Any input on the controls cancels a move in progress.
 * Poses come from the slot boxes (envelope placed by the attachment nodes), never from fixed
 * coordinates; the direction the camera looks from is the one it has when the move starts.
 */
export function CameraRig({
  boxes,
  activeSlot,
  idsKey,
  lowDetail,
  reduced,
  minDistance,
  maxDistance,
  resetRef,
}: {
  /** Per slot, the box (scene space) its area occupies; null when the board lacks the slot. */
  boxes: Partial<Record<BuildSlot, Box3 | null>>;
  activeSlot: BuildSlot | null;
  /** The part id of each build slot joined by "|" ("" = empty); a change means a part was added. */
  idsKey: string;
  lowDetail: boolean;
  reduced: boolean;
  minDistance: number;
  maxDistance: number;
  resetRef: RefObject<(() => void) | null>;
}) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as OrbitControls | null;

  const tween = useRef<Tween | null>(null);
  const overview = useRef<Pose | null>(null);
  const appliedSlot = useRef<BuildSlot | null>(null);
  const previousIds = useRef<string | null>(null);

  const seconds = lowDetail ? CAMERA_SECONDS_LOW_DETAIL : CAMERA_SECONDS;

  // A pose that frames `box` from the camera's current direction.
  const framing = (box: Box3, scale = 1): Pose => {
    box.getCenter(centre);
    const radius = box.getSize(extent).length() / 2;
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * Math.min(1, size.width / Math.max(1, size.height)));
    const wanted = (radius / Math.sin(Math.min(vHalf, hHalf))) * CAMERA_PADDING * scale;
    const distance = Math.min(maxDistance, Math.max(minDistance, wanted));
    direction.subVectors(camera.position, controls!.target).normalize();
    return {
      target: centre.clone(),
      position: centre.clone().addScaledVector(direction, distance),
    };
  };

  const current = (): Pose => ({
    position: camera.position.clone(),
    target: controls!.target.clone(),
  });

  const jump = (pose: Pose) => {
    camera.position.copy(pose.position);
    controls!.target.copy(pose.target);
    controls!.update();
  };

  const go = (steps: Step[]) => {
    if (reduced) {
      jump(steps[steps.length - 1].pose);
      tween.current = null;
      return;
    }
    tween.current = { from: current(), steps, index: 0, time: 0 };
  };

  // Input on the controls wins over any move in progress.
  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      tween.current = null;
    };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [controls]);

  // Category chosen in the picker: frame its slot; none: back to the overview.
  useEffect(() => {
    if (!controls) return;
    overview.current ??= current();
    if (appliedSlot.current === activeSlot) return;
    appliedSlot.current = activeSlot;
    const box = activeSlot ? boxes[activeSlot] : null;
    go([{ pose: box ? framing(box) : overview.current, seconds, delay: 0 }]);
    // `current`, `framing` and `go` read fresh values from refs and props each call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, activeSlot, boxes, seconds, reduced]);

  // A part was added: look at it, then return to where the camera was.
  useEffect(() => {
    const before = previousIds.current?.split("|");
    previousIds.current = idsKey;
    if (!before || !controls || lowDetail || reduced) return;
    const now = idsKey.split("|");
    const slot = BUILD_SLOTS.find((_, i) => now[i] && now[i] !== before[i]);
    const box = slot ? boxes[slot] : null;
    if (!box) return;
    const running = tween.current;
    const rest = running ? running.steps[running.steps.length - 1].pose : current();
    go([
      { pose: framing(box, CAMERA_NUDGE), seconds, delay: 0 },
      { pose: rest, seconds, delay: CAMERA_HOLD_SECONDS },
    ]);
    // Only a change of the chosen parts starts this move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    resetRef.current = () => {
      if (controls && overview.current) go([{ pose: overview.current, seconds, delay: 0 }]);
    };
    const ref = resetRef;
    return () => {
      ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, seconds, reduced, resetRef]);

  useFrame((_, delta) => {
    const move = tween.current;
    if (!move || !controls) return;
    const step = move.steps[move.index];
    move.time += Math.min(delta, 0.05);
    const progress = Math.min(1, Math.max(0, (move.time - step.delay) / step.seconds));
    const eased = easeInOut(progress);
    camera.position.lerpVectors(move.from.position, step.pose.position, eased);
    controls.target.lerpVectors(move.from.target, step.pose.target, eased);
    controls.update();
    if (progress >= 1) {
      move.from.position.copy(step.pose.position);
      move.from.target.copy(step.pose.target);
      move.index += 1;
      move.time = 0;
      if (move.index >= move.steps.length) tween.current = null;
    }
  });

  return null;
}
