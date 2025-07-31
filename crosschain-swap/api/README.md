# Cross-Chain HTLC Deployment & Testing Tools

This directory contains deployment scripts and utilities for testing the cross-chain atomic swap contracts.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Deploy contracts to Sui testnet
npm run deploy

# Create demo escrows for testing
npm run create-demo

# Monitor events in real-time
npm run dev

# Run full test flow
npm run test-flow
```

## 📁 Directory Structure

```
api/
├── scripts/
│   ├── deploy-contracts.ts    # Contract deployment
│   ├── create-demo-swaps.ts   # Demo data creation
│   └── event-monitor.ts       # Real-time event monitoring
├── utils/
│   └── sui-utils.ts          # Sui blockchain utilities
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## 🛠️ Available Scripts

### `npm run deploy`
Deploys the cross-chain HTLC contracts to Sui and saves configuration.

**Output:**
- `crosschain-htlc-contract.json` - Contract addresses and metadata

### `npm run create-demo`
Creates test escrows with known secrets for testing claims.

**Creates:**
- 3 demo escrows with different amounts
- Known secrets for testing claims
- Various timeout periods

### `npm run dev`
Starts the event monitor to watch for HTLC events in real-time.

**Monitors:**
- `EscrowCreated` - New atomic swaps
- `PreimageRevealed` - Secret reveals (for relayers)
- `EscrowRefunded` - Timeout refunds

### `npm run test-flow`
Runs the complete deployment and demo creation flow.

## 🔧 Configuration

### Environment Variables

Create a `.env` file to customize settings:

```bash
# Network selection
NETWORK=testnet  # testnet | mainnet | devnet | localnet

# Optional: Custom RPC endpoint
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
```

### Contract Configuration

After deployment, the configuration is saved to `crosschain-htlc-contract.json`:

```json
{
  "packageId": "0xabc123...",
  "factoryId": "0x789def...",
  "network": "testnet",
  "deployedAt": 1704067200000,
  "deployer": "0x1234...",
  "digest": "ABC123..."
}
```

## 🧪 Testing Workflow

### 1. Prerequisites

Ensure you have:
- Sui CLI installed and configured
- Active wallet with testnet SUI
- Node.js 18+ and pnpm

```bash
# Check Sui CLI
sui --version

# Check wallet
sui client active-address
sui client balance

# Get testnet SUI if needed
sui client faucet
```

### 2. Deploy Contracts

```bash
npm run deploy
```

This will:
- Build and publish the Move contracts
- Create a shared `EscrowFactory` object
- Save contract addresses to JSON file
- Display next steps for frontend integration

### 3. Create Test Data

```bash
npm run create-demo
```

This creates escrows with these secrets:
- `demo_secret_1_32_bytes_length!!!` (1 SUI)
- `demo_secret_2_for_testing_swap!!` (0.5 SUI)
- `demo_secret_3_crosschain_htlc!!!` (2 SUI)

### 4. Monitor Activity

```bash
npm run dev
```

Watch for events and use the frontend or CLI to claim escrows.

## 🔍 Event Types

### EscrowCreated
Emitted when a new atomic swap is created.

```typescript
{
  escrow_id: string,
  creator: string,
  hashlock: number[],
  eth_receiver: number[],
  amount: number,
  deadline: number
}
```

### PreimageRevealed
🚨 **Critical for relayers** - Contains the secret to claim on Ethereum.

```typescript
{
  escrow_id: string,
  preimage: number[],
  claimer: string,
  amount: number
}
```

### EscrowRefunded
Emitted when an escrow times out and is refunded.

```typescript
{
  escrow_id: string,
  creator: string,
  amount: number
}
```

## 🔄 Cross-Chain Integration

### For Relayers

When `PreimageRevealed` is emitted:

1. **Extract the secret** from the `preimage` field
2. **Use the secret** to claim the corresponding HTLC on Ethereum
3. **Complete the atomic swap** - both parties get their desired assets

### For 1inch Integration

The events and data structures are designed to be compatible with 1inch's cross-chain infrastructure:

- Same hash function (keccak256)
- Compatible event structure
- Ethereum address format in events
- Standardized timelock patterns

## 🛡️ Security Considerations

### For Production Deployment

1. **Audit Contracts**: Have Move contracts audited
2. **Test Thoroughly**: Run extensive testnet testing
3. **Monitor Events**: Set up persistent event monitoring
4. **Backup Keys**: Secure deployment key management
5. **Gradual Rollout**: Start with small amounts

### For Development

- Use testnet for all development
- Never use real secrets in demo scripts
- Monitor gas usage and optimize
- Test edge cases (timeouts, invalid secrets)

## 📊 Monitoring & Analytics

### Key Metrics to Track

- **Escrow Creation Rate**: New atomic swaps per hour
- **Claim Success Rate**: Percentage of successful claims
- **Timeout Rate**: Percentage of escrows that expire
- **Average Lock Time**: Time from creation to claim
- **Cross-Chain Latency**: Time for relayer operations

### Useful Queries

```bash
# Check all objects owned by your address
sui client objects --owner $(sui client active-address)

# View specific escrow details
sui client object ESCROW_OBJECT_ID

# Query events by package
sui client events --package PACKAGE_ID

# Check factory state
sui client object FACTORY_ID
```

## 🔧 Troubleshooting

### Common Issues

1. **Contract deployment fails**:
   ```bash
   # Check balance
   sui client balance
   
   # Get more SUI
   sui client faucet
   
   # Try with higher gas budget
   ```

2. **Demo creation fails**:
   ```bash
   # Ensure contracts are deployed
   ls -la *.json
   
   # Check factory ID in config
   cat crosschain-htlc-contract.json
   ```

3. **Events not appearing**:
   ```bash
   # Check network
   sui client active-env
   
   # Verify package ID
   sui client object PACKAGE_ID
   ```

### Debug Commands

```bash
# View transaction details
sui client tx-block DIGEST

# Check object ownership
sui client object OBJECT_ID

# View all addresses
sui client addresses

# Switch network
sui client switch --env testnet
```

## 🚀 Next Steps

After successful testing:

1. **Frontend Integration**: Update frontend with deployed contract addresses
2. **Ethereum Contracts**: Deploy compatible Solidity HTLCs
3. **Relayer Service**: Build automated cross-chain relaying
4. **Production Deployment**: Deploy to mainnet with security audit
5. **Monitoring Infrastructure**: Set up production event indexing

## 📞 Support

For issues or questions:
- Check the main [TESTING.md](../TESTING.md) guide
- Review contract code in `../contracts/crosschain_htlc/`
- Test with frontend at `../frontend/`

This deployment toolkit provides everything needed to test and validate the cross-chain atomic swap implementation! 