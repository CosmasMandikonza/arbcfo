# Security

## Threat Model Lite

ArbCFO is a treasury management system handling real USDC. This document outlines the security model, known risks, and mitigations.

### Trust Model

| Role | Capabilities | Limitations |
|------|-------------|-------------|
| **Admin** | Deploy, configure policies, grant/revoke roles, pause, set thresholds | Cannot bypass approval threshold for payments |
| **Approver** | Sign EIP-712 approvals for payment intents | Cannot create intents or execute payments alone |
| **Operator** | Create payment intents, execute (with sufficient approvals) | Cannot approve own intents, cannot bypass policies |
| **Agent (CLI)** | Propose intent drafts via API | Cannot approve or execute — zero onchain authority |

### Attack Vectors & Mitigations

#### 1. Unauthorized Payment Execution
**Threat:** Attacker attempts to drain vault funds.
**Mitigations:**
- M-of-N approval threshold enforced onchain (not just UI)
- EIP-712 signatures verified with ecrecover
- Nonce tracking prevents signature replay
- ReentrancyGuard on execute function
- PolicyEngine validates every execution

#### 2. Signature Replay
**Threat:** Reusing a valid approval signature for a different intent.
**Mitigations:**
- Signatures include intentId (unique per intent)
- Per-approver nonce tracked in contract
- Domain separator includes chainId + contract address (prevents cross-chain replay)
- Each signature can only be used once per intent

#### 3. Policy Bypass
**Threat:** Operator circumvents spending limits or vendor restrictions.
**Mitigations:**
- All policies enforced in PolicyEngine contract at execution time
- UI policy checks are informational only — contract is the source of truth
- Daily budget resets are computed from block.timestamp
- Emergency pause halts all operations immediately

#### 4. Invoice Hash Collision
**Threat:** Two different invoices produce the same hash.
**Mitigations:**
- keccak256 collision resistance (256-bit)
- Duplicate invoice hash rejection in createIntent
- Hash computed from raw file bytes (PDF) or normalized text

#### 5. Admin Key Compromise
**Threat:** Admin private key is stolen.
**Mitigations:**
- Admin can pause system immediately
- Admin cannot bypass approval requirements for payments
- Recommend using a multisig (Safe) as admin for production
- All role changes emit events (auditable)

#### 6. Front-running
**Threat:** Attacker front-runs an intent execution.
**Mitigations:**
- Intent execution requires valid approval signatures (attacker cannot forge)
- Intent can only be executed once (status check)
- Private mempool (Flashbots Protect) recommended for production

### Smart Contract Security Patterns

- **OpenZeppelin AccessControl**: Role-based permissions
- **OpenZeppelin Pausable**: Emergency stop mechanism
- **OpenZeppelin ReentrancyGuard**: Prevents reentrancy attacks
- **Custom Errors**: Gas-efficient error handling
- **Checks-Effects-Interactions**: State changes before external calls
- **Input Validation**: All parameters validated with custom errors

### Known Limitations

1. **SQLite Database**: Local development only. Production should use PostgreSQL with proper backups.
2. **Event Sync**: Polling-based (not real-time). Events could be missed if server is down during contract interactions.
3. **Single-chain**: Currently supports one Arbitrum chain at a time.
4. **No Timelock**: Admin changes take effect immediately. Consider adding a timelock for production.
5. **Invoice Parsing**: Heuristic parser has limited accuracy. Manual review recommended for all parsed invoices.

### Audit Status

This is a hackathon project and has **not been formally audited**. The contracts follow OpenZeppelin patterns and include comprehensive test coverage, but should not be used with real funds without a professional audit.

### Responsible Disclosure

If you discover a security vulnerability, please report it responsibly:
- Email: security@arbcfo.dev
- Do not open public issues for security vulnerabilities

### Security Checklist

- [x] AccessControl for role-based permissions
- [x] Pausable for emergency stop
- [x] ReentrancyGuard on state-changing functions
- [x] EIP-712 domain separator prevents cross-chain replay
- [x] Per-approver nonce tracking
- [x] Custom errors for gas efficiency
- [x] No hardcoded secrets
- [x] Environment variables for all configuration
- [x] Input validation on all public functions
- [x] Events emitted for all state changes
- [x] Duplicate invoice hash prevention
- [x] Threshold enforcement in contract (not just UI)
- [ ] Formal audit (recommended before mainnet)
- [ ] Multisig admin (recommended for production)
- [ ] Timelock on admin actions (recommended)
- [ ] Rate limiting on API endpoints (recommended)
