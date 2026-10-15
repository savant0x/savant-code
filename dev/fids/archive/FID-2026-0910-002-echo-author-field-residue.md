# FID: ECHO.md still required an Author field the no-signature policy abolished

**Filename:** `FID-2026-0910-002-echo-author-field-residue.md`
**ID:** FID-2026-0910-002
**Severity:** low
**Status:** closed
**Created:** 2026-09-10 01:10
**YAGNI-Compliance:** Verified (removes a dead rule and its propagation; adds nothing)
**Related:** FID-2026-0809-014 (no-signature policy scrub — the fix whose residue
this is), FID-2026-0910-001 (the Verifier FAIL that exposed it),
FID-2026-0810-003 (condensed protocol copies — the propagation surface)

---

## Summary

The no-signature policy scrub (FID-2026-0809-014, 2026-08-09) removed `Author:`
attribution from FID documents, the template, and every repository artifact —
but missed the **rule itself**: `ECHO.md`'s FID Authoring Rules still declared
`Author` a required metadata field. The stale rule propagated mechanically
into the generator-hosted condensed copies (`scripts/protocol-copies/content.ts`)
and the single-agent protocol document (`dev/echo-v0.1.2-single-agent.md` —
which forbids `Author:` at its own line 30), and from there into both
generated protocol constants every agent receives. Live consequence: during
the FID-2026-0910-001 AUDIT pass, the Verifier correctly FAILED the authored
FID for a missing `Author` field — a faithful application of a dead rule. This
FID drops `Author` from the required-fields sentence at all three source sites
and regenerates the protocol bundle, closing the gap between the written
protocol and the enforced policy.

## Environment

- **OS:** Windows 11 (win32), Git Bash (MSYS)
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14 (pinned)
- **Tool Versions:** savant-code v0.0.30 tree
- **Commit/State:** `7031d6b9da9a7007b8cf0bc1a95e56327187e01b` on main

## Detailed Description

### Problem

`ECHO.md:543` (FID Authoring Rules) read: "Required metadata fields:
**Filename**, **ID**, **Severity**, **Status**, **Created**, **Author**." —
in direct contradiction of the no-signature policy the same document family
established (and which the signature scrub had already enforced everywhere
else: template, all FIDs, all docs). The stale sentence survived because it
is also a **generator anchor**: `scripts/protocol-copies/content.ts:169`
carries the identical sentence in `FRAMING.fidAuthoringParagraphs`, which
`renderers.ts:64` folds into `ECHO_PROTOCOL_INSTRUCTIONS`, and
`dev/echo-v0.1.2-single-agent.md:288-289` carries it in the single-agent
protocol copy. `bun run generate:protocol-bundle` embeds all of it into
`protocol-bundle.generated.ts` and `echo-protocol-instructions.generated.ts`
— the bootstrap text every harness agent receives.

### Expected Behavior

The written protocol and the enforced policy agree: no FID metadata field
requires or mentions `Author`. Agents auditing FID template compliance can no
longer arrive at a verdict that fails a document for omitting a field the
governance forbids.

### Root Cause

The 2026-08-09 scrub swept **documents** but not the **rule text** inside the
governing documents, nor the generator source that mirrors that rule text.
The residue was flagged once before — `dev/session-summaries/2026-08-21-0314`
item 2, "ECHO.md stale Author rule" — and was never fixed. The drift guard
(`generate:protocol-bundle --check`) then kept the stale line frozen in the
generated copies: any ECHO.md edit requires the generator table update in the
same commit, which protected the line from incidental cleanup.

### Evidence

```text
# The stale rule, three source sites (pre-fix; all read 0-EOF this session):
ECHO.md:543
  **Severity**, **Status**, **Created**, **Author**.
scripts/protocol-copies/content.ts:169 (FRAMING.fidAuthoringParagraphs)
  'Use `templates/FID-TEMPLATE.md` as the exact template. Required metadata
  fields: **Filename**, **ID**, **Severity**, **Status**, **Created**,
  **Author**.',
dev/echo-v0.1.2-single-agent.md:288-289
  **Status**, **Created**, **Author**.

# The policy the rule contradicted:
templates/FID-TEMPLATE.md — zero Author matches (grep exit 1)
FID-2026-0909-006/-007/-008 (the three most recent FIDs) — zero Author matches
dev/echo-v0.1.2-single-agent.md:30
  "**NEVER** add `Author:`, `Fixed By:`, `Signed by:`, or any similar
  attribution to documents."
FID-2026-0809-014 — the scrub that removed Author: Savant everywhere else

# The live failure the residue caused (this session, FID-2026-0910-001 AUDIT):
  Verifier FAIL: "template requires **Author**; FID carries
  Filename/ID/Severity/Status/Created/YAGNI-Compliance/Related, no Author"

# The propagation path (Law 4 reachability, verified by grep):
  scripts/protocol-copies/content.ts:165  (fidAuthoringParagraphs definition)
  scripts/protocol-copies/renderers.ts:64  (...FRAMING.fidAuthoringParagraphs,)
  scripts/generate-protocol-bundle.ts     (renders → generated constants)
  common/src/constants/echo-protocol-instructions.generated.ts (1 hit)
  common/src/constants/protocol-bundle.generated.ts (1 hit)
  packages/agent-runtime/src/echo/protocol-refresh.generated.ts (0 hits —
    the refresh copy never carried the sentence)

# The prior flag that never landed:
  dev/session-summaries/2026-08-21-0314:53 "ECHO.md stale Author rule"
```

