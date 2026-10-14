import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#070a11",
        surface: "#0b0f19",
        elevated: "#0f1424",
        gold: {
          DEFAULT: "#c8a951",
          bright: "#e8c967",
          dim: "#8a7330",
        },
        element: {
          norm: "#94a3b8",
          fire: "#f43f5e",
          water: "#06b6d4",
          wind: "#10b981",
          earth: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "toast-in": "toast-in 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "backdrop-in": "backdrop-in 0.25s ease",
        "modal-in": "modal-in 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "skeleton": "skeleton-shimmer 1.5s infinite",
        "foil-rotate": "foil-rotate 3s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
