import { describe, it, expect, afterAll } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { KeyVault, type Encryptor } from '../keyVault'

function makeFake(id: string, available = true): Encryptor {
  return {
    id,
    isAvailable: () => available,
    encrypt: (plaintext) => Buffer.from(`${id}:${plaintext}`, 'utf8'),
    decrypt: (data) => data.toString('utf8').replace(new RegExp(`^${id}:`), '')
  }
}

const keychain = makeFake('os-keychain')
const appKey = makeFake('app-key')

const tempFiles: string[] = []
function tempFile(): string {
  const file = join(tmpdir(), `hatchling-kv-${randomUUID()}.json`)
  tempFiles.push(file)
  return file
}
afterAll(() => {
  for (const file of tempFiles) rmSync(file, { force: true })
})

describe('KeyVault', () => {
  it('saves, checks, reads, and deletes keys', () => {
    const kv = new KeyVault(tempFile(), keychain)
    expect(kv.has('p1')).toBe(false)
    kv.save('p1', 'secret-key')
    expect(kv.has('p1')).toBe(true)
    expect(kv.get('p1')).toBe('secret-key')
    kv.delete('p1')
    expect(kv.has('p1')).toBe(false)
    expect(kv.get('p1')).toBeNull()
  })

  it('persists keys across instances and stores ciphertext, not plaintext', () => {
    const file = tempFile()
    new KeyVault(file, keychain).save('p2', 'plaintext-secret')

    const reopened = new KeyVault(file, keychain)
    expect(reopened.get('p2')).toBe('plaintext-secret')

    const raw = readFileSync(file, 'utf8')
    expect(raw).not.toContain('plaintext-secret')
  })

  it('throws when no backend is available', () => {
    const kv = new KeyVault(tempFile(), makeFake('os-keychain', false))
    expect(() => kv.save('p', 'x')).toThrow()
  })

  it('reports the active storage mode', () => {
    expect(new KeyVault(tempFile(), keychain).storageMode()).toBe('os-keychain')
    expect(new KeyVault(tempFile(), appKey).storageMode()).toBe('app-key')
    expect(new KeyVault(tempFile(), makeFake('os-keychain', false)).storageMode()).toBe(
      'unavailable'
    )
  })

  it('falls back to the next available backend when the preferred one is out', () => {
    const kv = new KeyVault(tempFile(), [makeFake('os-keychain', false), appKey])
    expect(kv.storageMode()).toBe('app-key')
    kv.save('p', 'k')
    expect(kv.get('p')).toBe('k')
  })

  it('decrypts an entry with the backend that wrote it', () => {
    const file = tempFile()
    // Written while only the app-key backend was available.
    new KeyVault(file, [makeFake('os-keychain', false), appKey]).save('p', 'via-app-key')
    // Reopened once the keychain is back — still decrypts the old entry, and the
    // ciphertext is tagged with the backend that produced it.
    const reopened = new KeyVault(file, [keychain, appKey])
    expect(reopened.storageMode()).toBe('os-keychain')
    expect(reopened.get('p')).toBe('via-app-key')
    expect(readFileSync(file, 'utf8')).toContain('app-key')
  })

  it('migrates a legacy bare-string entry as an os-keychain key', () => {
    const file = tempFile()
    // Simulate a pre-fallback keys.json: providerId -> base64 ciphertext string.
    const legacyCipher = keychain.encrypt('legacy-secret').toString('base64')
    writeFileSync(file, JSON.stringify({ p: legacyCipher }), 'utf8')

    const kv = new KeyVault(file, [keychain, appKey])
    expect(kv.get('p')).toBe('legacy-secret')
  })

  it('returns null when no backend can decrypt an entry', () => {
    const file = tempFile()
    new KeyVault(file, appKey).save('p', 'orphan')
    // Reopen without the app-key backend registered.
    const reopened = new KeyVault(file, keychain)
    expect(reopened.has('p')).toBe(true)
    expect(reopened.get('p')).toBeNull()
  })
})
