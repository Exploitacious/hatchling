import type { Database } from 'better-sqlite3'

// Versioned, forward-only migrations. The current schema version is tracked in
// SQLite's `user_version` pragma. To evolve the schema, append a new migration
// with the next version number — never edit a shipped one.

export interface Migration {
  version: number
  up: (db: Database) => void
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE templates (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          description     TEXT,
          content         TEXT NOT NULL,
          opening_message TEXT NOT NULL DEFAULT 'Wake up, my friend!',
          is_builtin      INTEGER NOT NULL DEFAULT 0,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL
        );

        CREATE TABLE providers (
          id          TEXT PRIMARY KEY,
          shape       TEXT NOT NULL,
          name        TEXT NOT NULL,
          base_url    TEXT,
          is_oauth    INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL
        );

        CREATE TABLE sessions (
          id               TEXT PRIMARY KEY,
          name             TEXT NOT NULL,
          template_id      TEXT REFERENCES templates(id) ON DELETE SET NULL,
          template_snap    TEXT NOT NULL,
          opening_message  TEXT NOT NULL,
          provider_id      TEXT REFERENCES providers(id) ON DELETE SET NULL,
          model            TEXT NOT NULL,
          status           TEXT NOT NULL DEFAULT 'in_progress',
          token_usage      TEXT NOT NULL DEFAULT '{"input":0,"output":0,"total":0}',
          created_at       TEXT NOT NULL,
          completed_at     TEXT
        );

        CREATE TABLE messages (
          id            TEXT PRIMARY KEY,
          session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          role          TEXT NOT NULL,
          content       TEXT NOT NULL DEFAULT '',
          tool_calls    TEXT,
          tool_call_id  TEXT,
          tokens        INTEGER,
          created_at    TEXT NOT NULL
        );

        CREATE TABLE files (
          id          TEXT PRIMARY KEY,
          session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          filename    TEXT NOT NULL,
          content     TEXT NOT NULL DEFAULT '',
          size_bytes  INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL,
          deleted_at  TEXT
        );

        CREATE INDEX idx_messages_session ON messages (session_id, created_at);
        CREATE INDEX idx_files_session ON files (session_id);
      `)
    }
  },
  {
    version: 2,
    up: (db) => {
      // Advanced per-session model settings. context_window: effective window
      // (tokens) resolved at creation — a user override or the model's reported
      // window; NULL = unknown, use the DEFAULT_CONTEXT_WINDOW fallback and
      // label usage "estimated". temperature: optional sampling override;
      // NULL = provider default.
      db.exec(`
        ALTER TABLE sessions ADD COLUMN context_window INTEGER;
        ALTER TABLE sessions ADD COLUMN temperature REAL;
      `)
    }
  }
]

/** Apply every migration newer than the database's current schema version. */
export function runMigrations(db: Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version
  )

  for (const migration of pending) {
    const apply = db.transaction(() => migration.up(db))
    apply()
    // user_version cannot be parameterized; the value is a trusted integer.
    db.pragma(`user_version = ${migration.version}`)
  }
}

/** The schema version the code expects — the highest migration version. */
export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version
