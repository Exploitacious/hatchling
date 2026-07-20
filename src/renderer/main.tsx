import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
// Bundled fonts. JetBrains Mono is the app's primary (terminal-style) face;
// the vendored CBDT emoji font + symbols guarantee every glyph renders on
// every platform — minimal Linux/WSL installs ship no emoji font at all, and
// only the bitmap emoji flavor survives every GPU path (see the font README).
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import './assets/fonts/noto-color-emoji/noto-color-emoji.css'
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
