/**
 * Global toast store — bridges sonner-style API to AnimatedToastStack.
 */

import type {
  AnimatedToast,
  ToastInput,
  ToastStatus,
} from "~/components/ui/animated-toast-stack";

type Listener = (toasts: AnimatedToast[]) => void;

let toasts: AnimatedToast[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, { timer: number; signature: string }>();

const DEFAULT_DURATION = 4200;
const MAX_VISIBLE = 3;

function emit(): void {
  listeners.forEach((listener) => listener([...toasts]));
}

function createToast(input: ToastInput, defaultDuration = DEFAULT_DURATION): AnimatedToast {
  return {
    ...input,
    id: input.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    status: input.status ?? "neutral",
    createdAt: Date.now(),
    duration: input.duration ?? defaultDuration,
    dismissible: input.dismissible ?? true,
  };
}

function scheduleDismiss(id: string, toast: AnimatedToast): void {
  const duration = toast.duration ?? DEFAULT_DURATION;
  const existing = timers.get(id);
  if (duration <= 0) {
    if (existing) {
      window.clearTimeout(existing.timer);
      timers.delete(id);
    }
    return;
  }
  const signature = `${toast.createdAt ?? Date.now()}:${duration}`;
  if (existing?.signature === signature) return;
  if (existing) window.clearTimeout(existing.timer);
  const elapsed = Date.now() - (toast.createdAt ?? Date.now());
  const remaining = Math.max(duration - elapsed, 0);
  const timer = window.setTimeout(() => dismissToast(id), remaining);
  timers.set(id, { timer, signature });
}

function refreshTimers(): void {
  const activeIds = new Set(toasts.map((t) => t.id));
  timers.forEach((entry, id) => {
    if (!activeIds.has(id)) {
      window.clearTimeout(entry.timer);
      timers.delete(id);
    }
  });
  toasts.forEach((toast) => scheduleDismiss(toast.id, toast));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener([...toasts]);
  return () => listeners.delete(listener);
}

export function getToasts(): AnimatedToast[] {
  return [...toasts];
}

export function dismissToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
  refreshTimers();
}

export function pushToast(input: ToastInput): string {
  const toast = createToast(input);
  toasts = [...toasts, toast].slice(-MAX_VISIBLE);
  emit();
  refreshTimers();
  return toast.id;
}

export function updateToast(id: string, patch: Partial<ToastInput>): void {
  toasts = toasts.map((toast) =>
    toast.id === id
      ? {
          ...toast,
          ...patch,
          id,
          createdAt: patch.duration === undefined ? toast.createdAt : Date.now(),
        }
      : toast,
  );
  emit();
  refreshTimers();
}

export function clearToasts(): void {
  toasts = [];
  emit();
  refreshTimers();
}

type ToastOptions = {
  description?: string;
  duration?: number;
  id?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

function show(
  title: string,
  status: ToastStatus,
  options?: ToastOptions,
): string {
  return pushToast({
    title,
    description: options?.description,
    duration: options?.duration,
    id: options?.id,
    status,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: () => options.action?.onClick(),
        }
      : undefined,
  });
}

function toastMessage(title: string, options?: ToastOptions): string {
  return show(title, "neutral", options);
}

export const toast = Object.assign(toastMessage, {
  message: toastMessage,
  success: (title: string, options?: ToastOptions): string =>
    show(title, "success", options),
  error: (title: string, options?: ToastOptions): string =>
    show(title, "error", options),
  info: (title: string, options?: ToastOptions): string =>
    show(title, "info", options),
  loading: (title: string, options?: ToastOptions): string =>
    show(title, "loading", { ...options, duration: options?.duration ?? 0 }),
  dismiss: dismissToast,
  promise: async <T>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    },
  ): Promise<T> => {
    const id = toast.loading(msgs.loading);
    try {
      const data = await promise;
      const successTitle =
        typeof msgs.success === "function" ? msgs.success(data) : msgs.success;
      updateToast(id, { title: successTitle, status: "success", duration: DEFAULT_DURATION });
      return data;
    } catch (err) {
      const errorTitle =
        typeof msgs.error === "function" ? msgs.error(err) : msgs.error;
      updateToast(id, { title: errorTitle, status: "error", duration: DEFAULT_DURATION });
      throw err;
    }
  },
});
