"use client";

import { useMemo, useState } from "react";
import type { Movie } from "@/lib/types";
import { MovieCard } from "./MovieCard";

interface MoviePickerProps {
  movies: Movie[];
  selectedIndices: Set<number>;
  onToggle: (index: number) => void;
}

export function MoviePicker({ movies, selectedIndices, onToggle }: MoviePickerProps) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All");

  const genres = useMemo(() => {
    const set = new Set<string>();
    movies.forEach((m) => m.genres.forEach((g) => set.add(g)));
    return ["All", ...Array.from(set).sort()];
  }, [movies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movies
      .map((movie, index) => ({ movie, index }))
      .filter(({ movie }) => {
        if (genre !== "All" && !movie.genres.includes(genre)) return false;
        if (q && !movie.title.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [movies, query, genre]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the catalog by title…"
          className="frame w-full px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-marquee focus:outline-none sm:max-w-xs"
        />
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="frame px-3 py-2 text-sm text-text focus:border-marquee focus:outline-none"
        >
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <span className="eyebrow ml-auto text-text-faint">
          {filtered.length} of {movies.length} movies
        </span>
      </div>

      <div className="grid max-h-[520px] grid-cols-3 gap-2.5 overflow-y-auto p-0.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {filtered.map(({ movie, index }) => (
          <MovieCard
            key={movie.tmdbId}
            movie={movie}
            selected={selectedIndices.has(index)}
            onClick={() => onToggle(index)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-text-faint">
            No movies match &ldquo;{query}&rdquo;.
          </div>
        )}
      </div>
    </div>
  );
}
