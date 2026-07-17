"use client";

import { useMemo } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, MarkerType, type Edge } from "@xyflow/react";
import { StageNode, type StageNodeType } from "@/components/nodes/StageNode";
import { formatMs } from "@/lib/format";

const NODE_W = 260;
const GAP = 48;

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border-app py-1.5 first:border-t-0">
      <span className="eyebrow text-text-faint">{k}</span>
      <span className="tabular text-[13px] font-semibold text-text">{v}</span>
    </div>
  );
}

export interface PipelineFlowProps {
  catalogSize: number;
  pickCount: number;
  ffnLatencyMs: number | null;
  towerLatencyMs: number | null;
  candidateCount: number;
  lambda: number;
  recommendationCount: number;
}

/**
 * The recommendation pipeline as a "reel path": seven sequential stages from
 * the frozen catalog to the final ranked list. Only the catalog itself is
 * precomputed — every stage after it, including retrieval and MMR, is real
 * computation happening in this tab right now.
 */
export function PipelineFlow({
  catalogSize,
  pickCount,
  ffnLatencyMs,
  towerLatencyMs,
  candidateCount,
  lambda,
  recommendationCount,
}: PipelineFlowProps) {
  const { nodes, edges } = useMemo(() => {
    const defs: { title: string; prod: string; demo: string; live?: boolean; content: React.ReactNode }[] = [
      {
        title: "Catalog",
        prod: "A real catalog holds millions of items; embeddings are refreshed by an offline batch job.",
        demo: "400 movies sampled from a 44.6k-title dataset, each with a real precomputed embedding.",
        content: (
          <>
            <KV k="Movies" v={catalogSize} />
            <KV k="Embedding dim" v={512} />
          </>
        ),
      },
      {
        title: "Cold-Start Init",
        prod: "A brand-new user has no history, so most systems fall back to popularity, losing personalization.",
        demo: "Your taste vector starts as the average embedding of your picks.",
        live: true,
        content: (
          <>
            <KV k="Picks" v={pickCount} />
            <KV k="Method" v="vector mean" />
          </>
        ),
      },
      {
        title: "Taste Update",
        prod: "A feature store streams behavioral updates; the model that turns them into a new embedding runs on a serving cluster.",
        demo: "UserUpdateFFN (3.5MB) runs live, right here, via ONNX + WASM.",
        live: true,
        content: (
          <>
            <div className="tabular text-2xl font-semibold text-marquee">
              {ffnLatencyMs != null ? formatMs(ffnLatencyMs) : "–"}
            </div>
            <div className="eyebrow mt-0.5 text-text-faint">per pick, in-browser</div>
          </>
        ),
      },
      {
        title: "Two-Tower Projection",
        prod: "User and item towers typically run on separate serving paths; item vectors are cached in an ANN index.",
        demo: "Both towers run live, batched over the user AND the whole catalog, every update.",
        live: true,
        content: (
          <>
            <div className="tabular text-2xl font-semibold text-marquee">
              {towerLatencyMs != null ? formatMs(towerLatencyMs) : "–"}
            </div>
            <KV k="Latent dim" v={128} />
          </>
        ),
      },
      {
        title: "Retrieval",
        prod: "Approximate nearest-neighbor search (e.g. FAISS) narrows millions of items to hundreds in milliseconds.",
        demo: "Exact cosine top-N over 400 items, small enough that 'approximate' isn't even needed.",
        live: true,
        content: <KV k="Candidates" v={candidateCount} />,
      },
      {
        title: "MMR Re-ranking",
        prod: "Diversity-aware re-ranking avoids a monotonous, over-similar feed.",
        demo: "Real MMR loop, re-run instantly whenever the λ slider moves.",
        live: true,
        content: <KV k="λ" v={lambda.toFixed(2)} />,
      },
      {
        title: "Recommendations",
        prod: "Served to the user, then logged as training data for the next model refresh.",
        demo: "Your personalized, diversity-balanced list, entirely computed client-side.",
        content: <KV k="Shown" v={recommendationCount} />,
      },
    ];

    const nodes: StageNodeType[] = defs.map((def, i) => ({
      id: `stage-${i + 1}`,
      type: "stage",
      position: { x: i * (NODE_W + GAP), y: 0 },
      data: { index: i + 1, ...def },
      draggable: false,
      selectable: false,
    }));

    const edges: Edge[] = defs.slice(1).map((_, i) => ({
      id: `e-${i + 1}`,
      source: `stage-${i + 1}`,
      target: `stage-${i + 2}`,
      type: "straight",
      style: { stroke: "var(--border-strong)", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-strong)", width: 16, height: 16 },
    }));

    return { nodes, edges };
  }, [catalogSize, pickCount, ffnLatencyMs, towerLatencyMs, candidateCount, lambda, recommendationCount]);

  return (
    <div className="frame-strong h-[380px] w-full overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={{ stage: StageNode }}
        defaultViewport={{ x: 24, y: 26, zoom: 0.85 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnScroll
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
