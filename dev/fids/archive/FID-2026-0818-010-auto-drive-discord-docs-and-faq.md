<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-010 — Auto Drive + Discord Rich Presence user documentation and FAQ

**Severity:** medium
**Status:** closed
**ID:** FID-2026-0818-010
**Filename:** `FID-2026-0818-010-auto-drive-discord-docs-and-faq.md`
**Created:** 2026-08-18

## Summary

The Auto Drive program (FIDs `001`–`009`) shipped code and tests but zero
user-facing documentation. The only artifacts are design blueprints
(`docs/Auto Drive Architecture Blueprint.md`, duplicated at
`docs/design/Auto Drive Architecture Blueprint.md`, and
`docs/design/Discord Presence For Savant-Code.md`) — architecture docs, not
operator-facing feature docs. The operator could not discover or verify the
feature from the CLI: the canonical command is `/auto-drive` (aliases
`/auto`, `/drive`, `/autodrive`) yet `README.md` has zero mentions of Auto
Drive or Discord presence, `docs/features.md` has no Auto Drive or Discord
section and its Slash Commands table omits `/auto-drive` and `/presence`,
`docs/index.md`'s Key Features list omits both, and no FAQ exists anywhere to
disambiguate `/goal` from `/auto-drive`. This FID closes the gap with
operator-facing feature docs, a slash-command table update, a README update,
a new `docs/faq.md`, and blueprint de-duplication.

## Environment

- **OS:** Windows 10 (build 26100) / MINGW64 — repo root `C:\Users\spenc\dev\savant-code`
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **State:** Auto Drive program FIDs `001`–`009` are `verified` (not `closed`); canonical slash command renamed `auto` → `auto-drive` this session (`cli/src/commands/defs/misc.ts`, `cli/src/data/slash-commands.ts`)
- **Docs surface:** `docs/` (features.md, index.md, design/, archive/), root `README.md`

## Detailed Description

### Problem

A user-facing feature exists but is not documented in any operator-facing
surface:

1. **No `/doc` command** — `grep` for `name: 'doc'` / `handleDocCommand` over
   `cli/src/commands/defs/` + `cli/src/data/slash-commands.ts` returns zero.
   The only doc-adjacent commands are `/help` (keyboard shortcuts) and
   `/learn` (teacher).
2. **README.md not updated** — `grep -niE "auto-drive|auto drive|autodrive|/presence|discord|drive-lock|/auto" README.md`
   returns zero hits for Auto Drive / Discord; the only new-command coverage
   is `/goal` (durable goal mode).
3. **No FAQ** — `**/*FAQ*` glob returns 0 files.
4. **docs/features.md stale** — documents "Durable Budgeted Goal Mode" but has
   no Auto Drive section, no Discord Rich Presence section, and its Slash
   Commands table is missing `/auto-drive` and `/presence`.
5. **docs/index.md stale** — "Key Features" and "Links" omit both.
6. **Blueprint duplication** — `docs/Auto Drive Architecture Blueprint.md`
   and `docs/design/Auto Drive Architecture Blueprint.md` are two copies of
   the same blueprint.

### Expected Behavior

An operator can discover, understand, and invoke both features without
reading FIDs or source: the README and features doc surface `/auto-drive`
(canonical name + `/auto` `/drive` `/autodrive` aliases) and `/presence`; an
FAQ answers the `/goal` vs `/auto-drive` distinction; the blueprints are
de-duplicated to one canonical location.

### Root Cause

The program was planned and implemented as a code + FID backlog with the
"docs" work items never converted into user-facing doc surfaces. The design
blueprints were treated as the documentation, but they are architecture
specs aimed at implementers, not operator-facing feature reference.

### Evidence

