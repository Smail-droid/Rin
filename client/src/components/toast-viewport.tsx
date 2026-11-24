import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeToast, type ToastPayload, type ToastTone } from "../utils/toast";

const MAX_VISIBLE_TOASTS = 4;

function ToastToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    );
  }

  return (
    <span
      className="h-2 w-2 rounded-full bg-theme shrink-0"
      aria-hidden="true"
    />
  );
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;

    const unsubscribe = subscribeToast((nextToast) => {
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE_TOASTS - 1)), nextToast]);

      const timer = setTimeout(() => {
        timers.delete(nextToast.id);
        setToasts((prev) => prev.filter((item) => item.id !== nextToast.id));
      }, nextToast.durationMs);

      timers.set(nextToast.id, timer);
    });

    return () => {
      unsubscribe();
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  if (typeof document === "undefined" || toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[9999] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end sm:px-0"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          data-toast-tone={toast.tone}
          className="pointer-events-none inline-flex max-w-sm items-center gap-2 rounded-full border border-[rgb(var(--rin-hairline-rgb)/0.9)] bg-[rgb(var(--rin-elevated-rgb)/0.94)] px-3.5 py-2 text-xs font-medium text-[rgb(var(--rin-ink-rgb))] shadow-[0_8px_28px_rgba(0,0,0,0.08)] backdrop-blur-md dark:shadow-[0_10px_32px_rgba(0,0,0,0.45)] ani-show-fast"
        >
          <ToastToneIcon tone={toast.tone} />
          <span className="truncate">{toast.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
