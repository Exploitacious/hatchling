import type { Db } from '../db/connection'
import type { CreateTemplateInput, Template, UpdateTemplateInput } from '@shared/types'
import { DEFAULT_OPENING_MESSAGE } from '@shared/constants'
import { newId } from '../util/id'
import { nowIso } from '../util/time'

interface TemplateRow {
  id: string
  name: string
  description: string | null
  content: string
  opening_message: string
  is_builtin: number
  created_at: string
  updated_at: string
}

function mapRow(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    openingMessage: row.opening_message,
    isBuiltin: row.is_builtin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class TemplatesRepository {
  constructor(private readonly db: Db) {}

  list(): Template[] {
    const rows = this.db
      .prepare('SELECT * FROM templates ORDER BY is_builtin DESC, updated_at DESC')
      .all() as TemplateRow[]
    return rows.map(mapRow)
  }

  get(id: string): Template | null {
    const row = this.db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as
      | TemplateRow
      | undefined
    return row ? mapRow(row) : null
  }

  create(input: CreateTemplateInput): Template {
    const id = newId()
    const now = nowIso()
    this.db
      .prepare(
        `INSERT INTO templates
           (id, name, description, content, opening_message, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.description ?? null,
        input.content,
        input.openingMessage ?? DEFAULT_OPENING_MESSAGE,
        now,
        now
      )
    return this.getOrThrow(id)
  }

  update(input: UpdateTemplateInput): Template {
    const existing = this.get(input.id)
    if (!existing) throw new Error(`Template not found: ${input.id}`)
    if (existing.isBuiltin) {
      throw new Error('The built-in template is read-only. Duplicate it to edit.')
    }
    this.db
      .prepare(
        `UPDATE templates
           SET name = ?, description = ?, content = ?, opening_message = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.name ?? existing.name,
        input.description !== undefined ? input.description : existing.description,
        input.content ?? existing.content,
        input.openingMessage ?? existing.openingMessage,
        nowIso(),
        input.id
      )
    return this.getOrThrow(input.id)
  }

  delete(id: string): void {
    const existing = this.get(id)
    if (existing?.isBuiltin) throw new Error('The built-in template cannot be deleted.')
    this.db.prepare('DELETE FROM templates WHERE id = ?').run(id)
  }

  private getOrThrow(id: string): Template {
    const row = this.get(id)
    if (!row) throw new Error(`Template not found after write: ${id}`)
    return row
  }
}
