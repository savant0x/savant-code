# Audit remediations — D1/D2/D4/D5/O1 — 2026-10-02

## Request and execution contract

The operator approved the four remediations from the full-system data-flow
audit (`dev/session-summaries/2026-10-02-full-data-flow-audit.md`),
verbatim: "Fix D1 — pass SAVANT_PROJECT_ROOT from the desktop supervisor to
the sidecar and fail closed in release" / "Fix D2 — advance the worktree
baseline against the captured root with a chdir regression test" /
"Implement the O1 indexer optimization so graph refresh reads only changed
files" / "Fix the D4 approval-contract drift and the D5 perpetual flush
timer in the gateway". Single-agent ECHO v0.1.2, strict mode, automation
level 3 (items ≤ session ceiling). No commit, push, release, or destructive
operation authorized (G1/G2); all four FIDs stay active pending commit
authority.

## What shipped

Each remediation followed the FID-bound path: registered on the SCOPE
register (T114–T117) → converged FID → direct file edits after full reads →
declared gates run live → receipt stamped by the project verifier.

| Task | Finding | FID (all status `verified`, receipt stamped) | Fix |
| --- | --- | --- | --- |
| T114 | D1 | `FID-2026-1002-004` | Supervisor passes `SAVANT_PROJECT_ROOT` (env-only, git-root of its launch tree, worktree-file aware) + declares `SAVANT_DESKTOP_PROFILE`; sidecar exits 2 before any bind when a release launch arrives with no root. |
| T115 | D2 | `FID-2026-1002-005` | Turn-end baseline advance resolves its root from the captured `worktreeBaselineRoot` — the same authority reconciliation already used; captured-root regression test pins the old failure (absorbed hash + second-turn block). |
| T116 | O1 | `FID-2026-1002-006` | Graph refresh reads only changed files: v2 stat columns (`mtime_ms`/`bytes`) + `file_imports`/`file_extends` token tables, stat pre-filter before reads, edge pass rebuilt from persisted tokens with zero source reads, legacy backfill on first pass. |
| T117 | D4+D5 | `FID-2026-1002-007` | Gateway approvals SURVIVE socket disconnects (implemented, not just documented) with fail-closed deny moved to run-settle + shutdown; flush timer self-stops when the buffer drains and re-arms on push. |

## Evidence and gates

- FID-2026-1002-004: typecheck cli; `gateway-server-command.test.ts` 7/7
  (new release-gate test); cargo probe (`scripts/desktop-cargo-test-probe.ts`)
  — `cargo test` 17 pass / 0 fail incl. 3 new `find_git_root` tests; quality.
- FID-2026-1002-005: typecheck agent-runtime; worktree-reconcile 10/10 (new
  captured-root advance regression); worktree-capture 5/5;
  terminal-bypass-pipeline 9/9; quality.
- FID-2026-1002-006: typecheck knowledge-graph; update 6/6;
  update-queries + schema green; changed-only 5/5 (zero-read second pass,
  token survival, re-persistence, legacy backfill); quality. The 19
  pre-existing update/queries/schema tests pass unmodified — semantic
  identity of the edge derivation is the contract.
- FID-2026-1002-007: typecheck cli; approvals 3/3 (survival across
  reconnect, run-settle deny, plus the original resolve flow);
  gateway-flush-lifecycle 5/5 (new); gateway family 42/42 across 11 files;
  quality.
- Breadth: agent-runtime full suite 1,645 pass / 0 fail; cli full suite
  3,797 pass / 0 fail / 18 skip; knowledge-graph 24/24; repository ESLint
  zero warnings; `quality:report` PASS; markdownlint clean;
  `scope-register-check` PASS; changed-file Prettier clean.

## Design decisions worth naming

1. **Fail-closed scoping (D1):** the sidecar gate fires ONLY for supervised
   release launches (`SAVANT_DESKTOP_PROFILE=release` + no root). Dev shells
   and manual `savant-code server` runs keep today's resolution
   byte-for-byte — no behavior change outside the broken topology.
2. **Contract implementation over documentation rollback (D4):** the
   documented v1 contract ("approvals survive a socket
   disconnect/reconnect") was implemented rather than weakened — approval
   lifetime == owning-run lifetime ∪ gateway lifetime, with auth still
   gating every answer (reconnecting clients re-hello).
3. **Token persistence mirrors a proven pattern (O1):** `file_calls` already
   rebuilt the CALLS layer from persisted tokens for exactly this reason;
   IMPORTS/EXTENDS now do the same, with resolution still against the
   CURRENT path set so freshness semantics are unchanged.
4. **Quality-ceiling decompositions:** `edges-from-tokens.ts`,
   `index-path-plan.ts` (new modules), and compacted test suites keep every
   project-owned TS file under the 300-line ceiling.

## Limits

- D1's release-anchoring failure remains established by source mechanism +
  boundary tests; no installed release desktop shell was launched live.
- All four FIDs stay in `dev/fids/` (no archive, no CHANGELOG entry) until
  the operator authorizes commits (G2); closure ceremony follows then.
- The remaining audit findings (D3 gateway dispatch error containment, D6
  documented v1 event-loss boundary, D7 basename collision) are recorded in
  the audit report and are NOT part of this pass's approved scope.
