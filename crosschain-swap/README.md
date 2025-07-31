# Cross-Chain Atomic Swaps

A trustless cross-chain atomic swap implementation between Sui and Ethereum, compatible with 1inch's HTLC infrastructure.

## 🎯 Overview

This system enables atomic swaps between Sui and Ethereum using Hash Time-Locked Contracts (HTLCs). It's designed to be compatible with 1inch's cross-chain swap architecture and supports both **SUI coins** and **any object type** (NFTs, game items, etc.).

### Key Features

- **Trustless**: No intermediaries required
- **Cross-chain Compatible**: Uses keccak256 for Ethereum compatibility
- **Generic Asset Support**: Works with SUI coins AND any object type (NFTs, game items, etc.)
- **Time-locked Security**: Automatic refunds if swaps aren't completed
- **Event-driven**: Relayers watch for secret reveals to complete swaps
- **1inch Compatible**: Same hash functions and patterns as 1inch Solidity contracts

## 🎨 Asset Type Support

### SUI Coins
- ✅ **Factory-managed**: Uses `EscrowFactory` with vault for efficient coin management
- ✅ **Entry functions**: Direct wallet integration with `setup_escrow()`, `claim_escrow()`, `refund_escrow()`
- ✅ **Gas-optimized**: Bulk coin management in factory vault

