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
      'The bot leads. It looks inward at its own strengths, then interviews you deeply — a little like being courted — to design your working friendship on purpose.',
    content: INTERVIEW_TEMPLATE,
    openingMessage: INTERVIEW_OPENING_MESSAGE
  }
]

// Seed the built-in templates. Idempotent per id: inserts only the built-ins
// that are absent, so re-running never duplicates or overwrites a user's edits,
// and a newly added built-in appears for existing databases on the next launch.
export function seedBuiltinTemplate(db: Database): void {
  const findStmt = db.prepare('SELECT 1 FROM templates WHERE id = ?')
  const insertStmt = db.prepare(
    `INSERT INTO templates
       (id, name, description, content, opening_message, is_builtin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  )
  for (const t of BUILTIN_TEMPLATES) {
    if (findStmt.get(t.id)) continue
    const now = nowIso()
    insertStmt.run(t.id, t.name, t.description, t.content, t.openingMessage, now, now)
  }
}
