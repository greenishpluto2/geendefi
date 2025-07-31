import { useTransactionExecution } from '../hooks/useTransactionExecution'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * A mutation to generate demo coins for testing cross-chain swaps
 */
export function useGenerateDemoCoins() {
  const account = useCurrentAccount()
  const executeTransaction = useTransactionExecution()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!account?.address)
        throw new Error("You need to connect your wallet!")
      
      const txb = new Transaction()

      // Create a small coin split as demo
      const [coin] = txb.splitCoins(txb.gas, [txb.pure.u64(1000000)]) // 0.001 SUI

      txb.transferObjects([coin], txb.pure.address(account.address))

      return executeTransaction(txb)
    },
    onSuccess: () => {
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({
        queryKey: ['owned-objects'],
      })
    },
  })
} 