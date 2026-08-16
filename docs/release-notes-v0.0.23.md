<!-- markdownlint-disable MD013 -->

# Savant-Code v0.0.23 — Release Notes

> **Status: released (2026-08-09).** This document is the v0.0.23 release body.

**v0.0.23 is the optimization, compliance, and quality-hardening release.** It delivers two
fully signed-off work programs — the optimization & automation batch (FIDs 003–010) and the
all-tier optimization program (FIDs 012–018) — plus gate hardening that puts every release
check on verified-green footing. The FID ledger holds **zero active FIDs**.

## What's new

### Governance & automation program (FIDs 003–010)

Independently signed off and closed. Adds machine-checkable contracts across the toolchain:

- **Canonical metadata validation** — repository metadata is validated against a single source of truth.
- **Deterministic validation-manifest parity** — `validate:repository` and the manifest agree by construction.
- **Bounded/redacted runtime evidence** — trace events are length-bounded and capped so instrumentation can never balloon storage.
- **Backward-compatible RunState serialization** — persisted state stays compatible with prior versions.
- **Bounded subagent propagation** — fail-closed child fan-out (32) and depth (8) limits.
- **Provider-registry exception/drift audits** — the unified registry (v0.0.22) now detects drift without changing routing.
- **Fail-closed single-agent boot contract** — a single-agent session can never silently fall back to the harness protocol.

### All-tier optimization program (FIDs 012–018)

Master plan + six children, implemented under the operator's automation level 3 grant,
closed with an independent Nova implementation audit **PASS**:

- **Gate restoration (Tier 0)** — `lint:md` restored to exit 0 across the design docs.
- **No-signature compliance scrub (Tier 1)** — `Author: Savant` attribution removed from active documents; dated historical records preserved (immutability).
- **File-length decomposition (Tier 2, batches A + B)** — 23 production files (up to 756 lines) decomposed to ≤400 lines via pure-move + re-export shims with **byte-identity proof** per file; serialized generator self-containment preserved.
- **Test-suite decomposition (Tier 2)** — 14 oversized test files split at describe boundaries with counts preserved exactly; all suites green.
- **Agent prompt token optimization (Tier 3)** — −1,301 tokens (−10.1% shipped payload) across the Savant/TUI prompts with zero behavioral change; agent bundle regenerated 616 KB → 568 KB.

### Release-gate hardening

Every gate was re-run end-to-end and fixed where needed:

- **SDK tests now self-resolve ripgrep** — the vendored `rg` binary is auto-discovered from `dist/vendor`; no manual `SAVANT_CODE_RG_PATH` required.
- **Manual E2E harnesses out of unit discovery** — the `browser-use`/`librarian` live-service scripts were renamed off the `*.test.ts` glob (now `manual-e2e.ts`) so `bun test` can never execute them; the agents suite is green.
- **Housekeeping** — leftover temp measurement file removed; 16 decomposition files prettier-formatted; lesson recorded in `LEARNINGS.md`.

### FID ledger reconciliation

`dev/fids/` holds **zero active FIDs**. Historically archived records with unclosed metadata
are accepted as historical per operator decision, with corrective index entries recorded.

## Verification (all green, re-run 2026-08-09)

| Gate | Result |
|---|---|
| Typecheck × 10 workspaces | ✅ |
| Test suites × 10 workspaces | ✅ (totals below) |
| ESLint `--max-warnings 0` | ✅ |
| Markdownlint | ✅ |
| Prettier (full repo) | ✅ |
| `validate:repository` | ✅ PASS |
| Provider-docs generation check | ✅ |
| scripts tests | ✅ 75 / 0 fail |
| `ci` build (SDK + Savant-Free binaries) | ✅ *(clean-shell env)* |

Suite totals: sdk 534 · cli 2,938 · common 557 · agents 44 · agent-runtime 761 ·
evals 69 · code-map 51 · database 15 · knowledge-graph 18 · llm-providers 58 · scripts 75.

## Notes

- **No breaking changes.** RunState serialization stays backward compatible; provider routing is unchanged.
- **Governance:** all program FIDs closed with independent Nova sign-offs; active
  documents follow the no-signature policy.
- **Prerequisite for publication:** set aside `.env.local` and dev `NEXT_PUBLIC_*`
  overrides (FID-2026-0805-002 env-integrity gate), then run the release pipeline.
