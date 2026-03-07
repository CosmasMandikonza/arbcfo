# ArbCFO

**The permissionless treasury control plane for tokenized assets.**

Policy-enforced, approval-aware, risk-routed execution for stablecoin and tokenized-asset operations across the Arbitrum ecosystem.

Deployed on **Arbitrum Sepolia** and **Robinhood Chain**. 30/30 tests passing.

---

## The Problem

Tokenized assets make value programmable. Treasury controls haven't kept up.

- **Approvals are scattered** — multisigs, Telegram, email, spreadsheets
- **Policy is manual** — budget limits and vendor rules enforced by humans, not contracts
- **Risk is unrouted** — every transaction gets the same treatment, no oracle decisioning
- **Audit trails are fragmented** — no immutable on-chain receipt for executed operations

This gap widens as tokenized equities, stablecoins, and RWAs become liquid and always-on.

## The Solution

ArbCFO turns treasury execution into a programmable on-chain control plane:

```
Create Intent → Collect Approvals → Policy Check → Oracle Decision → Execute or Block → Mint Receipt
```

**Oracle routing outcomes:**
- **SAFE** — auto-proceeds to execution
- **REVIEW** — held for human multisig approval
- **BLOCKED** — rejected by oracle, too risky

Every step is auditable. Every receipt is immutable. Any contract can call `assessRisk()` in one line.

## What's Live Today

| Feature | Status |
|---------|--------|
| AI-assisted intent creation (GPT-4.1) | ✅ Live |
| On-chain oracle risk scoring with Arbiscan proof | ✅ Live |
| EIP-712 approval signature collection | ✅ Live |
| On-chain policy engine enforcement | ✅ Live |
| Immutable execution receipts | ✅ Live |
| Team roles and configurable thresholds | ✅ Live |
| Split attack detection demo | ✅ Live |

## Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend          Next.js · wagmi · viem · EIP-712     │
├─────────────────────────────────────────────────────────┤
│  API Layer         Prisma · Oracle integration · Intents│
├─────────────────────────────────────────────────────────┤
│  Smart Contracts   Vault · Policy · Oracle · Receipt    │
├─────────────────────────────────────────────────────────┤
│  Chains            Arbitrum Sepolia · Robinhood Chain    │
└─────────────────────────────────────────────────────────┘
```

### Smart Contracts

| Contract | Purpose |
|----------|---------|
| **ArbCFOVault** | Treasury vault with intent lifecycle and EIP-712 approvals |
| **PolicyEngine** | Budget limits, vendor allowlists, category rules |
| **CompositeOracle** | Three-signal risk scoring: anomaly detection + identity + correlation |
| **SolidityRiskEngine** | EMA + Mean Absolute Deviation statistical engine |
| **ReceiptRegistry** | Immutable on-chain payment receipts |
| **MockUSDC** | Test ERC-20 for deployment |

### The Oracle — Cross-Asset Correlation Detection

The CompositeOracle combines three signals to score every transaction:

1. **Per-asset anomaly detection** — Exponential Moving Average + Mean Absolute Deviation for every recipient. Flags statistical outliers.
2. **Sender identity verification** — Checks on-chain identity registry. Unverified senders get maximum scrutiny.
3. **Cross-asset correlation** — Tracks aggregate volume to new recipients per epoch. Detects coordinated liquidation patterns invisible to per-transaction scoring.

**Compound risk:** When identity and correlation signals overlap, scores multiply — not just add. An unknown entity executing a coordinated pattern triggers exponential risk escalation.

### Split Attack Demo

Five stock token liquidations. Each individually normal. The oracle catches the coordinated pattern:

```
Payment 1 (TSLA)  → Score 20  → SAFE
Payment 2 (AMZN)  → Score 29  → SAFE
Payment 3 (NFLX)  → Score 41  → REVIEW
Payment 4 (GOOGL) → Score 56  → REVIEW
Payment 5 (NVDA)  → Score 80  → BLOCKED
```

Every assessment is a real transaction on Arbitrum Sepolia with an Arbiscan link.

## Deployments

### Arbitrum Sepolia (Chain 421614)

| Contract | Address |
|----------|---------|
| Vault | `0xF0FE25AD81bc47eF558fBf199009202Da3EA3b71` |
| PolicyEngine | `0x1a11d9417c6AD4E6C3570457Fe883D639127D588` |
| ReceiptRegistry | `0x6Ab0fF295ed542C4e2b778D78324D9a7De52BbD2` |
| RiskEngine | `0xfba39E80a93707536D0D3dd4ab6106F4cc37F8de` |
| CompositeOracle | `0xf5c9Cb7522f208e3cd4E3c483D463b992a800bD9` |
| MockUSDC | `0x7b94Fa0968ab87d517dC0Bf20c1951a977C7017d` |

### Robinhood Chain Testnet (Chain 46630)

| Contract | Address |
|----------|---------|
| Vault | `0xd19118A75713C62825906D10912209316dFd73D9` |
| PolicyEngine | `0xb9946CC7A2AeEccc490fB982811938A224463b25` |
| ReceiptRegistry | `0x95F167a3211f1AAae668DCF52733478C0ba2d3c4` |
| RiskEngine | `0xc1533f0E064a16aa523b7ef0bF8132f492d53fE1` |
| CompositeOracle | `0x8F93a6B7894224a60097Ee6D77506c0f96411d0f` |
| MockUSDC | `0x08fAAbc19f5303efcDA34ECF16d8a1347A2c4488` |

## Why Arbitrum

- Payments, stablecoins, and RWAs are stated ecosystem priorities
- ATM Council manages hundreds of millions in ARB — needs per-transaction risk scoring
- Stylus enables Rust-native statistical computation
- Not chain-agnostic — Arbitrum-native treasury infrastructure

## Why Robinhood Chain

- ~2,000 tokenized stocks and ETFs on Arbitrum, $55M+ cumulative mint volume
- Robinhood Chain mainnet planned for 2026
- Tokenized equities need operational controls: approval routing, risk scoring, audit trails
- ArbCFO is the treasury/risk infrastructure layer for that world

## Tests

```bash
cd contracts
forge test
# 30/30 passing
```

## Quick Start

```bash
pnpm install

# Dashboard
cd apps/web
npx prisma db push
pnpm dev

# Contracts
cd contracts
forge build
forge test
```

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, wagmi, viem
- **Smart Contracts:** Solidity 0.8.24, OpenZeppelin, Foundry
- **Risk Engine:** Rust, Arbitrum Stylus SDK, WASM
- **AI Parsing:** GPT-4.1, structured output
- **Database:** Prisma + SQLite
- **Chains:** Arbitrum Sepolia, Robinhood Chain Testnet

## Roadmap

- **Now:** Live MVP on Arbitrum Sepolia + Robinhood Chain
- **Q2 2026:** Production oracle hardening, richer policy templates
- **Q3 2026:** Arbitrum One mainnet, tokenized-asset specific controls
- **Q4 2026:** Reporting/audit export, cross-chain aggregation

## License

MIT
