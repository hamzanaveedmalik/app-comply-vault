"use client";
// MIT — beUI button-stateful (https://beui.dev/r/button-stateful), adapted for ComplyVault tokens.

import { Check, Loader2, X } from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import {
  forwardRef,
  type ComponentProps,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { VariantProps } from "class-variance-authority";
import { useReducedMotion } from "~/hooks/use-reduced-motion";
import { cn } from "~/lib/utils";
import { Button, buttonVariants } from "~/components/ui/button";
import { EASE_OUT, SPRING_SWAP, STATE_TRANSITION } from "~/components/ui/motion-config";

export type ButtonState = "idle" | "loading" | "success" | "error";

export function pendingButtonState(active: boolean): ButtonState {
  return active ? "loading" : "idle";
}

export type StatefulButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    state?: ButtonState;
    loadingText?: ReactNode;
    successText?: ReactNode;
    errorText?: ReactNode;
    icon?: ReactNode;
  };

const ICON_VARIANTS: Variants = {
  initial: { opacity: 0, width: 0, scale: 0.85 },
  animate: {
    opacity: 1,
    width: "1.25rem",
    scale: 1,
    transition: SPRING_SWAP,
  },
  exit: {
    opacity: 0,
    width: 0,
    scale: 0.85,
    transition: STATE_TRANSITION,
  },
};

function IconSlot({ keyId, children }: { keyId: string; children: ReactNode }): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={keyId}
      variants={ICON_VARIANTS}
      initial={reduce ? { opacity: 0 } : "initial"}
      animate={reduce ? { opacity: 1 } : "animate"}
      exit={reduce ? { opacity: 0 } : "exit"}
      transition={reduce ? STATE_TRANSITION : undefined}
      className="inline-grid shrink-0 place-items-center overflow-hidden"
    >
      {children}
    </motion.span>
  );
}

function TextSlot({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}): React.JSX.Element {
  const reduce = useReducedMotion();
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const nextWidth = measureRef.current?.offsetWidth;
    if (!nextWidth) return;
    setWidth((current) => (current === nextWidth ? current : nextWidth));
  });

  return (
    <motion.span
      initial={false}
      animate={{ width }}
      transition={reduce ? { duration: 0 } : SPRING_SWAP}
      className="relative inline-block overflow-hidden whitespace-nowrap align-bottom"
    >
      <span
        ref={measureRef}
        aria-hidden
        className="invisible inline-block whitespace-nowrap"
      >
        {children}
      </span>
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={`text-${value}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={reduce ? STATE_TRANSITION : SPRING_SWAP}
          className="absolute left-0 top-0 inline-block"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

export const StatefulButton = forwardRef<HTMLButtonElement, StatefulButtonProps>(
  function StatefulButton(
    {
      state = "idle",
      children,
      loadingText = "Loading",
      successText = "Done",
      errorText = "Try again",
      icon,
      disabled,
      className,
      variant,
      size,
      ...rest
    },
    ref,
  ) {
    const isBusy = state === "loading";
    const stateText =
      state === "loading"
        ? loadingText
        : state === "success"
          ? successText
          : state === "error"
            ? errorText
            : children;
    const textKey =
      typeof stateText === "string" ? `${state}-${stateText}` : state;

    return (
      <Button
        ref={ref}
        disabled={disabled || isBusy}
        aria-busy={isBusy}
        variant={variant}
        size={size}
        className={cn(className)}
        {...rest}
      >
        <span
          aria-live="polite"
          className="relative inline-flex items-center justify-center gap-1.5 overflow-hidden"
        >
          <AnimatePresence initial={false}>
            {state === "loading" ? (
              <IconSlot keyId="loading-icon">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </IconSlot>
            ) : null}
            {state === "success" ? (
              <IconSlot keyId="success-icon">
                <Check className="h-4 w-4" aria-hidden />
              </IconSlot>
            ) : null}
            {state === "error" ? (
              <IconSlot keyId="error-icon">
                <X className="h-4 w-4" aria-hidden />
              </IconSlot>
            ) : null}
          </AnimatePresence>

          <TextSlot value={textKey}>{stateText}</TextSlot>

          <AnimatePresence initial={false}>
            {state === "idle" && icon ? (
              <IconSlot keyId="idle-icon">{icon}</IconSlot>
            ) : null}
          </AnimatePresence>
        </span>
      </Button>
    );
  },
);
