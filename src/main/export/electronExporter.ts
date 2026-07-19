import { dialog } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import JSZip from 'jszip'
import type { ExportResult } from '@shared/ipc'
import type { Exporter, ExportFile } from './exporter'

const MARKDOWN_FILTER = [{ name: 'Markdown', extensions: ['md'] }]

// Electron-backed exporter: native save/open dialogs + filesystem writes. This
// is the only place the app touches disk with file content (everything else is
// in-memory/SQLite until the user exports here).
export const electronExporter: Exporter = {
  async saveFile(file: ExportFile): Promise<ExportResult> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: file.filename,
      filters: MARKDOWN_FILTER
    })
    if (canceled || !filePath) return { saved: false }
    await writeFile(filePath, file.content, 'utf8')
    return { saved: true, path: filePath, fileCount: 1 }
  },

  async saveZip(defaultName, files): Promise<ExportResult> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'Zip archive', extensions: ['zip'] }]
    })
    if (canceled || !filePath) return { saved: false }
    const zip = new JSZip()
    for (const file of files) zip.file(file.filename, file.content)
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    await writeFile(filePath, buffer)
    return { saved: true, path: filePath, fileCount: files.length }
  },

  async saveToFolder(files): Promise<ExportResult> {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    const dir = filePaths[0]
    if (canceled || !dir) return { saved: false }
    await mkdir(dir, { recursive: true })
    for (const file of files) {
      await writeFile(join(dir, file.filename), file.content, 'utf8')
    }
    return { saved: true, path: dir, fileCount: files.length }
  },

  async saveText(defaultName, content): Promise<ExportResult> {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: MARKDOWN_FILTER
    })
    if (canceled || !filePath) return { saved: false }
    await writeFile(filePath, content, 'utf8')
    return { saved: true, path: filePath, fileCount: 1 }
  }
}