## Impact Assessment

### Affected Components

- `ECHO.md` — one line (required-fields sentence)
- `scripts/protocol-copies/content.ts` — one line (the mirrored sentence in
  `FRAMING.fidAuthoringParagraphs`)
- `dev/echo-v0.1.2-single-agent.md` — one line (the FID Format section copy)
- `common/src/constants/protocol-bundle.generated.ts` — regenerated (embedded
  ECHO.md copy)
- `common/src/constants/echo-protocol-instructions.generated.ts` —
  regenerated (condensed instructions copy)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: documentation-governance defect; consequences are wrong audit
      verdicts and rule text that contradicts enforced policy — no runtime
      behavior change

## Proposed Solution

### Approach

Drop `, **Author**` from the required-fields sentence at all three source
sites in one coordinated change (the drift guard requires the generator-table
update in the same commit as the ECHO.md edit), then regenerate the bundle.
The mechanical coupling is the reason this is one change and not three: an
ECHO.md-only edit fails `generate:protocol-bundle:check`; a generator-only
edit fails the parity suite (generated constants stale vs renderer).

### Steps

1. Edit the sentence in `scripts/protocol-copies/content.ts` (generator
   source) — done.
2. Edit the sentence in `dev/echo-v0.1.2-single-agent.md` — done.
3. Edit the sentence in `ECHO.md` — done.
4. `bun run generate:protocol-bundle` + `:check` — done (2 files updated).
5. Verify: parity suite, typecheck ×12, eslint, prettier, markdownlint —
   done (all green).
6. Path-scoped commit (G4) — done (`7031d6b9`).

### Verification

Parity suite `scripts/__tests__/protocol-copies.test.ts`: **15 pass / 0
fail** (pre-regen 14 pass / 1 fail — the drift guard correctly catching the
generated constants carrying the old sentence before regeneration; the
failing leg was `generated ECHO_PROTOCOL_INSTRUCTIONS matches the renderer
output`, exactly the half-landing the guard exists to catch).
`generate:protocol-bundle:check` exit 0. Root typecheck ×12 workspaces exit
0. `eslint --max-warnings 0` on content.ts clean. `prettier --check` clean
on both edited text files. `markdownlint` 0 issues on ECHO.md and the
single-agent doc. Post-fix grep: the sentence at all five surviving sites
reads `**Filename**, **ID**, **Severity**, **Status**, **Created**.` — zero
residual `**Author**` matches.

## Verification Gates

- gate: typecheck common
- gate: test scripts/__tests__/protocol-copies.test.ts

### Verification Receipt

- fingerprint: sha256:3e8d7c8fb34595f311ca689e6caa9d017b0de0485d6917c0ec0818259a753d45
- verified: 2026-09-10T16:37:50.268Z
- typecheck common: exit 0
- test scripts/__tests__/protocol-copies.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED / GREEN (2026-09-10, this session)

- **RED:** Residue exposed live by the FID-2026-0910-001 Verifier audit
  (FAIL on missing Author). Source-trace 0-EOF: the rule at ECHO.md:543,
  the generator mirror at content.ts:169, the single-agent copy at :288-289,
  the propagation chain (renderers.ts:64 → generate-protocol-bundle → both
  generated constants), the contradictory policy (single-agent doc :30,
  FID-0809-014, zero Author in template and the three most recent FIDs),
  and the 20-day-old unfixed flag (session summary 2026-08-21-0314).
- **GREEN:** Three coordinated one-line edits + bundle regen. The prettier
  indent casualty from the first content.ts edit was repaired by
  `prettier --write` (terminal-mediated); the drift guard's 14/1 intermediate
  state was the expected pre-regen leg, resolved to 15/0 by regeneration.
- **AUDIT:** Parity suite 15/0, typecheck ×12 exit 0, eslint 0, prettier
  clean, markdownlint 0 issues, `:check` exit 0 — all tool-mediated. Method 2:
  independent Verifier review (spawned after this record).
