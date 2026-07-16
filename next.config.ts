import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static, server-less output. The entire app (including live ONNX
  // inference) runs in the browser, so we can pre-render everything to static
  // HTML/JS and host it on Vercel's free tier with no serverless functions.
  output: "export",

  // `next/image` optimization needs a server; disable it for static export.
  images: { unoptimized: true },

  // Next 16 builds with Turbopack by default. We keep the heavy ONNX runtime and
  // models OUT of the bundle by loading them at runtime from /public (see
  // lib/onnx.ts -> ort.env.wasm.wasmPaths), and onnxruntime-web is only ever
  // imported inside browser-only code paths, so no bundler shimming of Node
  // built-ins is needed. An empty turbopack config just acknowledges Turbopack.
  turbopack: {},
};

export default nextConfig;
