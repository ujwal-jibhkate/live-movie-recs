import type { PcaTransform } from "./types";

/**
 * Projects a 512-d embedding into the same fixed 3D space as the precomputed
 * movie scatter (PCA fit offline on the full 44.6k catalog, see
 * scripts/build_demo_dataset.py). This is what lets the live user embedding
 * be plotted alongside the frozen catalog layout, tracing the "taste journey"
 * live instead of as a static offline plot.
 */
export function projectToPca(embedding: Float32Array, pca: PcaTransform): [number, number, number] {
  const { mean, components } = pca;
  const dim = mean.length;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < dim; i++) {
    const centered = embedding[i] - mean[i];
    x += centered * components[0][i];
    y += centered * components[1][i];
    z += centered * components[2][i];
  }
  return [x, y, z];
}
