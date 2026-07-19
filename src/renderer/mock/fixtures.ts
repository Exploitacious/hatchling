import type { FileArtifact, Message } from '@shared/types'

// Static fixtures used by the Phase-2 chat interface before the real
// conversation engine (Phase 3) is wired in. They demonstrate the hatching
// flow: opening message, bot reply, user reply, and file creation.

const SESSION_ID = 'mock-session'
const T = (min: number): string => `2026-01-01T12:${String(min).padStart(2, '0')}:00.000Z`

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    sessionId: SESSION_ID,
    role: 'user',
    content: 'Wake up, my friend!',
    toolCalls: null,
    toolCallId: null,
    tokens: 6,
    createdAt: T(0)
  },
  {
    id: 'm2',
    sessionId: SESSION_ID,
    role: 'assistant',
    content:
      "Hey — I just came online. I don't know who I am yet, and I barely know you. Let's fix that. What should you call me, and what kind of vibe feels right?",
    toolCalls: null,
    toolCallId: null,
    tokens: 38,
    createdAt: T(1)
  },
  {
    id: 'm3',
    sessionId: SESSION_ID,
    role: 'user',
    content: "Let's call you Ember. Warm, curious, a little playful.",
    toolCalls: null,
    toolCallId: null,
    tokens: 14,
    createdAt: T(2)
  },
  {
    id: 'm4',
    sessionId: SESSION_ID,
    role: 'assistant',
    content: 'Love it. Let me write that down.',
    toolCalls: [
      {
        id: 'tc1',
        name: 'write_file',
        arguments: { filename: 'IDENTITY.md', content: '# IDENTITY.md\n\n- Name: Ember' }
      }
    ],
    toolCallId: null,
    tokens: 20,
    createdAt: T(3)
  },
  {
    id: 'm5',
    sessionId: SESSION_ID,
    role: 'tool',
    content: 'File written: IDENTITY.md (0.3 KB)',
    toolCalls: null,
    toolCallId: 'tc1',
    tokens: null,
    createdAt: T(3)
  },
  {
    id: 'm6',
    sessionId: SESSION_ID,
    role: 'assistant',
    content: "That's the start of me. Tell me a bit about you next — what should I call you?",
    toolCalls: null,
    toolCallId: null,
    tokens: 22,
    createdAt: T(4)
  }
]

export const MOCK_FILES: FileArtifact[] = [
  {
    id: 'f1',
    sessionId: SESSION_ID,
    filename: 'IDENTITY.md',
    content:
      '# IDENTITY.md\n\n- **Name:** Ember\n- **Creature:** a small hearth-spirit\n- **Vibe:** warm, curious, a little playful\n- **Emoji:** 🔥\n',
    sizeBytes: 320,
    createdAt: T(3),
    updatedAt: T(3),
    deletedAt: null
  },
  {
    id: 'f2',
    sessionId: SESSION_ID,
    filename: 'USER.md',
    content: '# USER.md\n\n- **Call them:** friend\n',
    sizeBytes: 96,
    createdAt: T(4),
    updatedAt: T(4),
    deletedAt: null
  }
]

export const MOCK_TOKEN_USAGE = { input: 14_000, output: 6_000, total: 20_000 }
export const MOCK_CONTEXT_WINDOW = 200_000
