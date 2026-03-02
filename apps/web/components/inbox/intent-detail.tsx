"use client";

import { toast } from "sonner";
import { cn, formatUSDC, formatDate, categoryName, categoryColor, truncateAddress } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { WorkflowTimeline } from "@/components/shared/workflow-timeline";
import { RiskScorePanel } from "@/components/shared/risk-score-panel";
import { IntentStatus } from "@arbcfo/shared";
import type { Intent } from "@arbcfo/shared";
import {
  X, ExternalLink, Copy, CheckCircle2,
  FileText, Shield, Hash, User, AlertTriangle, ArrowRight
} from "lucide-react";
import Link from "next/link";

interface IntentDetailProps {
  intent: Intent;
  onClose: () => void;
}

export function IntentDetail({ intent, onClose }: IntentDetailProps) {
  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast.success("Copied to clipboard");
  };

  const isActionable =
    intent.status === IntentStatus.AwaitingApprovals ||
    intent.status === IntentStatus.PendingRiskReview;

  return (
    <div className="animate-slide-in-right bg-frost border-l border-mist h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-frost border-b border-mist p-4 flex items-center justify-between z-10">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Payment Intent #{intent.id}
          </h2>
          <p className="text-xs text-ink-muted">{intent.invoiceNumber || "No invoice number"}</p>
        </div>
        <button onClick={onClose} className="btn-ghost p-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Workflow Timeline */}
        <WorkflowTimeline status={intent.status} />

        {/* Risk Review Banner */}
        {intent.status === IntentStatus.PendingRiskReview && (
          <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800">Flagged by Transaction Risk Oracle</p>
              <p className="text-xs text-orange-600 mt-0.5">
                This transaction was escalated for manual review by the on-chain risk oracle.
                {intent.riskScore != null && ` Composite risk score: ${intent.riskScore}/100.`}
              </p>
            </div>
          </div>
        )}

        {/* Amount & Vendor */}
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">Pay to</p>
              <p className="font-medium text-ink">{intent.vendorName || "Unknown Vendor"}</p>
              <p className="text-xs text-ink-light font-mono">{truncateAddress(intent.vendor)}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-ink">{formatUSDC(intent.amount)}</p>
              <p className="text-xs text-ink-muted">USDC</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-mist">
            <div>
              <p className="text-xs text-ink-muted mb-0.5">Category</p>
              <span
                className="status-badge"
                style={{
                  backgroundColor: categoryColor(intent.categoryId) + "15",
                  color: categoryColor(intent.categoryId),
                }}
              >
                {categoryName(intent.categoryId)}
              </span>
            </div>
            <div>
              <p className="text-xs text-ink-muted mb-0.5">Due Date</p>
              <p className="text-sm font-medium text-ink">{formatDate(intent.dueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted mb-0.5">Status</p>
              <StatusBadge status={intent.status} />
            </div>
            <div>
              <p className="text-xs text-ink-muted mb-0.5">Created</p>
              <p className="text-sm text-ink">{formatDate(intent.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Memo */}
        {intent.memo && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-ink-muted" />
              <p className="text-xs text-ink-muted uppercase tracking-wider">Memo</p>
            </div>
            <p className="text-sm text-ink">{intent.memo}</p>
          </div>
        )}

        {/* Invoice Hash */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-ink-muted" />
            <p className="text-xs text-ink-muted uppercase tracking-wider">Invoice Hash</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-ink-muted font-mono flex-1 truncate">
              {intent.invoiceHash}
            </code>
            <button
              onClick={() => copyHash(intent.invoiceHash)}
              className="btn-ghost p-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4D Risk Score — Stylus Engine Visualization */}
        <RiskScorePanel intent={intent} />

        {/* Approval Lane */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-ink-muted" />
            <p className="text-xs text-ink-muted uppercase tracking-wider">
              Approvals ({intent.approvalCount} collected)
            </p>
          </div>
          {intent.approvalCount > 0 ? (
            <div className="space-y-2">
              {Array.from({ length: intent.approvalCount }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg"
                >
                  <User className="w-3.5 h-3.5" />
                  Signed by approver #{i + 1}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-light">No approvals yet.</p>
          )}
        </div>

        {/* Action: link to approvals page for signing */}
        {isActionable && (
          <Link
            href="/approvals"
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Go to Approvals to Sign
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}

        {/* Executed: show receipt link */}
        {intent.status === IntentStatus.Executed && intent.txHash && (
          <a
            href={`https://sepolia.arbiscan.io/tx/${intent.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View on Arbiscan
          </a>
        )}

        {/* Rejected info */}
        {intent.status === IntentStatus.Rejected && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <X className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-700 font-medium">This intent was rejected.</p>
          </div>
        )}
      </div>
    </div>
  );
}
