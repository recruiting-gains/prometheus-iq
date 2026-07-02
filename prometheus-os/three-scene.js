import * as THREE from "./vendor/three.module.js";

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uStateColor;
  uniform float uStatePower;

  float hash(vec2 p) {
    p = fract(p * vec2(443.8975, 397.2973));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = mat2(1.62, 1.18, -1.18, 1.62) * p + 0.17;
      amplitude *= 0.48;
    }
    return value;
  }

  float starLayer(vec2 uv, float scale, float threshold, float size) {
    vec2 grid = uv * scale;
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float h = hash(cell);
    vec2 offset = vec2(hash(cell + 11.7), hash(cell + 27.3)) - 0.5;
    float d = length(local - offset * 0.72);
    float star = smoothstep(size, 0.0, d) * step(threshold, h);
    return star * (0.35 + h * 0.65);
  }

  vec3 blackbody(float t) {
    return mix(vec3(0.82, 0.37, 0.16), vec3(1.0, 0.78, 0.52), clamp(t, 0.0, 1.0));
  }

  void main() {
    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    vec2 uv = (vUv - 0.5) * aspect;
    vec2 center = vec2(0.0, -0.02);
    vec2 p = uv - center;
    float portraitScale = mix(1.0, 1.48, smoothstep(0.0, 0.8, 1.0 - aspect.x));
    p *= portraitScale;
    float r = length(p);
    float angle = atan(p.y, p.x);
    float slow = uTime * 0.012;
    float eventRadius = 0.19;

    float gravity = 1.0 / max(r * r, 0.055);
    vec2 bent = p + normalize(p + 0.0001) * gravity * 0.012;
    vec2 skyUv = bent / aspect + 0.5;

    vec3 color = vec3(0.0);
    float stars = starLayer(skyUv + vec2(slow * 0.006, 0.0), 118.0, 0.982, 0.035);
    stars += starLayer(skyUv * 1.31 - vec2(0.05, slow * 0.004), 214.0, 0.992, 0.026);
    stars *= smoothstep(eventRadius * 1.35, 0.78, r);
    color += vec3(0.58, 0.67, 0.78) * stars * 0.44;

    float hazeNoise = fbm(vec2(angle * 0.34 + slow, r * 2.1 - slow * 1.7));
    float nebula = smoothstep(0.55, 0.0, abs(p.y + 0.03)) * smoothstep(1.35, 0.16, r) * hazeNoise;
    color += vec3(0.10, 0.065, 0.045) * nebula * 0.32;

    float turbulence = fbm(vec2(abs(p.x) * 4.8 - slow * 7.0, p.y * 34.0 + sin(angle) * 0.22));
    float diskWarp = sin(p.x * 7.5 - slow * 9.0) * 0.006 + (turbulence - 0.5) * 0.018;
    float diskY = p.y + diskWarp;
    float diskThickness = mix(0.016, 0.038, smoothstep(0.28, 1.22, abs(p.x)));
    float diskCore = exp(-pow(abs(diskY) / diskThickness, 1.42));
    float diskInner = smoothstep(eventRadius * 0.82, eventRadius * 1.28, abs(p.x));
    float diskOuter = smoothstep(1.58, 0.28, abs(p.x));
    float disk = diskCore * diskInner * diskOuter * (0.42 + turbulence * 0.86);
    color += blackbody(turbulence) * disk * 0.92;

    float upperOval = length(vec2(p.x * 0.83, (p.y - 0.062) * 1.72));
    float upperLens = exp(-pow(abs(upperOval - 0.34) / 0.026, 1.55));
    upperLens *= smoothstep(-0.015, 0.15, p.y) * smoothstep(0.78, 0.16, abs(p.x));
    upperLens *= 0.72 + fbm(vec2(angle * 1.7, r * 8.0 - slow * 2.0)) * 0.42;

    float lowerOval = length(vec2(p.x * 0.9, (p.y + 0.11) * 1.96));
    float lowerLens = exp(-pow(abs(lowerOval - 0.31) / 0.032, 1.55));
    lowerLens *= smoothstep(0.01, -0.18, p.y) * smoothstep(0.7, 0.15, abs(p.x));
    lowerLens *= 0.48 + fbm(vec2(angle * 1.3 + 2.0, r * 7.0 + slow)) * 0.34;
    color += vec3(0.83, 0.42, 0.18) * upperLens * 0.74;
    color += vec3(0.62, 0.27, 0.12) * lowerLens * 0.28;

    float photon = exp(-pow(abs(r - eventRadius * 1.08) / 0.01, 1.7));
    float photonBreak = smoothstep(0.1, 0.9, fbm(vec2(angle * 1.9 + slow, 8.0 * r)));
    color += mix(vec3(0.78, 0.38, 0.16), uStateColor, uStatePower * 0.32) * photon * photonBreak * 0.18;

    float inward = fract((eventRadius * 3.1 - r) * 4.2 + angle * 0.08 + uTime * 0.025);
    float stateFlow = smoothstep(0.965, 1.0, inward) * smoothstep(0.72, eventRadius * 1.08, r);
    stateFlow *= smoothstep(0.72, 0.08, abs(p.x)) * smoothstep(0.22, 0.0, abs(p.y));
    color += uStateColor * stateFlow * uStatePower * 0.2;

    float shadow = smoothstep(eventRadius * 1.08, eventRadius * 0.9, r);
    float innerAbsorb = smoothstep(eventRadius * 2.2, eventRadius * 0.9, r);
    color = mix(color, vec3(0.0), shadow);
    color *= 1.0 - innerAbsorb * 0.26;

    float vignette = smoothstep(1.25, 0.34, length(uv * vec2(0.72, 1.06)));
    color *= 0.04 + vignette * 0.98;
    color = pow(color, vec3(0.96));

    gl_FragColor = vec4(color, 1.0);
  }
`;

function stateColor(voiceState) {
  if (voiceState === "listening") return new THREE.Color(0x5f9fd8);
  if (voiceState === "thinking") return new THREE.Color(0xd88a3d);
  if (voiceState === "speaking") return new THREE.Color(0x54d69f);
  return new THREE.Color(0xa66a37);
}

function statePower(voiceState) {
  if (voiceState === "listening") return 0.42;
  if (voiceState === "thinking") return 0.58;
  if (voiceState === "speaking") return 0.72;
  return 0.16;
}

export function createPrometheusScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setClearColor(0x000000, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uStateColor: { value: stateColor("idle") },
    uStatePower: { value: 0.16 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    const width = Math.max(box.width, 1);
    const height = Math.max(box.height, 1);
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
  };

  window.addEventListener("resize", resize);
  resize();

  const clock = new THREE.Clock();
  let raf = 0;

  const animate = () => {
    const voiceState = document.body.dataset.voice || "idle";
    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uStateColor.value.copy(stateColor(voiceState));
    uniforms.uStatePower.value = statePower(voiceState);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(animate);
  };

  animate();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
    }
  };
}
