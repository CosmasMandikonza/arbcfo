"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useSignTypedData,
  useChainId,
  usePublicClient,
} from "wagmi";
import { toast } from "sonner";
import { WorkflowTimeline } from "@/components/shared/workflow-timeline";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  formatUSDC,
  formatDate,
  truncateAddress,
  categoryName,
} from "@/lib/utils";
import {
  APPROVAL_TYPES,
  IntentStatus,
  VAULT_ABI,
} from "@arbcfo/shared";
import { CONTRACTS } from "@/lib/wagmi";
import type { Intent } from "@arbcfo/shared";
import {
  CheckCircle2,
  Loader2,
  PenLine,
  Shield,
  AlertTriangle,
} from "lucide-react";

export default function ApprovalsPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState<number | null>(null);
  const { signTypedDataAsync } = useSignTypedData();

  const fetchPending = async () => {
    try {
      const res = await fetch("/api/intents?status=1,6");
      const data = await res.json();
      setIntents(data.intents || []);
    } catch {
      setIntents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleSignApproval = async (intent: Intent) => {
    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!publicClient) {
      toast.error("Wallet client not ready");
      return;
    }

    setSigningId(intent.id);

    try {
      const nonce = (await publicClient.readContract({
        address: CONTRACTS.vault as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "approverNonces",
        args: [address as `0x${string}`],
      })) as bigint;

      const signature = await signTypedDataAsync({
        domain: {
          name: "ArbCFOVault",
          version: "2",
          chainId: BigInt(chainId),
          verifyingContract: CONTRACTS.vault as `0x${string}`,
        },
        types: APPROVAL_TYPES,
        primaryType: "ApprovePaymentIntent",
        message: {
          intentId: BigInt(intent.id),
          vendor: intent.vendor as `0x${string}`,
          token: intent.token as `0x${string}`,
          amount: BigInt(intent.amount),
          invoiceHash: intent.invoiceHash as `0x${string}`,
          nonce,
        },
      });

      const res = await fetch(`/api/intents/${intent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          approver: address,
          signature,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to store approval");
      }

      toast.success("Review signature collected", {
        description: `Intent #${intent.id} — ${formatUSDC(intent.amount)}`,
      });

      await fetchPending();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to sign approval";

      if (msg.toLowerCase().includes("rejected")) {
        toast.error("Signature rejected");
      } else {
        toast.error(msg);
      }
    } finally {
      setSigningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-iris border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">
          Review & Approvals
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Collect reviewer signatures for intents awaiting approval or escalated
          by the Transaction Risk Oracle. Execution proof is tracked separately
          once a real payment transaction is synced.
        </p>
      </div>

      {intents.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All caught up!"
          description="No payment intents require review right now."
        />
      ) : (
        <div className="space-y-4">
          {intents.map((intent) => (
            <div key={intent.id} className="card p-5 animate-fade-in">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-medium text-ink">
                      {intent.vendorName || truncateAddress(intent.vendor)}
                    </h3>
                    <span className="text-xs text-ink-light">#{intent.id}</span>
                    <StatusBadge status={intent.status} />
                  </div>
                  <p className="text-xs text-ink-muted">
                    {categoryName(intent.categoryId)} · Due{" "}
                    {formatDate(intent.dueDate)}
                  </p>
                  {intent.memo && (
                    <p className="text-sm text-ink-muted mt-1">{intent.memo}</p>
                  )}
                </div>

                <div className="text-right">
                  <p className="font-display text-xl font-bold text-ink">
                    {formatUSDC(intent.amount)}
                  </p>
                  <p className="text-xs text-ink-muted">USDC</p>
                </div>
              </div>

              {intent.status === IntentStatus.PendingRiskReview && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-700">
                    Escalated by Transaction Risk Oracle
                    {intent.riskScore != null && ` — score ${intent.riskScore}`}
                  </span>
                </div>
              )}

              <WorkflowTimeline status={intent.status} />

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-mist">
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <Shield className="w-3.5 h-3.5" />
                  {intent.approvalCount} review signature
                  {intent.approvalCount === 1 ? "" : "s"} collected
                </div>

                <button
                  onClick={() => handleSignApproval(intent)}
                  disabled={signingId === intent.id}
                  className="btn-primary"
                >
                  {signingId === intent.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing…
                    </>
                  ) : (
                    <>
                      <PenLine className="w-4 h-4" />
                      Sign Review
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}