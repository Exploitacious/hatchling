import { describe, it, expect, afterAll } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { KeyVault, type Encryptor } from '../keyVault'

const fakeEncryptor: Encryptor = {
  isAvailable: () => true,
  encrypt: (plaintext) => Buffer.from(`enc:${plaintext}`, 'utf8'),
  decrypt: (data) => data.toString('utf8').replace(/^enc:/, '')
}

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
    const kv = new KeyVault(tempFile(), fakeEncryptor)
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
    new KeyVault(file, fakeEncryptor).save('p2', 'plaintext-secret')

    const reopened = new KeyVault(file, fakeEncryptor)
    expect(reopened.get('p2')).toBe('plaintext-secret')

    const raw = readFileSync(file, 'utf8')
    expect(raw).not.toContain('plaintext-secret')
  })

  it('throws when secure storage is unavailable', () => {
    const kv = new KeyVault(tempFile(), { ...fakeEncryptor, isAvailable: () => false })
    expect(() => kv.save('p', 'x')).toThrow()
  })
})
