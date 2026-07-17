const ROWS: { stage: string; live: boolean; detail: string }[] = [
  {
    stage: "Movie catalog & embeddings",
    live: false,
    detail:
      "Frozen, sampled from a 44.6k-movie dataset. The 512-d embedding itself can't be computed in a browser: it comes from CLIP + Sentence-BERT + a fusion network, hundreds of MB of transformer weights.",
  },
  {
    stage: "Cold-start init",
    live: true,
    detail: "Plain vector average over your picks' embeddings, computed in JS.",
  },
  {
    stage: "Taste update (UserUpdateFFN)",
    live: true,
    detail: "Re-runs on every pick or removal, a real 3.5MB model, via ONNX + WebAssembly.",
  },
  {
    stage: "Two-Tower projection",
    live: true,
    detail:
      "Both towers run on every update, batched over the user and the entire sampled catalog. Nothing here is precomputed either.",
  },
  {
    stage: "Retrieval (cosine top-N)",
    live: true,
    detail: "Exact search over 400 candidates, plain JavaScript.",
  },
  {
    stage: "MMR re-ranking",
    live: true,
    detail: "Real greedy MMR loop; the λ slider re-runs it instantly.",
  },
  {
    stage: "Embedding-space layout",
    live: false,
    detail:
      "PCA fit offline on the full 44.6k catalog for a stable, meaningful layout. Your taste point's position inside that fixed space is live.",
  },
];

/**
 * The honesty table: what's real-time in this tab vs. frozen ahead of time.
 * Same device as the sibling fraud-model demo — the point isn't to maximize
 * "live" for its own sake, it's to be exact about which claim is which.
 */
export function HonestyTable() {
  return (
    <div className="overflow-x-auto frame-strong">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-app text-left">
            <th className="eyebrow px-3 py-2.5 text-text-faint">Stage</th>
            <th className="eyebrow px-3 py-2.5 text-text-faint">Live?</th>
            <th className="eyebrow px-3 py-2.5 text-text-faint">What actually happens</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.stage} className="border-b border-border-app last:border-0">
              <td className="px-3 py-2.5 font-medium text-text">{row.stage}</td>
              <td className="px-3 py-2.5">
                {row.live ? (
                  <span className="eyebrow text-marquee">● live</span>
                ) : (
                  <span className="eyebrow text-text-faint">○ precomputed</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-text-muted">{row.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
