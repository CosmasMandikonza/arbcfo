"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { IntentCard } from "@/components/inbox/intent-card";
import { IntentDetail } from "@/components/inbox/intent-detail";
import { CreateIntentForm } from "@/components/inbox/create-intent-form";
import { EmptyState } from "@/components/shared/empty-state";
import type { Intent } from "@arbcfo/shared";
import { Inbox, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { label: "All", value: -1 },
  { label: "Awaiting", value: 1 },
  { label: "Risk Review", value: 6 },
  { label: "Executed", value: 3 },
  { label: "Rejected", value: 4 },
];

export default function InboxPage() {
  const { address } = useAccount();
  const [intents, setIntents] = useState<Intent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState(-1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchIntents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter >= 0) params.set("status", String(statusFilter));
      if (search) params.set("search", search);
      const res = await fetch(`/api/intents?${params}`);
      const data = await res.json();
      setIntents(data.intents || []);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchIntents();
  }, [fetchIntents]);

  const selectedIntent = intents.find((i) => i.id === selectedId);

  if (showCreate) {
    return (
      <CreateIntentForm
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchIntents();
        }}
      />
    );
  }

  return (
    <div className="flex h-full gap-0 -m-6">
      {/* Left: Intent List */}
      <div className={cn(
        "flex flex-col border-r border-mist bg-pearl/50 transition-all",
        selectedIntent ? "w-[420px]" : "flex-1 max-w-4xl"
      )}>
        {/* Header */}
        <div className="p-5 pb-4 border-b border-mist bg-frost">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-xl font-bold text-ink">Payables Inbox</h1>
              <p className="text-xs text-ink-muted mt-0.5">
                {intents.length} intent{intents.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Intent
            </button>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-ink-light absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors, invoices…"
                className="input-field pl-9"
              />
            </div>
          </div>

          <div className="flex gap-1.5 mt-3">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  statusFilter === f.value
                    ? "bg-iris/10 text-iris"
                    : "text-ink-muted hover:text-ink hover:bg-pearl"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Intent List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-iris border-t-transparent rounded-full animate-spin" />
            </div>
          ) : intents.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No payment intents yet"
              description="Create your first payment intent to get started with ArbCFO."
              action={
                <button onClick={() => setShowCreate(true)} className="btn-primary">
                  <Plus className="w-4 h-4" />
                  Create Intent
                </button>
              }
            />
          ) : (
            intents.map((intent) => (
              <IntentCard
                key={intent.id}
                intent={intent}
                selected={selectedId === intent.id}
                onClick={() => setSelectedId(intent.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: Detail Panel */}
      {selectedIntent && (
        <div className="flex-1 min-w-[400px]">
          <IntentDetail
            intent={selectedIntent}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
