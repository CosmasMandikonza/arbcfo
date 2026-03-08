New-Item -ItemType Directory -Force -Path .\docs | Out-Null

@"
# ArbCFO Hackathon Timeline

## 2026-02-22
- ArbCFO build window started.
- Core thesis set: treasury execution should be policy-enforced, risk-routed, approval-aware, and auditable.

## 2026-02-23 to 2026-02-25
- Structured contract architecture around treasury execution lifecycle.
- Defined payment intent model, policy enforcement layer, and receipt / audit requirements.
- Shaped ArbCFO as infrastructure for stablecoin and tokenized-asset treasury operations.

## 2026-02-26 to 2026-02-28
- Implemented contract system for:
  - payment intents
  - approvals
  - policy checks
  - immutable receipt registry
- Refined product direction toward a permissionless treasury control plane.

## 2026-03-01 to 2026-03-05
- Integrated web app flows for inbox, approvals, oracle, policies, receipts, and treasury views.
- Connected frontend state to live contract-backed workflow.
- Tightened the end-to-end story from intake -> risk -> approval -> execution -> receipt.

## 2026-03-06 to 2026-03-07
- Heavy hackathon push on live product readiness.
- Fixed deployment blockers and frontend build issues.
- Polished approval signing flow and intent detail states.
- Verified the working experience across:
  - payables inbox
  - review and approvals
  - oracle / risk views
  - treasury vault
  - receipts
- Focus shifted from more features to a judge-ready demo path.

## 2026-03-08
- Foundry test suite passing: 30 / 30.
- Deployed contracts on Robinhood Chain testnet.
- Deployed contracts on Arbitrum Sepolia.
- Live MVP available through the web app.
- Product positioned for both:
  - Arbitrum Open House judging
  - Robinhood Chain-specific prizes

## Current Product State
ArbCFO is a permissionless treasury control plane for stablecoin and tokenized-asset operations.

### Live workflow
1. Create payment intent
2. Enforce onchain policy
3. Route via transaction risk oracle
4. Collect EIP-712 review signatures
5. Produce immutable receipt
"@ | Set-Content -Path .\docs\HACKATHON_TIMELINE.md

@"
# ArbCFO Deployment Manifest

## Live App
- MVP: https://arbcfo.vercel.app

## Arbitrum Sepolia
- Chain ID: 421614
- Vault: 0xF0FE25AD81bc47eF558fBf199009202Da3EA3b71
- PolicyEngine: 0x1a11d9417c6AD4E6C3570457Fe883D639127D588
- ReceiptRegistry: 0x6Ab0fF295ed542C4e2b778D78324D9a7De52BbD2
- SolidityRiskEngine: 0xfba39E80a93707536D0D3dd4ab6106F4cc37F8de
- AgentRiskOracle: 0xf5c9Cb7522f208e3cd4E3c483D463b992a800bD9
- MockUSDC: 0x7b94Fa0968ab87d517dC0Bf20c1951a977C7017d

## Robinhood Chain Testnet
- Chain ID: 46630
- Vault: 0xd19118A75713C62825906D10912209316dFd73D9
- PolicyEngine: 0xb9946CC7A2AeEccc490fB982811938A224463b25
- ReceiptRegistry: 0x95F167a3211f1AAae668DCF52733478C0ba2d3c4
- SolidityRiskEngine: 0xc1533f0E064a16aa523b7ef0bF8132f492d53fE1
- AgentRiskOracle: 0x8F93a6B7894224a60097Ee6D77506c0f96411d0f
- MockUSDC: 0x08fAAbc19f5303efcDA34ECF16d8a1347A2c4488
"@ | Set-Content -Path .\docs\DEPLOYMENTS.md

@"
# ArbCFO Demo Flow

1. Landing page
2. Inbox
3. Intent detail with oracle routing
4. Approvals signing
5. Receipt / audit trail

Key line:
This is not just a multisig and not just a dashboard. ArbCFO is the control plane that decides what should happen before money moves.
"@ | Set-Content -Path .\docs\DEMO_FLOW.md

@"
# Test Status

- Foundry suites passing: 30 / 30
- Covers oracle behavior, approvals, policy enforcement, receipts, and treasury lifecycle
"@ | Set-Content -Path .\docs\TEST_STATUS.md
