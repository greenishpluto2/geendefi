import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Root } from './root'
import HomePage from '../components/HomePage'
import CreateSwap from '../components/CreateSwap'
import MySwaps from '../components/MySwaps'
import ClaimSwap from '../components/ClaimSwap'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: 'create',
        element: <CreateSwap />,
      },
      {
        path: 'my-swaps',
        element: <MySwaps />,
      },
      {
        path: 'claim/:escrowId?',
        element: <ClaimSwap />,
      },
    ],
  },
]) 