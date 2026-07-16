"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

/** Tracks the `data-theme` attribute on <html> (set by ThemeToggle) so canvas
 * code — which can't read CSS custom properties directly — can pick the right
 * hex constants. */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.getAttribute("data-theme") === "light" ? "light" : "dark");
    read();

    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
