import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageUploadInput } from "../components/image-upload-input";
import { ImageWithFallback } from "../components/image-with-fallback";

export function ItemWithUpload({
  title,
  description,
  accept,
  onFileChange,
  buttonLabel,
}: {
  title: string;
  description: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  accept: string;
  buttonLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    try {
      await onFileChange(event);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[rgb(var(--rin-hairline-rgb)/0.85)] bg-[rgb(var(--rin-ink-rgb)/0.02)] p-3.5">
      {(title || description) ? (
        <div className="min-w-0 flex-1">
          {title ? <div className="text-xs font-bold text-[rgb(var(--rin-ink-rgb))] truncate">{title}</div> : null}
          {description ? (
            <p className="text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] mt-0.5 line-clamp-2">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2 shrink-0">
        <input ref={inputRef} type="file" className="hidden" accept={accept} onChange={handleFileChange} />
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-theme px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-theme-hover active:scale-95 disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <i className="ri-loader-4-line animate-spin text-xs" />
          ) : (
            <i className="ri-upload-cloud-2-line text-xs" />
          )}
          <span>{loading ? "处理中..." : buttonLabel || t("upload.title")}</span>
        </button>
      </div>
    </div>
  );
}

export function ItemImageInput({
  title,
  description,
  configKeyTitle,
  value,
  placeholder,
  onChange,
  onError,
  shape = "rounded",
}: {
  title: string;
  description: string;
  configKeyTitle: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onError?: (message: string) => void;
  shape?: "rounded" | "circle";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full rounded-xl border border-[rgb(var(--rin-hairline-rgb)/0.85)] bg-[rgb(var(--rin-ink-rgb)/0.02)] overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition hover:bg-[rgb(var(--rin-ink-rgb)/0.02)] cursor-pointer"
        onClick={() => setIsOpen((current) => !current)}
      >
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-[rgb(var(--rin-ink-rgb))]">{title}</div>
          <p className="text-[11px] text-[rgb(var(--rin-ink-muted-rgb))] mt-0.5 line-clamp-1">{description}</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {value ? (
            <ImageWithFallback
              src={value}
              alt={configKeyTitle}
              className={`h-9 w-9 border border-[rgb(var(--rin-hairline-rgb))] ${shape === "circle" ? "rounded-full" : "rounded-xl"}`}
            />
          ) : null}
          <span className="hidden sm:inline max-w-44 truncate text-[11px] font-mono text-[rgb(var(--rin-ink-muted-rgb))]">
            {value || placeholder || configKeyTitle}
          </span>
          <i
            className={`ri-arrow-down-s-line text-base text-[rgb(var(--rin-ink-muted-rgb))] transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>
      {isOpen ? (
        <div className="border-t border-[rgb(var(--rin-hairline-rgb)/0.7)] p-3.5 bg-[rgb(var(--rin-surface-rgb))]">
          <ImageUploadInput
            value={value}
            onChange={onChange}
            onError={onError}
            placeholder={placeholder || configKeyTitle}
            shape={shape}
          />
        </div>
      ) : null}
    </div>
  );
}
