import { existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const outputDirectory = resolve(import.meta.dirname, "dist-public");

export default defineConfig({
  publicDir: "public-site-static",
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, "landing.html") }
  },
  plugins: [{
    name: "prometheus-public-entry",
    closeBundle() {
      const landing = resolve(outputDirectory, "landing.html");
      if (existsSync(landing)) renameSync(landing, resolve(outputDirectory, "index.html"));
    }
  }]
});
