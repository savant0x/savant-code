# Session Summary — 2026-08-03: Build Artifact Hygiene (FID-2026-0803-011)

**Status:** Closed · **FID:** `dev/fids/archive/FID-2026-0803-011-build-artifact-hygiene.md`
**Author:** Savant

## What was done

FID-2026-0803-011 (approved for direct implementation) went through the full
Perfection Loop COMPLETE → IMPLEMENT → AUDIT and was archived. It grew from
the 0803-010 amendment's follow-up note and **corrected that note's premise**
with git-aware evidence before any code changed:

- **BH-1** — corrected the FID-0803-010 amendment: `cli/bin/` is gitignored
  (root `.gitignore:42-43` + `cli/.gitignore` `bin`); `git ls-files cli/bin/`
  is empty — the "committed .exe binaries" wording was wrong.
- **BH-2** — purged ~360 MB of stale local build artifacts (Jul 28-31) that
  consumers (e2e/tmux) existence-check only; verified regenerable via
  `build:binary` / `savant-free/cli/build.ts` / root `ci`.
- **BH-3** — added `cli/scripts/clean.ts` + `"clean"` script; added a
  post-compile removal of the 21 MB `index.js.map` in `build-binary.ts`
  (bun 1.3.11 emits it despite `--sourcemap=none`; the release tarball ships
  only binary + wasm + env.json; nothing references it).

## Gates (all green)

- `git ls-files cli/bin/` — 0 tracked (nothing lost in the purge).
- Regeneration proof: `bun savant-free/cli/build.ts 0.0.0-dev` — exit 0;
  `cli/bin/` now contains exactly `env.json`, `savant-free.exe`,
  `tree-sitter.wasm` (no map).
- `cd cli && bun run typecheck` — exit 0 (covers `clean.ts` + `build-binary.ts`).
- ESLint `--max-warnings 0` on changed scripts — clean.
- `bun run lint:md` — exit 0. Forbidden-name sweep — clean.
- Independent code review: clean — no issues; one non-actionable nit.

## Lifecycle

- CHANGELOG.md — Added + Verification bullets under v0.0.16.
- LEARNINGS.md — 4 lessons prepended (CRLF preserved).
- FID — `verified` with full Resolution, archived.
- Signing: Savant only.
