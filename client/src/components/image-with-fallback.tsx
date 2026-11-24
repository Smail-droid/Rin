import type { ImgHTMLAttributes } from "react";
import { useImageLoadState } from "../utils/use-image-load-state";
import { normalizeBlobUrl } from "../utils/url";

type ImageWithFallbackProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "className" | "onError" | "onLoad" | "src"
> & {
  className?: string;
  imageClassName?: string;
  src?: string | null;
  fallbackText?: string;
};

const MONOGRAM_TONES = [
  "bg-rose-500/15 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
  "bg-sky-500/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  "bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  "bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300",
];

function getMonogramMeta(text?: string) {
  const clean = (text || "").trim();
  if (!clean) return null;
  const initial = clean.slice(0, 1).toUpperCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) | 0;
  }
  const toneClass = MONOGRAM_TONES[Math.abs(hash) % MONOGRAM_TONES.length];
  return { initial, toneClass };
}

export function ImageWithFallback({
  alt = "",
  className = "",
  imageClassName = "",
  src,
  fallbackText,
  ...props
}: ImageWithFallbackProps) {
  const normalizedSrc = (normalizeBlobUrl(src) || src?.trim()) || undefined;
  const { failed, imageRef, loaded, onError, onLoad } = useImageLoadState(normalizedSrc);
  const showFallback = !normalizedSrc || failed;
  const monogram = showFallback ? getMonogramMeta(fallbackText) : null;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${
        loaded && !failed
          ? "bg-transparent"
          : monogram
          ? monogram.toneClass
          : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
      } ${className}`}
    >
      <span
        aria-label={showFallback && alt ? alt : undefined}
        aria-hidden={showFallback ? undefined : true}
        role={showFallback && alt ? "img" : undefined}
        className={`flex h-full w-full items-center justify-center transition-opacity ${loaded && !failed ? "opacity-0" : "opacity-100"}`}
      >
        {monogram ? (
          <span className="font-bold text-[0.95em] tracking-tight select-none leading-none">
            {monogram.initial}
          </span>
        ) : (
          <i className="ri-image-line text-[0.9em]" aria-hidden="true" />
        )}
      </span>
      {normalizedSrc ? (
        <img
          {...props}
          ref={imageRef}
          src={normalizedSrc}
          alt={failed ? "" : alt}
          referrerPolicy="no-referrer"
          onLoad={onLoad}
          onError={onError}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ${failed ? "opacity-0" : "opacity-100"} ${imageClassName}`}
        />
      ) : null}
    </span>
  );
}
