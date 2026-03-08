# ArbCFO — Feature List

## Core Features

### 1. Payables Inbox
- Invoice intake via PDF upload, text paste, or manual entry
- Heuristic invoice parser (vendor, amount, due date, invoice number extraction)
- Optional LLM-enhanced parsing (Anthropic API, graceful fallback)
- Invoice hash computed from file bytes (keccak256)
- Status-based filtering: Draft, Awaiting Approvals, Executed, Rejected
- Detail drawer with full intent information

### 2. Onchain Policy Engine
- **Vendor Allowlist** — toggle on/off, add approved vendor addresses
- **Max Per Invoice** — hard cap on single payment amount
- **Daily Category Budgets** — per-category daily spend limits with automatic reset
- **Token Allowlist** — only approved tokens (USDC default)
- **Emergency Pause** — admin can halt all operations instantly
- All policies enforced in smart contract at execution time

### 3. EIP-712 Multi-Approval
- Off-chain typed data signatures (gas-free for approvers)
- Configurable M-of-N threshold
- Per-approver nonce tracking (replay protection)
- Domain separator with chainId + contract address
- Mixed on-chain + off-chain approval support
- Approval lane visualization in UI

### 4. Treasury Vault
- USDC deposit and withdrawal (role-gated)
- Balance tracking and display
- Execution sends USDC directly from vault to vendor
- Top-up flow in the UI

### 5. Receipt System
- Deterministic receiptId = keccak256(intentId, invoiceHash, vendor, amount)
- Immutable onchain storage in ReceiptRegistry
- Searchable Receipt Vault with filters (vendor, category, date)
- PDF export with embedded invoice hash and Arbiscan link
- Onchain verification link for each receipt

### 6. Agent CLI
- `arb-cfo intake <file>` — parse invoice and output draft JSON
- `arb-cfo propose` — submit intent to API (still requires approvals)
- `arb-cfo status` — check intent status
- Zero execution authority (propose only)

### 7. Team & Roles
- Three roles: Admin, Approver, Operator
- Grant/revoke roles via Settings page (onchain AccessControl)
- Approval threshold configuration
- Contract address reference panel

## Smart Contract Architecture

| Contract | Purpose | Key Functions |
|----------|---------|--------------|
| ArbCFOVault | Main treasury + workflow | createIntent, approveIntent, executeIntent, deposit, withdraw |
| PolicyEngine | Onchain guardrails | validateIntent, setCategoryBudget, setMaxPerInvoice |
| ReceiptRegistry | Immutable receipts | mintReceipt, getReceipt, getReceiptIdAtIndex |
| IArbCFOTypes | Shared types | PaymentIntent, IntentStatus, PolicyConfig |

## UI/UX Features

- Pearl + Mint + Iris color palette (light, airy, professional)
- Workflow Timeline component (Intake → Policy → Approvals → Execution → Receipt)
- Status badges with animated pulse for pending items
- Network guard (prompts chain switch if not on Arbitrum Sepolia)
- Empty states and loading states for all views
- Responsive sidebar navigation
- Agent assistant panel explaining guardrails

## Technical Quality

- 25+ Foundry tests (policies, signatures, thresholds, edge cases)
- OpenZeppelin patterns (AccessControl, Pausable, ReentrancyGuard)
- Custom errors for gas efficiency
- Type-safe API with Zod schemas
- Prisma + SQLite for fast local indexing
- Event-based DB sync
- No hardcoded secrets (.env.example provided)
