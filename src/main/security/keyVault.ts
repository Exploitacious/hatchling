import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { KeyStorageMode } from '@shared/types'

// Encryption backend. In production these wrap Electron's safeStorage (the OS
// keychain) and a crypto fallback; in tests a fake is injected so the vault can
// be exercised without an Electron runtime.
export interface Encryptor {
  /** Stable identifier, persisted with each entry so the right backend decrypts it. */
  readonly id: string
  isAvailable(): boolean
  encrypt(plaintext: string): Buffer
  decrypt(data: Buffer): string
}

/** On-disk shape of a stored key: which backend wrote it + base64 ciphertext. */
interface StoredKey {
  backend: string
  data: string
}

function isStoredKey(value: unknown): value is StoredKey {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredKey).backend === 'string' &&
    typeof (value as StoredKey).data === 'string'
  )
}

/**
 * Encrypted API-key store. Ciphertext lives in a JSON file under userData
 * (mode 0600); plaintext keys never touch SQLite or the renderer. Keys are
 * addressed by provider id, and each entry records which backend encrypted it so
 * the vault can still decrypt after a keychain becomes (un)available.
 *
 * Encryptors are supplied in preference order: the first available one is used
 * for new saves; any of them may be used to decrypt an existing entry.
 */
export class KeyVault {
  private cache: Record<string, StoredKey>
  private readonly encryptors: Encryptor[]

  constructor(
    private readonly filePath: string,
    encryptors: Encryptor | Encryptor[]
  ) {
    this.encryptors = Array.isArray(encryptors) ? encryptors : [encryptors]
    this.cache = this.load()
  }

  /** The backend new saves will use, or 'unavailable' if none can store a key. */
  storageMode(): KeyStorageMode {
    const active = this.activeEncryptor()
    if (!active) return 'unavailable'
    return active.id === 'os-keychain' ? 'os-keychain' : 'app-key'
  }

  save(providerId: string, key: string): void {
    const active = this.activeEncryptor()
    if (!active) {
      throw new Error('OS secure storage is unavailable on this system.')
    }
    this.cache[providerId] = {
      backend: active.id,
      data: active.encrypt(key).toString('base64')
    }
    this.persist()
  }

  has(providerId: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.cache, providerId)
  }

  /** Decrypt and return the key. Main-process only — never exposed via IPC. */
  get(providerId: string): string | null {
    const entry = this.cache[providerId]
    if (!entry) return null
    const encryptor = this.encryptors.find((e) => e.id === entry.backend)
    if (!encryptor) return null
    try {
      return encryptor.decrypt(Buffer.from(entry.data, 'base64'))
    } catch {
      return null
    }
  }

  delete(providerId: string): void {
    if (this.has(providerId)) {
      delete this.cache[providerId]
      this.persist()
    }
  }

  private activeEncryptor(): Encryptor | null {
    return this.encryptors.find((e) => e.isAvailable()) ?? null
  }

  private load(): Record<string, StoredKey> {
    try {
      if (!existsSync(this.filePath)) return {}
      const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
      const result: Record<string, StoredKey> = {}
      for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (isStoredKey(value)) {
          result[id] = value
        } else if (typeof value === 'string') {
          // Legacy format (pre-fallback): a bare base64 string, always written by
          // the safeStorage backend. Tag it so it stays decryptable after upgrade.
          result[id] = { backend: 'os-keychain', data: value }
        }
      }
      return result
    } catch {
      return {}
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.cache), { encoding: 'utf8', mode: 0o600 })
  }
}
