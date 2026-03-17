import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthContext'
import App from './App'
import * as storage from '@/lib/storage'
import * as ordersApi from '@/api/orders'
import * as transactionsApi from '@/api/transactions'
import './index.css'

if (typeof window !== 'undefined' && (window as unknown as { Cypress?: unknown }).Cypress) {
  const w = window as unknown as Record<string, unknown>
  w.getContacts = storage.getContacts
  w.saveContacts = storage.saveContacts
  w.addContact = storage.addContact
  w.updateContact = storage.updateContact
  w.getTransactions = storage.getTransactions
  w.clearAllData = storage.clearAllData
  w.getOrder = ordersApi.getOrder
  w.getOrders = ordersApi.getOrders
  w.createOrder = ordersApi.createOrder
  w.updateOrder = ordersApi.updateOrder
  w.getTransaction = transactionsApi.getTransaction
  w.uploadTransactionAttachment = transactionsApi.uploadTransactionAttachment
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
