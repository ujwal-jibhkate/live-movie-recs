/**
 * De-risk spike + sanity check (headless, Node.js).
 *
 * Confirms onnxruntime-web's WASM backend -- the exact runtime used in the
 * browser -- can load both exported models and run them on real catalog
 * embeddings. Unlike the sibling fraud-model demo (which ships precomputed
 * expected scores to diff against, since its transactions are frozen), this
 * demo's inputs are whatever the user picks live, so there's no fixed
 * "expected" output to compare here -- the PyTorch-vs-ONNX numerical parity
 * check already ran in the ML repo (Dynamic-Embedding-RecSys/scripts/export_onnx.py)
 * before these files were copied over. What this script verifies instead:
 *   1. Both models load and run in the same WASM backend the browser uses.
 *   2. UserUpdateFFN is deterministic (same input -> same output twice).
 *   3. TwoTowerModel's outputs are actually L2-normalized (a real invariant
 *      of the exported graph, checkable without a ground-truth reference).
 *
 * Run:  node scripts/verify_onnx.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as ort from "onnxruntime-web";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIM = 512;

ort.env.wasm.wasmPaths = join(ROOT, "node_modules/onnxruntime-web/dist/");
ort.env.wasm.numThreads = 1;

function assert(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`  OK  ${msg}`);
}

function l2norm(arr, offset, len) {
  let sum = 0;
  for (let i = 0; i < len; i++) sum += arr[offset + i] ** 2;
  return Math.sqrt(sum);
}

async function loadCatalogSample(n) {
  const embeddingsBuf = await readFile(join(ROOT, "public/data/embeddings.f32"));
  const movies = JSON.parse(await readFile(join(ROOT, "public/data/movies.json"), "utf8"));
  const embeddings = new Float32Array(
    embeddingsBuf.buffer,
    embeddingsBuf.byteOffset,
    embeddingsBuf.length / 4,
  );
  console.log(`Catalog: ${movies.length} movies, ${embeddings.length / DIM} embedding rows`);
  return { embeddings, movies: movies.slice(0, n) };
}

async function verifyUserUpdateFfn(embeddings) {
  console.log("\n[UserUpdateFFN]");
  const modelBytes = await readFile(join(ROOT, "public/model/user_update_ffn.onnx"));
  console.log(`Loaded model: ${(modelBytes.length / 1e6).toFixed(1)} MB`);
  const session = await ort.InferenceSession.create(modelBytes, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  const prev = embeddings.subarray(0, DIM);
  const next = embeddings.subarray(DIM, DIM * 2);
  const run = async () => {
    const out = await session.run({
      prev_user_emb: new ort.Tensor("float32", prev, [1, DIM]),
      new_item_emb: new ort.Tensor("float32", next, [1, DIM]),
    });
    return out.updated_user_emb.data;
  };

  const a = await run();
  const b = await run();
  assert(a.length === DIM, `output length ${a.length} === ${DIM}`);
  assert([...a].every(Number.isFinite), "all outputs finite (no NaN/Inf)");
  assert(a.every((v, i) => v === b[i]), "deterministic across repeated calls");
}

async function verifyTwoTower(embeddings, catalogSize) {
  console.log("\n[TwoTowerModel]");
  const modelBytes = await readFile(join(ROOT, "public/model/two_tower_model.onnx"));
  console.log(`Loaded model: ${(modelBytes.length / 1e6).toFixed(1)} MB`);
  const session = await ort.InferenceSession.create(modelBytes, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  const userVec = embeddings.subarray(0, DIM);
  const itemVecs = embeddings.subarray(0, DIM * catalogSize);

  const out = await session.run({
    user_vecs: new ort.Tensor("float32", userVec, [1, DIM]),
    item_vecs: new ort.Tensor("float32", itemVecs, [catalogSize, DIM]),
  });

  const userLatent = out.user_latent.data;
  const itemLatent = out.item_latent.data;
  assert(userLatent.length === 128, `user_latent length ${userLatent.length} === 128`);
  assert(itemLatent.length === 128 * catalogSize, `item_latent length === 128 x ${catalogSize}`);

  const userNorm = l2norm(userLatent, 0, 128);
  assert(Math.abs(userNorm - 1) < 1e-4, `user_latent is L2-normalized (norm=${userNorm.toFixed(6)})`);

  let maxItemNormErr = 0;
  for (let i = 0; i < catalogSize; i++) {
    const n = l2norm(itemLatent, i * 128, 128);
    maxItemNormErr = Math.max(maxItemNormErr, Math.abs(n - 1));
  }
  assert(maxItemNormErr < 1e-4, `all ${catalogSize} item_latents L2-normalized (max err=${maxItemNormErr.toExponential(2)})`);
}

async function main() {
  const { embeddings, movies } = await loadCatalogSample(50);
  await verifyUserUpdateFfn(embeddings);
  await verifyTwoTower(embeddings, movies.length);
  console.log("\nPASS: both models run correctly in onnxruntime-web (WASM).");
}

main().catch((err) => {
  console.error("\nSPIKE FAILED:", err);
  process.exit(1);
});
