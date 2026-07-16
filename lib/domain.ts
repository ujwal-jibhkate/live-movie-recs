import type { Movie } from "./types";

/** Minimum picks before we show recommendations — matches the notebook's warm-start idea. */
export const MIN_SEED_MOVIES = 3;

/** Candidate pool size handed from retrieval to MMR re-ranking. */
export const RETRIEVAL_TOP_N = 60;

/** Final recommendation list length. */
export const RECOMMENDATION_COUNT = 10;

/** README's own empirically-chosen sweet spot between relevance and diversity. */
export const DEFAULT_MMR_LAMBDA = 0.5;

export function primaryGenre(movie: Movie): string {
  return movie.genres[0] ?? "Uncategorized";
}
