import type { Db } from '../db/connection'
import type { Message, MessageRole, ToolCall } from '@shared/types'
import { newId } from '../util/id'
import { nowIso } from '../util/time'

export interface NewMessageRecord {
  /** Optional explicit id — lets the engine reuse a streamed message's id. */
  id?: string
  sessionId: string
  role: MessageRole
  content: string
  toolCalls?: ToolCall[] | null
  toolCallId?: string | null
  tokens?: number | null
}

interface MessageRow {
  id: string
  session_id: string
  role: string
  content: string
  tool_calls: string | null
  tool_call_id: string | null
  tokens: number | null
  created_at: string
}

function parseToolCalls(raw: string | null): ToolCall[] | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as ToolCall[]
  } catch {
    return null
  }
}

function mapRow(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as MessageRole,
    content: row.content,
    toolCalls: parseToolCalls(row.tool_calls),
    toolCallId: row.tool_call_id,
    tokens: row.tokens,
    createdAt: row.created_at
  }
}

export class MessagesRepository {
  constructor(private readonly db: Db) {}

  create(rec: NewMessageRecord): Message {
    const id = rec.id ?? newId()
    this.db
      .prepare(
        `INSERT INTO messages
           (id, session_id, role, content, tool_calls, tool_call_id, tokens, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        rec.sessionId,
        rec.role,
        rec.content,
        rec.toolCalls && rec.toolCalls.length > 0 ? JSON.stringify(rec.toolCalls) : null,
        rec.toolCallId ?? null,
        rec.tokens ?? null,
        nowIso()
      )
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow
    return mapRow(row)
  }

  listBySession(sessionId: string): Message[] {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC')
      .all(sessionId) as MessageRow[]
    return rows.map(mapRow)
  }
}
