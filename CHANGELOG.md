# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **The Interview** closing now requires the naming ceremony: the bot proposes
  its own name and signature emoji — agreed with the user before the hatch can
  close.

- Tightened **The Interview** by ~45% and rebalanced it for weaker models:
  synthesis over interrogation (observations, hypotheses, and honest takes drive
  the conversation, with license to challenge and to be wrong out loud),
  operating-model discovery (tradeoffs, autonomy vs. approval, trust, and the
  one real constraint), energy-matching that keeps the model's own lens, and a
  friendlier opening epigraph. Deflection routing ("make it about the bot")
  hardened after adversarial review predicted weak-model regressions.

- Rewrote **The Interview** built-in around a spotlight inversion: the model's
  self-assessment moves backstage (it steers which questions occur to the model,
  and is never conversation material), the human becomes the entire subject, and
  matching the human's tone, length, and pace is framed as a quiet mission. The
  first version prompted models to open with a capabilities monologue; the
  redesign makes the quality of attention — not self-description — the way the
  bot introduces itself.
- The template seeder now updates built-in templates in place when the shipped
  copy changes, so existing databases receive improved built-ins on the next
  launch. Safe by construction: built-ins are read-only in the app, so there are
  no user edits to overwrite. User-created templates are never touched.

### Added

- Session lifecycle controls: a **Pause** button in the chat header (stops any
  active turn; resume anytime from Sessions), and **Reopen conversation** on the
  results screen to continue a completed session (clears its completion stamp).
- **Complete Hatch** now opens a dialog that branches on progress: with files
  written it's a simple confirm; with none it offers to have the bot write all
  files from the conversation so far, complete without files, or pause instead.
- Liveness indicator while the bot works: current phase (thinking / responding /
  writing a named file), a per-turn stopwatch, a "no output for Ns" warning when
  the stream goes silent, and an optional details toggle showing recent tool
  activity.
- Live context-window discovery: model pickers now show each model's reported
  window (e.g. `deepseek-v4 · 128k`) when the provider's API exposes one —
  Anthropic `max_input_tokens`, OpenRouter/Groq/vLLM/LM Studio-style list
  fields, and Ollama via `/api/show`. No hardcoded per-model table; unknown
  stays "estimated" against the 128k default.
- **Advanced** options in New Hatch: context-window override, sampling
  temperature, and custom model-id entry (even when the provider's list loads).
  All optional — blank keeps provider/app defaults. The token meter now runs
  against the session's real window, and unsupported values fail with the
  provider's own error message.
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

- Emoji and symbols now render on every platform. The app bundles Noto Color
  Emoji (the vendored **COLRv1** build — Chromium cannot render the SVG-in-OT
  flavor some packages ship, which still produced placeholder squares) and Noto
  Sans Symbols 2, as unicode-range subsets loaded only as needed; font stacks
  list platform emoji fonts first. Verified by rendering the glyph in Electron
  on a system with no emoji fonts installed.

- The chat composer now grows with what you type (up to ~14 lines, then
  scrolls internally) instead of staying a fixed 2-3 lines.
- The Start Hatching button no longer stays stuck on a spinner when opening the
  New Hatch dialog after a previous successful start — the submit flag leaked
  across opens because the dialog component never unmounts.
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
