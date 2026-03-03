"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { CONTRACTS } from "@/lib/wagmi";
import { VAULT_ABI } from "@arbcfo/shared";
import { cn, truncateAddress } from "@/lib/utils";
import {
  Settings,
  Users,
  Shield,
  Loader2,
  Copy,
  Check,
  UserPlus,
  Crown,
  Eye,
  Wrench,
  Trash2,
} from "lucide-react";

type TeamRole = "ADMIN" | "APPROVER" | "OPERATOR";

interface TeamMember {
  address: string;
  name: string;
  role: TeamRole;
  createdAt?: string;
}

const ROLE_CONFIG: Record<
  TeamRole,
  { label: string; icon: typeof Crown; color: string }
> = {
  ADMIN: {
    label: "Admin",
    icon: Crown,
    color: "text-amber-600 bg-amber-50",
  },
  APPROVER: {
    label: "Approver",
    icon: Eye,
    color: "text-iris bg-iris/10",
  },
  OPERATOR: {
    label: "Operator",
    icon: Wrench,
    color: "text-emerald-600 bg-emerald-50",
  },
};

export default function SettingsPage() {
  const { address } = useAccount();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("APPROVER");
  const [copied, setCopied] = useState<string | null>(null);
  const [thresholdInput, setThresholdInput] = useState("");

  const { writeContractAsync, isPending } = useWriteContract();

  const { data: currentThreshold } = useReadContract({
    address: CONTRACTS.vault,
    abi: VAULT_ABI,
    functionName: "approvalThreshold",
  });

  useEffect(() => {
    void fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("Failed to fetch team");

      const data = (await res.json()) as { members?: TeamMember[] };
      setMembers(data.members || []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newAddress || !newAddress.startsWith("0x") || newAddress.length !== 42) {
      toast.error("Enter a valid wallet address");
      return;
    }

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: newAddress,
          name: newName || truncateAddress(newAddress),
          role: newRole,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed to save team member");
      }

      toast.success(`${ROLE_CONFIG[newRole].label} added`);
      setNewAddress("");
      setNewName("");
      setNewRole("APPROVER");
      await fetchMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save team member");
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    try {
      const res = await fetch(
        `/api/team?address=${encodeURIComponent(member.address)}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed to remove team member");
      }

      toast.success(`${member.name} removed`);
      await fetchMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove team member");
    }
  };

  const handleSetThreshold = async () => {
    const val = Number.parseInt(thresholdInput, 10);
    if (!val || val < 1) {
      toast.error("Threshold must be at least 1");
      return;
    }

    try {
      await writeContractAsync({
        address: CONTRACTS.vault,
        abi: VAULT_ABI,
        functionName: "setApprovalThreshold",
        args: [BigInt(val)],
      });

      toast.success(`Approval threshold set to ${val}`);
      setThresholdInput("");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "shortMessage" in err
          ? String((err as { shortMessage?: string }).shortMessage)
          : "Failed to set threshold";

      toast.error(message);
    }
  };

  const copyAddress = (addr: string) => {
    void navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-ink-muted mt-1">
          Manage the local team directory and the onchain approval threshold.
        </p>
      </div>

      <div className="space-y-6">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-iris" />
            <div>
              <h3 className="font-medium text-ink">Approval Threshold</h3>
              <p className="text-xs text-ink-muted">
                Current: {currentThreshold ? currentThreshold.toString() : "—"} approvals required
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              placeholder="e.g. 2"
              className="input-field w-32"
              min={1}
            />
            <button
              onClick={handleSetThreshold}
              disabled={isPending}
              className="btn-primary"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-iris" />
            <div>
              <h3 className="font-medium text-ink">Team Directory</h3>
              <p className="text-xs text-ink-muted">
                Local workspace roster used for names and roles in the UI
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-ink-light" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-sm text-ink-muted">
              No team members yet. Add one below.
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {members.map((member) => {
                const roleConfig = ROLE_CONFIG[member.role];
                const Icon = roleConfig.icon;

                return (
                  <div
                    key={member.address}
                    className="flex items-center justify-between p-3 rounded-xl bg-pearl"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          roleConfig.color
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-ink">{member.name}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-xs text-ink-light font-mono">
                            {truncateAddress(member.address)}
                          </p>
                          <button
                            onClick={() => copyAddress(member.address)}
                            className="text-ink-light hover:text-ink transition-colors"
                            type="button"
                          >
                            {copied === member.address ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={cn("status-badge text-xs", roleConfig.color)}>
                        {roleConfig.label}
                      </span>

                      {member.address.toLowerCase() !== address?.toLowerCase() && (
                        <button
                          onClick={() => void handleRemoveMember(member)}
                          className="text-ink-light hover:text-coral transition-colors p-1"
                          title="Remove member"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-mist">
            <p className="text-sm font-medium text-ink mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add Team Member
            </p>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="0x… wallet address"
                  className="input-field flex-1 font-mono text-xs"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as TeamRole)}
                  className="input-field w-36"
                >
                  <option value="APPROVER">Approver</option>
                  <option value="OPERATOR">Operator</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Display name (optional)"
                  className="input-field flex-1"
                />
                <button
                  onClick={() => void handleAddMember()}
                  className="btn-primary"
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-ink-light" />
            <div>
              <h3 className="font-medium text-ink">Contract Addresses</h3>
              <p className="text-xs text-ink-muted">Deployed contract references</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { label: "Vault", addr: CONTRACTS.vault },
              { label: "Policy Engine", addr: CONTRACTS.policyEngine },
              { label: "Receipt Registry", addr: CONTRACTS.receiptRegistry },
            ].map(({ label, addr }) => (
              <div
                key={label}
                className="flex items-center justify-between p-2 rounded-lg bg-pearl"
              >
                <span className="text-xs text-ink-muted">{label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-ink">
                    {addr ? truncateAddress(addr) : "Not configured"}
                  </span>
                  {addr && (
                    <button
                      onClick={() => copyAddress(addr)}
                      className="text-ink-light hover:text-ink transition-colors"
                      type="button"
                    >
                      {copied === addr ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}