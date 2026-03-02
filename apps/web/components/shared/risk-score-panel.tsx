"use client";

import { useMemo } from "react";
import {
  evaluateRisk,
  simulateVendorStats,
  emptyStats,
  type RiskBreakdown,
} from "@/lib/risk-engine";
import type { Intent } from "@arbcfo/shared";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Activity,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskScorePanelProps {
  intent: Intent;
}

function getScoreColor(score: number): string {
  if (score <= 20) return "text-emerald-600";
  if (score <= 40) return "text-emerald-500";
  if (score <= 60) return "text-amber-500";
  if (score <= 70) return "text-orange-500";
  return "text-red-600";
}

function getScoreBg(score: number): string {
  if (score <= 20) return "bg-emerald-50 border-emerald-200";
  if (score <= 40) return "bg-emerald-50/50 border-emerald-100";
  if (score <= 60) return "bg-amber-50 border-amber-200";
  if (score <= 70) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function getScoreLabel(score: number, decision: string | null): string {
  if (decision === "BLOCKED") return "BLOCKED";
  if (decision === "REVIEW") return "REVIEW";
  if (decision === "SAFE") return "SAFE";
  if (score <= 20) return "LOW RISK";
  if (score <= 40) return "NORMAL";
  if (score <= 60) return "ELEVATED";
  if (score <= 70) return "HIGH";
  return "CRITICAL";
}

function getScoreIcon(score: number) {
  if (score <= 40) return ShieldCheck;
  if (score <= 70) return ShieldAlert;
  return ShieldX;
}

export function RiskScorePanel({ intent }: RiskScorePanelProps) {
  const hasOracleData = intent.riskScore != null && intent.oracleDecision != null;

  // Parse oracle breakdown if available
  const oracleBreakdown = useMemo(() => {
    if (!intent.oracleBreakdown) return null;
    try {
      return JSON.parse(intent.oracleBreakdown) as Record<string, number>;
    } catch {
      return null;
    }
  }, [intent.oracleBreakdown]);

  // Local fallback only when no oracle data
  const localBreakdown: RiskBreakdown | null = useMemo(() => {
    if (hasOracleData) return null;

    const amountUsdc = intent.amountFormatted || parseFloat(intent.amount) / 1_000_000;
    const now = Math.floor(Date.now() / 1000);

    let stats;
    if (intent.vendorName === "Acme Cloud Services") {
      stats = simulateVendorStats(intent.vendor, 2500, 12);
    } else if (intent.vendorName === "DigitalOcean") {
      stats = simulateVendorStats(intent.vendor, 850, 8);
    } else if (intent.vendorName === "AWS Billing") {
      stats = simulateVendorStats(intent.vendor, 3000, 15);
    } else {
      stats = emptyStats();
    }

    return evaluateRisk(stats, amountUsdc, now);
  }, [hasOracleData, intent.vendor, intent.vendorName, intent.amount, intent.amountFormatted]);

  const score = hasOracleData ? intent.riskScore! : (localBreakdown?.compositeScore ?? 0);
  const decision = intent.oracleDecision || null;
  const ScoreIcon = getScoreIcon(score);

  return (
    <div className="space-y-3">
      {/* Header: Composite Score */}
      <div className={cn("rounded-xl border p-4", getScoreBg(score))}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              score <= 40 ? "bg-emerald-100" : score <= 70 ? "bg-amber-100" : "bg-red-100"
            )}>
              <ScoreIcon className={cn("w-5 h-5", getScoreColor(score))} />
            </div>
            <div>
              <p className="text-xs text-ink-muted uppercase tracking-wider font-medium">
                {hasOracleData ? "Oracle Risk Score" : "Estimated Risk Score"}
              </p>
              <p className="text-[10px] text-ink-light">
                {hasOracleData ? "On-chain assessment via TransactionRiskOracle" : "Local estimate — not oracle-backed"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn(
              "font-display text-3xl font-black tracking-tight",
              getScoreColor(score)
            )}>
              {score}
            </p>
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-widest",
              getScoreColor(score)
            )}>
              {getScoreLabel(score, decision)}
            </p>
          </div>
        </div>

        {/* Oracle breakdown if available */}
        {hasOracleData && oracleBreakdown && (
          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-black/5">
            {oracleBreakdown.stylusScore != null && (
              <div className="text-center">
                <p className="text-[10px] text-ink-light">Stylus</p>
                <p className="text-sm font-bold tabular-nums text-ink">{oracleBreakdown.stylusScore}</p>
              </div>
            )}
            {oracleBreakdown.identityScore != null && (
              <div className="text-center">
                <p className="text-[10px] text-ink-light">Identity</p>
                <p className="text-sm font-bold tabular-nums text-ink">{oracleBreakdown.identityScore}</p>
              </div>
            )}
            {oracleBreakdown.correlationScore != null && (
              <div className="text-center">
                <p className="text-[10px] text-ink-light">Correlation</p>
                <p className="text-sm font-bold tabular-nums text-ink">{oracleBreakdown.correlationScore}</p>
              </div>
            )}
            {oracleBreakdown.compoundBonus != null && oracleBreakdown.compoundBonus > 0 && (
              <div className="text-center">
                <p className="text-[10px] text-red-500">Compound</p>
                <p className="text-sm font-bold tabular-nums text-red-600">+{oracleBreakdown.compoundBonus}</p>
              </div>
            )}
          </div>
        )}

        {/* Local fallback breakdown */}
        {!hasOracleData && localBreakdown && (
          <div className="mt-3 pt-3 border-t border-black/5">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] text-amber-600 font-medium">
                Local estimate — oracle assessment pending
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Oracle tx proof */}
      {intent.oracleTxHash && (
        <a
          href={`https://sepolia.arbiscan.io/tx/${intent.oracleTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-iris/5 rounded-lg border border-iris/10 hover:bg-iris/10 transition-colors"
        >
          <Shield className="w-3.5 h-3.5 text-iris" />
          <span className="text-[10px] text-iris font-medium">Oracle assessment verified on-chain</span>
          <span className="text-[10px] font-mono text-iris/70 truncate flex-1">{intent.oracleTxHash}</span>
          <ExternalLink className="w-3 h-3 text-iris shrink-0" />
        </a>
      )}

      {/* Engine Tag */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-ink-light">
        <Shield className="w-3 h-3" />
        <span>
          {hasOracleData
            ? "TransactionRiskOracle · Stylus WASM · EMA + MAD + Correlation"
            : "Local risk-engine.ts · Awaiting oracle integration"}
        </span>
      </div>
    </div>
  );
}
