import { cn } from "~/lib/utils";

export type GradientInitialsAvatarProps = {
  initials: string;
  avatarColor: string;
  /** Default: 26 (px). */
  size?: number;
  className?: string;
};

/**
 * Circular gradient avatar with initials (team roster in workspace dropdown).
 */
export function GradientInitialsAvatar({
  initials,
  avatarColor,
  size = 26,
  className,
}: GradientInitialsAvatarProps): React.JSX.Element {
  const label = initials.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}88)`,
      }}
      aria-hidden
    >
      {label}
    </div>
  );
}
