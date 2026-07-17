import type { Movie } from "@/lib/types";
import { primaryGenre } from "@/lib/domain";

interface MovieCardProps {
  movie: Movie;
  onClick?: () => void;
  selected?: boolean;
  /** Small corner badge, e.g. a rank number or a relevance percentage. */
  badge?: string;
}

export function MovieCard({ movie, onClick, selected, badge }: MovieCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden border text-left transition-colors ${
        selected
          ? "border-marquee bg-surface-2"
          : "border-border-app bg-surface hover:border-marquee-dim"
      }`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/${movie.poster}`}
          alt={`${movie.title} poster`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        {selected && (
          <div className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-marquee text-marquee-contrast">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        )}
        {badge && (
          <div className="eyebrow absolute left-1.5 top-1.5 bg-bg/85 px-1.5 py-0.5 text-marquee">
            {badge}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <div className="line-clamp-1 text-sm font-medium text-text">{movie.title}</div>
        <div className="eyebrow text-text-faint">
          {movie.year ?? "–"} · {primaryGenre(movie)}
        </div>
      </div>
    </button>
  );
}
