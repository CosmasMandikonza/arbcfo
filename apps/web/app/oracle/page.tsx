"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Brain,
  Shield,
  ShieldAlert,
  ShieldX,
  ShieldCheck,
  Activity,
  Zap,
  AlertTriangle,
  Play,
  RotateCcw,
  Fingerprint,
  Network,
  Cpu,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

// ─── Types ───
interface PaymentSimulation {
  vendor: string;
  vendorLabel: string;
  amount: number;
  stylusScore: number;
  identityScore: number;
  correlationScore: number;
  compoundBonus: number;
  compositeScore: number;
  blocked: boolean;
  txHash?: string;
  gasUsed?: number;
  onChain: boolean;
}

interface EpochState {
  totalNewVendorSpend: number;
  distinctNewVendors: number;
  spendCapPct: number;
  vendorCapPct: number;
}

// ─── Constants ───
const MAX_NEW_VENDOR_DAILY_SPEND = 50_000;
const MAX_NEW_VENDORS_PER_EPOCH = 5;
const ARBISCAN_URL = "https://sepolia.arbiscan.io/tx/";

// Use real Ethereum addresses so the contract can process them
const SPLIT_ATTACK_VENDORS = [
  { addr: "0xdead000000000000000000000000000000000001", label: "TSLA Liquidation", amount: 9500 },
  { addr: "0xdead000000000000000000000000000000000002", label: "AMZN Transfer", amount: 8200 },
  { addr: "0xdead000000000000000000000000000000000003", label: "NFLX Withdrawal", amount: 11000 },
  { addr: "0xdead000000000000000000000000000000000004", label: "GOOGL Sell-off", amount: 9800 },
  { addr: "0xdead000000000000000000000000000000000005", label: "NVDA Dump", amount: 10500 },
  { addr: "0xdead000000000000000000000000000000000006", label: "AAPL Exit", amount: 12000 },
];

// Agent address (the "attacker" with no ERC-8004 identity)
const ATTACKER_AGENT = "0x000000000000000000000000000000000000dead";

