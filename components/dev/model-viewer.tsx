"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Box3,
  Box3Helper,
  Matrix4,
  Mesh,
  CanvasTexture,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Object3D,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three/examples/jsm/controls/OrbitControls.js";
import type { SlotPart } from "@/lib/build";
import { buildCaseModel, buildMotherboardModel } from "@/lib/models/parametric";
import { placeInCase, ramSlotCount, ramSlotNumbers } from "@/lib/models/assemble";
import { modelBounds, nodeMatrix, snapToSlot } from "@/lib/models/snap";
import { ATTACHMENT, NODES, REQUIRED_NODES } from "@/lib/models/standard";
import type { BuildSlot, ModelCategory } from "@/lib/schemas";
import type { GlbState } from "./glb";

export type ViewMode = "alone" | "case";

export type ViewerProps = {
  category: ModelCategory;
  slot: BuildSlot | null;
  part: SlotPart[BuildSlot] | null;
  view: ViewMode;
  /** The loaded model, already scaled when `scale_to_data` is on. */
  model: Object3D | null;
  /** The parametric model of the chosen part (the case for category `case`). */
  parametric: Object3D | null;
  showParametric: boolean;
  showPoints: boolean;
  wireframe: boolean;
  glb: GlbState;
  url: string | null;
};

const GAP_MM = 20;
const FOV = 40;
const GHOST_OPACITY = 0.4;
const MODEL_LABEL = "#5eead4";
const SLOT_LABEL = "#fcd34d";
const LABEL_HEIGHT = 0.01;

/** Bounds of a model as drawn: its geometry with its own root scale applied. */
function drawnBounds(object: Object3D): Box3 {
  const box = modelBounds(object);
  object.updateMatrix();
  return box.applyMatrix4(object.matrix);
}

/** A translucent copy of a model, for drawing the parametric version over a real one. */
function useGhost(source: Object3D | null, enabled: boolean): Object3D | null {
  const ghost = useMemo(() => {
    if (!source || !enabled) return null;
    const copy = source.clone(true);
    copy.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const swap = (material: Material) => {
        const clone = material.clone();
        clone.transparent = true;
        clone.opacity = Math.min(clone.opacity, GHOST_OPACITY);
        clone.depthWrite = false;
        return clone;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    return copy;
  }, [source, enabled]);
  useEffect(
    () => () => {
      ghost?.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          material.dispose();
      });
    },
    [ghost],
  );
  return ghost;
}

/** Applies the wireframe switch to every material of a model. */
function useWireframe(model: Object3D | null, wireframe: boolean) {
  useEffect(() => {
    if (!model) return;
    model.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        (material as Material & { wireframe?: boolean }).wireframe = wireframe;
      }
    });
  }, [model, wireframe]);
}

/** Names of the nodes drawn as attachment points on a model of `category`. */
function isModelPoint(name: string, category: ModelCategory): boolean {
  if (REQUIRED_NODES[category].includes(name)) return true;
  if (category !== "case" && category !== "fan" && ATTACHMENT[category].mount === name) return true;
  return /^fan_\d+$/.test(name) || name === NODES.labelArea || name.startsWith(NODES.rgbPrefix);
}

/** Slot nodes of the case and of the board. */
function isSlotPoint(name: string): boolean {
  return (
    REQUIRED_NODES.case.includes(name) ||
    REQUIRED_NODES.motherboard.includes(name) ||
    /^slot_ram_\d+$/.test(name)
  );
}

/** A screen-sized text label as a sprite (no DOM overlay, so nothing to keep in sync). */
function PointLabel({ text, color }: { text: string; color: string }) {
  const label = useMemo(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const font = "28px ui-monospace, Menlo, monospace";
    const pad = 8;
    if (!context) return null;
    context.font = font;
    canvas.width = Math.ceil(context.measureText(text).width) + pad * 2;
    canvas.height = 40;
    context.font = font;
    context.fillStyle = "rgba(0,0,0,0.75)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.textBaseline = "middle";
    context.fillText(text, pad, canvas.height / 2 + 2);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { texture, aspect: canvas.width / canvas.height };
  }, [text, color]);
  useEffect(() => () => label?.texture.dispose(), [label]);
  if (!label) return null;
  return (
    <sprite
      center={[0, 0]}
      scale={[LABEL_HEIGHT * label.aspect, LABEL_HEIGHT, 1]}
      renderOrder={999}
    >
      <spriteMaterial map={label.texture} sizeAttenuation={false} depthTest={false} transparent />
    </sprite>
  );
}

