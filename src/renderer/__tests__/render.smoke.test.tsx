// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { HatchlingBridge, IpcChannel } from '@shared/ipc'
import { AppRoutes } from '@renderer/routes'

// A stubbed preload bridge so store-connected screens can mount without a real
// main process. Returns empty collections for the list channels the initial
// render touches.
function stubBridge(): HatchlingBridge {
  const invoke = vi.fn(async (channel: IpcChannel) => {
    switch (channel) {
      case 'providers:list':
      case 'templates:list':
      case 'sessions:list':
        return []
      case 'app:getVersion':
        return '0.0.0-test'
      default:
        return null
    }
  })
  return {
    invoke: invoke as unknown as HatchlingBridge['invoke'],
    subscribe: () => () => {}
  }
}

beforeEach(() => {
  window.hatchling = stubBridge()
})

afterEach(() => {
  cleanup()
})

describe('app render smoke', () => {
  it('mounts the shell and the session library without crashing', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    )

    // Nav bar (not lazy) renders immediately.
    expect(await screen.findByText('Hatchling')).toBeTruthy()
    // The lazily-loaded index screen resolves and shows its empty state.
    expect(await screen.findByText(/No hatching sessions/i)).toBeTruthy()
  })

  it('mounts the settings screen without crashing', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppRoutes />
      </MemoryRouter>
    )
    expect(await screen.findByText('Settings')).toBeTruthy()
    // Provider configuration surface is present.
    expect(await screen.findByText(/No providers configured/i)).toBeTruthy()
  })
})
