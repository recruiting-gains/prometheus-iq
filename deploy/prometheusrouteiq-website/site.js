import * as THREE from "./vendor/three.module.js";
import { initializeWebsiteAttribution } from "./website-attribution.js";
import {
  buildEnterpriseLeadMailto,
  createEnterpriseLeadIntake,
  OPERATING_PROFILE_OPTIONS
} from "./enterprise-lead-intake.js";

const websiteAttributionSession = initializeWebsiteAttribution();

const canvas = document.querySelector("#core");
let renderer;
const supportsWebGl = (() => {
  try {
    return Boolean(canvas?.getContext("webgl2") || canvas?.getContext("webgl") || canvas?.getContext("experimental-webgl"));
  } catch {
    return false;
  }
})();
if (supportsWebGl) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    renderer = null;
  }
}

if (!renderer) {
  document.body.classList.add("webgl-unavailable");
  renderer = {
    setPixelRatio() {},
    setSize() {},
    render() {}
  };
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
camera.position.set(0, 1.2, 8.4);

const heatUniforms = {
  uTime: { value: 0 },
  uScroll: { value: 0 }
};

const heatPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 13, 96, 56),
  new THREE.ShaderMaterial({
    uniforms: heatUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uScroll;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin((p.x * 0.9) + uTime * 1.6) * 0.08;
        p.z += sin((p.y * 1.4) - uTime * 1.1 + uScroll * 4.0) * 0.08;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uScroll;
      varying vec2 vUv;
      float wave(vec2 p, float speed, float scale) {
        return sin((p.x * scale) + (p.y * scale * 0.6) + uTime * speed);
      }
      void main() {
        vec2 p = vUv;
        float rise = smoothstep(0.0, 1.0, p.y);
        float flame = wave(p, 2.4, 18.0) * 0.5 + wave(p.yx, -1.8, 13.0) * 0.5;
        flame = smoothstep(0.08, 0.96, flame * 0.5 + 0.5 + rise * 0.5);
        vec3 orange = vec3(1.0, 0.28, 0.07);
        vec3 gold = vec3(1.0, 0.77, 0.18);
        vec3 teal = vec3(0.05, 0.9, 0.62);
        vec3 color = mix(orange, gold, rise);
        color = mix(color, teal, smoothstep(0.78, 1.0, p.x + sin(uTime * 0.4) * 0.12) * 0.22);
        float alpha = flame * (0.13 + uScroll * 0.16) * smoothstep(0.0, 0.3, p.y) * (1.0 - smoothstep(0.9, 1.0, p.y));
        gl_FragColor = vec4(color, alpha);
      }
    `
  })
);
heatPlane.position.set(0, 0.3, -8.2);
scene.add(heatPlane);

const rig = new THREE.Group();
scene.add(rig);

const group = new THREE.Group();
rig.add(group);

const warm = new THREE.PointLight(0xff8a38, 8, 14);
warm.position.set(-2.8, 2.8, 3.4);
scene.add(warm);

const teal = new THREE.PointLight(0x27e0a0, 5, 16);
teal.position.set(3.8, -2.2, 4);
scene.add(teal);

scene.add(new THREE.AmbientLight(0x27453a, 2.6));

const floor = new THREE.GridHelper(18, 36, 0x27e0a0, 0x1f5a47);
floor.position.y = -2.9;
floor.position.z = -1.4;
floor.material.transparent = true;
floor.material.opacity = 0.18;
scene.add(floor);

const flameMat = new THREE.MeshPhysicalMaterial({
  color: 0xff7438,
  roughness: 0.28,
  metalness: 0.08,
  transmission: 0.08,
  thickness: 0.5,
  emissive: 0x5a1707,
  emissiveIntensity: 0.42
});

const innerMat = new THREE.MeshPhysicalMaterial({
  color: 0xffd76c,
  roughness: 0.2,
  metalness: 0.04,
  emissive: 0x573a04,
  emissiveIntensity: 0.7
});

const coreMat = new THREE.MeshBasicMaterial({ color: 0xf7fff6 });

const outer = new THREE.Mesh(new THREE.SphereGeometry(1.25, 64, 64), flameMat);
outer.scale.set(0.9, 1.45, 0.32);
outer.position.y = 0.25;
group.add(outer);

const point = new THREE.Mesh(new THREE.ConeGeometry(0.92, 2.4, 64), flameMat);
point.position.set(0.25, 1.35, 0);
point.rotation.z = -0.34;
point.scale.set(0.76, 1, 0.32);
group.add(point);

const inner = new THREE.Mesh(new THREE.SphereGeometry(0.74, 48, 48), innerMat);
inner.scale.set(0.82, 1.12, 0.28);
inner.position.set(-0.18, 0.08, 0.04);
group.add(inner);

const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 48), coreMat);
core.scale.set(0.95, 1.18, 0.34);
core.position.set(-0.18, -0.24, 0.12);
group.add(core);

const platform = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 0.15, 0.55),
  new THREE.MeshPhysicalMaterial({ color: 0x174b3a, roughness: 0.38, metalness: 0.12, emissive: 0x0b3528, emissiveIntensity: 0.45 })
);
platform.position.y = -1.55;
group.add(platform);

const glowMat = new THREE.MeshBasicMaterial({
  color: 0xff7438,
  transparent: true,
  opacity: 0.13,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const glowShell = new THREE.Mesh(new THREE.SphereGeometry(1.82, 64, 64), glowMat);
glowShell.scale.set(0.9, 1.46, 0.42);
glowShell.position.y = 0.18;
group.add(glowShell);

const ringGroup = new THREE.Group();
group.add(ringGroup);

const ringMat = new THREE.LineBasicMaterial({ color: 0xffd76c, transparent: true, opacity: 0.36 });
for (let i = 0; i < 5; i += 1) {
  const ring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      new THREE.EllipseCurve(0, 0, 1.7 + i * 0.45, 0.38 + i * 0.11, 0, Math.PI * 2, false, 0).getPoints(128)
        .map((p) => new THREE.Vector3(p.x, p.y, -0.8 - i * 0.14))
    ),
    ringMat
  );
  ring.rotation.x = Math.PI * 0.5 + i * 0.08;
  ring.rotation.z = i * 0.44;
  ringGroup.add(ring);
}

const torusGroup = new THREE.Group();
group.add(torusGroup);

const torusMaterials = [
  new THREE.MeshBasicMaterial({ color: 0x27e0a0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xffd76c, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xff7438, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
];

for (let i = 0; i < 7; i += 1) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(1.45 + i * 0.22, 0.008 + i * 0.001, 12, 160),
    torusMaterials[i % torusMaterials.length]
  );
  torus.rotation.x = Math.PI * 0.5 + i * 0.22;
  torus.rotation.y = i * 0.36;
  torus.rotation.z = i * 0.18;
  torus.userData = { spin: 0.12 + i * 0.035, phase: i * 0.7 };
  torusGroup.add(torus);
}

const routeMat = new THREE.LineBasicMaterial({ color: 0x27e0a0, transparent: true, opacity: 0.62 });
const routeCurves = [];
for (let i = 0; i < 18; i += 1) {
  const points = [];
  const side = i % 2 === 0 ? -1 : 1;
  const y = -1.1 + Math.random() * 2.9;
  points.push(new THREE.Vector3(0, y * 0.25, -0.08));
  points.push(new THREE.Vector3(side * (1.4 + Math.random() * 1.2), y, -0.18 - Math.random() * 0.5));
  points.push(new THREE.Vector3(side * (2.4 + Math.random() * 2.6), y + (Math.random() - 0.5) * 1.6, -0.4 - Math.random() * 1.4));
  const curve = new THREE.CatmullRomCurve3(points);
  routeCurves.push(curve);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), routeMat);
  group.add(line);
}

const tracerGroup = new THREE.Group();
group.add(tracerGroup);
routeCurves.slice(0, 10).forEach((curve, index) => {
  const tracer = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 16),
    new THREE.MeshBasicMaterial({
      color: index % 2 === 0 ? 0xffd76c : 0x27e0a0,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending
    })
  );
  tracer.userData = { curve, phase: index / 10, speed: 0.09 + index * 0.012 };
  tracerGroup.add(tracer);
});

const fireRibbonGroup = new THREE.Group();
scene.add(fireRibbonGroup);

const makeRibbon = (index) => {
  const ribbonPoints = [];
  const side = index % 2 === 0 ? -1 : 1;
  for (let i = 0; i < 90; i += 1) {
    const a = i / 89;
    const swirl = a * Math.PI * (2.8 + index * 0.18);
    ribbonPoints.push(new THREE.Vector3(
      side * (Math.cos(swirl) * (1.1 + a * 4.2) + index * 0.1),
      -3.2 + a * 7.2 + Math.sin(swirl * 0.6) * 0.36,
      -4.6 + Math.sin(swirl) * (0.4 + a * 1.2)
    ));
  }
  const ribbonColor = index % 3 === 0 ? 0xff7438 : index % 3 === 1 ? 0xffd76c : 0x27e0a0;
  const ribbon = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(ribbonPoints),
    new THREE.LineBasicMaterial({
      color: ribbonColor,
      transparent: true,
      opacity: index % 3 === 2 ? 0.22 : 0.34,
      blending: THREE.AdditiveBlending
    })
  );
  ribbon.userData = { speed: 0.18 + index * 0.035, baseX: side * (2.8 + index * 0.12) };
  return ribbon;
};

for (let i = 0; i < 14; i += 1) {
  const ribbon = makeRibbon(i);
  ribbon.position.x = ribbon.userData.baseX;
  ribbon.position.y = -0.4 + (i % 4) * 0.28;
  fireRibbonGroup.add(ribbon);
}

const signalGroup = new THREE.Group();
scene.add(signalGroup);

const cityGroup = new THREE.Group();
scene.add(cityGroup);

const blockMat = new THREE.MeshPhysicalMaterial({
  color: 0x0e3428,
  roughness: 0.46,
  metalness: 0.1,
  emissive: 0x061b14,
  emissiveIntensity: 0.35
});

const blockHotMat = new THREE.MeshPhysicalMaterial({
  color: 0x164f3d,
  roughness: 0.36,
  metalness: 0.16,
  emissive: 0x104d37,
  emissiveIntensity: 0.85
});

for (let i = 0; i < 44; i += 1) {
  const col = (i % 11) - 5;
  const row = Math.floor(i / 11) - 2;
  const height = 0.12 + ((i * 17) % 9) * 0.055;
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, height, 0.26),
    i % 7 === 0 ? blockHotMat : blockMat
  );
  block.position.set(col * 0.58 + (row % 2) * 0.18, -2.75 + height * 0.5, -3.8 - row * 0.72);
  block.userData = { phase: i * 0.19, baseHeight: height };
  cityGroup.add(block);
}

const nodeMat = new THREE.MeshBasicMaterial({ color: 0x27e0a0 });
const verifiedMat = new THREE.MeshBasicMaterial({ color: 0xffd76c });
const beaconMat = new THREE.MeshBasicMaterial({
  color: 0x27e0a0,
  transparent: true,
  opacity: 0.22,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const nodePositions = [
  [-3.8, -1.25, -1.4, "AUTO"],
  [-2.4, 0.6, -2.2, "APT"],
  [-0.8, -1.9, -2.7, "MED"],
  [1.4, 0.85, -2.1, "SHOP"],
  [3.2, -0.65, -1.5, "LEAD"],
  [4.3, 1.35, -2.9, "GPS"],
  [-4.6, 1.15, -3.1, "VISIT"]
];

nodePositions.forEach(([x, y, z], index) => {
  const node = new THREE.Group();
  node.position.set(x, y, z);

  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 32), beaconMat.clone());
  pulse.userData = { phase: index * 0.6 };
  node.add(pulse);

  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 24), index % 3 === 0 ? verifiedMat : nodeMat);
  node.add(dot);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.5, 12),
    new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0xffd76c : 0x27e0a0, transparent: true, opacity: 0.75 })
  );
  stem.position.y = -0.28;
  node.add(stem);

  signalGroup.add(node);
});

const connectionMat = new THREE.LineBasicMaterial({
  color: 0xffd76c,
  transparent: true,
  opacity: 0.42,
  blending: THREE.AdditiveBlending
});

nodePositions.forEach(([x, y, z], index) => {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.4, -0.2),
    new THREE.Vector3(x * 0.45, y + 0.6, z * 0.65),
    new THREE.Vector3(x, y, z)
  ]);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getPoints(60)), connectionMat.clone());
  line.userData = { phase: index * 0.4 };
  signalGroup.add(line);
});

const satelliteGroup = new THREE.Group();
scene.add(satelliteGroup);

for (let i = 0; i < 9; i += 1) {
  const satellite = new THREE.Group();
  const radius = 0.05 + (i % 3) * 0.018;
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 20),
    new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xffd76c : 0x27e0a0,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 3.2, 20, 20),
    new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xff7438 : 0x27e0a0,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  satellite.add(halo, orb);
  satellite.userData = {
    orbitRadius: 2.2 + i * 0.36,
    speed: 0.24 + i * 0.025,
    phase: i * 0.74,
    y: -0.8 + (i % 5) * 0.42
  };
  satelliteGroup.add(satellite);
}

const particleGeo = new THREE.BufferGeometry();
const count = 900;
const positions = new Float32Array(count * 3);
const emberBase = new Float32Array(count * 3);
const colors = new Float32Array(count * 3);
const colorA = new THREE.Color(0xff7438);
const colorB = new THREE.Color(0x27e0a0);
for (let i = 0; i < count; i += 1) {
  const radius = 1.8 + Math.random() * 6.2;
  const angle = Math.random() * Math.PI * 2;
  positions[i * 3] = Math.cos(angle) * radius;
  positions[i * 3 + 1] = -3.2 + Math.random() * 7.4;
  positions[i * 3 + 2] = Math.sin(angle) * radius - 2.4;
  emberBase[i * 3] = positions[i * 3];
  emberBase[i * 3 + 1] = positions[i * 3 + 1];
  emberBase[i * 3 + 2] = positions[i * 3 + 2];
  const c = colorA.clone().lerp(colorB, Math.random() * 0.35);
  colors[i * 3] = c.r;
  colors[i * 3 + 1] = c.g;
  colors[i * 3 + 2] = c.b;
}
particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
const particles = new THREE.Points(
  particleGeo,
  new THREE.PointsMaterial({
    size: 0.046,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
);
scene.add(particles);

const explosionGeo = new THREE.BufferGeometry();
const explosionCount = 760;
const explosionPositions = new Float32Array(explosionCount * 3);
const explosionDirections = new Float32Array(explosionCount * 3);
const explosionColors = new Float32Array(explosionCount * 3);
const explosionA = new THREE.Color(0xfff3c5);
const explosionB = new THREE.Color(0xff7438);
const explosionC = new THREE.Color(0x27e0a0);

for (let i = 0; i < explosionCount; i += 1) {
  const index = i * 3;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos((Math.random() * 2) - 1);
  const speed = 1.6 + Math.random() * 6.8;
  const x = Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);

  explosionPositions[index] = 0;
  explosionPositions[index + 1] = -0.08;
  explosionPositions[index + 2] = 0;
  explosionDirections[index] = x * speed;
  explosionDirections[index + 1] = y * speed;
  explosionDirections[index + 2] = z * speed;

  const color = i % 9 === 0
    ? explosionC
    : explosionA.clone().lerp(explosionB, Math.random() * 0.82);
  explosionColors[index] = color.r;
  explosionColors[index + 1] = color.g;
  explosionColors[index + 2] = color.b;
}

explosionGeo.setAttribute("position", new THREE.BufferAttribute(explosionPositions, 3));
explosionGeo.setAttribute("color", new THREE.BufferAttribute(explosionColors, 3));
const explosionMaterial = new THREE.PointsMaterial({
  size: 0.085,
  vertexColors: true,
  transparent: true,
  opacity: 1,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const explosion = new THREE.Points(explosionGeo, explosionMaterial);
scene.add(explosion);

const resize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};
window.addEventListener("resize", resize);
resize();

let targetScroll = 0;
let smoothScroll = 0;
let previousScroll = 0;
let scrollVelocity = 0;
let orbit = 0;
const introDuration = 3.1;
const setMaterialOpacity = (object, opacity) => {
  object.traverse((child) => {
    const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];
    materials.forEach((material) => {
      if (material.userData.baseOpacity === undefined) {
        material.userData.baseOpacity = material.opacity === undefined ? 1 : material.opacity;
      }
      material.transparent = true;
      material.opacity = material.userData.baseOpacity * opacity;
    });
  });
  object.visible = opacity > 0.03;
};

const tick = (time) => {
  targetScroll = window.scrollY / (document.body.scrollHeight - window.innerHeight);
  document.body.classList.toggle("is-past-hero", window.scrollY > window.innerHeight * 0.45);
  scrollVelocity += (targetScroll - previousScroll - scrollVelocity) * 0.18;
  previousScroll = targetScroll;
  smoothScroll += (targetScroll - smoothScroll) * 0.1;

  const t = time * 0.001;
  const introRaw = Math.min(1, t / introDuration);
  const introOut = 1 - introRaw;
  const introEase = 1 - Math.pow(1 - introRaw, 3);
  const speedBoost = Math.min(1.6, Math.abs(scrollVelocity) * 22);
  const heroFadeStart = window.innerHeight * 0.12;
  const heroFadeDistance = window.innerHeight * 0.55;
  const heroCoreVisibility = 1 - Math.min(1, Math.max(0, (window.scrollY - heroFadeStart) / heroFadeDistance));
  orbit += scrollVelocity * 12 + 0.003 + speedBoost * 0.008;
  heatUniforms.uTime.value = t;
  heatUniforms.uScroll.value = speedBoost + introOut * 1.6;

  rig.rotation.y = orbit + smoothScroll * Math.PI * 1.9 + introOut * 4.8;
  rig.rotation.x = Math.sin(t * 0.22) * 0.08 + smoothScroll * 0.22 + introOut * 0.45;

  group.rotation.y = Math.sin(t * 0.52) * 0.18 + smoothScroll * 1.5 + speedBoost * 0.55 + introOut * 7.2;
  group.rotation.x = -0.02 + smoothScroll * 0.16 + Math.sin(t * 0.85) * 0.035 + introOut * 0.36;
  group.position.x = window.innerWidth > 760 ? 0.72 - smoothScroll * 1.25 : 0;
  group.position.y = -0.2 + Math.sin(t * 0.8) * 0.07 - smoothScroll * 0.2;
  group.scale.setScalar(1.3 - smoothScroll * 0.32 + speedBoost * 0.04 + introOut * 1.9);

  glowShell.material.opacity = 0.11 + Math.sin(t * 2.8) * 0.035 + speedBoost * 0.08 + introOut * 0.28;
  core.scale.setScalar(1 + Math.sin(t * 3.1) * 0.09 + speedBoost * 0.08 + introOut * 1.2);
  ringGroup.rotation.y = -t * 0.22 - smoothScroll * 3.2;
  ringGroup.rotation.z = t * 0.12 + speedBoost * 0.4;
  torusGroup.children.forEach((torus, index) => {
    torus.rotation.x += 0.0015 + speedBoost * 0.004;
    torus.rotation.y += torus.userData.spin * 0.006 + speedBoost * 0.006;
    torus.material.opacity = 0.12 + Math.abs(Math.sin(t * 0.9 + torus.userData.phase)) * 0.14 + speedBoost * 0.05;
  });

  const pos = particleGeo.attributes.position.array;
  for (let i = 0; i < count; i += 1) {
    const index = i * 3;
    const lift = (t * (0.38 + (i % 17) * 0.01) + i * 0.013 + speedBoost * 0.7) % 7.4;
    pos[index] = emberBase[index] + Math.sin(t * 0.9 + i) * 0.08;
    pos[index + 1] = -3.5 + lift;
    pos[index + 2] = emberBase[index + 2] + Math.cos(t * 0.7 + i * 0.3) * 0.18;
  }
  particleGeo.attributes.position.needsUpdate = true;

  const explosionPos = explosionGeo.attributes.position.array;
  for (let i = 0; i < explosionCount; i += 1) {
    const index = i * 3;
    const drift = Math.sin(t * 3 + i * 0.31) * 0.08;
    explosionPos[index] = explosionDirections[index] * introEase + drift;
    explosionPos[index + 1] = -0.08 + explosionDirections[index + 1] * introEase - introEase * introEase * 1.4;
    explosionPos[index + 2] = explosionDirections[index + 2] * introEase;
  }
  explosionGeo.attributes.position.needsUpdate = true;
  explosionMaterial.opacity = Math.max(0, 1 - introRaw * 1.05);
  explosionMaterial.size = 0.085 + introOut * 0.14;

  particles.rotation.y = t * 0.085 + smoothScroll * 1.8;
  particles.rotation.x = Math.sin(t * 0.16) * 0.06 + speedBoost * 0.08;
  floor.position.z = -1.4 + (smoothScroll * 2.2) % 1.2;
  floor.material.opacity = 0.16 + speedBoost * 0.08;

  tracerGroup.children.forEach((tracer) => {
    const pct = (t * tracer.userData.speed + tracer.userData.phase + smoothScroll * 0.9) % 1;
    tracer.position.copy(tracer.userData.curve.getPointAt(pct));
    tracer.scale.setScalar(1 + speedBoost * 1.4);
  });

  cityGroup.rotation.y = -orbit * 0.12 + smoothScroll * 0.8;
  cityGroup.children.forEach((block) => {
    const pulse = 1 + Math.sin(t * 1.2 + block.userData.phase) * 0.18 + speedBoost * 0.22;
    block.scale.y = pulse;
  });

  signalGroup.rotation.y = -orbit * 0.65 + smoothScroll * 3.4;
  signalGroup.rotation.x = Math.sin(t * 0.32) * 0.06;
  signalGroup.children.forEach((child, index) => {
    if (child.type === "Group") {
      const pulse = child.children[0];
      const beat = 1 + Math.sin(t * 2.2 + pulse.userData.phase) * 0.28 + speedBoost * 0.35;
      pulse.scale.setScalar(beat);
      pulse.material.opacity = 0.16 + Math.abs(Math.sin(t * 2.2 + pulse.userData.phase)) * 0.18 + speedBoost * 0.12;
    } else if (child.type === "Line") {
      child.material.opacity = 0.26 + Math.abs(Math.sin(t * 1.4 + child.userData.phase)) * 0.26 + speedBoost * 0.12;
    }
  });

  fireRibbonGroup.rotation.y = -orbit * 0.45 + smoothScroll * 2.4;
  fireRibbonGroup.children.forEach((ribbon, index) => {
    ribbon.position.y = -0.8 + Math.sin(t * (0.7 + index * 0.02) + index) * 0.36 + speedBoost * 0.18;
    ribbon.rotation.z = Math.sin(t * ribbon.userData.speed + index) * 0.18;
    ribbon.material.opacity = (index % 3 === 2 ? 0.18 : 0.28) + speedBoost * 0.14;
  });
  setMaterialOpacity(group, heroCoreVisibility);

  satelliteGroup.rotation.y = orbit * 0.32 + smoothScroll * 1.4;
  satelliteGroup.children.forEach((satellite) => {
    const a = t * satellite.userData.speed + satellite.userData.phase + smoothScroll * 1.8;
    satellite.position.set(
      Math.cos(a) * satellite.userData.orbitRadius,
      satellite.userData.y + Math.sin(a * 1.7) * 0.18,
      Math.sin(a) * satellite.userData.orbitRadius - 1.1
    );
    satellite.scale.setScalar(1 + speedBoost * 0.35);
  });

  const cameraRadius = 8.4 - smoothScroll * 2.3 - speedBoost * 0.55 - introOut * 3.7;
  const cameraOrbit = orbit * 0.75 + smoothScroll * Math.PI * 1.25 + introOut * 2.8;
  camera.position.x = Math.sin(cameraOrbit) * cameraRadius * (window.innerWidth > 760 ? 0.6 : 0.25);
  camera.position.z = Math.cos(cameraOrbit) * cameraRadius;
  camera.position.y = 1.15 + smoothScroll * 0.7 + Math.sin(cameraOrbit * 0.8) * 0.45 + introOut * 0.9;
  camera.lookAt(0, 0.05, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};

const modalMap = {
  pilot: document.querySelector("#pilotExperience"),
  demo: document.querySelector("#demoExperience")
};
let enterpriseIntakeOpenedAt = null;

const openModal = (modal) => {
  Object.values(modalMap).forEach((item) => {
    item.classList.remove("is-open");
    item.setAttribute("aria-hidden", "true");
  });
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  const closeButton = modal.querySelector("[data-close-modal]");
  if (closeButton) closeButton.focus({ preventScroll: true });
};

const closeModals = () => {
  Object.values(modalMap).forEach((modal) => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  });
  document.body.classList.remove("modal-open");
};

document.querySelectorAll("[data-open-pilot]").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    enterpriseIntakeOpenedAt = new Date().toISOString();
    openModal(modalMap.pilot);
  });
});

document.querySelectorAll("[data-open-demo]").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openModal(modalMap.demo);
    setDemoScene(0);
  });
});

document.querySelectorAll("[data-close-modal]").forEach((trigger) => {
  trigger.addEventListener("click", closeModals);
});

Object.values(modalMap).forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModals();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModals();
});

const pilotForm = document.querySelector("#pilotForm");
const pilotSteps = [...document.querySelectorAll(".pilot-step")];
const pilotProgressText = document.querySelector("#pilotProgressText");
const pilotProgressFill = document.querySelector("#pilotProgressFill");
const pilotBack = document.querySelector("#pilotBack");
const pilotNext = document.querySelector("#pilotNext");
const pilotGenerate = document.querySelector("#pilotGenerate");
const pilotDashboard = document.querySelector("#pilotDashboard");
const pilotPreviewRequest = document.querySelector("#previewRequest");
const pilotPreviewProfile = document.querySelector("#previewProfile");
const pilotPreviewGoal = document.querySelector("#previewGoal");
const intakeStatus = document.querySelector("#intakeStatus");
let pilotStepIndex = 0;

const getPilotData = () => Object.fromEntries(new FormData(pilotForm).entries());

const requestTypeLabel = (requestType) => ({
  private_demo: "Private demo",
  beta_pilot: "Beta pilot",
  enterprise_pricing: "Enterprise pricing",
  discovery_call: "Discovery call"
})[requestType] || "Select request";

const profileLabel = (profileId, otherProfile = "") => {
  if (profileId === "future_profile") return otherProfile || "Future profile";
  return OPERATING_PROFILE_OPTIONS.find(profile => profile.profileId === profileId)?.label || "Select profile";
};

const setPilotStep = (index) => {
  pilotStepIndex = Math.max(0, Math.min(index, pilotSteps.length - 1));
  pilotSteps.forEach((step, stepIndex) => {
    step.classList.toggle("is-active", stepIndex === pilotStepIndex);
  });
  pilotProgressText.textContent = `Step ${pilotStepIndex + 1} of ${pilotSteps.length}`;
  pilotProgressFill.style.width = `${((pilotStepIndex + 1) / pilotSteps.length) * 100}%`;
  pilotBack.disabled = pilotStepIndex === 0;
  pilotNext.hidden = pilotStepIndex === pilotSteps.length - 1;
  pilotGenerate.hidden = pilotStepIndex !== pilotSteps.length - 1;
  updatePilotPreview();
};

const validatePilotStep = () => {
  const activeStep = pilotSteps[pilotStepIndex];
  const fields = [...activeStep.querySelectorAll("input, textarea, select")];
  return fields.every((field) => field.reportValidity());
};

const updatePilotPreview = () => {
  const data = getPilotData();
  pilotPreviewRequest.textContent = requestTypeLabel(data.requestType);
  pilotPreviewProfile.textContent = profileLabel(data.operatingProfileId, data.otherOperatingProfile);
  pilotPreviewGoal.textContent = data.primaryGoal || "Select primary goal";
};

pilotForm.addEventListener("input", updatePilotPreview);
pilotForm.addEventListener("change", updatePilotPreview);

pilotBack.addEventListener("click", () => setPilotStep(pilotStepIndex - 1));
pilotNext.addEventListener("click", () => {
  if (validatePilotStep()) setPilotStep(pilotStepIndex + 1);
});

const getOpportunityAreas = (goal, industry) => {
  const lowerIndustry = (industry || "").toLowerCase();
  if (goal === "Better Market Discovery") return "Events, partner sites, local traffic pockets";
  if (goal === "Better Accountability") return "Verified visits, route completion, rep adoption";
  if (goal === "Better Routing") return "Route density, qualified storefronts, territory coverage";
  if (goal === "More Leads") return "Conversation zones, follow-up paths, lead sources";
  if (lowerIndustry.includes("fitness") || lowerIndustry.includes("gym")) return "Apartments, restaurants, salons, medical offices";
  return "Storefronts, local employers, events, service businesses";
};

const getMetrics = (goal) => {
  const map = {
    "More Sales": "Sales, conversion, verified visits",
    "More Leads": "Leads, conversations, follow-ups",
    "Better Accountability": "GPS verification, visit completion",
    "Better Routing": "Route quality, stops completed",
    "Better Market Discovery": "Market opportunities, visits, outcomes"
  };
  return map[goal] || "Visits, leads, outcomes";
};

const buildPilotDashboard = () => {
  if (!validatePilotStep()) return;
  const data = getPilotData();
  const packet = createEnterpriseLeadIntake({
    formData: data,
    attributionSession: window.prometheusWebsiteAttribution?.getSession?.() || websiteAttributionSession,
    duplicateStorage: window.localStorage,
    openedAt: enterpriseIntakeOpenedAt
  });

  if (!packet.ok) {
    intakeStatus.textContent = packet.errors.join(" ");
    return;
  }

  document.querySelector("#dashboardCompany").textContent = `${packet.lead.companyName} is ready for founder review.`;
  document.querySelector("#dashboardSummary").textContent = `${packet.lead.requestLabel} captured as ${packet.lead.pipelineStage}. Founder can review ${packet.lead.requesterName}, ${packet.lead.companyName}, ${packet.lead.operatingProfile.profileLabel}, ${packet.lead.teamSize}, and ${packet.lead.primaryGoal} immediately.`;
  document.querySelector("#dashPipelineStage").textContent = packet.lead.pipelineStage;
  document.querySelector("#dashOperatingProfile").textContent = packet.lead.operatingProfile.futureProfileRequested
    ? `${packet.lead.operatingProfile.requestedProfile} -> General Outside Sales`
    : packet.lead.operatingProfile.profileLabel;
  document.querySelector("#dashTeamSize").textContent = packet.lead.teamSize;
  document.querySelector("#dashGoal").textContent = packet.lead.primaryGoal;
  document.querySelector("#dashCrmPath").textContent = packet.crmIntegration.path;
  document.querySelector("#dashLeadSource").textContent = packet.crmIntegration.attributionEvent.metadata.lead_source || "website";
  intakeStatus.textContent = packet.duplicate
    ? "Duplicate request detected locally. The founder packet is still available for review."
    : "Lead packet stored locally with Website/Social attribution and CRM attribution event metadata.";

  document.querySelector("#pilotEmail").href = buildEnterpriseLeadMailto(packet);
  pilotDashboard.classList.add("is-visible");
  pilotDashboard.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

pilotGenerate.addEventListener("click", buildPilotDashboard);
document.querySelector("#pilotReset").addEventListener("click", () => {
  pilotDashboard.classList.remove("is-visible");
  intakeStatus.textContent = "";
  setPilotStep(0);
});

setPilotStep(0);

const demoScenes = [
  {
    kicker: "Pressure Moment",
    stageTitle: "The field goes quiet. Prometheus wakes up.",
    title: "6 PM field-sales crisis",
    copy: "Appointments disappeared. The rep needs direction now, not a CRM note tomorrow.",
    signals: [["1", "The problem", "No appointment, limited time, and no clear place to go."]]
  },
  {
    kicker: "AI Route Intelligence",
    stageTitle: "Prometheus identifies the next field move.",
    title: "AI Route Intelligence activates",
    copy: "The flagship Prometheus IQ system turns territory, timing, and field context into a specific next-stop plan across outside-sales markets.",
    signals: [["1", "Best next move", "The rep sees where to walk first."], ["2", "Specific targets", "Businesses appear as qualified opportunities."]]
  },
  {
    kicker: "Opportunity Discovery",
    stageTitle: "Qualified storefronts appear across the territory.",
    title: "Opportunity Discovery",
    copy: "Prometheus highlights practical walk-in opportunities: storefronts, businesses, apartments, offices, events, and local market targets.",
    signals: [["1", "Walk first", "Start with the highest-priority stop."], ["2", "Ask for", "Know who the rep should request."], ["3", "Access type", "Understand whether the visit is walk-in ready."]]
  },
  {
    kicker: "GPS Verification",
    stageTitle: "The visit is verified at the location.",
    title: "GPS Verification",
    copy: "The rep intentionally verifies the visit. Prometheus does not need to track the entire day to prove activity.",
    signals: [["1", "Pin-drop", "The visit is confirmed."], ["2", "Accountability", "Managers see verified activity without constant check-ins."]]
  },
  {
    kicker: "Visit Logging",
    stageTitle: "The field visit becomes usable data.",
    title: "Visit Logging and Outcome Tracking",
    copy: "Conversations, leads, follow-ups, and units become simple signals that improve the next route.",
    signals: [["1", "Conversations", "Capture real field activity."], ["2", "Leads", "Track follow-up potential."], ["3", "Outcomes", "Connect visits to business results."]]
  },
  {
    kicker: "Manager Visibility",
    stageTitle: "Leadership can see the field clearly.",
    title: "Manager Visibility",
    copy: "Managers review verified visits, outcomes, and adoption signals through an enterprise-ready operating picture without slowing the rep down.",
    signals: [["1", "Verified activity", "Know what happened in the field."], ["2", "Route quality", "See whether recommendations were usable."], ["3", "Rep adoption", "Know whether the workflow is being used."]]
  },
  {
    kicker: "Learning Loop",
    stageTitle: "Every visit improves the next move.",
    title: "The loop gets smarter",
    copy: "Prometheus turns field activity into better field direction while keeping the internal intelligence protected for enterprise review.",
    signals: [["1", "Visit", "A rep goes into the field."], ["2", "Result", "The outcome is captured."], ["3", "Intelligence", "The next route improves."]]
  }
];

const demoStage = document.querySelector("#demoStage");
const demoKicker = document.querySelector("#demoKicker");
const demoStageTitle = document.querySelector("#demoStageTitle");
const demoPanelTitle = document.querySelector("#demoPanelTitle");
const demoPanelCopy = document.querySelector("#demoPanelCopy");
const demoSignals = document.querySelector("#demoSignals");
const demoProgressBar = document.querySelector("#demoProgressBar");
const demoBack = document.querySelector("#demoBack");
const demoNext = document.querySelector("#demoNext");
let demoSceneIndex = 0;

function setDemoScene(index) {
  demoSceneIndex = Math.max(0, Math.min(index, demoScenes.length - 1));
  const sceneData = demoScenes[demoSceneIndex];
  demoStage.dataset.scene = String(demoSceneIndex);
  demoKicker.textContent = sceneData.kicker;
  demoStageTitle.textContent = sceneData.stageTitle;
  demoPanelTitle.textContent = sceneData.title;
  demoPanelCopy.textContent = sceneData.copy;
  demoProgressBar.style.setProperty("--demo-progress", `${((demoSceneIndex + 1) / demoScenes.length) * 100}%`);
  demoSignals.innerHTML = sceneData.signals.map(([num, title, copy]) => (
    `<div class="step"><div>${num}</div><p><strong>${title}</strong><span>${copy}</span></p></div>`
  )).join("");
  demoBack.disabled = demoSceneIndex === 0;
  demoNext.textContent = demoSceneIndex === demoScenes.length - 1 ? "Replay Demo" : "Next Scene";
}

demoBack.addEventListener("click", () => setDemoScene(demoSceneIndex - 1));
demoNext.addEventListener("click", () => {
  if (demoSceneIndex === demoScenes.length - 1) {
    setDemoScene(0);
  } else {
    setDemoScene(demoSceneIndex + 1);
  }
});

setDemoScene(0);

requestAnimationFrame(tick);
