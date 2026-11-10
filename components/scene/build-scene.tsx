"use client";

import { OrbitControls } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { Vector3, type Box3, type Object3D } from "three";
import { partId, type SlotPart } from "@/lib/build";
import { buildCaseModel, buildMotherboardModel } from "@/lib/models/parametric";
import { modelBounds } from "@/lib/models/snap";
import { BUILD_SLOTS, type BuildSlot } from "@/lib/schemas";
import { useConfigurator } from "../configurator/configurator-provider";
import { issueIds } from "../configurator/summary/format";
import { CameraRig } from "./effects/camera-rig";
import { FloatingLabel } from "./effects/cpu-label";
import { EmptySlot } from "./effects/empty-slot";
import { Ghost } from "./effects/ghost";
import { computePlacements, frameBox, slotFrames, type SlotFrame } from "./effects/placements";
import { slotPartId, useSceneState } from "./effects/scene-state";
import { useReducedMotion } from "./effects/use-reduced-motion";
import { useRetained } from "./effects/use-retained";
import { PlacedPart, type PartLook } from "./placed-part";
import { usePartModel, type PartModel } from "./use-part-model";

/** Which model each filled slot is drawn with; reported to the page for tests and debugging. */
export type SceneStatus = Partial<Record<BuildSlot, PartModel["source"]>>;

type SceneOptions = {
  lowDetail: boolean;
  /** Called when a slot's model source changes; null when the slot empties. */
  onStatus?: (slot: BuildSlot, source: PartModel["source"] | null) => void;
};

type Shared = {
  caseModel: Object3D;
  boardModel: Object3D;
  /** False until the scene has mounted: parts present from the start do not animate in. */
  settled: RefObject<boolean>;
  reducedMotion: boolean;
  lookFor: (slot: BuildSlot) => PartLook;
};

/**
 * The models of one slot at their places. A part that leaves (replaced or removed) stays in the
 * scene while it fades out. RAM is drawn once per stick.
 */
function PartInstances({
  slot,
  part,
  object,
  caseModel,
  boardModel,
  settled,
  reducedMotion,
  lookFor,
}: Shared & { slot: BuildSlot; part: SlotPart[BuildSlot] | null; object: Object3D | null }) {
  const id = part ? partId(slot, part as never) : null;
  const sticks = slot === "ram" && part ? (part as SlotPart["ram"]).sticks : 1;
  const placements = useMemo(
    () => (object && id ? computePlacements(slot, id, sticks, object, caseModel, boardModel) : []),
    [slot, id, sticks, object, caseModel, boardModel],
  );
  const { list, drop } = useRetained(placements);
  const look = lookFor(slot);

  return (
    <>
      {list.map((item) => (
        <PlacedPart
          key={item.key}
          slot={slot}
          object={item.object}
          matrix={item.matrix}
          settled={settled}
          reducedMotion={reducedMotion}
          leaving={item.leaving}
          onGone={() => drop(item.key)}
          look={look}
        >
          {slot === "cpu" && part && !item.leaving ? (
            <FloatingLabel object={item.object} text={(part as SlotPart["cpu"]).name} />
          ) : null}
        </PlacedPart>
      ))}
    </>
  );
}

/** A chosen part: resolves its model (parametric first, then the real one) and draws it. */
function Part({
  slot,
  part,
  lowDetail,
  onStatus,
  ...shared
}: Shared & SceneOptions & { slot: BuildSlot; part: SlotPart[BuildSlot] | null }) {
  const { models } = useConfigurator();
  const model = usePartModel(slot, part as never, models, { lowDetail });
  const source = model?.source ?? null;
  useEffect(() => {
    onStatus?.(slot, source);
    return () => onStatus?.(slot, null);
  }, [onStatus, slot, source]);
  return <PartInstances slot={slot} part={part} object={model?.object ?? null} {...shared} />;
}

/**
 * Everything inside the canvas: lights, the showcase case, the chosen parts and the effects
 * around them (slide-in, ghost preview, empty-slot outlines, problem glow, camera). Parts are
 * placed by the attachment nodes of their parent model; no product-specific geometry or
 * coordinates live here.
 */
