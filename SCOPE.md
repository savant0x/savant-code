# SCOPE — Open Work Register

This register contains active work and its machine-readable write targets.
Remove completed items and grants at closure. Evidence belongs in archived
FIDs, the changelog and session summaries. Historical register/disposition
records are preserved in the `dev/tracking/scope-history-*.md` snapshots; a
snapshot grants no current write authority.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override credential handling,
verification, releases or repository boundaries.

## Open items

### EMBED-001 — superseded external single-agent embed (blocked)

- [ ] Authority: automation level 3. Updating the external target is reserved
  to the operator: `C:\Users\spenc\.config\opencode\agent\echo.md` lies outside
  the project directory. No automation level lifts that boundary.

The 409-line embed, last written 2026-08-11 when inspected, predates the
canonical `dev/echo-v0.1.2-single-agent.md`. The earlier audit found missing
scripted-edit and scope-disposition rules, the active scope register contract,
autonomy levels, step accounting, progress-push/archive rulings and current FID
statuses. It also found contradictory attribution and bootstrap instructions.
Exact evidence and the operator-only replacement procedure are retained in
the history snapshot. No external write or fresh external repair is claimed.
This session uses the canonical repository protocol.

### HOME-SKILLS-001 — external skill diagnostics (blocked)

- [ ] `skills:check` reports 22 home-skill warnings and zero repository errors.
  Third-party frontmatter, size and command-policy diagnostics occur outside
  this project. Changing those installed skills requires an operator decision
  on the external targets; this repository audit does not grant that authority.
  Details are preserved in the hygiene audit report; no external fix is claimed.

### FID-2026-1024-001 — expectedness classification (converged)

- [ ] Authority: automation level 3. `medium` severity, `converged` — the design
  decision (D1–D6 in the record) is settled and awaits implementation approval;
  no implementation is claimed.
- [ ] Owned classes: `v1:run_readonly_command:command-exit:undetermined`,
  `v1:run_terminal_command:command-exit:undetermined`,
  `v1:run_terminal_command:timeout:undetermined`,
  `v1:read_files:read-incomplete:undetermined`.
- [ ] Write targets: `dev/experiences/class-owners.json`,
  `dev/experiences/fix-boundaries.json`
  (`packages/agent-runtime/src/tools/tool-executor/tool-result-inspection.ts`
  and `common/src/util/experience-classes.ts` only once implementation is
  approved).

Measured 2026-10-24 (690 records, 64 classes): three of the four 2026-10-16
repair boundaries were refuted by post-fix recurrence (59, 4 and 3 rows) even
though real production receipts existed (24, 40 and 76), so all three were
withdrawn. The unrefuted `web_search:research-unavailable` boundary stays and
is judged by the existing 14-day rule on 2026-10-30. Open question Q1 (is a
malformed tool call `expected`?) is escalated to the operator.

### FID-2026-1024-002 — `fid_worktree` invalid `fid_id` (analyzed)

- [ ] Authority: automation level 3. `medium` severity, `analyzed` — ownership
  only; no repair is designed or claimed.
- [ ] Owned class: `v1:fid_worktree:incomplete-arguments:unexpected`.
- [ ] Write targets: `dev/experiences/class-owners.json`
  (`common/src/tools/params/tool/fid-worktree.ts` only once a determination is
  made).

Five rows, two after FID-2026-1017-014's verification receipt, and none of them
is the `invalid_union` defect that record fixed — the live refusal is
`fid_id — invalid_format`. Ownership moved here because the previous owner is
closed with no waiver.

## Machine-readable scope targets

`AUDIT-2026-1018` completed on 2026-10-19 and its target list is retained in
`dev/tracking/scope-history-2026-10-20.md`, which grants nothing; `EMBED-001`
and `HOME-SKILLS-001` are blocked on external targets outside this project and
hold no write grant. Governance artifacts the protocol itself requires keep
their gate-level exemptions.

`FID-2026-1021-001`, `FID-2026-1021-002` and `FID-2026-1021-003` closed and
archived on 2026-10-21 (implementations `2ae5f3c3`, `40a52e3d` and `bf5978ff`),
so their write grants are released here; the evidence lives in the archived
records, the changelog and the session summary.

`FID-2026-1022-002` and `FID-2026-1022-003` closed and archived on 2026-10-22
(implementation `d7c4d523`), so their write grants are released here; the
evidence lives in the archived records, the changelog and the session summary.

`FID-2026-1022-001` closed and archived on 2026-10-23 (implementation
`ec6bcd68`), so its write grant is released here; the evidence lives in the
archived record, the changelog and the session summary.

`FID-2026-1023-001` closed and archived on 2026-10-23 (implementation
`15c03a04`), so its write grant is released here; the evidence lives in the
archived record, the changelog and the session summary. The live listener
observation it produced is tracked as LIVE-005 in
`dev/tracking/internal-followups.json`, independently of this closure.

`FID-2026-1024-001` and `FID-2026-1024-002` are the two current grants above,
opened 2026-10-24. `class-owners.json` and `fix-boundaries.json` are
`FID-2026-1024-001`'s targets; the reconciliation it performed released
`FID-2026-1015-006`'s ownership of four classes and `FID-2026-1017-014`'s of
one, and withdrew three refuted repair boundaries without rewriting a single
ledger row.
