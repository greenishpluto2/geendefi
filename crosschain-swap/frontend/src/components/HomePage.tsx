import { Box, Button, Container, Heading, Text, Card, Grid, Badge, Separator } from '@radix-ui/themes'
import { Link } from 'react-router-dom'

function HomePage() {
  return (
    <Container size="4">
      {/* Hero Section */}
      <Box style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <Heading size="9" style={{ marginBottom: '1rem' }}>
          Cross-Chain Atomic Swaps
        </Heading>
        <Text size="6" color="gray" style={{ marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
          Trustless atomic swaps between Sui and Ethereum using Hash Time-Locked Contracts (HTLCs)
        </Text>
        <Box style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button asChild size="4">
            <Link to="/create">
              Create Swap
            </Link>
          </Button>
          <Button variant="outline" asChild size="4">
            <Link to="/my-swaps">
              My Swaps
            </Link>
          </Button>
        </Box>
      </Box>

      {/* Features Section */}
      <Grid columns={{ initial: '1', md: '3' }} gap="4" style={{ marginBottom: '4rem' }}>
        <Card style={{ padding: '2rem' }}>
          <Box style={{ textAlign: 'center' }}>
            <Text size="8" style={{ margin: '0 auto 1rem', display: 'block' }}>🔒</Text>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Trustless</Heading>
            <Text color="gray">
              No intermediaries required. Smart contracts ensure atomic execution - either both sides complete or both revert.
            </Text>
          </Box>
        </Card>

                  <Card style={{ padding: '2rem' }}>
            <Box style={{ textAlign: 'center' }}>
              <Text size="8" style={{ margin: '0 auto 1rem', display: 'block' }}>🌍</Text>
              <Heading size="4" style={{ marginBottom: '1rem' }}>Cross-Chain</Heading>
            <Text color="gray">
              Swap assets between Sui and Ethereum networks using keccak256 hash compatibility for seamless bridging.
            </Text>
          </Box>
        </Card>

        <Card style={{ padding: '2rem' }}>
          <Box style={{ textAlign: 'center' }}>
            <Text size="8" style={{ margin: '0 auto 1rem', display: 'block' }}>🚀</Text>
            <Heading size="4" style={{ marginBottom: '1rem' }}>Generic Assets</Heading>
            <Text color="gray">
              Support for SUI coins, NFTs, game items, and any object type with seamless Dynamic Object Field storage.
            </Text>
          </Box>
        </Card>
      </Grid>

      <Separator style={{ margin: '3rem 0' }} />

      {/* How it Works Section */}
      <Box style={{ marginBottom: '4rem' }}>
        <Heading size="6" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          How It Works
        </Heading>
        
        <Grid columns={{ initial: '1', md: '2' }} gap="6">
          <Box>
            <Card style={{ padding: '2rem' }}>
              <Badge color="blue" style={{ marginBottom: '1rem' }}>Step 1</Badge>
              <Heading size="4" style={{ marginBottom: '1rem' }}>Create Escrow</Heading>
              <Text color="gray">
                Lock your SUI, NFTs, or any object type in a smart contract with a secret hash commitment and deadline.
              </Text>
            </Card>
          </Box>

          <Box>
            <Card style={{ padding: '2rem' }}>
              <Badge color="green" style={{ marginBottom: '1rem' }}>Step 2</Badge>
              <Heading size="4" style={{ marginBottom: '1rem' }}>Cross-Chain Match</Heading>
              <Text color="gray">
                Off-chain matching finds compatible swaps. Your counterparty creates a matching escrow on Ethereum.
              </Text>
            </Card>
          </Box>

          <Box>
            <Card style={{ padding: '2rem' }}>
              <Badge color="orange" style={{ marginBottom: '1rem' }}>Step 3</Badge>
              <Heading size="4" style={{ marginBottom: '1rem' }}>Reveal Secret</Heading>
              <Text color="gray">
                Claim the Ethereum assets by revealing your secret. This automatically enables your counterparty to claim your Sui assets.
              </Text>
            </Card>
          </Box>

          <Box>
            <Card style={{ padding: '2rem' }}>
              <Badge color="purple" style={{ marginBottom: '1rem' }}>Step 4</Badge>
              <Heading size="4" style={{ marginBottom: '1rem' }}>Atomic Completion</Heading>
              <Text color="gray">
                Both parties receive their desired assets atomically, or if timeouts occur, original assets are safely refunded.
              </Text>
            </Card>
          </Box>
        </Grid>
      </Box>

      {/* Supported Assets */}
      <Box style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <Heading size="5" style={{ marginBottom: '1.5rem' }}>
          Supported Asset Types
        </Heading>
        <Box style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Badge size="3" color="blue">SUI Coins</Badge>
          <Badge size="3" color="green">NFTs</Badge>
          <Badge size="3" color="orange">Game Items</Badge>
          <Badge size="3" color="purple">Digital Assets</Badge>
          <Badge size="3" color="gray">Custom Objects</Badge>
        </Box>
      </Box>
    </Container>
  )
}

export default HomePage 