"use client";

/**
 * The demo's signature visual: a live scatter of the sampled catalog in the
 * PCA(2) space fit on the full 44.6k-movie dataset (see
 * scripts/build_demo_dataset.py), with the user's own evolving taste vector
 * drawn as a moving point with a fading trail — the README's offline "user's
 * evolving taste journey" plot, but real-time and interactive.
 *
 * The catalog layout is precomputed (PCA can't be fit live); everything
 * about the taste point — its position and its trail — is live, recomputed
 * from the actual UserUpdateFFN output on every pick via lib/pca.ts.
 *
 * This is a dense (~400 point) "starfield": marks are drawn smaller than the
 * usual ≥8px marker spec calls for (a dot-plot spec assumes a handful of
 * points meant to each be prominent), but the hover HIT target is kept at the
 * full 8px radius regardless of the smaller visual dot, so the accessibility
 * intent of that spec — nothing is only findable by a pixel-perfect hover —
 * still holds. The catalog is also fully browsable as a list in MoviePicker,
 * which is this chart's keyboard-accessible table-view equivalent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Movie } from "@/lib/types";
import { primaryGenre } from "@/lib/domain";
import { colorForGenre, GENRE_ORDER, OTHER_COLOR } from "@/lib/genreColors";
import { useTheme } from "@/lib/useTheme";

interface EmbeddingSpaceProps {
  movies: Movie[];
  tastePoint: [number, number] | null;
  trail: [number, number][];
  selectedIndices: Set<number>;
  onToggleMovie: (index: number) => void;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const HIT_RADIUS_PX = 8;
const DOT_RADIUS_PX = 2.5;
const SELECTED_RING_PX = 5;

function computeBounds(movies: Movie[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const m of movies) {
    const [x, y] = m.pca;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  // 15% padding so points don't touch the frame, and so a live taste point
  // that drifts slightly past the sampled catalog's extremes still fits.
  const padX = (maxX - minX) * 0.15 || 1;
  const padY = (maxY - minY) * 0.15 || 1;
  return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
}

export function EmbeddingSpace({
  movies,
  tastePoint,
  trail,
  selectedIndices,
  onToggleMovie,
}: EmbeddingSpaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const [size, setSize] = useState({ width: 600, height: 420 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const bounds = useMemo(() => computeBounds(movies), [movies]);

  const toPixel = useCallback(
    (pt: [number, number]): [number, number] => {
      const px = ((pt[0] - bounds.minX) / (bounds.maxX - bounds.minX)) * size.width;
      const pyRaw = ((pt[1] - bounds.minY) / (bounds.maxY - bounds.minY)) * size.height;
      // Flip Y: canvas origin is top-left, but we want higher PCA-y toward the top.
      const py = size.height - pyRaw;
      return [px, py];
    },
    [bounds, size],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Redraw whenever anything visual changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.width, size.height);

    const marqueeColor = theme === "dark" ? "#e8b84b" : "#a8760a";
    const tasteColor = theme === "dark" ? "#ff5f7e" : "#c92e4c";

    // Catalog "stars", colored by primary genre.
    movies.forEach((movie, i) => {
      const [x, y] = toPixel(movie.pca);
      const genre = primaryGenre(movie);
      const color = colorForGenre(genre, theme);
      const isSelected = selectedIndices.has(i);
      const isHovered = hoverIndex === i;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, SELECTED_RING_PX, 0, Math.PI * 2);
        ctx.strokeStyle = marqueeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, isHovered ? DOT_RADIUS_PX + 1.5 : DOT_RADIUS_PX, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = isHovered || isSelected ? 1 : 0.75;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Taste trail: fading coral breadcrumbs of where the live vector has been.
    trail.forEach((pt, i) => {
      const [x, y] = toPixel(pt);
      const age = trail.length - i;
      const alpha = Math.max(0.08, 1 - age * 0.18);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = tasteColor;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // The live taste point itself — the one thing on this canvas that's
    // moving because a real model just ran.
    if (tastePoint) {
      const [x, y] = toPixel(tastePoint);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = tasteColor;
      ctx.shadowColor = tasteColor;
      ctx.shadowBlur = 16;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = theme === "dark" ? "#0b0e14" : "#f6f1e4";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [movies, size, theme, toPixel, hoverIndex, selectedIndices, trail, tastePoint]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      let closest = -1;
      let closestDist = HIT_RADIUS_PX;
      movies.forEach((movie, i) => {
        const [x, y] = toPixel(movie.pca);
        const d = Math.hypot(x - mx, y - my);
        if (d < closestDist) {
          closestDist = d;
          closest = i;
        }
      });

      setHoverIndex(closest === -1 ? null : closest);
      setHoverPos(closest === -1 ? null : { x: mx, y: my });
    },
    [movies, toPixel],
  );

  const handleClick = useCallback(() => {
    if (hoverIndex !== null) onToggleMovie(hoverIndex);
  }, [hoverIndex, onToggleMovie]);

  const hoveredMovie = hoverIndex !== null ? movies[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} className="relative h-[420px] w-full frame-strong">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          onClick={handleClick}
          className="cursor-pointer"
          role="img"
          aria-label="Scatter plot of the movie catalog in embedding space, with your live taste position highlighted. Use the movie picker below for a keyboard-accessible list of the same catalog."
        />
        {hoveredMovie && hoverPos && (
          <div
            className="pointer-events-none absolute z-10 max-w-[200px] -translate-x-1/2 -translate-y-full frame-strong px-2 py-1.5 text-xs"
            style={{ left: hoverPos.x, top: hoverPos.y - 12 }}
          >
            <div className="font-medium text-text">{hoveredMovie.title}</div>
            <div className="eyebrow text-text-faint">{primaryGenre(hoveredMovie)}</div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {GENRE_ORDER.map((g) => (
          <span key={g} className="flex items-center gap-1.5 text-text-muted">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: colorForGenre(g, theme) }}
            />
            {g}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-text-muted">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: OTHER_COLOR[theme] }}
          />
          Other
        </span>
        <span className="flex items-center gap-1.5 text-taste">
          <span className="inline-block h-2.5 w-2.5 rounded-full glow-taste" />
          Your taste (live)
        </span>
      </div>
    </div>
  );
}
