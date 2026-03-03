"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { CONTRACTS } from "@/lib/wagmi";
import { VAULT_ABI, ERC20_ABI } from "@arbcfo/shared";
import {
  Vault, ArrowDownToLine, ArrowUpFromLine, Wallet,
  TrendingUp, Shield, Loader2
} from "lucide-react";
import { cn, formatUSDC } from "@/lib/utils";

export default function VaultPage() {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");

  // Read vault balance
  const { data: vaultBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.vault,
    abi: VAULT_ABI,
    functionName: "getBalance",
    args: [CONTRACTS.usdc],
  });

  // Read user's USDC balance
  const { data: userBalance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [
      address || "0x0000000000000000000000000000000000000000",
      CONTRACTS.vault,
    ],
  });

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isTxSuccess) {
      refetchBalance();
      refetchAllowance();
      setDepositAmount("");
      setWithdrawAmount("");
    }
  }, [isTxSuccess, refetchBalance, refetchAllowance]);

  const handleApprove = async () => {
    if (!depositAmount) return;
    try {
      await writeContractAsync({
        address: CONTRACTS.usdc,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.vault, parseUnits(depositAmount, 6)],
      });
      toast.success("Approval submitted");
    } catch (err: any) {
      toast.error(err.shortMessage || "Approval failed");
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount) return;
    try {
      await writeContractAsync({
        address: CONTRACTS.vault,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [CONTRACTS.usdc, parseUnits(depositAmount, 6)],
      });
      toast.success("Deposit submitted!");
    } catch (err: any) {
      toast.error(err.shortMessage || "Deposit failed");
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawTo) return;
    try {
      await writeContractAsync({
        address: CONTRACTS.vault,
        abi: VAULT_ABI,
        functionName: "withdraw",
        args: [CONTRACTS.usdc, withdrawTo as `0x${string}`, parseUnits(withdrawAmount, 6)],
      });
      toast.success("Withdrawal submitted!");
    } catch (err: any) {
      toast.error(err.shortMessage || "Withdrawal failed");
    }
  };

  const needsApproval = depositAmount &&
    allowance !== undefined &&
    parseUnits(depositAmount, 6) > (allowance as bigint);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Treasury Vault</h1>
        <p className="text-sm text-ink-muted mt-1">
          Manage USDC funds held in the ArbCFO smart contract vault.
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Vault className="w-4 h-4 text-iris" />
            <p className="text-xs text-ink-muted uppercase tracking-wider">Vault Balance</p>
          </div>
          <p className="font-display text-2xl font-bold text-ink">
            {vaultBalance !== undefined ? formatUSDC(vaultBalance as bigint) : "$—"}
          </p>
          <p className="text-xs text-ink-light mt-1">USDC</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 text-mint" />
            <p className="text-xs text-ink-muted uppercase tracking-wider">Your Balance</p>
          </div>
          <p className="font-display text-2xl font-bold text-ink">
            {isConnected && userBalance !== undefined
              ? formatUSDC(userBalance as bigint)
              : "$—"}
          </p>
          <p className="text-xs text-ink-light mt-1">USDC in wallet</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-emerald-500" />
            <p className="text-xs text-ink-muted uppercase tracking-wider">Status</p>
          </div>
          <p className="font-display text-lg font-semibold text-emerald-600">Active</p>
          <p className="text-xs text-ink-light mt-1">Vault operational</p>
        </div>
      </div>

      {/* Deposit / Withdraw */}
      <div className="card">
        <div className="flex border-b border-mist">
          {(["deposit", "withdraw"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-3.5 text-sm font-medium transition-all border-b-2",
                tab === t
                  ? "text-iris border-iris"
                  : "text-ink-muted border-transparent hover:text-ink"
              )}
            >
              {t === "deposit" ? (
                <span className="flex items-center justify-center gap-2">
                  <ArrowDownToLine className="w-4 h-4" /> Deposit
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ArrowUpFromLine className="w-4 h-4" /> Withdraw
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "deposit" ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-muted mb-1 block">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="1000.00"
                  className="input-field text-lg"
                  step="0.01"
                />
              </div>
              {needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={isPending}
                  className="btn-secondary w-full"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Approve USDC
                </button>
              ) : (
                <button
                  onClick={handleDeposit}
                  disabled={isPending || !depositAmount}
                  className="btn-primary w-full"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Deposit to Vault
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-muted mb-1 block">
                  Amount (USDC)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="1000.00"
                  className="input-field text-lg"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted mb-1 block">
                  Recipient Address
                </label>
                <input
                  value={withdrawTo}
                  onChange={(e) => setWithdrawTo(e.target.value)}
                  placeholder="0x…"
                  className="input-field font-mono text-xs"
                />
              </div>
              <button
                onClick={handleWithdraw}
                disabled={isPending || !withdrawAmount || !withdrawTo}
                className="btn-primary w-full"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Withdraw from Vault
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