export function BuildScene({
  lowDetail,
  onStatus,
  onSlotClick,
  resetRef,
}: SceneOptions & {
  /** Phones: called instead of opening the picker directly. */
  onSlotClick?: (slot: BuildSlot) => void;
  /** Filled with a function that eases the camera back to the overview. */
  resetRef: RefObject<(() => void) | null>;
}) {
  const { build, models, evaluation, setActiveSlot } = useConfigurator();
  const { activeSlot, ghost, problems, empty } = useSceneState();
  const reducedMotion = useReducedMotion();

  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
  }, []);

  const caseModel = useMemo(() => buildCaseModel(), []);
  const placeholderBoard = useMemo(() => buildMotherboardModel(null), []);
  // The board in use, real or placeholder: everything on the board is placed relative to it.
  const chosenBoard = usePartModel("motherboard", build.motherboard ?? null, models, { lowDetail });
  const boardModel = chosenBoard?.object ?? placeholderBoard;
  const boardSource = chosenBoard?.source ?? null;
  useEffect(() => {
    onStatus?.("motherboard", boardSource);
    return () => onStatus?.("motherboard", null);
  }, [onStatus, boardSource]);
  const placeholderPlacement = useMemo(
    () =>
      computePlacements(
        "motherboard",
        "placeholder",
        1,
        placeholderBoard,
        caseModel,
        placeholderBoard,
      )[0],
    [placeholderBoard, caseModel],
  );

  // Centre the case on the origin so the camera orbits its middle.
  const { centre, radius } = useMemo(() => {
    const bounds = modelBounds(caseModel);
    return {
      centre: bounds.getCenter(new Vector3()),
      radius: bounds.getSize(new Vector3()).length() / 2,
    };
  }, [caseModel]);

  // Where each slot is (from the attachment nodes) and the box its envelope covers.
  const frames = useMemo(
    () =>
      Object.fromEntries(
        BUILD_SLOTS.map((slot) => [slot, slotFrames(caseModel, boardModel, slot, "fill")]),
      ) as Record<BuildSlot, SlotFrame[]>,
    [caseModel, boardModel],
  );
  const boxes = useMemo(
    () =>
      Object.fromEntries(
        BUILD_SLOTS.map((slot) => {
          const box = frameBox(slotFrames(caseModel, boardModel, slot, "all"));
          return [slot, box ? box.translate(centre.clone().negate()) : null];
        }),
      ) as Record<BuildSlot, Box3 | null>,
    [caseModel, boardModel, centre],
  );
  const idsKey = BUILD_SLOTS.map((slot) => slotPartId(build, slot) ?? "").join("|");

  const openSlot = useCallback(
    (slot: BuildSlot) => (onSlotClick ?? setActiveSlot)(slot),
    [onSlotClick, setActiveSlot],
  );
  // A part with a problem takes the visitor to the message; otherwise it opens its list.
  const selectPart = useCallback(
    (slot: BuildSlot) => {
      const problem = problems[slot];
      if (!problem) return openSlot(slot);
      const id = issueIds(evaluation.issues)[problem.issueIndex];
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      onSlotClick?.(slot);
    },
    [problems, evaluation.issues, openSlot, onSlotClick],
  );
  const lookFor = useCallback(
    (slot: BuildSlot): PartLook => ({
      glow: problems[slot]?.severity ?? null,
      dim: ghost?.slot === slot,
      outline: activeSlot === slot,
      onSelect: () => selectPart(slot),
    }),
    [problems, ghost, activeSlot, selectPart],
  );

  const shared: Shared = { caseModel, boardModel, settled, reducedMotion, lookFor };
  const options = { lowDetail, onStatus };

  return (
    <>
      <color attach="background" args={["#09090b"]} />
      {/* Studio lighting: soft fill, a key spotlight from the upper front, a rim light and a
          faint coloured accent inside the case. */}
      <hemisphereLight args={["#dbe4ff", "#1a1a22", 1.1]} />
      <spotLight
        position={[radius * 0.5, radius * 1.6, radius * 2.6]}
        angle={0.55}
        penumbra={0.9}
        intensity={3.2}
        decay={0}
        castShadow={!lowDetail}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-radius * 1.2, radius * 0.4, radius * 1.8]} intensity={1.4} />
      <directionalLight position={[radius * 1.5, -radius * 0.2, radius]} intensity={0.6} />
      <pointLight
        position={[0, radius * 0.1, radius * 0.25]}
        intensity={0.5}
        decay={0}
        color="#7c8cff"
      />

      <group position={[-centre.x, -centre.y, -centre.z]}>
        <primitive object={caseModel} />
        {!build.motherboard && placeholderPlacement ? (
          <PlacedPart
            slot="motherboard"
            object={placeholderPlacement.object}
            matrix={placeholderPlacement.matrix}
            settled={settled}
            reducedMotion={reducedMotion}
            slideIn={false}
          />
        ) : null}
        <PartInstances
          slot="motherboard"
          part={build.motherboard ?? null}
          object={chosenBoard?.object ?? null}
          {...shared}
        />
        <Part slot="cpu" part={build.cpu ?? null} {...options} {...shared} />
        <Part slot="ram" part={build.ram ?? null} {...options} {...shared} />
        <Part slot="gpu" part={build.gpu ?? null} {...options} {...shared} />
        <Part slot="psu" part={build.psu ?? null} {...options} {...shared} />

        {empty.flatMap((slot) =>
          frames[slot].map((frame) => (
            <EmptySlot
              key={`${slot}:${frame.key}`}
              category={frame.category}
              matrix={frame.matrix}
              active={activeSlot === slot}
              onActivate={() => openSlot(slot)}
            />
          )),
        )}

        {ghost ? (
          <Ghost
            key={`${ghost.slot}:${ghost.id}`}
            slot={ghost.slot}
            id={ghost.id}
            caseModel={caseModel}
            boardModel={boardModel}
          />
        ) : null}
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={radius * 0.3}
        maxDistance={radius * 4}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.6}
        minAzimuthAngle={-Math.PI * 0.45}
        maxAzimuthAngle={Math.PI * 0.45}
      />
      <CameraRig
        boxes={boxes}
        activeSlot={activeSlot}
        idsKey={idsKey}
        lowDetail={lowDetail}
        reduced={reducedMotion}
        minDistance={radius * 0.3}
        maxDistance={radius * 4}
        resetRef={resetRef}
      />
    </>
  );
}
