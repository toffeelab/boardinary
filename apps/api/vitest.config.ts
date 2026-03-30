import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@repo/db": path.resolve(__dirname, "../../packages/db/src"),
      "@repo/db/schema": path.resolve(
        __dirname,
        "../../packages/db/src/schema",
      ),
      "@repo/types": path.resolve(__dirname, "../../packages/types/src"),
    },
  },
});
