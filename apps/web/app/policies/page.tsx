"use client";

import { useState } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { toast } from "sonner";
import { CONTRACTS } from "@/lib/wagmi";
import { POLICY_ENGINE_ABI, CATEGORIES } from "@arbcfo/shared";
import { cn, formatUSDC } from "@/lib/utils";
import {
  AlertTriangle,
  DollarSign,
  Users,
  Pause,
  Play,
  Plus,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

export default function PoliciesPage() {
  const [newVendor, setNewVendor] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [newBudget, setNewBudget] = useState("");
  const [newMax, setNewMax] = useState("");

  const { data: policyConfig } = useReadContract({
    address: CONTRACTS.policyEngine,
    abi: POLICY_ENGINE_ABI,
    functionName: "config",
  });

  const { writeContractAsync, isPending } = useWriteContract();

  const config = policyConfig as [boolean, bigint, boolean] | undefined;
  const vendorAllowlistEnabled = config?.[0] ?? false;
  const maxPerInvoice = config?.[1] ?? BigInt(0);
  const isPaused = config?.[2] ?? false;

  const handleToggleVendorAllowlist = async () => {
    try {
      await writeContractAsync({
        address: CONTRACTS.policyEngine,
        abi: POLICY_ENGINE_ABI,
        functionName: "setVendorAllowlistEnabled",
        args: [!vendorAllowlistEnabled],
      });
      toast.success(`Vendor allowlist ${!vendorAllowlistEnabled ? "enabled" : "disabled"}`);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "shortMessage" in err
          ? String((err as { shortMessage?: string }).shortMessage)
          : "Failed to update";
      toast.error(message);
    }
  };

  const handleAddVendor = async () => {
    if (!newVendor) return;

    try {
      await writeContractAsync({
        address: CONTRACTS.policyEngine,
        abi: POLICY_ENGINE_ABI,
        functionName: "setVendorAllowed",
        args: [newVendor as `0x${string}`, true],
      });
      toast.success("Vendor added to allowlist");
      setNewVendor("");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "shortMessage" in err
          ? String((err as { shortMessage?: string }).shortMessage)
          : "Failed to add vendor";
      toast.error(message);
    }
  };

  const handleSetBudget = async () => {
    if (!newBudget) return;

    try {
      await writeContractAsync({
        address: CONTRACTS.policyEngine,
        abi: POLICY_ENGINE_ABI,
        functionName: "setCategoryBudget",
        args: [BigInt(selectedCategory), parseUnits(newBudget, 6)],
      });
      toast.success(`Budget set for ${CATEGORIES[selectedCategory]?.name || "category"}`);
      setNewBudget("");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "shortMessage" in err
          ? String((err as { shortMessage?: string }).shortMessage)
          : "Failed to set budget";
      toast.error(message);
    }
  };

  const handleSetMax = async () => {
    if (!newMax) return;

    try {
      await writeContractAsync({
        address: CONTRACTS.policyEngine,
        abi: POLICY_ENGINE_ABI,
        functionName: "setMaxPerInvoice",
        args: [parseUnits(newMax, 6)],
      });
      toast.success("Max per invoice updated");
      setNewMax("");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "shortMessage" in err
          ? String((err as { shortMessage?: string }).shortMessage)
          : "Failed to update max";
      toast.error(message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Policy Engine</h1>
        <p className="text-sm text-ink-muted mt-1">
          Configure onchain guardrails enforced at execution time. All changes require
          admin role.
        </p>
      </div>

      <div className="space-y-6">
        <div className={cn("card p-5", isPaused && "border-coral/30 bg-coral/5")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isPaused ? (
                <Pause className="w-5 h-5 text-coral" />
              ) : (
                <Play className="w-5 h-5 text-emerald-500" />
              )}
              <div>
                <h3 className="font-medium text-ink">Emergency Pause</h3>
                <p className="text-xs text-ink-muted">
                  {isPaused ? "All operations halted" : "System operational"}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "status-badge",
                isPaused ? "bg-coral/10 text-coral" : "bg-emerald-50 text-emerald-700"
              )}
            >
              {isPaused ? "PAUSED" : "ACTIVE"}
            </span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-5 h-5 text-iris" />
            <div>
              <h3 className="font-medium text-ink">Max Per Invoice</h3>
              <p className="text-xs text-ink-muted">
                Current: {formatUSDC(maxPerInvoice)} 
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={newMax}
              onChange={(e) => setNewMax(e.target.value)}
              placeholder="100000"
              className="input-field flex-1"
              step="1000"
            />
            <button onClick={handleSetMax} disabled={isPending} className="btn-primary">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-medium text-ink">Daily Category Budgets</h3>
              <p className="text-xs text-ink-muted">Set daily spending limits per category</p>
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(Number(e.target.value))}
              className="input-field w-40"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
              placeholder="50000"
              className="input-field flex-1"
              step="1000"
            />
            <button onClick={handleSetBudget} disabled={isPending} className="btn-primary">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set"}
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-iris" />
              <div>
                <h3 className="font-medium text-ink">Vendor Allowlist</h3>
                <p className="text-xs text-ink-muted">
                  {vendorAllowlistEnabled
                    ? "Enabled — only approved vendors"
                    : "Disabled — any vendor accepted"}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleVendorAllowlist}
              disabled={isPending}
              className="btn-ghost"
            >
              {vendorAllowlistEnabled ? (
                <ToggleRight className="w-6 h-6 text-iris" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-ink-light" />
              )}
            </button>
          </div>

          {vendorAllowlistEnabled && (
            <div className="flex gap-2 pt-4 border-t border-mist">
              <input
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
                placeholder="0x… vendor address"
                className="input-field flex-1 font-mono text-xs"
              />
              <button onClick={handleAddVendor} disabled={isPending} className="btn-primary">
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
