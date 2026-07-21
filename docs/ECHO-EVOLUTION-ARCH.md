# ECHO Protocol — Evolution Architecture

> How the ECHO Protocol got from a 3,000-line ritual rulebook to a 447-line constitution, and why there are two live versions.

## The Core Design: One Protocol, Many Bindings

`C:\Users\spenc\dev\savant-protocol\ECHO.md` (**v0.1.2**) is the **canonical ECHO Protocol**. It is maintained in one place. Every downstream project inherits protocol changes automatically:

| Project | ECHO File | Version | Relationship to v0.1.2 |
|---------|-----------|---------|------------------------|
| **savant-protocol** | `ECHO.md` | **v0.1.2** | **CANONICAL** — the protocol itself |
| savant-code (this repo) | `ECHO.md` | v0.2.0 | v0.1.2 + Savant-harness 9-agent roster binding |
| Savant (Rust framework) | `ECHO.md` | v0.1.1 | v0.1.2-equivalent for the Rust harness |

The harness-specific layers (agent roster, FID-Bound Execution, Thinker/Sequential-Thinking) live *only* in the downstream bindings. The protocol itself stays lean and universal — "for any AI agent session."

**Workflow:** Update `savant-protocol/ECHO.md` → all downstream projects get the amendment. Do not maintain protocol logic in multiple places.

## The Graveyard: ~30 Resets, Two Surviving Branches

ECHO was reset to `0.0.1` approximately 30 times across its multi-year development. Each reset burned down a paradigm that didn't hold. Only two branches survived:

### Dead Lineage (fossils, not maintained)

| Version | Source File | Lines | Era | Defining Trait |
|---------|------------|-------|-----|----------------|
| v7.0 | `ECHO_V7.txt` | ~400 | Ritual | Emoji-heavy, 30 Golden Rules, file-header/footer templates, OWASP, "50+ metric compliance score" |
| v1.3.4 | `atlas-diary/ECHO.md` | 3,037 | Ritual (peak) | GUARDIAN Protocol v2.1 (19-point), FLAWLESS IMPLEMENTATION (12-step), mandatory re-read incantations |
| v0.1.0 | `message.txt` | ~400 | Law emerges | 15 Laws + Perfection Loop FSM, clean, emoji dropped |
| v2.1.0 | `Savant-backup/ECHO-UNIFIED.md` | 749 | Consolidation attempt | 15 Laws + Guardian + 7-Phase + Push Gate + Anti-Loop, Rust-specific grep targets |

### Live Lineage (maintained)

| Version | Source File | Lines | Role |
|---------|------------|-------|------|
| **v0.1.2** | `savant-protocol/ECHO.md` | 447 | **CANONICAL** — universal bootstrap, FID-151 grep amendment, Cross-Agent Claim Rule |
| v0.1.1 | `Savant/ECHO.md` | 421 | Rust harness binding ("Universal Agent Bootstrap") |
| v0.2.0 | `codebuff/ECHO.md` | 581 | savant-code binding (9-agent roster + FID-Bound Execution + Thinker Protocol) |

## The Evolution Arc

1. **Ritual era (v7.0 → v1.3.4):** Tried to prevent drift through *volume*. More rules, more emoji, more templates, more incantations. v1.3.4 is the peak — 3,037 lines of "MANDATORY PRE-CODE ECHO RE-READING" ceremony.

2. **Law emerges (v0.1.0):** The pivot. 15 Laws + Perfection Loop FSM. Dropped emoji, templates, compliance scores. Trusted the agent to *apply principles* instead of *memorize checklists*. The version number went *down* (1.3.4 → 0.1.0) as quality went *up* — Savant Versioning in action: low numbers = battle-tested, not early.

3. **Consolidation attempt (v2.1.0):** The temptation to add structure back — Guardian Protocol, 7-Phase Workflow, Push Gate, Anti-Loop. 749 lines. Good ideas, but they bloated the protocol. Superseded by v0.1.1 — reset rather than carry the weight.

4. **Refinement → two branches (v0.1.1 / v0.1.2 / v0.2.0):** The survivors. v0.1.2 is the lean universal protocol. v0.2.0 is the harness-bound operational version. The Push Gate and Anti-Loop from v2.1.0 were *externalized* to `scripts/release-prep.sh` and `protocol.config.yaml` — not kept in the doc.

## Key Insight

ECHO shrank from 3,037 lines (v1.3.4) to 447 (v0.1.2) but got *stronger* — because enforcement moved from *rules in the document* to *structure in the harness*. v0.2.0 doesn't need a 19-point GUARDIAN checklist because the 9-agent roster *physically prevents* the Verifier from writing code. The protocol got lean because the *system* enforces it.

## SAVANT VERSIONING NOTE

ECHO's version numbers are **not semver**. They use Savant Versioning: base-10 tier counting, reset to `0.0.1` on paradigm break. The public `v0.1.2` is the 2nd iteration of the current universal protocol foundation — internally mature from ~30 prior resets. A high version number (v7.0, v1.3.4) in the graveyard does NOT mean "more mature" — it means "more theater." See `SAVANT-VERSIONING.md`.

---

*This doc is a historical map, not a living protocol. The canonical protocol is `savant-protocol/ECHO.md`. Do not edit ECHO logic here — edit it there.*