### Generic Objects (NFTs, Game Items, etc.)
- ✅ **Dynamic Object Fields**: Uses DOF to store any object type with `key + store` abilities
- ✅ **Type-safe**: Full generic support with `ObjectEscrow<T>`
- ✅ **Flexible**: Works with NFTs, game items, digital collectibles, etc.
- ✅ **Direct transfer**: Objects returned directly to claimer

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sui Network   │    │    Relayer      │    │ Ethereum Network│
│                 │    │   Infrastructure│    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │SUI Escrows  │ │◄──►│ │Event Monitor│ │◄──►│ │1inch Solidity│ │
│ │NFT Escrows  │ │    │ │   & Relay   │ │    │ │HTLC Contract│ │
│ │Object Escrows│ │    │ └─────────────┘ │    │ └─────────────┘ │
│ └─────────────┘ │    └─────────────────┘    └─────────────────┘
└─────────────────┘                           
```

## 📁 Project Structure

```
crosschain-swap/
├── contracts/          # Sui Move contracts
│   └── crosschain_htlc/
│       ├── sources/
│       │   └── escrow.move     # Generic HTLC implementation
│       └── tests/
├── frontend/           # React TypeScript UI
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── constants/
│   └── package.json
├── api/               # Backend & Deployment Tools
│   ├── scripts/       # Deployment & demo scripts
│   └── utils/         # Sui utilities
└── README.md
```

## 🚀 Quick Start

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

## 📋 Smart Contract API

### For SUI Coins

#### Setup SUI Escrow
```move
public entry fun setup_escrow(
    factory: &mut EscrowFactory,
    coin: Coin<SUI>,
    amount: u64,
    hashlock: vector<u8>,      // 32 bytes keccak256 hash
    eth_receiver: vector<u8>,  // 20 bytes ETH address  
    deadline: u64,             // Unix timestamp (ms)
    clock: &Clock,
    ctx: &mut TxContext
)
```

#### Claim SUI Escrow
```move
public entry fun claim_escrow(
    factory: &mut EscrowFactory,
    escrow: SuiEscrow,
    preimage: vector<u8>,      // Original secret
    clock: &Clock,
    ctx: &mut TxContext
)
```

#### Refund SUI Escrow
```move
public entry fun refund_escrow(
    factory: &mut EscrowFactory,
    escrow: SuiEscrow,
    clock: &Clock,
    ctx: &mut TxContext
)
```

### For Generic Objects (NFTs, etc.)

#### Setup Object Escrow
```move
public fun create_object_escrow<T: key + store>(
    escrowed: T,               // Any object with key + store
    hashlock: vector<u8>,      // 32 bytes keccak256 hash
    eth_receiver: vector<u8>,  // 20 bytes ETH address
    deadline: u64,             // Unix timestamp (ms)
    clock: &Clock,
    ctx: &mut TxContext
)
```

#### Claim Object Escrow
```move
public fun claim_object_escrow<T: key + store>(
    escrow: ObjectEscrow<T>,
    preimage: vector<u8>,      // Original secret
    clock: &Clock,
    ctx: &mut TxContext
): T                           // Returns the claimed object
```

#### Refund Object Escrow
```move
public fun refund_object_escrow<T: key + store>(
    escrow: ObjectEscrow<T>,
    clock: &Clock,
    ctx: &mut TxContext
): T                           // Returns the refunded object
```

## 🔄 Atomic Swap Flow

### 1. **Alice (Sui → ETH)** - SUI Coins

1. **Generate Secret**: Creates 32-byte secret `S`
2. **Calculate Hash**: `H = keccak256(S)`
3. **Lock SUI**: Calls `setup_escrow(factory, coin, amount, H, alice_eth_address, deadline)`
4. **Wait for Match**: Off-chain matching finds Bob's ETH offer

### 2. **Alice (Sui → ETH)** - NFTs/Objects

1. **Generate Secret**: Creates 32-byte secret `S`
2. **Calculate Hash**: `H = keccak256(S)`
3. **Lock Object**: Calls `create_object_escrow(nft, H, alice_eth_address, deadline)`
4. **Wait for Match**: Off-chain matching finds Bob's ETH offer

### 3. **Bob (ETH → SUI)**

1. **See Alice's Order**: Finds matching swap opportunity
2. **Lock ETH**: Creates 1inch HTLC on Ethereum with same `H`
3. **Wait for Claim**: Alice can now reveal secret to claim ETH

### 4. **Completion**

1. **Alice Claims ETH**: Reveals secret `S` on Ethereum
2. **Relayer Watches**: Detects `PreimageRevealed` event on Sui
3. **Bob Claims Assets**: Uses revealed `S` to claim Alice's SUI/NFTs
4. **Atomic Success**: Both parties get desired assets

### 5. **Failure Recovery**

- If timeouts expire, both parties can call refund functions
- No funds are lost, just returned to original owners

## 🧪 Example Usage

### SUI Coin Escrow
```typescript
// Frontend TypeScript example
await signAndExecute({
  target: `${packageId}::escrow::setup_escrow`,
  arguments: [
    factoryId,
    coinObject,
    1000000000, // 1 SUI in MIST
    hashCommitment, // keccak256(secret)
    ethAddress, // 20-byte ETH address
    deadline, // Unix timestamp
    '0x6' // Clock object
  ]
});
```

### NFT/Object Escrow
```typescript
// Frontend TypeScript example
await signAndExecute({
  target: `${packageId}::escrow::create_object_escrow`,
  arguments: [
    nftObject,
    hashCommitment, // keccak256(secret)
    ethAddress, // 20-byte ETH address
    deadline, // Unix timestamp
    '0x6' // Clock object
  ],
  typeArguments: ['0x123::my_nft::MyNFT'] // Object type
});
```

## 🔧 Implementation Status

### ✅ Completed

- [x] **Generic Move contracts** - Support both SUI coins and any object type
- [x] **Keccak-256 compatibility** - Cross-chain hash function compatibility
- [x] **Factory pattern** - Efficient SUI coin management
- [x] **Dynamic Object Fields** - Generic object storage for NFTs/items
- [x] **Event system** - Complete `PreimageRevealed` events for relayers
- [x] **Frontend project structure** - React + TypeScript foundation
- [x] **Deployment tooling** - Automated contract deployment and testing
- [x] **Type safety** - Full TypeScript interfaces for all asset types

### 🔄 In Progress

- [ ] Complete frontend components:
  - [ ] `CreateSwap.tsx` - Support both SUI and object swaps
  - [ ] `ClaimSwap.tsx` - Secret reveal interface for all asset types
  - [ ] `MySwaps.tsx` - Dashboard showing SUI and object escrows
  - [ ] Contract interaction hooks for both escrow types

### 📋 TODO

- [ ] **Enhanced Frontend**:
  - [ ] Object type detection and display
  - [ ] NFT metadata rendering
  - [ ] Multi-asset swap interface
  - [ ] Asset type filtering and search

- [ ] **API Backend**:
  - [ ] Event indexer for both SuiEscrow and ObjectEscrow events
  - [ ] Asset type classification and metadata
  - [ ] Multi-asset swap discovery API

- [ ] **Ethereum Integration**:
  - [ ] Generic asset representation on Ethereum
  - [ ] Multi-asset 1inch HTLC integration
  - [ ] Asset bridging protocols

## 💡 Key Design Decisions

### Dual Escrow Architecture

- **`SuiEscrow`**: Optimized for SUI coins with factory vault management
- **`ObjectEscrow<T>`**: Generic container for any object type using Dynamic Object Fields
- **Separate entry functions**: SUI escrows use entry functions for wallet integration
- **Unified events**: Both escrow types emit compatible events for relayers

### Type Safety & Generics

- **Full generic support**: `ObjectEscrow<T: key + store>` works with any valid Sui object
- **Type preservation**: Objects maintain their original type throughout the escrow process
- **Compile-time checks**: Move's type system ensures asset safety

### Factory vs. DOF Pattern

- **SUI coins**: Use factory pattern for efficient bulk management
- **Objects**: Use Dynamic Object Fields for individual object storage
- **Gas optimization**: Different patterns optimized for different asset types

### Cross-Chain Compatibility

- **Same hash function**: keccak256 across all asset types
- **Consistent event structure**: Unified `PreimageRevealed` format
- **Ethereum mapping**: All asset types can be represented on Ethereum side

## 🔗 Integration with 1inch

This implementation maintains full compatibility with 1inch's cross-chain infrastructure while adding generic asset support:

- **Same Hash Algorithm**: Uses keccak256 for all asset types
- **Compatible Events**: All escrow types emit `PreimageRevealed` events that 1inch relayers can process  
- **Identical Flow**: Follows the same setup → lock → claim → relay pattern for all assets
- **Extensible**: Easy to add new asset types without breaking compatibility

## 🛠️ Development

### Adding New Asset Types

1. **Move Contract**: No changes needed - generic `ObjectEscrow<T>` supports any `T: key + store`
2. **Frontend**: Add type-specific UI components and interaction logic
3. **API**: Add asset metadata handling and indexing
4. **Ethereum**: Add corresponding asset representation contracts

### Testing Different Asset Types

```bash
# Test SUI coin escrows
cd api && npm run create-demo

