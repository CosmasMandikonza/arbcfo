# ArbCFO — Demo Script (90 Seconds)

## Setup Before Demo

1. Deploy contracts to Arbitrum Sepolia
2. Fund vault with 50,000 USDC (test tokens)
3. Configure 2 wallets: one Operator, one Approver
4. Set approval threshold to 1 (for demo speed)
5. Seed database with 2-3 sample intents

---

## Script

### [0:00–0:10] Open & Orient

> "This is ArbCFO — an onchain payables workflow for treasury teams on Arbitrum."

- Show the **Inbox** with 2-3 existing intents in different states
- Point out the sidebar: Inbox, Approvals, Vault, Receipts, Policies
- Note the connected wallet indicator in the top bar

### [0:10–0:25] Create a Payment Intent

> "Let's process an invoice. I'll paste the text."

- Click **"New Intent"** button
- Select **"Paste Text"** tab
- Paste sample invoice text:
  ```
  Invoice #INV-2025-0042
  From: CloudScale Solutions Inc.
  Amount Due: $12,500.00
  Due Date: March 15, 2025
  Services: Cloud infrastructure Q1 2025
  ```
- Show auto-parsed fields (vendor, amount, invoice #, due date)
- Point out the **invoice hash** computed from the text
- Click **"Create Intent"**
- Show the new card appear in the Inbox with "Awaiting Approvals" status

### [0:25–0:40] Policy Check

> "Before anyone can approve, the onchain policy engine validates every intent."

- Click on the new intent card to open the **detail drawer**
- Show the **Workflow Timeline**: Intake ✓ → Policy Check ✓ → Approvals (current) → Execution → Receipt
- Point out the **policy check results**:
  - ✅ Vendor: on allowlist (or allowlist disabled)
  - ✅ Amount: under $100K max per invoice
  - ✅ Category: within daily budget
  - ✅ Token: USDC approved
- Emphasize: *"These checks happen in the smart contract, not just the UI."*

### [0:40–0:55] Approve (EIP-712 Signature)

> "Now an approver signs off. This is a gas-free EIP-712 signature."

- Switch to **Approvals** page
- Show the intent waiting for approval
- Click **"Approve"**
- MetaMask pops up with **typed data signature** (not a transaction!)
- Sign — show the approval appear in the lane
- Note: *"No gas cost. The signature is stored and verified when we execute."*

### [0:55–1:10] Execute Payment

> "With approval threshold met, we can execute."

- Go back to **Inbox** → open the intent
- Show approval count: 1/1 ✓
- Click **"Execute"**
- MetaMask confirms the transaction (this one costs gas)
- Wait for confirmation (~2 seconds on Arbitrum)
- Show the **"Receipt Minted"** toast notification
- Status changes to **Executed** with green check

### [1:10–1:25] Verify Receipt

> "Every payment produces an audit-ready receipt stored onchain."

- Navigate to **Receipts**
- Show the new receipt card with:
  - Vendor name, amount, category
  - Deterministic receipt ID
  - Invoice hash reference
- Click **"Download PDF"** — show the generated PDF
- Click **"Arbiscan"** — show the onchain transaction
- Note: *"The receipt ID is deterministic: keccak256(intentId, invoiceHash, vendor, amount). Fully verifiable."*

### [1:25–1:30] Closing

> "ArbCFO: Invoice to approval to payment to receipt — all on Arbitrum. The agent can propose, but it can never unilaterally execute. That's treasury management with real guardrails."

---

## Fallback Notes

- If MetaMask is slow, have a pre-executed intent ready to show
- If RPC issues, show the Inbox with pre-seeded data
- Receipt PDF generation works offline (server-side)
- All parsing works without any API keys
