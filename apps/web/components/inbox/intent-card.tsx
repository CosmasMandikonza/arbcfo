"use client";

import { cn, formatUSDC, categoryName, categoryColor, timeAgo, truncateAddress } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Intent } from "@arbcfo/shared";
import { Clock, User, Shield, ExternalLink } from "lucide-react";

interface IntentCardProps {
  intent: Intent;
  selected?: boolean;
  onClick?: () => void;
}

function riskBadge(score: number | null | undefined, decision: string | null | undefined) {
  if (score == null) return null;
  const d = decision || "SAFE";
  const color =
    d === "BLOCKED" ? "bg-red-100 text-red-700 border-red-200"
    : d === "REVIEW" ? "bg-orange-100 text-orange-700 border-orange-200"
    : "bg-emerald-100 text-emerald-700 border-emerald-200";

  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border", color)}>
      <Shield className="w-2.5 h-2.5" />
      {score}
    </span>
  );
}

export function IntentCard({ intent, selected, onClick }: IntentCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-2xl border transition-all duration-200 animate-fade-in",
        selected
          ? "bg-iris/5 border-iris/20 shadow-card"
          : "bg-frost border-mist hover:border-iris/10 hover:shadow-soft"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-ink truncate">
            {intent.vendorName || truncateAddress(intent.vendor)}
          </h3>
          {intent.invoiceNumber && (
            <p className="text-xs text-ink-light mt-0.5">{intent.invoiceNumber}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-lg font-semibold text-ink tabular-nums">
            {formatUSDC(intent.amount)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={intent.status} />
        {riskBadge(intent.riskScore, intent.oracleDecision)}
        <span
          className="status-badge"
          style={{
            backgroundColor: categoryColor(intent.categoryId) + "15",
            color: categoryColor(intent.categoryId),
          }}
        >
          {categoryName(intent.categoryId)}
        </span>
        <span className="flex items-center gap-1 text-xs text-ink-light ml-auto">
          <Clock className="w-3 h-3" />
          {timeAgo(intent.createdAt)}
        </span>
      </div>

      {/* Oracle tx proof */}
      {intent.oracleTxHash && (
        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-iris">
          <Shield className="w-3 h-3" />
          <span className="font-mono truncate">{intent.oracleTxHash}</span>
          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
        </div>
      )}

      {intent.memo && (
        <p className="text-xs text-ink-muted mt-2 truncate">{intent.memo}</p>
      )}

      {(intent.status === 1 || intent.status === 6) && intent.approvalCount > 0 && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-mist">
          <div className="flex -space-x-1.5">
            {Array.from({ length: intent.approvalCount }).map((_, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full bg-emerald-100 border-2 border-frost flex items-center justify-center"
              >
                <User className="w-2.5 h-2.5 text-emerald-600" />
              </div>
            ))}
          </div>
          <span className="text-xs text-ink-muted">
            {intent.approvalCount} approval{intent.approvalCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </button>
  );
}
