import { useState, useEffect } from 'react'
import { Box, Button, Card, Flex, Text, TextField, Heading, Badge, Separator, TextArea, Callout } from '@radix-ui/themes'
// Icons removed for simplicity
import { useParams, Link } from 'react-router-dom'

interface EscrowDetails {
  id: string
  type: 'sui' | 'nft' | 'other'
  amount?: string
  objectName?: string
  ethAddress: string
  hashCommitment: string
  deadline: Date
  status: 'active' | 'expired' | 'claimed'
  createdAt: Date
  creator: string
}

function ClaimSwap() {
  const { escrowId } = useParams<{ escrowId?: string }>()
  const [manualEscrowId, setManualEscrowId] = useState('')
  const [secret, setSecret] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [escrowDetails, setEscrowDetails] = useState<EscrowDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const currentEscrowId = escrowId || manualEscrowId

  useEffect(() => {
    if (currentEscrowId) {
      loadEscrowDetails(currentEscrowId)
    }
  }, [currentEscrowId])

  const loadEscrowDetails = async (id: string) => {
    setIsValidating(true)
    setError(null)
    
    try {
      // TODO: Implement actual API call to load escrow details
      // For now, showing mock data
      const mockEscrow: EscrowDetails = {
        id,
        type: 'sui',
        amount: '0.005',
        ethAddress: '0x742d35Cc6635C0532925a3b8D0A9e2B9c2b6F5f1',
        hashCommitment: 'ec21a956321345d29ec7f43f75655e77548ee6c2bf2080c0ab4b0ba09836ba5d',
        deadline: new Date(Date.now() + 20 * 60 * 60 * 1000), // 20 hours from now
        status: 'active',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        creator: '0x6147bfc86f98012a2a231877658add760395918c080546d70a238f74f232d419'
      }
      
      setEscrowDetails(mockEscrow)
    } catch (err) {
      setError('Failed to load escrow details. Please check the escrow ID.')
      setEscrowDetails(null)
    } finally {
      setIsValidating(false)
    }
  }

  const validateSecret = async (secretToValidate: string) => {
    if (!escrowDetails || !secretToValidate) return false
    
    try {
      // TODO: Implement keccak256 hash validation
      // For demo purposes, we'll accept "demo_secret_1_32_bytes_length!!!" 
      const isValid = secretToValidate === 'demo_secret_1_32_bytes_length!!!'
      return isValid
    } catch {
      return false
    }
  }

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!escrowDetails || !secret) return

    setIsLoading(true)
    setError(null)

    try {
      // Validate secret first
      const isValidSecret = await validateSecret(secret)
      if (!isValidSecret) {
        throw new Error('Invalid secret. The secret does not match the hash commitment.')
      }

      // TODO: Implement actual claim transaction
      console.log('Claiming escrow:', {
        escrowId: escrowDetails.id,
        secret,
        hashCommitment: escrowDetails.hashCommitment
      })

      // Simulate transaction
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Show success
      alert('Escrow claimed successfully! Assets have been transferred.')
      
      // Reload escrow details to show updated status
      await loadEscrowDetails(escrowDetails.id)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim escrow. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimeRemaining = (deadline: Date) => {
    const now = new Date()
    const diff = deadline.getTime() - now.getTime()
    
    if (diff <= 0) {
      return 'Expired'
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h remaining`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else {
      return `${minutes}m remaining`
    }
  }

  return (
    <Box style={{ maxWidth: '600px', margin: '0 auto' }}>
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="6" style={{ marginBottom: '0.5rem' }}>
          Claim Atomic Swap
        </Heading>
        <Text color="gray">
          Reveal your secret to claim assets from a cross-chain atomic swap
        </Text>
      </Box>

      {/* Escrow ID Input */}
      {!escrowId && (
        <Card style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <Text size="3" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
            Escrow ID
          </Text>
          <TextField.Root
            id="escrow-id"
            name="escrowId"
            value={manualEscrowId}
            onChange={(e) => setManualEscrowId(e.target.value)}
            placeholder="Enter the escrow ID you want to claim"
          />
          <Text size="2" color="gray" style={{ marginTop: '0.25rem', display: 'block' }}>
            You can find this ID in your "My Swaps" page or from the transaction that created the escrow
          </Text>
        </Card>
      )}

      {/* Escrow Details */}
      {currentEscrowId && (
        <Card style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <Flex align="center" gap="2" style={{ marginBottom: '1rem' }}>
            ℹ️
            <Text weight="medium">Escrow Details</Text>
          </Flex>

          {isValidating ? (
            <Text color="gray">Loading escrow details...</Text>
          ) : escrowDetails ? (
            <Box>
              <Flex align="center" gap="2" style={{ marginBottom: '1rem' }}>
                <Badge color={escrowDetails.status === 'active' ? 'green' : 'red'}>
                  {escrowDetails.status.toUpperCase()}
                </Badge>
                <Badge color={escrowDetails.type === 'sui' ? 'blue' : 'purple'}>
                  {escrowDetails.type.toUpperCase()}
                </Badge>
              </Flex>

              <Box style={{ marginBottom: '1rem' }}>
                <Text size="2" color="gray" style={{ marginBottom: '0.25rem', display: 'block' }}>
                  Asset to Claim:
                </Text>
                <Text weight="medium">
                  {escrowDetails.type === 'sui' ? `${escrowDetails.amount} SUI` : escrowDetails.objectName}
                </Text>
              </Box>

              <Box style={{ marginBottom: '1rem' }}>
                <Text size="2" color="gray" style={{ marginBottom: '0.25rem', display: 'block' }}>
                  ETH Receiver:
                </Text>
                <Text weight="medium" style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {escrowDetails.ethAddress}
                </Text>
              </Box>

              <Box style={{ marginBottom: '1rem' }}>
                <Text size="2" color="gray" style={{ marginBottom: '0.25rem', display: 'block' }}>
                  Time Remaining:
                </Text>
                <Text weight="medium" color={escrowDetails.deadline.getTime() < Date.now() ? 'red' : 'green'}>
                  {formatTimeRemaining(escrowDetails.deadline)}
                </Text>
              </Box>

              <Box>
                <Text size="2" color="gray" style={{ marginBottom: '0.25rem', display: 'block' }}>
                  Hash Commitment:
                </Text>
                <Text style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  {escrowDetails.hashCommitment}
                </Text>
              </Box>
            </Box>
          ) : error ? (
            <Callout.Root color="red">
              <Callout.Icon>
                <ExclamationTriangleIcon />
              </Callout.Icon>
              <Callout.Text>
                {error}
              </Callout.Text>
            </Callout.Root>
          ) : null}
        </Card>
      )}

      {/* Claim Form */}
      {escrowDetails && escrowDetails.status === 'active' && (
        <Card style={{ padding: '2rem' }}>
          <form onSubmit={handleClaim}>
            <Flex align="center" gap="2" style={{ marginBottom: '1rem' }}>
  🔒
              <Text weight="medium">Reveal Secret</Text>
            </Flex>

            <Box style={{ marginBottom: '1.5rem' }}>
              <Text size="3" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
                Secret
              </Text>
              <TextArea
                id="claim-secret"
                name="secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter the secret you used when creating this escrow"
                rows={3}
                required
              />
              <Text size="2" color="gray" style={{ marginTop: '0.25rem', display: 'block' }}>
                This must be the exact secret that produces the hash commitment shown above
              </Text>
            </Box>

            {error && (
              <Callout.Root color="red" style={{ marginBottom: '1.5rem' }}>
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text>
                  {error}
                </Callout.Text>
              </Callout.Root>
            )}

            <Button 
              type="submit" 
              size="3" 
              style={{ width: '100%' }}
              disabled={isLoading || !secret.trim()}
              loading={isLoading}
              id="claim-assets-submit-btn"
            >
              {isLoading ? 'Claiming Assets...' : 'Claim Assets'}
            </Button>
          </form>
        </Card>
      )}

      {/* Status Messages */}
      {escrowDetails && escrowDetails.status === 'expired' && (
        <Callout.Root color="orange">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>
            This escrow has expired. The original creator can now reclaim their assets.
          </Callout.Text>
        </Callout.Root>
      )}

      {escrowDetails && escrowDetails.status === 'claimed' && (
        <Callout.Root color="green">
          <Callout.Icon>
            <CheckIcon />
          </Callout.Icon>
          <Callout.Text>
            This escrow has already been claimed. The atomic swap has been completed successfully.
          </Callout.Text>
        </Callout.Root>
      )}

      {/* Demo Helper */}
      {escrowDetails && escrowDetails.status === 'active' && (
        <Card style={{ padding: '1.5rem', marginTop: '1.5rem', backgroundColor: 'var(--blue-2)' }}>
          <Heading size="4" style={{ marginBottom: '1rem' }}>
            💡 Demo Helper
          </Heading>
          <Text size="2" color="gray" style={{ lineHeight: 1.5, marginBottom: '1rem' }}>
            For testing purposes, try this demo secret:
          </Text>
          <Box style={{ 
            backgroundColor: 'var(--gray-3)', 
            padding: '0.75rem', 
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            marginBottom: '1rem'
          }}>
            demo_secret_1_32_bytes_length!!!
          </Box>
          <Button 
            variant="outline" 
            size="2" 
            onClick={() => setSecret('demo_secret_1_32_bytes_length!!!')}
            disabled={isLoading}
            id="use-demo-secret-btn"
          >
            Use Demo Secret
          </Button>
        </Card>
      )}

      {/* Navigation */}
      <Box style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Button asChild variant="outline">
          <Link to="/my-swaps">
            ← Back to My Swaps
          </Link>
        </Button>
      </Box>
    </Box>
  )
}

export default ClaimSwap 