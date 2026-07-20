import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '../migrations'
import { seedBuiltinTemplate } from '../seed'
import {
  BUILTIN_TEMPLATE_ID,
  BUILTIN_INTERVIEW_TEMPLATE_ID,
  INTERVIEW_TEMPLATE
} from '@shared/constants'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db)
  seedBuiltinTemplate(db)
})

function contentOf(id: string): string {
  const row = db.prepare('SELECT content FROM templates WHERE id = ?').get(id) as
    | { content: string }
    | undefined
  return row?.content ?? ''
}

describe('seedBuiltinTemplate', () => {
  it('seeds both built-ins and re-running adds nothing', () => {
    seedBuiltinTemplate(db)
    const rows = db
      .prepare('SELECT id FROM templates WHERE is_builtin = 1 ORDER BY id')
      .all() as { id: string }[]
    expect(rows.map((r) => r.id).sort()).toEqual(
      [BUILTIN_TEMPLATE_ID, BUILTIN_INTERVIEW_TEMPLATE_ID].sort()
    )
  })

  it('updates a built-in in place when the shipped copy changed', () => {
    // Simulate a database seeded by an older app version with older content.
    db.prepare('UPDATE templates SET content = ? WHERE id = ?').run(
      '# BOOTSTRAP.md — outdated shipped copy',
      BUILTIN_INTERVIEW_TEMPLATE_ID
    )
    seedBuiltinTemplate(db)
    expect(contentOf(BUILTIN_INTERVIEW_TEMPLATE_ID)).toBe(INTERVIEW_TEMPLATE)
  })

  it('never touches user-created templates', () => {
    db.prepare(
      `INSERT INTO templates (id, name, content, opening_message, is_builtin, created_at, updated_at)
       VALUES ('user-1', 'Mine', 'my content', 'hi', 0, '2026-01-01', '2026-01-01')`
    ).run()
    seedBuiltinTemplate(db)
    expect(contentOf('user-1')).toBe('my content')
  })
})
