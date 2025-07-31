import { Routes, Route } from 'react-router-dom'
import { Box, Container } from '@radix-ui/themes'
import Header from './components/Header'
import HomePage from './components/HomePage'
import CreateSwap from './components/CreateSwap'
import MySwaps from './components/MySwaps'
import ClaimSwap from './components/ClaimSwap'

function App() {
  return (
    <Box style={{ minHeight: '100vh', backgroundColor: 'var(--gray-1)' }}>
      <Header />
      
      <Container size="4" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateSwap />} />
          <Route path="/my-swaps" element={<MySwaps />} />
          <Route path="/claim/:escrowId?" element={<ClaimSwap />} />
        </Routes>
      </Container>
    </Box>
  )
}

export default App 