import { Toaster } from 'react-hot-toast'
import { Outlet } from 'react-router-dom'
import Header from '../components/Header'
import { Container } from '@radix-ui/themes'

export function Root() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--gray-1)' }}>
      <Toaster position="bottom-right" />
      <Header />
      <Container size="4" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        <Outlet />
      </Container>
    </div>
  )
} 