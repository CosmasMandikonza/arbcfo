import { z } from "zod";

// ─── Enums ───
export const IntentStatus = {
  Draft: 0,
  AwaitingApprovals: 1,
  Scheduled: 2,
  Executed: 3,
  Rejected: 4,
  Cancelled: 5,
  PendingRiskReview: 6,
} as const;

export type IntentStatusType = (typeof IntentStatus)[keyof typeof IntentStatus];

export const IntentStatusLabels: Record<IntentStatusType, string> = {
  [IntentStatus.Draft]: "Draft",
  [IntentStatus.AwaitingApprovals]: "Awaiting Approvals",
  [IntentStatus.Scheduled]: "Scheduled",
  [IntentStatus.Executed]: "Executed",
  [IntentStatus.Rejected]: "Rejected",
  [IntentStatus.Cancelled]: "Cancelled",
  [IntentStatus.PendingRiskReview]: "Pending Risk Review",
};

export const Role = {
  ADMIN: "ADMIN",
  APPROVER: "APPROVER",
  OPERATOR: "OPERATOR",
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

// ─── Categories ───
export const CATEGORIES = [
  { id: 0, name: "General", color: "#6D28D9" },
  { id: 1, name: "Engineering", color: "#2563EB" },
  { id: 2, name: "Marketing", color: "#DB2777" },
  { id: 3, name: "Operations", color: "#059669" },
  { id: 4, name: "Legal", color: "#D97706" },
  { id: 5, name: "HR", color: "#7C3AED" },
] as const;

// ─── Zod Schemas ───
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

export const createIntentSchema = z.object({
  vendor: addressSchema,
  vendorName: z.string().min(1).max(200),
  token: addressSchema,
  amount: z.string().regex(/^\d+$/),
  amountFormatted: z.number().positive(),
  categoryId: z.number().int().min(0).max(5),
  invoiceHash: bytes32Schema,
  memoHash: bytes32Schema,
  memo: z.string().max(1000).optional(),
  dueDate: z.number().int().positive(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceFile: z.string().optional(),
  creator: addressSchema,
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;

export const intentSchema = z.object({
  id: z.number(),
  creator: z.string(),
  vendor: z.string(),
  vendorName: z.string(),
  token: z.string(),
  amount: z.string(),
  amountFormatted: z.number(),
  categoryId: z.number(),
  invoiceHash: z.string(),
  memoHash: z.string(),
  memo: z.string().optional(),
  dueDate: z.number(),
  status: z.number(),
  approvalCount: z.number(),
  createdAt: z.number(),
  executedAt: z.number(),
  invoiceNumber: z.string().optional(),
  txHash: z.string().optional().nullable(),
  receiptId: z.string().optional().nullable(),
  // Oracle fields
  riskScore: z.number().optional().nullable(),
  oracleDecision: z.string().optional().nullable(),
  oracleTxHash: z.string().optional().nullable(),
  oracleBreakdown: z.string().optional().nullable(),
});

export type Intent = z.infer<typeof intentSchema>;

// All the ABI exports remain identical — copying from existing file
// (keeping the same exports as before for VAULT_ABI, POLICY_ENGINE_ABI, etc.)

export const receiptSchema = z.object({
  receiptId: bytes32Schema,
  intentId: z.number(),
  vendor: addressSchema,
  vendorName: z.string(),
  token: addressSchema,
  amount: z.string(),
  amountFormatted: z.number(),
  categoryId: z.number(),
  invoiceHash: bytes32Schema,
  memoHash: bytes32Schema,
  executedAt: z.number(),
  txHash: z.string().optional(),
});

export type Receipt = z.infer<typeof receiptSchema>;

export const policyCheckResultSchema = z.object({
  passing: z.boolean(),
  reason: z.string(),
  checks: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["pass", "warn", "fail"]),
      message: z.string(),
    })
  ),
});

export type PolicyCheckResult = z.infer<typeof policyCheckResultSchema>;

