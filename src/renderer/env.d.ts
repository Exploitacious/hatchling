/// <reference types="vite/client" />
import type { HatchlingBridge } from '@shared/ipc'

declare global {
  interface Window {
    /** Typed IPC bridge exposed by the preload script. */
    hatchling: HatchlingBridge
  }
}

export {}
