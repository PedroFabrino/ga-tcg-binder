import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: "./",
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: [
            path.join(__dirname, "index.html"),
            path.join(__dirname, "src/**/*.{js,ts,jsx,tsx}"),
          ],
          theme: {
            extend: {
              colors: {
                background: "#0a0f18",
              },
            },
          },
        }),
        autoprefixer(),
      ],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ga/gen-client": path.resolve(__dirname, "../networking/gen/client/src"),
      "@ga/gen-shared": path.resolve(__dirname, "../networking/gen/shared/src"),
    },
  },
});