export const parsedInvoiceSchema = z.object({
  vendor: z.string().optional(),
  vendorAddress: addressSchema.optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  invoiceNumber: z.string().optional(),
  dueDate: z.string().optional(),
  memo: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type ParsedInvoice = z.infer<typeof parsedInvoiceSchema>;

export const CHAIN_CONFIG = {
  421614: {
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorer: "https://sepolia.arbiscan.io",
    isTestnet: true,
  },
  42161: {
    name: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
    isTestnet: false,
  },
} as const;

export const APPROVAL_TYPES = {
  ApprovePaymentIntent: [
    { name: "intentId", type: "uint256" },
    { name: "vendor", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "invoiceHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const VAULT_ABI = [
  { type: "function", name: "createIntent", inputs: [{ name: "vendor", type: "address" }, { name: "token", type: "address" }, { name: "amount", type: "uint256" }, { name: "categoryId", type: "uint256" }, { name: "invoiceHash", type: "bytes32" }, { name: "memoHash", type: "bytes32" }, { name: "dueDate", type: "uint256" }], outputs: [{ name: "intentId", type: "uint256" }], stateMutability: "nonpayable" },
  { type: "function", name: "approveIntent", inputs: [{ name: "intentId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "executeIntent", inputs: [{ name: "intentId", type: "uint256" }, { name: "approvers", type: "address[]" }, { name: "signatures", type: "bytes[]" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "rejectIntent", inputs: [{ name: "intentId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "cancelIntent", inputs: [{ name: "intentId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "deposit", inputs: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "withdraw", inputs: [{ name: "token", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getIntent", inputs: [{ name: "intentId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "id", type: "uint256" }, { name: "creator", type: "address" }, { name: "vendor", type: "address" }, { name: "token", type: "address" }, { name: "amount", type: "uint256" }, { name: "categoryId", type: "uint256" }, { name: "invoiceHash", type: "bytes32" }, { name: "memoHash", type: "bytes32" }, { name: "dueDate", type: "uint256" }, { name: "status", type: "uint8" }, { name: "approvalCount", type: "uint256" }, { name: "createdAt", type: "uint256" }, { name: "executedAt", type: "uint256" }] }], stateMutability: "view" },
  { type: "function", name: "getBalance", inputs: [{ name: "token", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approvalThreshold", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "nextIntentId", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "hasApproved", inputs: [{ name: "intentId", type: "uint256" }, { name: "approver", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "approverNonces", inputs: [{ name: "approver", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getDomainSeparator", inputs: [], outputs: [{ name: "", type: "bytes32" }], stateMutability: "view" },
  { type: "function", name: "getIntentCount", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "setApprovalThreshold", inputs: [{ name: "threshold_", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "pause", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "unpause", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "event", name: "IntentCreated", inputs: [{ name: "intentId", type: "uint256", indexed: true }, { name: "creator", type: "address", indexed: true }, { name: "vendor", type: "address", indexed: false }, { name: "token", type: "address", indexed: false }, { name: "amount", type: "uint256", indexed: false }, { name: "categoryId", type: "uint256", indexed: false }, { name: "invoiceHash", type: "bytes32", indexed: false }, { name: "memoHash", type: "bytes32", indexed: false }, { name: "dueDate", type: "uint256", indexed: false }] },
  { type: "event", name: "IntentApproved", inputs: [{ name: "intentId", type: "uint256", indexed: true }, { name: "approver", type: "address", indexed: true }, { name: "approvalCount", type: "uint256", indexed: false }] },
  { type: "event", name: "IntentExecuted", inputs: [{ name: "intentId", type: "uint256", indexed: true }, { name: "vendor", type: "address", indexed: true }, { name: "token", type: "address", indexed: false }, { name: "amount", type: "uint256", indexed: false }, { name: "receiptId", type: "bytes32", indexed: false }] },
  { type: "event", name: "Receipt", inputs: [{ name: "receiptId", type: "bytes32", indexed: true }, { name: "intentId", type: "uint256", indexed: true }, { name: "vendor", type: "address", indexed: false }, { name: "token", type: "address", indexed: false }, { name: "amount", type: "uint256", indexed: false }, { name: "categoryId", type: "uint256", indexed: false }, { name: "invoiceHash", type: "bytes32", indexed: false }, { name: "memoHash", type: "bytes32", indexed: false }, { name: "executedAt", type: "uint256", indexed: false }] },
  { type: "event", name: "Deposited", inputs: [{ name: "token", type: "address", indexed: true }, { name: "from", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { type: "event", name: "Withdrawn", inputs: [{ name: "token", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
] as const;

export const POLICY_ENGINE_ABI = [
  { type: "function", name: "isPolicyPassing", inputs: [{ name: "vendor", type: "address" }, { name: "token", type: "address" }, { name: "amount", type: "uint256" }, { name: "categoryId", type: "uint256" }], outputs: [{ name: "passing", type: "bool" }, { name: "reason", type: "string" }], stateMutability: "view" },
  { type: "function", name: "config", inputs: [], outputs: [{ name: "vendorAllowlistEnabled", type: "bool" }, { name: "maxPerInvoice", type: "uint256" }, { name: "paused", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "allowedVendors", inputs: [{ name: "vendor", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "allowedTokens", inputs: [{ name: "token", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "categoryBudgets", inputs: [{ name: "categoryId", type: "uint256" }], outputs: [{ name: "dailyLimit", type: "uint256" }, { name: "spentToday", type: "uint256" }, { name: "lastResetDay", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getCategorySpentToday", inputs: [{ name: "categoryId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "setVendorAllowlistEnabled", inputs: [{ name: "enabled", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setVendorAllowed", inputs: [{ name: "vendor", type: "address" }, { name: "allowed", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setTokenAllowed", inputs: [{ name: "token", type: "address" }, { name: "allowed", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setMaxPerInvoice", inputs: [{ name: "max", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setCategoryBudget", inputs: [{ name: "categoryId", type: "uint256" }, { name: "dailyLimit", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "pause", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "unpause", inputs: [], outputs: [], stateMutability: "nonpayable" },
] as const;

export const RECEIPT_REGISTRY_ABI = [
  { type: "function", name: "getReceipt", inputs: [{ name: "receiptId", type: "bytes32" }], outputs: [{ name: "", type: "tuple", components: [{ name: "receiptId", type: "bytes32" }, { name: "intentId", type: "uint256" }, { name: "vendor", type: "address" }, { name: "token", type: "address" }, { name: "amount", type: "uint256" }, { name: "categoryId", type: "uint256" }, { name: "invoiceHash", type: "bytes32" }, { name: "memoHash", type: "bytes32" }, { name: "executedAt", type: "uint256" }, { name: "exists", type: "bool" }] }], stateMutability: "view" },
  { type: "function", name: "getReceiptCount", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getReceiptIdAtIndex", inputs: [{ name: "index", type: "uint256" }], outputs: [{ name: "", type: "bytes32" }], stateMutability: "view" },
  { type: "event", name: "ReceiptMinted", inputs: [{ name: "receiptId", type: "bytes32", indexed: true }, { name: "intentId", type: "uint256", indexed: true }, { name: "vendor", type: "address", indexed: false }, { name: "amount", type: "uint256", indexed: false }, { name: "executedAt", type: "uint256", indexed: false }] },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ name: "", type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;
