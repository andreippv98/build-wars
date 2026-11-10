import type { Object3D } from "three";

/**
 * Loads `.glb` files in the browser. Files are fetched once per URL and cached; every caller
 * gets its own clone, so the same model can sit in the scene twice (two RAM sticks).
 * Compression: Meshopt (what `models:import` produces). three's loaders are imported lazily so
 * they stay out of the bundle until a real model is needed.
 */

const cache = new Map<string, Promise<Object3D>>();

async function fetchGlb(url: string): Promise<Object3D> {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

/** Resolves to a fresh clone of the model. Rejects if the file cannot be loaded or parsed. */
export async function loadGlb(url: string): Promise<Object3D> {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetchGlb(url);
    cache.set(url, pending);
    // A failed load must not poison the cache: the next attempt retries.
    pending.catch(() => cache.delete(url));
  }
  const original = await pending;
  return original.clone(true);
}
