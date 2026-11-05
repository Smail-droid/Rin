export function VinylDiscArt({
  className = "w-full h-full",
  isPlaying = false,
  coverUrl,
}: {
  className?: string;
  isPlaying?: boolean;
  coverUrl?: string;
}) {
  const spinStyle = {
    animationDuration: "12s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    animationPlayState: isPlaying ? "running" : "paused",
  } as React.CSSProperties;

  return (
    <div
      style={spinStyle}
      className={`relative rounded-full select-none shrink-0 overflow-hidden shadow-lg animate-spin ${className}`}
    >
      {/* 真实唱片封面或微光和纸黑胶兜底 */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt="album cover"
          className="h-full w-full object-cover rounded-full"
          onError={(e) => {
            // 图片加载失败时隐藏并显示底层精雕黑胶
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      ) : null}

      {/* 精雕极简微光黑胶质感底盘 (SVG 矢量纹理，高分辨率保真，永不失真) */}
      {(!coverUrl || undefined) && (
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full block"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* 黑胶盘身哑光同心圆渐变 */}
            <radialGradient id="vinylBody" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#24242d" />
              <stop offset="60%" stopColor="#121217" />
              <stop offset="90%" stopColor="#0a0a0d" />
              <stop offset="100%" stopColor="#1e1e26" />
            </radialGradient>

            {/* 内芯微光暮樱渐变 (画廊粉金与星芒紫) */}
            <linearGradient id="labelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff4d79" />
              <stop offset="45%" stopColor="#ff758c" />
              <stop offset="70%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>

            {/* 盘面高光反射光泽 (Vinyl Sheen) */}
            <linearGradient id="sheen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* 外圈黑胶基座 */}
          <circle cx="50" cy="50" r="49" fill="url(#vinylBody)" stroke="#2f2f3d" strokeWidth="1" />

          {/* 黑胶同心音轨光环细纹 (Grooves) */}
          <circle cx="50" cy="50" r="44" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="0.75" />
          <circle cx="50" cy="50" r="40" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="36" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="0.75" />
          <circle cx="50" cy="50" r="32" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="28" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.75" />

          {/* 黑胶旋转动态高光锥形夹角 */}
          <circle cx="50" cy="50" r="49" fill="url(#sheen)" pointerEvents="none" />

          {/* 内圈彩胶印章微标 (Center Label) */}
          <circle cx="50" cy="50" r="20" fill="url(#labelGradient)" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1" />

          {/* 装饰微波与星芒几何 */}
          <path
            d="M 40 50 Q 45 44 50 50 T 60 50"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeOpacity="0.85"
            fill="none"
          />
          <circle cx="43" cy="42" r="1.2" fill="#ffffff" fillOpacity="0.9" />
          <circle cx="57" cy="58" r="1.2" fill="#ffffff" fillOpacity="0.9" />

          {/* 中心主轴金属扣眼孔 */}
          <circle cx="50" cy="50" r="4.5" fill="#0f0f13" stroke="#e2e8f0" strokeWidth="1.2" />
          <circle cx="50" cy="50" r="2" fill="#ffffff" fillOpacity="0.8" />
        </svg>
      )}

      {/* 唱针同心金属轴心扣 (仅在有大图封面时覆盖于封面中央) */}
      {coverUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-4 w-4 rounded-full bg-neutral-900 border-2 border-white/80 shadow-md flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-theme" />
          </div>
        </div>
      )}
    </div>
  );
}