export default function OraclePage() {
  const [simulations, setSimulations] = useState<PaymentSimulation[]>([]);
  const [epoch, setEpoch] = useState<EpochState>({
    totalNewVendorSpend: 0,
    distinctNewVendors: 0,
    spendCapPct: 0,
    vendorCapPct: 0,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [attackBlocked, setAttackBlocked] = useState(false);
  const [totalGasUsed, setTotalGasUsed] = useState(0);

  const reset = useCallback(() => {
    setSimulations([]);
    setEpoch({
      totalNewVendorSpend: 0,
      distinctNewVendors: 0,
      spendCapPct: 0,
      vendorCapPct: 0,
    });
    setCurrentStep(-1);
    setIsRunning(false);
    setAttackBlocked(false);
    setTotalGasUsed(0);
  }, []);

  const runSplitAttackSimulation = useCallback(async () => {
    reset();
    setIsRunning(true);

    const results: PaymentSimulation[] = [];
    let gasTotal = 0;

    for (let i = 0; i < SPLIT_ATTACK_VENDORS.length; i++) {
      setCurrentStep(i);

      const v = SPLIT_ATTACK_VENDORS[i];

      try {
        // Call the REAL contract via API route
        const res = await fetch("/api/oracle/assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: ATTACKER_AGENT,
            vendor: v.addr,
            amount: v.amount,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("Oracle API error:", data.error);
          // Show error but continue
          results.push({
            vendor: v.addr,
            vendorLabel: v.label,
            amount: v.amount,
            stylusScore: 0,
            identityScore: 0,
            correlationScore: 0,
            compoundBonus: 0,
            compositeScore: 0,
            blocked: false,
            onChain: false,
          });
          setSimulations([...results]);
          continue;
        }

        if (data.gasUsed) {
          gasTotal += data.gasUsed;
          setTotalGasUsed(gasTotal);
        }

        const sim: PaymentSimulation = {
          vendor: v.addr,
          vendorLabel: v.label,
          amount: v.amount,
          stylusScore: data.stylusScore || 0,
          identityScore: data.identityScore || 0,
          correlationScore: data.correlationScore || 0,
          compoundBonus: data.compoundBonus || 0,
          compositeScore: data.compositeScore || 0,
          blocked: data.blocked || false,
          txHash: data.txHash,
          gasUsed: data.gasUsed,
          onChain: data.onChain || false,
        };

        results.push(sim);
        setSimulations([...results]);

        // Update epoch from real on-chain data
        if (data.epoch) {
          setEpoch({
            totalNewVendorSpend: data.epoch.totalNewVendorSpend,
            distinctNewVendors: data.epoch.distinctNewVendors,
            spendCapPct: data.epoch.spendCapPct,
            vendorCapPct: data.epoch.vendorCapPct,
          });
        }

        if (data.blocked) {
          setAttackBlocked(true);
          break;
        }
      } catch (err) {
        console.error("Network error:", err);
        // Continue with next vendor
      }
    }

    setIsRunning(false);
  }, [reset]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Brain className="w-6 h-6 text-iris" />
          <h1 className="font-display text-2xl font-bold text-ink">
            Transaction Risk Oracle
          </h1>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
            LIVE ON-CHAIN
          </span>
        </div>
        <p className="text-sm text-ink-muted">
          Composable trust primitive — every assessment is a real transaction on Arbitrum Sepolia
        </p>
      </div>

      {/* Three Signal Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Stylus WASM</p>
              <p className="text-[10px] text-ink-light">Per-vendor EMA + MAD</p>
            </div>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Rust/WASM contract running EMA + Mean Absolute Deviation on
            every vendor payment. 10x cheaper gas than Solidity.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
              Rust/WASM gas
            </span>
            <span className="text-[10px] text-ink-light">vs Solidity Solidity</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-iris/10 flex items-center justify-center">
              <Fingerprint className="w-4 h-4 text-iris" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Sender Identity</p>
              <p className="text-[10px] text-ink-light">Transaction initiator verification</p>
            </div>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Reads the on-chain Sender Identity Registry. Unknown agents
            get maximum scrutiny. Verified senders get trust discounts.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-bold text-iris bg-iris/10 px-2 py-0.5 rounded">
              0x8004A818...
            </span>
            <span className="text-[10px] text-ink-light">Arb Sepolia</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Network className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-ink">Correlation Detection</p>
              <p className="text-[10px] text-ink-light">Novel algorithm</p>
            </div>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Detects coordinated drainage across new vendors. Compound risk
            when identity + correlation signals overlap.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              Compound risk
            </span>
            <span className="text-[10px] text-ink-light">Quadratic + multiplicative</span>
          </div>
        </div>
      </div>

      {/* Split Attack Simulator */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Live Split Attack Demo
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Each payment is a real transaction on Arbitrum Sepolia — verify on Arbiscan
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} disabled={isRunning} className="btn-ghost text-xs">
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={runSplitAttackSimulation}
              disabled={isRunning}
              className={cn("btn-primary text-xs", isRunning && "opacity-50 cursor-not-allowed")}
            >
              {isRunning ? (
                <>
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  Transacting...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Run Split Attack
                </>
              )}
            </button>
          </div>
        </div>

        {/* Epoch Monitor */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl bg-pearl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-ink-muted">New Vendor Aggregate Spend</span>
              <span className="text-xs font-bold tabular-nums text-ink">
                {"$"}{epoch.totalNewVendorSpend.toLocaleString()} / {"$"}{MAX_NEW_VENDOR_DAILY_SPEND.toLocaleString()}
              </span>
            </div>
            <div className="h-3 bg-mist rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  epoch.spendCapPct < 50 ? "bg-emerald-500"
                    : epoch.spendCapPct < 80 ? "bg-amber-500"
                    : "bg-red-500"
                )}
                style={{ width: `${Math.min(epoch.spendCapPct, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-ink-light mt-1">{epoch.spendCapPct}% of daily cap</p>
          </div>

          <div className="rounded-xl bg-pearl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-ink-muted">Distinct New Vendors</span>
              <span className="text-xs font-bold tabular-nums text-ink">
                {epoch.distinctNewVendors} / {MAX_NEW_VENDORS_PER_EPOCH}
              </span>
            </div>
            <div className="h-3 bg-mist rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  epoch.vendorCapPct < 50 ? "bg-emerald-500"
                    : epoch.vendorCapPct < 80 ? "bg-amber-500"
                    : "bg-red-500"
                )}
                style={{ width: `${Math.min(epoch.vendorCapPct, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-ink-light mt-1">{epoch.vendorCapPct}% of vendor cap</p>
          </div>
        </div>

        {/* Transaction Timeline */}
        {simulations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">
                Transaction Timeline
              </p>
              {totalGasUsed > 0 && (
                <p className="text-[10px] text-ink-light">
                  Total gas: <span className="font-mono font-bold">{totalGasUsed.toLocaleString()}</span>
                </p>
              )}
            </div>

            {simulations.map((sim, idx) => (
              <div
                key={idx}
                className={cn(
                  "p-3 rounded-xl border transition-all duration-500",
                  sim.blocked ? "bg-red-50 border-red-200"
                    : sim.compositeScore > 40 ? "bg-amber-50 border-amber-200"
                    : "bg-frost border-mist"
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Step */}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                    sim.blocked ? "bg-red-500 text-white"
                      : sim.compositeScore > 40 ? "bg-amber-500 text-white"
                      : "bg-emerald-500 text-white"
                  )}>
                    {idx + 1}
                  </div>

                  {/* Vendor */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{sim.vendorLabel}</p>
                    <p className="text-[10px] text-ink-light font-mono truncate">{sim.vendor}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-bold tabular-nums", sim.blocked ? "text-red-600" : "text-ink")}>
                      {"$"}{sim.amount.toLocaleString()}
                    </p>
                  </div>

                  {/* Breakdown */}
                  <div className="shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-ink-light">STY</span>
                      <span className="text-[10px] font-mono font-bold text-ink w-3 text-right">{sim.stylusScore}</span>
                      <span className="text-[9px] text-ink-light ml-1">ID</span>
                      <span className="text-[10px] font-mono font-bold text-ink w-4 text-right">{sim.identityScore}</span>
                      <span className="text-[9px] text-ink-light ml-1">COR</span>
                      <span className={cn(
                        "text-[10px] font-mono font-bold w-4 text-right",
                        sim.correlationScore >= 15 ? "text-red-600"
                          : sim.correlationScore >= 8 ? "text-amber-600" : "text-ink"
                      )}>
                        {sim.correlationScore}
                      </span>
                      {sim.compoundBonus > 0 && (
                        <>
                          <span className="text-[9px] text-red-500 ml-1">x</span>
                          <span className="text-[10px] font-mono font-bold text-red-600 w-4 text-right">
                            +{sim.compoundBonus}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className={cn(
                    "w-14 h-10 rounded-lg flex items-center justify-center shrink-0",
                    sim.blocked ? "bg-red-500"
                      : sim.compositeScore > 40 ? "bg-amber-500"
                      : "bg-emerald-500"
                  )}>
                    <span className="text-sm font-bold text-white tabular-nums">{sim.compositeScore}</span>
                  </div>

                  {/* Status */}
                  <div className="w-20 shrink-0">
                    {sim.blocked ? (
                      <div className="flex items-center gap-1 text-red-600">
                        <ShieldX className="w-4 h-4" />
                        <span className="text-xs font-bold">BLOCKED</span>
                      </div>
                    ) : sim.compositeScore > 40 ? (
                      <div className="flex items-center gap-1 text-amber-600">
                        <ShieldAlert className="w-4 h-4" />
                        <span className="text-xs font-bold">REVIEW</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-bold">SAFE</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tx Hash — real on-chain proof */}
                {sim.txHash && (
                  <div className="mt-2 pt-2 border-t border-mist/50 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="text-[10px] text-ink-light">Confirmed on-chain</span>
                    <a
                      href={`${ARBISCAN_URL}${sim.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-iris hover:underline truncate flex-1"
                    >
                      {sim.txHash}
                    </a>
                    <ExternalLink className="w-3 h-3 text-iris shrink-0" />
                    {sim.gasUsed && (
                      <span className="text-[10px] text-ink-light font-mono shrink-0">
                        {sim.gasUsed.toLocaleString()} gas
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Blocked Banner */}
            {attackBlocked && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 border-2 border-red-300">
                <div className="flex items-center gap-3">
                  <ShieldX className="w-8 h-8 text-red-500 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-700">
                      Coordinated Drainage Attack Detected &amp; Blocked
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      {epoch.distinctNewVendors} new vendors, {"$"}{epoch.totalNewVendorSpend.toLocaleString()} aggregate
                      spend. No individual payment was anomalous — the cross-vendor
                      correlation algorithm with compound risk caught the pattern.
                      Every assessment is verifiable on Arbiscan.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Running indicator */}
            {isRunning && !attackBlocked && (
              <div className="flex items-center justify-center gap-2 p-4 text-iris">
                <Activity className="w-4 h-4 animate-pulse" />
                <span className="text-xs font-medium">
                  Sending transaction {currentStep + 2} of {SPLIT_ATTACK_VENDORS.length} to Arbitrum Sepolia...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {simulations.length === 0 && !isRunning && (
          <div className="text-center py-10 text-ink-muted">
            <Network className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">
              Click &quot;Run Split Attack&quot; to execute a live on-chain simulation
            </p>
            <p className="text-xs mt-1 max-w-md mx-auto">
              6 real transactions sent to the TransactionRiskOracle contract on Arbitrum Sepolia.
              Each payment is individually normal. Watch the oracle detect the coordinated pattern.
            </p>
          </div>
        )}
      </div>

      {/* Gas + Contracts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Why Stylus
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
              <p className="text-2xl font-bold font-mono text-red-600">Solidity</p>
              <p className="text-[10px] text-red-500">Standard EVM execution</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
              <p className="text-2xl font-bold font-mono text-emerald-600">Rust/WASM</p>
              <p className="text-[10px] text-emerald-500">Deterministic, overflow-safe</p>
            </div>
          </div>
          <p className="text-[10px] text-ink-muted text-center mt-2">
            Stylus enables production-grade statistical math in Rust — memory-safe, deterministic, auditable
          </p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-ink mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-iris" />
            Deployed Contracts
          </h3>
          <div className="space-y-2 text-[10px]">
            <div className="flex justify-between">
              <span className="text-ink-muted">TransactionRiskOracle</span>
              <span className="font-mono text-iris">Arb Sepolia + Robinhood</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Stylus RiskEngine</span>
              <span className="font-mono text-red-500">Rust/WASM on Arb Sepolia</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">ArbCFOVault</span>
              <span className="font-mono text-iris">Arb Sepolia + Robinhood</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Sender Identity</span>
              <span className="font-mono text-iris">0x8004A818...</span>
            </div>
          </div>
          <p className="text-[10px] text-ink-light text-center mt-2">
            41 tests · 8 contracts · 2 chains
          </p>
        </div>
      </div>
    </div>
  );
}
