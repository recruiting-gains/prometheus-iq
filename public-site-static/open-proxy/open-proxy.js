const canvas = document.getElementById("network-canvas");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

if (canvas) {
  const context = canvas.getContext("2d");
  const pointer = { x: 0, y: 0 };
  const state = { width: 0, height: 0, depth: 760 };
  const particles = Array.from({ length: 44 }, (_, index) => ({
    orbit: 120 + (index % 11) * 18,
    height: -180 + (index % 10) * 36,
    depthOffset: -160 + (index % 8) * 40,
    speed: 0.0005 + (index % 7) * 0.00013,
    angle: index * 0.37,
    size: 1.5 + (index % 3)
  }));

  const haloRings = [150, 220, 290];
  let rafId = 0;

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    state.width = Math.max(1, Math.floor(bounds.width));
    state.height = Math.max(1, Math.floor(bounds.height));
    canvas.width = Math.floor(state.width * ratio);
    canvas.height = Math.floor(state.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const project = (x, y, z) => {
    const scale = state.depth / (state.depth + z);
    return {
      x: state.width * 0.5 + x * scale,
      y: state.height * 0.5 + y * scale,
      scale
    };
  };

  const rotate = (x, y, z, yaw, pitch) => {
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const xzX = x * cosYaw - z * sinYaw;
    const xzZ = x * sinYaw + z * cosYaw;
    const yzY = y * cosPitch - xzZ * sinPitch;
    const yzZ = y * sinPitch + xzZ * cosPitch;
    return { x: xzX, y: yzY, z: yzZ };
  };

  const drawRing = (radius, time, yaw, pitch) => {
    const points = [];
    for (let step = 0; step <= 72; step += 1) {
      const angle = (step / 72) * Math.PI * 2 + time * 0.00022 * (1 + radius / 220);
      const rotated = rotate(
        Math.cos(angle) * radius,
        Math.sin(angle * 1.2) * 18,
        Math.sin(angle) * radius * 0.55,
        yaw,
        pitch
      );
      points.push(project(rotated.x, rotated.y, rotated.z));
    }
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = "rgba(141, 245, 255, 0.15)";
    context.lineWidth = 1.2;
    context.stroke();
  };

  const render = (time) => {
    context.clearRect(0, 0, state.width, state.height);

    const yaw = reducedMotion ? -0.28 : -0.28 + pointer.x * 0.35 + Math.sin(time * 0.00012) * 0.08;
    const pitch = reducedMotion ? 0.2 : 0.2 + pointer.y * 0.2 + Math.cos(time * 0.00015) * 0.05;

    haloRings.forEach(radius => drawRing(radius, time, yaw, pitch));

    const projected = particles.map((particle, index) => {
      const angle = particle.angle + time * particle.speed * (reducedMotion ? 0.22 : 1);
      const baseX = Math.cos(angle) * particle.orbit;
      const baseZ = Math.sin(angle) * particle.orbit * 0.65 + particle.depthOffset;
      const baseY = particle.height + Math.sin(angle * 1.8 + index) * 18;
      const rotated = rotate(baseX, baseY, baseZ, yaw, pitch);
      return { ...particle, ...project(rotated.x, rotated.y, rotated.z), z: rotated.z };
    }).sort((left, right) => left.z - right.z);

    for (let index = 0; index < projected.length; index += 1) {
      const current = projected[index];
      for (let nextIndex = index + 1; nextIndex < projected.length; nextIndex += 1) {
        const next = projected[nextIndex];
        const dx = current.x - next.x;
        const dy = current.y - next.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 92) continue;
        const alpha = (1 - distance / 92) * 0.3 * Math.min(current.scale, next.scale);
        context.beginPath();
        context.moveTo(current.x, current.y);
        context.lineTo(next.x, next.y);
        context.strokeStyle = `rgba(110, 168, 255, ${alpha})`;
        context.lineWidth = 1;
        context.stroke();
      }
    }

    projected.forEach(point => {
      const radius = point.size * point.scale * 1.5;
      const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 4);
      gradient.addColorStop(0, "rgba(141, 245, 255, 0.95)");
      gradient.addColorStop(0.45, "rgba(110, 168, 255, 0.42)");
      gradient.addColorStop(1, "rgba(110, 168, 255, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(point.x, point.y, radius * 4, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = point.z > 120 ? "rgba(156, 125, 255, 0.88)" : "rgba(141, 245, 255, 0.96)";
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    });

    rafId = window.requestAnimationFrame(render);
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });

  if (!reducedMotion && finePointer) {
    window.addEventListener("pointermove", event => {
      pointer.x = event.clientX / window.innerWidth - 0.5;
      pointer.y = event.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  rafId = window.requestAnimationFrame(render);
  window.addEventListener("pagehide", () => window.cancelAnimationFrame(rafId), { once: true });
}
