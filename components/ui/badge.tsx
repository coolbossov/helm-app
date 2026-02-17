import { cn } from "@/lib/utils";
import { BUSINESS_TYPE_COLORS } from "@/types";

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={
        color
          ? {
              backgroundColor: `${color}15`,
              color: color,
              border: `1px solid ${color}30`,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function BusinessTypeBadge({ type }: { type: string }) {
  const color = BUSINESS_TYPE_COLORS[type] || BUSINESS_TYPE_COLORS.Other;
  return <Badge color={color}>{type}</Badge>;
}
