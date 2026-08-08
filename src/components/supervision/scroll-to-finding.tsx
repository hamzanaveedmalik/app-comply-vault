"use client";

import { useEffect } from "react";

export function ScrollToFinding({ findingId }: { findingId: string }): null {
  useEffect(() => {
    const el = document.getElementById(`finding-${findingId}`);
    el?.scrollIntoView({ block: "center" });
  }, [findingId]);
  return null;
}
