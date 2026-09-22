# Session 2026-09-19 22:00 — register completeness + FID-2026-0919-024 closure

## Session context

Two operator directives, in order:

1. "Close and archive FID-2026-0919-024 with its archive index entry, leaving the
   commit to me."
2. "Add a register-completeness check: flag approved items that appear in FIDs or
   session summaries but never got a SCOPE.md line."

Directive 2 followed the session's earlier finding that the scope guard built in
FID-2026-0919-024 detects the *label* but not the *omission*.

Governing protocol: `dev/echo-v0.1.2-single-agent.md` (single-agent mode;
`ECHO.md` is not the governance for this session, per the boot gate).

## Scope delivered

### 1. FID-2026-0919-024 closed + archived (operator directive)

The scope-trimming record was already `verified` on a live receipt. Closure:

- `Status: verified` → `closed`; Resolution restructured into the repo's closure
  format (Closed Date / Fix Description / Tests Added / Verification Evidence /
  Archived).
- Moved to `dev/fids/archive/FID-2026-0919-024-no-agent-side-scope-trimming.md`;
  receipt **re-stamped LIVE at the archived path** — 6/6 gates PASS, fingerprint
  `sha256:195a024a…` matching its final bytes.
- Its prose carried one uncovered test artifact (a bare filename that the
  contract diagnostic reads as "not on disk"); made repo-relative, then
  re-stamped, then the stale fingerprint citations in four files updated to the
  final one — the closure-churn class the earlier T69 work documented.
- Index section added to `dev/fids/archive/README.md`; `dev/fids/README.md`,
  `CHANGELOG.md` and SCOPE Task 74/T74-F updated.
- Commit SHA pending operator git execution (G2 withheld); evidence is the
  file:line + grep ranges in the record.

### 2. Register completeness — FID-2026-0919-025 (T75-A…E)

The quiet half of the scope guard. FID-2026-0919-024 made the disposition labels
mechanical; an item that never reaches `SCOPE.md` writes no token at all, so it
stayed invisible in the only surface the operator audits.

New authority `echo/scope-register-completeness.ts`, two decidable legs:

1. **FID coverage** — every active `dev/fids/FID-*.md` must be named in
   `SCOPE.md`, reported at the record's `**ID:**` line. The ledger and the archive
   are deliberately not the active queue.
2. **Task coverage** — every `Task NN` / `TNN-X` cited by an active FID or a
   session summary dated on/after `SCOPE_GUARD_EFFECTIVE_DATE` must exist as a
   `## Task NN` section or a `TNN-X` item.

Wired as `scope.unregistered-item` in `validate:repository` and as the
`scripts/scope-register-check.ts` probe (the `audit-gate-env-parity.ts` /
`scope-guard-check.ts` pattern, since `validate:repository` can never be a
declared FID gate — the FID-2026-0915-004 recursion). Not a write-time block by
design: a FID is created and registered in two writes, so blocking the first
would deadlock registration (the FID-2026-0917-002 deadlock class).

The requirement is stated where scope rules live: the single-agent protocol's
Scope Boundary ("Every tracked item has a register line") and the `SCOPE.md`
register preamble.

## The check caught its own author

The strongest evidence in this session is that the first live run was on the
record that created it, while that record was still unregistered:

| Run | Gaps | What changed |
| --- | --- | --- |
| 1 | **8** | — (active FID unnamed, `Task 75` / `T75-A…E` unregistered, two historical ids quoted) |
| 2 | **4** | Scan made inline-code aware: a quoted id is history, a bare one is the claim |
| 3 | **0** | The register line the check demanded (Task 75) |

The quotation rule is not new policy: it is the rule the disposition guard
already applies to its tokens, now shared through one exported helper
(`withoutInlineCode`) instead of restated — so both halves of the scope guard
agree on what a quotation is.

## Findings

| # | Finding | Level | Resolution |
| --- | --- | --- | --- |
| 1 | An item with no register line is invisible and droppable with no token to detect | 3 | Coverage enforced (`scope.unregistered-item` + probe) |
| 2 | A record quoting historical task ids was flagged as an unregistered claim | 3 | Inline-code rule (shared, not duplicated) |
| 3 | A suite pin failed on a wrong line expectation (`5`; the `**ID:**` line is `3`) | 3 | Expectation corrected — implementation was right |
| 4 | The suite imported `node:fs` twice (named + default) | 3 | Merged before the gates |
| 5 | L1 diagnostic reported line 1 instead of the metadata line | 3 | Reports the `**ID:**` line |

## Gates

`typecheck` ×12 exit 0 · `bun run test` exit 0 / 0 fail (12/12 workspaces) ·
eslint 0 · lint:md 0 · `prettier --check .` PASS · `quality:report` PASS (1498) ·
`validate:repository` PASS · `fid:verify --check` PASS · FID-2026-0919-025 receipt
stamped live 5/5 · protocol parity 22/0. Probe: `scope-register PASS (0 issues)`;
`scope-guard PASS (0 issues)`.

## Decisions and boundaries

- **The residual escape is recorded, not hidden.** A fully backticked citation
  escapes the scan — the same escape valve the disposition guard has, for the
  same reason (a historical id must be quotable). Backticking a live citation to
  hide it is a Law 2 violation whether or not the gate sees it.
- **Prose with no ids is not decidable.** A session that does work and files
  neither a FID nor a task reference writes nothing to match; no text check can
  decide that from the summary alone. Stated as the boundary of this check rather
  than papered over.
- **Nothing committed.** G2 withheld throughout.

## 3. B.AI credit-gate audit — FID-2026-0919-026 (T76-A…E)

