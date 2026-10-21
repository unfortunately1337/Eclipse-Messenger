import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    maxWorkers: 4,
    include: ["**/*.test.ts"],
    exclude: [...configDefaults.exclude, "scratch/**"],
  },
});
