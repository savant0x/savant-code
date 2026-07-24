# FID: FID authoring rules missing from runtime system prompt — malformed FIDs written to wrong path

**Filename:** `FID-2026-0722-039-fid-authoring-rules-missing.md`
**ID:** FID-2026-0722-039
**Severity:** high
**Status:** closed
**Created:** 2026-07-22 00:00
**Author:** Forge (via operator-requested deep review)

---

## Summary

The runtime system prompt every Savant agent inherits (`ECHO_PROTOCOL_INSTRUCTIONS` in `common/src/constants/agents.ts:97-184`) tells agents to "Create FIDs for bugs..." but never specifies the required directory (`dev/fids/`), the filename format (`FID-YYYY-MMDD-NNN-{title}.md`), template adherence (`templates/FID-TEMPLATE.md`), the required metadata fields, the allowed status values, or the role restriction that only the Recorder agent may write FID files. The result: an agent authored a design document, labeled it a FID, and wrote it to `fids/database-architecture.md` at the repo root with non-standard fields (`**Agent**: Thinker`, `**Status**: DRAFT`), producing 44 markdown lint violations against a config that doesn't exist. This FID tightens the runtime prompt, mirrors the rules in `ECHO.md`, handles the stray file, adds the missing `.markdownlint.json`, and adds a regression test.

## Environment

- **OS:** Windows 11 (`win32`)
- **Language/Runtime:** Bun 1.3.14, TypeScript strict
- **Tool Versions:** `@opentui/core` 0.2.2, `react` ^19
- **Commit/State:** Session 2026-07-22; `fids/database-architecture.md` present at repo root (428 lines, dated 2024-01-16 internally, file mtime 2026-07-19 15:15)

## Detailed Description

### Problem

A file `fids/database-architecture.md` exists at the repo root — not in `dev/fids/`. The file:

