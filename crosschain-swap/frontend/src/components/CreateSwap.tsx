import { useState } from 'react'
import { Box, Button, Card, Flex, Text, TextField, Select, Heading, Badge, Separator, TextArea } from '@radix-ui/themes'
// Icons removed for simplicity

type AssetType = 'sui' | 'nft' | 'other'

function CreateSwap() {
  const [assetType, setAssetType] = useState<AssetType>('sui')
  const [amount, setAmount] = useState('')
  const [ethAddress, setEthAddress] = useState('')
  const [timeoutHours, setTimeoutHours] = useState('24')
  const [secret, setSecret] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const generateSecret = () => {
    // Generate a 32-byte secret for testing
    const randomSecret = `secret_${Date.now()}_${Math.random().toString(36).substring(2)}`
    setSecret(randomSecret)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      // TODO: Implement actual escrow creation logic
      console.log('Creating escrow:', {
        assetType,
        amount,
        ethAddress,
        timeoutHours,
        secret
      })
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Show success message or redirect
      alert('Escrow created successfully!')
      
    } catch (error) {
      console.error('Failed to create escrow:', error)
      alert('Failed to create escrow. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box style={{ maxWidth: '600px', margin: '0 auto' }}>
      <Box style={{ marginBottom: '2rem' }}>
        <Heading size="6" style={{ marginBottom: '0.5rem' }}>
          Create Cross-Chain Swap
        </Heading>
        <Text color="gray">
          Lock your assets with a secret to create an atomic swap opportunity
        </Text>
      </Box>

      <Card style={{ padding: '2rem' }}>
        <form onSubmit={handleSubmit}>
          {/* Asset Type Selection */}
          <Box style={{ marginBottom: '1.5rem' }}>
            <Text size="3" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
              Asset Type
            </Text>
            <Select.Root value={assetType} onValueChange={(value: AssetType) => setAssetType(value)}>
              <Select.Trigger style={{ width: '100%' }} id="asset-type" name="assetType" />
              <Select.Content>
                <Select.Item value="sui">
                  <Flex align="center" gap="2">
                    <Badge color="blue">SUI</Badge>
                    SUI Coins
                  </Flex>
                </Select.Item>
                <Select.Item value="nft">
                  <Flex align="center" gap="2">
                    <Badge color="green">NFT</Badge>
                    NFTs & Collectibles
                  </Flex>
                </Select.Item>
                <Select.Item value="other">
                  <Flex align="center" gap="2">
                    <Badge color="purple">OTHER</Badge>
                    Game Items & Custom Objects
                  </Flex>
                </Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>

          {/* Amount/Object Selection */}
          <Box style={{ marginBottom: '1.5rem' }}>
            {assetType === 'sui' ? (
              <>
                <Text size="3" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Amount (SUI)
                </Text>
                <TextField.Root
                  id="sui-amount"
                  name="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.1"
                  type="number"
                  step="0.001"
                  min="0"
                  required
                />
                <Text size="2" color="gray" style={{ marginTop: '0.25rem', display: 'block' }}>
                  Minimum: 0.001 SUI for gas fees
                </Text>
              </>
            ) : (
              <>
                <Text size="3" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
                  Select Object
                </Text>
                <Button variant="outline" style={{ width: '100%', height: '3rem' }} disabled id="select-object-btn">
                  🔗 Connect wallet to select objects
                </Button>
                <Text size="2" color="gray" style={{ marginTop: '0.25rem', display: 'block' }}>
                  Connect your wallet to see available {assetType === 'nft' ? 'NFTs' : 'objects'}
                </Text>
              </>
            )}
          </Box>

          <Separator style={{ margin: '1.5rem 0' }} />

          {/* Ethereum Receiver Address */}
          <Box style={{ marginBottom: '1.5rem' }}>
            <Text size="3" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
              Ethereum Receiver Address
            </Text>
            <TextField.Root
              id="eth-address"
              name="ethAddress"
              value={ethAddress}
              onChange={(e) => setEthAddress(e.target.value)}
              placeholder="0x742d35Cc6635C0532925a3b8D0A9e2B9c2b6F5f1"
              pattern="^0x[a-fA-F0-9]{40}$"
              required
            />
            <Text size="2" color="gray" style={{ marginTop: '0.25rem', display: 'block' }}>
              The Ethereum address that can claim your assets after revealing the secret
            </Text>
          </Box>

          {/* Timeout */}
          <Box style={{ marginBottom: '1.5rem' }}>
            <Text size="3" weight="medium" style={{ marginBottom: '0.5rem', display: 'block' }}>
              Timeout (Hours)
            </Text>
            <Select.Root value={timeoutHours} onValueChange={setTimeoutHours}>
              <Select.Trigger style={{ width: '100%' }} id="timeout-hours" name="timeoutHours" />
              <Select.Content>
                <Select.Item value="1">1 Hour</Select.Item>
                <Select.Item value="6">6 Hours</Select.Item>
                <Select.Item value="12">12 Hours</Select.Item>
                <Select.Item value="24">24 Hours (Recommended)</Select.Item>
                <Select.Item value="48">48 Hours</Select.Item>
                <Select.Item value="72">72 Hours</Select.Item>
              </Select.Content>
            </Select.Root>
            <Text size="2" color="gray" style={{ marginTop: '0.25rem', display: 'block' }}>
              After this time, you can reclaim your assets if the swap isn't completed
            </Text>
          </Box>

          <Separator style={{ margin: '1.5rem 0' }} />

          {/* Secret Generation */}
          <Box style={{ marginBottom: '2rem' }}>
            <Flex align="center" gap="2" style={{ marginBottom: '0.5rem' }}>
              <Text size="3" weight="medium">Secret</Text>
  🔒
            </Flex>
            
            <Box style={{ marginBottom: '0.5rem' }}>
              <Button 
                type="button" 
                variant="outline" 
                onClick={generateSecret}
                style={{ marginBottom: '0.5rem' }}
                id="generate-secret-btn"
              >
                Generate Random Secret
              </Button>
            </Box>
            
            <TextArea
              id="secret"
              name="secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter your secret (keep this safe!)"
              rows={3}
              required
            />
            <Text size="2" color="gray" style={{ marginTop: '0.25rem', display: 'block' }}>
              ⚠️ Keep this secret safe! You'll need it to claim assets on Ethereum.
              The keccak256 hash of this secret will be used for the atomic swap.
            </Text>
          </Box>

          {/* Submit Button */}
          <Button 
            type="submit" 
            size="3" 
            style={{ width: '100%' }}
            disabled={isLoading || !secret || !ethAddress || (assetType === 'sui' && !amount)}
            loading={isLoading}
            id="create-swap-submit-btn"
          >
            {isLoading ? 'Creating Escrow...' : 'Create Atomic Swap'}
          </Button>
        </form>
      </Card>

      {/* Information Card */}
      <Card style={{ padding: '1.5rem', marginTop: '1.5rem', backgroundColor: 'var(--blue-2)' }}>
        <Heading size="4" style={{ marginBottom: '1rem' }}>
          💡 How it works
        </Heading>
        <Text size="2" color="gray" style={{ lineHeight: 1.5 }}>
          1. Your assets will be locked in a smart contract with a hash of your secret<br/>
          2. Someone on Ethereum can create a matching lock with the same hash<br/>
          3. You reveal your secret to claim their ETH<br/>
          4. They use your revealed secret to claim your assets<br/>
          5. If no match is found before timeout, you can reclaim your assets
        </Text>
      </Card>
    </Box>
  )
}

export default CreateSwap 