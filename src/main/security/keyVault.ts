import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// Encryption backend. In production this wraps Electron's safeStorage; in tests
// a fake is injected so the vault can be exercised without an Electron runtime.
export interface Encryptor {
  isAvailable(): boolean
  encrypt(plaintext: string): Buffer
  decrypt(data: Buffer): string
}

/**
 * Encrypted API-key store. Ciphertext lives in a JSON file under userData
 * (mode 0600); plaintext keys never touch SQLite or the renderer. Keys are
 * addressed by provider id.
 */
export class KeyVault {
  private cache: Record<string, string>

  constructor(
    private readonly filePath: string,
    private readonly encryptor: Encryptor
  ) {
    this.cache = this.load()
  }

  save(providerId: string, key: string): void {
    if (!this.encryptor.isAvailable()) {
      throw new Error('OS secure storage is unavailable on this system.')
    }
    this.cache[providerId] = this.encryptor.encrypt(key).toString('base64')
    this.persist()
  }

  has(providerId: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.cache, providerId)
  }

  /** Decrypt and return the key. Main-process only — never exposed via IPC. */
  get(providerId: string): string | null {
    const ciphertext = this.cache[providerId]
    if (!ciphertext) return null
    try {
      return this.encryptor.decrypt(Buffer.from(ciphertext, 'base64'))
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

  private load(): Record<string, string> {
    try {
      if (!existsSync(this.filePath)) return {}
      const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>
      }
      return {}
    } catch {
      return {}
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.cache), { encoding: 'utf8', mode: 0o600 })
  }
}
