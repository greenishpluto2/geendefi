#!/bin/bash

# Cross-Chain Atomic Swaps - Quick Start Script
# This script helps you deploy and test the cross-chain HTLC contracts

set -e

echo "🚀 Cross-Chain Atomic Swaps - Quick Start"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

# Check if sui CLI is installed
if ! command -v sui &> /dev/null; then
    print_error "Sui CLI is not installed. Please install it first:"
    echo "  curl -fLJO https://github.com/MystenLabs/sui/releases/latest/download/sui-macos-x86_64.tgz"
    echo "  tar -xzf sui-macos-x86_64.tgz"
    echo "  sudo mv sui /usr/local/bin/"
    exit 1
fi

# Check if pnpm is installed  
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Installing it now..."
    npm install -g pnpm
fi

# Check Sui configuration
print_step "Checking Sui configuration..."
ACTIVE_ENV=$(sui client active-env 2>/dev/null || echo "none")
if [ "$ACTIVE_ENV" != "testnet" ]; then
    print_warning "Not connected to testnet. Configuring testnet environment..."
    sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
    sui client switch --env testnet
fi

# Check wallet balance
print_step "Checking wallet balance..."
BALANCE=$(sui client balance 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+' | head -1 || echo "0")
if (( $(echo "$BALANCE < 1" | bc -l 2>/dev/null || echo "1") )); then
    print_warning "Low SUI balance ($BALANCE SUI). Please fund your wallet with SUI."
fi

ACTIVE_ADDRESS=$(sui client active-address)
print_success "Wallet configured: $ACTIVE_ADDRESS"

# Step 1: Deploy contracts
print_step "Step 1: Deploying contracts to Sui testnet..."
cd api

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_step "Installing API dependencies..."
    pnpm install
fi

# Deploy contracts
print_step "Deploying HTLC contracts..."
npm run deploy

if [ ! -f "crosschain-htlc-contract.json" ]; then
    print_error "Contract deployment failed!"
    exit 1
fi

PACKAGE_ID=$(jq -r '.packageId' crosschain-htlc-contract.json)
FACTORY_ID=$(jq -r '.factoryId' crosschain-htlc-contract.json)

print_success "Contracts deployed successfully!"
echo "  📦 Package ID: $PACKAGE_ID"
echo "  🏭 Factory ID: $FACTORY_ID"

# Step 2: Update frontend configuration
print_step "Step 2: Updating frontend configuration..."
cd ../frontend

# Check if frontend dependencies are installed
if [ ! -d "node_modules" ]; then
    print_step "Installing frontend dependencies..."
    pnpm install
fi

# Update the network configuration file
print_step "Updating contract addresses in frontend..."
sed -i.bak "s/ESCROW_FACTORY: \"0x0\"/ESCROW_FACTORY: \"$FACTORY_ID\"/" src/constants/network.ts
sed -i.bak "s/PACKAGE_ID: \"0x0\"/PACKAGE_ID: \"$PACKAGE_ID\"/" src/constants/network.ts

print_success "Frontend configuration updated!"

# Step 3: Create demo data
print_step "Step 3: Creating demo escrows..."
cd ../api
npm run create-demo

print_success "Demo escrows created!"

# Step 4: Instructions for testing
echo ""
echo "🎉 Setup Complete! Here's how to test:"
echo "====================================="
echo ""
echo "1. 📱 Start the frontend:"
echo "   cd frontend && pnpm dev"
echo "   Then visit: http://localhost:3002"
echo ""
echo "2. 👁️  Monitor events (in a new terminal):"
echo "   cd api && npm run dev"
echo ""
echo "3. 🧪 Test claiming with these secrets:"
echo "   • demo_secret_1_32_bytes_length!!! (1 SUI)"
echo "   • demo_secret_2_for_testing_swap!! (0.5 SUI)"
echo "   • demo_secret_3_crosschain_htlc!!! (2 SUI)"
echo ""
echo "4. 🔍 Manual contract interaction:"
echo "   sui client objects --owner $ACTIVE_ADDRESS"
echo ""
echo "📋 Contract Information:"
echo "  Package ID: $PACKAGE_ID"
echo "  Factory ID: $FACTORY_ID"
echo "  Network: testnet"
echo ""
echo "🚀 Ready for cross-chain atomic swaps!"

# Ask if user wants to start the frontend
echo ""
read -p "Would you like to start the frontend now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Starting frontend..."
    cd ../frontend
    pnpm dev
fi 