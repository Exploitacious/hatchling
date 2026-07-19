import { safeStorage } from 'electron'
import type { Encryptor } from './keyVault'

// Production encryptor backed by the OS keychain via Electron safeStorage.
// Isolated in its own module so the (testable) KeyVault never imports electron.
export const safeStorageEncryptor: Encryptor = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plaintext) => safeStorage.encryptString(plaintext),
  decrypt: (data) => safeStorage.decryptString(data)
}
