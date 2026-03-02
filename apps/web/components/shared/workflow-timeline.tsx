"use client";

import { cn } from "@/lib/utils";
import { FileText, Shield, CheckCircle2, Zap, Receipt } from "lucide-react";

const steps = [
  { key: "intake", label: "Intake", icon: FileText },
  { key: "policy", label: "Risk Check", icon: Shield },
  { key: "approvals", label: "Approvals", icon: CheckCircle2 },
  { key: "execution", label: "Execution", icon: Zap },
  { key: "receipt", label: "Receipt", icon: Receipt },
];

function getActiveStep(status: number): number {
  switch (status) {
    case 0: return 0; // Draft
    case 1: return 2; // Awaiting Approvals
    case 2: return 3; // Scheduled
    case 3: return 4; // Executed
    case 4: return -1; // Rejected
    case 5: return -1; // Cancelled
    case 6: return 1; // PendingRiskReview — flagged at risk check
    default: return 0;
  }
}

export function WorkflowTimeline({ status }: { status: number }) {
  const activeStep = getActiveStep(status);
  const isTerminal = status === 4 || status === 5;
  const isRiskReview = status === 6;

  return (
    <div className="flex items-center gap-1 py-3">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isComplete = !isTerminal && !isRiskReview && i < activeStep;
        const isCurrent = !isTerminal && i === activeStep;
        const isFailed = isTerminal;
        const isRiskFlagged = isRiskReview && i === activeStep;

        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                isComplete && "bg-emerald-50 text-emerald-700",
                isCurrent && !isRiskFlagged && "bg-iris/10 text-iris ring-1 ring-iris/20",
                isRiskFlagged && "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
                isRiskReview && i < activeStep && "bg-emerald-50 text-emerald-700",
                !isComplete && !isCurrent && !isFailed && !isRiskFlagged && !(isRiskReview && i < activeStep) && "bg-mist/50 text-ink-light",
                isFailed && i <= 2 && "bg-red-50 text-red-400"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-4 h-px",
                  isComplete || (isRiskReview && i < activeStep) ? "bg-emerald-300" : "bg-mist"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
