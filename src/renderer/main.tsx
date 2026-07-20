import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
// Bundled fallback fonts so emoji and symbols render on every platform —
// minimal Linux/WSL installs often ship no color-emoji font at all, and
// Electron doesn't bundle one. Unicode-range subsets: only used ranges load.
import '@fontsource/noto-color-emoji'
import '@fontsource/noto-sans-symbols-2'
import './index.css'

// HashRouter (not BrowserRouter): the packaged app is served over file://,
// where path-based routing breaks. Hash routing works in both dev and prod.
const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found')
}

createRoot(container).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
