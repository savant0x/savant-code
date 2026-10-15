# Session Summary — 2026-08-27: tree-drain + git workflow adoption

## Outcome

The v0.0.27 → v0.0.28 backlog (646 changed paths) was drained into 27 atomic
path-scoped commits (G3/G4/G8) via a new manifest-driven committer
(`scripts/tree-drain.ts` + `scripts/tree-drain-manifest.ts`). The working
tree is fully clean. All 8 release gates pass.

## Git workflow adoption (Phase 0 of BO-2026-08-23)

- **ECHO.md**: new "Version-Control Workflow Laws (G1–G9)" section (operator
  commit authority, FID-closure-requires-commit, logical-atomic commits,
  path-scoped staging, OneDrive bundles, granular release history, hygiene,
  G8 messages, worktree escape hatch) + Recovery Playbook.
- **dev/echo-v0.1.2-single-agent.md**: pointer to the G-rules.
- **dev/LEARNINGS.md**: new lesson "local-commits-are-not-publishes".
- **.gitmessage** created; `commit.template` wired + added to root
  `prepare` script; `git maintenance start` run.

## Tree drain (24 commit groups + 3 follow-ups)

Largest groups: desktop (151 paths, FID-2026-0820-007 family), dev/fids
(86, archive moves), cli (55 + 52 + 6), evals (44, -0824-013 master),
agent-runtime (20+8+12+7+19+4), agents (26), scripts (25), skills (25),
common (24), sdk (13).

Follow-up commits after the drain: `style(format)` prettier + markdownlint
cleanup (63 drift files + research-doc MD013/MD001/MD022/MD032 headers),
`chore(protocol)` bundle regeneration + FID-2026-0824-012 receipt re-stamp,
`docs(fids)` README active-table reconciliation.

## Housekeeping (Task 13 Phase A)

- H-A1 gates: typecheck ×12 exit 0 · full test chain exit 0 · eslint
  --max-warnings 0 · lint:md exit 0 · prettier --check clean ·
  protocol-bundle check exit 0 · fid:verify --check PASS · evals:smoke 5/5.
- H-A2: dev/fids/README.md table reconciled to disk (4 archived rows
  removed, 9 missing added).
- H-A3: master manifests -0820-007 / -0823-003 rows refreshed in README
  (sole blocker = -0820-011 packaging checklist).

## Open items (reported to operator)

- Release prep (Task 13 Phase B) NOT started — operator selected
  "housekeeping only first". Next: v0.0.28 bump + release gate battery +
  granular push (G6) via public-release.ts (GITHUB_TOKEN present in env).
- Build programs (Phase C) unstarted: -0824-003..008 roadmap, robot-cast
  pair -028/-030 (`fixed`, closure boundary outstanding), -0824-012 live
  TUI exercise, packaging checklist -0820-011 (desktop release "a while
  out" per operator).
- G1 note: drain commits executed by script at operator direction
  ("everything done automatically"); convention remains operator-executes-git.

## Files touched (beyond the drain itself)

- `ECHO.md`, `dev/echo-v0.1.2-single-agent.md`, `dev/LEARNINGS.md`,
  `.gitmessage`, `package.json` (prepare), `SCOPE.md` (Task 13),
  `scripts/tree-drain.ts`, `scripts/tree-drain-manifest.ts`,
  `dev/fids/README.md`, `dev/session-summaries/2026-08-27-*` (this file).
