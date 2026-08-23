// MIT — beUI text-shimmer (https://beui.dev/r/text-shimmer)

import { cn } from "~/lib/utils";
import type { ElementType, ReactNode } from "react";
import {
  TEXT_SHIMMER_CLASS_NAME,
  TEXT_SHIMMER_KEYFRAMES,
  textShimmerStyle,
} from "~/lib/text-shimmer";

export type TextShimmerProps = {
  children: ReactNode;
  as?: ElementType;
  duration?: number;
  className?: string;
};

export function TextShimmer({
  children,
  as: Comp = "span",
  duration = 2.5,
  className,
}: TextShimmerProps): React.JSX.Element {
  return (
    <>
      <style>{TEXT_SHIMMER_KEYFRAMES}</style>
      <Comp
        style={textShimmerStyle(duration)}
        className={cn("inline-block", TEXT_SHIMMER_CLASS_NAME, className)}
      >
        {children}
      </Comp>
    </>
  );
}
