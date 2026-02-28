import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Use the browser-like DOM environment
    environment: "jsdom",

    // Run the global setup (jest-dom matchers, fetch mock, etc.)
    setupFiles: ["./tests/setup.ts"],

    // Expose `describe`, `it`, `expect`, `vi`, etc. globally
    globals: true,

    // Coverage report configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["lib/**/*.ts", "lib/**/*.tsx"],
      exclude: ["lib/hooks/index.ts"],
    },
  },
  resolve: {
    // Mirror the `@/` alias from tsconfig.json
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