Operator directive: audit `docs.b.ai/llmservice/introduction/` and test the key
for deepseek-v4.1-flash, hy3, mimo-v2.5, glm-5.3-flash, qwen3.8-flash, because
live use returns `credit insufficient balance: balance=0 required=3672` while the
/key page shows 100% free usage.

**Result: the integration is correct; the account has no credits, and the five
models are not free.**

| Layer | Verdict |
| --- | --- |
| Credential (both keys, both documented auth headers) | Valid — 200 on `/balance` and `/models` |
| Base URL / protocol / `strip` transform | Correct — production wire observed |
| Catalog | Correct — 47 internal ids, all five targets present |
| Vendor gate | Refusal — `insufficient_user_quota`, `personal_balance: 0` |
| "Free models" premise | Not supported by the vendor docs — cheapest paid tier |

Vendor's own quota endpoint, `GET /v1/balance` (documented as the key's balance
and quota surface): `{"personal_balance":0,"active_status":"active",
"api_key_type":"personal","user_id":"user_P2SuQ53ei5CZ"}` — both keys in the
working tree are the same account. Credits settle at 1 USD = 1,000,000, so the
operator's `required=3672` is **$0.0037** against a balance of exactly 0.

Production-chain proof for all five models (real SDK seam, `getModelForRequest`
→ AI SDK transport): `POST https://api.b.ai/v1/chat/completions` with the
correctly stripped upstream id and bearer auth, each refused by the vendor's
balance gate. Docs basis: B.AI is **prepaid**; every listed model has a non-zero
price; the only free credit is a **bonus that expires after 30 days**. History
corroborates: FID-2026-0911-004 recorded this key reaching HTTP 200 on
`qwen3.8-flash` on 2026-09-11 while `glm-5.3-flash` was already refused.

No repository claim is false (B.AI is documented as an OpenAI-compatible gateway
with an authenticated live catalog, never as free), and the vendor's error reaches
the operator intact — so no rendering fix was warranted. The one actionable
repository finding was that the vendor's authoritative balance endpoint went
unused, leaving account-state refusals undiagnosable inside the tool.

### T76-E — quota visibility (operator ruled "Both", implemented)

1. **`/health` line** — a data-only `quota?: { url; valuePath; unit?; note }` on
   `ProviderConfig` (mirroring `catalog`), declared for `bai` against
   `https://api.b.ai/v1/balance`; `cli/src/utils/provider-quota.ts` reads it
   (bounded 5s, never throws, never returns key material) and
   `handleHealthCommand` renders `**Quota:** …` for the active provider.
2. **Error hint** — `quotaHint` in the existing send-message hint seam
   (`fallback-hints.ts`, the FID-2026-0915-001 W5 pattern) appends the provider's
   declared note to a quota-class refusal and points at `/health`; it resolves the
   provider from `DIRECT_PROVIDER` or the model id's routing prefix, never
   fetches, and stays silent when no provider declares a note.

15 new pins (reader 6, hint 4, `/health` line 3, registry 2 — one of which
enforces that only providers documenting such an endpoint declare one). Two real
defects were caught by the gates during the pass and fixed: the registry entry hit
**303 lines against the 300 ceiling** (`quality` + `validate:repository` failed;
condensed back to 300 by moving the citation onto the `quota` field's type doc),
and four typecheck failures in the new test stubs (`as unknown as typeof fetch`
required, and a `let` binding TypeScript narrows to `null` across an async
closure). FID-2026-0919-026 receipt stamped live **8/8**.

Probes: `dev/scratchpad/active/bai-free-quota-audit.ts` (quota, both auth modes,
production catalog) and `dev/scratchpad/active/bai-chain-proof.ts` (production
chain + wire shape). Both gitignored; key material never printed (sha256 prefix
only). Probes left in place, not archived, so the operator can re-run them after
topping up.

## Closure (same session, operator directive)

Operator: "Close and archive FID-2026-0919-025 and FID-2026-0919-026 with archive
index entries, leaving the commit to me." Closed + archived 2026-09-19:

- Both records `verified` → `closed`; each Resolution restructured into the repo's
  closure format (Closed Date / Fix Description / Tests Added / Verification
  Evidence / Archived).
- Moved to `dev/fids/archive/`; each receipt **re-stamped LIVE at the archived
  path** so the closed record is byte-consistent with its final content —
  FID-2026-0919-025 **5/5 gates**, fingerprint `sha256:dd7cd79f…`;
  FID-2026-0919-026 **8/8 gates**, fingerprint `sha256:5a85c231…`.
- Index section added to `dev/fids/archive/README.md`; `dev/fids/README.md` ledger
  records both closures and states that the **active FID queue is empty**;
  `CHANGELOG.md` carries both closure lines; SCOPE Tasks 75 and 76 are marked
  CLOSED + ARCHIVED with T75-F / T76-F closure items.
- Neither record was edited after its final stamp — the fingerprint citations were
  written into the other files only after the stamp, so no closure churn was
  introduced.
- Commit SHAs pending operator git execution (G2 withheld); evidence is the
  file:line + grep ranges in each record, per the FID Lifecycle rule for `closed`.

## Next steps

1. Operator G2 commit authorization for the whole 0.0.33 working tree.
2. Vendor-side: fund the B.AI account — then re-run
   `bun run dev/scratchpad/active/bai-chain-proof.ts` as the acceptance test for
   the five models.
4. Vendor-side: fund the B.AI account (a $5 top-up is ~5,000,000 Credits) — then
   `dev/scratchpad/active/bai-chain-proof.ts` re-run is the acceptance test for
   all five models.
