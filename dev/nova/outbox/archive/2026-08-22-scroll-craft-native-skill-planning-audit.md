# Nova Planning Audit — Savant-Code Native Skill Design (Scroll-Craft Transposition)

**Date:** 2026-08-22
**Auditor:** Nova (independent)
**Input:** `docs/design/Savant-Code Native Skill Design.md` (Gemini Deep Research output, operator-routed)
**Verdict:** SOUND — proceed to FID authoring with 4 amendments below.

---

## What Gemini got right (verified against the tree)

1. **Roster fidelity is accurate.** Verifier zero-tools, Adversary override authority
   (FID-2026-0805-004), Detective read-only, Thinker no-code — the choreography in §3
   matches ARCHITECTURE.md exactly. No separation-of-duties violations proposed.
2. **The hook infrastructure EXISTS.** Gemini's fingerprint-gate mechanism (PreToolUse hook
   on Forge `write_file`, exit-2/`permissionDecision: deny` blocking) is real, not invented:
   `protocol.config.yaml:160-185` documents PreToolUse hooks, fail-closed on exit code 2 or
   JSON deny. `docs/design/hook-system.md:51` confirms "Only PreToolUse can block a tool."
   The gate is implementable today with zero harness changes.
3. **ZTAP citation is legitimate** — `docs/design/zero-trust-agentic-provenance.md` exists;
   Gemini found it via repo crawl. Not a hallucination.
4. **The strongest GREEN decisions are genuinely good:**
   - Raster-pixel composited contrast (not accessibility-tree) — solves the canvas/WebGL
     blind-spot correctly
   - Weighted fingerprint dimensions (Grammar + Signature Move ×2, threshold 5) — fixes the
     real 4-of-6 false-positive weakness in the original
   - Signature Move: Thinker proposes 3, Adversary picks max-semantic-distance — mechanical
     novelty pressure
   - Feeling Curve → token-override mapping + >40% visual-density delta requirement — makes
     emotion auditable without pretending psychology is provable
   - Scroll-proportionality guardrail (1 wheel px = 1 doc px) — kills scroll-jacking
     structurally, the best ethical gate in the document
   - 15-keystroke keyboard critical-path test — concrete, measurable, unoverrideable
5. **Rejected-ideas section is correct** — 1:1 engine port, Verifier-run scripts, infinite
   scroll loops all rightly killed with law-grounded reasons.

## Amendments required before FID authoring

**A1 — Engine port contradiction (HIGH).** §13 rejects "porting scrollcraft.js 1:1" citing
Law 11, but §7's `templates/base-kinematics.ts` IS a hand-written kinematics engine shipped
with the skill. Resolution: the skill ships its own native engine module (written once,
governed by this FID's loop) — that is not a 1:1 port and is consistent. State this
explicitly in the FID so the Adversary doesn't refute the design on the apparent
contradiction.

**A2 — Hook mode dependency (MEDIUM).** `protocol.config.yaml` hooks are
`mode: 'record'` currently; the gate requires `'enforce'`. The FID must include flipping
hook mode for this matcher (or scoping enforcement to the scroll-craft matcher only) and
must address the blast radius of enforce mode on other tools.

**A3 — Playwright dependency placement (MEDIUM).** Original's own doctor.mjs lesson:
`playwright-core` resolves from the wrong directory and browser binaries need management.
The FID must specify: dependency lives in the skill's scripts folder with its own package.json
(or uses Bun's native test browser APIs if viable), plus a doctor-equivalent preflight script.
Cross-platform claim must be TESTED on Windows first (our host), not assumed.

**A4 — Scope discipline for v1 (LOW).** Gemini's Phase 1-5 sequencing is good but Phase 3
(L) + Phase 5 (L) are the risk concentration. Recommend the FID target Phases 1-2 as the
first landed increment (skeleton + gate = fully testable without a browser), with 3-5 as
follow-on FIDs. Prevents a monolithic mega-FID.

## Non-blocking notes

- §5's "50vh zero-text padding" peak metric and "30% scroll duration" are arbitrary but
  defensible constants — parameterize in the skill config so operators can tune.
- The 10-iteration circuit breaker vs. fingerprint-gate exhaustion: Gemini's solution
  (pre-compute valid permutations for the Thinker) is elegant; keep.
- Contact-sheet-to-scratchpad for humans + JSON-only for Verifier: exactly matches our
  "test renderer is not a proxy" lesson inverted — good.
- Minor: Gemini cites ">75 lines" Hybrid threshold (single-agent doc) while the harness
  ECHO.md uses ">20 lines + new APIs". Use the harness value in the FID.

## Verdict

The Gemini output survived independent verification — citations check out, choreography is
lawful, the two best mechanisms (hook-enforced fingerprint gate, raster-contrast evidence)
are implementable with existing infrastructure. Proceed to FID authoring incorporating
amendments A1-A4. Suggested split: FID-A = Phases 1-2 (skeleton + gate), FID-B = Phase 3
(harness), FID-C = Phases 4-5 (debate + devices).
