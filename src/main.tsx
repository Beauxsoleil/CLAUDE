import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ConfirmProvider } from './components/ConfirmSheet.tsx'
import { UpdatePrompt } from './components/UpdatePrompt.tsx'
import { MisconfigBanner } from './components/MisconfigBanner.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmProvider>
      <MisconfigBanner />
      <UpdatePrompt />
      <App />
    </ConfirmProvider>
  </StrictMode>,
)
