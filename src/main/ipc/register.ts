import { ipcMain } from 'electron'
import type { IpcChannel } from '@shared/ipc'
import { buildHandlers, type IpcContext } from './handlers'

// Thin Electron wrapper: register every handler from the (pure) handler map onto
// ipcMain. A handler that throws rejects the renderer's invoke automatically.
export function registerIpcHandlers(ctx: IpcContext): void {
  const handlers = buildHandlers(ctx)
  for (const channel of Object.keys(handlers) as IpcChannel[]) {
    const handler = handlers[channel] as (payload: unknown) => unknown
    ipcMain.handle(channel, (_event, payload) => handler(payload))
  }
}
