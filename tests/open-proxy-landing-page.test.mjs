import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");

test("Open Proxy publishes a dedicated public route and sitemap entry", () => {
  const vite = read("vite.config.js");
  const sitemap = read("public-site-static/sitemap.xml");

  assert.match(vite, /\["\/open-proxy", "\/open-proxy\/index\.html"\]/u);
  assert.match(vite, /\["\/open-proxy\/", "\/open-proxy\/index\.html"\]/u);
  assert.match(sitemap, /https:\/\/prometheusrouteiq\.com\/open-proxy/u);
});

test("Open Proxy landing page includes 3D hero structure, positioning copy, and CTA", () => {
  const html = read("public-site-static/open-proxy/index.html");

  assert.match(html, /<title>Open Proxy \| 3D Landing Page by Prometheus\.IQ<\/title>/u);
  assert.match(html, /Policy-aware proxying without the black box\./u);
  assert.match(html, /<canvas id="network-canvas"><\/canvas>/u);
  assert.match(html, /Prometheus\.IQ designed Open Proxy/u);
  assert.match(html, /A proxy operators can explain\./u);
  assert.match(html, /Need a governed proxy surface with a better operator experience\?/u);
  assert.match(html, /href="mailto:prometheusrouteiq@gmail\.com\?subject=Open%20Proxy%20Preview"/u);
  assert.match(html, /src="\/open-proxy\/open-proxy\.js"/u);
  assert.match(html, /href="\/open-proxy\/open-proxy\.css"/u);
});

test("Open Proxy assets implement depth, motion fallback, and operator-focused styling", () => {
  const css = read("public-site-static/open-proxy/open-proxy.css");
  const js = read("public-site-static/open-proxy/open-proxy.js");

  assert.match(css, /\.proxy-scene-shell \{[\s\S]*perspective: 1400px;/u);
  assert.match(css, /\.scene-grid \{[\s\S]*rotateX\(78deg\)/u);
  assert.match(css, /\.scene-panel\.primary/u);
  assert.match(js, /prefers-reduced-motion: reduce/u);
  assert.match(js, /requestAnimationFrame\(render\)/u);
  assert.match(js, /pointermove/u);
  assert.match(js, /Array\.from\(\{ length: 44 \}/u);
  assert.match(js, /drawRing/u);
});
