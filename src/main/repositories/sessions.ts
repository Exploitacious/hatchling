import type { Db } from '../db/connection'
import type { Session, SessionStatus, TokenUsage, UpdateSessionInput } from '@shared/types'
import { newId } from '../util/id'
import { nowIso } from '../util/time'

export interface NewSessionRecord {
  name: string
  templateId: string | null
  templateSnapshot: string
  openingMessage: string
  providerId: string | null
  model: string
  contextWindow?: number | null
  temperature?: number | null
}

interface SessionRow {
  id: string
  name: string
  template_id: string | null
  template_snap: string
  opening_message: string
  provider_id: string | null
  model: string
  status: string
  token_usage: string
  context_window: number | null
  temperature: number | null
  created_at: string
  completed_at: string | null
}

function parseUsage(raw: string): TokenUsage {
  try {
    const parsed = JSON.parse(raw) as Partial<TokenUsage>
    return {
      input: parsed.input ?? 0,
      output: parsed.output ?? 0,
      total: parsed.total ?? 0
    }
  } catch {
    return { input: 0, output: 0, total: 0 }
  }
}

function mapRow(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    templateSnapshot: row.template_snap,
    openingMessage: row.opening_message,
    providerId: row.provider_id,
    model: row.model,
    status: row.status as SessionStatus,
    tokenUsage: parseUsage(row.token_usage),
    contextWindow: row.context_window,
    temperature: row.temperature,
    createdAt: row.created_at,
    completedAt: row.completed_at
  }
}

export class SessionsRepository {
  constructor(private readonly db: Db) {}

  list(): Session[] {
    const rows = this.db
      .prepare('SELECT * FROM sessions ORDER BY created_at DESC')
      .all() as SessionRow[]
    return rows.map(mapRow)
  }

  get(id: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | SessionRow
      | undefined
    return row ? mapRow(row) : null
  }

  create(rec: NewSessionRecord): Session {
    const id = newId()
    this.db
      .prepare(
        `INSERT INTO sessions
           (id, name, template_id, template_snap, opening_message, provider_id, model,
            status, token_usage, context_window, temperature, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?, NULL)`
      )
      .run(
        id,
        rec.name,
        rec.templateId,
        rec.templateSnapshot,
        rec.openingMessage,
        rec.providerId,
        rec.model,
        JSON.stringify({ input: 0, output: 0, total: 0 }),
        rec.contextWindow ?? null,
        rec.temperature ?? null,
        nowIso()
      )
    return this.getOrThrow(id)
  }

  update(input: UpdateSessionInput): Session {
    const existing = this.get(input.id)
    if (!existing) throw new Error(`Session not found: ${input.id}`)
    if (input.name !== undefined) {
      this.db.prepare('UPDATE sessions SET name = ? WHERE id = ?').run(input.name, input.id)
    }
    if (input.status !== undefined) {
      this.setStatus(input.id, input.status)
    }
    return this.getOrThrow(input.id)
  }

  setStatus(id: string, status: SessionStatus): Session {
    const completedAt = status === 'completed' ? nowIso() : null
    this.db
      .prepare('UPDATE sessions SET status = ?, completed_at = ? WHERE id = ?')
      .run(status, completedAt, id)
    return this.getOrThrow(id)
  }

  setTokenUsage(id: string, usage: TokenUsage): Session {
    this.db
      .prepare('UPDATE sessions SET token_usage = ? WHERE id = ?')
      .run(JSON.stringify(usage), id)
    return this.getOrThrow(id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  }

  private getOrThrow(id: string): Session {
    const row = this.get(id)
    if (!row) throw new Error(`Session not found after write: ${id}`)
    return row
  }
}
