"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { RiskBreakdown } from "@/lib/risk-engine";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSearch,
  Copy,
  Users,
  Shield,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Brain,
  Zap,
} from "lucide-react";

// ─── Types (mirrors API) ───

interface AgentStep {
  id: string;
  label: string;
  status: "done" | "warn" | "error";
  detail: string;
  data?: Record<string, unknown>;
  durationMs: number;
}

interface AgentAnalysis {
  steps: AgentStep[];
  parsed: {
    vendor?: string;
    vendorAddress?: string;
    amount?: number;
    invoiceNumber?: string;
    dueDate?: string;
    memo?: string;
    confidence: number;
    suggestedCategory?: string;
  };
  riskBreakdown: RiskBreakdown | null;
  duplicateFound: boolean;
  duplicateIntentId?: number;
  vendorHistory: {
    totalIntents: number;
    totalPaid: number;
    avgAmount: number;
    lastPaymentDate: string | null;
    isNewVendor: boolean;
  };
  narrative: string;
  recommendation: "AUTO_APPROVE" | "REVIEW" | "BLOCK";
}

interface AgentAnalysisPanelProps {
  invoiceText: string;
  vendorAddress?: string;
  onComplete: (analysis: AgentAnalysis) => void;
  onCancel: () => void;
}

// ─── Step Icons ───

const STEP_ICONS: Record<string, typeof FileSearch> = {
  parse: FileSearch,
  dedup: Copy,
  vendor: Users,
  risk: Shield,
  narrative: Brain,
};

const STATUS_COLORS = {
  done: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
  },
  warn: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: XCircle,
    iconColor: "text-red-500",
  },
};

const RECOMMENDATION_CONFIG = {
  AUTO_APPROVE: {
    label: "Auto-Approve",
    description: "All risk checks passed. Safe for autonomous execution.",
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    icon: Zap,
    iconBg: "bg-emerald-100",
  },
  REVIEW: {
    label: "Route to Review",
    description: "Risk signals detected. Requires human approval via multisig.",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    icon: AlertTriangle,
    iconBg: "bg-amber-100",
  },
  BLOCK: {
    label: "Block Payment",
    description: "Critical risk detected. Payment blocked pending investigation.",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    icon: XCircle,
    iconBg: "bg-red-100",
  },
};

// ─── Simulated step labels for the loading state ───

const STEP_PHASES = [
  { label: "Extracting invoice fields…", duration: 800 },
  { label: "Checking for duplicate invoices…", duration: 600 },
  { label: "Analyzing vendor payment history…", duration: 700 },
  { label: "Running 4D risk scoring engine…", duration: 900 },
  { label: "Generating risk narrative…", duration: 500 },
];

// ─── Component ───