- **ADVERSARIAL:** SHIPPABLE-for-closure — all four Verifier
  NEEDS-REVIEWs CONFIRMED discharged by direct disk verification (receipt
  block real with tool-stamped fingerprint; the :53 citation verbatim; the
  failing-leg name resolves at protocol-copies.test.ts:133; residue
  complete — the pre-fix signature survives only in this record's own
  historical quotes, archived 0806-001/002 are deliberate audit-channel
  history). Independent corroboration: `scripts/fid-ledger.ts:32`
  FORBIDDEN_ATTRIBUTION actively forbade the field the old rule required —
  rule text and enforcement were in direct conflict pre-fix, in agreement
  post-fix. Two non-blocking out-of-scope flags: `docs/echo-protocol.md`
  public laws-table drift (Law 15 mismatch), and vendored ripgrep ENOENT in
  the SDK dist.
- **CHANGE DELTA:** n/a (initial record).

### Missed Questions

1. *Why did the Verifier flag this at all?* It audited FID-2026-0910-001
   against the rule text it receives (the generated protocol bundle) — the
   FAIL was correct rule-following, not hallucination. The defect was in the
   rule, not the auditor.
2. *Does any mechanical consumer require the Author field?* No — verified:
   `cli/src/utils/fid-loader.ts` extracts ID/Status/Severity/Summary/Parent
   only; `fid-gates.ts`, `hygiene.ts`, `learnings-schema.ts` have zero Author
   references; the loader test fixtures carry Author as **legacy-format
   parsing input**, not a requirement.
3. *Why fix the generator source rather than only ECHO.md?* The drift guard
   makes the pair atomic — and leaving content.ts alone would re-teach the
   dead rule to every agent through the instructions copy.
4. *Why fix the single-agent doc too?* Same residue class, and it was
   self-contradictory (its own :30 forbids `Author:`). It is not bundled
   (operator directive 2026-08-10), so no regen covers it — a manual edit
   is the only path.
5. *Was the refresh copy affected?* No — `protocol-refresh.generated.ts`
   never carried the sentence (grep count 0); the sentence lives only in the
   instructions copy and the embedded bundle.
6. *Precedent for direct-write FID authoring?* Hybrid-mode exception
   (operator directive 2026-08-23): 5-line change, no sub-agent authored the
   content, the full 0-EOF evidence chain is this session's own reads.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `7031d6b9da9a7007b8cf0bc1a95e56327187e01b`
- [x] **File:line ranges:** ECHO.md:543 · content.ts:169 ·
      echo-v0.1.2-single-agent.md:289 · both generated constants (regen)
- [x] **Gate output:** parity 15/0 · typecheck ×12 exit 0 · eslint 0 ·
      prettier clean · markdownlint 0 · `:check` exit 0
- [x] **Reproducibility:** `grep -rn "Created\*\*, \*\*Author" ECHO.md
      scripts/protocol-copies dev/echo-v0.1.2-single-agent.md
      common/src/constants` → zero matches; `git show 7031d6b9 --stat` →
      5 files changed, 5 insertions(+), 5 deletions(-)
- [x] **Step statuses:** Steps 1–6 all `implemented`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (three one-line source
      edits + regen, verified by `git show HEAD` diff)
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence present (content.ts:165 →
      renderers.ts:64 → generate-protocol-bundle → generated constants;
      grep-verified)
- [x] FID status reflects the actual implementation state (`verified` =
      implementation exists, gates green, commit recorded)

## Resolution

- **Closed Date:** 2026-09-10 02:27 (Adversary SHIPPABLE; closure ceremony executed)
- **Fix Description:** Dropped `**Author**` from the FID required-metadata
  fields sentence at ECHO.md:543, content.ts:169, and
  echo-v0.1.2-single-agent.md:289; regenerated the protocol bundle (2
  generated constants updated).
- **Tests Added:** No — the existing parity suite
  (`protocol-copies.test.ts`, 15 tests) is the regression guard: it fails
  when the generator table and ECHO.md drift apart, which is exactly the
  coupling that froze this residue in place.
- **Verification Evidence:** parity 15/0 · `:check` exit 0 · typecheck ×12
  exit 0 · eslint 0 · prettier clean · markdownlint 0 · commit `7031d6b9`
- **Archived:** 2026-09-10 02:27 (moved to `dev/fids/archive/`; receipt re-stamped at the archived path)

## Lessons Learned

A policy scrub must sweep the rule text, not just the artifacts the rule
governs — the sentence declaring a requirement is itself an artifact, and
when a generator anchors to it, the drift guard that normally protects
consistency will freeze the stale wording in place until someone edits all
coupled sites in one commit. And: when an auditor fails a document for
violating a rule that contradicts the governing policy, the auditor is the
signal, not the bug.