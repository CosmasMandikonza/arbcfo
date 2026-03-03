"use client";

import { useState, useEffect } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatUSDC, formatDate, categoryName, categoryColor, truncateAddress } from "@/lib/utils";
import { CATEGORIES } from "@arbcfo/shared";
import type { Receipt } from "@arbcfo/shared";
import {
  Receipt as ReceiptIcon, Search, Download, ExternalLink,
  FileText, Filter, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(-1);

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (categoryFilter >= 0) params.set("category", String(categoryFilter));
        const res = await fetch(`/api/receipts?${params}`);
        const data = await res.json();
        setReceipts(data.receipts || []);
      } catch {
        // noop
      } finally {
        setLoading(false);
      }
    };
    fetchReceipts();
  }, [search, categoryFilter]);

  const handleDownloadPDF = async (receiptId: string) => {
    try {
      const res = await fetch(`/api/receipts/${receiptId}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${receiptId.slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // noop
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Receipt Vault</h1>
        <p className="text-sm text-ink-muted mt-1">
          Audit-ready receipts with onchain verification. Each receipt links to its transaction.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-ink-light absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by vendor, receipt ID…"
            className="input-field pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(Number(e.target.value))}
          className="input-field w-auto"
        >
          <option value={-1}>All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Receipt Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-iris border-t-transparent rounded-full animate-spin" />
        </div>
      ) : receipts.length === 0 ? (
        <EmptyState
          icon={ReceiptIcon}
          title="No receipts yet"
          description="Receipts are created automatically when payment intents are executed."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {receipts.map((receipt) => (
            <div key={receipt.receiptId} className="card-hover p-5 animate-fade-in">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-ink">{receipt.vendorName || truncateAddress(receipt.vendor)}</p>
                  <p className="text-xs text-ink-light font-mono mt-0.5">
                    {receipt.receiptId.slice(0, 18)}…
                  </p>
                </div>
                <p className="font-display text-lg font-bold text-ink">
                  {formatUSDC(receipt.amount)}
                </p>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span
                  className="status-badge"
                  style={{
                    backgroundColor: categoryColor(receipt.categoryId) + "15",
                    color: categoryColor(receipt.categoryId),
                  }}
                >
                  {categoryName(receipt.categoryId)}
                </span>
                <span className="flex items-center gap-1 text-xs text-ink-light">
                  <Calendar className="w-3 h-3" />
                  {formatDate(receipt.executedAt)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-ink-light mb-4 p-2 bg-pearl rounded-lg">
                <FileText className="w-3.5 h-3.5" />
                Invoice: {receipt.invoiceHash.slice(0, 18)}…
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleDownloadPDF(receipt.receiptId)}
                  className="btn-secondary flex-1 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
                {receipt.txHash && (
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${receipt.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Arbiscan
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
