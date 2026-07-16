"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ReactNode } from "react";

/**
 * Data carried by each "reel path" stage. `prod`/`demo` contrast what a
 * production-scale recommender does at that stage with what this demo
 * actually does — the same honesty device as the sibling fraud-model demo.
 */
export interface StageNodeData {
  index: number;
  title: string;
  prod: string;
  demo: string;
  content: ReactNode;
  /** True for stages that are genuinely computed live in this browser tab. */
  live?: boolean;
  [key: string]: unknown;
}

export type StageNodeType = Node<StageNodeData, "stage">;

export function StageNode({ data }: NodeProps<StageNodeType>) {
  const num = String(data.index).padStart(2, "0");
  return (
    <div
      className={`flex w-[260px] flex-col border-2 ${
        data.live
          ? "border-marquee bg-surface-2 text-text shadow-[0_0_0_1px_var(--marquee)]"
          : "border-border-app bg-surface text-text"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-border-strong" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-border-strong" />

      <div className="flex items-stretch border-b border-border-app">
        <div className="marquee grid w-11 place-items-center border-r border-border-app text-xl text-text-faint">
          {num}
        </div>
        <div className="flex flex-1 items-center justify-between px-2.5 py-1.5">
          <span className="text-sm font-semibold leading-tight text-text">{data.title}</span>
          {data.live && (
            <span className="eyebrow flex items-center gap-1 text-marquee">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-marquee" />
              live
            </span>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5 text-sm">{data.content}</div>

      <div className="mt-auto grid gap-1.5 border-t border-border-app px-3 py-2.5 text-xs leading-snug">
        <div>
          <span className="eyebrow text-text-faint">Prod / </span>
          <span className="text-text-muted">{data.prod}</span>
        </div>
        <div>
          <span className="eyebrow text-text-faint">Demo / </span>
          <span className="text-text-muted">{data.demo}</span>
        </div>
      </div>
    </div>
  );
}