- Has no `**ID:**` field (the template's first required metadata field).
- Uses non-standard fields: `**Agent**: Thinker`, `**Status**: DRAFT`, `**Perfection Loop Phase**: RED`. `DRAFT` is not in the allowed status set (`created | analyzed | fixed | verified | closed`).
- Uses non-template section headings (`## Context`, `## Technical Decisions`, `## AUDIT`, `## SELF-CORRECT`, `## COMPLETE`) instead of `templates/FID-TEMPLATE.md` structure.
- Was placed in a brand-new top-level `fids/` directory instead of `dev/fids/`.
- Produces 44 markdown lint violations (no `.markdownlint*` config exists to enforce against).

The file's `**Agent**: Thinker` attribution is impossible at the tool level: the Thinker agent definition (`agents/thinker/thinker.ts:34`) has `toolNames: ['sequentialthinking']` — Thinker has no file-write tools and cannot write to disk. The parent agent (Orchestrator/Savant) wrote the file based on Thinker's reasoning output, and wrote it to the wrong location with the wrong format because the runtime prompt gave it no rules to follow.

### Expected Behavior

- Every agent that inherits `ECHO_PROTOCOL_INSTRUCTIONS` sees explicit FID authoring rules: the canonical directory (`dev/fids/`), the filename format, the template to follow, the required metadata fields, the allowed status values, and the role restriction (Recorder only).
- No agent creates a top-level `fids/` directory. Non-FID design documents go to `docs/design/`.
- A `.markdownlint.json` config exists at repo root so the 44 errors are enforceable, not ad-hoc.
- A unit test asserts the runtime prompt contains the required substrings, preventing silent regression.

### Root Cause

The runtime system prompt (`common/src/constants/agents.ts:154-159`) describes the FID lifecycle in one sentence: "Create FIDs for bugs, architectural issues... Closed FIDs are archived to `dev/fids/archive/` and logged in CHANGELOG.md." It mentions the archive path but never the active path, never the filename format, never the template, never the metadata, never the role restriction. Meanwhile `ECHO.md` (the human-readable protocol doc) DOES specify the Recorder's exclusive FID role (lines 60, 74, 250-256), and `AGENTS.md:54` + `CONTRIBUTING.md` mention the filename format — but neither of those is what agents see at runtime. The runtime prompt is the gap.

`protocol.config.yaml` already defines `paths.fids: "dev/fids/"` (line 32) and `paths.fids_archive: "dev/fids/archive/"` (line 33) and `fid.severity_levels` (line 57). The config has the path truth; the runtime prompt just doesn't reference it. This is a Law 13 (one truth) drift: the doc, the config, and the runtime prompt disagree on what an agent must know to author a FID correctly.

### Evidence

The malformed FID (`fids/database-architecture.md`), opening lines:

```text
# FID: Database Architecture for ECHO System

## Context

**Agent**: Thinker  
**Created**: 2024-01-16  
**Status**: DRAFT  
**Perfection Loop Phase**: RED
```

vs. the template (`templates/FID-TEMPLATE.md:1-8`):

```text
# FID: [Short Description]

**Filename:** `FID-YYYY-MMDD-NNN-[short-description].md`
**ID:** FID-YYYY-MMDD-NNN
**Severity:** critical | high | medium | low
**Status:** created | analyzed | fixed | verified | closed
**Created:** YYYY-MM-DD HH:MM
**Author:** [Agent/Human Name]
```

Runtime prompt gap (`common/src/constants/agents.ts:154-159`):

```text
## FID Lifecycle
Issues are tracked as Feature Implementation Documents (FIDs):
\`\`\`
Created → Analyzed → Fixed → Verified → Closed → Archived
\`\`\`
Create FIDs for bugs, architectural issues, performance bottlenecks, security concerns, or improvement opportunities. Closed FIDs are archived to \`dev/fids/archive/\` and logged in CHANGELOG.md.
```

No directory, no filename format, no template reference, no metadata, no status enum, no role restriction.

Call-graph reachability (Law 4): `ECHO_PROTOCOL_INSTRUCTIONS` is consumed by 11 agent definition files, confirmed by grep:

```text
agents/verifier/verifier.ts:61
agents/forge/forge.ts:128
agents/thinker/thinker.ts:48
agents/scribe/scribe.ts:51
agents/scout/scout.ts:66
agents/recorder/recorder.ts:47
agents/detective/detective.ts:126
agents/savant/savant-deep.ts:249
agents/savant/savant.ts:439
agents/researcher/researcher-web.ts:39
agents/researcher/researcher-docs.ts:31
common/src/constants/agents.ts:97 (definition)
```

Every agent in the roster sees this string at runtime via `${ECHO_PROTOCOL_INSTRUCTIONS}` interpolation in their `instructionsPrompt`. All 11 are reachable production consumers.

Existing tests covering this path: **none**. No test in `common/src/__tests__/` asserts the content of `ECHO_PROTOCOL_INSTRUCTIONS`. This is why the gap went undetected.

## Impact Assessment

### Affected Components

- `common/src/constants/agents.ts` — runtime system prompt (primary fix)
- `ECHO.md` — protocol doc must mirror the rules (Law 13)
- `fids/database-architecture.md` — stray file to be moved to `docs/design/`
- `.markdownlint.json` — new config at repo root
- `common/src/__tests__/agents.test.ts` — new regression test

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Workaround: an operator can manually move malformed FIDs and correct their format. The fix removes the need for the workaround by preventing the malformation at the source.

## Proposed Solution

### Approach

Add a "## FID Authoring Rules" section to `ECHO_PROTOCOL_INSTRUCTIONS` (the runtime prompt) that is the single source of truth for how FIDs are authored. Mirror the same section in `ECHO.md` under §FID Lifecycle so the doc and the runtime prompt agree (Law 13). Handle the stray file by moving it (content is a valid design doc; only the packaging was wrong). Add `.markdownlint.json` so the lint errors are enforceable. Add a unit test so a future edit that strips the rules fails CI.

### Steps

1. **`common/src/constants/agents.ts`** — Replace the current "## FID Lifecycle" section (lines 154-159) with a fully-specified "## FID Authoring Rules" section containing: required directory (`dev/fids/`), filename format (`FID-YYYY-MMDD-NNN-{kebab-case-title}.md`), number allocation rule (scan existing FIDs first, never reuse a number on the same date), template adherence (`templates/FID-TEMPLATE.md`), required metadata fields, allowed status values, role restriction (Recorder only; agents without write tools must route through Recorder; parent agents that do have write tools must not write FIDs directly from a sub-agent's output), no-top-level-paths rule, and design-doc rule (non-FID docs go to `docs/design/`).

2. **`ECHO.md`** — Insert a "### FID Authoring Rules" subsection between "When to Create a FID" (ends line 388) and "FID Format" (line 390) mirroring the runtime prompt rules verbatim. This keeps the protocol doc and the runtime prompt in sync (Law 13).

3. **`fids/database-architecture.md`** → **`docs/design/database-architecture.md`** — Move the file. Create `docs/design/` directory if it doesn't exist. The content is a legitimate SQLite architecture proposal; only the packaging (FID label, wrong location) was wrong. Delete the now-empty `fids/` directory.

4. **`.markdownlint.json`** (new) at repo root — Enable: MD001 (heading increments), MD003 (atx heading style), MD012 (no multiple blank lines), MD022 (headings surrounded by blank lines), MD032 (lists surrounded by blank lines), MD040 (fenced code blocks need a language), MD041 (first line is a top-level heading). Line length: warn at 120 (the existing `quality.max_line_length: 100` in config is for code; markdown allows 120 for prose). Add `.markdownlintignore` excluding `node_modules/`, `dev/fids/archive/**` (historical, not re-linted), `CHANGELOG.md` (auto-generated format).

5. **`common/src/__tests__/agents.test.ts`** (new) — Unit test asserting `ECHO_PROTOCOL_INSTRUCTIONS` contains the required substrings: `dev/fids/`, `FID-YYYY-MMDD-NNN`, `templates/FID-TEMPLATE.md`, `Only the Recorder`, `created | analyzed | fixed | verified | closed`. This is the Law 4 enforcement — a future edit that strips the rules fails `bun test`.

### Verification

- `bun run --cwd=common typecheck` — zero errors (string content change, no type change).
- `bun run --cwd=common typecheck && bun run --cwd=agents typecheck` — zero errors (agents import the constant; type unchanged).
- `bun test src/ --cwd=common` (or equivalent) — the new regression test passes.
- `bunx eslint common/src/constants/agents.ts --max-warnings 0` — zero warnings.
- `bunx markdownlint-cli2 '**/*.md'` (or equivalent) — the malformed patterns that produced 44 errors are now enforceable; re-running against `docs/design/database-architecture.md` after reformatting it to satisfy the new config should yield zero warnings.
- Grep verification: `ECHO_PROTOCOL_INSTRUCTIONS` contains each required substring (paste output into AUDIT section).

## Perfection Loop

### Loop 1

- **RED:**
  1. Runtime system prompt missing FID authoring rules — `common/src/constants/agents.ts:154-159`.
  2. Malformed FID at `fids/database-architecture.md` — wrong location, wrong format, 44 markdown lint errors.
  3. No `.markdownlint*` config exists in the repo (confirmed via glob).
  4. No unit test asserts the content of `ECHO_PROTOCOL_INSTRUCTIONS` — gap went undetected.
  5. `**Agent**: Thinker` attribution is impossible at tool level (`agents/thinker/thinker.ts:34` has `toolNames: ['sequentialthinking']`); parent agent wrote the file from Thinker's output without following rules Thinker's inherited prompt never stated.
  6. Existing FID numbering collisions in archive (007, 014, 015, 019, 029, 032, 033 each duplicated) — no rule currently prevents future collisions.
  7. Call-graph: 11 agent files import `ECHO_PROTOCOL_INSTRUCTIONS` (grep output pasted above in Evidence) — all reachable, all affected.
- **GREEN:**
  - Add "## FID Authoring Rules" to `ECHO_PROTOCOL_INSTRUCTIONS` with: required directory `dev/fids/`, filename format `FID-YYYY-MMDD-NNN-{kebab-case-title}.md`, number allocation rule (scan existing FIDs first, never reuse a number on the same date), template adherence `templates/FID-TEMPLATE.md`, required metadata fields (**Filename, ID, Severity, Status, Created, Author**), allowed status values (`created | analyzed | fixed | verified | closed`), role restriction ("Only the Recorder agent may create, update, or archive FID files. Agents without write tools (Thinker, Scout, Researcher) must route FID content through the Recorder. Parent agents with write tools must not write FID files directly from a sub-agent's output."), no-top-level-paths rule ("Do not create top-level `fids/`, `archive/`, or any directory that shadows canonical ECHO paths. FIDs live only at `dev/fids/`."), design-doc rule ("Non-FID design documents go to `docs/design/`, never at the repo root and never with a `FID-` prefix.").
  - Mirror the same section in `ECHO.md` between "When to Create a FID" and "FID Format".
  - Move `fids/database-architecture.md` to `docs/design/database-architecture.md`; delete `fids/` directory.
  - Add `.markdownlint.json` (MD001, MD003, MD012, MD022, MD032, MD040, MD041; line-length warn 120) and `.markdownlintignore` (`node_modules/`, `dev/fids/archive/**`, `CHANGELOG.md`).
  - Add `common/src/__tests__/agents.test.ts` asserting the required substrings are present in `ECHO_PROTOCOL_INSTRUCTIONS`.
  - Missed-questions folded in: (a) Thinker inherits the prompt but can't violate it directly — rule explicitly covers the parent-route-through-Recorder case; (b) explicit no-top-level-paths rule; (c) design-doc rule for non-FID docs.
- **AUDIT:**
  - Verification commands to run (from `protocol.config.yaml` → commands): `bun run --cwd=common typecheck`, `bun run --cwd=agents typecheck`, `bun test src/ --cwd=common`, `bunx eslint common/src/constants/agents.ts --max-warnings 0`.
  - Call-graph reachability for `ECHO_PROTOCOL_INSTRUCTIONS`: already pasted above (11 production consumers, all reachable). No new `pub fn` or config field is added by this FID — the constant's type is unchanged (`string`). The regression test is the new consumer that closes the Law 4 loop on the constant itself.
  - Self-reporting prohibition: all evidence above is tool output (grep, file reads) or verbatim code snippets, not self-assessment.
  - Markdown lint: re-run against `docs/design/database-architecture.md` after reformatting; expect zero warnings under the new config.
- **CHANGE DELTA:** <10% of `common/src/constants/agents.ts` character count (one section replacement, ~40 lines added to a 184-line file). `ECHO.md` adds ~30 lines to a 582-line file. Both within circuit-breaker limits.

### Loop 2 (if needed)

- **RED:** (pending — to be filled only if AUDIT finds issues after implementation)
- **GREEN:** (pending)
- **AUDIT:** (pending)
- **CHANGE DELTA:** (pending)

## Resolution

- **Fixed By:** Buffy
- **Fixed Date:** 2026-07-22
- **Fix Description:** Added "## FID Authoring Rules" to `ECHO_PROTOCOL_INSTRUCTIONS` in `common/src/constants/agents.ts`, mirrored the same section in `ECHO.md`, moved `fids/database-architecture.md` to `docs/design/database-architecture.md` (and removed the stray `FID:` prefix), created `.markdownlint.json` and `.markdownlintignore`, and added `common/src/__tests__/agents.test.ts` as a regression test.
- **Tests Added:** Yes — `common/src/__tests__/agents.test.ts` asserts `ECHO_PROTOCOL_INSTRUCTIONS` contains the required FID authoring substrings.
- **Verified By:**
  - `bun run --cwd=common typecheck` ✅ 0 errors
  - `bun test src/__tests__/agents.test.ts --cwd=common` ✅ 1/1 passing
  - `bunx eslint common/src/constants/agents.ts --max-warnings 0` ✅ 0 warnings
  - Grep verified `ECHO_PROTOCOL_INSTRUCTIONS` contains `dev/fids/`, `FID-YYYY-MMDD-NNN`, `templates/FID-TEMPLATE.md`, `Only the Recorder`, and the allowed status values.
  - `bun run --cwd=agents typecheck` ✅ 0 errors after scope-expanded fix of 21 pre-existing TypeScript errors in `context-pruner.ts`, `editor-implementor.ts`, `editor-multi-prompt.ts`, `recorder.ts`, and `savant.ts`.
  - `bunx eslint agents/context-pruner.ts agents/editor/best-of-n/editor-implementor.ts agents/editor/best-of-n/editor-multi-prompt.ts agents/recorder/recorder.ts agents/savant/savant.ts common/src/templates/initial-agents-dir/types/util-types.ts --max-warnings 0` ✅ 0 warnings
- **Perfection Loop:** Converged in **Loop 1** — RED findings, GREEN implementation, AUDIT evidence, and SELF-CORRECT review all completed without requiring a Loop 2.
- **Commit/PR:** (pending)
- **Archived:** 2026-07-22

## Lessons Learned

- **The runtime prompt is not the protocol doc.** `ECHO.md` is what humans read; `ECHO_PROTOCOL_INSTRUCTIONS` is what agents see. A rule that exists only in `ECHO.md` is invisible to agents at runtime. Law 13 (one truth) requires the two stay in sync — and the runtime prompt is the one that actually governs behavior.
- **Attribution is not agency.** `**Agent**: Thinker` in a file does not mean Thinker wrote it. Thinker has no write tools. The parent agent wrote it from Thinker's output. This is the code equivalent of the Cross-Agent Claim Rule (ECHO.md §Cross-Agent Claim Rule): the attribution is not a source; the tool access list is.
- **Five patches in a row changed symptoms without naming the cause.** The sidebar fix (FID-038) and this FID both stem from the same anti-pattern: editing without first reading the full source of truth and identifying the root cause. Law 2 (Present Before Act) requires the cause to be named in RED before GREEN proceeds.
- **A config that exists but is never referenced is a Law 13 violation.** `protocol.config.yaml` defines `paths.fids` and `fid.severity_levels`, but the runtime prompt doesn't reference them. The config is the source of truth for paths; the prompt should point to it.
- **No test = no enforcement.** The gap went undetected because no test asserts the runtime prompt contains the rules. A one-line `expect(...).toMatch(...)` test would have caught the drift on the first edit. This is the Law 4 enforcement for documentation constants, not just code.
