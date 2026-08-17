<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Build Order — ECHO Single-Agent Retrofit: Autonomy Modes + No-Speculation Rule

**Date:** 2026-08-13
**Status:** PLANNING — scoped for operator approval; no code/config changed yet
**Authoring lane:** Nova planning lane; the target harness authors and executes the FID.
**Authoritative sources (verified at source 2026-08-13 11:00 PM ET):**
- `dev/savant-code/dev/echo-v0.1.2-single-agent.md` (v0.1.2-single-agent, FreeBuff single-agent) — **missing** the entire Execution & Autonomy Modes section; missing any explicit no-speculation rule.
- `dev/savant-code/ECHO-single-agent.md` (22-line marker) — points to `dev/echo-v0.1.2-single-agent.md` as the real protocol; `single_agent.protocol` in `protocol.config.yaml` (`version: 0.1.2-single-agent`, `strict_mode: true`).
- `dev/savant-code/ECHO.md` (v0.2.0, Savant-Code 10-agent harness) — reference ONLY; has `## Execution & Autonomy Modes` at lines 634–647. **NOT modified by this build order.**

## 1. Root-cause finding (operator-identified, verified)

The single-agent ECHO retrofit (v0.1.2) was supposed to differ from `ECHO.md` **only in the agent roster** (10-agent → single-agent). All non-roster protocol content should have carried over verbatim.

**Gap confirmed:** `dev/echo-v0.1.2-single-agent.md` has NO `## Execution & Autonomy Modes` section (no Execution Modes table, no Autonomy Levels note). The Autonomy Levels concept exists only in `ECHO.md:646` and was never surfaced in the single-agent file. Because single-agent echo (used with FreeBuff) never showed it, the concept drifted — the CHANGELOG/FIDs adopted the de-facto term "automation level 3" instead of the protocol's "Autonomy Levels."

**Second gap (operator-directed):** the single-agent file has no explicit rule forbidding speculation / assumptions / guessing, with a mandate to ask for clarification when anything is unclear.

## 2. Why the files MUST stay separate (operator rationale, 2026-08-13)

The single-agent protocol (`dev/echo-v0.1.2-single-agent.md`) is run by **FreeBuff** under our standards. `ECHO.md` runs inside **Savant-Code**, which has capabilities the single-agent/FreeBuff runtime does **not** — e.g. the Thinker agent, the full 10-agent roster, EHEL, ZTAP. The two files are deliberately distinct governance documents; this build order edits **only** the single-agent file. `ECHO.md` is never touched. The retrofit is a *carry-over of non-roster content that should have transferred*, not a convergence of the two files.

## 3. Scope (SINGLE-AGENT VERSION ONLY)

> **Operator correction (2026-08-13, msg 1537656853239038042):** edits confined to the single-agent protocol file. `ECHO.md` (Savant-Code v0.2.0) is NOT modified.

### In scope
1. **Retrofit Autonomy Modes into single-agent protocol.** Add a `## Execution & Autonomy Modes` section to `dev/echo-v0.1.2-single-agent.md` mirroring `ECHO.md:634–647` (Execution Modes table: HYBRID/STRICT/SCAFFOLD/ANALYZE + the Autonomy Levels note). Carry-over only — the only intended delta from `ECHO.md` is the roster (already single-agent here).
2. **Add no-speculation rule to the SINGLE-AGENT file ONLY.** Add a new `## No Speculation` section stating: *If ANYTHING is not clear, ask for clarification. Never speculate, assume, or guess. Absence of information is a trigger to ask, not to infer.*
3. **Version bump single-agent protocol** `v0.1.2-single-agent → v0.1.3-single-agent`: update the file header (`version: 0.1.3-single-agent`), and `protocol.config.yaml` `single_agent.protocol.version`.
4. **Optional nit (flag for operator):** `dev/echo-v0.1.2-single-agent.md:375` Quick Reference points "This protocol → `ECHO.md`" — incorrect for single-agent; should point to the single-agent file. Include only if operator wants it.

### Out of scope (explicitly excluded)
- **ANY edit to `ECHO.md`** (Savant-Code v0.2.0). No no-speculation rule added there; no Autonomy Modes change there.
- Defining the Autonomy Levels *contents* beyond the existing `ECHO.md:646` stub (Guided/Supervised/Autonomous). The retrofit copies the stub as-is; a full definition is a separate, larger FID (not this build order).
- Any change to laws 1–15, Perfection Loop, or FID lifecycle in the single-agent file.
- Renaming "automation level 3" → "Autonomy Levels" in CHANGELOG/FIDs (separate cleanup, not blocking).

## 4. FID structure (operator-resolved: MERGED, single FID)

| FID | Scope |
| --- | --- |
| `FID-2026-0813-024-echo-single-agent-autonomy-modes-and-no-speculation-retrofit` | (1) Add `## Execution & Autonomy Modes` to single-agent protocol (carry-over from `ECHO.md:634–647`); (2) Add `## No Speculation` section (ask-for-clarification, never speculate/assume/guess); (3) Bump version to v0.1.3-single-agent; update `protocol.config.yaml`. |

Single merged FID (operator decision: merge 024+025). Autonomy Levels = stub-only copy (operator decision: copy, no full definition). No-speculation = new `## No Speculation` section (operator decision: correct placement, not folded into Law 1).

## 5. Verification matrix

| Area | Hard evidence |
| --- | --- |
| Autonomy retrofit | `dev/echo-v0.1.2-single-agent.md` contains `## Execution & Autonomy Modes` with Execution Modes table + Autonomy Levels note, text-matched to `ECHO.md:634–647` (minus roster-specific wording) |
| No-speculation | `dev/echo-v0.1.2-single-agent.md` contains `## No Speculation` with the clause: "If ANYTHING is not clear, ask for clarification. Never speculate, assume, or guess." `grep` for the rule text returns 1 match |
| Version bump | File header `version: 0.1.3-single-agent`; `protocol.config.yaml` `single_agent.protocol.version` updated; `grep -rn "0.1.2-single-agent"` returns 0 in protocol files |
| `ECHO.md` untouched | `git diff ECHO.md` is empty; no FID touches the Savant-Code harness protocol |
| Non-roster integrity | Diff confirms ONLY the intended additions; no law/Perfection-Loop/FID-lifecycle content altered in the single-agent file |
| Quick Reference nit (if approved) | `dev/echo-v0.1.2-single-agent.md:375` points to the single-agent file, not `ECHO.md` |

## 6. Governance and release boundary

This build order authorizes no code, commit, push, release, publication, or deployment. The ECHO single-agent protocol is a governance document; changes remain subject to operator approval. Nova's independent audit follows implementation.

## 7. Operator decisions logged

1. **Merge** — single FID `FID-2026-0813-024` (autonomy + no-speculation together).
2. **Copy** — Autonomy Levels = stub-only carry-over; full definition deferred to a separate FID.
3. **Correct** — no-speculation as a new `## No Speculation` section, not folded into Law 1.
4. **Files stay separate** — single-agent (`dev/echo-v0.1.2-single-agent.md`, FreeBuff) and `ECHO.md` (Savant-Code harness) remain distinct; edits to single-agent only because FreeBuff lacks Savant-Code capabilities (Thinker, 10-agent roster, EHEL, ZTAP).

*Planning source for the ECHO single-agent retrofit. Verified at source 2026-08-13 11:00 PM ET. Single-agent version ONLY; `ECHO.md` excluded. No changes made; awaiting operator approval.*
