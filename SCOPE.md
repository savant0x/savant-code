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

### AUDIT-2026-1102-002 — elephant-goldfish-model extraction review (completed)

- [x] Authority: automation level 3. Produce a read-only report identifying
  EGM workflow, review, artifact, and verification ideas that may be candidates
  for harness extraction after a Perfection Loop and retrofit review.
- [x] Write grant: `docs/reports/elephant-goldfish-model-extraction-audit.md`.
  No prototype or harness source code was modified by this audit. Evidence:
  report read 0-EOF; targeted Markdownlint and Prettier checks passed.

### AUDIT-2026-1102-001 — dsh-superagent prototype extraction review (completed)

- [x] Authority: automation level 3. Produce a read-only report identifying
  prototype features and design ideas that may be candidates for harness
  extraction after a Perfection Loop and retrofit review.
- [x] Write grant: `docs/reports/dsh-superagent-prototype-extraction-audit.md`.
  No prototype or harness source code was modified by this audit. Evidence:
  report read 0-EOF; `git diff --check` passed for the changed tracked file.

### AUDIT-2026-1116-001 — design research artifacts intake (completed)

- [x] Authority: automation level 3, operator instruction `push it all` on
  2026-11-16. Commit three design research artifacts that existed untracked in
  the tree with no register line: `docs/design/Dual-Mode Model Picker
  Architecture.md` (2026-10-30), `docs/design/gem2.md` (2026-10-30) and
  `docs/design/arch-study.md` (2026-11-02).
- [x] Write grant: those three paths only. They are committed verbatim as
  reference records: no source code, no behavior change, no claim adopted from
  them. `docs/**` is Markdown-lint-exempt (`.markdownlintignore`, operator
  ruling 2026-10-19), which is why they were never linted while untracked.
  Evidence: `git status` showed them untracked and `grep docs/design SCOPE.md`
  returned no grant; both facts are reproduced in the 2026-11-16 session
  summary.

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

### Q2-FID-2026-1024-002 — implicit `fid_id` for a single active lane (blocked)

- [ ] Blocked pending an operator ruling: whether `fid_worktree` may accept an
  omitted `fid_id` when exactly one lane is active. This is a product decision
  about implicit lane targeting for mutating actions, not a defect repair, and
  the record's implementation does not depend on it. Re-attempt on a ruling.

### FID-2026-1030-001 — video modality feasibility report (open)

- [ ] Authority: automation level 3. Operator-requested read-only evidence
  report documenting whether video-capable models are already reachable through
the provider pipeline, and why the harness cannot use them.
- [ ] Write grant: `docs/reports/video-modality-feasibility.md` (new file),
  `dev/fids/FID-2026-1030-001-video-modality-feasibility-report.md` (open FID
  record). No source code is modified. No behavior changes.

Three independent artifacts corroborate the finding: the wired free-options
digest, the daily harvest scrape (`candidates.json` / `report.md`) and the
offers feed, each of which lists video-capable model IDs. The report records
the `console.flatkey.ai` boundary-ok probe, the `newapi.prorisehub.com`
`modelsCount: 0` trap, and the open questions that still require live probes.

### FID-2026-1030-002 — media-mode artifacts and report correction (open)

- [ ] Authority: automation level 3. Operator-requested durable capture of the
  Gemini Deep Research prompt, plus the capability-claim and drop-point
  corrections the FID-2026-1030-001 audit produced.
- [ ] Write grant: `docs/research/media-mode-dual-picker-research-prompt.md`
  (new file), `docs/reports/video-modality-feasibility.md` (§2/§4/§5
  corrections), `dev/fids/FID-2026-1030-002-media-mode-artifacts-and-capability-claim-correction.md`
  (FID record). No source code is modified. No behavior changes.

The prompt asks an external research service to evaluate the operator's
proposed dual-mode model picker (text mode vs media-generation mode) against
prior art. The same record corrects the report's §4 item 3, which cited
`resolveMappedModelProtocol` — a symbol with zero grep hits in this repository —
and replaces it with the verified drop point in `catalog-filter.ts`.

## Machine-readable scope targets

- FID-2026-1030-001: `docs/reports/video-modality-feasibility.md`,
  `dev/fids/FID-2026-1030-001-video-modality-feasibility-report.md`
- FID-2026-1030-002: `docs/research/media-mode-dual-picker-research-prompt.md`,
  `docs/reports/video-modality-feasibility.md`,
  `dev/fids/FID-2026-1030-002-media-mode-artifacts-and-capability-claim-correction.md`
- AUDIT-2026-1116-001: `docs/design/Dual-Mode Model Picker Architecture.md`,
  `docs/design/gem2.md`, `docs/design/arch-study.md`

`FID-2026-1030-006` closed and archived on 2026-10-30 (implementation in the
working tree, uncommitted at the operator's no-commit instruction), so its write
grant — the streaming markdown render cache, its renderer/types/component
wiring and the cache suite — is released here; the evidence lives in the
archived record, the changelog and the session summary. The operator's
2026-11-16 instruction `push it all` lifted that hold: the implementation is
committed and pushed, so the archived record's `file:line` evidence is now
backed by a commit as well.

`FID-2026-1030-005` closed and archived on 2026-10-30 (implementation
`42b1a2c9`), so its write grant — the Paper Instruments registry entry, its
static catalog and `MODEL_CATALOGS` key, the 262,144 fallback row and
`table-section` coverage entry, the picker builder and merge wiring, the pinned
provider tests it extended, and the generated plus hand-maintained provider docs
— is released here; the evidence lives in the archived record, the changelog and
the session summary. The unobserved piece (a funded vendor completion) is
tracked as OBS-003 in `dev/tracking/internal-followups.json`, independently of
this closure.

`FID-2026-1030-004` closed and archived on 2026-10-30 (implementation
`90768081`), so its write grant — the Hyper registry entry, its live catalog
wrapper and parser test, the fan-out/ladder/merge wiring, the exception manifest
and window-coverage entries, the pinned provider tests it extended, and the
generated plus hand-maintained provider docs — is released here; the evidence
lives in the archived record, the changelog and the session summary. The
unobserved piece (an authenticated vendor completion) is tracked as OBS-002 in
`dev/tracking/internal-followups.json`, independently of this closure.

`FID-2026-1030-001` holds that write grant until closure, then releases it
here. The work is documentation only: no source code and no behavior changes.

`FID-2026-1030-002` holds its write grant until closure, then releases it here.
Documentation only: no source code and no behavior changes.

`FID-2026-1026-001` closed and archived on 2026-10-26 (implementation
`9b90bff9`), so its write grant — the npm pack reader, its unit suite, the
post-release verifier and the CLI release test — is released here.

`FID-2026-1024-002` closed and archived on 2026-10-26 (implementation
`cf144be6`), so its write grant — `params/tool/fid-worktree.ts`, its test file
and `class-owners.json` — is released here; the evidence lives in the archived
record, the changelog and the session summary.

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

`Q2-FID-2026-1024-002` holds no write grant until an operator ruling.
