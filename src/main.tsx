import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyTheme, getInitialThemePreferenceFromStorage } from './lib/theme'

applyTheme(getInitialThemePreferenceFromStorage())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
