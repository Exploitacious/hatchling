import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Encryptor } from './keyVault'

// AES-256-GCM parameters.
const IV_LENGTH = 12 // 96-bit nonce, the GCM standard.
const TAG_LENGTH = 16 // 128-bit authentication tag.
const KEY_LENGTH = 32 // 256-bit key.

/**
 * Fallback encryptor for systems with no OS keychain (headless boxes, minimal
 * desktops, WSL, containers). Keys are encrypted with a per-install random key
 * that lives in a 0600 file under userData, alongside the ciphertext.
 *
 * This is deliberately weaker than the OS keychain: an attacker who can read the
 * user's data directory can read both the key file and the ciphertext. It is,
 * however, far better than plaintext and lets the app work everywhere. The UI
 * surfaces this downgrade to the user (see the Settings storage banner).
 *
 * Isolated from KeyVault (and free of any electron import) so it stays unit
 * testable with a real crypto round-trip.
 */
export function createAppKeyEncryptor(keyFilePath: string): Encryptor {
  let cachedKey: Buffer | null = null

  function loadOrCreateKey(): Buffer {
    if (cachedKey) return cachedKey
    if (existsSync(keyFilePath)) {
      const existing = readFileSync(keyFilePath)
      if (existing.length === KEY_LENGTH) {
        cachedKey = existing
        return cachedKey
      }
      // Only a wrong-length key file is detected here and regenerated. A
      // same-length but bit-corrupted key still loads, and decrypt then fails
      // its GCM auth check — KeyVault.get returns null, so those keys are simply
      // re-entered. Either way no crash, and regenerating invalidates old
      // ciphertext (which is unrecoverable regardless once the key is lost).
    }
    const key = randomBytes(KEY_LENGTH)
    mkdirSync(dirname(keyFilePath), { recursive: true })
    writeFileSync(keyFilePath, key, { mode: 0o600 })
    cachedKey = key
    return key
  }

  return {
    id: 'app-key',
    isAvailable: () => true,
    encrypt: (plaintext) => {
      const key = loadOrCreateKey()
      const iv = randomBytes(IV_LENGTH)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      const tag = cipher.getAuthTag()
      // Layout: [iv | tag | ciphertext].
      return Buffer.concat([iv, tag, ciphertext])
    },
    decrypt: (data) => {
      const key = loadOrCreateKey()
      const iv = data.subarray(0, IV_LENGTH)
      const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
      const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    }
  }
}
