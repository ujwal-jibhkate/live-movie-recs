import type { Metadata } from "next";
import Script from "next/script";
import { Bebas_Neue, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const display = Bebas_Neue({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Live Taste Engine: A Recommender That Learns in Your Browser",
  description:
    "Pick a few movies you like and watch a real neural network build your taste profile live, entirely client-side via ONNX + WebAssembly, a teaching walkthrough of cold-start recommendation, dynamic embeddings, and diversity-aware ranking.",
};

/*
 * Runs before first paint to set the theme, avoiding a light/dark flash.
 * This demo's home is a dark screening room; light is an accessible option,
 * not the default.
 */
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem('theme');
    document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
