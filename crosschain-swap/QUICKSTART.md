# 🚀 Cross-Chain Atomic Swaps - Quick Start

Get up and running with cross-chain atomic swaps in under 5 minutes!

## ⚡ One-Command Setup

```bash
cd crosschain-swap
./start.sh
```

This script will:
- ✅ Check prerequisites (Sui CLI, pnpm)
- ✅ Configure testnet environment
- ✅ Deploy HTLC contracts
- ✅ Update frontend configuration
- ✅ Create demo escrows for testing
- ✅ Provide testing instructions

## 📋 Manual Setup (if needed)

### 1. Prerequisites

```bash
# Install Sui CLI (macOS)
curl -fLJO https://github.com/MystenLabs/sui/releases/latest/download/sui-macos-x86_64.tgz
tar -xzf sui-macos-x86_64.tgz
sudo mv sui /usr/local/bin/

# Configure testnet
sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client switch --env testnet

# Get testnet SUI
sui client faucet
```

### 2. Deploy Contracts

```bash
cd api
pnpm install
npm run deploy
```

### 3. Update Frontend

```bash
cd ../frontend
pnpm install

# Update src/constants/network.ts with deployed contract addresses
```

### 4. Create Demo Data

```bash
cd ../api
npm run create-demo
```

## 🧪 Testing

### Start Frontend
```bash
cd frontend
pnpm dev
# Visit http://localhost:3002
```

### Monitor Events
```bash
cd api
npm run dev
# Watch for real-time HTLC events
```

### Demo Secrets for Testing
- `demo_secret_1_32_bytes_length!!!` (1 SUI)
- `demo_secret_2_for_testing_swap!!` (0.5 SUI)  
- `demo_secret_3_crosschain_htlc!!!` (2 SUI)

## 🎯 Key Features Demonstrated

- **✅ Hash Time-Locked Contracts**: Trustless cross-chain swaps
- **✅ Keccak256 Compatibility**: Works with Ethereum contracts
- **✅ Event Monitoring**: Real-time PreimageRevealed events for relayers
- **✅ Timeout Protection**: Automatic refunds if swaps aren't completed
- **✅ Factory Pattern**: Efficient escrow management

## 🔄 Atomic Swap Flow

1. **Alice** creates escrow on Sui with secret hash
2. **Bob** creates matching escrow on Ethereum  
3. **Alice** reveals secret to claim Bob's ETH
4. **Bob** uses revealed secret to claim Alice's SUI
5. **✅ Both parties get desired assets atomically**

## 📊 What You'll See

### Contract Deployment
```
🚀 Starting Cross-Chain HTLC Contract Deployment
📦 Package ID: 0xabc123...
🏭 Factory ID: 0x789def...
✅ Deployment successful!
```

### Event Monitoring
```
📡 EscrowCreated Event
   📦 Escrow ID: 0x111...
   🔒 Hash: a1b2c3d4...
   🎯 Action: Ready for Ethereum-side matching

📡 PreimageRevealed Event
   🔓 SECRET REVEALED! 🔓
   🔐 Secret: "demo_secret_1..."
   🚀 Action: Relayer should claim on Ethereum!
```

## 🛠️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sui Network   │    │    Event        │    │ Ethereum Network│
│                 │    │   Monitor       │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ HTLC Escrow │ │◄──►│ │PreimageRevealed│◄──►│ │1inch Solidity│ │
│ │  Factory    │ │    │ │   Events    │ │    │ │HTLC Contract│ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Available Commands

### API (Deployment & Backend)
```bash
cd api
npm run deploy      # Deploy contracts
npm run create-demo # Create test escrows  
npm run dev         # Monitor events
npm run test-flow   # Full deployment + demo
```

### Frontend (User Interface)
```bash
cd frontend
pnpm dev           # Start development server
pnpm build         # Build for production
```

## 🔍 Troubleshooting

### "No SUI coins found"
```bash
sui client faucet
```

### "Package ID not found"  
```bash
cd api && npm run deploy
```

### "Events not appearing"
```bash
sui client active-env  # Should show "testnet"
```

### Check Contract State
```bash
sui client objects --owner $(sui client active-address)
sui client object ESCROW_OBJECT_ID
```

## 🚀 Next Steps

1. **✅ Test the Demo**: Use provided secrets to claim escrows
2. **🔗 Add Ethereum**: Deploy matching Solidity HTLCs  
3. **🤖 Build Relayer**: Automate cross-chain claiming
4. **🌐 Production**: Deploy to mainnet with security audit

## 📞 Support

- **📖 Full Docs**: See [README.md](README.md) and [TESTING.md](TESTING.md)
- **🔧 Troubleshooting**: Check API and frontend READMEs
- **💻 Source Code**: Review contracts in `contracts/crosschain_htlc/`

**🎉 You're ready to build trustless cross-chain atomic swaps!** 