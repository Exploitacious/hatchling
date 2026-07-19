# Documentation Index

> The map of everything under `docs/`. Deep-dives, runbooks, and design notes
> that don't belong in one of the four canonical root files live here.
>
> Authoritative pointers: [`ARCHITECTURE.md`](../ARCHITECTURE.md) (the spec /
> rules), [`README.md`](../README.md) (what exists), [`CLAUDE.md`](../CLAUDE.md)
> (how we work). This file is the map; those are the sources of truth.

---

## Contents

| Category            | What it is                            | Files             |
| ------------------- | ------------------------------------- | ----------------- |
| Runbook             | Things a developer does on demand     | _none yet_        |
| Lifecycle deep-dive | End-to-end walkthrough of a subsystem | _none yet_        |
| Backlog             | Unscoped + scoped future work         | `IDEAS.md`        |

As the project grows, deep-dives (provider-adapter internals, the conversation
state machine, the export pipeline) land here and get a row above. Each new doc
opens with a one-line "what this is" and closes with a "see also".

## The six documentation rules

This repo follows a lightweight documentation kata:

1. The root holds only canonical entry points: `README.md`, `CLAUDE.md`,
   `ARCHITECTURE.md`, `CHANGELOG.md`.
2. `docs/` holds every deep-dive.
3. Component-specific docs live next to their code.
4. No fact lives in two places — cross-link instead of duplicating.
5. Drift is a bug — a change that touches a documented surface updates the doc
   in the same change.
6. Soft cap on file length (~500 lines); the spec is the deliberate exception.

## See also

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — system design and decisions.
- [`../README.md`](../README.md) — what the project is and how to run it.
- [`../CLAUDE.md`](../CLAUDE.md) — conventions and workflow.
