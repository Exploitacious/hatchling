// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { HatchlingBridge, IpcChannel } from '@shared/ipc'
import { NewHatchModal } from '@renderer/screens/NewHatchModal'
import { useUiStore } from '@renderer/store/useUiStore'

// A bridge stub rich enough to drive the full "start a hatch" flow: one
// provider, one template, one model, and a sessions:create that succeeds.
function stubBridge(): HatchlingBridge {
  const invoke = vi.fn(async (channel: IpcChannel) => {
    switch (channel) {
      case 'providers:list':
        return [{ id: 'p1', shape: 'mock', name: 'Mock', createdAt: '', updatedAt: '' }]
      case 'templates:list':
        return [
          {
            id: 't1',
            name: 'T',
            description: '',
            content: '# BOOTSTRAP.md',
            openingMessage: 'hi',
            isBuiltin: true,
            createdAt: '',
            updatedAt: ''
          }
        ]
      case 'llm:listModels':
        return [{ id: 'mock-model' }]
      case 'sessions:create':
        return {
          id: 's1',
          name: 'S',
          templateId: 't1',
          templateSnapshot: '',
          openingMessage: 'hi',
          providerId: 'p1',
          model: 'mock-model',
          status: 'in_progress',
          createdAt: '',
          updatedAt: ''
        }
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
  useUiStore.setState({ newHatchOpen: false })
})

afterEach(() => {
  cleanup()
})

async function openModalAndWaitReady(): Promise<HTMLButtonElement> {
  act(() => {
    useUiStore.getState().openNewHatch()
  })
  const button = (await screen.findByRole('button', {
    name: /start hatching/i
  })) as HTMLButtonElement
  // Ready once the model list resolved and the button is enabled.
  await waitFor(() => expect(button.disabled).toBe(false))
  return button
}

describe('NewHatchModal', () => {
  it('can start a second hatch after a successful first one', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <NewHatchModal />
      </MemoryRouter>
    )

    // First hatch: start succeeds and the modal closes.
    const firstButton = await openModalAndWaitReady()
    await user.click(firstButton)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /start hatching/i })).toBeNull()
    )

    // Second hatch: the button must be usable again, not stuck disabled with a
    // spinner from the previous submit (regression: `submitting` was never
    // reset because the modal component never unmounts).
    const secondButton = await openModalAndWaitReady()
    expect(secondButton.disabled).toBe(false)
  })
})