type Point = { name: string; position: Vector3; quaternion: Quaternion };

/**
 * Small axes and a label at each matching node of `root`. `transform` is where the root's parent
 * sits in the scene; the root's own transform (its `scale_to_data` scale) is applied on top.
 */
function Markers({
  root,
  transform,
  match,
  labelColor,
}: {
  root: Object3D;
  transform: Matrix4;
  match: (name: string) => boolean;
  labelColor: string;
}) {
  const points = useMemo(() => {
    const found: Point[] = [];
    root.traverse((object) => {
      if (object === root || !object.name || !match(object.name)) return;
      root.updateMatrix();
      const matrix = new Matrix4()
        .multiplyMatrices(transform, root.matrix)
        .multiply(nodeMatrix(root, object));
      const point: Point = {
        name: object.name,
        position: new Vector3(),
        quaternion: new Quaternion(),
      };
      matrix.decompose(point.position, point.quaternion, new Vector3());
      found.push(point);
    });
    return found;
  }, [root, transform, match]);
  return (
    <>
      {points.map((point, i) => (
        <group key={`${point.name}-${i}`} position={point.position} quaternion={point.quaternion}>
          <axesHelper args={[12]} renderOrder={998} material-depthTest={false} />
          <PointLabel text={point.name} color={labelColor} />
        </group>
      ))}
    </>
  );
}

function Placed({ matrix, children }: { matrix: Matrix4; children: React.ReactNode }) {
  const [position, quaternion, scale] = useMemo(() => {
    const p = new Vector3();
    const q = new Quaternion();
    const s = new Vector3();
    matrix.decompose(p, q, s);
    return [p, q, s] as const;
  }, [matrix]);
  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      {children}
    </group>
  );
}

function BoxOutline({ box, color }: { box: Box3; color: string }) {
  const helper = useMemo(() => new Box3Helper(box, color), [box, color]);
  return <primitive object={helper} />;
}

type Fit = { center: Vector3; size: Vector3 };

