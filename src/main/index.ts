import { join } from 'path'
import { app, BrowserWindow, session, shell } from 'electron'
import { createStore } from './store'
import { KeyVault } from './security/keyVault'
import { safeStorageEncryptor } from './security/safeStorageEncryptor'
import { ConversationEngine, type EngineEmitter } from './engine/conversationEngine'
import { electronExporter } from './export/electronExporter'
import { registerIpcHandlers } from './ipc/register'

// Main process. Phase 1 wires the SQLite store, the secure key vault, the
// provider factory, and the IPC handler registry. Phase 3 adds the conversation
// engine (the chat:* channels).

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.on('ready-to-show', () => window.show())

  // Open external links in the user's browser, never in-app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Content Security Policy for the packaged app. The renderer makes no network
// requests of its own (all LLM traffic goes through the main process over IPC),
// so connect-src can be locked to self. Applied only to the file:// production
// load — dev keeps Vite's own policy so HMR works.
function applyProductionCsp(): void {
  if (process.env['ELECTRON_RENDERER_URL']) return
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'"
        ]
      }
    })
  })
}

app.whenReady().then(() => {
  applyProductionCsp()
  const userData = app.getPath('userData')
  const store = createStore(join(userData, 'hatchling.db'))
  const keyVault = new KeyVault(join(userData, 'keys.json'), safeStorageEncryptor)

  // Broadcast engine events to every open window.
  const emit: EngineEmitter = (event, payload) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(event, payload)
    }
  }
  const engine = new ConversationEngine(store, keyVault, emit)

  registerIpcHandlers({
    store,
    keyVault,
    engine,
    exporter: electronExporter,
    appVersion: app.getVersion(),
    dataPath: userData
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Surface unexpected failures during startup rather than dying silently.
process.on('uncaughtException', (error) => {
  console.error('[main] uncaught exception:', error)
})
