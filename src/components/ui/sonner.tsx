"use client";

import { useEffect, useState } from "react";
import {
  AnimatedToastStack,
  type AnimatedToast,
} from "~/components/ui/animated-toast-stack";
import { dismissToast, subscribe } from "~/lib/toast-store";

export function Toaster(): React.JSX.Element {
  const [toasts, setToasts] = useState<AnimatedToast[]>([]);

  useEffect(() => subscribe(setToasts), []);

  return (
    <AnimatedToastStack
      toasts={toasts}
      onDismiss={dismissToast}
      position="bottom-right"
      maxVisible={3}
      portal
    />
  );
}
