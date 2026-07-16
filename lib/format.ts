export function formatMs(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

export function formatPercent(x: number): string {
  return `${(x * 100).toFixed(0)}%`;
}

export function formatNames(names: string[], max = 3): string {
  if (names.length === 0) return "—";
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max}`;
}
