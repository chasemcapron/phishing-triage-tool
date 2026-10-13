import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fredoka'
import App from './App'
import { OnlineProvider } from './online'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OnlineProvider>
      <App />
    </OnlineProvider>
  </StrictMode>,
)
