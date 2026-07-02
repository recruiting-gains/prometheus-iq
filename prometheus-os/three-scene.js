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
    vec2 center = vec2(0.0, -0.035);
    vec2 p = uv - center;
    float r = length(p);
    float angle = atan(p.y, p.x);
    float slow = uTime * 0.018;

    float gravity = 1.0 / max(r * r, 0.045);
    vec2 bent = p + normalize(p + 0.0001) * gravity * 0.018;
    vec2 skyUv = bent / aspect + 0.5;

    vec3 color = vec3(0.0);
    float stars = starLayer(skyUv + vec2(slow * 0.02, 0.0), 86.0, 0.974, 0.052);
    stars += starLayer(skyUv * 1.13 - vec2(0.08, slow * 0.018), 156.0, 0.987, 0.043);
    stars *= smoothstep(0.16, 0.72, r);
    color += vec3(0.65, 0.76, 0.88) * stars * 0.7;

    float hazeNoise = fbm(vec2(angle * 0.42, r * 2.2 - slow));
    float nebula = smoothstep(0.22, 0.0, abs(p.y + 0.04)) * smoothstep(1.1, 0.12, r) * hazeNoise;
    color += vec3(0.18, 0.10, 0.07) * nebula * 0.38;

    float diskY = p.y + sin(angle * 2.0 + slow) * 0.012;
    float diskCore = exp(-pow(abs(diskY) / 0.022, 1.35));
    float diskWidth = smoothstep(1.55, 0.18, abs(p.x)) * smoothstep(0.42, 1.34, abs(p.x));
    float shear = fbm(vec2(abs(p.x) * 2.6 - slow * 2.2, p.y * 28.0 + angle));
    float disk = diskCore * diskWidth * (0.55 + shear * 0.7);
    color += blackbody(shear) * disk * 1.05;

    float upperLens = exp(-pow(abs(length(vec2(p.x * 0.76, p.y - 0.12)) - 0.54) / 0.036, 1.55));
    upperLens *= smoothstep(0.04, 0.48, p.y) * smoothstep(1.2, 0.1, abs(p.x));
    float lowerLens = exp(-pow(abs(length(vec2(p.x * 0.8, p.y + 0.18)) - 0.5) / 0.05, 1.4));
    lowerLens *= smoothstep(-0.02, -0.42, p.y) * smoothstep(1.1, 0.08, abs(p.x));
    color += vec3(0.74, 0.42, 0.24) * (upperLens * 0.78 + lowerLens * 0.28);

    float photon = exp(-pow(abs(r - 0.242) / 0.012, 1.65));
    float rimMask = smoothstep(0.0, 0.08, abs(sin(angle)));
    color += mix(vec3(0.95, 0.58, 0.31), uStateColor, uStatePower * 0.45) * photon * rimMask * 0.72;

    float stateFlow = exp(-pow(abs(r - (0.34 + sin(angle * 2.0 - uTime * 0.055) * 0.014)) / 0.018, 1.35));
    stateFlow *= smoothstep(0.08, 0.7, abs(p.x)) * smoothstep(0.9, 0.2, r);
    color += uStateColor * stateFlow * (0.06 + uStatePower * 0.22);

    float shadow = smoothstep(0.254, 0.214, r);
    float innerAbsorb = smoothstep(0.42, 0.12, r);
    color = mix(color, vec3(0.0), shadow);
    color *= 1.0 - innerAbsorb * 0.2;

    float vignette = smoothstep(1.12, 0.32, length(uv * vec2(0.82, 1.08)));
    color *= 0.1 + vignette * 0.95;
    color = pow(color, vec3(0.92));

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
