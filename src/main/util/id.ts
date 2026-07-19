import { randomUUID } from 'node:crypto'

/** Generate a unique id for a database row. */
export function newId(): string {
  return randomUUID()
}
