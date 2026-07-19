import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  HatchlingBridge,
  IpcChannel,
  IpcEventMap,
  IpcEventName,
  IpcRequest,
  IpcResponse
} from '@shared/ipc'

// The single, typed API surface exposed to the renderer. Context isolation is
// on and node integration is off, so this bridge is the only channel between
// the sandboxed UI and the main process. It stays generic (invoke/subscribe)
// but fully typed via the IPC maps — callers cannot use a channel with the
// wrong payload shape.
const bridge: HatchlingBridge = {
  invoke<C extends IpcChannel>(channel: C, payload: IpcRequest<C>): Promise<IpcResponse<C>> {
    return ipcRenderer.invoke(channel, payload) as Promise<IpcResponse<C>>
  },
  subscribe<E extends IpcEventName>(
    event: E,
    listener: (payload: IpcEventMap[E]) => void
  ): () => void {
    const handler = (_event: IpcRendererEvent, payload: IpcEventMap[E]): void => listener(payload)
    ipcRenderer.on(event, handler)
    return () => {
      ipcRenderer.removeListener(event, handler)
    }
  }
}

contextBridge.exposeInMainWorld('hatchling', bridge)
