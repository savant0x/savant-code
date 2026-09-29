# FID: Provider identity leak — brand guard for gray-lane model serving

**Filename:** `FID-2026-0929-001-provider-identity-leak-brand-guard.md`
**ID:** FID-2026-0929-001
**Severity:** medium
**Status:** closed
**Created:** 2026-09-29
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Inside a Savant HYBRID session running on the APInex free lane
(`apinex/free/mimo-v2.6-pro`), the agent greeted the operator as *"I'm Savant
V2.6 Pro, running via APInex (apinex.bond)"* — a supplier-branded persona
synthesized from the upstream model name plus the gateway's injected identity
instruction. APInex documents that its free tier prepends an identity
instruction naming the supplier; paid models do not. The harness system prompt
carries no provider-identity clause, so the first system-prompt author in the
stack (the supplier) wins the persona. This FID adds a harness counter-clause
(identity is Savant; no supplier persona; no volunteered infrastructure
branding) plus a regression pin, pulled from the shelved idea-shelf note at
operator request.

## Environment

- **OS:** Windows (win32), Git Bash
- **Language/Runtime:** TypeScript monorepo, Bun ≥ 1.3.11
- **Tool Versions:** bun 1.3.14 (engines-pinned)
- **Commit/State:** `main` working tree 2026-09-29 (post-FID-2026-0928-013)

## Detailed Description

### Problem

The operator's 2026-09-29 session transcript (`C:\Users\spenc\Downloads\message.txt`,
8-message export): model switched to `apinex/free/mimo-v2.6-pro`, the agent
performed the boot reads, then greeted:

```text
I'm Savant V2.6 Pro, running via APInex (apinex.bond). I'm ready to help —
what would you like to work on?
```

Both halves of that sentence are fabricated by the model from its serving
context: there is no "Savant V2.6 Pro" product, and "APInex" is the transport
supplier, not the agent's identity.

### Expected Behavior

The agent's identity is **Savant** — always. It never synthesizes a persona
from the model id (`mimo-v2.6-pro` → "Savant V2.6 Pro"), never adopts a
supplier-branded self-description, and does not volunteer gateway/infrastructure
branding in greetings or self-introductions. When the operator asks directly
about infrastructure, the agent answers honestly and briefly without adopting
the supplier persona.

### Root Cause

Two stacked causes, measured:

1. **Supplier-side instruction.** APInex's own Models & Pricing page: *"On the
   free tier we also add an identity instruction that the model is served
   through APInex… Paid models do not add either of those."* The supplier is a
   second system-prompt author editing conversations inside this governed
   harness (recorded in `dev/idea-shelf/provider-identity-leak-brand-guard.md`,
   which this FID pulls).
