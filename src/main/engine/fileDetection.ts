export interface DetectedFile {
  filename: string
  content: string
}

// Fallback file detection for models that describe files inline instead of
// calling the write_file tool. Scans assistant text for fenced code blocks and
// pairs each with a filename found either in the fence info string
// (```markdown title="SOUL.md") or in the line(s) immediately preceding the
// fence (a bold **SOUL.md** label, or "writing SOUL.md:"). Pure and tested.

// A filename token: a name ending in a known text-file extension.
const FILENAME_RE = /([A-Za-z0-9][\w.\-/]*\.(?:md|markdown|txt|json|ya?ml))/i

// Fenced code block: opening ``` + optional info string, body, closing ```.
const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g

function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] ?? path
}

function filenameFromInfo(info: string): string | null {
  const titled = info.match(/title\s*=\s*["']([^"']+)["']/i)
  if (titled) {
    const inner = titled[1].match(FILENAME_RE)
    return inner ? basename(inner[1]) : null
  }
  const bare = info.match(FILENAME_RE)
  return bare ? basename(bare[1]) : null
}

function filenameFromPreamble(textBeforeFence: string): string | null {
  const lines = textBeforeFence
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  // Look at the last few non-empty lines before the fence.
  for (let i = lines.length - 1; i >= 0 && i >= lines.length - 3; i--) {
    const match = lines[i].match(FILENAME_RE)
    if (match) return basename(match[1])
  }
  return null
}

/**
 * Extract inline files from assistant text. De-duplicated by filename (the last
 * occurrence wins, so a re-stated file uses its most complete content).
 */
export function detectInlineFiles(text: string): DetectedFile[] {
  const found = new Map<string, string>()
  FENCE_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = FENCE_RE.exec(text)) !== null) {
    const info = match[1] ?? ''
    const body = match[2] ?? ''
    if (body.trim().length === 0) continue

    const filename =
      filenameFromInfo(info) ?? filenameFromPreamble(text.slice(0, match.index))
    if (!filename) continue

    // Strip a single trailing newline the fence grammar leaves on the body.
    found.set(filename, body.replace(/\n$/, ''))
  }

  return Array.from(found, ([filename, content]) => ({ filename, content }))
}
