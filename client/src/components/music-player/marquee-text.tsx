import { useEffect, useRef, useState } from "react";

interface MarqueeTextProps {
  text: string;
  isPlaying?: boolean;
  className?: string;
  speed?: number; // 像素/秒，默认 24
}

/**
 * 🌸 音乐微光平滑走马灯 (Anime Luminous Smooth Marquee)
 * - 当文本长度超过容器宽度时自动启动无缝循环滚动
 * - 左右两侧具备 6px 微光透明渐隐遮罩 (Alpha Fade Mask)，告别生硬截断
 * - 播放中平滑流动，暂停时静止，悬停时支持快速阅览
 */
export function MarqueeText({
  text,
  isPlaying = false,
  className = "",
  speed = 24,
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);
  const [textWidth, setTextWidth] = useState(0);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerW = containerRef.current.clientWidth;
        const contentW = textRef.current.scrollWidth;
        setIsOverflow(contentW > containerW + 2);
        setTextWidth(contentW);
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [text]);

  const duration = Math.max(6, (textWidth + 24) / speed);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        maskImage: isOverflow
          ? "linear-gradient(to right, transparent, black 6px, black calc(100% - 6px), transparent)"
          : "none",
        WebkitMaskImage: isOverflow
          ? "linear-gradient(to right, transparent, black 6px, black calc(100% - 6px), transparent)"
          : "none",
      }}
      title={text}
    >
      {isOverflow ? (
        <div
          className="flex w-max will-change-transform group-hover:[animation-play-state:running]"
          style={{
            animation: `musicMarqueeFlow ${duration}s linear infinite`,
            animationPlayState: isPlaying ? "running" : "paused",
          }}
        >
          <span ref={textRef} className="shrink-0 pr-6 inline-block">
            {text}
          </span>
          <span className="shrink-0 pr-6 inline-block" aria-hidden="true">
            {text}
          </span>
        </div>
      ) : (
        <span ref={textRef} className="truncate block">
          {text}
        </span>
      )}
    </div>
  );
}