- `README.md` grep (this FID's Environment, item 2): 0 Auto Drive / Discord hits; `/goal` only.
- `glob "**/*FAQ*"` → `0 file(s)`.
- `docs/features.md` (read 2026-08-18): "Durable Budgeted Goal Mode" section present; no "Auto Drive" / "Discord" heading; Slash Commands table lists `/goal` but not `/auto-drive` or `/presence`.
- `docs/index.md` (read 2026-08-18): Key Features list ends at goal mode / hook system; no Auto Drive / Discord bullet.
- `ls docs/` → `Auto Drive Architecture Blueprint.md` at root AND `docs/design/Auto Drive Architecture Blueprint.md` (duplicate).
- Canonical command rename (this session): `cli/src/commands/defs/misc.ts:72-73` `name: 'auto-drive'`, `aliases: ['auto', 'drive', 'autodrive']`.

## Impact Assessment

### Affected Components

- `docs/features.md` — add Auto Drive + Discord sections, update Slash Commands table.
- `docs/index.md` — add Key Features bullets + Links.
- `README.md` — add slash-command table rows + feature list entries.
- `docs/faq.md` — new file (FAQ).
- `docs/Auto Drive Architecture Blueprint.md` / `docs/design/Auto Drive Architecture Blueprint.md` — de-duplicate.

### Risk Level

- [x] Medium: feature works but is undiscoverable and undocumented — the operator hit this exact confusion (could not verify the feature; unclear whether `/drive` existed; unclear `/goal` vs `/auto`).

## Proposed Solution

### Approach

Add operator-facing documentation in the existing `docs/` folder (no new
top-level surfaces, no new command) and reconcile the README. The canonical
command name is `/auto-drive`; every doc surfaces it with the alias set so
the prior confusion cannot recur.

### Steps

1. Add an "Auto Drive" section to `docs/features.md` — command `/auto-drive`
   (aliases `/auto` `/drive` `/autodrive`), the clarify → plan → approve →
   run flow, STRICT pin, one-time Law 2 approval, `/auto-drive status|pause|resume|stop`, headless `--auto "<goal>"`.
2. Add a "Discord Rich Presence" section to `docs/features.md` — `/presence enable|disable|status` (client id hardcoded, operator decision 2026-08-18 — see FID-2026-0818-009 revision), mechanical privacy redaction, dormant/disabled states, asset keys.
3. Update `docs/features.md` Slash Commands table — add `/auto-drive` and `/presence` rows.
4. Update `docs/index.md` — add Auto Drive + Discord bullets to Key Features and Links.
5. Update `README.md` — add `/auto-drive` + `/presence` to the slash-command table and the feature list.
6. Create `docs/faq.md` — FAQ covering `/goal` vs `/auto-drive` vs `/drive` vs `/auto` vs `/autodrive`, `/presence`, headless `--auto`, and the program's FID/closure status.
7. De-duplicate the Auto Drive blueprint — keep one canonical copy (design/ or root) and make the other a pointer.

### Verification

- `bun run lint:md` exit 0 (markdownlint on all new/edited docs).
- `bun run validate:repository` PASS.
- Grep: `README.md`, `docs/features.md`, `docs/index.md` each contain `/auto-drive` and `/presence`; `docs/faq.md` exists and covers the alias set.
- The slash-command table in `docs/features.md` and `README.md` lists `/auto-drive` (canonical) with the alias set.

## Step Status

- [x] 1. `docs/features.md` — Auto Drive section.
- [x] 2. `docs/features.md` — Discord Rich Presence section.
- [x] 3. `docs/features.md` — Slash Commands table rows for `/auto-drive` + `/presence`.
- [x] 4. `docs/index.md` — Key Features + Links.
- [x] 5. `README.md` — slash-command table + feature list.
- [x] 6. `docs/faq.md` — new FAQ.
- [x] 7. Blueprint de-duplication (canonical copy + pointer).

## Perfection Loop

### Loop 1 — RED

- R1. No `/doc` command; discovery is `/help`/`/learn` only.
- R2. README.md: 0 Auto Drive / Discord mentions (grep verified).
- R3. No FAQ anywhere (glob verified).
- R4. `docs/features.md` missing Auto Drive + Discord sections and the two slash-command rows.
- R5. `docs/index.md` Key Features/Links omit both.
- R6. Blueprint duplicated at `docs/` root and `docs/design/`.
- R7. FID-002's own Step Status still says `defs/misc.ts` (`auto`/`drive` alias) — historical drift after the rename; records are immutable, so the new docs are the canonical name source.

### Loop 1 — GREEN

- G1. Doc in the existing `docs/` folder — no new surface, no new command (Law 13).
- G2. Canonical `/auto-drive` + explicit alias set in every surface so the prior confusion cannot recur.
- G3. FAQ is a new `docs/faq.md`, linked from `features.md` / `index.md` / `README.md`.
- G4. Blueprint de-duplication via a pointer (non-destructive — keeps history, no content rewrite).

### Loop 1 — AUDIT

- A1. Absence evidence pasted: README grep (0 hits), `**/*FAQ*` glob (0 files), `/doc` grep (0 hits).
- A2. Presence evidence pasted: `misc.ts:72-73` canonical name + aliases; `features.md` "Durable Budgeted Goal Mode" present (so the section format to mirror is established).
- A3. All edits are markdown docs → verified by `lint:md` + `validate:repository`, not typecheck.

### Loop 2 — AUDIT (implementation)

- A4. `grep -niE "auto-drive|Auto Drive|presence|Discord" docs/features.md` → 10 hits (sections at lines 55, 331; slash-table rows at 369, 374).
- A5. `grep -niE "auto-drive|Auto Drive|presence|Discord|faq" docs/index.md` → 5 hits (Key Features bullets 94–95; Links 123–125).
- A6. `grep -niE "auto-drive|Auto Drive|presence|Discord|faq" README.md` → 11 hits (feature bullets 266, 288; slash-table rows 877, 881; docs links 1002–1008).
- A7. `docs/faq.md` exists and covers `/auto-drive` aliases, `/goal` vs `/auto-drive` (table at lines 39–46), `/presence` (83–96), headless `--auto` (22–23, 76).
- A8. Blueprint de-duplicated: `diff` of `docs/Auto Drive Architecture Blueprint.md` vs `docs/design/Auto Drive Architecture Blueprint.md` was IDENTICAL before the pointer replacement; root copy is now a pointer to the canonical design copy (non-destructive — full content preserved at `docs/design/`).
- A9. Gates: `bun run lint:md` exit 0; `bun run validate:repository` PASS (both re-run after this step).

### Loop 1 — SELF-CORRECT

- SC1: considered adding a `/doc` slash command; dropped — `/help` + docs links already cover discovery, and a new command is surface for no unique behavior (Law 13 / YAGNI).

### Missed Questions

1. Should the FAQ be its own file or a section in `features.md`? Decision: own file (`docs/faq.md`) — the alias/`/goal`-vs-`/auto-drive` disambiguation is long enough to warrant a dedicated surface, and it is linked from the other docs.
2. Which blueprint copy is canonical? Decision: `docs/design/Auto Drive Architecture Blueprint.md` (consistent with the other design docs), with the root `docs/Auto Drive Architecture Blueprint.md` reduced to a pointer.
3. Should FID-002's stale `auto`/`drive` note be rewritten? Decision: no — converged FIDs are immutable records; the new docs are the authoritative name source and the FID notes the rename in its Resolution.

### Code Verification Evidence

- All citations verified 2026-08-18 against the working tree (AUDIT A1–A9);
  the duplicate blueprint was `diff`-proven IDENTICAL before the pointer
  replacement (no content lost — full copy preserved at `docs/design/`).
- `bun run lint:md` exit 0 (markdownlint on all new/edited docs).
- `bun run validate:repository` PASS after this file's Step Status + the two
  quality-ratchet `approvedGrowth` entries (this FID's rename growth) were
  recorded.

## Resolution

- **Status:** `closed` — operator-directed closure + archive 2026-08-18: all
  7 steps `[x]`; `lint:md` + `validate:repository` PASS (see AUDIT evidence
  below). **Nova implementation PASS 2026-08-18** — verdict in
  `dev/nova/outbox/archive/2026-08-18-discord-rich-presence-hardcode-and-docs-nova-verdict.md`.
- **2026-08-18 revision:** the Discord client id is hardcoded (operator
  decision, FID-2026-0818-009) — the `/presence` docs in `features.md`,
  `faq.md`, and `README.md` are updated to drop `client <id>` and state the
  id is compiled in, not operator-mutable.
- **Closure path:** `lint:md` + `validate:repository` PASS (done) → operator
  closure (done 2026-08-18) → archive.

## Lessons Learned

- A code-complete feature with no operator-facing doc is effectively invisible — the design blueprint is not a substitute for feature reference.
- Command discoverability and documentation drift together: the same session that fixed `/auto` → `/auto-drive` must also fix every doc surface that names the command.
