import { useEffect, useRef } from "react";

export type AmbienceMode = "none" | "rain" | "sakura" | "fireflies";

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

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle types
    type Particle = {
      x: number;
      y: number;
      speedX: number;
      speedY: number;
      size: number;
      angle?: number;
      angularSpeed?: number;
      opacity: number;
      fadeSpeed?: number;
      color?: string;
    };

    let particles: Particle[] = [];

    if (mode === "rain") {
      const count = Math.min(120, Math.floor(width / 14));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speedX: -1 - Math.random() * 1.5,
        speedY: 14 + Math.random() * 8,
        size: 15 + Math.random() * 15,
        opacity: 0.25 + Math.random() * 0.35,
      }));
    } else if (mode === "sakura") {
      const count = Math.min(45, Math.floor(width / 35));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speedX: -0.8 + Math.random() * 1.6,
        speedY: 1.2 + Math.random() * 1.8,
        size: 8 + Math.random() * 8,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: (Math.random() - 0.5) * 0.04,
        opacity: 0.4 + Math.random() * 0.4,
      }));
    } else if (mode === "fireflies") {
      const count = Math.min(50, Math.floor(width / 30));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8,
        size: 2.5 + Math.random() * 3,
        opacity: Math.random() * 0.8,
        fadeSpeed: 0.015 + Math.random() * 0.02,
      }));
    }

    let isPaused = false;
    const handleVisibility = () => {
      isPaused = document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const render = () => {
      if (!isPaused) {
        ctx.clearRect(0, 0, width, height);

        if (mode === "rain") {
          ctx.lineWidth = 1.2;
          ctx.lineCap = "round";
          for (const p of particles) {
            ctx.strokeStyle = `rgba(186, 214, 255, ${p.opacity})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.speedX * 2, p.y + p.size);
            ctx.stroke();

            p.x += p.speedX;
            p.y += p.speedY;

            if (p.y > height) {
              p.y = -p.size;
              p.x = Math.random() * (width + 100);
            }
            if (p.x < -50) {
              p.x = width + 50;
            }
          }
        } else if (mode === "sakura") {
          for (const p of particles) {
            ctx.save();
            ctx.translate(p.x, p.y);
            p.angle = (p.angle || 0) + (p.angularSpeed || 0.02);
            ctx.rotate(p.angle);

            ctx.fillStyle = `rgba(255, 183, 197, ${p.opacity})`;
            ctx.beginPath();
            // Draw subtle petal ellipse
            ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            p.x += p.speedX + Math.sin(p.angle) * 0.8;
            p.y += p.speedY;

            if (p.y > height + 20) {
              p.y = -20;
              p.x = Math.random() * width;
            }
            if (p.x < -20) p.x = width + 20;
            if (p.x > width + 20) p.x = -20;
          }
        } else if (mode === "fireflies") {
          for (const p of particles) {
            p.opacity += p.fadeSpeed || 0.02;
            if (p.opacity > 0.85 || p.opacity < 0.15) {
              p.fadeSpeed = -(p.fadeSpeed || 0.02);
            }

            const rad = p.size;
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 2.5);
            grad.addColorStop(0, `rgba(255, 235, 130, ${p.opacity})`);
            grad.addColorStop(0.5, `rgba(56, 189, 248, ${p.opacity * 0.4})`);
            grad.addColorStop(1, "rgba(255, 255, 255, 0)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad * 2.5, 0, Math.PI * 2);
            ctx.fill();

            p.x += p.speedX;
            p.y += p.speedY;

            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [mode]);

  if (mode === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[-1]"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
