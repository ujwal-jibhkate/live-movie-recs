"use client";

/**
 * Light/dark toggle. The initial theme is chosen pre-paint by the
 * beforeInteractive script in layout.tsx (defaults to the dark "screening
 * room"), which sets `data-theme` on <html>. This button is fully
 * imperative — both icons render always, CSS shows the right one from
 * `[data-theme]`, so server and client markup match with no hydration risk.
 */
export function ThemeToggle() {
  function toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore storage errors (e.g. private mode) */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      className="grid h-9 w-9 place-items-center border border-border-app bg-surface text-text transition-colors hover:border-marquee hover:text-marquee"
    >
      <svg
        className="theme-icon-sun"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg
        className="theme-icon-moon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
