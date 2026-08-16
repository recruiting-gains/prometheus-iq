import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");

test("the Route IQ flame core restores the governed 3D visual vocabulary", () => {
  const scene = read("src/IntelligenceScene.jsx");

  assert.match(scene, /from "@react-three\/fiber"/);
  assert.match(scene, /from "@react-three\/drei"/);
  assert.match(scene, /function FlameCore3D/);
  assert.match(scene, /<Line points=\{routeA\}/);
  assert.match(scene, /<Line points=\{routeB\}/);
  assert.match(scene, /<sphereGeometry/);
  assert.match(scene, /<coneGeometry/);
  assert.match(scene, /<torusGeometry/);
  assert.match(scene, /<ringGeometry/);
  assert.match(scene, /<gridHelper/);
  assert.match(scene, /<Stars /);
  assert.match(scene, /Array\.from\(\{ length: 90 \}/);
  assert.match(scene, /pointer\.x \* 0\.12/);
  assert.match(scene, /pointer\.y \* 0\.07/);
  assert.match(scene, /FIELD INTELLIGENCE CORE/);
});

test("the hero defers 3D work and fails closed to the field-operations fallback", () => {
  const source = read("src/main.jsx");

  assert.match(source, /React\.lazy\(\(\) => import\("\.\/IntelligenceScene\.jsx"\)\)/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /connection\?\.saveData/);
  assert.match(source, /function supportsWebGl/);
  assert.match(source, /failIfMajorPerformanceCaveat: true/);
  assert.match(source, /WEBGL_lose_context/);
  assert.match(source, /class HeroSceneBoundary/);
  assert.match(source, /data-visual-fallback="field-operations"/);
  assert.match(source, /src="\/route-iq-field-operations\.jpg"/);
  assert.match(source, /mode === "fallback"/);
  assert.match(source, /mode === "pending"/);
  assert.match(source, /mode="scene"|data-visual-mode="scene"/);
  assert.doesNotMatch(source, /className="hero-image"/);
});

test("Framer Motion restores scroll and reveal behavior without overriding reduced motion", () => {
  const source = read("src/main.jsx");
  const styles = read("src/styles.css");

  assert.match(source, /from "framer-motion"/);
  assert.match(source, /useReducedMotion\(\)/);
  assert.match(source, /useScroll\(\)/);
  assert.match(source, /useTransform\(scrollYProgress, \[0, 0\.22\], \[1, 0\.92\]\)/);
  assert.match(source, /className="hero-scene"/);
  assert.match(source, /whileInView=\{\{ opacity: 1, y: 0 \}\}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /animation-iteration-count: 1 !important/);
  assert.match(styles, /\.hero-scene \{ transform: none !important; \}/);
});

test("stable responsive scene framing keeps copy, CTA, and touch scrolling independent", () => {
  const source = read("src/main.jsx");
  const styles = read("src/styles.css");

  assert.match(styles, /\.hero-scene \{[\s\S]*position: absolute;[\s\S]*overflow: hidden;/);
  assert.match(styles, /\.hero-scene-canvas canvas \{ pointer-events: auto; touch-action: pan-y; \}/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*\.hero-scene \{ inset: 34% -22% 68px -18%;/);
  assert.match(styles, /\.hero-copy \{ position: relative; z-index: 2;/);
  assert.match(source, />REQUEST ROUTE IQ</);
  assert.match(source, />See How Route IQ Works</);
});

test("current product claims, synthetic ProductView, and CRM request UX remain intact", () => {
  const source = read("src/main.jsx");

  assert.match(source, /U\.S\. PATENT PENDING TECHNOLOGY/);
  assert.match(source, /Prometheus\.IQ Representative Intelligence/);
  assert.match(source, /The representative intelligence layer for outside sales/);
  assert.match(source, /what representatives or leaders need to understand more clearly/);
  assert.match(source, /A map treats representatives as interchangeable/);
  assert.match(source, /Preferences are hypotheses, not proof/);
  assert.match(source, /Synthetic product view\. No customer or representative data is shown\./);
  assert.match(source, /<SectionLabel>Cross-industry configuration<\/SectionLabel>/);
  assert.match(source, /Success appears only after durable acceptance/);
  assert.match(source, /You will receive a unique receipt/);
  assert.doesNotMatch(source, /Prometheus \/ Active Product|Probability is a governed method|Credibility starts with saying what is not proven/);
  assert.doesNotMatch(source, /Fitness Connection|\bGaia\b|\bAthena\b|franchise/i);
  assert.doesNotMatch(source, /\b(?:customer|client|partner|pilot|sponsor|endorser)\s+(?:logo|testimonial|story|spotlight|case study|showcase|endorsement)\b|\b(?:trusted by|used by|deployed (?:at|with)|launch customer|design partner|official partner|active pilot|current customer)\b/i);
});
