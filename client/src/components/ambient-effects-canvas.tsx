import { useEffect, useRef } from "react";

export type AmbienceMode = "none" | "rain" | "sakura" | "fireflies";

function isDarkModeActive(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return root.getAttribute("data-color-mode") === "dark" || root.classList.contains("dark");
}

export function AmbientEffectsCanvas({ mode }: { mode: AmbienceMode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (mode === "none") {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let isDark = isDarkModeActive();

    const syncCanvasSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncCanvasSize();
    window.addEventListener("resize", syncCanvasSize);

    const syncTheme = () => {
      isDark = isDarkModeActive();
    };
    window.addEventListener("colorSchemeChange", syncTheme);
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-color-mode", "class"],
    });

    type Particle = {
      x: number;
      y: number;
      speedX: number;
      speedY: number;
      size: number;
      thickness: number;
      angle: number;
      angularSpeed: number;
      opacity: number;
      fadeSpeed: number;
      swayPhase: number;
      hueIndex: number;
    };

    type Ripple = {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      opacity: number;
    };

    let particles: Particle[] = [];
    const ripples: Ripple[] = [];

    if (mode === "rain") {
      const count = Math.min(130, Math.max(55, Math.floor(width / 12)));
      particles = Array.from({ length: count }, () => {
        const depth = 0.55 + Math.random() * 0.75;
        return {
          x: Math.random() * (width + 160),
          y: Math.random() * height,
          speedX: -1.6 * depth - Math.random() * 0.9,
          speedY: 11 * depth + Math.random() * 6,
          size: 16 * depth + Math.random() * 14,
          thickness: 0.8 + depth * 0.85,
          angle: 0,
          angularSpeed: 0,
          opacity: 0.24 + depth * 0.28,
          fadeSpeed: 0,
          swayPhase: 0,
          hueIndex: Math.floor(Math.random() * 3),
        };
      });
    } else if (mode === "sakura") {
      const count = Math.min(42, Math.max(18, Math.floor(width / 38)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speedX: -0.45 + Math.random() * 1.1,
        speedY: 0.9 + Math.random() * 1.3,
        size: 6 + Math.random() * 6.5,
        thickness: 1,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: (Math.random() - 0.5) * 0.035,
        opacity: 0.45 + Math.random() * 0.35,
        fadeSpeed: 0,
        swayPhase: Math.random() * Math.PI * 2,
        hueIndex: Math.floor(Math.random() * 3),
      }));
    } else if (mode === "fireflies") {
      const count = Math.min(46, Math.max(20, Math.floor(width / 32)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speedX: (Math.random() - 0.5) * 0.65,
        speedY: -0.25 + (Math.random() - 0.5) * 0.55,
        size: 2.2 + Math.random() * 2.8,
        thickness: 1,
        angle: 0,
        angularSpeed: 0,
        opacity: 0.2 + Math.random() * 0.65,
        fadeSpeed: 0.012 + Math.random() * 0.018,
        swayPhase: Math.random() * Math.PI * 2,
        hueIndex: Math.floor(Math.random() * 2),
      }));
    }

    let isPaused = document.hidden;
    const handleVisibility = () => {
      isPaused = document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const drawPetal = (size: number) => {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.65);
      ctx.bezierCurveTo(size * 0.85, -size * 0.95, size * 0.95, size * 0.35, 0, size * 0.85);
      ctx.bezierCurveTo(-size * 0.95, size * 0.35, -size * 0.85, -size * 0.95, 0, -size * 0.65);
      ctx.closePath();
      ctx.fill();
    };

    const render = () => {
      if (!isPaused) {
        ctx.clearRect(0, 0, width, height);

        if (mode === "rain") {
          ctx.lineCap = "round";
          for (const p of particles) {
            const endX = p.x + p.speedX * 1.45;
            const endY = p.y + p.size;

            const grad = ctx.createLinearGradient(p.x, p.y, endX, endY);
            if (isDark) {
              grad.addColorStop(0, "rgba(186, 224, 255, 0)");
              grad.addColorStop(0.5, `rgba(186, 224, 255, ${(p.opacity * 0.65).toFixed(3)})`);
              grad.addColorStop(1, `rgba(224, 242, 254, ${Math.min(0.85, p.opacity * 1.15).toFixed(3)})`);
            } else {
              // 浅色画布采用清透青灰雨丝，确保清晰可见又不遮挡文字
              grad.addColorStop(0, "rgba(71, 108, 155, 0)");
              grad.addColorStop(0.55, `rgba(71, 108, 155, ${(p.opacity * 0.6).toFixed(3)})`);
              grad.addColorStop(1, `rgba(51, 92, 145, ${Math.min(0.7, p.opacity * 0.98).toFixed(3)})`);
            }

            ctx.lineWidth = p.thickness;
            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            p.x += p.speedX;
            p.y += p.speedY;

            if (p.y > height) {
              if (ripples.length < 28 && Math.random() < 0.28) {
                ripples.push({
                  x: p.x,
                  y: height - 4 - Math.random() * 14,
                  radius: 1.5,
                  maxRadius: 9 + Math.random() * 10,
                  opacity: isDark ? 0.45 : 0.36,
                });
              }
              p.y = -p.size - Math.random() * 40;
              p.x = Math.random() * (width + 160);
            }
            if (p.x < -60) {
              p.x = width + 60;
            }
          }

          // 底部微弱雨滴涟漪
          for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.radius += 0.55;
            r.opacity *= 0.92;
            if (r.radius >= r.maxRadius || r.opacity < 0.02) {
              ripples.splice(i, 1);
              continue;
            }
            ctx.strokeStyle = isDark
              ? `rgba(186, 224, 255, ${r.opacity.toFixed(3)})`
              : `rgba(71, 108, 155, ${r.opacity.toFixed(3)})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.3, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (mode === "sakura") {
          const lightPalette = ["244, 114, 160", "251, 146, 178", "249, 168, 212"];
          const darkPalette = ["251, 182, 206", "253, 164, 175", "249, 168, 212"];
          const palette = isDark ? darkPalette : lightPalette;

          for (const p of particles) {
            p.angle += p.angularSpeed;
            p.swayPhase += 0.025;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            const flutter = 0.55 + Math.abs(Math.sin(p.swayPhase)) * 0.45;
            ctx.scale(1, flutter);
            ctx.fillStyle = `rgba(${palette[p.hueIndex % palette.length]}, ${p.opacity.toFixed(3)})`;
            drawPetal(p.size);
            ctx.restore();

            p.x += p.speedX + Math.sin(p.swayPhase) * 0.65;
            p.y += p.speedY;

            if (p.y > height + 24) {
              p.y = -24;
              p.x = Math.random() * width;
            }
            if (p.x < -24) p.x = width + 24;
            if (p.x > width + 24) p.x = -24;
          }
        } else if (mode === "fireflies") {
          for (const p of particles) {
            p.opacity += p.fadeSpeed;
            if (p.opacity > 0.9 || p.opacity < 0.14) {
              p.fadeSpeed = -p.fadeSpeed;
            }
            p.swayPhase += 0.02;

            const glowRadius = p.size * 3.4;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);

            if (isDark) {
              if (p.hueIndex === 0) {
                grad.addColorStop(0, `rgba(254, 240, 138, ${p.opacity.toFixed(3)})`);
                grad.addColorStop(0.4, `rgba(250, 204, 21, ${(p.opacity * 0.45).toFixed(3)})`);
                grad.addColorStop(1, "rgba(250, 204, 21, 0)");
              } else {
                grad.addColorStop(0, `rgba(186, 230, 253, ${p.opacity.toFixed(3)})`);
                grad.addColorStop(0.45, `rgba(56, 189, 248, ${(p.opacity * 0.42).toFixed(3)})`);
                grad.addColorStop(1, "rgba(56, 189, 248, 0)");
              }
            } else {
              if (p.hueIndex === 0) {
                grad.addColorStop(0, `rgba(217, 119, 6, ${(p.opacity * 0.85).toFixed(3)})`);
                grad.addColorStop(0.45, `rgba(245, 158, 11, ${(p.opacity * 0.32).toFixed(3)})`);
                grad.addColorStop(1, "rgba(245, 158, 11, 0)");
              } else {
                grad.addColorStop(0, `rgba(14, 116, 144, ${(p.opacity * 0.78).toFixed(3)})`);
                grad.addColorStop(0.45, `rgba(20, 184, 166, ${(p.opacity * 0.28).toFixed(3)})`);
                grad.addColorStop(1, "rgba(20, 184, 166, 0)");
              }
            }

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            p.x += p.speedX + Math.cos(p.swayPhase) * 0.25;
            p.y += p.speedY + Math.sin(p.swayPhase) * 0.2;

            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;
            if (p.y < -10) p.y = height + 10;
            if (p.y > height + 10) p.y = -10;
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", syncCanvasSize);
      window.removeEventListener("colorSchemeChange", syncTheme);
      document.removeEventListener("visibilitychange", handleVisibility);
      themeObserver.disconnect();
    };
  }, [mode]);

  if (mode === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[15]"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
