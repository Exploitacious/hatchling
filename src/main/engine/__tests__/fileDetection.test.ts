import { describe, it, expect } from 'vitest'
import { detectInlineFiles } from '../fileDetection'

describe('detectInlineFiles', () => {
  it('extracts a file from a fenced block with a title attribute', () => {
    const text = 'Here you go:\n\n```markdown title="SOUL.md"\n# Soul\nbody\n```\n'
    expect(detectInlineFiles(text)).toEqual([{ filename: 'SOUL.md', content: '# Soul\nbody' }])
  })

  it('extracts a file named on the line before the fence', () => {
    const text = "I'll write IDENTITY.md:\n\n```markdown\n# Identity\n```"
    const files = detectInlineFiles(text)
    expect(files[0].filename).toBe('IDENTITY.md')
    expect(files[0].content).toBe('# Identity')
  })

  it('extracts from a bold filename label above the fence', () => {
    const files = detectInlineFiles('**USER.md**\n\n```\nname: River\n```')
    expect(files[0].filename).toBe('USER.md')
    expect(files[0].content).toBe('name: River')
  })

  it('ignores a fenced block with no detectable filename', () => {
    expect(detectInlineFiles('Some code:\n\n```js\nconsole.log(1)\n```')).toEqual([])
  })

  it('reduces a path to its basename', () => {
    expect(detectInlineFiles('```markdown title="workspace/SOUL.md"\nx\n```')[0].filename).toBe(
      'SOUL.md'
    )
  })

  it('dedupes by filename, keeping the last content', () => {
    const text = '```md title="A.md"\nfirst\n```\n\n```md title="A.md"\nsecond\n```'
    const files = detectInlineFiles(text)
    expect(files).toHaveLength(1)
    expect(files[0].content).toBe('second')
  })

  it('returns nothing when there are no fences', () => {
    expect(detectInlineFiles('just talking, no code here')).toEqual([])
  })
})
