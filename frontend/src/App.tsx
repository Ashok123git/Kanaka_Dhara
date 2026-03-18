import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { Welcome } from '@/pages/Welcome'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { Home } from '@/pages/Home'
import { Chat } from '@/pages/Chat'
import { NotFound } from '@/pages/NotFound'
import { FileUploadDemo } from '@/components/FileUploadDemo'
import ToastDemo from '@/pages/ToastDemo'
import AuthDemo from '@/pages/AuthDemo'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/register"
              element={
                <ProtectedRoute>
                  <Register />
                </ProtectedRoute>
              }
            />
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:contactId"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            {/* Unprotected demo routes for Cypress E2E */}
            <Route path="/upload" element={<FileUploadDemo />} />
            <Route path="/toast-demo" element={<ToastDemo />} />
            <Route path="/auth-demo" element={<AuthDemo />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </BrowserRouter>
    </TooltipProvider>
    </QueryClientProvider>
  )
}
