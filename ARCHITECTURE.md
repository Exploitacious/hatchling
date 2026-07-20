# Architecture

> The authoritative design document for Hatchling. Everything else defers to
> this file for *how the system is built and why*. For what it is, see
> [`README.md`](README.md); for conventions, see [`CLAUDE.md`](CLAUDE.md).

---

## 1. Overview

Hatchling is a local-first Electron desktop app. A user picks a template and a
model, chats with the model, and the model writes AI-personality files
(`SOUL.md`, `IDENTITY.md`, `USER.md`, and anything else) via tool calls. The
files live in memory and SQLite during the session and are exported to disk on
demand. Nothing leaves the machine except the model API calls themselves.

Design goals, in priority order:

1. **Local-first & private** — no servers, no telemetry; keys in the OS keychain.
2. **Provider-agnostic** — three adapter shapes plus a mock cover every backend;
   no vendor is special, no model names are hardcoded.
3. **Predictable hatching** — the template is the system prompt; the app adds
   only a small, fixed preamble.
4. **Resumable** — full session state persists; a hatch survives an app restart.

## 2. Process architecture

Electron's three-part split, mirrored by the `src/` layout:

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│ renderer  (React, sandboxed)│         │ main  (Node, trusted)        │
│                             │  IPC    │                              │
│  UI, state (Zustand)        │ ◄─────► │  SQLite (better-sqlite3)     │
│  window.hatchling bridge    │ invoke  │  safeStorage key vault       │
│                             │ + events│  LLM provider adapters       │
│                             │         │  conversation engine         │
└─────────────────────────────┘         │  file export                 │
         ▲                              └──────────────────────────────┘
         │ contextBridge (preload)                 ▲
         └─────────────────────────────────────────┘
```

- **main** (`src/main`) — the only trusted context. Owns the database, secret
  storage, all network calls, and the conversation engine.
- **preload** (`src/preload`) — a thin, context-isolated bridge exposing exactly
  one object, `window.hatchling`, with `invoke` and `subscribe`.
- **renderer** (`src/renderer`) — React UI with no Node or filesystem access.
- **shared** (`src/shared`) — types, the IPC contract, and constants, importable
  by both sides because it touches neither Node nor the DOM.

Security invariants: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox` restricted, and `ipcRenderer` is never exposed directly — only the
narrow bridge is. External links open in the system browser, never in-app.

## 3. Data model

SQLite (`better-sqlite3`) at `userData/hatchling.db`, created and migrated on
first run. The built-in templates are seeded idempotently per id on every
launch, so a newly shipped built-in appears for existing databases too (the
seeder never overwrites user edits). Types are defined in
[`src/shared/types.ts`](src/shared/types.ts); the tables:

### templates
| column          | type    | notes                                  |
| --------------- | ------- | -------------------------------------- |
| id              | TEXT PK |                                        |
| name            | TEXT    |                                        |
| description     | TEXT    | nullable                               |
| content         | TEXT    | the markdown template                  |
| opening_message | TEXT    | default `Wake up, my friend!`          |
| is_builtin      | INTEGER | 1 for the seeded template (read-only)  |
| created_at      | TEXT    | ISO-8601                               |
| updated_at      | TEXT    | ISO-8601                               |

### providers
| column     | type    | notes                                              |
| ---------- | ------- | -------------------------------------------------- |
| id         | TEXT PK |                                                    |
| shape      | TEXT    | `anthropic` \| `openai-compatible` \| `ollama` \| `mock` |
| name       | TEXT    | user label                                         |
| base_url   | TEXT    | nullable; for openai-compatible / ollama           |
| is_oauth   | INTEGER | reserved; always 0 in v1 (see §9)                  |
| created_at | TEXT    |                                                    |

API keys are **not** stored here — see §6.

### sessions
| column           | type    | notes                                    |
| ---------------- | ------- | ---------------------------------------- |
| id               | TEXT PK |                                          |
| name             | TEXT    |                                          |
| template_id      | TEXT    | FK → templates(id), nullable             |
| template_snap    | TEXT    | frozen template content at session start |
| opening_message  | TEXT    | frozen opening message                   |
| provider_id      | TEXT    | FK → providers(id), nullable             |
| model            | TEXT    |                                          |
| status           | TEXT    | `in_progress` \| `completed`             |
| token_usage      | TEXT    | JSON `{input, output, total}`            |
| created_at       | TEXT    |                                          |
| completed_at     | TEXT    | nullable                                 |

### messages
| column       | type    | notes                                    |
| ------------ | ------- | ---------------------------------------- |
| id           | TEXT PK |                                          |
| session_id   | TEXT    | FK → sessions(id)                        |
| role         | TEXT    | `system` \| `user` \| `assistant` \| `tool` |
| content      | TEXT    |                                          |
| tool_calls   | TEXT    | JSON, nullable (assistant tool requests) |
| tool_call_id | TEXT    | nullable (links a tool result)           |
| tokens       | INTEGER | nullable                                 |
| created_at   | TEXT    |                                          |

