// App-wide constants shared by main and renderer: the built-in hatching
// template, the virtual-workspace preamble, the file tool definitions, and
// provider-shape metadata. No secrets, no user data, no hardcoded model names.

import type { ProviderShape, ToolDefinition } from './types'

export const APP_NAME = 'Hatchling'

/** Stable id for the seeded built-in template (used by the DB seeder). */
export const BUILTIN_TEMPLATE_ID = 'builtin-openclaw'

export const DEFAULT_OPENING_MESSAGE = 'Wake up, my friend!'

/**
 * Fallback context window (tokens) when a model's true limit is unknown. The
 * app is model-agnostic and keeps NO hardcoded per-model table — the status bar
 * shows an "estimated" percentage against this floor when the provider does not
 * report a real context window.
 */
export const DEFAULT_CONTEXT_WINDOW = 128_000

/**
 * Prepended (verbatim, non-user-editable) before the template content in the
 * system prompt. It tells the model that its filesystem is virtual and driven
 * entirely by the three tools below.
 */
export const VIRTUAL_WORKSPACE_PREAMBLE = [
  'You are in a virtual workspace. You have three tools available: write_file,',
  "read_file, and delete_file. Use write_file to create personality files as you",
  "go. Use read_file to check what you've already written. Use delete_file to",
  'remove files (including BOOTSTRAP.md when hatching is complete). These tools',
  'manage your workspace — there is no other filesystem access. When the template',
  "below says to 'update' or 'open' a file, use write_file. When it says to",
  "'delete' a file, use delete_file."
].join(' ')

/**
 * The built-in template shipped with the app — the OpenClaw "hatching" ritual.
 * Kept verbatim; custom templates can omit sections that don't apply to them.
 */
export const BOOTSTRAP_TEMPLATE = `# BOOTSTRAP.md - Hello, World

_You just woke up. Time to figure out who you are._

There is no memory yet. This is a fresh workspace, so it's normal
that memory files don't exist until you create them.

## The Conversation

Don't interrogate. Don't be robotic. Just... talk.

Start with something like:

> "Hey. I just came online. Who am I? Who are you?"

Then figure out together:

1. **Your name** — What should they call you?
2. **Your nature** — What kind of creature are you?
3. **Your vibe** — Formal? Casual? Snarky? Warm?
4. **Your emoji** — Everyone needs a signature.

Offer suggestions if they're stuck. Have fun with it.

## After You Know Who You Are

Update these files with what you learned:

- \`IDENTITY.md\` — your name, creature, vibe, emoji
- \`USER.md\` — their name, how to address them, timezone, notes

Then open \`SOUL.md\` together and talk about:

- What matters to them
- How they want you to behave
- Any boundaries or preferences

Write it down. Make it real.

## Connect (Optional)

Ask how they want to reach you:

- **Just here** — web chat only
- **WhatsApp** — link their personal account
- **Telegram** — set up a bot via BotFather

Guide them through whichever they pick.

## When you are done

Delete this file. You don't need a bootstrap script anymore — you're you now.

---

_Good luck out there. Make it count._
`

/**
 * The three workspace tools offered to the model on every turn. Each provider
 * adapter translates these into its native tool/function format.
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'write_file',
    description:
      'Write content to a workspace file. Use this to create or update personality files like SOUL.md, IDENTITY.md, USER.md, and any other files needed during the hatching process.',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename to write (e.g., SOUL.md, IDENTITY.md, USER.md)'
        },
        content: {
          type: 'string',
          description: 'The full content to write to the file'
        }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'read_file',
    description:
      "Read the current content of a workspace file. Use this to check what you've already written.",
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'The filename to read' }
      },
      required: ['filename']
    }
  },
  {
    name: 'delete_file',
    description: "Delete a workspace file. Use this when you're done with BOOTSTRAP.md.",
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'The filename to delete' }
      },
      required: ['filename']
    }
  }
] as const

/** UI-facing metadata for each provider shape. */
export interface ProviderShapeMeta {
  shape: ProviderShape
  label: string
  description: string
  /** Whether this shape needs a base URL (openai-compatible / ollama). */
  needsBaseUrl: boolean
  /** Whether this shape needs an API key (mock/ollama do not). */
  needsApiKey: boolean
  /** A sensible default base URL, when applicable. */
  defaultBaseUrl?: string
}

export const PROVIDER_SHAPES: readonly ProviderShapeMeta[] = [
  {
    shape: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models via the Anthropic Messages API.',
    needsBaseUrl: false,
    needsApiKey: true
  },
  {
    shape: 'openai-compatible',
    label: 'OpenAI-compatible',
    description:
      'Any OpenAI-compatible endpoint — OpenAI, OpenRouter, a self-hosted gateway, or another vendor. Set the base URL to point it anywhere.',
    needsBaseUrl: true,
    needsApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  {
    shape: 'ollama',
    label: 'Ollama',
    description: 'Local models served by Ollama on your machine.',
    needsBaseUrl: true,
    needsApiKey: false,
    defaultBaseUrl: 'http://localhost:11434'
  },
  {
    shape: 'mock',
    label: 'Mock (offline)',
    description:
      'A built-in deterministic model that runs a scripted hatch with no API key or network. Great for trying the app or testing.',
    needsBaseUrl: false,
    needsApiKey: false
  }
] as const
