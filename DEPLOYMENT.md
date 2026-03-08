# Deployment Guide

## Prerequisites

- Node.js 18+ and pnpm 8+
- Foundry installed (`foundryup`)
- A deployer wallet with ETH on Arbitrum Sepolia (or Arbitrum One for mainnet)
- (Optional) Alchemy API key for reliable RPC
- (Optional) Arbiscan API key for contract verification

## Step 1: Environment Configuration

```bash
cp .env.example .env
```

Required variables for deployment:
```env
DEPLOYER_PRIVATE_KEY=0x...          # Your deployer wallet private key
NEXT_PUBLIC_USDC_ADDRESS=0x...      # USDC token address on target chain
```

Optional:
```env
ALCHEMY_API_KEY=...                 # For reliable RPC (falls back to public)
ETHERSCAN_API_KEY=...               # For Arbiscan verification
```

## Step 2: Deploy Contracts

### Arbitrum Sepolia (Testnet)

```bash
pnpm contracts:deploy:sepolia
```

This runs `forge script` with the Deploy.s.sol script, which:
1. Deploys PolicyEngine
2. Deploys ReceiptRegistry
3. Deploys ArbCFOVault (linking PolicyEngine + ReceiptRegistry)
4. Grants VAULT_ROLE on ReceiptRegistry to the Vault
5. Configures default policies (USDC allowlist, default category budget)
6. Optionally deploys MockUSDC (if `DEPLOY_MOCK_USDC=true`)

**Record the deployed addresses** from the console output.

### Arbitrum One (Mainnet)

```bash
pnpm contracts:deploy:arbone
```

⚠️ **Use a fresh deployer address with minimal funds. Consider using a Safe multisig as the admin.**

## Step 3: Update Environment

After deployment, update `.env` with the deployed addresses:

```env
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_POLICY_ENGINE_ADDRESS=0x...
NEXT_PUBLIC_RECEIPT_REGISTRY_ADDRESS=0x...
```

## Step 4: Verify Contracts

```bash
cd contracts

# Verify PolicyEngine
forge verify-contract <POLICY_ENGINE_ADDRESS> \
  src/PolicyEngine.sol:PolicyEngine \
  --chain-id 421614 \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Verify ReceiptRegistry
forge verify-contract <RECEIPT_REGISTRY_ADDRESS> \
  src/ReceiptRegistry.sol:ReceiptRegistry \
  --chain-id 421614 \
  --etherscan-api-key $ETHERSCAN_API_KEY

# Verify ArbCFOVault (has constructor args)
forge verify-contract <VAULT_ADDRESS> \
  src/ArbCFOVault.sol:ArbCFOVault \
  --chain-id 421614 \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode \
    "constructor(address,address,address,uint256)" \
    $USDC_ADDRESS \
    $POLICY_ENGINE_ADDRESS \
    $RECEIPT_REGISTRY_ADDRESS \
    2)
```

## Step 5: Initial Configuration

After deployment, configure the system via the Policies page or directly:

### Set Approval Threshold
```bash
cast send $VAULT_ADDRESS "setApprovalThreshold(uint256)" 2 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

### Grant Roles
```bash
# Grant APPROVER_ROLE
APPROVER_ROLE=$(cast keccak "APPROVER_ROLE")
cast send $VAULT_ADDRESS "grantRole(bytes32,address)" $APPROVER_ROLE $APPROVER_ADDRESS \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc

# Grant OPERATOR_ROLE
OPERATOR_ROLE=$(cast keccak "OPERATOR_ROLE")
cast send $VAULT_ADDRESS "grantRole(bytes32,address)" $OPERATOR_ROLE $OPERATOR_ADDRESS \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

### Configure Policies
```bash
# Set max per invoice ($100,000 USDC)
cast send $POLICY_ENGINE_ADDRESS "setMaxPerInvoice(uint256)" 100000000000 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc

# Set daily budget for category 0 ($50,000 USDC)
cast send $POLICY_ENGINE_ADDRESS "setCategoryBudget(uint256,uint256)" 0 50000000000 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

## Step 6: Deploy Frontend

### Vercel (Recommended)

1. Push repo to GitHub
2. Import in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Self-hosted

```bash
pnpm build
pnpm start
```

## Step 7: Fund the Vault

1. Open the app → navigate to Vault
2. Approve USDC spending for the vault contract
3. Deposit USDC into the vault

Or via CLI:
```bash
# Approve USDC
cast send $USDC_ADDRESS "approve(address,uint256)" $VAULT_ADDRESS 1000000000000 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc

# Deposit
cast send $VAULT_ADDRESS "deposit(uint256)" 1000000000000 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

## Getting Testnet Tokens

- **Arbitrum Sepolia ETH**: Use the [Arbitrum Bridge](https://bridge.arbitrum.io/) from Sepolia ETH
- **Test USDC**: Deploy MockUSDC with `DEPLOY_MOCK_USDC=true` or use a faucet

## Troubleshooting

| Issue | Solution |
|-------|---------|
| `EvmError: OutOfFund` | Deployer needs more ETH for gas |
| `AccessControl: account missing role` | Grant the correct role first |
| Verification fails | Check constructor args match exactly |
| RPC timeout | Set `ALCHEMY_API_KEY` for reliable RPC |
| USDC address wrong | Verify token address on Arbiscan |
