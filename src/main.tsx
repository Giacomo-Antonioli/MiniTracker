import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { isDesktopApp, openLinksInBrowser } from './app/platform'

if (isDesktopApp()) void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openLinksInBrowser(openUrl))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
