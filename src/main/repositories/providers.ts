import type { Db } from '../db/connection'
import type {
  CreateProviderInput,
  Provider,
  ProviderShape,
  UpdateProviderInput
} from '@shared/types'
import { newId } from '../util/id'
import { nowIso } from '../util/time'

const VALID_SHAPES: readonly ProviderShape[] = ['openai-compatible', 'anthropic', 'ollama', 'mock']

interface ProviderRow {
  id: string
  shape: string
  name: string
  base_url: string | null
  is_oauth: number
  created_at: string
}

function mapRow(row: ProviderRow): Provider {
  return {
    id: row.id,
    shape: row.shape as ProviderShape,
    name: row.name,
    baseUrl: row.base_url,
    isOauth: row.is_oauth === 1,
    createdAt: row.created_at
  }
}

export class ProvidersRepository {
  constructor(private readonly db: Db) {}

  list(): Provider[] {
    const rows = this.db
      .prepare('SELECT * FROM providers ORDER BY created_at ASC')
      .all() as ProviderRow[]
    return rows.map(mapRow)
  }

  get(id: string): Provider | null {
    const row = this.db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as
      | ProviderRow
      | undefined
    return row ? mapRow(row) : null
  }

  create(input: CreateProviderInput): Provider {
    if (!VALID_SHAPES.includes(input.shape)) {
      throw new Error(`Unknown provider shape: ${input.shape}`)
    }
    const id = newId()
    this.db
      .prepare(
        `INSERT INTO providers (id, shape, name, base_url, is_oauth, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`
      )
      .run(id, input.shape, input.name, input.baseUrl ?? null, nowIso())
    return this.getOrThrow(id)
  }

  update(input: UpdateProviderInput): Provider {
    const existing = this.get(input.id)
    if (!existing) throw new Error(`Provider not found: ${input.id}`)
    this.db
      .prepare('UPDATE providers SET name = ?, base_url = ? WHERE id = ?')
      .run(
        input.name ?? existing.name,
        input.baseUrl !== undefined ? input.baseUrl : existing.baseUrl,
        input.id
      )
    return this.getOrThrow(input.id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM providers WHERE id = ?').run(id)
  }

  private getOrThrow(id: string): Provider {
    const row = this.get(id)
    if (!row) throw new Error(`Provider not found after write: ${id}`)
    return row
  }
}
