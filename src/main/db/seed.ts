import type { Database } from 'better-sqlite3'
import {
  BOOTSTRAP_TEMPLATE,
  BUILTIN_TEMPLATE_ID,
  BUILTIN_INTERVIEW_TEMPLATE_ID,
  DEFAULT_OPENING_MESSAGE,
  INTERVIEW_OPENING_MESSAGE,
  INTERVIEW_TEMPLATE
} from '@shared/constants'
import { nowIso } from '../util/time'

interface BuiltinTemplate {
  id: string
  name: string
  description: string
  content: string
  openingMessage: string
}

// The templates shipped with the app. Order matters: the first is the default
// the New Hatch picker preselects.
const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  {
    id: BUILTIN_TEMPLATE_ID,
    name: 'OpenClaw Standard',
    description: 'The classic hatching ritual — wake up, figure out who you are, and write it down.',
    content: BOOTSTRAP_TEMPLATE,
    openingMessage: DEFAULT_OPENING_MESSAGE
  },
  {
    id: BUILTIN_INTERVIEW_TEMPLATE_ID,
    name: 'The Interview',
    description:
      'The bot interviews you — deep, specific, all about your world — and quietly shapes itself into the partner you actually need.',
    content: INTERVIEW_TEMPLATE,
    openingMessage: INTERVIEW_OPENING_MESSAGE
  }
]

interface TemplateRow {
  name: string
  description: string | null
  content: string
  opening_message: string
}

// Seed the built-in templates. Absent built-ins are inserted; present ones are
// updated in place when the shipped copy changed. Upserting is safe precisely
// because built-ins are read-only in the app (the templates repository refuses
// to edit or delete them), so there are no user edits to clobber — and existing
// databases pick up improved built-ins on the next launch. User-created
// templates are never touched.
export function seedBuiltinTemplate(db: Database): void {
  const findStmt = db.prepare(
    'SELECT name, description, content, opening_message FROM templates WHERE id = ?'
  )
  const insertStmt = db.prepare(
    `INSERT INTO templates
       (id, name, description, content, opening_message, is_builtin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  )
  const updateStmt = db.prepare(
    `UPDATE templates
        SET name = ?, description = ?, content = ?, opening_message = ?, updated_at = ?
      WHERE id = ?`
  )
  for (const t of BUILTIN_TEMPLATES) {
    const existing = findStmt.get(t.id) as TemplateRow | undefined
    if (!existing) {
      const now = nowIso()
      insertStmt.run(t.id, t.name, t.description, t.content, t.openingMessage, now, now)
    } else if (
      existing.name !== t.name ||
      existing.description !== t.description ||
      existing.content !== t.content ||
      existing.opening_message !== t.openingMessage
    ) {
      updateStmt.run(t.name, t.description, t.content, t.openingMessage, nowIso(), t.id)
    }
  }
}
