/** Schema for public/data/movies.json — matches scripts/build_demo_dataset.py exactly. */
export interface Movie {
  tmdbId: number;
  title: string;
  genres: string[];
  director: string[];
  cast: string[];
  year: number | null;
  voteAverage: number | null;
  popularity: number | null;
  plot: string | null;
  /** Relative path under /posters/. */
  poster: string;
  /** [x, y, z] in the precomputed PCA(3) space fit on the full 44.6k catalog. */
  pca: [number, number, number];
}

/** public/data/pca.json — lets the browser project the live user embedding into
 * the same fixed 3D space as the precomputed movie scatter. */
export interface PcaTransform {
  /** 512-d mean vector subtracted before projection. */
  mean: number[];
  /** 3×512 component matrix; components[0..2] are the three axes. */
  components: [number[], number[], number[]];
}

/** The full dataset as loaded at runtime by useDataset. */
export interface Dataset {
  movies: Movie[];
  /** Row i (512 floats) = movies[i]'s content_embedding. Flat for cheap fetch/parse. */
  embeddings: Float32Array;
  pca: PcaTransform;
}

export const CONTENT_EMBEDDING_DIM = 512;
export const LATENT_DIM = 128;
