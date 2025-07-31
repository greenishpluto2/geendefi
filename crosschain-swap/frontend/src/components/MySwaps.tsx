import { useState, useEffect } from 'react'
import { Box, Button, Card, Flex, Text, Heading, Badge, Separator, Tabs } from '@radix-ui/themes'
// Icons removed for simplicity
import { Link } from 'react-router-dom'

type SwapStatus = 'active' | 'completed' | 'expired' | 'claimed'

interface Swap {
  id: string
  type: 'sui' | 'nft' | 'other'
  amount?: string
  objectName?: string
  ethAddress: string
  deadline: Date
  status: SwapStatus
  createdAt: Date
  txHash?: string
}

function MySwaps() {
  const [swaps, setSwaps] = useState<Swap[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    loadSwaps()
  }, [])

  const loadSwaps = async () => {
    setIsLoading(true)
    try {
      // TODO: Implement actual API call to load user's swaps
      // For now, showing mock data
      const mockSwaps: Swap[] = [
        {
          id: '1',
          type: 'sui',
          amount: '0.005',
          ethAddress: '0x742d35Cc6635C0532925a3b8D0A9e2B9c2b6F5f1',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          status: 'active',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          txHash: '0xabc123...'
        },
        {
          id: '2',
          type: 'nft',
          objectName: 'Cool NFT #123',
          ethAddress: '0x1234567890123456789012345678901234567890',
          deadline: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago (expired)
          status: 'expired',
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          txHash: '0xdef456...'
        },
        {
          id: '3',
          type: 'sui',
          amount: '0.1',
          ethAddress: '0xAbcdEf123456789012345678901234567890AbCd',
          deadline: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
          status: 'completed',
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          txHash: '0x789xyz...'
        }
      ]
      
      setSwaps(mockSwaps)
    } catch (error) {
      console.error('Failed to load swaps:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: SwapStatus) => {
    switch (status) {
      case 'active': return 'blue'
      case 'completed': return 'green'
      case 'expired': return 'red'
      case 'claimed': return 'purple'
      default: return 'gray'
    }
  }

  const getStatusIcon = (status: SwapStatus) => {
    switch (status) {
      case 'active': return '⏰'
      case 'completed': return '✅'
      case 'expired': return '⚠️'
      case 'claimed': return '✅'
      default: return '⏰'
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
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else {
      return `${minutes}m remaining`
    }
  }

  const filterSwaps = (swaps: Swap[]) => {
    switch (activeTab) {
      case 'active':
        return swaps.filter(swap => swap.status === 'active')
      case 'completed':
        return swaps.filter(swap => swap.status === 'completed' || swap.status === 'claimed')
      case 'expired':
        return swaps.filter(swap => swap.status === 'expired')
      default:
        return swaps
    }
  }

  const filteredSwaps = filterSwaps(swaps)

  return (
    <Box style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Flex align="center" justify="between" style={{ marginBottom: '2rem' }}>
        <Box>
          <Heading size="6" style={{ marginBottom: '0.5rem' }}>
            My Atomic Swaps
          </Heading>
          <Text color="gray">
            Track your cross-chain swap activities
          </Text>
        </Box>
        <Button onClick={loadSwaps} variant="outline" disabled={isLoading}>
          🔄 Refresh
        </Button>
      </Flex>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List style={{ marginBottom: '1.5rem' }}>
          <Tabs.Trigger value="all">All ({swaps.length})</Tabs.Trigger>
          <Tabs.Trigger value="active">
            Active ({swaps.filter(s => s.status === 'active').length})
          </Tabs.Trigger>
          <Tabs.Trigger value="completed">
            Completed ({swaps.filter(s => s.status === 'completed' || s.status === 'claimed').length})
          </Tabs.Trigger>
          <Tabs.Trigger value="expired">
            Expired ({swaps.filter(s => s.status === 'expired').length})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value={activeTab}>
          {isLoading ? (
            <Card style={{ padding: '2rem', textAlign: 'center' }}>
              <Text>Loading your swaps...</Text>
            </Card>
          ) : filteredSwaps.length === 0 ? (
            <Card style={{ padding: '2rem', textAlign: 'center' }}>
              <Text color="gray" style={{ marginBottom: '1rem' }}>
                {activeTab === 'all' ? 'No swaps found' : `No ${activeTab} swaps`}
              </Text>
              {activeTab === 'all' && (
                <Button asChild>
                  <Link to="/create">Create Your First Swap</Link>
                </Button>
              )}
            </Card>
          ) : (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredSwaps.map((swap) => (
                <Card key={swap.id} style={{ padding: '1.5rem' }}>
                  <Flex align="start" justify="between" style={{ marginBottom: '1rem' }}>
                    <Flex align="center" gap="3">
                      <Badge color={getStatusColor(swap.status)} size="2">
                        <Flex align="center" gap="1">
                          {getStatusIcon(swap.status)}
                          {swap.status.toUpperCase()}
                        </Flex>
                      </Badge>
                      <Badge color={swap.type === 'sui' ? 'blue' : swap.type === 'nft' ? 'green' : 'purple'}>
                        {swap.type.toUpperCase()}
                      </Badge>
                    </Flex>
                    
                    <Text size="2" color="gray">
                      {swap.createdAt.toLocaleDateString()} {swap.createdAt.toLocaleTimeString()}
                    </Text>
                  </Flex>

                  <Flex align="center" justify="between" style={{ marginBottom: '1rem' }}>
                    <Box>
                      <Text weight="medium" size="3" style={{ marginBottom: '0.25rem', display: 'block' }}>
                        {swap.type === 'sui' ? `${swap.amount} SUI` : swap.objectName}
                      </Text>
                      <Text size="2" color="gray">
                        → {swap.ethAddress.slice(0, 8)}...{swap.ethAddress.slice(-6)}
                      </Text>
                    </Box>

                    <Box style={{ textAlign: 'right' }}>
                      <Text size="2" color={swap.status === 'expired' ? 'red' : 'gray'}>
                        {formatTimeRemaining(swap.deadline)}
                      </Text>
                    </Box>
                  </Flex>

                  <Separator style={{ margin: '1rem 0' }} />

                  <Flex align="center" justify="between">
                    <Text size="2" color="gray">
                      TX: {swap.txHash?.slice(0, 10)}...{swap.txHash?.slice(-8)}
                    </Text>
                    
                    <Flex gap="2">
                      {swap.status === 'active' && (
                        <Button asChild size="2">
                          <Link to={`/claim/${swap.id}`}>
                            Reveal Secret
                          </Link>
                        </Button>
                      )}
                      {swap.status === 'expired' && (
                        <Button size="2" color="red">
                          Reclaim Assets
                        </Button>
                      )}
                      <Button variant="outline" size="2">
                        View Details
                      </Button>
                    </Flex>
                  </Flex>
                </Card>
              ))}
            </Box>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {/* Quick Actions */}
      {!isLoading && filteredSwaps.length > 0 && (
        <Card style={{ padding: '1.5rem', marginTop: '2rem', backgroundColor: 'var(--gray-2)' }}>
          <Flex align="center" justify="between">
            <Box>
              <Text weight="medium" style={{ marginBottom: '0.25rem', display: 'block' }}>
                Need help with your swaps?
              </Text>
              <Text size="2" color="gray">
                Check our documentation or contact support for assistance
              </Text>
            </Box>
            <Flex gap="2">
              <Button variant="outline" size="2">
                View Docs
              </Button>
              <Button variant="outline" size="2">
                Support
              </Button>
            </Flex>
          </Flex>
        </Card>
      )}
    </Box>
  )
}

export default MySwaps 