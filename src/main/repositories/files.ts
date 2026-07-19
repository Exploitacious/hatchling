import type { Db } from '../db/connection'
import type { FileArtifact } from '@shared/types'
import { newId } from '../util/id'
import { nowIso } from '../util/time'

interface FileRow {
  id: string
  session_id: string
  filename: string
  content: string
  size_bytes: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function byteLength(content: string): number {
  return Buffer.byteLength(content, 'utf8')
}

function mapRow(row: FileRow): FileArtifact {
  return {
    id: row.id,
    sessionId: row.session_id,
    filename: row.filename,
    content: row.content,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  }
}

export class FilesRepository {
  constructor(private readonly db: Db) {}

  listBySession(sessionId: string, includeDeleted = true): FileArtifact[] {
    const sql = includeDeleted
      ? 'SELECT * FROM files WHERE session_id = ? ORDER BY created_at ASC'
      : 'SELECT * FROM files WHERE session_id = ? AND deleted_at IS NULL ORDER BY created_at ASC'
    const rows = this.db.prepare(sql).all(sessionId) as FileRow[]
    return rows.map(mapRow)
  }

  get(id: string): FileArtifact | null {
    const row = this.db.prepare('SELECT * FROM files WHERE id = ?').get(id) as FileRow | undefined
    return row ? mapRow(row) : null
  }

  /** Look up a live (non-deleted) file by name within a session. */
  getByFilename(sessionId: string, filename: string): FileArtifact | null {
    const row = this.db
      .prepare('SELECT * FROM files WHERE session_id = ? AND filename = ? AND deleted_at IS NULL')
      .get(sessionId, filename) as FileRow | undefined
    return row ? mapRow(row) : null
  }

  /**
   * Create or update a file by name (the write_file tool path). Writing a
   * previously deleted filename resurrects it. Idempotent per (session,
   * filename): the same filename never produces a duplicate row.
   */
  write(sessionId: string, filename: string, content: string): FileArtifact {
    const now = nowIso()
    const size = byteLength(content)
    const existing = this.db
      .prepare('SELECT * FROM files WHERE session_id = ? AND filename = ?')
      .get(sessionId, filename) as FileRow | undefined

    if (existing) {
      this.db
        .prepare(
          'UPDATE files SET content = ?, size_bytes = ?, updated_at = ?, deleted_at = NULL WHERE id = ?'
        )
        .run(content, size, now, existing.id)
      return this.getOrThrow(existing.id)
    }

    const id = newId()
    this.db
      .prepare(
        `INSERT INTO files
           (id, session_id, filename, content, size_bytes, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(id, sessionId, filename, content, size, now, now)
    return this.getOrThrow(id)
  }

  /** Update the content of an existing file by id (post-hatch editing). */
  updateContent(id: string, content: string): FileArtifact {
    const existing = this.get(id)
    if (!existing) throw new Error(`File not found: ${id}`)
    this.db
      .prepare('UPDATE files SET content = ?, size_bytes = ?, updated_at = ? WHERE id = ?')
      .run(content, byteLength(content), nowIso(), id)
    return this.getOrThrow(id)
  }

  /** Soft-delete a live file by name. Returns the affected file, or null. */
  softDelete(sessionId: string, filename: string): FileArtifact | null {
    const existing = this.getByFilename(sessionId, filename)
    if (!existing) return null
    this.db
      .prepare('UPDATE files SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(nowIso(), nowIso(), existing.id)
    return this.getOrThrow(existing.id)
  }

  private getOrThrow(id: string): FileArtifact {
    const file = this.get(id)
    if (!file) throw new Error(`File not found after write: ${id}`)
    return file
  }
}
