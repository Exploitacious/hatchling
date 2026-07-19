import type { Database } from 'better-sqlite3'
import { BOOTSTRAP_TEMPLATE, BUILTIN_TEMPLATE_ID, DEFAULT_OPENING_MESSAGE } from '@shared/constants'
import { nowIso } from '../util/time'

// Seed the built-in OpenClaw bootstrap template on first run. Idempotent: it
// inserts only if the built-in id is absent, so re-running never duplicates or
// overwrites a user's edits to a (duplicated) copy.
export function seedBuiltinTemplate(db: Database): void {
  const exists = db
    .prepare('SELECT 1 FROM templates WHERE id = ?')
    .get(BUILTIN_TEMPLATE_ID)
  if (exists) return

  const now = nowIso()
  db.prepare(
    `INSERT INTO templates
       (id, name, description, content, opening_message, is_builtin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    BUILTIN_TEMPLATE_ID,
    'OpenClaw Standard',
    'The classic hatching ritual — wake up, figure out who you are, and write it down.',
    BOOTSTRAP_TEMPLATE,
    DEFAULT_OPENING_MESSAGE,
    now,
    now
  )
}
