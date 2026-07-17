"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MoviePicker } from "@/components/MoviePicker";
import { SelectedTaste } from "@/components/SelectedTaste";
import { PipelineFlow } from "@/components/pipeline/PipelineFlow";
import { EmbeddingSpace } from "@/components/EmbeddingSpace";
import { MMRSlider } from "@/components/MMRSlider";
import { RecommendationList } from "@/components/RecommendationList";
import { HonestyTable } from "@/components/HonestyTable";
import { useDataset, embeddingFor } from "@/lib/useDataset";
import { useInference } from "@/lib/useInference";
import { averageEmbeddings, mmrRerank, retrieveTopN, type Candidate } from "@/lib/retrieval";
import { projectToPca } from "@/lib/pca";
import {
  DEFAULT_MMR_LAMBDA,
  MIN_SEED_MOVIES,
  RECOMMENDATION_COUNT,
  RETRIEVAL_TOP_N,
} from "@/lib/domain";

export default function Home() {
  const { status: datasetStatus, data, error: datasetError } = useDataset();
  const inference = useInference();

  // Order matters: the first MIN_SEED_MOVIES picks form the cold-start
  // average (live JS); every pick after that runs one live UserUpdateFFN call.
  const [order, setOrder] = useState<number[]>([]);
  const [tasteHistory, setTasteHistory] = useState<Float32Array[]>([]);
  const [itemLatents, setItemLatents] = useState<Float32Array | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [lambda, setLambda] = useState(DEFAULT_MMR_LAMBDA);
  const [isComputing, setIsComputing] = useState(false);

  const recomputeId = useRef(0);

  const toggleMovie = useCallback((index: number) => {
    setOrder((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  }, []);

  // Rebuild the taste profile whenever the selection changes. Adds append one
  // live FFN call; removals replay the whole sequence from scratch (still all
  // live calls, just several of them) since the model has no notion of
  // "undo" — a live re-run beats faking a plausible-looking result.
  useEffect(() => {
    if (!data || inference.status !== "idle") return;
    const runId = ++recomputeId.current;

    (async () => {
      if (order.length === 0) {
        setTasteHistory([]);
        setItemLatents(null);
        setCandidates([]);
        return;
      }

      setIsComputing(true);
      const history: Float32Array[] = [];
      const seedCount = Math.min(order.length, MIN_SEED_MOVIES);

      const seedEmbs: Float32Array[] = [];
      for (let i = 0; i < seedCount; i++) {
        seedEmbs.push(embeddingFor(data.embeddings, order[i]));
        history.push(averageEmbeddings(seedEmbs));
      }
      let taste = history[history.length - 1];

      for (let i = seedCount; i < order.length; i++) {
        const newEmb = embeddingFor(data.embeddings, order[i]);
        const { updatedEmb } = await inference.updateTaste(taste, newEmb);
        if (runId !== recomputeId.current) return; // superseded by a newer selection change
        taste = updatedEmb;
        history.push(taste);
      }

      if (runId !== recomputeId.current) return;
      setTasteHistory(history);

      if (order.length >= MIN_SEED_MOVIES) {
        const { userLatent, itemLatents } = await inference.scoreCatalog(taste, data.embeddings);
        if (runId !== recomputeId.current) return;
        setItemLatents(itemLatents);
        const excluded = new Set(order);
        setCandidates(retrieveTopN(userLatent, itemLatents, data.movies.length, excluded, RETRIEVAL_TOP_N));
      } else {
        setItemLatents(null);
        setCandidates([]);
      }
      setIsComputing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, data, inference.status]);

  const recommendations = useMemo(() => {
    if (candidates.length === 0 || !itemLatents) return [];
    return mmrRerank(candidates, itemLatents, { k: RECOMMENDATION_COUNT, lambda });
  }, [candidates, itemLatents, lambda]);

  const trailPoints = useMemo(() => {
    if (!data) return [];
    return tasteHistory.map((emb) => projectToPca(emb, data.pca));
  }, [tasteHistory, data]);

  const tastePoint = trailPoints.length > 0 ? trailPoints[trailPoints.length - 1] : null;

  const picks = useMemo(() => {
    if (!data) return [];
    return order.map((index) => ({ movie: data.movies[index], index }));
  }, [order, data]);

  const selectedIndexSet = useMemo(() => new Set(order), [order]);

  if (datasetStatus === "error") {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <p className="text-sm text-taste">Failed to load the catalog: {datasetError}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-14 px-5 pb-24 pt-6 sm:px-8">
      <header className="flex items-center justify-between">
        <span className="eyebrow text-text-faint">Live Taste Engine</span>
        <ThemeToggle />
      </header>

      {/* Hero: the thesis, stated plainly. */}
      <section className="flex flex-col gap-4">
        <h1 className="marquee text-[13vw] text-text sm:text-6xl md:text-7xl">
          Your taste,
          <br />
          <span className="text-taste">live</span> in a neural net
        </h1>
        <p className="max-w-xl text-base text-text-muted">
          Pick a few movies you like below. A real network rebuilds your taste profile
          after every pick, right here, in this tab, with no server involved, and a
          second network re-ranks the whole catalog against it. Nothing is simulated;
          the honesty table at the bottom says exactly what is and isn&apos;t.
        </p>
        {datasetStatus === "loading" || inference.status === "loading-model" ? (
          <p className="eyebrow text-marquee">
            {datasetStatus === "loading" ? "loading catalog…" : "warming up the models…"}
          </p>
        ) : (
          <p className="eyebrow text-text-faint">
            {data?.movies.length} movies loaded · models ready
          </p>
        )}
      </section>

      {/* Picker + live taste state */}
      <section className="flex flex-col gap-5">
        <h2 className="marquee text-2xl text-text">Pick your movies</h2>
        {data && (
          <>
            <SelectedTaste
              picks={picks}
              onRemove={toggleMovie}
              ffnLatencyMs={inference.ffnLatencyMs}
              towerLatencyMs={inference.towerLatencyMs}
            />
            <MoviePicker movies={data.movies} selectedIndices={selectedIndexSet} onToggle={toggleMovie} />
          </>
        )}
      </section>

      {/* The pipeline, reskinned as a reel path */}
      {data && (
        <section className="flex flex-col gap-4">
          <h2 className="marquee text-2xl text-text">The pipeline</h2>
          <PipelineFlow
            catalogSize={data.movies.length}
            pickCount={order.length}
            ffnLatencyMs={inference.ffnLatencyMs}
            towerLatencyMs={inference.towerLatencyMs}
            candidateCount={candidates.length}
            lambda={lambda}
            recommendationCount={recommendations.length}
          />
        </section>
      )}

      {/* The embedding space: the signature visual */}
      {data && (
        <section className="flex flex-col gap-4">
          <h2 className="marquee text-2xl text-text">Where your taste lives</h2>
          <p className="max-w-2xl text-sm text-text-muted">
            Every dot is a movie, positioned by a real PCA projection of its 512-d
            embedding. The {tastePoint ? "glowing" : ""} coral point is you, click any
            star to add or remove it from your picks.
          </p>
          <EmbeddingSpace
            movies={data.movies}
            tastePoint={tastePoint}
            trail={trailPoints.slice(0, -1)}
            selectedIndices={selectedIndexSet}
            onToggleMovie={toggleMovie}
          />
        </section>
      )}

      {/* Recommendations + MMR control */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="marquee text-2xl text-text">Your recommendations</h2>
          {isComputing && <span className="eyebrow text-marquee">scoring…</span>}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
          {data && <RecommendationList recommendations={recommendations} movies={data.movies} />}
          <div className="frame p-4">
            <MMRSlider lambda={lambda} onChange={setLambda} />
          </div>
        </div>
      </section>

      {/* The honesty table */}
      <section className="flex flex-col gap-4">
        <h2 className="marquee text-2xl text-text">What&apos;s actually live</h2>
        <HonestyTable />
      </section>

      <footer className="border-t border-border-app pt-6 text-xs text-text-faint">
        Portfolio / educational demo. Model architecture and training from{" "}
        <a
          href="https://github.com/ujwal-jibhkate/Dynamic-Embedding-RecSys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted underline decoration-dotted underline-offset-2 hover:text-marquee"
        >
          Dynamic-Embedding-RecSys
        </a>
        . Movie data and embeddings from{" "}
        <a
          href="https://huggingface.co/datasets/ujwal-jibhkate/enriched-movie-dataset-with-multimodal-embeddings"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted underline decoration-dotted underline-offset-2 hover:text-marquee"
        >
          a Hugging Face dataset I published
        </a>
        , sampled offline; nothing about a specific person is stored or sent anywhere.
        Everything above runs in your browser.
      </footer>
    </main>
  );
}
