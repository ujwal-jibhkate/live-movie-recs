# Live Taste Engine — A Recommender That Learns in Your Browser

An interactive, **static** web app that teaches how a dynamic-embedding recommender
system works, using **real trained models that run live in your browser**. Pick a
few movies you like and watch a real neural network rebuild your taste profile —
and a second network re-rank the whole catalog against it — after every pick, with
no backend involved.

- **Live model inference in the browser** via [onnxruntime-web](https://onnxruntime.ai/docs/tutorials/web/) (WebAssembly). No server, no API calls.
- Unlike a typical "one live node" demo, almost the **entire pipeline is live** here — cold-start averaging, the taste-update network, the two-tower projection, retrieval, and MMR re-ranking all run in this tab. Only the movie catalog's embeddings are precomputed, because the models that produce them (CLIP + Sentence-BERT + a fusion network) are far too large to run in a browser.
- Deploys to Vercel's free tier as a pure static export. No server, no database, no secrets.

> This front-end **presents** models trained in a separate ML repo
> (`Dynamic-Embedding-RecSys`). It does not train anything. The artifacts it
> consumes (two `.onnx` models + a frozen movie catalog) are the source of truth.

---

## The models & data (source of truth)

- **Catalog:** 400 movies sampled from a 44,600-movie [Hugging Face dataset](https://huggingface.co/datasets/ujwal-jibhkate/enriched-movie-dataset-with-multimodal-embeddings), filtered to titles with real posters and reasonable vote counts, stratified across genres.
- **Content embeddings:** a fixed 512-d "Digital DNA" vector per movie, fusing CLIP (poster) and Sentence-BERT (plot/cast/crew) embeddings — precomputed offline, shipped as a flat binary file.
- **UserUpdateFFN** (3.5MB): a residual FFN that takes your previous taste vector plus a newly-picked movie's embedding and outputs your updated taste vector. This is the demo's live centerpiece.
- **TwoTowerModel** (1.3MB): projects users and movies into a shared 128-d latent space via separate towers, L2-normalized so a dot product is cosine similarity. Both towers run live — the item tower runs once per taste update, batched over the whole catalog.
- **MMR re-ranking:** a real greedy Maximal Marginal Relevance loop trading off relevance against diversity, exactly as swept in the original notebook (λ=0.5 is that sweep's own sweet spot).

### Cold start
Your taste vector starts as the plain average of your first 3 picks' embeddings
(the notebook's "warm start" idea, done live in JS). Every pick after that runs one
live `UserUpdateFFN` call instead.

---

## What's live vs. what's precomputed (the honest bit)

| Stage | Live? | What actually happens here |
|---|---|---|
| Movie catalog & embeddings | No | Frozen, sampled from a 44.6k-movie dataset. The 512-d embedding itself can't be computed in a browser — CLIP + Sentence-BERT + a fusion network are hundreds of MB of transformer weights. |
| Cold-start init | ✅ **LIVE** | Plain vector average over your picks' embeddings, computed in JS. |
| Taste update (UserUpdateFFN) | ✅ **LIVE** | Re-runs on every pick or removal — a real 3.5MB model, via ONNX + WebAssembly. |
| Two-Tower projection | ✅ **LIVE** | Both towers run on every update, batched over the user AND the entire sampled catalog — nothing here is precomputed either. |
| Retrieval (cosine top-N) | ✅ **LIVE** | Exact search over 400 candidates, plain JavaScript. |
| MMR re-ranking | ✅ **LIVE** | Real greedy MMR loop; the λ slider re-runs it instantly. |
| Embedding-space layout | No | PCA fit offline on the full 44.6k catalog for a stable, meaningful layout. Your taste point's position inside that fixed space is live. |

Rendered in-app as the honesty table at the bottom of the page (`components/HonestyTable.tsx`).

---

## How live in-browser inference works

Same approach as the sibling fraud-model demo (`live-fraud-model.vercel.app`), extended to
two models instead of one. Both models here are plain `Linear`/`ReLU` MLPs, exported
directly with `torch.onnx.export` — a much lower-risk export than a LightGBM
TreeEnsemble, since Linear/ReLU/Concat/Add are about as standard as ONNX ops get.

Key implementation details (`lib/onnx.ts`):

1. **WASM-only build.** `onnxruntime-web/wasm`, not the default entry — avoids the ~26MB WebGPU/JSEP runtime.
2. **Self-hosted runtime.** `.wasm`/`.mjs` files copied into `public/ort/`; nothing fetched from a CDN.
3. **Single-threaded** (`numThreads = 1`). Avoids needing COOP/COEP headers for SharedArrayBuffer, which are awkward on static hosting.
4. **Client-only.** `lib/onnx.ts` is only ever touched from browser code paths, so the static export's prerender never runs it without a DOM.
5. **Two-Tower is called with the whole catalog every time**, not just the user vector — since item embeddings are precomputed but item *latents* aren't, and batching 400 rows through two small Linear layers is cheap enough (single-digit ms) that caching them would only make the demo less honest for no real speed benefit.

### The taste vector
`lib/useDataset.ts` fetches `public/data/embeddings.f32` — a flat `Float32Array`,
row *i* = `movies.json[i]`'s 512-d content embedding — and `pca.json`, which lets
`lib/pca.ts` project any live 512-d vector into the same fixed 2D space as the
precomputed catalog scatter. `app/page.tsx` owns the taste-profile state machine: the
first 3 picks average live in JS; everything after that is a live `UserUpdateFFN`
call chained onto the previous result. Removing a pick has no "undo" in the model, so
it replays the whole sequence from scratch — still all live calls, just several of them.

---

## Architecture

```
app/
  layout.tsx          Root layout, fonts, no-flash theme script (dark "screening room" default)
  page.tsx             Client orchestrator: taste-profile state machine, live scoring, layout
  globals.css          Tailwind v4 + design tokens (screening-room dark / lobby light)
components/
  pipeline/PipelineFlow.tsx   React Flow "reel path": the 7-stage teaching centerpiece
  nodes/StageNode.tsx         Custom node w/ "prod / demo" caption
  MoviePicker.tsx              Searchable/filterable catalog grid
  SelectedTaste.tsx            Picks as chips, live latency readouts
  EmbeddingSpace.tsx           Canvas scatter: the signature visual — live taste point + trail
  MMRSlider.tsx                λ control, re-ranks instantly (no model call)
  RecommendationList.tsx  MovieCard.tsx  HonestyTable.tsx  ThemeToggle.tsx
lib/
  onnx.ts             Live ONNX inference for both models (client-only, WASM)
  useInference.ts      React hook wrapping onnx.ts (status, latency, calls)
  useDataset.ts        Fetches movies.json / embeddings.f32 / pca.json at runtime
  retrieval.ts         Cosine top-N + MMR (pure TS, no model)
  pca.ts               Projects a live embedding into the precomputed 2D space
  genreColors.ts        Categorical palette for the constellation (dataviz-skill validated)
  types.ts  domain.ts  format.ts  useTheme.ts
public/
  model/user_update_ffn.onnx   two_tower_model.onnx
  data/movies.json  embeddings.f32  pca.json
  posters/*.webp                400 poster thumbnails
  ort/ort-wasm-simd-threaded.*  self-hosted onnxruntime-web WASM runtime
scripts/
  verify_onnx.mjs      Headless sanity check (run with `npm run verify`)
```

---

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to ./out
npm run verify     # headless: confirm both ONNX models run correctly in onnxruntime-web
npm run lint
```

`npm run build` produces a fully static `./out` (~44MB, mostly the WASM runtime and
posters) you can host anywhere. On Vercel, just import the repo — it detects Next.js
and serves the static export. No env vars, no functions.

## Regenerating the demo data

The generator scripts live in the ML repo (`Dynamic-Embedding-RecSys`), not here:

- `scripts/export_onnx.py` — re-exports `user_update_ffn.onnx` / `two_tower_model.onnx` from the trained `.pth` checkpoints, with a PyTorch-vs-ONNX parity check.
- `scripts/build_demo_dataset.py` — resamples the catalog from the [HF dataset](https://huggingface.co/datasets/ujwal-jibhkate/enriched-movie-dataset-with-multimodal-embeddings), refits the PCA projection, re-extracts posters.

Copy the outputs into `public/model/`, `public/data/`, and `public/posters/`, then run
`npm run verify`. Nothing else in this repo needs to change — `lib/types.ts` is the schema contract.

---

## Tech stack

Next.js (App Router, TypeScript, static export) · Tailwind CSS v4 ·
`@xyflow/react` (React Flow) · `onnxruntime-web` (WASM). Portfolio / educational demo.
