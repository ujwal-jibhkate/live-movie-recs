import type { Theme } from "./useTheme";

/**
 * Categorical palette for the embedding-space constellation, validated with
 * the dataviz skill's scripts/validate_palette.js against this app's actual
 * surfaces (light #fffdf8, dark #12161f):
 *   light: all-pairs PASS (2 slots sub-3:1 -> mitigated by the legend +
 *     hover tooltip, i.e. never color-alone)
 *   dark:  all-pairs PASS (worst CVD ΔE 6.9, in the legal 6-8 floor band
 *     given the same secondary encoding)
 *
 * A scatter is an all-pairs context, which the palette's own docs cap at 4
 * direct categorical slots — so only the catalog's 4 most common genres get a
 * dedicated hue; everything else folds into "Other" (a neutral gray, never a
 * 5th generated hue).
 */
export const GENRE_ORDER = ["Drama", "Comedy", "Thriller", "Action"] as const;

export const GENRE_COLORS: Record<string, { light: string; dark: string }> = {
  Drama: { light: "#2a78d6", dark: "#3987e5" },
  Comedy: { light: "#008300", dark: "#008300" },
  Thriller: { light: "#e87ba4", dark: "#d55181" },
  Action: { light: "#eda100", dark: "#c98500" },
};

export const OTHER_COLOR = { light: "#8b846f", dark: "#6b6e7a" };

export function colorForGenre(genre: string, theme: Theme): string {
  return (GENRE_COLORS[genre] ?? OTHER_COLOR)[theme];
}
