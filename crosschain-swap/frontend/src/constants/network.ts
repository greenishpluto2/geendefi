import { getFullnodeUrl } from '@mysten/sui/client'

export const networkConfig = {
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
  devnet: { url: getFullnodeUrl('devnet') },
  localnet: { url: 'http://127.0.0.1:9000' },
}

// Contract configuration - updated after deployment
export const CONTRACTS = {
  ESCROW_FACTORY: "0x186c0ebf86c5e9a77b08650490c1016f40193a21fb693bcf4f220d2c71dd0859",
  PACKAGE_ID: "0x9daad1af7c47a24efd4884abc12f1996399689204c61da728a8d79f7047dacfa",
}

// Cross-chain configuration
export const CHAINS = {
  SUI: {
    name: 'Sui',
    symbol: 'SUI',
    decimals: 9,
    minAmount: 1000000, // 0.001 SUI in MIST
  },
  ETHEREUM: {
    name: 'Ethereum', 
    symbol: 'ETH',
    decimals: 18,
    minAmount: 1000000000000000, // 0.001 ETH in wei
  }
} as const

export const API_ENDPOINT = 'http://localhost:3003' 