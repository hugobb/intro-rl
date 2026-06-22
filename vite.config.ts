import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// react() returns vite@6 Plugin types; vitest/config bundles vite@5 types.
// They are identical at runtime — cast bridges the incompatible type instances.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineConfig({
  plugins: [react() as any],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
