# Hatchling

> **This is a public repository.** Do not commit API keys, passwords, tokens,
> internal URLs, or any credentials. Hatchling stores API keys in your OS
> keychain or as an encrypted file, never in the repo, and is never sent outside
> of the conversation between you and your AI model provider — keep it that way.


**Bot Hatching like it's a personality forge.**

**Chat with the AI model and it will write its agent files:**
`SOUL.md`, `IDENTITY.md`, `USER.md`, plus whatever else the two of you
come up with. Quickly and easily create an entire agent personality through conversation with the agent, not a proxy.
When you're done, you can export the files and take them to your new agent's forever home. It is built as an app
for obvious security and privacy reasons.


<img width="1867" height="1481" alt="image" src="https://github.com/user-attachments/assets/5520f3fe-b100-447b-83bc-b74b605954d2" />


## Why

Agent frameworks bury this "bot hatching" ritual inside a terminal wizard that
needs a full install, a running gateway, and careful workspace state. But the
actual magic — a conversation that produces a coherent set of personality files
— is model-agnostic and infrastructure-independent. Hatchling extracts that
magic into a clean, cross-platform app that simulates the experience to whatever
model you point it at, and hands you plain markdown files in the end.

I have found this it is also a fantastic way to test-drive AI models and bootstrap
formulas before committing them to a whole, independent agent, on a dedicated box.

## How it works

1. **Pick a template** — ships with two built-ins, or write your own:
   - **OpenClaw Standard** — the classic "Wake up, my friend!" ritual. You lead;
     the bot wakes up as a newborn and you figure out who it is together.
   - **The Interview** — the bot leads, and the spotlight stays on *you*. It
     interviews you in depth about your world and quietly shapes itself into the
     partner you actually need. Warning: may be a bit uncomfortable and truth-revealing.
     <img width="1563" height="331" alt="image" src="https://github.com/user-attachments/assets/0c9f143c-2355-40ff-bebd-5c6fcbe9333d" />
        
2. **Pick a model** — plug in any OpenAI-compatible provider (I like OpenCode ;)
   **Mock** testing environment "model" that needs no key.
   <img width="1060" height="364" alt="image" src="https://github.com/user-attachments/assets/ba96644f-65fa-499f-81dc-00591716c618" />
   
4. **Chat** — the bot asks who it is and who you are, and writes files as you go.
   A live panel shows each file as it's created or updated.
5. **Review & edit** — read and tweak the generated files in-app.
6. **Export** — download individual files, a `.zip`, or save the whole set to a
   folder. They're plain markdown; drop them into any agent framework.
   <img width="926" height="466" alt="image" src="https://github.com/user-attachments/assets/e007bdf3-c517-494f-ab6e-9b56ba9106c9" />


## Provider-agnostic by design

Hatchling has no allegiance to any single vendor. Every backend reduces to one
of three adapter shapes plus an offline mock:

| Shape               | Covers                                                        | Needs a key? |
| ------------------- | ------------------------------------------------------------ | ------------ |
| **Anthropic**       | Claude models via the Messages API                           | Yes          |
| **OpenAI-compatible** | OpenAI, OpenRouter, a self-hosted gateway, any OpenAI-shaped endpoint (set the base URL) | Yes |
| **Ollama**          | Local models on your machine                                 | No           |
| **Mock (offline)**  | A built-in deterministic model — try the whole app with no key or network | No |

Model lists are fetched live from whatever you connect — no hardcoded model
names, no curated "use this one" badges. If a provider reports a model, you can
pick it.

Context windows work the same way: when a provider's API reports a model's
window (Anthropic, OpenRouter/Groq/vLLM-style endpoints, Ollama), it shows next
to the model and drives the token meter. When it doesn't (base OpenAI shape,
many gateways), the app assumes a 128k default and labels usage *estimated* —
and the New Hatch **Advanced** options let you set the real window yourself,
enter a custom model id, or pin a sampling temperature. Values a provider
doesn't support fail with the provider's own error message, not silently.

## Local-first, always

- No backend servers, no telemetry, no account.
- API keys live in your OS keychain (via Electron `safeStorage`), never in
  plaintext or the renderer process. On systems without a keychain (headless
  boxes, minimal desktops, WSL), keys fall back to an app-managed encrypted store
  — Settings shows a banner when that weaker mode is active.
- Sessions, templates, and generated files live in a local SQLite database.
- Files stay in memory during a hatch and only touch disk when you export.

## Download

Grab the installer for your platform from the
[**Releases page**](https://github.com/Exploitacious/hatchling/releases) —
Windows (installer + [portable](https://github.com/Exploitacious/hatchling/releases/download/v1.0.0/Hatchling-1.0.0-portable-x64.exe), macOS (dmg), and Linux (AppImage + deb).

> The binaries are unsigned, so the first launch shows the usual warnings:
> Windows SmartScreen → "More info" → "Run anyway"; macOS → right-click the app
> → "Open".

## Development Requirements

- **Node.js 20+** and **npm** (for building from source).
- A native toolchain for `better-sqlite3` (build-essential / Xcode CLT / MSVC
  build tools) — only needed when installing from source.

## Getting started (from source)

```bash
git clone https://github.com/Exploitacious/hatchling.git
cd hatchling
npm install

# Rebuild the native SQLite module against Electron's ABI (first run only)
npm run rebuild:electron

# Launch the app in development
npm run dev
```

No environment file is required — provider keys are entered in the app's
Settings screen and stored in your keychain. Start with the **Mock (offline)**
provider to try a full hatch with zero setup.

> **Troubleshooting — `Error: Electron uninstall` on `npm run dev`:** recent
> Electron fetches its binary lazily, so a fresh install may not have it yet.
> `npm install` runs a postinstall to fetch it; if that was skipped, run
> `node node_modules/electron/install.js` once, then `npm run dev`.
>
> **Harmless Linux console noise on launch:** messages like `vaInitialize
> failed` (no hardware video acceleration — Electron falls back to software) and
> `org.freedesktop.portal.FileChooser` D-Bus errors (no desktop portal — Electron
> falls back to the GTK file dialog) are expected on minimal/headless desktops
> and don't affect the app. Under WSLg you may also see `Frame latency is
> negative` (compositor clock skew) and `atom_cache` lines about
> `application/vnd.portal.*` — equally harmless.
>
> Emoji rendering needs no system fonts — the app bundles its own color-emoji
> and symbol fonts, so glyphs render identically on every platform.

### Building installers

```bash
npm run package          # current platform
npm run package:linux    # AppImage + deb
npm run package:win      # NSIS installer + portable
npm run package:mac      # dmg
```

Installers are written to `release/`.

## Development

| Command                   | What it does                                  |
| ------------------------- | --------------------------------------------- |
| `npm run dev`             | Run the app with hot reload                   |
| `npm run build`           | Bundle main, preload, and renderer            |
| `npm run typecheck`       | TypeScript check (main + renderer)            |
| `npm run lint`            | ESLint                                        |
| `npm test`                | Run the Vitest suite                          |
| `npm run test:coverage`   | Tests with coverage                           |
| `npm run package`         | Build installers for the current platform     |

See [`CLAUDE.md`](CLAUDE.md) for conventions and [`ARCHITECTURE.md`](ARCHITECTURE.md)
for the system design.

## Tech stack

Electron · React · TypeScript · Vite (via electron-vite) · Tailwind CSS ·
SQLite (better-sqlite3) · Zustand · CodeMirror · packaged with electron-builder.

## License

[MIT](LICENSE).
