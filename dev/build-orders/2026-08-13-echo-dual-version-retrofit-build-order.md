<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Build Order — ECHO Protocol Retrofit: Autonomy Modes + No-Speculation Rule (Dual-Version)

**Date:** 2026-08-13
**Status:** PLANNING — scoped for operator approval; no code/config changed yet
**Authoring lane:** Nova planning lane; the target harness authors and executes the FIDs.
**Authoritative sources (verified at source 2026-08-13 11:00 PM ET):**
- `dev/savant-code/ECHO.md` (v0.2.0, Savant-Code 10-agent harness) — has `## Execution & Autonomy Modes` at lines 634–647 (Autonomy Levels named-but-undefined stub at 646).
- `dev/savant-code/dev/echo-v0.1.2-single-agent.md` (v0.1.2-single-agent, FreeBuff single-agent) — **missing** the entire Execution & Autonomy Modes section; missing any explicit no-speculation rule.
- `dev/savant-code/ECHO-single-agent.md` (22-line marker) — points to `dev/echo-v0.1.2-single-agent.md` as the real protocol; `single_agent.protocol` in `protocol.config.yaml` (`version: 0.1.2-single-agent`, `strict_mode: true`).

## 1. Root-cause finding (operator-identified, verified)

The single-agent ECHO retrofit (v0.1.2) was supposed to differ from `ECHO.md` **only in the agent roster** (10-agent → single-agent). All non-roster protocol content — the 15 Laws, Perfection Loop, FID lifecycle, and the `## Execution & Autonomy Modes` section — should have carried over verbatim.

**Gap confirmed:** `dev/echo-v0.1.2-single-agent.md` has NO `## Execution & Autonomy Modes` section (no Execution Modes table, no Autonomy Levels note). The Autonomy Levels concept exists only as a one-line stub in `ECHO.md:646` and was never surfaced in the single-agent file. Because single-agent echo (used with FreeBuff) never showed it, the concept drifted — the CHANGELOG/FIDs adopted the de-facto term "automation level 3" instead of the protocol's "Autonomy Levels."

**Second gap (operator-directed):** Neither version has an explicit rule forbidding speculation / assumptions / guessing, with a mandate to ask for clarification when anything is unclear. Law 1's "No assumptions" is scoped to file-reading only; there is no general no-speculation law.

## 2. Scope

### In scope
1. **Retrofit Autonomy Modes into single-agent protocol.** Add a `## Execution & Autonomy Modes` section to `dev/echo-v0.1.2-single-agent.md` mirroring `ECHO.md:634–647` (Execution Modes table: HYBRID/STRICT/SCAFFOLD/ANALYZE + the Autonomy Levels note). This is a *carry-over*, not a new design — the only intended delta from `ECHO.md` is the roster.
2. **Add no-speculation rule to BOTH versions.**
   - `ECHO.md`: add a new law or dedicated subsection (e.g. under `## The 15 Laws` as an explicit addition, or a new `## No Speculation` section) stating: *If ANYTHING is not clear, ask for clarification. Never speculate, assume, or guess. Absence of information is a trigger to ask, not to infer.*
   - `dev/echo-v0.1.2-single-agent.md`: add the identical rule.
3. **Version bump single-agent protocol** `v0.1.2-single-agent → v0.1.3-single-agent`: update the file header (`version: 0.1.3-single-agent`), the `ECHO-single-agent.md` marker reference if needed, and `protocol.config.yaml` `single_agent.protocol.version`.
4. **Optional nit (flag for operator):** `dev/echo-v0.1.2-single-agent.md:375` Quick Reference points "This protocol → `ECHO.md`" — incorrect for single-agent; should point to the single-agent file. Include only if operator wants it.

### Out of scope
- Defining the Autonomy Levels *contents* beyond the existing `ECHO.md:646` stub (Guided/Supervised/Autonomous). The retrofit copies the stub as-is; a full Autonomy Levels definition is a separate, larger FID (not this build order).
- Any change to the 10-agent `ECHO.md` roster, laws 1–15, or Perfection Loop.
- Renaming "automation level 3" → "Autonomy Levels" in CHANGELOG/FIDs (separate cleanup, not blocking).

## 3. FID structure (proposed)

| FID | Scope | Depends on |
| --- | --- | --- |
| `FID-2026-0813-024-echo-autonomy-modes-retrofit` | Add `## Execution & Autonomy Modes` to single-agent protocol (carry-over from `ECHO.md:634–647`); bump version to v0.1.3-single-agent; update `protocol.config.yaml` | — |
| `FID-2026-0813-025-echo-no-speculation-rule` | Add identical no-speculation/ask-for-clarification rule to BOTH `ECHO.md` and `dev/echo-v0.1.2-single-agent.md` | — |

Two standalone FIDs (not a parent/child chain — independent sections). Could be merged into one FID if operator prefers; splitting keeps the autonomy-retrofit (carry-over) distinct from the new-rule addition.

## 4. Verification matrix

| Area | Hard evidence |
| --- | --- |
| Autonomy retrofit | `dev/echo-v0.1.2-single-agent.md` now contains `## Execution & Autonomy Modes` with Execution Modes table + Autonomy Levels note, text-matched to `ECHO.md:634–647` (minus roster-specific wording) |
| Version bump | File header `version: 0.1.3-single-agent`; `protocol.config.yaml` `single_agent.protocol.version` updated; `grep -rn "0.1.2-single-agent"` returns 0 in protocol files |
| No-speculation rule | Both files contain the identical clause: "If ANYTHING is not clear, ask for clarification. Never speculate, assume, or guess." `grep` for the rule text in both returns 1 match each |
| Non-roster integrity | Diff confirms ONLY the intended additions; no law/Perfection-Loop/FID-lifecycle content altered in either file |
| Quick Reference nit (if approved) | `dev/echo-v0.1.2-single-agent.md:375` points to the single-agent file, not `ECHO.md` |

## 5. Governance and release boundary

This build order authorizes no code, commit, push, release, publication, or deployment. The ECHO protocol files are governance documents; changes remain subject to operator approval + (for `ECHO.md`) the normal Savant-Code FID Perfection Loop. Nova's independent audit follows implementation.

## 6. Notes for operator decision

1. **Split vs. merge FIDs** — recommend split (024 autonomy-retrofit, 025 no-speculation) for cleaner audit separation. Operator may merge.
2. **Autonomy Levels definition** — this build order copies the *stub* only. A full definition (Guided = operator-in-loop per step; Supervised = per-FID approval; Autonomous = level-3 grant) is a larger follow-up FID; not included here.
3. **`ECHO.md` no-speculation placement** — propose a new `## No Speculation` section immediately after `## The 15 Laws`, OR fold into Law 1's directive. Operator call.
4. **Quick Reference nit** — include only if operator wants the single-agent file self-consistent.

*Planning source for the ECHO dual-version retrofit. Verified at source 2026-08-13 11:00 PM ET. No changes made; awaiting operator approval.*
