import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import { subscribeToAuthChanges } from './features/auth/api'
import { createQueryClient } from './lib/query-client'
import { createAppRouter } from './router'

const queryClient = createQueryClient()
const router = createAppRouter({ queryClient })

// При входе и выходе роутер перепроверяет доступ к текущей странице
subscribeToAuthChanges(queryClient, () => void router.invalidate())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
