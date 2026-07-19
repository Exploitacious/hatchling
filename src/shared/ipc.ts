// The typed IPC contract between the renderer and the main process.
//
// `IpcRequestMap` describes every request/response channel (renderer -> main,
// via ipcRenderer.invoke). `IpcEventMap` describes every push event
// (main -> renderer, via webContents.send). Both the preload bridge and the
// main-process handler registry derive their types from these maps, so a
// channel cannot be called or handled with the wrong payload shape.

import type {
  CreateProviderInput,
  CreateSessionInput,
  CreateTemplateInput,
  ConversationState,
  FileArtifact,
  LlmErrorKind,
  Message,
  ModelInfo,
  Provider,
  Session,
  Template,
  TokenUsage,
  ToolName,
  UpdateProviderInput,
  UpdateSessionInput,
  UpdateTemplateInput
} from './types'

/** Result shape for the "save file(s) to disk" operations. */
export interface ExportResult {
  saved: boolean
  path?: string
  fileCount?: number
}

/** Request/response contract for renderer -> main invoke channels. */
export interface IpcRequestMap {
  'app:getVersion': { req: void; res: string }
  'app:getDataPath': { req: void; res: string }

  'providers:list': { req: void; res: Provider[] }
  'providers:get': { req: { id: string }; res: Provider | null }
  'providers:create': { req: CreateProviderInput; res: Provider }
  'providers:update': { req: UpdateProviderInput; res: Provider }
  'providers:delete': { req: { id: string }; res: void }
  'providers:testConnection': { req: { id: string }; res: { ok: boolean; error?: string } }

  'apiKeys:save': { req: { providerId: string; key: string }; res: void }
  'apiKeys:has': { req: { providerId: string }; res: boolean }
  'apiKeys:delete': { req: { providerId: string }; res: void }

  'templates:list': { req: void; res: Template[] }
  'templates:get': { req: { id: string }; res: Template | null }
  'templates:create': { req: CreateTemplateInput; res: Template }
  'templates:update': { req: UpdateTemplateInput; res: Template }
  'templates:delete': { req: { id: string }; res: void }

  'sessions:list': { req: void; res: Session[] }
  'sessions:get': { req: { id: string }; res: Session | null }
  'sessions:create': { req: CreateSessionInput; res: Session }
  'sessions:update': { req: UpdateSessionInput; res: Session }
  'sessions:delete': { req: { id: string }; res: void }

  'messages:listBySession': { req: { sessionId: string }; res: Message[] }

  'files:listBySession': { req: { sessionId: string }; res: FileArtifact[] }
  'files:get': { req: { id: string }; res: FileArtifact | null }
  'files:update': { req: { id: string; content: string }; res: FileArtifact }
  'files:export': { req: { id: string }; res: ExportResult }
  'files:exportAll': { req: { sessionId: string; mode: 'zip' | 'folder' }; res: ExportResult }
  'files:exportTranscript': { req: { sessionId: string }; res: ExportResult }

  'llm:listModels': { req: { providerId: string }; res: ModelInfo[] }

  // Conversation engine control (phase 3). Streaming output arrives via events.
  'chat:start': { req: { sessionId: string }; res: void }
  'chat:sendUserMessage': { req: { sessionId: string; content: string }; res: void }
  'chat:complete': { req: { sessionId: string }; res: void }
  'chat:abort': { req: { sessionId: string }; res: void }
}

/** Push events, main -> renderer. */
export interface IpcEventMap {
  'chat:state': { sessionId: string; state: ConversationState }
  'chat:token': { sessionId: string; messageId: string; chunk: string; done: boolean }
  'chat:message': { sessionId: string; message: Message }
  'chat:toolActivity': { sessionId: string; tool: ToolName; filename: string; result: string }
  'chat:notice': { sessionId: string; message: string }
  'chat:error': { sessionId: string; message: string; kind: LlmErrorKind }
  'files:changed': { sessionId: string; file: FileArtifact }
  'files:deleted': { sessionId: string; fileId: string; filename: string }
  'session:usage': { sessionId: string; usage: TokenUsage; contextPercent: number | null }
}

export type IpcChannel = keyof IpcRequestMap
export type IpcEventName = keyof IpcEventMap
export type IpcRequest<C extends IpcChannel> = IpcRequestMap[C]['req']
export type IpcResponse<C extends IpcChannel> = IpcRequestMap[C]['res']

/**
 * The API surface exposed on `window.hatchling` by the preload script.
 * Generic-but-typed: callers get full request/response inference per channel.
 */
export interface HatchlingBridge {
  invoke<C extends IpcChannel>(channel: C, payload: IpcRequest<C>): Promise<IpcResponse<C>>
  subscribe<E extends IpcEventName>(
    event: E,
    listener: (payload: IpcEventMap[E]) => void
  ): () => void
}

/**
 * Shape the main process implements: one handler per channel, each typed to its
 * request and response. `registerIpcHandlers` (main) iterates these keys.
 */
export type IpcHandlers = {
  [C in IpcChannel]: (payload: IpcRequest<C>) => IpcResponse<C> | Promise<IpcResponse<C>>
}
