import { existsSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const outputDirectory = resolve(import.meta.dirname, "dist-public");
const previewOnlyAssets = Object.freeze([
  "01-772904932_1493675372780221_5358616428807129112_n-2.jpeg",
  "01-772904932_1493675372780221_5358616428807129112_n-2.webp"
]);
const publicPreviewRoutes = new Map([
  ["/", "/landing.html"],
  ["/investors", "/landing.html"],
  ["/investors/", "/landing.html"],
  ["/thank-you", "/landing.html"],
  ["/thank-you/", "/landing.html"],
  ["/privacy", "/privacy/index.html"],
  ["/privacy/", "/privacy/index.html"],
  ["/terms", "/terms/index.html"],
  ["/terms/", "/terms/index.html"],
  ["/data-deletion", "/data-deletion/index.html"],
  ["/data-deletion/", "/data-deletion/index.html"]
]);

function installPublicPreviewRoutes(server) {
  server.middlewares.use((request, _response, next) => {
    const pathname = new URL(request.url || "/", "http://route-iq.local").pathname;
    const publicEntry = publicPreviewRoutes.get(pathname);
    if (publicEntry) request.url = publicEntry;
    next();
  });
}

export default defineConfig({
  publicDir: "public-site-static",
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, "landing.html") }
  },
  plugins: [{
    name: "prometheus-public-entry",
    configureServer: installPublicPreviewRoutes,
    configurePreviewServer: installPublicPreviewRoutes,
    closeBundle() {
      const landing = resolve(outputDirectory, "landing.html");
      if (existsSync(landing)) renameSync(landing, resolve(outputDirectory, "index.html"));
      for (const asset of previewOnlyAssets) rmSync(resolve(outputDirectory, asset), { force: true });
    }
  }]
});
