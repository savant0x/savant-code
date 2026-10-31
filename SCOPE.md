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

### FID-2026-1030-005 — Paper Instruments (Ultramarine) built-in provider (open)

- [ ] Authority: automation level 3. Operator asked to evaluate and add
  `https://docs.paperinstruments.com/docs` as a built-in provider, then named
  `.env.local` as the key surface and corrected the window assumption (a 100k
  row would strangle a long-context model). Additive provider work following
  `docs/adding-a-provider.md`.
- [ ] Write grant: `common/src/providers/registry-partitioned-5.ts`,
  `common/src/constants/model-config/gateway-catalogs.ts`,
  `common/src/constants/model-config.ts`,
  `common/src/providers/model-catalogs.ts`,
  `common/src/constants/context-windows.ts`,
  `common/src/constants/context-window-table.ts`,
  `common/src/constants/window-coverage-register.ts`,
  `common/src/providers/__tests__/validate-provider-registry.test.ts`,
  `common/src/providers/__tests__/provider-registry.test.ts`,
  `common/src/providers/__tests__/provider-registry-setup.test.ts`,
  `cli/src/utils/openrouter-models/static-catalogs-gateways.ts`,
  `cli/src/utils/openrouter-models/gateway-catalog-merge.ts`,
  new catalog + SDK routing test files, `cli/src/utils/__tests__/provider-setup.test.ts`,
  the generated provider-doc surfaces, and the hand-maintained doc surfaces the
  drift gate names. No behavior changes outside provider registration.

Measured 2026-10-30 with the operator key: `GET /v1/models` HTTP 200 with one
row (`ultramarine-1-flash`, fields `id`/`object`/`created`/`owned_by`, no
window), `GET /v1/usage` HTTP 200 with a zero balance, and a 16-token chat
request answered `429 insufficient_quota` (`x-should-retry: false`). Catalog
coverage is therefore `table-section`; inference is unverified pending funds.

### FID-2026-1030-006 — transcript streaming render hot path (open)

- [ ] Authority: automation level 3. Operator asked for a review of
  `resources/crush-main`, then for the integration ideas to be turned into a FID
  that runs the full Perfection Loop before any code exists. Measured root cause:
  one markdown render costs 51.97 ms at 20 000 characters against the 100 ms
  streaming flush, and the streaming path re-renders the whole body on every
  flush. This item's deliverable is the converged record plus the measured
  speedup model; implementation is the record's IMPLEMENT phase and starts on
  the operator's go-ahead.
- [ ] Write grant: `dev/fids/FID-2026-1030-006-transcript-streaming-render-hot-path.md`
  (record), `SCOPE.md` (register). No source code is written in the convergence
  phase. The record's later implementation surface is declared in its Proposed
  Solution and is re-registered here before any code is written.

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
- FID-2026-1030-006: `dev/fids/FID-2026-1030-006-transcript-streaming-render-hot-path.md`,
  `SCOPE.md`
- FID-2026-1030-005: `common/src/providers/registry-partitioned-5.ts`,
  `common/src/providers/model-catalogs.ts`,
  `common/src/providers/__tests__/*.test.ts`,
  `common/src/constants/model-config.ts`,
  `common/src/constants/model-config/gateway-catalogs.ts`,
  `common/src/constants/context-windows.ts`,
  `common/src/constants/context-window-table.ts`,
  `common/src/constants/window-coverage-register.ts`,
  `common/src/constants/provider-catalog-census.json`,
  `cli/src/utils/openrouter-models/static-catalogs-gateways.ts`,
  `cli/src/utils/openrouter-models/gateway-catalog-merge.ts`,
  `cli/src/utils/openrouter-models/__tests__/paperinstruments-catalog.test.ts`,
  `cli/src/utils/__tests__/provider-setup.test.ts`,
  `sdk/src/impl/__tests__/model-provider-free-mode-paperinstruments.test.ts`,
  `.env.example`, `README.md`, `README.zh-CN.md`, `cli/release/README.md`,
  `docs/providers.md`, `docs/features.md`, `docs/index.md`,
  `docs/installation.md`, `docs/sdk-overview.md`,
  `dev/fids/FID-2026-1030-005-paper-instruments-provider.md`

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
