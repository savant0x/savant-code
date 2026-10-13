# Closure pass — 2026-10-13 (the learning-store and harness lanes close)

## Context

The session resumed from the operator's instruction to read the single-agent protocol 0-EOF and
continue. `dev/echo-v0.1.2-single-agent.md` was read 0-EOF — the correct governance file for solo
operation — followed by the program of record (`dev/fids/FID-2026-1012-022` §Work order / §Status
board), `SCOPE.md`, `dev/agenda.md`, the prior handoff and the continuation summary.

The tree was **not** clean. The previous session ended mid-flight (daily limit) after asking for a
handoff it never wrote, leaving:

- two complete-but-uncommitted lanes (FID-2026-1013-002 and FID-2026-1012-011),
- a stale and incomplete FID-2026-1012-011 receipt, with the master gate red,
- an unignored 2.3 MB Codex session transcript at the repository root,
- ten records whose only recorded blocker was the commit hold.

## What landed (committed)

- `9b1d5b4d` — **FID-2026-1013-002** (asymmetric partial matchers mutate received evidence). Three
  inline `toMatchObject` calls replaced received fields with matcher objects under Bun 1.3.14.
  They now use a non-mutating equality/partial-object composition, with received-value preservation
  pinned and the inline pattern enforced in repository validation through
  `scripts/audit-mutating-matchers.ts`.
- `ca1f359d` — **FID-2026-1012-011** (learnings retirement). Retirement persists a versioned pending
  transaction (before/after bytes for ledger, archive and receipt log) before touching any artifact,
  accepts only those bytes on retry, refuses conflicting edits and live foreign owners, and fails
  closed on a corrupt journal. The append-only archive prefix is preserved byte-for-byte.

Both lanes re-ran their declared gates green and had their receipts stamped before their commit.

## Repository gate repaired

`bun scripts/validate-repository.ts` was RED at the start of the pass:

1. `fid.gates.incomplete` / `fid.gates.stale` on **FID-2026-1012-011** — the record declared
   `test scripts/__tests__/learnings-retirement-recovery.test.ts` but the stored receipt predated it.
   Re-stamped live (`--write`): all six declared gates exit 0.
2. `vendored.tree.foreign-root` — the 2.3 MB Codex session transcript sat at the repository root,
   untracked and unignored, inside the release automation's `git add --all` blast radius. It was
   **moved, not deleted**, to `docs/trash/`, the location `.markdownlintignore` already designates
   for pasted session-transcript artifacts (the same repair the 2026-10-12 pass made for the
   previous dump). The file itself is untouched.

After both repairs the gate exits 0 — `validation: PASS`.

## The closure pass

All ten records whose only recorded blocker was the commit hold had their **declared gates re-run
live on the closure tree**. Every gate exited 0 (75 gate executions total):

| Record | Declared gates | Implementation commit |
|---|---:|---|
| FID-2026-1012-010 | 13 | `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7` |
| FID-2026-1012-011 | 6 | `3e0fab271417c10635cf55aaa1e54a4b54e2c5f6` (+ `ca1f359d…`) |
| FID-2026-1012-012 | 8 | `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7` |
| FID-2026-1012-013 | 7 | `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7` |
| FID-2026-1012-014 | 12 | `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7` |
| FID-2026-1012-015 | 5 | `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7` |
| FID-2026-1012-016 | 5 | `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7` |
| FID-2026-1012-027 | 6 | `5144615bcb674c7dab1e8e92b46c5b4e1b020a39` |
| FID-2026-1013-001 | 3 | `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7` |
| FID-2026-1013-002 | 10 | `9b1d5b4deabf0168f55bb46e3085a138f2bcdffd` |

Per-record gate logs: `dev/scratchpad/active/closure-pass-2026-10-13/`.

Each record was then flipped to `**Status:** closed` with `**Closed:**`/`**Commit:**` metadata, its
stale hold language reconciled (the Resolution opening, the `Formal closure` checklist item, and the
"no commit was performed" prose), and an `- **Archived:** 2026-10-13` line added. All ten moved from
`dev/fids/` to `dev/fids/archive/`.

The closure order matters and is enforced: `validateActiveFidLedger`
(`scripts/fid-ledger.ts`, `ALLOWED_ACTIVE_STATUSES`) accepts only
`created | analyzed | converged | fixed | verified` for a record in `dev/fids/`, so a `closed`
record still in the active queue is a hard `fid.metadata.status` failure. The status flip and the
archive move are therefore one atomic step, and the archived record must also be tracked and named
in `CHANGELOG.md` (`archivedFidExists`) before the register/graph checks pass.

Accompanying register work:

- one CHANGELOG section naming all ten ids, at their implementation commits;
- the ten items and their machine-readable write targets evicted from `SCOPE.md` (the register lists
  active work only, and an item's authority must leave with it);
- `FID-2026-1012-022`'s status board moved to `closed 2026-10-13` for each, with the continuation
  note updated.

## Still open

- **`FID-2026-1012-022`** (the master) stays `converged`: it closes last, when every child is closed
  and the allocation re-runs clean.
- **Chain A class lanes** — `-017`, `-018`, `-019`, `-020`, `-023`, `-024` — remain `fixed`/
  `converged` with recurrence windows not started. `-024`'s instrument is implemented, but the seven
  wrapper classes' underlying causes and exercised observation remain open; its repair assertion
  (`bun scripts/experiences-recurrence.ts --assert-repaired=FID-2026-1012-024`) must stay red until
  that evidence exists. `-021`'s machinery is verified; class observation keeps its closure open.
- **Chain C** operator-owned items are unchanged: the `0.0.36` cut, `T122`, `T186`, `T175`,
  `T62-followups`, `T171`'s ruling, `T187`, `T173`'s vendor evidence.
- `FID-2026-1012-026` (provider-parity wave) and its artifacts belong to the other lane and were
  neither edited nor committed.

## Boundaries observed

No push, no release, no credentials. The other lane's in-flight files (`dev/wiki/**`,
`dev/idea-shelf/**`, `dev/fids/FID-2026-1012-026*`,
`docs/design/provider-parity-review-2026-10-12.md`, `scripts/providers/audit-probes/parity-*.ts`,
`dev/experiences/raw-traces.jsonl`) were neither edited nor committed. The relocated transcript was
preserved, not deleted. No `SCOPE.md` item was dropped and no disposition token was written; the ten
removals are closures, each with its archived record and its CHANGELOG entry.
