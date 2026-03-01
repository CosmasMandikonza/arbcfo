import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { keccak256, toBytes, toHex, stringToBytes } from "viem";

const USDC_BASE = BigInt(1_000_000);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSDC(amount: string | bigint): string {
  const num = typeof amount === "string" ? BigInt(amount) : amount;
  const whole = num / USDC_BASE;
  const frac = num % USDC_BASE;
  const fracStr = frac.toString().padStart(6, "0").slice(0, 2);
  return `$${whole.toLocaleString()}.${fracStr}`;
}

export function parseUSDC(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000));
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function computeInvoiceHash(data: string | Uint8Array): `0x${string}` {
  if (typeof data === "string") {
    return keccak256(stringToBytes(data));
  }
  return keccak256(toHex(data));
}

export function computeMemoHash(memo: string): `0x${string}` {
  return keccak256(stringToBytes(memo || ""));
}

export function computeReceiptId(
  intentId: number,
  invoiceHash: `0x${string}`,
  vendor: `0x${string}`,
  amount: bigint
): `0x${string}` {
  const encoded = toHex(
    toBytes(
      `0x${BigInt(intentId).toString(16).padStart(64, "0")}${invoiceHash.slice(2)}${vendor
        .slice(2)
        .padStart(64, "0")}${amount.toString(16).padStart(64, "0")}`
    )
  );
  return keccak256(encoded);
}

export function statusColor(status: number): string {
  switch (status) {
    case 0:
      return "text-ink-muted bg-mist";
    case 1:
      return "text-amber-700 bg-amber-50";
    case 2:
      return "text-blue-700 bg-blue-50";
    case 3:
      return "text-emerald-700 bg-emerald-50";
    case 4:
      return "text-red-700 bg-red-50";
    case 5:
      return "text-ink-muted bg-gray-50";
    case 6:
      return "text-orange-700 bg-orange-50";
    default:
      return "text-ink-muted bg-mist";
  }
}

export function statusLabel(status: number): string {
  const labels: Record<number, string> = {
    0: "Draft",
    1: "Awaiting Approvals",
    2: "Scheduled",
    3: "Executed",
    4: "Rejected",
    5: "Cancelled",
    6: "Pending Risk Review",
  };
  return labels[status] || "Unknown";
}

export function categoryName(id: number): string {
  const names: Record<number, string> = {
    0: "General",
    1: "Engineering",
    2: "Marketing",
    3: "Operations",
    4: "Legal",
    5: "HR",
  };
  return names[id] || "Other";
}

export function categoryColor(id: number): string {
  const colors: Record<number, string> = {
    0: "#6D28D9",
    1: "#2563EB",
    2: "#DB2777",
    3: "#059669",
    4: "#D97706",
    5: "#7C3AED",
  };
  return colors[id] || "#6D28D9";
}

export function timeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}