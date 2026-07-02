import * as THREE from "./vendor/three.module.js";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function stateColor(voiceState) {
  return {
    listening: 0x5f9fd8,
    thinking: 0xd88a3d,
    speaking: 0x54d69f
  }[voiceState] || 0xa66a37;
}

function stateIntensity(voiceState) {
  return {
    listening: 0.78,
    thinking: 0.9,
    speaking: 0.96
  }[voiceState] || 0.62;
}

function makeStarField({ count, radius, seed, size, opacity }) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const r = radius * Math.cbrt(random());
    const theta = random() * Math.PI * 2;
    const phi = Math.acos((random() * 2) - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * 0.62;
    const z = -Math.abs(r * Math.sin(phi) * Math.sin(theta)) - 2.5;
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;

    const warmth = random();
    const brightness = 0.46 + random() * 0.44;
    colors[index * 3] = brightness * (warmth > 0.78 ? 1 : 0.72);
    colors[index * 3 + 1] = brightness * (warmth > 0.78 ? 0.78 : 0.9);
    colors[index * 3 + 2] = brightness * (warmth > 0.78 ? 0.56 : 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false
  }));
}

function makeUnifiedDust({ count, seed }) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const gold = new THREE.Color(0xc47a3e);
  const ember = new THREE.Color(0xffb06a);
  const deep = new THREE.Color(0x36504a);

  for (let index = 0; index < count; index += 1) {
    const side = random() > 0.5 ? 1 : -1;
    const angle = (random() - 0.5) * Math.PI * 0.54;
    const radius = 1.05 + random() * 5.4;
    const pull = Math.pow(random(), 2.2);
    const x = Math.cos(angle) * radius * side;
    const y = (random() - 0.5) * (0.05 + pull * 0.42);
    const z = Math.sin(angle) * radius * 0.28 - pull * 1.2;
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;

    const mix = random();
    const color = mix > 0.7 ? ember : mix > 0.18 ? gold : deep;
    const brightness = 0.16 + random() * 0.36;
    colors[index * 3] = color.r * brightness;
    colors[index * 3 + 1] = color.g * brightness;
    colors[index * 3 + 2] = color.b * brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    size: 0.014,
    vertexColors: true,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
}

function makeAccretionBand({ radius, tube, color, opacity, tilt, scaleY = 0.16 }) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 18, 260),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mesh.rotation.x = tilt;
  mesh.scale.y = scaleY;
  return mesh;
}

function makeSoftDisc({ radius, color, opacity }) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 128),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  return mesh;
}

