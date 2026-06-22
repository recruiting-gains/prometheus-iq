import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector("#field-scene");
const imageLayer = document.querySelector(".cinematic-image");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas && imageLayer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07100e, 0.065);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
  camera.position.set(0.8, 2.3, 11.5);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const world = new THREE.Group();
  world.position.set(2.9, -1.55, 0);
  world.rotation.set(-0.14, -0.18, 0.01);
  scene.add(world);

  scene.add(new THREE.HemisphereLight(0x8bdbc7, 0x07100e, 1.25));
  const keyLight = new THREE.DirectionalLight(0xf7b64c, 2.2);
  keyLight.position.set(4, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const tealLight = new THREE.PointLight(0x32b293, 15, 12, 2);
  tealLight.position.set(2, 0.5, 2.5);
  scene.add(tealLight);
  const emberLight = new THREE.PointLight(0xf0643c, 12, 10, 2);
  emberLight.position.set(-1.5, 1, 1);
  scene.add(emberLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 16),
    new THREE.MeshStandardMaterial({ color: 0x0b1c18, transparent: true, opacity: 0.18, roughness: 0.88 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.25;
  ground.receiveShadow = true;
  world.add(ground);

  const grid = new THREE.GridHelper(22, 28, 0x32b293, 0x285247);
  grid.position.y = -1.22;
  grid.material.transparent = true;
  grid.material.opacity = 0.17;
  world.add(grid);

  const routePoints = [
    new THREE.Vector3(-5.7, -1.08, 2.5),
    new THREE.Vector3(-3.6, -0.72, 1.3),
    new THREE.Vector3(-1.5, -0.46, 0.9),
    new THREE.Vector3(0.4, -0.1, -0.15),
    new THREE.Vector3(2.1, 0.12, -1.05),
    new THREE.Vector3(4.5, 0.36, -2.1)
  ];
  const routeCurve = new THREE.CatmullRomCurve3(routePoints);
  const route = new THREE.Mesh(
    new THREE.TubeGeometry(routeCurve, 150, 0.034, 8, false),
    new THREE.MeshStandardMaterial({ color: 0xf7873c, emissive: 0xf0643c, emissiveIntensity: 2.6, roughness: 0.26 })
  );
  route.castShadow = true;
  world.add(route);

  const routeHalo = new THREE.Mesh(
    new THREE.TubeGeometry(routeCurve, 150, 0.095, 8, false),
    new THREE.MeshBasicMaterial({ color: 0xf0643c, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending })
  );
  world.add(routeHalo);

  const nodeMaterial = new THREE.MeshStandardMaterial({
    color: 0x8bdbc7,
    emissive: 0x32b293,
    emissiveIntensity: 2.1,
    metalness: 0.15,
    roughness: 0.32
  });
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x32b293,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const nodes = [];

  routePoints.slice(1).forEach((point, index) => {
    const group = new THREE.Group();
    group.position.copy(point);
    const core = new THREE.Mesh(new THREE.SphereGeometry(index === 4 ? 0.16 : 0.11, 18, 18), nodeMaterial);
    core.castShadow = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.25, 32), ringMaterial.clone());
    ring.rotation.x = -Math.PI / 2;
    group.add(core, ring);
    group.userData.ring = ring;
    group.userData.baseY = point.y;
    world.add(group);
    nodes.push(group);
  });

  const intelligenceLayer = new THREE.Group();
  intelligenceLayer.position.set(0, 0.04, -0.18);
  world.add(intelligenceLayer);

  const branchMaterial = new THREE.MeshStandardMaterial({
    color: 0x32b293,
    emissive: 0x32b293,
    emissiveIntensity: 1.7,
    transparent: true,
    opacity: 0.72,
    roughness: 0.28
  });
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0x8bdbc7,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const branchCurves = [];
  const beaconRings = [];
  const branchTargets = [
    { origin: routePoints[1], target: new THREE.Vector3(-4.4, 1.2, -0.4) },
    { origin: routePoints[2], target: new THREE.Vector3(-1.9, 1.55, -2.1) },
    { origin: routePoints[3], target: new THREE.Vector3(1.15, 1.35, 1.15) },
    { origin: routePoints[4], target: new THREE.Vector3(3.6, 1.75, 0.2) }
  ];

  branchTargets.forEach(({ origin, target }) => {
    const curve = new THREE.QuadraticBezierCurve3(
      origin.clone(),
      origin.clone().lerp(target, 0.5).add(new THREE.Vector3(0, 0.65, 0)),
      target
    );
    branchCurves.push(curve);
    const branch = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.018, 6, false), branchMaterial.clone());
    intelligenceLayer.add(branch);

    const beamHeight = target.y + 1.3;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.12, beamHeight, 12, 1, true), beaconMaterial.clone());
    beam.position.set(target.x, target.y - beamHeight / 2, target.z);
    intelligenceLayer.add(beam);

    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      new THREE.MeshStandardMaterial({ color: 0xf7b64c, emissive: 0xf0643c, emissiveIntensity: 2.2, roughness: 0.24 })
    );
    beacon.position.copy(target);
    beacon.castShadow = true;
    intelligenceLayer.add(beacon);

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.3, 36), ringMaterial.clone());
    ring.position.set(target.x, -1.18, target.z);
    ring.rotation.x = -Math.PI / 2;
    intelligenceLayer.add(ring);
    beaconRings.push(ring);
  });

  const packetMaterial = new THREE.MeshBasicMaterial({ color: 0xf7b64c, blending: THREE.AdditiveBlending });
  const signalPackets = [routeCurve, routeCurve, ...branchCurves].map((curve, index) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(index < 2 ? 0.07 : 0.05, 12, 12), packetMaterial.clone());
    mesh.userData = { curve, offset: index * 0.19, speed: index < 2 ? 0.055 : 0.038 + index * 0.004 };
    intelligenceLayer.add(mesh);
    return mesh;
  });

  const dustGeometry = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i += 1) {
    dustPositions[i * 3] = THREE.MathUtils.randFloatSpread(16);
    dustPositions[i * 3 + 1] = THREE.MathUtils.randFloat(-0.8, 4.5);
    dustPositions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(10);
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({ color: 0xf7b64c, size: 0.035, transparent: true, opacity: 0.48, depthWrite: false })
  );
  world.add(dust);

  const pointer = { x: 0, y: 0 };
  const onPointerMove = (event) => {
    pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.22;
    pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.12;
  };
  if (!reducedMotion && matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
  }

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 700 ? 58 : 46;
    camera.updateProjectionMatrix();
    world.position.x = width < 700 ? 1.5 : 2.9;
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });

  if (!reducedMotion) {
    const journey = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: "main", start: "top top", end: "bottom bottom", scrub: 1.15 }
    });
    journey
      .to(camera.position, { x: 0.2, y: 1.65, z: 9.1, duration: 0.28 }, 0)
      .to(world.rotation, { x: -0.08, y: 0.04, z: -0.015, duration: 0.28 }, 0)
      .to(intelligenceLayer.rotation, { y: -0.08, z: 0.02, duration: 0.28 }, 0)
      .to(imageLayer, { scale: 1.15, xPercent: -1.8, yPercent: 1.1, duration: 0.28 }, 0)
      .to(camera.position, { x: 1.25, y: 1.15, z: 7.4, duration: 0.3 }, 0.28)
      .to(world.position, { x: 1.25, y: -1.05, z: 0.35, duration: 0.3 }, 0.28)
      .to(intelligenceLayer.position, { y: 0.24, z: 0.22, duration: 0.3 }, 0.28)
      .to(imageLayer, { opacity: 0.42, scale: 1.2, xPercent: -3.2, duration: 0.3 }, 0.28)
      .to(camera.position, { x: -0.45, y: 1.35, z: 6.35, duration: 0.23 }, 0.58)
      .to(world.rotation, { y: 0.2, z: 0.018, duration: 0.23 }, 0.58)
      .to(intelligenceLayer.rotation, { x: 0.04, y: 0.1, z: -0.025, duration: 0.23 }, 0.58)
      .to(imageLayer, { opacity: 0.24, scale: 1.22, duration: 0.23 }, 0.58)
      .to(camera.position, { x: 0.15, y: 1.75, z: 7.8, duration: 0.19 }, 0.81)
      .to(world.rotation, { x: -0.12, y: 0.07, z: 0, duration: 0.19 }, 0.81)
      .to(intelligenceLayer.position, { y: 0.1, z: -0.08, duration: 0.19 }, 0.81)
      .to(imageLayer, { opacity: 0.16, scale: 1.18, duration: 0.19 }, 0.81);

    gsap.to(".hero-copy", {
      yPercent: 18,
      opacity: 0.45,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
    gsap.to(".phone-wrap", {
      yPercent: -12,
      rotation: -1.2,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
  }

  const clock = new THREE.Clock();
  const render = () => {
    const elapsed = clock.getElapsedTime();
    if (!reducedMotion) {
      camera.rotation.y += ((pointer.x * 0.12) - camera.rotation.y) * 0.035;
      camera.rotation.x += ((pointer.y * 0.08) - camera.rotation.x) * 0.035;
      dust.rotation.y = elapsed * 0.018;
      nodes.forEach((node, index) => {
        const pulse = 1 + Math.sin(elapsed * 2.1 + index * 0.8) * 0.13;
        node.userData.ring.scale.setScalar(pulse);
        node.userData.ring.material.opacity = 0.25 + Math.sin(elapsed * 2.1 + index) * 0.09;
      });
      beaconRings.forEach((ring, index) => {
        const pulse = 1 + Math.sin(elapsed * 1.7 + index * 0.9) * 0.2;
        ring.scale.setScalar(pulse);
        ring.material.opacity = 0.2 + Math.sin(elapsed * 1.7 + index) * 0.08;
      });
      signalPackets.forEach((packet) => {
        const progress = (elapsed * packet.userData.speed + packet.userData.offset) % 1;
        packet.position.copy(packet.userData.curve.getPointAt(progress));
        packet.scale.setScalar(0.8 + Math.sin(elapsed * 4 + packet.userData.offset * 10) * 0.2);
      });
    }
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  };
  render();
}
