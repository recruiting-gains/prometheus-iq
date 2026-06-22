import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, Line, PerspectiveCamera, Stars } from "@react-three/drei";
import * as THREE from "three";

function FlameCore3D() {
  const group = useRef();
  const core = useRef();
  const outerRing = useRef();
  const innerRing = useRef();
  const routeA = useMemo(() => [
    [-4.8, -1.15, 0.1],
    [-3.2, -0.75, 0.7],
    [-1.35, -0.45, -0.2],
    [0.15, -0.15, 0.35],
    [1.7, 0.12, -0.45],
    [3.85, 0.48, 0.25]
  ], []);
  const routeB = useMemo(() => [
    [-3.6, 0.3, -1.15],
    [-1.9, 0.84, -0.55],
    [-0.2, 1.02, -1.2],
    [1.8, 1.32, -0.58],
    [3.1, 1.72, -1.15]
  ], []);
  const nodes = useMemo(() => [
    [-4.8, -1.15, 0.1],
    [-1.35, -0.45, -0.2],
    [0.15, -0.15, 0.35],
    [1.7, 0.12, -0.45],
    [3.85, 0.48, 0.25],
    [-3.6, 0.3, -1.15],
    [3.1, 1.72, -1.15]
  ], []);
  const particles = useMemo(() => Array.from({ length: 90 }, (_, index) => ({
    angle: index * 0.42,
    radius: 1.8 + (index % 9) * 0.24,
    height: -1.7 + (index % 13) * 0.28,
    speed: 0.18 + (index % 7) * 0.018
  })), []);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();
    group.current.rotation.y = t * 0.105 + pointer.x * 0.12;
    group.current.rotation.x = -0.12 + pointer.y * 0.07;
    core.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.035);
    outerRing.current.rotation.z = t * 0.22;
    innerRing.current.rotation.z = -t * 0.36;
  });

  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.72, 0]} receiveShadow>
        <circleGeometry args={[6.2, 96]} />
        <meshStandardMaterial color="#0b1b17" transparent opacity={0.46} roughness={0.78} />
      </mesh>
      <gridHelper args={[12, 24, "#2fc39f", "#173d34"]} position={[0, -1.7, 0]} />
      <Line points={routeA} color="#f7873c" lineWidth={4} transparent opacity={0.9} />
      <Line points={routeB} color="#2fc39f" lineWidth={2} transparent opacity={0.64} />

      {nodes.map((position, index) => (
        <group position={position} key={index}>
          <mesh>
            <sphereGeometry args={[index % 3 === 0 ? 0.12 : 0.085, 24, 24]} />
            <meshStandardMaterial color="#8bdbc7" emissive="#2fc39f" emissiveIntensity={2.8} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.27, 44]} />
            <meshBasicMaterial color={index % 2 ? "#f7b64c" : "#2fc39f"} transparent opacity={0.38} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.014, 0.052, 1.4, 12, 1, true]} />
            <meshBasicMaterial color="#8bdbc7" transparent opacity={0.16} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}

      <Float speed={1.45} rotationIntensity={0.16} floatIntensity={0.22}>
        <group position={[0, 0.25, 0]}>
          <mesh ref={core}>
            <sphereGeometry args={[0.7, 48, 48]} />
            <meshStandardMaterial color="#fff6e4" emissive="#f7b64c" emissiveIntensity={1.9} roughness={0.18} metalness={0.2} />
          </mesh>
          <mesh>
            <coneGeometry args={[1.05, 2.7, 5, 1, true]} />
            <meshStandardMaterial color="#f0643c" emissive="#f0643c" emissiveIntensity={1.2} transparent opacity={0.72} roughness={0.33} />
          </mesh>
          <mesh position={[0.08, -0.2, 0.04]}>
            <coneGeometry args={[0.72, 2.0, 5, 1, true]} />
            <meshStandardMaterial color="#f7b64c" emissive="#f7b64c" emissiveIntensity={1.45} transparent opacity={0.86} roughness={0.2} />
          </mesh>
          <mesh ref={outerRing} rotation={[1.2, 0.4, 0]}>
            <torusGeometry args={[1.55, 0.012, 12, 160]} />
            <meshBasicMaterial color="#f7873c" transparent opacity={0.75} />
          </mesh>
          <mesh ref={innerRing} rotation={[1.05, -0.65, 0.1]}>
            <torusGeometry args={[1.08, 0.01, 12, 160]} />
            <meshBasicMaterial color="#2fc39f" transparent opacity={0.7} />
          </mesh>
        </group>
      </Float>

      {particles.map((particle, index) => (
        <OrbitParticle key={index} {...particle} />
      ))}

      <Html position={[0, -2.18, 0]} center transform distanceFactor={7}>
        <div className="holo-label">FIELD INTELLIGENCE CORE</div>
      </Html>
    </group>
  );
}

function OrbitParticle({ angle, radius, height, speed }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + angle;
    ref.current.position.set(Math.cos(t) * radius, height + Math.sin(t * 1.7) * 0.15, Math.sin(t) * radius * 0.55);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.026, 8, 8]} />
      <meshBasicMaterial color="#f7b64c" transparent opacity={0.76} />
    </mesh>
  );
}

export default function IntelligenceScene() {
  return (
    <Canvas dpr={[1, 1.6]} shadows gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
      <PerspectiveCamera makeDefault position={[0, 1.25, 8.6]} fov={44} />
      <ambientLight intensity={0.75} />
      <pointLight color="#f7873c" intensity={32} position={[1.5, 2.4, 2.2]} />
      <pointLight color="#2fc39f" intensity={22} position={[-2.8, 0.8, 2.6]} />
      <directionalLight color="#fff2d4" intensity={1.4} position={[3.5, 5, 4]} castShadow />
      <Stars radius={18} depth={7} count={750} factor={2.2} saturation={0} fade speed={0.2} />
      <Suspense fallback={null}>
        <FlameCore3D />
      </Suspense>
    </Canvas>
  );
}
