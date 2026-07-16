"use client";

import { useEffect, useState } from "react";
import type { Dataset, Movie, PcaTransform } from "./types";
import { CONTENT_EMBEDDING_DIM } from "./types";

export type DatasetStatus = "loading" | "ready" | "error";

export interface DatasetState {
  status: DatasetStatus;
  data: Dataset | null;
  error: string | null;
}

/** Fetches the frozen catalog (metadata + embeddings + PCA transform) once at runtime. */
export function useDataset(): DatasetState {
  const [state, setState] = useState<DatasetState>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [movies, embeddingsBuf, pca] = await Promise.all([
          fetch("/data/movies.json").then((r) => r.json() as Promise<Movie[]>),
          fetch("/data/embeddings.f32").then((r) => r.arrayBuffer()),
          fetch("/data/pca.json").then((r) => r.json() as Promise<PcaTransform>),
        ]);

        const embeddings = new Float32Array(embeddingsBuf);
        const expectedLength = movies.length * CONTENT_EMBEDDING_DIM;
        if (embeddings.length !== expectedLength) {
          throw new Error(
            `embeddings.f32 length ${embeddings.length} != expected ${expectedLength} (${movies.length} movies × ${CONTENT_EMBEDDING_DIM})`,
          );
        }

        if (cancelled) return;
        setState({ status: "ready", data: { movies, embeddings, pca }, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({ status: "error", data: null, error: String(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Slice out movie i's 512-d content embedding from the flat array. */
export function embeddingFor(embeddings: Float32Array, index: number): Float32Array {
  const start = index * CONTENT_EMBEDDING_DIM;
  return embeddings.subarray(start, start + CONTENT_EMBEDDING_DIM);
}