/** Points the camera at `fit` whenever `fitKey` changes. */
function CameraRig({ fit, fitKey }: { fit: Fit; fitKey: string }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const viewport = useThree((state) => state.size);
  const latest = useRef(fit);
  useEffect(() => {
    latest.current = fit;
  });
  useEffect(() => {
    const { center, size } = latest.current;
    const aspect = viewport.width / Math.max(viewport.height, 1);
    // Distance at which the front face fits the view, plus half the depth.
    const half = Math.max(size.x / aspect, size.y, 20) / 2;
    const distance = (half / Math.tan((FOV * Math.PI) / 360)) * 1.15 + size.z / 2;
    camera.position.set(center.x, center.y, center.z + distance);
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
    // The view is refitted when `fitKey` changes, not on every resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, camera, controls]);
  return null;
}

function AloneScene({ props }: { props: ViewerProps }) {
  const { category, model, parametric, showParametric, showPoints, glb } = props;
  const ghost = useGhost(parametric, showParametric);
  const identity = useMemo(() => new Matrix4(), []);
  const matchModel = useMemo(() => (name: string) => isModelPoint(name, category), [category]);

  const modelBox = useMemo(() => (model ? drawnBounds(model) : null), [model]);
  const ghostBox = useMemo(() => (parametric ? drawnBounds(parametric) : null), [parametric]);
  // Parametric version above the model, never overlapping it.
  const offset = modelBox && ghostBox ? modelBox.max.y - ghostBox.min.y + GAP_MM : 0;

  const fit = useMemo<Fit>(() => {
    const all = new Box3();
    if (modelBox) all.union(modelBox);
    if (ghostBox && showParametric)
      all.union(ghostBox.clone().translate(new Vector3(0, offset, 0)));
    if (all.isEmpty()) all.set(new Vector3(-100, -100, 0), new Vector3(100, 100, 0));
    const size = all.getSize(new Vector3());
    return { center: all.getCenter(new Vector3()), size };
  }, [modelBox, ghostBox, showParametric, offset]);

  return (
    <>
      <CameraRig fit={fit} fitKey={`alone|${props.url}|${glb.status}|${category}`} />
      <gridHelper
        args={[2000, 200, "#4b5563", "#2a313b"]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.5]}
      />
      <axesHelper args={[60]} />
      {model && (
        <>
          <primitive object={model} />
          {modelBox && <BoxOutline box={modelBox} color="#2dd4bf" />}
          {showPoints && (
            <Markers
              root={model}
              transform={identity}
              match={matchModel}
              labelColor={MODEL_LABEL}
            />
          )}
        </>
      )}
      {ghost && showParametric && (
        <group position={[0, offset, 0]}>
          <primitive object={ghost} />
          {showPoints && (
            <Markers root={ghost} transform={identity} match={matchModel} labelColor="#a1a1aa" />
          )}
        </group>
      )}
    </>
  );
}

function CaseScene({ props }: { props: ViewerProps }) {
  const { category, slot, part, model, parametric, showParametric, showPoints, glb } = props;

  const parametricCase = useMemo(() => buildCaseModel(), []);
  const placeholderBoard = useMemo(() => buildMotherboardModel(null), []);

  const caseObject = category === "case" && model ? model : parametricCase;
  const boardObject = category === "motherboard" && model ? model : placeholderBoard;

  const boardMatrix = useMemo(
    () => placeInCase(caseObject, boardObject, "motherboard", boardObject),
    [caseObject, boardObject],
  );

  // Where the tested model sits, one transform per instance (RAM: one per stick).
  const placements = useMemo(() => {
    if (!model || category === "case" || category === "fan") return [];
    if (category === "motherboard") {
      return boardMatrix ? [{ key: 0, matrix: boardMatrix, object: model }] : [];
    }
    const sticks =
      category === "ram" && slot === "ram" && part
        ? ramSlotNumbers((part as SlotPart["ram"]).sticks, ramSlotCount(boardObject))
        : [null];
    return sticks.flatMap((n, i) => {
      const matrix = placeInCase(
        caseObject,
        boardObject,
        category,
        model,
        n === null ? undefined : NODES.slotRam(n),
      );
      // One object per stick: a three.js object can only sit in one place.
      return matrix ? [{ key: n ?? 0, matrix, object: i === 0 ? model : model.clone(true) }] : [];
    });
  }, [model, category, slot, part, caseObject, boardObject, boardMatrix]);

  // The parametric version, placed the same way, to compare against.
  const ghostSource = useGhost(parametric, showParametric && Boolean(model));
  const ghostPlacements = useMemo(() => {
    if (!ghostSource) return [];
    if (category === "case") return [{ key: 0, matrix: new Matrix4(), object: ghostSource }];
    if (category === "fan") return [];
    if (category === "motherboard") {
      const matrix = snapToSlot(caseObject, ATTACHMENT.motherboard.slot, ghostSource, null);
      return matrix ? [{ key: 0, matrix, object: ghostSource }] : [];
    }
    return placements.flatMap(({ key }, i) => {
      const object = i === 0 ? ghostSource : ghostSource.clone(true);
      const matrix = placeInCase(
        caseObject,
        boardObject,
        category,
        object,
        category === "ram" ? NODES.slotRam(key) : undefined,
      );
      return matrix ? [{ key, matrix, object }] : [];
    });
  }, [ghostSource, category, caseObject, boardObject, placements]);

  const caseBox = useMemo(() => modelBounds(caseObject), [caseObject]);
  const fit = useMemo<Fit>(() => {
    const size = caseBox.getSize(new Vector3());
    return {
      center: caseBox.getCenter(new Vector3()),
      size,
    };
  }, [caseBox]);

  const matchModel = useMemo(() => (name: string) => isModelPoint(name, category), [category]);
  const identity = useMemo(() => new Matrix4(), []);

  return (
    <>
      <CameraRig fit={fit} fitKey={`case|${props.url}|${glb.status}|${category}`} />
      <gridHelper args={[2000, 200, "#4b5563", "#2a313b"]} position={[200, -3, 100]} />
      <primitive object={caseObject} />
      {boardMatrix && (
        <Placed matrix={boardMatrix}>
          <primitive object={boardObject} />
        </Placed>
      )}
      {showPoints && (
        <>
          <Markers
            root={caseObject}
            transform={identity}
            match={isSlotPoint}
            labelColor={SLOT_LABEL}
          />
          {boardMatrix && category !== "motherboard" && (
            <Markers
              root={boardObject}
              transform={boardMatrix}
              match={isSlotPoint}
              labelColor={SLOT_LABEL}
            />
          )}
        </>
      )}
      {model && category === "case" && showPoints && (
        <Markers root={model} transform={identity} match={matchModel} labelColor={MODEL_LABEL} />
      )}
      {/* A tested motherboard is the board itself, drawn above. */}
      {model &&
        category !== "case" &&
        category !== "motherboard" &&
        placements.map(({ key, matrix, object }) => (
          <Placed key={key} matrix={matrix}>
            <primitive object={object} />
          </Placed>
        ))}
      {model &&
        showPoints &&
        category !== "case" &&
        placements.map(({ key, matrix, object }) => (
          <Markers
            key={key}
            root={object}
            transform={matrix}
            match={matchModel}
            labelColor={MODEL_LABEL}
          />
        ))}
      {ghostSource &&
        ghostPlacements.map(({ key, matrix, object }) => (
          <Placed key={key} matrix={matrix}>
            <primitive object={object} />
          </Placed>
        ))}
    </>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#dbe4ff", "#20242c", 0.6]} />
      <directionalLight position={[300, 500, 700]} intensity={2.2} />
      <directionalLight position={[-400, 200, 300]} intensity={0.9} color="#a5b4fc" />
      <directionalLight position={[0, -300, -500]} intensity={0.5} />
    </>
  );
}

/** The 3D view of the model test page: the model alone or inside the showcase case. */
export function ModelViewer(props: ViewerProps) {
  const { model, glb, url, view, category } = props;
  useWireframe(model, props.wireframe);
  const inCase = view === "case" && category !== "fan";

  return (
    <div className="relative h-full min-h-[360px] w-full" data-testid="model-viewer">
      <Canvas camera={{ position: [0, 0, 400], fov: FOV, near: 1, far: 100_000 }} dpr={[1, 2]}>
        <color attach="background" args={["#0b0d10"]} />
        <Lights />
        <OrbitControls makeDefault enableDamping={false} />
        {inCase ? <CaseScene props={props} /> : <AloneScene props={props} />}
      </Canvas>
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1 text-xs">
        {glb.status === "loading" && (
          <p className="rounded bg-black/70 px-2 py-1 text-zinc-200">Loading...</p>
        )}
        {glb.status === "failed" && (
          <p className="max-w-[60ch] rounded bg-red-950/80 px-2 py-1 text-red-200">
            Could not load {url}: {glb.error}
          </p>
        )}
        {glb.status === "none" && (
          <p className="rounded bg-black/70 px-2 py-1 text-zinc-300">
            No model selected; showing the parametric version only.
          </p>
        )}
        {view === "case" && category === "fan" && (
          <p className="rounded bg-black/70 px-2 py-1 text-zinc-300">
            Fans have no attachment point in the case; shown alone.
          </p>
        )}
      </div>
      <p className="pointer-events-none absolute top-3 right-3 rounded bg-black/70 px-2 py-1 font-mono text-xs text-zinc-300">
        model: <span data-testid="model-status">{glb.status}</span>
      </p>
    </div>
  );
}
