import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { createQueryClient } from './api/queryClient'
import MiseAJour from './pwa/MiseAJour'
import './ui/polices'
import './ui/theme.css'

// Créé une fois, hors du rendu : un `createQueryClient()` par rendu viderait
// le cache (et donc la session) à chaque remontage.
const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MiseAJour />
      <BrowserRouter basename="/journal">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
