"use client";

import { cn, statusColor, statusLabel } from "@/lib/utils";

export function StatusBadge({ status }: { status: number }) {
  return (
    <span className={cn("status-badge", statusColor(status))}>
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === 0 && "bg-gray-400",
          status === 1 && "bg-amber-500 animate-pulse",
          status === 2 && "bg-blue-500",
          status === 3 && "bg-emerald-500",
          status === 4 && "bg-red-500",
          status === 5 && "bg-gray-400",
          status === 6 && "bg-orange-500 animate-pulse"
        )}
      />
      {statusLabel(status)}
    </span>
  );
}
