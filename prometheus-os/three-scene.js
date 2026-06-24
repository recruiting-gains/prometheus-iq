import * as THREE from "./vendor/three.module.js";

export function createPrometheusScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.set(0, 1.2, 8);

  const root = new THREE.Group();
  const globeGroup = new THREE.Group();
  const routesGroup = new THREE.Group();
  const nodesGroup = new THREE.Group();
  root.add(globeGroup, routesGroup, nodesGroup);
  scene.add(root);

  scene.add(new THREE.AmbientLight(0x41f2ff, 0.5));
  const orangeLight = new THREE.PointLight(0xff8a1f, 3.7, 18);
  orangeLight.position.set(2.5, 2.5, 4.5);
  scene.add(orangeLight);
  const cyanLight = new THREE.PointLight(0x36e8ff, 2.2, 16);
  cyanLight.position.set(-3.5, 1.8, 3.2);
  scene.add(cyanLight);

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1.92, 72, 72),
    new THREE.MeshStandardMaterial({
      color: 0x0d332e,
      emissive: 0x0a3b3d,
      emissiveIntensity: 0.85,
      metalness: 0.28,
      roughness: 0.22,
      transparent: true,
      opacity: 0.34,
      wireframe: true
    })
  );
  globeGroup.add(globe);

  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 1.38, 5, 1, false),
    new THREE.MeshStandardMaterial({
      color: 0xff8a1f,
      emissive: 0xff4c1a,
      emissiveIntensity: 2.25,
      roughness: 0.2,
      metalness: 0.16
    })
  );
  core.rotation.z = Math.PI;
  core.position.set(0, 0.12, 0);
  root.add(core);

  const innerCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff0cf,
      emissiveIntensity: 2,
      roughness: 0.08
    })
  );
  innerCore.position.set(0, -0.24, 0.06);
  root.add(innerCore);

  const ringMaterial = new THREE.LineBasicMaterial({ color: 0x43f0ff, transparent: true, opacity: 0.58 });
  for (let i = 0; i < 5; i += 1) {
    const points = [];
    const radius = 2.25 + i * 0.34;
    for (let j = 0; j <= 160; j += 1) {
      const angle = (j / 160) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.12, Math.sin(angle) * 0.1));
    }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMaterial);
    ring.rotation.x = Math.PI / 2 + i * 0.17;
    ring.rotation.z = i * 0.42;
    globeGroup.add(ring);
  }

  const nodeGeometry = new THREE.SphereGeometry(0.045, 12, 12);
  const nodeMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x43f0ff, emissive: 0x18d6ff, emissiveIntensity: 1.3 }),
    new THREE.MeshStandardMaterial({ color: 0xffb13b, emissive: 0xff781f, emissiveIntensity: 1.4 }),
    new THREE.MeshStandardMaterial({ color: 0x2bd3b2, emissive: 0x18b69d, emissiveIntensity: 1.1 })
  ];
  const nodes = [];
  for (let i = 0; i < 64; i += 1) {
    const node = new THREE.Mesh(nodeGeometry, nodeMaterials[i % nodeMaterials.length]);
    const angle = i * 2.399;
    const y = ((i % 17) - 8) * 0.17;
    const radius = 2.35 + (i % 9) * 0.13;
    node.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.48);
    nodes.push(node);
    nodesGroup.add(node);
  }

  const routeMaterials = [
    new THREE.LineBasicMaterial({ color: 0xffc247, transparent: true, opacity: 0.78 }),
    new THREE.LineBasicMaterial({ color: 0x43f0ff, transparent: true, opacity: 0.46 })
  ];

  for (let i = 0; i < 20; i += 1) {
    const start = nodes[(i * 2) % nodes.length].position;
    const end = nodes[(i * 5 + 11) % nodes.length].position;
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mid.y += 0.35 + (i % 4) * 0.18;
    mid.z += 0.26;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(42)), routeMaterials[i % 2]);
    routesGroup.add(line);
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
    root.rotation.y = time * 0.13;
    globeGroup.rotation.y = time * 0.18;
    routesGroup.rotation.z = Math.sin(time * 0.28) * 0.08;
    nodesGroup.rotation.y = -time * 0.05;
    core.rotation.y = time * 0.95;
    core.scale.setScalar(1 + Math.sin(time * 2.3) * 0.07);
    innerCore.scale.setScalar(1 + Math.sin(time * 3.2) * 0.1);
    nodes.forEach((node, index) => {
      node.scale.setScalar(1 + Math.sin(time * 2.4 + index * 0.7) * 0.34);
    });
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
