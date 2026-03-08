# ArbCFO

**AI-Powered Invoice → Risk Scoring → Approval → USDC Payment → Audit-Ready Receipt** on Arbitrum.

ArbCFO is an institutional-grade treasury operations layer built on Arbitrum. It replaces spreadsheet-based AP processes with a system where an **AI agent** parses invoices, a **Stylus WASM contract** performs real-time statistical anomaly detection, multi-signature approval gates every payment, and immutable receipts are minted onchain.

**What makes ArbCFO different:** We use **Arbitrum Stylus** (Rust → WASM) to run statistical math (EMA, variance, Z-score) *inside* a smart contract at 10-100x lower gas cost than Solidity, enabling per-transaction risk scoring that would be prohibitively expensive on the EVM.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           ArbCFO System                              │
│                                                                      │
│  ┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐  │
│  │  AI Agent     │──▶│  ArbCFOVault     │──▶│  Stylus RiskEngine  │  │
│  │  (LangChain   │   │  (Solidity/EVM)  │   │  (Rust/WASM)        │  │
│  │   + GPT-4o)   │   │                  │   │                     │  │
│  │              │   │  createIntent()  │   │  evaluateRisk()     │  │
│  │  Invoice ──▶  │   │  executeIntent() │   │    │                │  │
│  │  Extraction  │   │       │          │   │    ▼                │  │
│  │  + Validation│   │       ▼          │   │  EMA + Variance     │  │
│  └──────────────┘   │  if (!isSafe):   │   │  Z-score (>3σ)      │  │
│                      │    HOLD for      │◀──│  fixed-point U256   │  │
│                      │    multisig      │   │  ~10k gas           │  │
│                      │  else:           │   │  (vs ~200k EVM)     │  │
│  ┌──────────────┐   │    execute +     │   └─────────────────────┘  │
│  │  Next.js App  │   │    mint receipt  │                            │
│  │  (Dashboard)  │──▶│       │          │   ┌─────────────────────┐  │
│  │              │   │       ▼          │──▶│  PolicyEngine        │  │
│  │  Approvals   │   │  PolicyEngine   │   │  (Solidity)          │  │
│  │  Receipts    │   │  check + record  │   │  Budget limits       │  │
│  │  Risk Scores │   │       │          │   │  Token allowlists    │  │
│  └──────────────┘   │       ▼          │   └─────────────────────┘  │
│                      │  ReceiptRegistry│   ┌─────────────────────┐  │
│                      │  mint onchain   │──▶│  ReceiptRegistry     │  │
│                      │  audit receipt  │   │  (Solidity)          │  │
│                      └──────────────────┘   └─────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
arbcfo/
├── apps/
│   ├── web/                    # Next.js 14 dashboard
│   │   ├── app/                # App router pages
│   │   ├── components/         # React components
│   │   ├── prisma/             # Database schema + seeds
│   │   └── lib/                # Utilities
│   └── agent/                  # AI-powered CLI agent
│       └── src/
│           ├── cli.ts          # CLI commands (intake, propose, ai-intake)
│           └── agent.ts        # LangChain + Viem agent core
│
├── contracts/
│   ├── src/                    # Solidity contracts
│   │   ├── ArbCFOVault.sol     # Treasury vault with risk engine integration
│   │   ├── PolicyEngine.sol    # Onchain spending policies
│   │   ├── ReceiptRegistry.sol # Immutable audit receipts
│   │   ├── IRiskEngine.sol     # Solidity interface for Stylus contract
│   │   ├── IArbCFOTypes.sol    # Shared types, events, errors
│   │   └── MockUSDC.sol        # Test token
│   ├── test/                   # Foundry tests
│   ├── script/                 # Deployment scripts
│   └── stylus/                 # Arbitrum Stylus (Rust → WASM)
│       ├── Cargo.toml          # Rust dependencies
│       └── src/
│           ├── lib.rs          # RiskEngine: EMA + variance + Z-score
│           └── main.rs         # ABI export entry point
│
├── packages/shared/            # Shared TypeScript types
├── submission/                 # Hackathon submission materials
├── package.json
├── pnpm-workspace.yaml
├── DEPLOYMENT.md
└── SECURITY.md
```

## Key Innovation: Stylus Risk Engine

### The Problem
DAOs manage $25B+ in treasuries but use basic multisigs with no automated risk detection. A compromised signer can drain a vault before anyone notices.

### The Solution
ArbCFO's risk engine runs **Exponential Moving Average (EMA)** and **Z-score analysis** on every vendor payment — *inside a smart contract*. This was previously impossible because:

- **In Solidity**: The math (sqrt, fixed-point multiplication, variance tracking) costs ~200k+ gas per call
- **On Stylus (WASM)**: The same math costs ~10k gas. Sub-cent per transaction. Now we can risk-score *every single payment*

### How It Works

```
Payment: $5,000 to Acme Cloud (historical average: $1,500)