export function AgentAnalysisPanel({
  invoiceText,
  vendorAddress,
  onComplete,
  onCancel,
}: AgentAnalysisPanelProps) {
  const [phase, setPhase] = useState<"analyzing" | "complete">("analyzing");
  const [currentStep, setCurrentStep] = useState(0);
  const [analysis, setAnalysis] = useState<AgentAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleSteps, setVisibleSteps] = useState<number>(0);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [showRisk, setShowRisk] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const [showRec, setShowRec] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Run analysis on mount
  useEffect(() => {
    let cancelled = false;

    const runAnalysis = async () => {
      // Animate through loading steps
      for (let i = 0; i < STEP_PHASES.length; i++) {
        if (cancelled) return;
        setCurrentStep(i);
        await sleep(STEP_PHASES[i].duration);
      }

      try {
        const res = await fetch("/api/agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: invoiceText, vendorAddress }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Analysis failed");
        }

        const data = await res.json();
        if (cancelled) return;

        setAnalysis(data.analysis);
        setPhase("complete");

        // Reveal steps one by one
        const steps = data.analysis.steps;
        for (let i = 0; i < steps.length; i++) {
          if (cancelled) return;
          await sleep(300);
          setVisibleSteps(i + 1);
        }

        // Reveal risk, narrative, recommendation with delays
        await sleep(400);
        if (!cancelled) setShowRisk(true);
        await sleep(300);
        if (!cancelled) setShowNarrative(true);
        await sleep(300);
        if (!cancelled) setShowRec(true);

        // Scroll to bottom
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        }, 200);

        onComplete(data.analysis);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    runAnalysis();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={scrollRef}
      className="space-y-4 max-h-[500px] overflow-y-auto pr-1"
    >
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-mist">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-iris to-violet-600 flex items-center justify-center shadow-sm">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold text-ink">
            CFO Agent Analysis
          </h3>
          <p className="text-[10px] text-ink-light">
            {phase === "analyzing"
              ? "Multi-step autonomous analysis in progress…"
              : `Analysis complete — ${analysis?.steps.length || 0} checks performed`}
          </p>
        </div>
      </div>

      {/* Loading State */}
      {phase === "analyzing" && !error && (
        <div className="space-y-3">
          {STEP_PHASES.map((step, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-500",
                i < currentStep
                  ? "bg-emerald-50/50 text-emerald-600"
                  : i === currentStep
                    ? "bg-iris/5 text-iris"
                    : "text-ink-light opacity-40"
              )}
            >
              {i < currentStep ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : i === currentStep ? (
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-current flex-shrink-0" />
              )}
              <span className="text-xs font-medium">{step.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <p className="text-sm font-medium text-red-700">Analysis Failed</p>
          </div>
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={onCancel}
            className="btn-secondary mt-3 text-xs"
          >
            Go Back
          </button>
        </div>
      )}

      {/* Results */}
      {phase === "complete" && analysis && (
        <>
          {/* Step Results */}
          <div className="space-y-2">
            {analysis.steps.map((step, i) => {
              if (i >= visibleSteps) return null;

              const colors = STATUS_COLORS[step.status];
              const StatusIcon = colors.icon;
              const StepIcon = STEP_ICONS[step.id] || Shield;
              const isExpanded = expandedStep === step.id;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "rounded-lg border transition-all duration-300 animate-fade-in overflow-hidden",
                    colors.bg,
                    colors.border
                  )}
                >
                  <button
                    onClick={() =>
                      setExpandedStep(isExpanded ? null : step.id)
                    }
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                  >
                    <StatusIcon
                      className={cn("w-3.5 h-3.5 flex-shrink-0", colors.iconColor)}
                    />
                    <StepIcon className="w-3.5 h-3.5 text-ink-muted flex-shrink-0" />
                    <span className={cn("text-xs font-medium flex-1", colors.text)}>
                      {step.label}
                    </span>
                    <span className="text-[10px] text-ink-light tabular-nums">
                      {step.durationMs}ms
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-ink-light" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-ink-light" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-2.5 pt-0">
                      <p className="text-[11px] text-ink-muted leading-relaxed">
                        {step.detail}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Risk Breakdown (if scored) */}
          {analysis.riskBreakdown &&
            visibleSteps >= analysis.steps.length &&
            showRisk && (
              <div className="animate-fade-in">
                <RiskScoreMini breakdown={analysis.riskBreakdown} />
              </div>
            )}

          {/* Narrative */}
          {visibleSteps >= analysis.steps.length && showNarrative && (
            <div className="animate-fade-in">
              <div className="flex items-start gap-2 bg-pearl rounded-xl p-3 border border-mist">
                <MessageSquare className="w-3.5 h-3.5 text-ink-muted flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-ink-light uppercase tracking-wider font-medium mb-1">
                    Agent Assessment
                  </p>
                  {analysis.narrative.split("\n").map((line, i) => (
                    <p
                      key={i}
                      className="text-xs text-ink-muted leading-relaxed"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recommendation Badge */}
          {visibleSteps >= analysis.steps.length && showRec && (
            <div className="animate-fade-in">
              <RecommendationBadge recommendation={analysis.recommendation} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub-Components ───

function RiskScoreMini({ breakdown }: { breakdown: RiskBreakdown }) {
  const scoreColor =
    breakdown.compositeScore <= 40
      ? "text-emerald-600"
      : breakdown.compositeScore <= 70
        ? "text-amber-600"
        : "text-red-600";

  const scoreBg =
    breakdown.compositeScore <= 40
      ? "bg-emerald-50 border-emerald-100"
      : breakdown.compositeScore <= 70
        ? "bg-amber-50 border-amber-100"
        : "bg-red-50 border-red-100";

  return (
    <div className={cn("rounded-xl border p-3", scoreBg)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-ink-muted" />
          <span className="text-[10px] text-ink-light uppercase tracking-wider font-medium">
            Stylus Risk Score
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn("font-display text-xl font-black", scoreColor)}>
            {breakdown.compositeScore}
          </span>
          <span className="text-[10px] text-ink-light">/100</span>
        </div>
      </div>

      {/* Mini bars */}
      <div className="grid grid-cols-4 gap-2">
        {(
          Object.entries(breakdown.dimensions) as [
            string,
            { score: number; weight: number },
          ][]
        ).map(([key, dim]) => {
          const pct = dim.weight > 0 ? (dim.score / dim.weight) * 100 : 0;
          const labels: Record<string, string> = {
            newVendor: "Trust",
            velocity: "Velocity",
            volume: "Volume",
            deviation: "Deviation",
          };
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-ink-light">{labels[key]}</span>
                <span className="text-[9px] font-medium text-ink-muted tabular-nums">
                  {dim.score}
                </span>
              </div>
              <div className="h-1 bg-black/5 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    pct > 66
                      ? "bg-red-400"
                      : pct > 33
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {breakdown.circuitBreaker && (
        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-red-600 font-medium">
          <AlertTriangle className="w-3 h-3" />
          Circuit breaker triggered
        </div>
      )}
    </div>
  );
}

function RecommendationBadge({
  recommendation,
}: {
  recommendation: "AUTO_APPROVE" | "REVIEW" | "BLOCK";
}) {
  const config = RECOMMENDATION_CONFIG[recommendation];
  const Icon = config.icon;

  return (
    <div className={cn("rounded-xl border p-3", config.bg)}>
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            config.iconBg
          )}
        >
          <Icon className={cn("w-4 h-4", config.text)} />
        </div>
        <div>
          <p className={cn("text-xs font-bold", config.text)}>
            {config.label}
          </p>
          <p className="text-[10px] text-ink-muted">{config.description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Utils ───

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
