# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project scaffold: Electron + Vite + React + TypeScript (electron-vite build,
  electron-builder packaging), Tailwind CSS, and a strict TypeScript setup.
- Shared domain model (`src/shared/types.ts`) and the full typed IPC contract —
  request/response channels and push events (`src/shared/ipc.ts`).
- Shared constants (`src/shared/constants.ts`): the built-in OpenClaw bootstrap
  template, the virtual-workspace preamble, the three file-tool definitions, and
  provider-shape metadata.
- Typed preload bridge exposing `window.hatchling` under context isolation.
- GitHub Actions CI: typecheck, test (Vitest), and build on every push and PR.
- MIT license, contributor guide (`CLAUDE.md`), and architecture spec
  (`ARCHITECTURE.md`).

[Unreleased]: https://github.com/Exploitacious/hatchling
