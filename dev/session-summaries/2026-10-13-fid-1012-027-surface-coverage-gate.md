# FID-2026-1012-027 — gate coverage of a record's surfaces (2026-10-13)

**Status:** implemented, `fixed` (receipt stamped, 6/6 gates PASS live). **Program of record:**
`dev/fids/FID-2026-1012-022`; this pass closed the harness item the `-021` incident produced. Nothing is
pushed; local commits only.

## What landed

- `scripts/fid-surface-coverage.ts` (new) — the coverage collector. It joins two surfaces that already
  existed and had never been joined: each active `fixed`/`verified` record's declared gates (parsed by
  `fid:verify`'s own `parseVerificationGates` and keyed by its own `gateLabel`) and its authorised write
  surface (`SCOPE.md` → machine-readable scope targets, read through the parser the Law 2 write gate
  uses). Mapping v1: `scripts/**` ⇒ the scripts-tree typecheck probe; a path under a
  `VALIDATION_WORKSPACE_POLICY.requiredTypecheck` workspace ⇒ `typecheck <workspace>`; every record with
  a known surface ⇒ `quality`. A record with no register line, or a line naming no paths, is its own
  issue — the surface is unknown, so coverage cannot be claimed.
- `scripts/validate-repository.ts` — the collector runs as part of the repository gate, so an omission
  fails with the record, the missing declaration and the demanding glob named.
- `scripts/fid-verify.ts` — option B: `--write` refuses to stamp when `coverageStampBlockers` reports
  an uncovered declaration for the record, reusing the same collector so the stamp and the repo gate
  cannot disagree.
- `packages/agent-runtime/src/echo/scope-targets.ts` (new) — the ONE register parser, in two shapes
  (`loadScopeTargetsByItem` for per-record consumers, `loadScopeArtifact` for the write gate), plus a
  `sectionPresent` flag so a coverage consumer can tell "no section" from "no item". `pre-write-gates-law2.ts`
  re-exports the gate's original names, so the move is invisible to its importers.
- Tests: `scripts/__tests__/fid-surface-coverage.test.ts` (13 pins over temp roots, including the
  option-B refusal) and `packages/agent-runtime/src/echo/__tests__/scope-targets.test.ts` (both parser
  shapes + `sectionPresent`).

## The gate caught real omissions on the tree, not just on fixtures

The collector's first run over the real repository printed exactly **two** findings — both the class the
record was written for:

- `FID-2026-1012-018` — surface `common/src/tools/params/tool/**`, no `typecheck common`;
- `FID-2026-1012-020` — surface `sdk/src/run/**`, no `typecheck sdk`.

Both declared the leg and re-stamped their receipts (all gates exit 0). The real tree then reported
**0 coverage issues**, and the negative direction was re-proven by removing `-018`'s declaration line,
observing `fid.coverage.missing-gate`, and restoring it byte-for-byte. Option B refused a `--write` on
the same mutated record before running any gate, and stamped the clean record normally.

## Corrected in this pass

The first wiring attempt pushed `scripts/validate-repository.ts` past the 300-line quality ceiling and
the `quality` gate went red on it. The wiring was reduced to the import plus one array entry and two
redundant blank separators were dropped; the file is 299 lines and `quality:report` PASSes. The
`quality` gate doing its job on this record's own change is the same defect class the record audits.

## Boundaries worth repeating

- The mapping is a **lower bound** on the declared set: it proves a leg is declared, never that the
  declaration is the strongest gate for that surface.
- Only active `fixed`/`verified` records are covered; `converged` records are pre-implementation and
  declare no gates by construction.
- A missing register, or one without the machine-readable section, is inert here — that is
  `scope.unregistered-item`'s question, and reporting it per record would turn one register fix into N
  findings.

## Still open

1. **`fid:verify --check` does not carry the coverage relation** — the option-B refusal lives on the
   `--write` path; a `--check` sweep still reports only receipt validity. The repository gate covers the
   same ground (C3 + the collector), so this is a convenience gap, not an enforcement gap.
2. **The mapping grows by evidence.** v1 covers `scripts/**` and required-typecheck workspaces; a record
   whose surface implies a different enforced leg (e.g. eslint or markdownlint) is not yet demanded one.
