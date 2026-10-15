# FID: Post-Unification Display Gaps — read_files Framing, add_message Registration, Reasoning Chrome

**Filename:** `FID-2026-0822-011-post-unification-display-gaps.md`
**ID:** FID-2026-0822-011
**Severity:** medium
**Status:** closed
**Created:** 2026-08-22
**YAGNI-Compliance:** Satisfied — all three fixes reuse the established
TrafficLightPanel + width-allowance pattern; zero new machinery.

---

## Summary

Round 2 of the chrome unification program (follows FID-2026-0822-006/-009).
Operator reported tmux-cli and reasoning blocks still showing pre-chrome
design. Investigation found three real gaps plus confirmed the operator's
view was running pre-fix code (today's fixes are working-tree-only,
unreleased).

## Gaps Fixed (GREEN)

1. **`read_files` blocks were bare** (`SimpleToolCallItem`, no chrome):
   `cli/src/components/tools/read-files.tsx` reframed — muted Read label +
   FilePathsDescription (blocked/template labels preserved) inside
   `TrafficLightPanel` via new `FramedPaths` inner component.
2. **`add_message` was UNREGISTERED** (tmux-cli narration calls fell to the
   generic header-only fallback): NEW
   `cli/src/components/tools/add-message.tsx` `AddMessageComponent` renders
   role-labeled `input.content` as markdown inside `TrafficLightPanel`
   (handler output is a static ack; input.content is the meaningful payload);
   registered in `registry.ts` (import + map entry).
3. **Reasoning panels lacked chrome** (user-facing half of FID-2026-0822-010):
   `cli/src/components/thinking.tsx` converted from savant-ui
   `Panel border=none` to `TrafficLightPanel`; collapse/streaming UX preserved
   (toggle states •/▾/▸, typewriter, preview/full).

## Verification

- cli typecheck exit 0; eslint --max-warnings 0 exit 0 on all changed files.
- NEW suites: AddMessageComponent 3/3 (chrome ●, role labels, content,
  preview, null-on-empty); ReadFilesComponent 3/3 (chrome ●, Read label,
  paths, blocked label, null-on-empty). Registry-gating ×2 suites green.
- Live TUI (WSL tmux fid011smoke, 90 cols): thinker reasoning panel = rounded
  TrafficLightPanel with ● ● ● title row (PASS); tmux-cli branch header one
  row with lights (PASS). read_files/add_message expanded-state panels never
  rendered on-screen (post-completion subagent tool calls render as collapsed
  summary bullets) → expanded-state rendering is NEEDS-REVIEW for human
  confirmation (expand a tmux-cli branch).

## Open Items Routed

- **FID-2026-0822-010 core defect stays OPEN**: its mid-word clipping
  (`thinker-spawn│` et al.) belongs to an UNIDENTIFIED sibling renderer — this
  round's Thinking conversion does NOT fix it. -010 remains active.
- `╰───reminder.───╯` border row (fid-011-smoke/s3.txt:7, MID-RUN only;
  absent from all post-completion captures s8-final..s16): triaged MID-STREAM
  TRANSIENT (same family as -009 #4/poll4 self-corrected clips). Monitor:
  reproduce at rest → new bleed instance → follow-up FID.
- Sidebar overlap `Context nous/ste77.7k/1048.6k` (Model value collides with
  Context row once Mode=HYBRID renders; s9/s10/s12): distinct sidebar defect,
  routed to a future sidebar FID (Law 10 tracked here).
- Operator view: restart `bun run --cwd=cli dev` to load today's working-tree
  fixes; installed v0.0.27 binaries do NOT contain them.

## Perfection Loop

### Loop 1

- **RED:** COMPLETE — gaps confirmed by registry/constants reads + operator
  live reports.
- **GREEN:** COMPLETE — fixes above; static gates green; live smoke A/B PASS.
- **AUDIT:** Verifier FAIL → three blockers (dead ternary in read-files.tsx;
  missing per-component coverage; untriaged reminder. row) → ALL remediated
  (ternary collapsed; AddMessage 3/3 + ReadFiles 3/3 suites added;
  transient triage recorded here).
- **ADVERSARIAL:** Verdict STANDS conditionally — all remediations CONFIRMED
  first-hand; required materializing THIS FID record (done) and keeping -010
  open (honored).
- **CHANGE DELTA:** ~150 lines across 4 production files + 2 test files.

### Missed Questions

1. Why did add_message/read_files fall to the header-only fallback before
   this FID? Decision: neither tool had a registered renderer; the generic
   collapsed fallback rendered header-only (same class as -006/-007).
2. Why is expanded-state confirmation NEEDS-REVIEW? Decision: post-
   completion subagent tool calls render as collapsed summary bullets in
   the live TUI, so the framed expanded panels never appeared on-screen
   during the smoke — a human expand is required.
3. Sidebar Context/Model overlap — this FID or separate? Decision: routed
   to a future sidebar FID (Law 10 tracked here; distinct renderer surface).

### Code Verification Evidence

- cli typecheck exit 0; eslint --max-warnings 0 on all changed files.
- NEW suites: AddMessageComponent 3/3; ReadFilesComponent 3/3 (chrome ●
  assertions, labels, content, preview, null-on-empty); registry-gating ×2
  suites green.
- Live TUI (WSL tmux fid011smoke, 90 cols): thinker reasoning panel =
  rounded TrafficLightPanel with ● ● ● title row (PASS); tmux-cli branch
  header one row with lights (PASS).

## Step Status

- [x] read_files framed in TrafficLightPanel
- [x] AddMessageComponent created + registered
- [x] Thinking reasoning panels converted to TrafficLightPanel chrome
- [x] Per-component test suites added (6 tests, green)
- [ ] Human: expand a tmux-cli branch in the live TUI to confirm read_files/add_message framed panels render expanded (NEEDS-REVIEW) — deferred::operator-approved 2026-08-22
- [ ] Future FID: sidebar Context/Model overlap defect — deferred::operator-approved 2026-08-22 (routed; carried on ledger)

## Resolution

Closed 2026-08-22 (operator directive: archive the completed FIDs).
read_files framed, add_message registered, Thinking converted to chrome;
per-component suites green (AddMessage 3/3, ReadFiles 3/3, registry ×2).
Expanded-state human confirmation boundary was operator-waived with the
closure directive; the sidebar Context/Model overlap defect stays routed
as a carried observation (future sidebar FID). Archived with a CHANGELOG
entry per the auto-archive contract.
