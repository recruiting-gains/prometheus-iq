import * as THREE from "./vendor/three.module.js";

function makeStarField(count, radius, color, size) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const base = new THREE.Color(color);

  for (let index = 0; index < count; index += 1) {
    const r = radius * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    positions[index * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = r * Math.cos(phi) * 0.58;
    positions[index * 3 + 2] = -Math.abs(r * Math.sin(phi) * Math.sin(theta)) - 3;

    const brightness = 0.58 + Math.random() * 0.42;
    colors[index * 3] = base.r * brightness;
    colors[index * 3 + 1] = base.g * brightness;
    colors[index * 3 + 2] = base.b * brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false
  });
  return new THREE.Points(geometry, material);
}

function makeDustBand(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const gold = new THREE.Color(0xd99b55);
  const blue = new THREE.Color(0x5d9fff);

  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.2 + Math.random() * 5.9;
    const drift = (Math.random() - 0.5) * 0.28;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = drift;
    positions[index * 3 + 2] = Math.sin(angle) * radius * 0.12;

    const color = Math.random() > 0.18 ? gold : blue;
    const brightness = 0.32 + Math.random() * 0.34;
    colors[index * 3] = color.r * brightness;
    colors[index * 3 + 1] = color.g * brightness;
    colors[index * 3 + 2] = color.b * brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.018,
    vertexColors: true,
    transparent: true,
    opacity: 0.54,
    depthWrite: false
  });
  return new THREE.Points(geometry, material);
}

function makeRing({ radius, tube, color, opacity, tilt = 1.34 }) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 24, 220),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  mesh.rotation.x = tilt;
  return mesh;
}

export function createPrometheusScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 0.18, 8.2);

  const root = new THREE.Group();
  const horizon = new THREE.Group();
  const environment = new THREE.Group();
  scene.add(environment, root);
  root.add(horizon);

  environment.add(makeStarField(1500, 25, 0xdff8ff, 0.017));
  environment.add(makeStarField(600, 18, 0x9edfff, 0.012));

  const dust = makeDustBand(1800);
  horizon.add(dust);

  const outerGold = makeRing({ radius: 2.55, tube: 0.045, color: 0xd79a54, opacity: 0.32 });
  const innerGold = makeRing({ radius: 1.82, tube: 0.032, color: 0xf1bd78, opacity: 0.26, tilt: 1.38 });
  const lensBlue = makeRing({ radius: 2.08, tube: 0.018, color: 0x68b9ff, opacity: 0.12, tilt: 1.31 });
  horizon.add(outerGold, innerGold, lensBlue);

  const shadow = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, 96, 96),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.96 })
  );
  shadow.scale.set(1.0, 1.0, 0.5);
  horizon.add(shadow);

  const lensGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 96, 96),
    new THREE.MeshBasicMaterial({
      color: 0x1b342b,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  lensGlow.scale.set(1.1, 1.1, 0.4);
  horizon.add(lensGlow);

  const particleGeometry = new THREE.SphereGeometry(0.018, 8, 8);
  const particleMaterial = new THREE.MeshBasicMaterial({
    color: 0xf0b766,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending
  });
  const particles = [];
  for (let index = 0; index < 54; index += 1) {
    const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
    particle.userData = {
      angle: Math.random() * Math.PI * 2,
      radius: 1.45 + Math.random() * 2.7,
      speed: 0.045 + Math.random() * 0.075,
      lift: (Math.random() - 0.5) * 0.18
    };
    particles.push(particle);
    horizon.add(particle);
  }

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
    const stateColor = {
      listening: 0x6dbdff,
      thinking: 0xf2aa4c,
      speaking: 0x59ffc0
    }[voiceState] || 0xd49a52;

    horizon.rotation.z = Math.sin(time * 0.07) * 0.018;
    dust.rotation.y = time * 0.025;
    dust.rotation.z = time * 0.018;
    outerGold.rotation.z = time * 0.045;
    innerGold.rotation.z = -time * 0.036;
    lensBlue.rotation.z = time * 0.028;
    lensBlue.material.color.setHex(stateColor);
    lensBlue.material.opacity = voiceState === "speaking" ? 0.22 : voiceState === "listening" ? 0.16 : 0.1;
    lensGlow.material.color.setHex(stateColor);
    lensGlow.material.opacity = voiceState === "speaking" ? 0.3 : voiceState === "thinking" ? 0.24 : 0.18;

    const breathe = 1 + Math.sin(time * 0.52) * 0.012;
    horizon.scale.setScalar(breathe);

    for (const particle of particles) {
      particle.userData.angle += particle.userData.speed * 0.01;
      const angle = particle.userData.angle + time * particle.userData.speed;
      const radius = particle.userData.radius;
      particle.position.set(
        Math.cos(angle) * radius,
        particle.userData.lift + Math.sin(angle * 2.1 + time * 0.15) * 0.025,
        Math.sin(angle) * radius * 0.12
      );
      particle.material.color.setHex(stateColor);
      particle.material.opacity = voiceState === "speaking" ? 0.78 : 0.45;
    }

    environment.rotation.y = time * 0.004;
    camera.position.y = 0.18 + Math.sin(time * 0.12) * 0.035;
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
    }
  };
}
