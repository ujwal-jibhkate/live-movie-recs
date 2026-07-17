import type { Movie } from "@/lib/types";
import { formatMs } from "@/lib/format";

interface SelectedTasteProps {
  picks: { movie: Movie; index: number }[];
  onRemove: (index: number) => void;
  ffnLatencyMs: number | null;
  towerLatencyMs: number | null;
}

export function SelectedTaste({ picks, onRemove, ffnLatencyMs, towerLatencyMs }: SelectedTasteProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-text-faint">Your picks ({picks.length})</span>
        {(ffnLatencyMs !== null || towerLatencyMs !== null) && (
          <span className="eyebrow tabular flex gap-3 text-taste">
            {ffnLatencyMs !== null && <span>ffn {formatMs(ffnLatencyMs)}</span>}
            {towerLatencyMs !== null && <span>tower {formatMs(towerLatencyMs)}</span>}
          </span>
        )}
      </div>
      {picks.length === 0 ? (
        <p className="text-sm text-text-faint">
          Pick a few movies below, each one runs the live taste-update network.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {picks.map(({ movie, index }) => (
            <span
              key={movie.tmdbId}
              className="flex items-center gap-1.5 border border-border-app bg-surface py-1 pl-2 pr-1 text-xs text-text"
            >
              {movie.title}
              <button
                onClick={() => onRemove(index)}
                aria-label={`Remove ${movie.title}`}
                className="grid h-4 w-4 place-items-center rounded-full text-text-faint hover:bg-taste hover:text-bg"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
