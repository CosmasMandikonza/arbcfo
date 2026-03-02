"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { cn, computeInvoiceHash, computeMemoHash, parseUSDC } from "@/lib/utils";
import { CATEGORIES } from "@arbcfo/shared";
import { AgentAnalysisPanel } from "@/components/shared/agent-analysis-panel";
import {
  X,
  Sparkles,
  Loader2,
  ArrowLeft,
  Brain,
  Send,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Zap,
} from "lucide-react";

type FlowState = "input" | "analyzing" | "review";

interface CreateIntentFormProps {
  onClose: () => void;
  onCreated: () => void;
}

// ─── Demo Scenarios ───
const DEMO_INVOICES = [
  {
    label: "Normal Payment",
    vendorLabel: "DigitalOcean",
    amountLabel: "$920.00 · Droplet hosting — Feb 2025",
    icon: ShieldCheck,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    text: `INVOICE #INV-2025-048
From: DigitalOcean
Vendor Wallet: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd

Droplet hosting — February 2025

Subtotal: $920.00
Tax: $0.00
Total Due: $920.00 USDC
Due Date: March 1, 2025

Payment terms: Net 30`,
  },
  {
    label: "Suspicious Spike",
    vendorLabel: "AWS Billing",
    amountLabel: "$45,000.00 · GPU cluster provisioning",
    icon: ShieldX,
    color: "text-red-600 bg-red-50 border-red-200 hover:bg-red-100",
    text: `INVOICE #INV-2025-URGENT
From: AWS Billing
Vendor Wallet: 0x9876543210fedcba9876543210fedcba98765432

EMERGENCY: GPU Cluster provisioning — immediate payment required

Instance type: p5.48xlarge x 20 nodes
Duration: 30 days pre-paid

Subtotal: $42,000.00
Priority surcharge: $3,000.00
Total Due: $45,000.00 USDC
Due Date: IMMEDIATE

Note: This invoice is 15x higher than average monthly AWS spend of $3,000`,
  },
  {
    label: "Unknown Vendor",
    vendorLabel: "NovaTech Consulting Ltd",
    amountLabel: "$18,500.00 · Infrastructure advisory",
    icon: ShieldAlert,
    color: "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100",
    text: `INVOICE #EXT-7721
From: NovaTech Consulting Ltd
Vendor Wallet: 0x7777777777777777777777777777777777777777

Strategic consulting engagement — Q1 2025
Blockchain infrastructure advisory services

Total Due: $18,500.00 USDC
Due Date: March 15, 2025

First-time vendor. No previous payment history.`,
  },
];

