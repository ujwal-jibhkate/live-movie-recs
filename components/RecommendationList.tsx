import type { Movie } from "@/lib/types";
import type { RankedRecommendation } from "@/lib/retrieval";
import { formatPercent } from "@/lib/format";
import { MovieCard } from "./MovieCard";

interface RecommendationListProps {
  recommendations: RankedRecommendation[];
  movies: Movie[];
}

export function RecommendationList({ recommendations, movies }: RecommendationListProps) {
  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-text-faint">
        Pick at least three movies above to get your first live recommendations.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
      {recommendations.map((rec, i) => (
        <MovieCard
          key={movies[rec.index].tmdbId}
          movie={movies[rec.index]}
          badge={`#${i + 1} · ${formatPercent(rec.relevance)}`}
        />
      ))}
    </div>
  );
}