# Test with custom objects (add to demo script)
# - NFTs
# - Game items  
# - Digital collectibles
# - Any object with key + store abilities
```

## 📊 Asset Type Examples

### Supported Asset Types

- **✅ SUI Coins**: Native Sui cryptocurrency
- **✅ NFTs**: Digital art, collectibles, profile pictures
- **✅ Game Items**: Weapons, characters, resources
- **✅ Digital Assets**: Certificates, licenses, credentials
- **✅ Custom Objects**: Any object with `key + store` abilities

### Example Object Types

```move
// NFT
struct MyNFT has key, store {
    id: UID,
    name: String,
    image_url: String,
    attributes: Table<String, String>,
}

// Game Item
struct GameSword has key, store {
    id: UID,
    damage: u64,
    durability: u64,
    enchantments: vector<String>,
}

// Certificate
struct Certificate has key, store {
    id: UID,
    holder: address,
    issuer: address,
    certification_type: String,
    issued_at: u64,
}
```

## 🚀 Next Steps

To complete this implementation:

1. **Deploy Contracts**: Deploy to Sui testnet and update addresses
2. **Finish Frontend**: Complete components for both SUI and object escrows
3. **Build Multi-Asset API**: Create backend for cross-asset event monitoring
4. **Test Integration**: End-to-end testing with real cross-chain swaps
5. **Ethereum Integration**: Deploy compatible multi-asset Solidity HTLCs
6. **Production Ready**: Security audit and mainnet deployment

The foundation supports both SUI coins and any object type, providing maximum flexibility for cross-chain atomic swaps while maintaining full 1inch compatibility! 