<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: ZTAP Export — /attest Trust Receipt

**Filename:** `FID-2026-0813-007-ztap-attest-export.md`
**ID:** FID-2026-0813-007
**Severity:** medium
**Status:** closed
**Planning Status:** Converged after Perfection Loop; implementation complete.
**Created:** 2026-08-13
**YAGNI-Compliance:** Complete — implementation scope delivered
**Master FID:** FID-2026-0813-001
**Depends On:** FID-2026-0813-004

---

## Summary

Implements the `/attest` command in `cli/`: reads `.savant/provenance/`, produces `trust-receipt.json` (authoritative)
and a self-contained offline `trust-receipt.html` (Neon Slate themed, inlined assets, zero network) that embeds the
JSON plus an inline JS verifier performing JCS re-canonicalization, signature verification against embedded public
role keys, and live/superseded classification via content-hash recomputation (master D6, D11). An auditor opens the
HTML with zero Savant-Code install.

## Environment

- **OS:** Windows (`win32`); cross-platform (Bun)
- **Language/Runtime:** TypeScript, Bun 1.3.14; `cli/` workspace; reuses `/export` branded-HTML pipeline
  (`cli/src/commands/export-conversation.ts`)
- **Master:** `FID-2026-0813-001` (D5, D6, D11, D12)
- **Depends on:** FID-2026-0813-004 (ledger format)

## Detailed Description

### Problem

The signed chain lives in `.savant/provenance/` — invisible without an export surface. The build order's P1.B requires
a self-contained offline "Trust Receipt" openable by an auditor with zero Savant-Code install; the value case requires
the receipt to *prove* the chain, not just display it.

### Expected Behavior

`/attest` (options: `--session <id>` | `--all` | default current session) writes:

- `trust-receipt.json` — session manifest (public role keys, role map, bounds, mode, `failClosed` markers), all
  receipts, and per-receipt validation results + live/superseded classification; the authoritative artifact.
- `trust-receipt.html` — self-contained; Neon Slate theme; inlined assets; **embeds the JSON verbatim**; inline JS
  verifier performs: (1) JCS re-canonicalization of every receipt, (2) signature verification against embedded
  pubkeys, (3) content-hash recomputation against current disk state (live/superseded), (4) chain rendering per FID
  (aggregated view), (5) a summary header (counts + first failing check). The page states it is a convenience view and
  the JSON is authoritative (master Loop 2 fix).
