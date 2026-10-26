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

### FID-2026-1024-002 — `fid_worktree` invalid `fid_id` (converged)

- [ ] Authority: automation level 3. `medium` severity, `converged` — the
  determination is recorded in the record and implementation runs in the same
  pass.
- [ ] Owned class: `v1:fid_worktree:incomplete-arguments:unexpected`.
- [ ] Write targets: `common/src/tools/params/tool/fid-worktree.ts`,
  `common/src/tools/__tests__/fid-worktree-params.test.ts` and
  `dev/experiences/class-owners.json`.

Five rows, two after FID-2026-1017-014's verification receipt, and none of them
is the `invalid_union` defect that record fixed — the live refusal is
`fid_id — invalid_format`. It is an agent-side argument error made likely by a
description gap: the field's only readable hint was a raw JSON-Schema pattern,
the refusal text cannot carry the expected shape, and the pattern accepts all
641 archived ids. The regex is not relaxed; the format is stated in the tool
description and the field description.

### Q2-FID-2026-1024-002 — implicit `fid_id` for a single active lane (blocked)

- [ ] Blocked pending an operator ruling: whether `fid_worktree` may accept an
  omitted `fid_id` when exactly one lane is active. This is a product decision
  about implicit lane targeting for mutating actions, not a defect repair, and
  the record's implementation does not depend on it. Re-attempt on a ruling.

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

`FID-2026-1024-001` closed and archived on 2026-10-24 (implementation
`16a70a59`), so its write grant — `class-owners.json`,
`fix-boundaries.json`, `tool-result-inspection.ts`,
`experience-classes.ts` — is released here. The reconciliation it performed
released `FID-2026-1015-006`'s ownership of four classes and
`FID-2026-1017-014`'s of one, and withdrew three refuted repair boundaries
without rewriting a ledger row; the implementation's live behavior stays
tracked as OBS-001 in `dev/tracking/internal-followups.json`.

`FID-2026-1024-002` is the current grant above, opened 2026-10-24 and converged
2026-10-26; its targets are the params module, its test file and the class
owner ledger. `Q2-FID-2026-1024-002` holds no write grant until an operator
ruling.
