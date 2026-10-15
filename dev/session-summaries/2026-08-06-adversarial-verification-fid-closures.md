# Session Summary — 2026-08-06: Adversarial Verification + Design Constitution (FID closures)

## Work performed

Both remaining open FIDs were run through the Perfection Loop and implemented
at autonomy level 3, closed, and archived. `dev/fids/` now holds **zero open
FIDs**.

### FID-2026-0805-004 — Adversarial Verification for ECHO (closed + archived)

Phases 1–3 implemented; Phase 4 dropped per operator scope correction:

- **Phase 1 — Verifier evidence rules** (`agents/verifier/verifier.ts`,
  `ECHO.md` AUDIT row, `templates/FID-TEMPLATE.md`): every PASS/FAIL cites
  `file:line` + quoted code; absence checks paste the exact NO-MATCH search;
  `NEEDS-REVIEW` is a real verdict for out-of-reach evidence; fresh-instance
  rule; no fabricated citations.
- **Phase 2 — Adversary agent + roster reconciliation**: new read-only
  `agents/adversary/adversary.ts` (`read_files`, `code_search`, `glob`,
  `list_directory`, `set_output`; zero write tools; no bash) with the
  CONFIRMED/REFUTED/ADJUSTED refutation procedure, unevidenced-PASS re-audit,
  citation resolution, severity re-rating, half-provable-claim splitting, and
  omission check; verdicts override the Verifier's. Registered in
  `agents/savant/savant.ts` spawnableAgents + `AGENT_PERSONAS` + both
  `AgentTemplateTypeList` copies. Roster reconciled **9 → 10 canonical roles**
  across all four roster texts (`system-prompt.ts`, `ECHO.md`, `AGENTS.md`,
  `ARCHITECTURE.md`) + `cli/README.md`. ECHO.md + ARCHITECTURE.md FSM
  diagrams/tables/flow gained the ADVERSARIAL state.
- **Phase 3 — Runtime FSM**: `FsmPhase` + `transition_phase` schema +
  `agents/types/tools.ts` `TransitionPhaseParams` gained `adversarial`;
  `VALID_TRANSITIONS` allows `audit → adversarial`, `adversarial → complete |
  self_correct` (additive, only reachable from `audit`). New
  `transition-phase.test.ts` — 6 tests, all pass.
- **Phase 4 — DROPPED** (operator correction): Savant is the upstream fork,
  not a final source; `ECHO.md` is the authoritative harness-specific
  protocol. `dev/nova/specs/echo-v0.1.2-single-agent.md` intentionally untouched.

### FID-2026-0806-001 — Savant Agent Design Constitution (closed + archived)

Implemented at the FID's named location `.agents/skills/savant-design/SKILL.md`
per the operator's direct level-3 authorization (supersedes the FID's own
deferred-implementation plan): 9 applicability-aware hard gates, anti-slop
advisories, evidence-based adversarial review protocol, and explicit non-goals.
No UI, export, runtime, or detector changes. Skill is auto-discovered via the
existing `.agents/skills` convention.

## Release prep (v0.0.21)

- `VERSION` + all 12 workspaces unified at **0.0.21** — the next release after
  the 0.0.20 push. The intermediate working-tree bumps (0.0.22–0.0.24) were
  consolidated into a single CHANGELOG v0.0.21 entry and never shipped.
- CHANGELOG v0.0.21 entry (consolidated) with actual gate results; README +
  README.zh-CN updated (release badge + callout, 10-agent roster, FSM chain,
  `cli/README.md` 10 specialized agents); `protocol.config.yaml` aligned to
  0.0.21.
- `cli/src/agents/bundled-agents.generated.ts` regenerated (adversary bundled).

## Validation (all green)

- Typecheck ×12 → 0 errors.
- Root `bun run test` → 10/10 suites pass, **4,793 tests / 0 fail**.
- `bun x eslint . --max-warnings 0` → clean.
- `bunx prettier --check .` → clean.
- `bun run lint:md` → 0 errors.

## Tracking

- FIDs closed + archived: `FID-2026-0805-004`, `FID-2026-0806-001`.
- Active FIDs: none.
