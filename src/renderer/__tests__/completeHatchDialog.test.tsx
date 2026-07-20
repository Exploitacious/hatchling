// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompleteHatchDialog } from '@renderer/components/CompleteHatchDialog'

afterEach(() => {
  cleanup()
})

function renderDialog(fileCount: number) {
  const handlers = {
    onGenerate: vi.fn(),
    onComplete: vi.fn(),
    onPause: vi.fn(),
    onCancel: vi.fn()
  }
  render(<CompleteHatchDialog open fileCount={fileCount} {...handlers} />)
  return handlers
}

describe('CompleteHatchDialog', () => {
  it('with files: confirms and completes', async () => {
    const user = userEvent.setup()
    const h = renderDialog(3)

    expect(screen.getByText(/written/i)).toBeTruthy()
    expect(screen.getByText(/3 files/)).toBeTruthy()
    // No-files options are absent.
    expect(screen.queryByText(/write the files now/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /complete hatch/i }))
    expect(h.onComplete).toHaveBeenCalledOnce()
  })

  it('without files: offers generate, pause, and complete-empty', async () => {
    const user = userEvent.setup()
    const h = renderDialog(0)

    expect(screen.getByText(/hasn't written any files yet/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /write the files now/i }))
    expect(h.onGenerate).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: /pause instead/i }))
    expect(h.onPause).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: /complete without files/i }))
    expect(h.onComplete).toHaveBeenCalledOnce()
  })

  it('cancel closes without acting', async () => {
    const user = userEvent.setup()
    const h = renderDialog(0)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(h.onCancel).toHaveBeenCalledOnce()
    expect(h.onComplete).not.toHaveBeenCalled()
    expect(h.onGenerate).not.toHaveBeenCalled()
  })
})
