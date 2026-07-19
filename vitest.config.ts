import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Vitest runs under plain Node (not Electron), so better-sqlite3 resolves
// against the Node ABI it was built for. The default environment is `node`
// (main-process + shared logic); renderer component tests opt into a DOM by
// adding `// @vitest-environment happy-dom` at the top of the test file.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/__tests__/**',
        'src/renderer/main.tsx',
        'src/**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer')
    }
  }
})
