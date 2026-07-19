import type {
  HatchlingBridge,
  IpcChannel,
  IpcEventMap,
  IpcEventName,
  IpcRequest,
  IpcResponse
} from '@shared/ipc'

// Thin, fully-typed convenience wrapper over the preload bridge. Components and
// stores call these instead of reaching for `window.hatchling` directly, so the
// bridge access lives in one place.

function bridge(): HatchlingBridge {
  return window.hatchling
}

/** Invoke a main-process request channel. */
export function invoke<C extends IpcChannel>(
  channel: C,
  payload: IpcRequest<C>
): Promise<IpcResponse<C>> {
  return bridge().invoke(channel, payload)
}

/** Subscribe to a main-process push event. Returns an unsubscribe function. */
export function subscribe<E extends IpcEventName>(
  event: E,
  listener: (payload: IpcEventMap[E]) => void
): () => void {
  return bridge().subscribe(event, listener)
}
