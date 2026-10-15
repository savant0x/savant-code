# Session Handoff: Quality-Ratchet Program Paused (FID-2026-0819-005)

**Session ID:** 2026-08-21-0236-quality-ratchet-paused
**Date:** 2026-08-21 ~02:36 EDT
**Status:** completed — program paused by operator decision; handoff for a fresh session

---

## Where Things Stand

- `FID-2026-0819-005` (quality-ratchet file-length remediation, 300-line
  ceiling) is **paused** by operator decision: "call it good for now" — the
  largest chunk is done, the remainder is no longer pressing, and it stays
  **pending, not closed, not exempted**. The FID remains open (`analyzed`) in
  `dev/fids/`; closure still requires the full gates and a zero-violation
  quality report.
- The pause decision is recorded in three places: `SCOPE.md` (Task 7 pause
  note + deferred items QR-Q / QR-IJ), the FID's "Program Paused — Operator
  Decision (2026-08-21)" section, and the companion summary
  `2026-08-21-0211-quality-ratchet-program-pause.md`.
- Quality inventory at pause: **168 violations** (`bun run quality:report`,
  intentionally red / fail-closed). `validate:repository` reads **200**
  (168 quality + ~32 pre-existing desktop-FID metadata findings on
  `FID-2026-0820-007`…`013`, already tracked out-of-scope in SCOPE.md).

## What This Session Delivered (Loops 134–138, all verified)

| Loop | Target | Result |
|------|--------|--------|
| 134 | `cli/src/commands/design.ts` | 632 → 190 (+ 3 authoring modules) |
| 135 | `cli/src/commands/export-conversation/template-css-part2.ts` | 332 → 8 facade (+ part2a 221, part2b 116; byte-identity SHA gate) |
| 136 | `cli/src/commands/graph-export/universe-app-script.ts` | 1617 → 32 facade (+ eight parts a–h; byte-identity SHA gate) |
| 137 | `cli/src/components/chat-input-bar.tsx` | 615 → 281 (+ types/ask-user/drive-confirm/compact/normal modules) |
| 138 | `cli/src/components/multiline-input.tsx` | 360 → 262 (+ `multiline-input/use-multiline-keyboard.ts` 177) |

Inventory moved **173 → 168**. Every loop closed with CLI typecheck 0 errors,
targeted ESLint 0 warnings, Prettier clean, and the full package-scoped CLI
suite passing 3242 / 18 skipped / 0 failed (9,001 assertions).

## Operator Decisions on Record

- Program paused — "call it good for now"; re-address only if the stance
  changes. No further large refactor sessions planned for awhile.
- `cli/src/constants/savant-logo.ts` (921 lines, dead code — zero consumers;
  `/export` uses `CHARACTER_LOGO_DATA_URI`) — **skip**, recorded out-of-scope.
  Do not delete/split/re-wire without a new operator decision.
- Stale `/export` logo comment in `export-conversation.ts:8` — record only.

## Resume Pointers (when the stance changes)

- **QR-IJ** (SCOPE.md): the ~19 remaining production files over ceiling, led
  by `scripts/public-release.ts` (2953), `savant-free-models.ts` (856),
  `tool-executor/native.ts` (852), `echo/enforcement.ts` (754). Sensitive:
  the release engine, the serialized `initial-agents-dir` template copies
  (synced with generated `.agents/` dirs — passed over deliberately in
  QR-CG), and the most-FID'd agent-runtime core paths.
- **QR-Q**: the standing sequential-batches item. **Batch 4**: test files
  (largest: `send-message-helpers.test.ts` 1876, `send-message.test.ts` 1852,
  `public-release.test.ts` 1413).
- Candidate cleanups noted for resume: exclude `sdk/dist` build artifacts
  from the validator (`sdk/dist/index.d.ts` 5507 is counted); rebaseline five
  small ratchet drifts from other recent work (`messages/convert.ts`,
  `messages/aggregate.ts`, `post-write-scanners.ts`, `echo-record.ts`,
  `execute-tool-calls.ts`); the desktop-FID metadata findings (007–013).

## Gotchas for the Next Session (all hit this session)

- **Files over ~100k chars:** `str_replace` and `read_files` truncate at
  100,000 chars — `SCOPE.md` (~104k) and the FID (~155k) tails are
  unreachable by str_replace. Use `apply_patch` with exact **full-line**
  context (partial context lines are rejected). Recorded as a lesson in
  `dev/LEARNINGS.md` (`large-file-edits-via-apply-patch`).
- **apply_patch serialization:** removal hunks whose removed line begins with
  a dash (e.g. `- [ ] …` → `-- [ ] …` in the diff) repeatedly failed to
  serialize this session — prefer insert-only hunks.
- **EHEL Law-3 tracker:** clears on a **single-command**
  `run_readonly_command` verification; multi-command batches and subagent
  basher runs do not credit it.
- **basher / tmux-cli:** terminal execution was sandbox-denied all session
  under the default `prompt` permission mode (the documented FID-2026-0820-016
  Phase-1 limitation). Verify via `run_readonly_command` instead.
- **tree-sitter isolation artifact:** `bun test cli/src/commands/__tests__/graph-export.test.ts`
  fails standalone on `packages/code-map`'s `c_sharp_tags.scm` — green in the
  full package-scoped suite, which is the authoritative gate.
- **Working tree:** all session work is **uncommitted**. Commit before any
  risky operation; the pre-push gates (typecheck ×4, ESLint, Prettier,
  markdownlint) are the expected pass set.

## Verification Commands (state at close)

- `bun run --cwd=cli typecheck` — PASS (0 errors)
- `bun run --cwd=cli test` — PASS (3242 / 18 skipped / 0 fail, 9,001 assertions)
- `bun run quality:report` — FAIL (168) — intentional, fail-closed
- `bun run validate:repository` — FAIL (200) — intentional, fail-closed
- `bun run learnings:check` — PASS (13 structured entries)
- markdownlint + Prettier — PASS on SCOPE.md, FID, LEARNINGS.md,
  LEARNING-RULES.md, and both session summaries

## Notes for the Next Agent

- The Law-4 advisories naming SCOPE.md / FID / LEARNINGS.md as "wired but not
  verified" are false positives for markdown tracking artifacts — no call
  graph applies; the code surfaces were grep-verified in their own loops.
- Two new lessons were captured in `dev/LEARNINGS.md` with catalog entries in
  `dev/LEARNING-RULES.md` (`large-file-edits-via-apply-patch`,
  `string-split-byte-identity-gate`).
- The byte-identity pattern for static-string splits: capture length +
  SHA-256 before, probe the facade after — see Loops 135/136 for the probe
  command shape.
