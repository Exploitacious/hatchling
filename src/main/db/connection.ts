import Database from 'better-sqlite3'
import { runMigrations } from './migrations'
import { seedBuiltinTemplate } from './seed'

export type Db = Database.Database

/**
 * Open (or create) the SQLite database, apply pragmas, run migrations, and seed
 * the built-in template. Pass ':memory:' for tests.
 */
export function openDatabase(filename: string): Db {
  const db = new Database(filename)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  seedBuiltinTemplate(db)
  return db
}
