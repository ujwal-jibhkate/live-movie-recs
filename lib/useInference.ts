"use client";

/**
 * React hook wrapping the two live ONNX sessions. Handles warm-up on mount and
 * exposes imperative calls for the two live stages (taste update, two-tower
 * scoring), tracking their measured latency so the UI can show real numbers
 * instead of a spinner — same "prove it's live" instinct as the fraud demo.
 *
 * Session lifecycle only lives here; selection state and the retrieval/MMR
 * pipeline are owned by the page orchestrator (they're plain data, not model
 * concerns).
 */
import { useCallback, useEffect, useState } from "react";
import { getSessions, runTwoTower, runUserUpdate } from "./onnx";

export type ModelStatus = "loading-model" | "idle" | "error";

export interface InferenceState {
  status: ModelStatus;
  error: string | null;
  /** Last measured UserUpdateFFN session.run() latency, ms. */
  ffnLatencyMs: number | null;
  /** Last measured TwoTowerModel session.run() latency, ms. */
  towerLatencyMs: number | null;
}

export function useInference() {
  const [state, setState] = useState<InferenceState>({
    status: "loading-model",
    error: null,
    ffnLatencyMs: null,
    towerLatencyMs: null,
  });

  useEffect(() => {
    let cancelled = false;
    getSessions()
      .then(() => {
        if (cancelled) return;
        setState((s) => ({ ...s, status: "idle" }));
      })
      .catch((err) => {
        if (cancelled) return;
        setState((s) => ({ ...s, status: "error", error: String(err) }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateTaste = useCallback(async (prevEmb: Float32Array, newItemEmb: Float32Array) => {
    const result = await runUserUpdate(prevEmb, newItemEmb);
    setState((s) => ({ ...s, ffnLatencyMs: result.latencyMs }));
    return result;
  }, []);

  const scoreCatalog = useCallback(async (userEmb: Float32Array, catalogEmbeddings: Float32Array) => {
    const result = await runTwoTower(userEmb, catalogEmbeddings);
    setState((s) => ({ ...s, towerLatencyMs: result.latencyMs }));
    return result;
  }, []);

  return { ...state, updateTaste, scoreCatalog };
}