- Terminal summary: counts (receipts, live/superseded, complete/pending, per-FID), mode, first failing check.
- Auditor-facing trust warning (Nova audit flag #2): both artifacts state that receipt trust rests on the session's
  ephemeral key — memory-only custody, never persisted; a compromised session key compromises every receipt of that
  session. The HTML embeds the convenience-view disclaimer **verbatim**: "This HTML is a convenience view;
  `trust-receipt.json` is the authoritative artifact."

### Root Cause

No export surface exists for provenance; the existing `/export` pipeline renders conversation HTML and is the reuse
target.

### Evidence

- `/export` pipeline: `cli/src/commands/export-conversation.ts` (branded offline HTML generation).
- Ledger: `.savant/provenance/<sessionId>/receipts.jsonl` + `session.json` (FID-2026-0813-004).
- Theme: Neon Slate (existing Savant theme assets; exact source pinned at implementation).

## Impact Assessment

### Affected Components

- NEW `cli/src/commands/attest.ts` (+ command-registry wiring)
- NEW `cli/src/commands/attest/serializer.ts` + `attest/verifier.ts` (thin wrapper over shared `validateReceipt`)
- Reuse: `/export` HTML pipeline (template/asset inlining)
- Tests: `cli/src/commands/__tests__/attest.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Export correctness is the product's proof surface — a broken export is worse than no export
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Read-only command: read ledger → validate every receipt with the shared validator → classify live/superseded by
recomputing content hashes against disk → serialize JSON → render HTML from the `/export` template pipeline with the
inline verifier. The inline verifier is generated from the same validation code where feasible (bundled) to avoid
drift between server-side and client-side checks.

### Steps

1. Ledger reader: enumerate `.savant/provenance/`, load session manifest + receipts, apply session selection.
2. Validation pass: run shared `validateReceipt` per receipt; collect typed failures.
3. Classification: recompute each receipt's target-path content hash; `live` (matches) / `superseded` (mismatch);
   include a hash of the current file state (never the content — Law 12).
4. JSON serializer: schema-stable `trust-receipt.json`.
5. HTML renderer: reuse `/export` inlining; embed JSON; inline verifier (JCS + signature + hash checks);
   per-FID aggregation; honest-claim header (D12).
6. Terminal summary + tests (valid ledger, empty ledger, superseded classification, tampered receipt flagged).

### Verification

```text
bun test cli/src/commands/__tests__/attest.test.ts
bun run --cwd=cli typecheck
bun x eslint cli/src/commands/attest.ts --max-warnings 0
bunx prettier --check cli/src/commands/attest.ts
# FID-2026-0813-008 owns the clean-process validation gate
```

## Perfection Loop

### Loop 1 — RED

- **RED:** The build order's `/attest` scope (read ledger → signed offline HTML) lacked an authoritative-JSON split,
  inline verification, and supersession semantics; the "signed offline HTML" phrasing implied signing the HTML, which
  is unnecessary and fragile.
- **GREEN:** Two-artifact design (authoritative JSON + convenience HTML), inline verifier, live/superseded
  classification, per-FID aggregation, honest-claim header.
- **AUDIT:** `/export` pipeline reuse confirmed (`cli/src/commands/export-conversation.ts`); the verifier is
  generated from shared validation code (no drift); Law 12 respected (hashes, never content).
- **ADVERSARIAL:** "HTML is the deliverable an auditor opens — can it lie?" → The JSON is authoritative and
  independently scriptable; the HTML states its convenience status and embeds the JSON verbatim; FID-2026-0813-008
  validates the export in a clean process. Accepted.
- **CHANGE DELTA:** ~0.

### Missed Questions

1. **Does `/attest` write into the project or the chat dir?** → Project root next to `.savant/` (default) or explicit
   `--output` path; documented in the command help.
2. **Can `/attest` run with no ledger?** → Yes — it emits an explicit "no provenance for this session/project" report
   (exit 0); absence is honest state, not an error.
3. **Are superseded receipts still verifiable?** → Yes — the signature chain remains intact; classification is a
   view-layer fact, not a ledger mutation (D6).
4. **Does the export include ad content (Savant-Free)?** → No; the receipt is a pure trust artifact in every
   variant — ad injection never touches the receipt. Whether P1 ships in Savant-Free at all is the build order's Q4
   and remains the operator's decision; the export design is identical either way (fixes F8 wording: no implied
   resolution).

### Code Verification Evidence

- [x] `/export` pipeline located (`cli/src/commands/export-conversation.ts`)
- [x] Ledger format defined (FID-2026-0813-004) and schema defined (master)
- [x] FID ledger validation passes (master + children set)
- [x] Command implementation + tests — 11/11 focused tests passed

### Loop 2 — Independent audit and self-correction

- **RED:** Second pass: inline verifier code size could bloat the HTML; the JSON could leak the session seed if the
  manifest serializer is reused carelessly; `--all` across many sessions could be slow.
- **GREEN:** The inline verifier is minified from the shared validator (single source); the JSON serializer explicitly
  whitelists manifest fields (public keys only — custody scan from FID-2026-0813-005 covers this artifact);
  `--all` streams per-session results with a progress line and a bounded result set.
- **AUDIT:** Re-read confirms field whitelist and bounded streaming are specified.
- **ADVERSARIAL:** "A crafted ledger could make the exporter emit a huge HTML" → bounded result set + size cap on the
  HTML output; overflow surfaces as an explicit truncation notice, never a silent drop. Accepted.
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** No residual risks.
- **GREEN:** Export design final.
- **AUDIT:** Converged; delta <2%.
- **ADVERSARIAL:** No unresolved challenge.
- **POST-NOVA (independent audit, FID-2026-0813-001 planning approval):** auditor-facing session-key trust warning
  added to Expected Behavior (flag #2); the convenience-view disclaimer is now a verbatim-embed requirement in the
  HTML (flag #3).
- **CHANGE DELTA:** <2%.

## Implementation Closure — COMPLETE

- **Implemented:** 2026-08-13.
- **Delivered:** `/attest` is registered in the CLI and writes authoritative `trust-receipt.json` plus a self-contained offline HTML convenience view with an inline verifier, public-key-only manifest serialization, live/superseded classification, and explicit ephemeral-session-key trust warnings.
- **Verification:** CLI `/attest` suite passed 11/11; CLI typecheck passed; command registry/slash-menu parity is green.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Offline trust-receipt JSON/HTML export and inline verification implemented.
- **Tests Added:** Export serialization, verifier, registry, classification, and output-boundary tests.
- **Verification Evidence:** Focused suite 11/11 and full repository gates passed.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

- A proof surface needs an authoritative artifact plus a convenience view, not one blended artifact that tries to be
  both.
- Export code must whitelist what it serializes; "reuse the manifest" is a Law-12 incident waiting to happen.
