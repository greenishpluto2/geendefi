// Cross-chain swap types
export interface CrossChainSwapOrder {
  id: string
  fromChain: 'SUI' | 'ETHEREUM'
  toChain: 'SUI' | 'ETHEREUM'
  fromAmount: string
  toAmount: string
  fromAddress: string
  toAddress: string
  hashCommitment: string
  secret?: string
  deadline: number
  status: 'pending' | 'locked' | 'claimed' | 'refunded' | 'expired'
  createdAt: number
  txHash?: string
}

// Sui escrow types
export interface SuiEscrow {
  id: string
  hashlock: number[]
  creator: string
  ethReceiver: number[]
  deadline: number
  amount: number
}

export interface EscrowEvent {
  escrowId: string
  type: 'created' | 'claimed' | 'refunded'
  preimage?: number[]
  claimer?: string
  amount: number
  timestamp: number
  txDigest: string
}

// Form data types
export interface CreateSwapFormData {
  fromChain: 'SUI' | 'ETHEREUM'
  toChain: 'SUI' | 'ETHEREUM'
  fromAmount: string
  toAmount: string
  ethAddress: string
  timeoutHours: number
}

export interface ClaimSwapFormData {
  escrowId: string
  secret: string
}

// API response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface SwapQuote {
  fromAmount: string
  toAmount: string
  rate: number
  priceImpact: number
  deadline: number
} 