### files
| column     | type    | notes                                     |
| ---------- | ------- | ----------------------------------------- |
| id         | TEXT PK |                                           |
| session_id | TEXT    | FK → sessions(id)                         |
| filename   | TEXT    |                                           |
| content    | TEXT    |                                           |
| size_bytes | INTEGER |                                           |
| created_at | TEXT    |                                           |
| updated_at | TEXT    |                                           |
| deleted_at | TEXT    | nullable; soft delete (e.g. BOOTSTRAP.md) |

## 4. IPC contract

The entire renderer↔main surface is typed in
[`src/shared/ipc.ts`](src/shared/ipc.ts). `IpcRequestMap` covers request/response
channels; `IpcEventMap` covers push events (streaming tokens, file changes,
usage updates, engine state, errors). Main implements one handler per channel
(`IpcHandlers`); the renderer calls them through the bridge. Because both sides
derive from the same maps, a channel cannot be used with the wrong payload.

Channel domains: `app`, `providers`, `apiKeys`, `templates`, `sessions`,
`messages`, `files`, `llm`, and `chat` (the engine).

## 5. LLM provider layer

Every backend implements `LlmProvider` (`src/shared/types.ts`): `sendMessage`,
`listModels`, `validateConnection`. There are three real shapes and a mock:

- **`anthropic`** — `@anthropic-ai/sdk`, Messages API, `tool_use` blocks,
  streaming. Models come from its list endpoint (not a hardcoded list).
- **`openai-compatible`** — the `openai` SDK pointed at a configurable base URL.
  One adapter covers OpenAI, OpenRouter, self-hosted gateways, and any other
  OpenAI-shaped API. Function-calling tools, SSE streaming, `/models` listing.
- **`ollama`** — raw HTTP to a local Ollama server (`/api/chat` with tools,
  NDJSON streaming, `/api/tags` for models).
- **`mock`** — a deterministic in-process model. It runs a scripted hatch
  (asks identity questions, calls `write_file` for `IDENTITY.md`/`USER.md`/
  `SOUL.md`, deletes `BOOTSTRAP.md`). It needs no key or network and is the
  backbone of the automated tests.

Each adapter translates the unified message/tool format to and from its native
format and normalizes errors to an `LlmErrorKind` (`rate_limit`, `auth`,
`network`, `context_length`, `bad_response`, `unknown`).

**Agnostic rules:** no hardcoded model names; no curated recommendation badges;
no per-model context-window table (report the real window when the provider
gives one, otherwise fall back to `DEFAULT_CONTEXT_WINDOW` and mark it
"estimated").

**Context-window discovery** (`providers/contextWindow.ts`, pure + unit-tested):
each adapter probes what its provider's API actually reports — Anthropic's
`max_input_tokens`; the OpenAI-compatible field variants seen in the wild
(`context_length`, `context_window`, `max_model_len`, `max_context_length`,
`top_provider.context_length`, `meta.n_ctx_train` — base OpenAI and some
gateways report nothing); Ollama's arch-prefixed `model_info.*.context_length`
via one `/api/show` call per model, where a failed probe never fails the
listing. The resolved window is stored per session at creation (user override
from the New Hatch Advanced options wins over the model-reported value), drives
`session:usage` percent math in the engine, and falls back to
`DEFAULT_CONTEXT_WINDOW` with `estimated: true` when nothing is known. Sessions
may also carry an optional `temperature`; adapters forward it as-is and an
unsupported value surfaces the provider's own error message.

## 6. Secret storage

API keys never touch SQLite or the renderer. They are encrypted at rest and
written to a small file under `userData`, keyed by provider id. Main exposes
`apiKeys:save` / `apiKeys:has` / `apiKeys:delete` / `apiKeys:storageMode` — the
renderer can set, check, and learn *how* a key is stored, but can never read one
back. The `mock` and `ollama` shapes need no key at all.

`KeyVault` is backed by a list of `Encryptor`s in preference order:

1. **`safeStorage`** (`os-keychain`) — the OS keychain. Preferred; strongest.
2. **App-key fallback** (`app-key`) — AES-256-GCM with a per-install random key
   in a `0600` file under `userData`. Used only when no OS keychain is available
   (headless boxes, minimal desktops, WSL, containers). Weaker — the key sits
   next to the ciphertext — so the app surfaces the downgrade in the Settings UI
   via `apiKeys:storageMode`.

Each stored entry records the backend that encrypted it, so a key stays readable
even after a keychain later appears; a failed decrypt returns `null` (the key is
simply re-entered). New saves always use the most-preferred *available* backend.

