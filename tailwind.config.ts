import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        status: {
          pass: {
            DEFAULT: "#10b981",
            bg: "#ecfdf5",
            darkBg: "rgba(16, 185, 129, 0.12)",
            text: "#047857",
            darkText: "#34d399",
            border: "#a7f3d0",
            darkBorder: "rgba(16, 185, 129, 0.25)"
          },
          fail: {
            DEFAULT: "#f43f5e",
            bg: "#fff1f2",
            darkBg: "rgba(244, 63, 94, 0.12)",
            text: "#be123c",
            darkText: "#fb7185",
            border: "#fecdd3",
            darkBorder: "rgba(244, 63, 94, 0.25)"
          },
          blocked: {
            DEFAULT: "#f59e0b",
            bg: "#fffbeb",
            darkBg: "rgba(245, 158, 11, 0.12)",
            text: "#b45309",
            darkText: "#fbbf24",
            border: "#fde68a",
            darkBorder: "rgba(245, 158, 11, 0.25)"
          },
          skipped: {
            DEFAULT: "#64748b",
            bg: "#f8fafc",
            darkBg: "rgba(100, 116, 139, 0.12)",
            text: "#475569",
            darkText: "#94a3b8",
            border: "#cbd5e1",
            darkBorder: "rgba(100, 116, 139, 0.25)"
          },
          running: {
            DEFAULT: "#0284c7",
            bg: "#f0f9ff",
            darkBg: "rgba(2, 132, 199, 0.12)",
            text: "#0369a1",
            darkText: "#38bdf8",
            border: "#bae6fd",
            darkBorder: "rgba(2, 132, 199, 0.25)"
          }
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      }
    },
  },
  plugins: [],
};

export default config;