export function createPrometheusScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.048);

  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 90);
  camera.position.set(0, 0.14, 8.7);

  const cosmos = new THREE.Group();
  const gravityWell = new THREE.Group();
  const lens = new THREE.Group();
  scene.add(cosmos, gravityWell, lens);

  const farStars = makeStarField({ count: 2200, radius: 34, seed: 1309, size: 0.012, opacity: 0.58 });
  const nearStars = makeStarField({ count: 720, radius: 22, seed: 2603, size: 0.018, opacity: 0.72 });
  cosmos.add(farStars, nearStars);

  const nebula = makeSoftDisc({ radius: 9.8, color: 0x2a1710, opacity: 0.1 });
  nebula.position.set(0, -0.08, -1.8);
  nebula.scale.set(1.9, 0.42, 1);
  cosmos.add(nebula);

  const dust = makeUnifiedDust({ count: 3200, seed: 8117 });
  gravityWell.add(dust);

  const horizonShadow = new THREE.Mesh(
    new THREE.SphereGeometry(1.02, 128, 128),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1 })
  );
  horizonShadow.scale.set(1, 1, 0.42);
  gravityWell.add(horizonShadow);

  const photonRim = makeAccretionBand({ radius: 1.14, tube: 0.012, color: 0xf2bd8a, opacity: 0.34, tilt: 1.37, scaleY: 0.22 });
  const innerBand = makeAccretionBand({ radius: 1.92, tube: 0.03, color: 0xd7894c, opacity: 0.28, tilt: 1.35 });
  const outerBand = makeAccretionBand({ radius: 3.02, tube: 0.055, color: 0xc07038, opacity: 0.22, tilt: 1.34, scaleY: 0.12 });
  const extendedPlane = makeAccretionBand({ radius: 4.58, tube: 0.046, color: 0xa96236, opacity: 0.18, tilt: 1.33, scaleY: 0.075 });
  gravityWell.add(extendedPlane, outerBand, innerBand, photonRim);

  const verticalLens = makeAccretionBand({ radius: 1.88, tube: 0.018, color: 0xb8794a, opacity: 0.14, tilt: 0.03, scaleY: 0.54 });
  verticalLens.rotation.z = Math.PI / 2;
  lens.add(verticalLens);

  const volumetricGlow = makeSoftDisc({ radius: 4.4, color: 0x8d542e, opacity: 0.12 });
  volumetricGlow.position.z = -0.22;
  volumetricGlow.scale.set(1.65, 0.34, 1);
  gravityWell.add(volumetricGlow);

  const stateWave = makeAccretionBand({ radius: 2.28, tube: 0.018, color: 0xa66a37, opacity: 0.1, tilt: 1.31, scaleY: 0.13 });
  gravityWell.add(stateWave);

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(box.width, 1), Math.max(box.height, 1), false);
    camera.aspect = Math.max(box.width, 1) / Math.max(box.height, 1);
    camera.updateProjectionMatrix();
  };

  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();
  let raf = 0;

  const animate = () => {
    const time = clock.getElapsedTime();
    const voiceState = document.body.dataset.voice || "idle";
    const color = stateColor(voiceState);
    const intensity = stateIntensity(voiceState);
    const breath = 1 + Math.sin(time * 0.22) * 0.006;

    cosmos.rotation.y = time * 0.0018;
    farStars.material.opacity = 0.48 + Math.sin(time * 0.11) * 0.03;
    nearStars.material.opacity = 0.62 + Math.sin(time * 0.15) * 0.025;
    nebula.material.opacity = 0.08 + Math.sin(time * 0.09) * 0.018;

    gravityWell.scale.set(breath, breath, breath);
    gravityWell.rotation.z = Math.sin(time * 0.036) * 0.012;
    dust.rotation.z = time * 0.006;
    dust.rotation.y = time * 0.012;

    extendedPlane.rotation.z = time * 0.01;
    outerBand.rotation.z = time * 0.014;
    innerBand.rotation.z = -time * 0.018;
    photonRim.rotation.z = time * 0.012;
    verticalLens.rotation.y = Math.sin(time * 0.08) * 0.025;

    stateWave.material.color.setHex(color);
    stateWave.material.opacity = 0.08 + intensity * 0.12;
    stateWave.rotation.z = time * (voiceState === "speaking" ? 0.03 : 0.015);
    volumetricGlow.material.color.setHex(color);
    volumetricGlow.material.opacity = voiceState === "idle" || voiceState === "standby" ? 0.08 : 0.12 + intensity * 0.06;

    const speakingGreen = voiceState === "speaking";
    const thinkingAmber = voiceState === "thinking";
    const listeningBlue = voiceState === "listening";
    photonRim.material.color.setHex(speakingGreen ? 0x72dca7 : thinkingAmber ? 0xe19a4b : listeningBlue ? 0x80b7e5 : 0xf0b476);
    innerBand.material.color.setHex(speakingGreen ? 0x58c891 : thinkingAmber ? 0xd6813e : listeningBlue ? 0x5d94c5 : 0xc6763d);
    outerBand.material.opacity = 0.18 + intensity * 0.04;
    innerBand.material.opacity = 0.22 + intensity * 0.07;
    photonRim.material.opacity = 0.28 + intensity * 0.08;

    camera.position.y = 0.14 + Math.sin(time * 0.055) * 0.026;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };

  animate();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose?.();
        object.material?.dispose?.();
      });
    }
  };
}
