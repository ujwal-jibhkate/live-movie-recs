/**
 * Live in-browser ONNX inference for the two small recommendation models.
 *
 * This module is CLIENT-ONLY. onnxruntime-web touches browser APIs (WebAssembly,
 * fetch, workers), so it must never be imported during SSR. Consumers import it
 * lazily from a `'use client'` component / hook.
 *
 * Same WASM setup as the sibling fraud-model demo (live-fraud-model.vercel.app):
 * self-hosted, WASM-only, single-threaded (no COOP/COEP needed on static hosting).
 * Both models here are plain Linear/ReLU MLPs, so the op-support risk that mattered
 * for a LightGBM TreeEnsemble export doesn't apply — these are about as standard as
 * ONNX graphs get.
 */
import type * as OrtNS from "onnxruntime-web";
import { CONTENT_EMBEDDING_DIM, LATENT_DIM } from "./types";

const USER_UPDATE_MODEL_URL = "/model/user_update_ffn.onnx";
const TWO_TOWER_MODEL_URL = "/model/two_tower_model.onnx";

let ortModule: typeof OrtNS | null = null;
let userUpdateSessionPromise: Promise<OrtNS.InferenceSession> | null = null;
let twoTowerSessionPromise: Promise<OrtNS.InferenceSession> | null = null;

async function loadOrt(): Promise<typeof OrtNS> {
  if (ortModule) return ortModule;
  // WASM-only build: avoids pulling in the ~26MB WebGPU/JSEP runtime.
  const ort = await import("onnxruntime-web/wasm");
  ort.env.wasm.wasmPaths = "/ort/";
  ort.env.wasm.numThreads = 1;
  ortModule = ort;
  return ort;
}

/** Warm up both model sessions. Call once on mount so the first real inference is fast. */
export function getSessions(): Promise<{
  userUpdate: OrtNS.InferenceSession;
  twoTower: OrtNS.InferenceSession;
}> {
  if (!userUpdateSessionPromise) {
    userUpdateSessionPromise = (async () => {
      const ort = await loadOrt();
      return ort.InferenceSession.create(USER_UPDATE_MODEL_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    })();
  }
  if (!twoTowerSessionPromise) {
    twoTowerSessionPromise = (async () => {
      const ort = await loadOrt();
      return ort.InferenceSession.create(TWO_TOWER_MODEL_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    })();
  }
  return Promise.all([userUpdateSessionPromise, twoTowerSessionPromise]).then(
    ([userUpdate, twoTower]) => ({ userUpdate, twoTower }),
  );
}

export interface UserUpdateResult {
  /** The updated 512-d taste vector. */
  updatedEmb: Float32Array;
  latencyMs: number;
}

/**
 * Runs UserUpdateFFN live: prevUserEmb + newItemEmb -> updatedUserEmb.
 * This is the demo's live centerpiece — re-run on every movie pick/unpick.
 */
export async function runUserUpdate(
  prevUserEmb: Float32Array,
  newItemEmb: Float32Array,
): Promise<UserUpdateResult> {
  const ort = await loadOrt();
  const { userUpdate } = await getSessions();

  const prevTensor = new ort.Tensor("float32", prevUserEmb, [1, CONTENT_EMBEDDING_DIM]);
  const newTensor = new ort.Tensor("float32", newItemEmb, [1, CONTENT_EMBEDDING_DIM]);

  const t0 = performance.now();
  const outputs = await userUpdate.run({
    prev_user_emb: prevTensor,
    new_item_emb: newTensor,
  });
  const latencyMs = performance.now() - t0;

  const updatedEmb = outputs.updated_user_emb.data as Float32Array;
  return { updatedEmb, latencyMs };
}

export interface TwoTowerResult {
  /** L2-normalized 128-d user latent. */
  userLatent: Float32Array;
  /** L2-normalized 128-d item latents, flat [N × 128], row i = catalog[i]. */
  itemLatents: Float32Array;
  latencyMs: number;
}

/**
 * Runs the Two-Tower model live: projects the user embedding AND the whole
 * catalog's item embeddings into the shared 128-d latent space in one batched
 * call. Cheap enough (two small Linear layers, N≈400) to re-run on every taste
 * update rather than caching item latents — so nothing here is precomputed.
 */
export async function runTwoTower(
  userEmb: Float32Array,
  catalogEmbeddings: Float32Array,
): Promise<TwoTowerResult> {
  const ort = await loadOrt();
  const { twoTower } = await getSessions();

  const itemCount = catalogEmbeddings.length / CONTENT_EMBEDDING_DIM;
  const userTensor = new ort.Tensor("float32", userEmb, [1, CONTENT_EMBEDDING_DIM]);
  const itemTensor = new ort.Tensor("float32", catalogEmbeddings, [
    itemCount,
    CONTENT_EMBEDDING_DIM,
  ]);

  const t0 = performance.now();
  const outputs = await twoTower.run({
    user_vecs: userTensor,
    item_vecs: itemTensor,
  });
  const latencyMs = performance.now() - t0;

  return {
    userLatent: outputs.user_latent.data as Float32Array,
    itemLatents: outputs.item_latent.data as Float32Array,
    latencyMs,
  };
}

export { CONTENT_EMBEDDING_DIM, LATENT_DIM };