1. EMA (Exponential Moving Average) = $1,620 (slowly adapts to trends)
2. Variance = tracks how spread out payments are
3. Z-score = |$5,000 - $1,620| / √(Variance) = 4.2σ

4.2σ > 3.0σ threshold → ANOMALY DETECTED
→ Payment held for multisig review (not reverted!)
→ Admin can override after manual verification
```

### Fixed-Point Math (No Floats in WASM)

WASM requires deterministic execution — no floating-point. All math uses U256 with 18 implicit decimals:

| Real Value | Fixed-Point (18 decimals) |
|-----------|--------------------------|
| 0.1 (α) | 100,000,000,000,000,000 |
| 3.0 (Z threshold) | 3,000,000,000,000,000,000 |
| √(x) | Newton's method, ≤128 iterations |

## AI Agent (LangChain + GPT-4o)

The agent uses GPT-4o structured output to parse any invoice format:

```bash
# Parse any invoice — email, PDF text, freeform text
pnpm agent:ai "INVOICE #847 From: Acme LLC Wallet: 0xd8dA... Total: $1,650.50"

# Parse + submit to Arbitrum Sepolia
OPENAI_API_KEY=sk-... pnpm agent:submit invoice.txt

# Legacy regex parser still available
pnpm agent dev intake invoice.txt
```

**Safety guardrails:** Zod schema enforcement, address checksum validation, $10M sanity ceiling, confidence scoring, exponential backoff retry for Arbitrum Timeboost/RPC delays.

## Quick Start

```bash
# Install
pnpm install

# Dashboard
pnpm dev
pnpm db:push && pnpm db:seed

# Tests
pnpm contracts:test    # Solidity (Foundry)
pnpm stylus:test       # Rust (Cargo)

# Deploy
pnpm contracts:deploy:sepolia
pnpm stylus:deploy --private-key-path=/tmp/key.txt
```

## Smart Contracts (Arbitrum Sepolia)

| Contract | Role | Language |
|----------|------|----------|
| ArbCFOVault | Treasury vault, intent lifecycle, risk integration | Solidity |
| PolicyEngine | Budget limits, token/vendor allowlists | Solidity |
| ReceiptRegistry | Immutable payment receipts | Solidity |
| **RiskEngine** | **EMA + Z-score anomaly detection** | **Rust (Stylus/WASM)** |
| MockUSDC | Test ERC-20 token | Solidity |

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Prisma + SQLite
- **Smart Contracts**: Solidity 0.8.24, OpenZeppelin, Foundry
- **Risk Engine**: Rust, Arbitrum Stylus SDK 0.8.4, WASM
- **AI Agent**: LangChain, GPT-4o, Zod, Viem
- **Chain**: Arbitrum Sepolia (421614)

## Security

- M-of-N multi-approval with EIP-712 typed signatures
- ReentrancyGuard + Pausable emergency stops
- Onchain policy enforcement (budget limits, allowlists)
- Statistical anomaly detection (Z-score > 3σ)
- Duplicate invoice prevention (hash-based dedup)
- AI validation guardrails (checksum, amount ceiling, confidence)

## License

MIT
