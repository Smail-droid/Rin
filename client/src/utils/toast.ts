export type ToastTone = "success" | "info" | "error";

export interface ToastPayload {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
  createdAt: number;
}

export type ToastListener = (toast: ToastPayload) => void;

const DEFAULT_TOAST_DURATION_MS = 2400;
const listeners = new Set<ToastListener>();
let toastSequence = 0;

export function subscribeToast(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitToast(
  message: string,
  tone: ToastTone = "info",
  durationMs = DEFAULT_TOAST_DURATION_MS,
): ToastPayload | null {
  const cleanMessage = String(message ?? "").trim();
  if (!cleanMessage) {
    return null;
  }

  const safeDuration =
    typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0
      ? durationMs
      : DEFAULT_TOAST_DURATION_MS;

  const payload: ToastPayload = {
    id: `rin-toast-${Date.now()}-${++toastSequence}`,
    message: cleanMessage,
    tone,
    durationMs: safeDuration,
    createdAt: Date.now(),
  };

  for (const listener of Array.from(listeners)) {
    listener(payload);
  }

  return payload;
}
