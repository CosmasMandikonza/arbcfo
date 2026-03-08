# ArbCFO — Pitch

## One-Liner

ArbCFO turns invoice payments into a secure, auditable workflow: **Invoice → Approval → USDC payment → Audit-ready receipt**, all on Arbitrum.

## The Problem

Treasury teams managing crypto payments face a painful choice: use centralized tools that defeat the purpose of onchain transparency, or cobble together raw contract calls with zero workflow. Neither scales. Neither is auditable. Neither is safe.

**Common failures today:**
- A single keyholder sends $2M to the wrong address — no approval flow
- Invoices tracked in spreadsheets, payments tracked on-chain — no link between them
- "Policy" means someone remembering not to exceed the budget
- Receipts are screenshots of Etherscan

## The Solution

ArbCFO is a **payables workflow product** — not a dashboard, not a multisig, not a chat-based agent with admin keys.

**How it works:**
1. **Intake** — Upload an invoice (PDF/text/manual). ArbCFO extracts vendor, amount, and due date.
2. **Policy Check** — The onchain PolicyEngine validates: vendor allowlist, spending limits, category budgets, token allowlist.
3. **Approval** — Approvers sign EIP-712 typed data (gas-free). M-of-N threshold configurable.
4. **Execution** — USDC transfers from vault to vendor. All signatures verified onchain.
5. **Receipt** — An immutable receipt is stored onchain with deterministic ID, invoice hash, and full audit trail.

**The agent can propose. It can never execute.** This is the safe way to bring AI/automation to treasury operations.

## Why Arbitrum?

- Sub-cent transaction costs make per-invoice receipts economically viable
- Arbitrum Sepolia for testing, one-click deploy to Arbitrum One for production
- EIP-712 signatures work beautifully on Arbitrum with full EVM compatibility
- USDC is the dominant stablecoin on Arbitrum — this is where real treasury payments happen

## Key Differentiators

1. **Onchain Policy Engine** — Not UI-only rules. The smart contract enforces every limit at execution time. The UI shows policy status, but the contract is the source of truth.

2. **EIP-712 Multi-Approval** — Modern, gas-free approval flow. Approvers sign typed data in their wallet. Execution bundles signatures and verifies onchain. Feels institutional, works on-chain.

3. **Deterministic Receipts** — `receiptId = keccak256(intentId, invoiceHash, vendor, amount)`. Every receipt links to its invoice, transaction, and approval history. Export as PDF or verify on Arbiscan.

4. **Agent-Safe Architecture** — The CLI agent can draft and propose intents, but has zero execution authority. This is how you safely integrate AI into treasury operations.

5. **Premium UX** — Not a generic dashboard. A purpose-built payables inbox with workflow timeline, approval lanes, and receipt vault.

## Market

- $1T+ in DAO treasury assets with primitive payment tooling
- Growing adoption of USDC for B2B payments
- Post-FTX demand for transparent, auditable treasury operations
- AI agent trend needs guardrails — ArbCFO provides them

## Technical Highlights

- Solidity 0.8.24 with OpenZeppelin (AccessControl, Pausable, ReentrancyGuard)
- 25+ Foundry tests covering policies, signatures, thresholds, and edge cases
- Next.js 14 + wagmi + viem + RainbowKit
- Invoice parsing works without any API keys (heuristic + optional LLM)
- CLI agent for programmatic access
- Full type safety with Zod schemas
