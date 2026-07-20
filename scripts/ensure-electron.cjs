// Ensure the Electron binary is present after `npm install`.
//
// Electron 43+ ships no postinstall of its own and fetches its binary lazily on
// first `require('electron')` — which electron-vite's dev launcher does not
// trigger, so `npm run dev` fails with "Electron uninstall" on a fresh clone.
// This runs Electron's bundled installer to fetch the binary at install time.
//
// CI sets ELECTRON_SKIP_BINARY_DOWNLOAD (it never launches the app, only builds
// and tests), so this is a no-op there and installs stay fast.

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
  process.exit(0)
}

const { join } = require('node:path')

try {
  require(join(__dirname, '..', 'node_modules', 'electron', 'install.js'))
} catch (err) {
  console.warn(
    '[ensure-electron] Could not fetch the Electron binary:',
    err && err.message ? err.message : err
  )
  console.warn('  Fetch it manually with: node node_modules/electron/install.js')
}
