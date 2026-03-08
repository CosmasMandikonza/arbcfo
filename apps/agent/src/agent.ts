// ============================================================================
// ArbCFO AI Agent — LangChain + Viem Invoice Parser & Submitter
// ============================================================================
//
// UPGRADE FROM HEURISTIC PARSER:
//   The original cli.ts used regex patterns to extract invoice fields.
//   This module replaces that with GPT-4o + Zod structured output for:
//   - Any invoice format (not just the patterns we hardcoded)
//   - Vendor address extraction (regex can't validate checksums)
//   - Confidence scoring (LLM knows when it's guessing)
//   - Anomaly flagging ("this is 40% higher than usual" in plain English)
//
// ============================================================================

import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  isAddress,
  getAddress,
  keccak256,
  toBytes,
  encodeFunctionData,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Hash,
  type TransactionReceipt,
  type Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Chain Definition ───
export const arbitrumSepolia: Chain = {
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia-rollup.arbitrum.io/rpc"] },
  },
  blockExplorers: {
    default: { name: "Arbiscan", url: "https://sepolia.arbiscan.io" },
  },
};

// ─── Zod Schema for LLM Structured Output ───
// Forces GPT-4o to return exactly these fields in exactly these types.
// Under the hood, LangChain uses OpenAI function calling to guarantee compliance.
export const invoiceSchema = z.object({
  vendorAddress: z
    .string()
    .describe(
      "The Ethereum wallet address (0x...) of the vendor/payee. " +
        "Must be a valid 42-character hex address starting with 0x. " +
        "If not found, return 0x0000000000000000000000000000000000000000."
    ),
  amount: z
    .string()
    .describe(
      "The payment amount as a decimal string (e.g., '1500.50'). " +
        "Extract the final total due, not subtotals. Remove currency symbols. " +
        "Return '0' if not found."
    ),
  vendorName: z
    .string()
    .describe("The name of the vendor or company issuing the invoice."),
  description: z
    .string()
    .describe("A brief 1-2 sentence description of what the payment is for."),
  dueDate: z
    .string()
    .describe(
      "The payment due date in ISO format (YYYY-MM-DD). Return '1970-01-01' if not found."
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Your confidence in the extraction accuracy, from 0.0 to 1.0. " +
        "Set below 0.5 if the invoice is unclear or data seems wrong."
    ),
  anomalyNotes: z
    .string()
    .describe(
      "Any concerns about this invoice — unusual amounts, suspicious formatting, " +
        "missing fields, or anything that seems off. Return 'none' if everything looks normal."
    ),
  suggestedCategory: z
    .string()
    .describe(
      "Categorize this payment: 'Software', 'Services', 'Operations', 'Marketing', 'Payroll', or 'Other'."
    ),
});

export type InvoiceData = z.infer<typeof invoiceSchema>;

// ─── Validation ───
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: {
    vendorAddress: `0x${string}`;
    amountRaw: bigint;
    amountHuman: string;
    vendorName: string;
    description: string;
    dueDateUnix: number;
  };
}

export function validateInvoiceData(data: InvoiceData): ValidationResult {
  const errors: string[] = [];

  if (!isAddress(data.vendorAddress)) {
    errors.push(`Invalid vendor address: "${data.vendorAddress}"`);
  }
  if (data.vendorAddress === "0x0000000000000000000000000000000000000000") {
    errors.push("Vendor address not found in invoice — needs manual entry");
  }

  let amountRaw: bigint;
  try {
    amountRaw = parseUnits(data.amount, 6); // USDC = 6 decimals
  } catch {
    errors.push(`Cannot parse amount "${data.amount}"`);
    amountRaw = 0n;
  }
  if (amountRaw <= 0n) {
    errors.push("Amount must be greater than zero");
  }

  // Sanity: flag > $10M
  const TEN_MILLION = parseUnits("10000000", 6);
  if (amountRaw > TEN_MILLION) {
    errors.push(`Amount $${data.amount} exceeds $10M sanity threshold`);
  }

  if (data.confidence < 0.5) {
    errors.push(`Low extraction confidence (${data.confidence})`);
  }

  let dueDateUnix: number;
  try {
    dueDateUnix = Math.floor(new Date(data.dueDate).getTime() / 1000);
    if (isNaN(dueDateUnix) || dueDateUnix <= 0) dueDateUnix = 0;
  } catch {
    dueDateUnix = 0;
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    sanitized: {
      vendorAddress: getAddress(data.vendorAddress) as `0x${string}`,
      amountRaw,
      amountHuman: data.amount,
      vendorName: data.vendorName,
      description: data.description,
      dueDateUnix,
    },
  };
}

// ─── Retry Logic (Arbitrum Timeboost / RPC Edge Cases) ───
const TRANSIENT_ERRORS = [
  "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "429",
  "nonce too low", "replacement underpriced", "already known",
  "header not found", "missing trie node",
];

