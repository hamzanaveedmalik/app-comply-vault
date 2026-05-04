"use client";

import { useEffect, type RefObject } from "react";

/**
 * Invokes `onClose` when a pointer down occurs outside `ref`’s element.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClose: () => void,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handlePointerDown(event: MouseEvent): void {
      const node = ref.current;
      if (!node) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && !node.contains(target)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [ref, onClose, enabled]);
}
