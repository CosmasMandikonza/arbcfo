"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="w-14 h-14 rounded-2xl bg-iris/5 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-iris/40" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-muted max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}