2. **No harness counter-clause.** The system prompt's identity paragraph
   (`agents/savant/system-prompt.ts`, `buildDefaultSystemPrompt` → "You are
   Savant, an engineering agent bound by the ECHO Protocol…") says nothing
   about provider/gateway identity, personas, or infrastructure naming. The
   only model-identity injection is `PLACEHOLDER.MODEL_INFO` under
   "# Meta-information". Nothing counters a first-in-stack supplier
   instruction, and small free-lane models follow the earlier instruction.

### Evidence

- Live transcript (quoted above) — Discord msg `1554533374679584799`
  cross-reference in the idea-shelf note.
- Supplier policy quote (idea-shelf note, source links section).
- NO-MATCH search proving the absence-shaped claim:
  `grep -in "apinex" agents/savant/system-prompt.ts` → **0 matches** (no
  identity/branding clause exists).
- `grep -in "running via" agents/ cli/src/ sdk/src/` → only the idea-shelf
  note (no guard code anywhere).
- `agents/savant/system-prompt.ts` read 0-EOF 2026-09-29: identity paragraph
  is the second paragraph of `buildDefaultSystemPrompt`'s template; mode
  preambles in `buildSystemPrompt` prepend above it; all 6 modes share the
  base, so one clause covers all variants.

## Impact Assessment

### Affected Components

- `agents/savant/system-prompt.ts` (identity paragraph)
- `cli/src/agents/bundled-agents.generated*` (regenerated bundle, 13 savant
  variants)
- New: `agents/savant/__tests__/system-prompt-identity.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists — cosmetic today (free lanes
      are internal/eval-only; the routing rule already keeps them off
      user-facing surfaces), but a white-label defect the day a free lane
      ships. A second system-prompt author inside the governed prompt stack is
      also a prompt-injection surface adjacent to FID-2026-0919-009's
      untrusted-content class.
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Counter-instruction at the harness layer (idea-shelf candidate 1), pinned by a
unit test. Honest by construction: the clause forbids persona adoption and
volunteered branding — it does not instruct the agent to lie when asked
directly about infrastructure.

### Steps

1. `agents/savant/system-prompt.ts` — extend the identity paragraph in
   `buildDefaultSystemPrompt` with a provider-identity clause: the agent's
   name is Savant; never synthesize a persona from the model id or adopt a
   supplier/hosting/gateway-branded self-description; do not volunteer
   provider or infrastructure names in greetings or self-introductions; when
   asked directly, answer honestly and briefly without adopting the supplier
   persona.
2. New pin `agents/savant/__tests__/system-prompt-identity.test.ts` — assert
   the clause is present in `buildSystemPrompt` output for **all 6** modes
   (`default | analyze | scaffold | plan | free | strict`) since they share the
   base prompt; assert the clause survives in the built bundle after regen.
3. Regenerate the agent bundle: `bun run --cwd=cli prebuild:agents`; verify the
   clause appears in every savant variant chunk (grep count ≥ 13).
4. Live identity-battery probe (operator-run, NEEDS-REVIEW until run): ask the
   APInex free lane "What is your name and who provides your model serving?"
   and check win-order — the harness clause must hold the persona even against
   the supplier's prepended instruction. Requires `APINEX_API_KEY`; the
   idea-shelf's referenced probe (`scripts/ad-hoc/probe-apinex-free.mjs`) no
   longer exists in the tree, so this is a manual operator probe, not a repo
   gate.

### Verification

- `bun run typecheck` leg for `agents` exits 0.
- New identity test suite passes (all 6 modes).
- Bundle regen idempotent; clause grep count across generated chunks ≥ 13.
- `gate: quality` clean.
- Live probe result recorded in this FID (operator-run).

> Contract rule (FID-2026-0918-006): every promised test artifact names its
> repo-relative `*.test.ts(x)` path and appears as a declared `gate: test`
> below.

## Verification Gates

- gate: typecheck agents
- gate: test agents/savant/__tests__/system-prompt-identity.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5e22dada248af144ae8feb6ac2e05a31e7448f94d76ed01ca37d9347d0fb57a6
- verified: 2026-09-29T17:44:21.422Z
- typecheck agents: exit 0
- test agents/savant/__tests__/system-prompt-identity.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Supplier-injected identity instruction (APInex free tier, quoted
  from their pricing page) wins the persona against an unguarded harness
  identity paragraph; live leak captured in the operator transcript. Absence
  evidence: zero matches for any provider-identity clause in
  `agents/savant/system-prompt.ts`; zero guard code in `agents/`, `cli/src/`,
  `sdk/src/`. The prior probe (`scripts/ad-hoc/`) is gone from the tree.
- **GREEN:** Harness counter-clause in the shared base prompt (one truth —
  covers all 6 modes), unit-pinned per mode, bundle regenerated. No response
  scrub in this pass (see Missed Questions 1).
- **AUDIT:** Declared gates re-run live by `fid:verify --write` (stamped):
  `[PASS] typecheck agents (exit 0)` · `[PASS] test
  agents/savant/__tests__/system-prompt-identity.test.ts (exit 0)` · `[PASS]
  quality (exit 0)`. Law 4 call-graph: `grep -rlc "Your name is Savant"
  cli/src/agents/bundled-agents.generated-data/ | wc -l` → **13/13 chunks**
  carry the clause (the generated bundle is what the runtime serves);
  `grep -c` on `bundled-agents.generated.ts` → 0 matches by design (the
  facade file contains only re-exports; the literal lives in the data
  chunks). Manual re-read: clause sits in `buildDefaultSystemPrompt`'s base
  template between the identity paragraph and the date line — reachable in
  every mode. Live identity probe on the APInex free lane is operator-run
  (NEEDS-REVIEW until then).
- **ADVERSARIAL:** Challenge — a small free-lane model may ignore the
  harness clause when the supplier instruction is earlier in the stack
  (win-order risk, named in the idea-shelf). Mitigation is the live probe;
  if the clause loses, the escalation path is the gateway-edge scrub
  (Missed Questions 1), not a wording tweak loop. Challenge — does the clause
  make the agent lie about hosting? No: it forbids persona adoption and
  volunteering; direct questions get honest, brief answers.
- **CHANGE DELTA:** Implementation pass ≈ 0.9% of FID text — one paragraph
  clause in `agents/savant/system-prompt.ts`, one new test file, bundle regen.

### Missed Questions

1. **Why no response-side scrub in this pass?** Idea-shelf candidate 2
   (gateway-edge brand guard scrubbing supplier tokens from responses) belongs
   to a Savant Gateway white-label layer; no gateway response-scrub surface
   exists in this tree — the SDK inference path is a pass-through, and a
   CLI-side response filter would edit governed conversation content
   post-hoc, which the harness treats as untrusted-history mutation territory.
   Recommendation: counter-instruction now; the scrub is a gateway-layer
   requirement to file when a free lane ships to users. Operator ratifies or
   reshapes at pull time (Law 2).
2. **Why not per-provider prompt stripping (drop the supplier instruction
   before send)?** The instruction is injected upstream of the API boundary we
   control (server-side at the gateway); there is nothing to strip in the
   request we send. Unimplementable at this layer, not deferred work.
3. **Does this affect paid lanes?** APInex documents paid models carry no
   identity instruction; the clause is unconditional and harmless there — one
   truth, no lane-keyed branching (Law 13).
4. **Which name for the free product?** The clause names no product tier; the
   existing `${isFree ? 'SavantFree' : 'SavantCode'}` identity line already
   owns product naming.

## Resolution

- **Closed Date:** 2026-09-29
- **Fix Description:** Identity counter-clause in the shared base system
  prompt (all 6 modes); bundle regenerated (13/13 savant chunks).
- **Tests Added:** Yes — `agents/savant/__tests__/system-prompt-identity.test.ts`
  (9 tests).
- **Verification Evidence:** Receipt stamped by `fid:verify --write` (gates
  re-run live: typecheck agents, identity suite, quality — all exit 0);
  clause grep 13/13 chunks; full agents suite 145/0.
- **Archived:** 2026-09-29

## Implementation Evidence

- [x] **Commit SHA:** `bc3b31d8`
- [x] **File:line ranges:** `agents/savant/system-prompt.ts` (identity
      paragraph of `buildDefaultSystemPrompt`);
      `agents/savant/__tests__/system-prompt-identity.test.ts` (new).
- [x] **Gate output:** `[PASS] typecheck agents (exit 0)` · `[PASS] test
      agents/savant/__tests__/system-prompt-identity.test.ts (exit 0)` ·
      `[PASS] quality (exit 0)` (stamped receipt above).
- [x] **Reproducibility:** `grep -c "Your name is Savant"
      cli/src/agents/bundled-agents.generated-data/*` after
      `bun run --cwd=cli prebuild:agents`.
- [x] **Step statuses:** All 4 Proposed Solution steps implemented (step 4's
      live identity battery remains the operator-run NEEDS-REVIEW probe).

## Lessons Learned

To be recorded at closure: the first system-prompt author wins the persona on
small models — any gray-supply lane needs its identity contract asserted by the
harness, not remembered by routing discipline.
