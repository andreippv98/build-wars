"use client";

import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { Vector3, type Object3D } from "three";
import type { SlotPart } from "@/lib/build";
import { placeInCase, ramSlotCount, ramSlotNumbers } from "@/lib/models/assemble";
import { buildCaseModel, buildMotherboardModel } from "@/lib/models/parametric";
import { modelBounds } from "@/lib/models/snap";
import { NODES, SLOT_CATEGORY } from "@/lib/models/standard";
import type { BuildSlot } from "@/lib/schemas";
import { useConfigurator } from "../configurator/configurator-provider";
import { PlacedPart } from "./placed-part";
import { usePartModel, type PartModel } from "./use-part-model";

/** Which model each filled slot is drawn with; reported to the page for tests and debugging. */
export type SceneStatus = Partial<Record<BuildSlot, PartModel["source"]>>;

type SceneOptions = {
  lowDetail: boolean;
  /** Called when a slot's model source changes; null when the slot empties. */
  onStatus?: (slot: BuildSlot, source: PartModel["source"] | null) => void;
};

/** A chosen part: resolves its model and draws it on its slot. RAM is drawn once per stick. */
function Part<S extends BuildSlot>({
  slot,
  part,
  caseModel,
  boardModel,
  lowDetail,
  onStatus,
}: {
  slot: S;
  part: SlotPart[S];
  caseModel: Object3D;
  boardModel: Object3D;
} & SceneOptions) {
  const { models } = useConfigurator();
  const model = usePartModel(slot, part, models, { lowDetail });
  const object = model?.object;
  const source = model?.source ?? null;
  useEffect(() => {
    onStatus?.(slot, source);
    return () => onStatus?.(slot, null);
  }, [onStatus, slot, source]);

  const placements = useMemo(() => {
    if (!object) return [];
    const category = SLOT_CATEGORY[slot];
    if (category === "case" || category === "fan") return [];
    if (slot === "ram") {
      const sticks = (part as SlotPart["ram"]).sticks;
      return ramSlotNumbers(sticks, ramSlotCount(boardModel)).flatMap((n) => {
        const stick = object.clone(true);
        const matrix = placeInCase(caseModel, boardModel, "ram", stick, NODES.slotRam(n));
        return matrix ? [{ key: `ram-${n}`, object: stick, matrix }] : [];
      });
    }
    const matrix = placeInCase(caseModel, boardModel, category, object);
    return matrix ? [{ key: slot, object, matrix }] : [];
  }, [slot, part, object, caseModel, boardModel]);

  return (
    <>
      {placements.map((p) => (
        <PlacedPart key={p.key} slot={slot} object={p.object} matrix={p.matrix} />
      ))}
    </>
  );
}

/**
 * Everything inside the canvas: lights, the showcase case and the chosen parts, each placed by
 * the attachment nodes of its parent model. No product-specific geometry or coordinates here.
 */
export function BuildScene({ lowDetail, onStatus }: SceneOptions) {
  const { build, models } = useConfigurator();

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
  const boardMatrix = useMemo(
    () => placeInCase(caseModel, boardModel, "motherboard", boardModel),
    [caseModel, boardModel],
  );

  // Centre the case on the origin so the camera orbits its middle.
  const { centre, radius } = useMemo(() => {
    const bounds = modelBounds(caseModel);
    return {
      centre: bounds.getCenter(new Vector3()),
      radius: bounds.getSize(new Vector3()).length() / 2,
    };
  }, [caseModel]);

  const shared = { caseModel, boardModel, lowDetail, onStatus };

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
        {boardMatrix ? (
          <PlacedPart
            key={boardModel.uuid}
            slot="motherboard"
            object={boardModel}
            matrix={boardMatrix}
          />
        ) : null}
        {build.cpu ? <Part slot="cpu" part={build.cpu} {...shared} /> : null}
        {build.ram ? <Part slot="ram" part={build.ram} {...shared} /> : null}
        {build.gpu ? <Part slot="gpu" part={build.gpu} {...shared} /> : null}
        {build.psu ? <Part slot="psu" part={build.psu} {...shared} /> : null}
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={radius * 1.1}
        maxDistance={radius * 4}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.6}
        minAzimuthAngle={-Math.PI * 0.45}
        maxAzimuthAngle={Math.PI * 0.45}
      />
    </>
  );
}
