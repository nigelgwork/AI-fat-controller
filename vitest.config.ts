import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./frontend/src/test/setup.ts"],
    include: [
      "frontend/src/**/*.{test,spec}.{ts,tsx}",
      "electron/**/*.{test,spec}.ts",
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./frontend/src"),
    },
  },
});