export function CreateIntentForm({ onClose, onCreated }: CreateIntentFormProps) {
  const { address } = useAccount();
  const [flowState, setFlowState] = useState<FlowState>("input");
  const [loading, setLoading] = useState(false);

  // Input state
  const [pastedText, setPastedText] = useState("");

  // Parsed/editable fields (populated by agent)
  const [vendorName, setVendorName] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(0);
  const [memo, setMemo] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Agent analysis result
  const [agentRecommendation, setAgentRecommendation] = useState<
    "AUTO_APPROVE" | "REVIEW" | "BLOCK" | null
  >(null);

  const handleAnalyze = () => {
    if (!pastedText.trim() || pastedText.trim().length < 10) {
      toast.error("Please paste invoice text (at least 10 characters)");
      return;
    }
    setFlowState("analyzing");
  };

  const handleSelectDemo = (text: string) => {
    setPastedText(text);
    // Auto-start analysis immediately
    setTimeout(() => setFlowState("analyzing"), 100);
  };

  const handleAgentComplete = (analysis: {
    parsed: {
      vendor?: string;
      vendorAddress?: string;
      amount?: number;
      invoiceNumber?: string;
      dueDate?: string;
      memo?: string;
      suggestedCategory?: string;
    };
    recommendation: "AUTO_APPROVE" | "REVIEW" | "BLOCK";
  }) => {
    const p = analysis.parsed;
    if (p.vendor) setVendorName(p.vendor);
    if (p.vendorAddress) setVendorAddress(p.vendorAddress);
    if (p.amount) setAmount(String(p.amount));
    if (p.invoiceNumber) setInvoiceNumber(p.invoiceNumber);
    if (p.dueDate) setDueDate(p.dueDate);
    if (p.memo) setMemo(p.memo);

    if (p.suggestedCategory) {
      const match = CATEGORIES.find(
        (c) =>
          c.name.toLowerCase() ===
          (p.suggestedCategory || "").toLowerCase()
      );
      if (match) setCategoryId(match.id);
    }

    setAgentRecommendation(analysis.recommendation);
    setFlowState("review");
  };

  const handleSubmit = async () => {
    if (!vendorAddress || !amount || !vendorName) {
      toast.error("Please fill in vendor name, address, and amount");
      return;
    }

    setLoading(true);
    try {
      const amountBn = parseUSDC(parseFloat(amount));
      const invoiceText =
        pastedText || `${vendorName}-${invoiceNumber}-${amount}`;
      const invoiceHash = computeInvoiceHash(invoiceText);
      const memoHash = computeMemoHash(memo);
      const dueDateTs = dueDate
        ? Math.floor(new Date(dueDate).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 7 * 86400;

      const res = await fetch("/api/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: vendorAddress,
          vendorName,
          token:
            process.env.NEXT_PUBLIC_USDC_ADDRESS ||
            "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
          amount: amountBn.toString(),
          amountFormatted: parseFloat(amount),
          categoryId,
          invoiceHash,
          memoHash,
          memo,
          dueDate: dueDateTs,
          invoiceNumber,
          creator: address || "0x",
        }),
      });

      if (!res.ok) throw new Error("Failed to create intent");

      toast.success("Payment intent created!", {
        description:
          agentRecommendation === "AUTO_APPROVE"
            ? "Agent approved — ready for execution"
            : agentRecommendation === "BLOCK"
              ? "Blocked by risk engine — routed to manual review"
              : "Routed to multisig review",
      });
      onCreated();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create intent"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 max-w-2xl mx-auto animate-scale-in">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {flowState !== "input" && (
            <button
              onClick={() => {
                setFlowState("input");
                setAgentRecommendation(null);
              }}
              className="btn-ghost p-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              {flowState === "input"
                ? "New Payment Intent"
                : flowState === "analyzing"
                  ? "Agent Analysis"
                  : "Review & Submit"}
            </h2>
            <p className="text-xs text-ink-light mt-0.5">
              {flowState === "input"
                ? "Select a vendor or paste an invoice"
                : flowState === "analyzing"
                  ? "Running multi-step risk assessment"
                  : "Verify extracted fields and submit"}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="btn-ghost p-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Step 1: Input ── */}
      {flowState === "input" && (
        <div className="space-y-4">
          {/* Quick Templates */}
          <div>
            <p className="text-xs font-medium text-ink-muted mb-2 uppercase tracking-wider">
              Recent Vendors
            </p>
            <div className="grid gap-2">
              {DEMO_INVOICES.map((demo) => {
                const Icon = demo.icon;
                return (
                  <button
                    key={demo.label}
                    onClick={() => handleSelectDemo(demo.text)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      demo.color
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{demo.vendorLabel}</p>
                      <p className="text-xs opacity-75">{demo.amountLabel}</p>
                    </div>
                    <Zap className="w-4 h-4 opacity-50" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-mist" />
            <span className="text-[10px] text-ink-light uppercase tracking-widest">
              or paste invoice text
            </span>
            <div className="flex-1 h-px bg-mist" />
          </div>

          {/* Custom Text Input */}
          <div>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste any invoice text here..."
              className="input-field h-28 resize-none font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!pastedText.trim() || pastedText.trim().length < 10}
              className="btn-primary flex-1"
            >
              <Brain className="w-4 h-4" />
              Run Agent Analysis
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Analyzing ── */}
      {flowState === "analyzing" && (
        <AgentAnalysisPanel
          invoiceText={pastedText}
          vendorAddress={vendorAddress || undefined}
          onComplete={handleAgentComplete}
          onCancel={() => setFlowState("input")}
        />
      )}

      {/* ── Step 3: Review & Edit ── */}
      {flowState === "review" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-muted mb-1 block">
                Vendor Name *
              </label>
              <input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="Acme Corp"
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted mb-1 block">
                Vendor Address *
              </label>
              <input
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
                placeholder="0x…"
                className="input-field font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-muted mb-1 block">
                Amount (USDC) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000.00"
                className="input-field text-sm"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted mb-1 block">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="input-field text-sm"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted mb-1 block">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-muted mb-1 block">
                Invoice #
              </label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-2025-001"
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted mb-1 block">
                Memo
              </label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Monthly cloud hosting"
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Recommendation */}
          {agentRecommendation && (
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold border",
                agentRecommendation === "AUTO_APPROVE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : agentRecommendation === "REVIEW"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-red-50 text-red-700 border-red-200"
              )}
            >
              {agentRecommendation === "AUTO_APPROVE" ? (
                <ShieldCheck className="w-5 h-5" />
              ) : agentRecommendation === "REVIEW" ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <ShieldX className="w-5 h-5" />
              )}
              {agentRecommendation === "AUTO_APPROVE"
                ? "Agent: Auto-approve — all risk checks passed"
                : agentRecommendation === "REVIEW"
                  ? "Agent: Route to multisig — elevated risk signals"
                  : "Agent: BLOCK — critical risk, circuit breaker triggered"}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-mist">
            <button
              onClick={() => {
                setFlowState("input");
                setAgentRecommendation(null);
              }}
              className="btn-secondary flex-1"
            >
              <ArrowLeft className="w-4 h-4" />
              New Analysis
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !vendorAddress || !amount}
              className={cn(
                "flex-1",
                agentRecommendation === "BLOCK"
                  ? "btn-danger"
                  : "btn-primary"
              )}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {agentRecommendation === "BLOCK"
                ? "Submit for Review (Blocked)"
                : "Create Intent"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