## 7. Conversation engine

The engine lives in main and drives one hatch. It is an event-driven state
machine (`ConversationState`): `initializing → sending_opening →
waiting_for_bot ⇄ processing_tool_call → waiting_for_user … → completing →
completed`, with `error` (recoverable) and `paused` (resumable) as side states.

**System prompt** is built once per session, in a fixed order:

1. The static **virtual-workspace preamble** (`VIRTUAL_WORKSPACE_PREAMBLE`) —
   tells the model its filesystem is virtual and driven by the three tools.
2. The **template content**, verbatim and unmodified.

The template content is snapshotted into the session so later edits to the
template don't change an in-flight or completed hatch.

**Tools.** Three tools are offered every turn (`TOOL_DEFINITIONS`), executed in
main against the session's file registry:

- `write_file(filename, content)` → upsert into `files`, emit `files:changed`.
- `read_file(filename)` → return current content or "not found".
- `delete_file(filename)` → soft-delete (`deleted_at`), emit `files:deleted`.
  Deleting `BOOTSTRAP.md` emits a "hatching is wrapping up" notice.

No real filesystem writes happen during a hatch — everything is in memory and
SQLite until the user exports.

**Streaming.** Provider token/tool events are relayed to the renderer as
`chat:token` / `chat:toolActivity`; the finalized message is persisted and sent
as `chat:message`.

**File-detection fallback.** Not every model uses tools reliably. After each
assistant message, a parser scans for fenced code blocks tagged with a filename
(``` ```markdown title="SOUL.md" ```, a bold `**SOUL.md**` label above a block,
or "writing SOUL.md:" lead-ins) and routes any match through the same
`write_file` path. It is de-duplicated against files already written by a tool
call in the same turn, so nothing is double-counted.

**Completion.** Two triggers: the bot deletes `BOOTSTRAP.md` (a signal, shown as
a notice), or the user clicks **Complete Hatch** (the authoritative action).
Clicking opens a dialog that branches on whether the bot has written any live
files yet: with files it's a plain confirm; with none it offers to have the bot
generate the files first (`FORCE_GENERATE_MESSAGE`, an app-level user message
that works with any template), to complete empty, or to pause. On completion
the session is marked `completed` and the UI moves to the results screen.

**Pause & reopen.** The chat header has an explicit Pause (aborts any active
turn; the session stays `in_progress` and resumes from Sessions), and the
results screen can reopen a `completed` session back to `in_progress` to keep
the conversation going — reopening clears `completed_at`.

**Resume.** Reopening an `in_progress` session reloads its messages and files
and resumes at `waiting_for_user` or `waiting_for_bot` depending on the last
message's role.

**Liveness.** While the bot works, the chat shows the current phase (thinking /
responding / writing a named file via `chat:toolActivity`), a per-turn
stopwatch, and a "no output for Ns" warning when the engine has been silent —
with an optional details toggle listing recent tool activity.

**Token tracking.** Usage is extracted from each response, accumulated on the
session, and pushed via `session:usage` with a context percentage (against the
model's real window, or the estimated fallback).

## 8. Export

The results screen exports the generated files — plain markdown, taken wherever
the user wants:

- **Individual download** — native save dialog per file.
- **Download all (`.zip`)** — flat zip of all files, auto-named.
- **Save to folder** — native folder picker, writes every file.
- **Transcript** — the full conversation as formatted markdown.

Export is the entire delivery story. There is deliberately **no** "deploy to a
specific framework" mode and no SSH/remote push — the files are generic and
portable, and coupling the app to one target would undercut its agnosticism.

## 9. Deferred

Kept out of v1 by design, noted here so the shape doesn't surprise later:

- **Per-provider OAuth.** The `providers.is_oauth` column exists and stays `0`;
  wiring the flows is future work and needs no schema migration when it lands.
- **Auto-update, code signing.** Packaging is configured; signing certs and an
  update feed are the user's to add.

## 10. Build & packaging

- **electron-vite** bundles all three targets (`electron.vite.config.ts`). Main
  and preload emit CommonJS; native deps (`better-sqlite3`) are externalized.
- **electron-builder** (`electron-builder.yml`) produces installers: Windows
  (NSIS + portable), macOS (dmg), Linux (AppImage + deb). `better-sqlite3` is
  rebuilt against the Electron ABI at package time.
- **CI** (`.github/workflows/ci.yml`) runs lint · typecheck · test · build on
  every push and PR. The Electron binary download is skipped in CI since it is
  not needed to bundle.

## See also

- [`README.md`](README.md) — what the project is and how to run it.
- [`CLAUDE.md`](CLAUDE.md) — conventions and workflow.
- [`src/shared/`](src/shared) — the types, IPC contract, and constants this
  document describes.
