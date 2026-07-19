import type { ExportResult } from '@shared/ipc'

export interface ExportFile {
  filename: string
  content: string
}

/**
 * Writes files to disk via native dialogs. Injected into the IPC layer so the
 * (electron-free, testable) handlers can drive export while the real dialog/fs
 * work lives in an electron-backed implementation.
 */
export interface Exporter {
  saveFile(file: ExportFile): Promise<ExportResult>
  saveZip(defaultName: string, files: ExportFile[]): Promise<ExportResult>
  saveToFolder(files: ExportFile[]): Promise<ExportResult>
  saveText(defaultName: string, content: string): Promise<ExportResult>
}

/** Make a string safe to use as a filename. */
export function sanitizeName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned.length > 0 ? cleaned : 'hatch'
}
