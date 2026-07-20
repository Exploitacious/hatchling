# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Second built-in template, **The Interview**: a bot-driven, introspection-first
  hatch. The model audits its own strengths and interviews the user in depth to
  design the working relationship, rather than the user leading. Ships alongside
  the classic OpenClaw Standard; the seeder now installs both idempotently, so
  existing databases pick it up on next launch.
- App-managed key fallback: when no OS keychain is available, API keys are
  encrypted with a per-install AES-256-GCM key (`0600` file under `userData`) so
  key storage works on headless boxes, minimal desktops, WSL, and containers. A
  Settings banner surfaces the downgrade, and `apiKeys:storageMode` reports the
  active backend.

### Fixed

- Provider keys could not be saved on systems without an OS keychain — the vault
  hard-failed with "OS secure storage is unavailable." It now falls back to the
  app-managed key store instead of blocking.
- Connection test no longer reports success for a key-requiring provider that has
  no saved key (some endpoints answer an unauthenticated model-list probe, which
  made "test passed" misleading right before the first real call failed).
- Long screens (Settings, Sessions, Templates) and tall modals no longer clip on
  short viewports — content scrolls.

## [0.1.0] - 2026-07-19

First complete release: a working, end-to-end personality forge.

### Added

- Project scaffold: Electron + Vite + React + TypeScript (electron-vite build,
  electron-builder packaging), Tailwind CSS, and a strict TypeScript setup.
- Shared domain model (`src/shared/types.ts`) and the full typed IPC contract —
  request/response channels and push events (`src/shared/ipc.ts`).
- Shared constants (`src/shared/constants.ts`): the built-in OpenClaw bootstrap
  template, the virtual-workspace preamble, the three file-tool definitions, and
  provider-shape metadata.
- Typed preload bridge exposing `window.hatchling` under context isolation.
- SQLite persistence: versioned schema + migrations, built-in template seed, and
  five repositories (templates, providers, sessions, messages, files) with
  soft-delete/resurrect and cascade.
- Encrypted API-key vault via Electron `safeStorage` (injectable for testing).
- Four LLM providers behind one interface: Anthropic, OpenAI-compatible, Ollama,
  and an offline deterministic mock (the test backbone). Dynamic model lists,
  streaming, tool calls, and normalized error/abort handling.
- IPC handler registry implementing the provider, template, session, message,
  and file channels; wired into the main process.
- Renderer IPC client and formatting utilities.
- Full UI (React + Tailwind): app shell with routing, a design-system component
  kit, and CSS-variable theming (dark default + light toggle).
- Screens: Settings (provider configuration + default-model picker), Template
  library and a Markdown editor with live preview (CodeMirror), Session library
  with search/filter, the hatching Chat interface, and the Results gallery.
- A fully wired New Hatch modal with dynamic model lists.
- Conversation engine (main process): an event-driven state machine that builds
  the system prompt (preamble + frozen template), streams the model, executes
  the write/read/delete tools against the in-memory file registry, applies an
  inline code-block fallback for models that don't call tools, tracks tokens,
  detects hatch completion (BOOTSTRAP.md dismissal), and resumes after restart.
- The chat interface is wired live to the engine over IPC (streaming tokens,
  real-time file panel, token/context status) — no mock data.
- Results screen on real session data: a file gallery, an in-app viewer with a
  raw/rendered toggle and inline editing (persisted), and a transcript view.
- File export via native dialogs: individual download, Download All (.zip),
  Save to folder, and Markdown transcript export.
- Polish: route-based code-splitting, global keyboard shortcuts (New Hatch,
  Settings), a render error boundary, a production Content-Security-Policy, and
  a multi-OS release workflow (`.github/workflows/release.yml`).
- GitHub Actions CI: lint, typecheck, test (Vitest), and build on every push
  and PR.
- MIT license, contributor guide (`CLAUDE.md`), and architecture spec
  (`ARCHITECTURE.md`).

[Unreleased]: https://github.com/Exploitacious/hatchling/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Exploitacious/hatchling/releases/tag/v0.1.0
