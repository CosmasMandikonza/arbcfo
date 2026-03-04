import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseInvoice } from "@/lib/invoice-parser";
import {
  evaluateRisk,
  simulateVendorStats,
  emptyStats,
  type RiskBreakdown,
  type VendorStats,
} from "@/lib/risk-engine";

export interface AgentStep {
  id: string;
  label: string;
  status: "done" | "warn" | "error";
  detail: string;
  data?: Record<string, unknown>;
  durationMs: number;
}

export interface AgentAnalysis {
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

type ParsedInvoice = {
  vendor?: string;
  vendorAddress?: string;
  amount?: number;
  invoiceNumber?: string;
  dueDate?: string;
  memo?: string;
  confidence: number;
  suggestedCategory?: string;
};

type VendorIntentRow = {
  id: number;
  status: number;
  amountFormatted: number;
  createdAt: number;
};

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const body = (await req.json()) as {
      text?: string;
      vendorAddress?: string;
    };

    const { text, vendorAddress } = body;

    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Invoice text must be at least 10 characters" },
        { status: 400 }
      );
    }

    const steps: AgentStep[] = [];
    let t0 = Date.now();

    const parsed = (await parseInvoice(text)) as ParsedInvoice;

    steps.push({
      id: "parse",
      label: "Invoice Extraction",
      status: parsed.confidence > 0.5 ? "done" : "warn",
      detail:
        parsed.confidence > 0.7
          ? `Extracted ${countFields(parsed as Record<string, unknown>)} fields with ${pct(parsed.confidence)} confidence`
          : parsed.confidence > 0.5
            ? `Partial extraction - ${pct(parsed.confidence)} confidence, some fields uncertain`
            : `Low confidence extraction (${pct(parsed.confidence)}) - manual review recommended`,
      data: { parsed: parsed as Record<string, unknown> },
      durationMs: Date.now() - t0,
    });

    t0 = Date.now();
    let duplicateFound = false;
    let duplicateIntentId: number | undefined;

    try {
      if (parsed.invoiceNumber) {
        const dup = await prisma.intent.findFirst({
          where: { invoiceNumber: parsed.invoiceNumber },
        });

        if (dup) {
          duplicateFound = true;
          duplicateIntentId = dup.id;
        }
      }

      if (!duplicateFound && parsed.vendor && parsed.amount) {
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;

        const allIntents = await prisma.intent.findMany({
          where: {
            vendorName: { contains: parsed.vendor },
            createdAt: { gte: thirtyDaysAgo },
          },
          select: {
            id: true,
            amountFormatted: true,
          },
        });

        for (const intent of allIntents) {
          const existingAmount = intent.amountFormatted;
          if (existingAmount > 0) {
            const diff = Math.abs(parsed.amount - existingAmount) / existingAmount;
            if (diff < 0.01) {
              duplicateFound = true;
              duplicateIntentId = intent.id;
              break;
            }
          }
        }
      }
    } catch {
      // Skip duplicate detection if DB lookup fails.
    }

    steps.push({
      id: "dedup",
      label: "Duplicate Detection",
      status: duplicateFound ? "warn" : "done",
      detail: duplicateFound
        ? `Potential duplicate found - matches Intent #${duplicateIntentId} (same vendor, similar amount)`
        : "No duplicate invoices detected in the last 30 days",
      data: { duplicateFound, duplicateIntentId },
      durationMs: Date.now() - t0,
    });

    t0 = Date.now();

    const vendorHistory: AgentAnalysis["vendorHistory"] = {
      totalIntents: 0,
      totalPaid: 0,
      avgAmount: 0,
      lastPaymentDate: null,
      isNewVendor: true,
    };

    try {
      const vendorName = parsed.vendor || "";
      const addr = vendorAddress || parsed.vendorAddress || "";

      const orConditions: Array<Record<string, unknown>> = [];
      if (vendorName) {
        orConditions.push({ vendorName: { contains: vendorName } });
      }
      if (addr) {
        orConditions.push({ vendor: addr });
      }

      const vendorIntents: VendorIntentRow[] =
        orConditions.length > 0
          ? await prisma.intent.findMany({
              where: { OR: orConditions },
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                status: true,
                amountFormatted: true,
                createdAt: true,
              },
            })
          : [];

      if (vendorIntents.length > 0) {
        const totalPaid = vendorIntents
          .filter((intent: VendorIntentRow) => intent.status === 3)
          .reduce(
            (sum: number, intent: VendorIntentRow) =>
              sum + intent.amountFormatted,
            0
          );

        const totalAmount = vendorIntents.reduce(
          (sum: number, intent: VendorIntentRow) =>
            sum + intent.amountFormatted,
          0
        );

        vendorHistory.totalIntents = vendorIntents.length;
        vendorHistory.totalPaid = totalPaid;
        vendorHistory.avgAmount = totalAmount / vendorIntents.length;
        vendorHistory.lastPaymentDate = new Date(
          vendorIntents[0].createdAt * 1000
        ).toISOString();
        vendorHistory.isNewVendor = false;
      }
    } catch {
      // Keep default vendor history if DB lookup fails.
    }

    steps.push({
      id: "vendor",
      label: "Vendor Analysis",
      status: vendorHistory.isNewVendor ? "warn" : "done",
      detail: vendorHistory.isNewVendor
        ? "New vendor - no payment history found. Enhanced scrutiny applied."
        : `${vendorHistory.totalIntents} previous intents - $${fmtNum(vendorHistory.totalPaid)} total paid - avg $${fmtNum(vendorHistory.avgAmount)}`,
      data: { vendorHistory },
      durationMs: Date.now() - t0,
    });

    t0 = Date.now();
    let riskBreakdown: RiskBreakdown | null = null;

    if (parsed.amount && parsed.amount > 0) {
      const now = Math.floor(Date.now() / 1000);

      let stats: VendorStats;
      if (vendorHistory.isNewVendor) {
        stats = emptyStats();
      } else {
        stats = simulateVendorStats(
          vendorAddress || parsed.vendorAddress || parsed.vendor || "unknown",
          vendorHistory.avgAmount,
          vendorHistory.totalIntents
        );
      }

      riskBreakdown = evaluateRisk(stats, parsed.amount, now);
    }

    steps.push({
      id: "risk",
      label: "4D Risk Scoring",
      status: riskBreakdown
        ? riskBreakdown.circuitBreaker
          ? "error"
          : riskBreakdown.isSafe
            ? "done"
            : "warn"
        : "done",
      detail: riskBreakdown
        ? `Composite score: ${riskBreakdown.compositeScore}/100 - ${riskBreakdown.circuitBreaker ? "CIRCUIT BREAKER" : riskBreakdown.isSafe ? "Within safe threshold" : "Exceeds risk threshold (>70)"}`
        : "Unable to score - missing amount data",
      data: riskBreakdown
        ? { riskBreakdown: riskBreakdown as unknown as Record<string, unknown> }
        : undefined,
      durationMs: Date.now() - t0,
    });

    t0 = Date.now();

    const narrative = generateNarrative(
      parsed,
      {
        isNewVendor: vendorHistory.isNewVendor,
        avgAmount: vendorHistory.avgAmount,
        totalIntents: vendorHistory.totalIntents,
      },
      riskBreakdown,
      duplicateFound
    );

    const recommendation = determineRecommendation(
      riskBreakdown,
      duplicateFound,
      { isNewVendor: vendorHistory.isNewVendor },
      parsed.confidence
    );

    steps.push({
      id: "narrative",
      label: "Agent Recommendation",
      status:
        recommendation === "BLOCK"
          ? "error"
          : recommendation === "REVIEW"
            ? "warn"
            : "done",
      detail: narrative.split("\n")[0],
      durationMs: Date.now() - t0,
    });

    const analysis: AgentAnalysis = {
      steps,
      parsed: {
        vendor: parsed.vendor,
        vendorAddress: vendorAddress || parsed.vendorAddress || undefined,
        amount: parsed.amount,
        invoiceNumber: parsed.invoiceNumber,
        dueDate: parsed.dueDate,
        memo: parsed.memo,
        confidence: parsed.confidence,
        suggestedCategory: parsed.suggestedCategory,
      },
      riskBreakdown,
      duplicateFound,
      duplicateIntentId,
      vendorHistory,
      narrative,
      recommendation,
    };

    return NextResponse.json({
      analysis,
      totalDurationMs: Date.now() - start,
    });
  } catch (err) {
    console.error("Agent analyze error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

function countFields(parsed: Record<string, unknown>): number {
  return Object.values(parsed).filter(
    (v) => v !== undefined && v !== null && v !== "" && v !== 0
  ).length;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function generateNarrative(
  parsed: { vendor?: string; amount?: number; confidence: number },
  vendorHistory: { isNewVendor: boolean; avgAmount: number; totalIntents: number },
  risk: RiskBreakdown | null,
  duplicateFound: boolean
): string {
  const lines: string[] = [];

  if (risk?.circuitBreaker) {
    lines.push(
      `BLOCKED: This ${parsed.vendor || "vendor"} payment of $${fmtNum(parsed.amount || 0)} triggered the circuit breaker.`
    );
  } else if (risk && !risk.isSafe) {
    lines.push("FLAGGED: This payment requires multisig review before execution.");
  } else {
    lines.push(
      `This $${fmtNum(parsed.amount || 0)} payment to ${parsed.vendor || "unknown vendor"} has been analyzed across 4 risk dimensions.`
    );
  }

  if (duplicateFound) {
    lines.push(
      "A potential duplicate invoice was detected - verify this is not a double-payment."
    );
  }

  if (vendorHistory.isNewVendor) {
    lines.push(
      "This is a new vendor with no payment history. New vendor risk (30 points) has been applied."
    );
  } else if (vendorHistory.avgAmount > 0 && parsed.amount) {
    const amountDiff =
      ((parsed.amount - vendorHistory.avgAmount) / vendorHistory.avgAmount) * 100;

    if (Math.abs(amountDiff) > 50) {
      lines.push(
        `This amount is ${amountDiff > 0 ? "+" : ""}${amountDiff.toFixed(0)}% compared to the ${vendorHistory.totalIntents}-payment average of $${fmtNum(vendorHistory.avgAmount)}. This deviation contributes to the risk score.`
      );
    } else {
      lines.push(
        `Amount is consistent with the vendor's ${vendorHistory.totalIntents}-payment history (avg $${fmtNum(vendorHistory.avgAmount)}).`
      );
    }
  }

  if (parsed.confidence < 0.6) {
    lines.push(
      `Extraction confidence is low (${pct(parsed.confidence)}) - verify all fields manually before approval.`
    );
  }

  return lines.join("\n");
}

function determineRecommendation(
  risk: RiskBreakdown | null,
  duplicateFound: boolean,
  vendorHistory: { isNewVendor: boolean },
  confidence: number
): "AUTO_APPROVE" | "REVIEW" | "BLOCK" {
  if (risk?.circuitBreaker) return "BLOCK";
  if (risk && !risk.isSafe) return "BLOCK";
  if (duplicateFound) return "REVIEW";
  if (vendorHistory.isNewVendor) return "REVIEW";
  if (confidence < 0.5) return "REVIEW";
  if (risk && risk.compositeScore > 40) return "REVIEW";
  return "AUTO_APPROVE";
}
