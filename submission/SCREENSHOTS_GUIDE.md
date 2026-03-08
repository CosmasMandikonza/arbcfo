# ArbCFO — Screenshots Guide

Capture these screenshots for the hackathon submission. Each should be 1920×1080 (or 2x retina).

## Required Screenshots

### 1. Inbox Overview (`screenshot-01-inbox.png`)
- **Page:** `/inbox`
- **What to show:** 4-5 intents in different statuses (Awaiting, Executed, Rejected)
- **Wallet:** Connected, on Arbitrum Sepolia
- **Tips:** Make sure at least one intent has the "Awaiting Approvals" pulse animation visible

### 2. Intent Detail Drawer (`screenshot-02-intent-detail.png`)
- **Page:** `/inbox` with detail panel open
- **What to show:** Click on an "Awaiting Approvals" intent
- **Highlights:**
  - Workflow Timeline showing current step
  - Policy check results (green checks)
  - Approval lane (1 of 2 signed)
  - Execute button visible (but maybe not yet enabled)

### 3. Create Intent — Parse (`screenshot-03-create-intent.png`)
- **Page:** `/inbox` with create form open
- **What to show:** "Paste Text" tab selected
- **Content:** Paste a sample invoice with the parsed fields auto-filled below
- **Highlights:** Invoice hash shown, confidence indicator

### 4. EIP-712 Approval (`screenshot-04-approval.png`)
- **Page:** `/approvals`
- **What to show:** MetaMask popup showing the EIP-712 typed data
- **Highlights:**
  - "ApproveIntent" type visible
  - intentId, approver address, nonce fields
  - Show this is a signature, not a transaction (no gas)

### 5. Vault / Treasury (`screenshot-05-vault.png`)
- **Page:** `/vault`
- **What to show:** Balance cards + deposit form
- **Highlights:** Vault USDC balance, wallet balance, deposit amount input

### 6. Receipt Vault (`screenshot-06-receipts.png`)
- **Page:** `/receipts`
- **What to show:** 3-4 receipts in the grid
- **Highlights:** Receipt IDs, category badges, Arbiscan links, Download PDF buttons

### 7. Policy Engine (`screenshot-07-policies.png`)
- **Page:** `/policies`
- **What to show:** All policy cards
- **Highlights:** Emergency pause status, max per invoice, category budgets, vendor allowlist toggle

### 8. Receipt PDF (`screenshot-08-receipt-pdf.png`)
- **What to show:** A downloaded receipt PDF
- **Highlights:** Invoice hash, receipt ID, vendor, amount, tx hash, Arbiscan link

### 9. CLI Agent (`screenshot-09-cli.png`)
- **What to show:** Terminal with `arb-cfo intake` and `arb-cfo propose` commands
- **Highlights:** Parsed invoice output, "⚠ This intent requires approvals" warning

### 10. Contract on Arbiscan (`screenshot-10-arbiscan.png`)
- **What to show:** Verified ArbCFOVault contract on Arbiscan Sepolia
- **Highlights:** Verified source code badge, contract functions, events

## Optional Screenshots

### 11. Settings Page (`screenshot-11-settings.png`)
- Team members with roles, approval threshold

### 12. Mobile View (`screenshot-12-mobile.png`)
- Inbox on a narrow viewport (if responsive)

## Screenshot Tips

- Use Chrome DevTools → More Tools → Screenshot (or Cmd+Shift+P → "screenshot")
- Set viewport to 1920×1080 for consistency
- Use a clean wallet with readable addresses
- Have seed data that looks realistic (real-sounding vendor names, reasonable amounts)
- Dark mode MetaMask contrasts nicely with ArbCFO's light theme
