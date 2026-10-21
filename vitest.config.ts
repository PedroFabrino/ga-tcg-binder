import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      COMMUNITY_ID: "00000000-0000-0000-0000-000000000001",
    },
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ga/contracts": path.resolve(__dirname, "./packages/contracts/src/index.ts"),
    },
  },
});
