import { Link, useLocation, NavLink } from 'react-router-dom'
import { Box, Flex, Text, Button, Container } from '@radix-ui/themes'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import { useGenerateDemoCoins } from '../mutations/demo'

const Header = () => {
  const location = useLocation()
  const currentAccount = useCurrentAccount()
  const { mutate: mintDemoCoins, isPending: isMinting } = useGenerateDemoCoins()

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/create', label: 'Create Swap' },
    { path: '/my-swaps', label: 'My Swaps' },
    { path: '/claim', label: 'Claim' },
  ]

  return (
    <Box style={{ borderBottom: '1px solid var(--gray-6)', backgroundColor: 'var(--gray-2)' }}>
      <Container size="4">
        <Flex align="center" justify="between" style={{ padding: '1rem 0' }}>
          {/* Logo */}
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Flex align="center" gap="2">
              <Text size="5" weight="bold" color="blue">
                🔗 CrossChain Swap
              </Text>
            </Flex>
          </Link>

          {/* Navigation */}
          <Flex align="center" gap="4">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                style={{ textDecoration: 'none' }}
                className={({ isActive, isPending }) =>
                  `cursor-pointer flex items-center gap-2 ${
                    isPending
                      ? "pending"
                      : isActive
                        ? "font-bold text-blue-600"
                        : ""
                  }`
                }
              >
                <Text 
                  size="3" 
                  weight={location.pathname === item.path ? 'bold' : 'medium'}
                  color={location.pathname === item.path ? 'blue' : 'gray'}
                  style={{ 
                    cursor: 'pointer',
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-2)',
                    backgroundColor: location.pathname === item.path ? 'var(--blue-3)' : 'transparent',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {item.label}
                </Text>
              </NavLink>
            ))}
          </Flex>

          {/* Wallet Connection & Demo Coins */}
          <Flex align="center" gap="3">
            {currentAccount && (
              <>
                <Flex align="center" gap="2">
                  <Text size="2" color="gray">
                     {`${currentAccount.address.slice(0, 6)}...${currentAccount.address.slice(-4)}`}
                  </Text>
                </Flex>
                <Button
                  onClick={() => mintDemoCoins()}
                  disabled={isMinting}
                  variant="outline"
                  size="2"
                >
                  {isMinting ? 'Creating...' : '🪙 Create Demo Coins'}
                </Button>
              </>
            )}
            <div className="connect-wallet-wrapper">
              <ConnectButton />
            </div>
          </Flex>
        </Flex>
      </Container>
    </Box>
  )
}

export default Header 