# Session 2026-08-16 — UI Overhaul Planning (single-agent)

## Initial state assessment

- Boot complete: single-agent protocol (`dev/echo-v0.1.2-single-agent.md`) read
  0-EOF; `protocol.config.yaml` loaded (typescript, strict_mode: true); zero
  open FIDs; no `CHANGE_ME`.
- Current UI: OpenTUI 0.2.2 + @opentui/react 0.2.2 + JS `yoga-layout` ^3.2.1;
  ChatLayout (header renders null) + 40-col RightSidebar + savant-ui library;
  theme system (env → IDE → OSC → platform); animations mostly raw
  `setInterval` (spinner, pulse, shimmer, sheen, cursor) with `useTimeline`
  only in ProgressBar + phase-indicator.
- Untracked at session start: `docs/design/OpenTUI Terminal UI Capabilities.md`
  (user-authored capability report; was failing repo-wide `lint:md`).

## Planned work (approved scope, `SCOPE.md` A–E)

1. Review current UI (code-based).
2. Critically review the OpenTUI capability report against primary sources.
3. Produce the phased UI-overhaul plan.
4. Correct the report in place.
5. Route implementation phases to FIDs (follow-up).

## Dependencies identified

- OpenTUI 0.5.3 (core + react) verified current on npm (2026-08-16); native
  yoga since 0.4.1; Zig 0.16 + native images + embedded runtime in 0.5.x.
- Report corrections verified against GitHub releases, opentui.com docs, and
  npm: scope-tree keyboard (issue #638, open proposal — NOT shipped),
  ScrollbackSurface/commitRows (roadmap — NOT shipped), useFocus/useBlur
  (window-focus events), `OPENTUI_FORCE_EXPLICIT_WIDTH` (real env var).
- `dev/idea-shelf/opentui-design-capabilities-reference.md` exists as a
  parallel idea-shelf copy of the report — not touched.

## Completed work

- **UI review delivered** (strengths: controller/presentational split, theme
  chain, savant-ui + design-systems packages; gaps: null header, setInterval
  animations, 40-col sidebar, no native code/diff components).
- **Report verified and corrected:** appendix §14 added to
  `docs/design/OpenTUI Terminal UI Capabilities.md` — 5 INCORRECT claims
  (scope trees, migration gotcha #1, ScrollbackSurface, useFocus/useBlur,
  native-Yoga timing), verified list, unverified list, consequences for the
  overhaul.
- **Plan written:** `docs/design/ui-overhaul-plan.md` — Phase 0 (0.2.2 →
  0.5.3 upgrade, first per operator decision), Phase 1 (tokens/identity),
  Phase 2 (animation engine adoption), Phase 3 (native components), Phase 4
  (layout/responsiveness); cross-cutting requirements, risks, FID routing.
- **Verification:** `lint:md` exit 0 (repo-wide — was previously failing on
  the untracked report file; this closes the gap flagged by the A–Z v0.0.24
  report); prettier check clean on both touched docs.

## Blockers / open questions — RESOLVED (plan §11 updated)

1. **Pin policy:** exact pins @opentui/core + @opentui/react = 0.5.3 (no
   carets), frozen-lockfile invariant, deliberate one-time lockfile regen.
2. **tmux target:** no native tmux on this box (checked — not on PATH); WSL
   Ubuntu present. Automation = tmux in WSL (install bun there); visual
   acceptance = Windows Terminal; ConHost = compatibility floor (OSC 66
   guard).
3. **savant-free seam:** none — `IS_SAVANT_FREE` is a build-time define
   (`SAVANT_FREE_MODE=true` via --define), savant-free reuses 100% of cli/
   source (SPEC.md §1/§9). Operator note: savant-free is private,
   unreleased, on hold until partnerships live — keep its build + e2e green,
   no release sequencing.

## Correction (operator feedback, 2026-08-16)

- **Error:** After the Perfection Loop, the six planning FIDs were marked
  `closed` and moved to `dev/fids/archive/` although none of the phases were
  implemented.
- **Operator correction:** unimplemented FIDs must not be closed/moved —
  closure requires implementation evidence (FID Ground-Truth Verification
  rule; lifecycle `created → analyzed → fixed → verified → closed`).
- **Fix applied:** files moved back to `dev/fids/`; status downgraded to
  `analyzed`; Resolution sections rewritten as "not closed — implementation
  pending"; CHANGELOG entry rewritten to OPEN (no closure claim); archive
  README corrected with a removal note. Lesson recorded in LEARNINGS.md
  (fid-closure-requires-implementation-evidence).

## Next steps

- Implement Phases 0–4 per the open FIDs (FID-2026-0816-002..007, status
  `analyzed`) on operator authorization; close each FID with implementation
  evidence as its phase ships.
- Live visual pass of the current UI in tmux before Phase 1 reskin.
