# Contributing to Hatchling

How we work in this repo — conventions, structure, and the quality bar. For
what the project *is*, see [`README.md`](README.md); for how it's *designed*,
see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Project structure

```
hatchling/
├── src/
│   ├── main/          Electron main process — Node. DB, providers, IPC, engine.
│   ├── preload/       The context-isolated bridge that exposes window.hatchling.
│   ├── renderer/      React UI. No Node access; talks to main only via the bridge.
│   └── shared/        Types + IPC contract + constants shared by main and renderer.
├── docs/              Deep-dives and backlog (see docs/README.md).
├── build/             Icons and packaging resources.
├── electron.vite.config.ts   Three-target build (main / preload / renderer).
├── electron-builder.yml      Installer packaging config.
└── ARCHITECTURE.md    The spec. The authoritative design document.
```

The process boundary is the most important rule in the codebase:

- **`main`** is trusted. It has Node, the filesystem, the database, and the
  network. All LLM calls, all secret handling, all persistence happen here.
- **`renderer`** is untrusted UI. Context isolation is on, node integration is
  off. It reaches main *only* through the typed bridge in `preload`.
- **`shared`** is pure types and constants — no Node APIs, no DOM APIs — so it
  can be imported from both sides.

Never widen this boundary (no `nodeIntegration: true`, no exposing `ipcRenderer`
directly, no filesystem access from the renderer).

## The IPC contract

Every renderer↔main interaction is typed in [`src/shared/ipc.ts`](src/shared/ipc.ts):

- `IpcRequestMap` — request/response channels (renderer → main, `invoke`).
- `IpcEventMap` — push events (main → renderer, e.g. streaming tokens).

To add a channel: add it to the relevant map, implement the handler in main's
handler registry, and call it from the renderer via `window.hatchling.invoke`.
The types flow automatically — a channel can't be called or handled with the
wrong payload. Prefer adding a channel over reaching around the bridge.

## Provider model

The app is provider-agnostic. There are exactly **three adapter shapes** plus a
**mock**, all implementing the `LlmProvider` interface in
[`src/shared/types.ts`](src/shared/types.ts):

- `anthropic` — Anthropic Messages API.
- `openai-compatible` — any OpenAI-shaped endpoint, base-URL configurable
  (covers OpenAI, OpenRouter, self-hosted gateways, and Gemini's
  OpenAI-compatible endpoint).
- `ollama` — local Ollama HTTP API.
- `mock` — deterministic, offline, no key. **This is the test backbone** — the
  whole conversation engine is verified against it without a live model.

Rules:

- **No hardcoded model names.** Model lists come from each provider's list
  endpoint at runtime. Do not add curated "recommended"/"may struggle" badges.
- **No per-model context-window table.** Use the reported window when available;
  fall back to `DEFAULT_CONTEXT_WINDOW` and label it "estimated".
- Adding a real vendor almost never means a new adapter — point the
  `openai-compatible` shape at its base URL.

## Code standards

- **TypeScript strict, no `any`.** `@typescript-eslint/no-explicit-any` is an
  error. Model unknowns with `unknown` and narrow.
- **React**: function components + hooks only. No class components.
- **Styling**: Tailwind utility classes only — no inline styles, no CSS
  modules. Theme tokens (`hatch-*` colors) live in `tailwind.config.js`.
- **Async**: wrap I/O and IPC handlers in try/catch and surface a real error to
  the user; never swallow. No empty catch blocks.
- **Secrets**: API keys are never logged, never sent to the renderer, never
  written to SQLite. They live in the OS keychain via `safeStorage`, keyed by
  provider id.
- **Database**: wrap multi-statement writes in transactions.
- **IPC channel names** follow `domain:action` (`providers:list`,
  `sessions:create`).
- **Path aliases**: `@shared/*` from anywhere; `@renderer/*` inside the renderer.

## Testing

- **Vitest** is the suite. Run `npm test`.
- Main-process and shared logic run in the default `node` environment.
- Renderer component tests opt into a DOM with `// @vitest-environment happy-dom`
  at the top of the file.
- **The mock provider is how we test the engine** — tool execution, streaming,
  the state machine, file detection, resume — all without a network. A test that
  needs a "model" uses the mock, never a real key.
- A bug fix lands with a test that fails before the fix and passes after.

## The quality gate

CI runs on every push and PR: **lint · typecheck · test · build**. All four must
be green. Locally, before you push:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Commits & branches

- Trunk-based: short-lived branches off `master`, merged via PR.
- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
  `refactor:`, `docs:`, `chore:`, `test:`. Imperative subject, ≤72 chars.
- Update [`CHANGELOG.md`](CHANGELOG.md) under `[Unreleased]` for any
  user-visible change.
- **Docs travel with code.** A change that touches a documented surface updates
  the doc in the same PR. Stale docs are treated like broken tests.

## Where things go

The repo follows a light documentation kata (see [`docs/README.md`](docs/README.md)):
four canonical root files (`README`, `CLAUDE`, `ARCHITECTURE`, `CHANGELOG`),
everything else in `docs/`, component notes next to their code, and no fact
written in two places — cross-link instead.
