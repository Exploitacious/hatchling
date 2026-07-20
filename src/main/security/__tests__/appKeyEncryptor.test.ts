import { describe, it, expect, afterAll } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createAppKeyEncryptor } from '../appKeyEncryptor'

const tempFiles: string[] = []
function keyFile(): string {
  const file = join(tmpdir(), `hatchling-appkey-${randomUUID()}.bin`)
  tempFiles.push(file)
  return file
}
afterAll(() => {
  for (const file of tempFiles) rmSync(file, { force: true })
})

describe('appKeyEncryptor', () => {
  it('is always available', () => {
    expect(createAppKeyEncryptor(keyFile()).isAvailable()).toBe(true)
  })

  it('round-trips a value and does not store plaintext', () => {
    const enc = createAppKeyEncryptor(keyFile())
    const blob = enc.encrypt('sk-super-secret')
    expect(blob.toString('utf8')).not.toContain('sk-super-secret')
    expect(enc.decrypt(blob)).toBe('sk-super-secret')
  })

  it('uses a fresh IV per encryption (no nonce reuse)', () => {
    const enc = createAppKeyEncryptor(keyFile())
    const a = enc.encrypt('same-plaintext')
    const b = enc.encrypt('same-plaintext')
    // Different IV (first 12 bytes) => different ciphertext for identical input.
    expect(a.subarray(0, 12).equals(b.subarray(0, 12))).toBe(false)
    expect(a.equals(b)).toBe(false)
    // Both still decrypt back to the original.
    expect(enc.decrypt(a)).toBe('same-plaintext')
    expect(enc.decrypt(b)).toBe('same-plaintext')
  })

  it('creates the key file with 0600 permissions', () => {
    const file = keyFile()
    createAppKeyEncryptor(file).encrypt('x')
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file).length).toBe(32)
    // Mode bits (owner-only rw). Skip the assertion on platforms without POSIX modes.
    if (process.platform !== 'win32') {
      expect(statSync(file).mode & 0o777).toBe(0o600)
    }
  })

  it('reuses the same key file across instances', () => {
    const file = keyFile()
    const blob = createAppKeyEncryptor(file).encrypt('persist-me')
    // A fresh instance pointed at the same key file decrypts the old ciphertext.
    expect(createAppKeyEncryptor(file).decrypt(blob)).toBe('persist-me')
  })

  it('rejects tampered ciphertext (GCM authentication)', () => {
    const enc = createAppKeyEncryptor(keyFile())
    const blob = enc.encrypt('authentic')
    blob[blob.length - 1] ^= 0xff // flip a byte in the ciphertext
    expect(() => enc.decrypt(blob)).toThrow()
  })

  it('regenerates a corrupt (wrong-length) key file instead of crashing', () => {
    const file = keyFile()
    writeFileSync(file, Buffer.from('too-short'))
    const enc = createAppKeyEncryptor(file)
    const blob = enc.encrypt('recovered')
    expect(readFileSync(file).length).toBe(32)
    expect(enc.decrypt(blob)).toBe('recovered')
  })
})
