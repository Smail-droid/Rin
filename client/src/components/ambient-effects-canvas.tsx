import { useEffect, useRef } from "react";

export type AmbienceMode = "none" | "rain" | "sakura" | "fireflies";

export function normalizeAmbienceMode(value: unknown): AmbienceMode {
  if (value === "rain" || value === "sakura" || value === "fireflies" || value === "none") {
    return value;
  }
  return "none";
}

function isDarkModeActive(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return root.getAttribute("data-color-mode") === "dark" || root.classList.contains("dark");
}

/**
 * 全视口动态氛围粒子画布
 * 遵守《美化章程》第五章：显式选择非 none 模式时立即绘制，绝不因系统动效偏好失灵。
 * 针对"画廊随想"美学调优：
 * 1. 樱花与细雨智能避开文章正文阅读区（避障偏转+边界渐隐），保持内容清爽纯净；
 * 2. 细雨线条纤细优雅、降落速度舒缓温润，营造空濛意境而非疾风骤雨；
 * 3. 萤火虫真实夜光生物荧光（绿幽幽的温润玉色与草黄绿辉光，脉冲呼吸微闪）。
 */
export function AmbientEffectsCanvas({ mode }: { mode: AmbienceMode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (mode === "none") {
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

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
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
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

    // --- 动态避让文章内容区缓存系统 ---
    type AvoidRect = {
      left: number;
      top: number;
      right: number;
      bottom: number;
      centerX: number;
    };
    let avoidRects: AvoidRect[] = [];

    const updateAvoidRects = () => {
      const elements = document.querySelectorAll(
        "article, [data-content-zone], .markdown-content, .feed-content-area, .prose"
      );
      const rects: AvoidRect[] = [];
      const padding = 16;
      elements.forEach((el) => {
        const r = el.getBoundingClientRect();
        // 仅抓取视口内或邻近视口、且具有实质文本阅读尺寸的容器
        if (r.width > 220 && r.height > 120 && r.bottom > -50 && r.top < height + 50) {
          rects.push({
            left: r.left - padding,
            top: r.top - padding,
            right: r.right + padding,
            bottom: r.bottom + padding,
            centerX: (r.left + r.right) / 2,
          });
        }
      });
      avoidRects = rects;
    };

    updateAvoidRects();

    // 滚动防抖采样避让区域
    let scrollThrottleTimer: number | null = null;
    const handleScroll = () => {
      if (scrollThrottleTimer !== null) return;
      scrollThrottleTimer = window.setTimeout(() => {
        scrollThrottleTimer = null;
        updateAvoidRects();
      }, 120);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

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
      pulseSpeed?: number;
      pulsePhase?: number;
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
      // 舒缓细雨：降低粒子密度、线条细柔、速度轻缓如丝
      const count = Math.min(85, Math.max(40, Math.floor(width / 18)));
      particles = Array.from({ length: count }, () => {
        const depth = 0.65 + Math.random() * 0.7;
        return {
          x: Math.random() * (width + 120),
          y: Math.random() * height,
          speedX: -0.75 * depth - Math.random() * 0.35,
          speedY: 4.8 * depth + Math.random() * 2.2, // 降速 ~50%，温润飘落
          size: 13 * depth + Math.random() * 9,      // 纤细雨丝长度
          thickness: 0.65 + depth * 0.45,            // 细线条 0.7~1.1px
          angle: 0,
          angularSpeed: 0,
          opacity: 0.32 + depth * 0.25,
          fadeSpeed: 0,
          swayPhase: 0,
          hueIndex: Math.floor(Math.random() * 3),
        };
      });
    } else if (mode === "sakura") {
      const count = Math.min(45, Math.max(22, Math.floor(width / 32)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speedX: -0.45 + Math.random() * 1.0,
        speedY: 0.85 + Math.random() * 1.15,
        size: 7.0 + Math.random() * 5.5,
        thickness: 1,
        angle: Math.random() * Math.PI * 2,
        angularSpeed: (Math.random() - 0.5) * 0.03,
        opacity: 0.58 + Math.random() * 0.28,
        fadeSpeed: 0,
        swayPhase: Math.random() * Math.PI * 2,
        hueIndex: Math.floor(Math.random() * 3),
      }));
    } else if (mode === "fireflies") {
      // 绿幽幽荧光：双相位正弦呼吸脉冲，温润明暗交替
      const count = Math.min(48, Math.max(24, Math.floor(width / 30)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speedX: (Math.random() - 0.5) * 0.45,
        speedY: -0.18 + (Math.random() - 0.5) * 0.4,
        size: 2.2 + Math.random() * 2.4,
        thickness: 1,
        angle: 0,
        angularSpeed: 0,
        opacity: 0.4,
        fadeSpeed: 0,
        swayPhase: Math.random() * Math.PI * 2,
        hueIndex: Math.floor(Math.random() * 2),
        pulseSpeed: 0.016 + Math.random() * 0.018, // 脉冲呼吸速率
        pulsePhase: Math.random() * Math.PI * 2,
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

    let frameCount = 0;

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);
      frameCount++;

      // 定期轻量同步避让框，防止内容高度动态变更后错位
      if (frameCount % 45 === 0) {
        updateAvoidRects();
      }

      if (mode === "rain") {
        ctx.lineCap = "round";
        for (const p of particles) {
          // 避让检测：检测落点是否落在文章阅读容器内
          let inArticleZone = false;
          for (let i = 0; i < avoidRects.length; i++) {
            const rect = avoidRects[i];
            if (p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom) {
              inArticleZone = true;
              break;
            }
          }

          const endX = p.x + p.speedX * 1.35;
          const endY = p.y + p.size;

          // 位于文章区内时不绘制雨滴，保持阅读区干燥清晰
          if (!inArticleZone) {
            const grad = ctx.createLinearGradient(p.x, p.y, endX, endY);
            if (isDark) {
              grad.addColorStop(0, "rgba(202, 230, 255, 0)");
              grad.addColorStop(0.5, `rgba(202, 230, 255, ${(p.opacity * 0.55).toFixed(3)})`);
              grad.addColorStop(1, `rgba(235, 245, 255, ${Math.min(0.85, p.opacity * 0.9).toFixed(3)})`);
            } else {
              grad.addColorStop(0, "rgba(56, 110, 168, 0)");
              grad.addColorStop(0.5, `rgba(56, 110, 168, ${(p.opacity * 0.48).toFixed(3)})`);
              grad.addColorStop(1, `rgba(45, 85, 140, ${Math.min(0.68, p.opacity * 0.82).toFixed(3)})`);
            }

            ctx.lineWidth = p.thickness;
            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }

          p.x += p.speedX;
          p.y += p.speedY;

          if (p.y > height) {
            if (!inArticleZone && ripples.length < 24 && Math.random() < 0.24) {
              ripples.push({
                x: p.x,
                y: height - 4 - Math.random() * 10,
                radius: 1.5,
                maxRadius: 8 + Math.random() * 7,
                opacity: isDark ? 0.42 : 0.32,
              });
            }
            p.y = -p.size - Math.random() * 30;
            p.x = Math.random() * (width + 120);
          }
          if (p.x < -40) p.x = width + 40;
        }

        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i];
          r.radius += 0.45;
          r.opacity *= 0.93;
          if (r.radius >= r.maxRadius || r.opacity < 0.02) {
            ripples.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = isDark
            ? `rgba(202, 230, 255, ${r.opacity.toFixed(3)})`
            : `rgba(56, 110, 168, ${r.opacity.toFixed(3)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (mode === "sakura") {
        const lightPalette = ["236, 72, 153", "244, 114, 160", "251, 146, 180"];
        const darkPalette = ["251, 182, 206", "253, 164, 175", "249, 168, 212"];
        const palette = isDark ? darkPalette : lightPalette;

        for (const p of particles) {
          p.angle += p.angularSpeed;
          p.swayPhase += 0.022;

          // 智能避障算法：当花瓣接近或落在文章区时，产生横向斥力向两侧边缘漂移并淡出
          let renderOpacity = p.opacity;
          for (let i = 0; i < avoidRects.length; i++) {
            const rect = avoidRects[i];
            if (p.x >= rect.left - 24 && p.x <= rect.right + 24 && p.y >= rect.top - 20 && p.y <= rect.bottom + 20) {
              // 计算离文章区边缘的距离
              const distToLeft = Math.abs(p.x - rect.left);
              const distToRight = Math.abs(p.x - rect.right);
              // 向最近外侧边缘平滑施加偏转推力
              if (p.x < rect.centerX) {
                p.x -= 0.7;
              } else {
                p.x += 0.7;
              }
              // 在正文核心区内部时降低透明度直至近乎不可见，不干扰文本阅读
              if (p.x > rect.left && p.x < rect.right && p.y > rect.top && p.y < rect.bottom) {
                const edgeDist = Math.min(distToLeft, distToRight);
                renderOpacity = Math.max(0, p.opacity * Math.min(1, edgeDist / 36) * 0.15);
              }
              break;
            }
          }

          if (renderOpacity > 0.04) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            const flutter = 0.52 + Math.abs(Math.sin(p.swayPhase)) * 0.48;
            ctx.scale(1, flutter);
            ctx.fillStyle = `rgba(${palette[p.hueIndex % palette.length]}, ${renderOpacity.toFixed(3)})`;
            drawPetal(p.size);
            ctx.restore();
          }

          p.x += p.speedX + Math.sin(p.swayPhase) * 0.6;
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
          p.pulsePhase = (p.pulsePhase || 0) + (p.pulseSpeed || 0.018);
          p.swayPhase += 0.018;

          // 生物荧光呼吸脉冲：sin² 产生真实的幽幽渐亮渐灭感
          const rawPulse = Math.sin(p.pulsePhase);
          const pulseGlow = Math.pow(Math.max(0, rawPulse), 2.2); // 峰值更亮，暗相更长
          const currentOpacity = 0.12 + pulseGlow * 0.82;

          // 同样在文章阅读核心区产生柔和外推偏转
          for (let i = 0; i < avoidRects.length; i++) {
            const rect = avoidRects[i];
            if (p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom) {
              if (p.x < rect.centerX) {
                p.x -= 0.35;
              } else {
                p.x += 0.35;
              }
              break;
            }
          }

          const glowRadius = p.size * (2.8 + pulseGlow * 1.6);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);

          // 纯正绿幽幽生物夜光色谱（磷光玉色与草黄绿辉光）
          if (isDark) {
            if (p.hueIndex === 0) {
              // 绿幽幽草木荧光色（555nm 真实萤火虫黄金磷光）
              grad.addColorStop(0, `rgba(226, 252, 142, ${currentOpacity.toFixed(3)})`);
              grad.addColorStop(0.38, `rgba(163, 230, 53, ${(currentOpacity * 0.72).toFixed(3)})`);
              grad.addColorStop(0.75, `rgba(101, 163, 13, ${(currentOpacity * 0.28).toFixed(3)})`);
              grad.addColorStop(1, "rgba(101, 163, 13, 0)");
            } else {
              // 幽绿玉色（翡翠微光）
              grad.addColorStop(0, `rgba(187, 247, 208, ${currentOpacity.toFixed(3)})`);
              grad.addColorStop(0.42, `rgba(74, 222, 128, ${(currentOpacity * 0.68).toFixed(3)})`);
              grad.addColorStop(0.8, `rgba(22, 163, 74, ${(currentOpacity * 0.22).toFixed(3)})`);
              grad.addColorStop(1, "rgba(22, 163, 74, 0)");
            }
          } else {
            if (p.hueIndex === 0) {
              grad.addColorStop(0, `rgba(101, 163, 13, ${(currentOpacity * 0.92).toFixed(3)})`);
              grad.addColorStop(0.4, `rgba(132, 204, 22, ${(currentOpacity * 0.48).toFixed(3)})`);
              grad.addColorStop(1, "rgba(132, 204, 22, 0)");
            } else {
              grad.addColorStop(0, `rgba(21, 128, 61, ${(currentOpacity * 0.88).toFixed(3)})`);
              grad.addColorStop(0.42, `rgba(34, 197, 94, ${(currentOpacity * 0.42).toFixed(3)})`);
              grad.addColorStop(1, "rgba(34, 197, 94, 0)");
            }
          }

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          p.x += p.speedX + Math.cos(p.swayPhase) * 0.24;
          p.y += p.speedY + Math.sin(p.swayPhase) * 0.18;

          if (p.x < -12) p.x = width + 12;
          if (p.x > width + 12) p.x = -12;
          if (p.y < -12) p.y = height + 12;
          if (p.y > height + 12) p.y = -12;
        }
      }
    };

    // 首帧立即同步绘制，确保点击切换当下即可肉眼观测到粒子
    drawFrame();

    const render = () => {
      if (!isPaused) {
        drawFrame();
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", syncCanvasSize);
      window.removeEventListener("colorSchemeChange", syncTheme);
      window.removeEventListener("scroll", handleScroll);
      if (scrollThrottleTimer !== null) {
        window.clearTimeout(scrollThrottleTimer);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      themeObserver.disconnect();
    };
  }, [mode]);

  if (mode === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      data-ambience-mode={mode}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[25]"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
