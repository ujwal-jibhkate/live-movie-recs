/**
 * Pure-JS retrieval + re-ranking. Both stages are genuinely live — no model
 * weights involved, just linear algebra over the (also live) Two-Tower latents.
 * Mirrors notebooks/3_Recommendation_&_Ranking.ipynb's `rerank_with_mmr`.
 */
import { LATENT_DIM } from "./types";

/** Slice out item i's 128-d latent from a flat [N × 128] array. */
export function latentFor(latents: Float32Array, index: number): Float32Array {
  const start = index * LATENT_DIM;
  return latents.subarray(start, start + LATENT_DIM);
}

/** Dot product. Two-Tower latents are already L2-normalized, so this equals cosine similarity. */
export function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export interface Candidate {
  index: number;
  relevance: number;
}

/**
 * Stage: Retrieval. Scores every catalog item against the user latent and
 * returns the top `topN` by relevance (plain cosine similarity, since both
 * sides are L2-normalized outputs of the live Two-Tower call).
 */
export function retrieveTopN(
  userLatent: Float32Array,
  itemLatents: Float32Array,
  itemCount: number,
  excludeIndices: Set<number>,
  topN: number,
): Candidate[] {
  const scored: Candidate[] = [];
  for (let i = 0; i < itemCount; i++) {
    if (excludeIndices.has(i)) continue;
    const relevance = dot(userLatent, latentFor(itemLatents, i));
    scored.push({ index: i, relevance });
  }
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, topN);
}

export interface MmrOptions {
  k: number;
  /** λ: relevance weight. 1-λ is the diversity weight. 0.5 is the README's own sweet spot. */
  lambda: number;
}

export interface RankedRecommendation {
  index: number;
  relevance: number;
  /** Final MMR score used to pick this item (relevance and diversity blended). */
  mmrScore: number;
}

/**
 * Stage: MMR re-ranking. Greedily picks `k` items from `candidates`, each time
 * trading off relevance to the user against similarity to what's already been
 * picked, so the final list isn't monotonous. Re-run this alone (candidates and
 * itemLatents unchanged) when only λ moves — that's what makes the λ slider instant.
 */
export function mmrRerank(
  candidates: Candidate[],
  itemLatents: Float32Array,
  { k, lambda }: MmrOptions,
): RankedRecommendation[] {
  const remaining = [...candidates];
  const selected: RankedRecommendation[] = [];

  while (selected.length < k && remaining.length > 0) {
    let bestPos = -1;
    let bestScore = -Infinity;

    for (let pos = 0; pos < remaining.length; pos++) {
      const cand = remaining[pos];
      const candLatent = latentFor(itemLatents, cand.index);

      let maxSimToSelected = 0;
      for (const s of selected) {
        const sim = dot(candLatent, latentFor(itemLatents, s.index));
        if (sim > maxSimToSelected) maxSimToSelected = sim;
      }
      const diversity = 1 - maxSimToSelected;
      const mmrScore = lambda * cand.relevance + (1 - lambda) * diversity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestPos = pos;
      }
    }

    const [picked] = remaining.splice(bestPos, 1);
    selected.push({ index: picked.index, relevance: picked.relevance, mmrScore: bestScore });
  }

  return selected;
}

/** Plain vector average — the cold-start init (notebook 2's warm-start). */
export function averageEmbeddings(embeddings: Float32Array[]): Float32Array {
  const dim = embeddings[0].length;
  const out = new Float32Array(dim);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) out[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) out[i] /= embeddings.length;
  return out;
}