function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return TRANSIENT_ERRORS.some((p) => msg.toLowerCase().includes(p.toLowerCase()));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error)) throw error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * baseDelay * 0.1;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ─── Vault ABI (minimal) ───
const VAULT_ABI = [
  {
    name: "createIntent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vendor", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "categoryId", type: "uint256" },
      { name: "invoiceHash", type: "bytes32" },
      { name: "memoHash", type: "bytes32" },
      { name: "dueDate", type: "uint256" },
    ],
    outputs: [{ name: "intentId", type: "uint256" }],
  },
] as const satisfies Abi;

// ─── Agent Config ───
export interface AgentConfig {
  openaiApiKey: string;
  privateKey?: `0x${string}`;
  vaultAddress?: `0x${string}`;
  usdcAddress?: `0x${string}`;
  rpcUrl?: string;
  maxRetries?: number;
}

// ─── The Agent ───
export class ArbCFOAgent {
  private llm: ReturnType<ChatOpenAI["withStructuredOutput"]>;
  private publicClient?: PublicClient;
  private walletClient?: WalletClient;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;

    const chatModel = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0,
      openAIApiKey: config.openaiApiKey,
    });

    this.llm = chatModel.withStructuredOutput(invoiceSchema, {
      name: "extract_invoice",
      strict: true,
    });

    // Only initialize blockchain clients if keys are provided
    if (config.privateKey && config.vaultAddress) {
      const rpcUrl = config.rpcUrl || "https://sepolia-rollup.arbitrum.io/rpc";
      const account = privateKeyToAccount(config.privateKey);

      this.publicClient = createPublicClient({
        chain: arbitrumSepolia,
        transport: http(rpcUrl),
      });

      this.walletClient = createWalletClient({
        account,
        chain: arbitrumSepolia,
        transport: http(rpcUrl),
      });
    }
  }

  /** Parse an invoice using LLM — no blockchain interaction */
  async parseInvoice(rawInvoice: string): Promise<InvoiceData> {
    const result = await this.llm.invoke([
      {
        role: "system",
        content:
          "You are a financial document parser for a Web3 treasury management system. " +
          "Extract payment details from the invoice text provided. " +
          "The vendor address MUST be a valid 42-character Ethereum address (0x + 40 hex chars). " +
          "The amount MUST be a plain decimal number without currency symbols. " +
          "If you cannot confidently extract a field, use the default value and set confidence below 0.5.",
      },
      { role: "user", content: `Parse this invoice:\n\n${rawInvoice}` },
    ]);
    return result as InvoiceData;
  }

  /** Parse + validate + submit to blockchain */
  async submitIntent(rawInvoice: string): Promise<{
    success: boolean;
    txHash?: Hash;
    receipt?: TransactionReceipt;
    invoice?: InvoiceData;
    validation?: ValidationResult;
    error?: string;
  }> {
    // Step 1: LLM extraction
    let invoice: InvoiceData;
    try {
      invoice = await this.parseInvoice(rawInvoice);
    } catch (error) {
      return {
        success: false,
        error: `LLM extraction failed: ${error instanceof Error ? error.message : error}`,
      };
    }

    // Step 2: Validation
    const validation = validateInvoiceData(invoice);
    if (!validation.valid || !validation.sanitized) {
      return { success: false, invoice, validation, error: `Validation failed: ${validation.errors.join("; ")}` };
    }

    // Step 3: Check blockchain clients
    if (!this.walletClient || !this.publicClient || !this.config.vaultAddress || !this.config.usdcAddress) {
      return {
        success: false,
        invoice,
        validation,
        error: "Blockchain not configured — set PRIVATE_KEY, VAULT_ADDRESS, USDC_ADDRESS",
      };
    }

    const { vendorAddress, amountRaw, description, dueDateUnix } = validation.sanitized;
    const invoiceHash = keccak256(toBytes(rawInvoice)) as `0x${string}`;
    const memoHash = keccak256(toBytes(description)) as `0x${string}`;

    // Step 4: Submit with retry
    try {
      const txHash = await withRetry(
        async () => {
          const data = encodeFunctionData({
            abi: VAULT_ABI,
            functionName: "createIntent",
            args: [
              vendorAddress,
              this.config.usdcAddress!,
              amountRaw,
              0n,
              invoiceHash,
              memoHash,
              BigInt(dueDateUnix),
            ],
          });
          return this.walletClient!.sendTransaction({
            to: this.config.vaultAddress!,
            data,
          });
        },
        this.config.maxRetries || 5,
        500
      );

      const receipt = await withRetry(
        () => this.publicClient!.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 }),
        3,
        2000
      );

      if (receipt.status === "reverted") {
        return { success: false, txHash, receipt, invoice, validation, error: "Transaction reverted on-chain" };
      }

      return { success: true, txHash, receipt, invoice, validation };
    } catch (error) {
      return {
        success: false,
        invoice,
        validation,
        error: `Transaction failed: ${error instanceof Error ? error.message : error}`,
      };
    }
  }
}
