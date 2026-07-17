"use client";

/**
 * The demo's signature visual: a live scatter of the sampled catalog in the
 * PCA(3) space fit on the full 44.6k-movie dataset (see
 * scripts/build_demo_dataset.py), with the user's own evolving taste vector
 * drawn as a moving point with a fading trail, the README's offline "user's
 * evolving taste journey" plot, but real-time, interactive, and now a real
 * WebGL scene the viewer can orbit around.
 *
 * The catalog layout is precomputed (PCA can't be fit live); everything
 * about the taste point, its position and its trail, is live, recomputed
 * from the actual UserUpdateFFN output on every pick via lib/pca.ts.
 *
 * Stars are instanced spheres (one draw call for all ~400 movies) so hover
 * and click use real GPU raycasting (instanceId) instead of hand-rolled
 * pixel-distance hit-testing. The catalog is also fully browsable as a list
 * in MoviePicker, which is this chart's keyboard-accessible equivalent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { Movie } from "@/lib/types";
import { primaryGenre } from "@/lib/domain";
import { colorForGenre, GENRE_ORDER, OTHER_COLOR } from "@/lib/genreColors";
import { useTheme, type Theme } from "@/lib/useTheme";

interface EmbeddingSpaceProps {
  movies: Movie[];
  tastePoint: [number, number, number] | null;
  trail: [number, number, number][];
  selectedIndices: Set<number>;
  onToggleMovie: (index: number) => void;
}

interface Bounds3 {
  center: [number, number, number];
  radius: number;
}

const DOT_RADIUS = 0.12;
const HOVER_SCALE = 1.5;
const BLOCK_SIZE = 0.34;

const MARQUEE_COLOR: Record<Theme, string> = { dark: "#e8b84b", light: "#a8760a" };
const TASTE_COLOR: Record<Theme, string> = { dark: "#ff5f7e", light: "#c92e4c" };
const BG_COLOR: Record<Theme, string> = { dark: "#12161f", light: "#fffdf8" };

// Bounds from the catalog alone: anchors the orbit target and the camera's
// framing, kept stable so picking movies never yanks the view out from
// under a hand-rotated camera, and so the star field never shrinks away
// to sub-pixel size just to fit an outlier taste position (see
// clampToRadius below).
function computeCatalogBounds(movies: Movie[]): Bounds3 {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const m of movies) {
    const [x, y, z] = m.pca;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const halfExtent = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1e-3) / 2;
  return { center, radius: halfExtent * 1.25 };
}

// A chained UserUpdateFFN replay (every pick re-runs the whole sequence) can
// drift the live taste vector many times past the sampled catalog's own PCA
// extent, that's a real property of the model, not a rendering bug. Naively
// re-framing the camera to fit that raw distance shrinks the 400-movie
// starfield to invisible sub-pixel dots. So the taste point/trail are drawn
// at their true direction from the catalog center, but clamped to this
// radius, "off the edge of the map, this way" rather than "so far away nothing
// else is visible."
function clampToRadius(
  point: [number, number, number],
  center: [number, number, number],
  radius: number,
): [number, number, number] {
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  const dz = point[2] - center[2];
  const dist = Math.hypot(dx, dy, dz);
  if (dist <= radius || dist === 0) return point;
  const scale = radius / dist;
  return [center[0] + dx * scale, center[1] + dy * scale, center[2] + dz * scale];
}

interface ScatterProps {
  movies: Movie[];
  hoverIndex: number | null;
  theme: Theme;
  onHover: (index: number, x: number, y: number) => void;
  onLeave: () => void;
  onSelect: (index: number) => void;
}

function Scatter({ movies, hoverIndex, theme, onHover, onLeave, onSelect }: ScatterProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    movies.forEach((movie, i) => {
      const [x, y, z] = movie.pca;
      const isHovered = hoverIndex === i;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(isHovered ? HOVER_SCALE : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(colorForGenre(primaryGenre(movie), theme)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [movies, hoverIndex, theme, dummy]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) onHover(e.instanceId, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    },
    [onHover],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) onSelect(e.instanceId);
    },
    [onSelect],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, movies.length]}
      onPointerMove={handlePointerMove}
      onPointerOut={onLeave}
      onClick={handleClick}
    >
      <sphereGeometry args={[DOT_RADIUS, 12, 12]} />
      <meshStandardMaterial roughness={0.4} metalness={0.1} toneMapped={false} />
    </instancedMesh>
  );
}

// Picked movies get a wireframe "selection cage" instead of a color/size
// change on the star itself: a distinct shape reads as "selected" regardless
// of genre color (a plain brighter dot was easy to lose among same-hued
// Action stars, since the marquee gold tint is close to the Action hue).
function SelectedMarkers({ movies, selectedIndices, theme }: { movies: Movie[]; selectedIndices: Set<number>; theme: Theme }) {
  const color = MARQUEE_COLOR[theme];
  return (
    <>
      {Array.from(selectedIndices, (i) => {
        const movie = movies[i];
        if (!movie) return null;
        return (
          <mesh key={i} position={movie.pca} rotation={[Math.PI / 5, Math.PI / 4, 0]}>
            <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
            <meshBasicMaterial color={color} wireframe toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
}

// The taste point is the demo's one must-always-be-visible element (the
// live signal a real model just produced), so unlike the catalog stars it
// deliberately ignores the depth buffer and renders on top of everything,
// the 3D equivalent of the old 2D canvas always painting it last.
function TastePoint({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position} renderOrder={10}>
      <mesh renderOrder={10}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.22}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={11}>
        <sphereGeometry args={[0.26, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Trail({ points, color }: { points: [number, number, number][]; color: string }) {
  return (
    <>
      {points.map((pt, i) => {
        const age = points.length - i;
        const opacity = Math.max(0.05, 1 - age * 0.16) * 0.6;
        return (
          <mesh key={i} position={pt} renderOrder={9}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={opacity}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </>
  );
}

export function EmbeddingSpace({
  movies,
  tastePoint,
  trail,
  selectedIndices,
  onToggleMovie,
}: EmbeddingSpaceProps) {
  const theme = useTheme();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Stable: only depends on the (load-once) catalog, so the camera framing
  // never moves under a hand-rotated view, regardless of where taste drifts.
  const catalogBounds = useMemo(() => computeCatalogBounds(movies), [movies]);
  const target = useMemo(() => new THREE.Vector3(...catalogBounds.center), [catalogBounds]);
  const cameraStart = useMemo<[number, number, number]>(() => {
    const dist = Math.max(catalogBounds.radius * 2.4, 1);
    return [
      catalogBounds.center[0] + dist * 0.6,
      catalogBounds.center[1] + dist * 0.4,
      catalogBounds.center[2] + dist * 0.9,
    ];
  }, [catalogBounds]);

  // The taste point/trail are clamped to 1.8x the catalog radius before
  // rendering, so an outlier drift shows up "at the edge, this direction"
  // instead of forcing the whole scene to zoom out to fit it.
  const clampRadius = catalogBounds.radius * 1.8;
  const clampedTastePoint = useMemo(
    () => (tastePoint ? clampToRadius(tastePoint, catalogBounds.center, clampRadius) : null),
    [tastePoint, catalogBounds, clampRadius],
  );
  const clampedTrail = useMemo(
    () => trail.map((p) => clampToRadius(p, catalogBounds.center, clampRadius)),
    [trail, catalogBounds, clampRadius],
  );

  const handleHover = useCallback((index: number, x: number, y: number) => {
    setHoverIndex(index);
    setHoverPos({ x, y });
  }, []);
  const handleLeave = useCallback(() => {
    setHoverIndex(null);
    setHoverPos(null);
  }, []);

  const hoveredMovie = hoverIndex !== null ? movies[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-[420px] w-full frame-strong">
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true }}
          onCreated={({ gl }) => gl.setClearColor(BG_COLOR[theme])}
          role="img"
          aria-label="3D scatter of the movie catalog in embedding space. Drag to rotate, scroll to zoom, with your live taste position highlighted. Use the movie picker below for a keyboard-accessible list of the same catalog."
        >
          <ambientLight intensity={1} />
          <directionalLight position={[6, 8, 6]} intensity={0.55} />
          <PerspectiveCamera makeDefault position={cameraStart} fov={50} near={0.1} far={catalogBounds.radius * 20} />
          <OrbitControls
            makeDefault
            target={target}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.6}
            minDistance={catalogBounds.radius * 0.6}
            maxDistance={catalogBounds.radius * 8}
          />
          <Scatter
            movies={movies}
            hoverIndex={hoverIndex}
            theme={theme}
            onHover={handleHover}
            onLeave={handleLeave}
            onSelect={onToggleMovie}
          />
          <SelectedMarkers movies={movies} selectedIndices={selectedIndices} theme={theme} />
          {clampedTrail.length > 0 && <Trail points={clampedTrail} color={TASTE_COLOR[theme]} />}
          {clampedTastePoint && <TastePoint position={clampedTastePoint} color={TASTE_COLOR[theme]} />}
        </Canvas>
        {hoveredMovie && hoverPos && (
          <div
            className="pointer-events-none absolute z-10 max-w-[200px] -translate-x-1/2 -translate-y-full frame-strong px-2 py-1.5 text-xs"
            style={{ left: hoverPos.x, top: hoverPos.y - 14 }}
          >
            <div className="font-medium text-text">{hoveredMovie.title}</div>
            <div className="eyebrow text-text-faint">{primaryGenre(hoveredMovie)}</div>
          </div>
        )}
        <div className="eyebrow pointer-events-none absolute bottom-2 right-2 text-text-faint/80">
          drag to rotate · scroll to zoom
        </div>
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
        <span className="flex items-center gap-1.5 text-text-muted">
          <span
            className="inline-block h-2.5 w-2.5 border border-marquee"
            style={{ borderColor: MARQUEE_COLOR[theme] }}
          />
          Selected
        </span>
        <span className="flex items-center gap-1.5 text-taste">
          <span className="inline-block h-2.5 w-2.5 rounded-full glow-taste" />
          Your taste (live)
        </span>
      </div>
    </div>
  );
}
