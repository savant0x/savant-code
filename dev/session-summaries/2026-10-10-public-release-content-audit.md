# Public-release content audit — README/docs staleness, bloat, scratchpad (2026-10-10)

## Intent (logged before implementation, Law 8)

Operator request: "review the readme, looking for any stale info or that is no
longer in sync with the code. Also need to clean out all bloat files. Also
clean up the scratchpad. Basically a project wide audit getting ready for
public release after a 2 week sprint."

Registered as SCOPE **T185** (automation level 3 for cataloged repairs).
Interpreted scope presented in full before any change; operator approved
("Approved — proceed") with deletion tiers **A + B**, dev/exports and
resources/ untouched, and the ruling to **keep** the `@savant-code/sdk` npm
links as-is (release-day SDK opt-in publish planned).

## Planned work

1. README.md: drop stale 20-line Perfection-Loop/EHEL-threshold claims (live
   gate is 100), remove deleted `/login` rows, correct Repo Map package name
   (`@savant-code/tmux-scripts`) + add `desktop/` and `packages/connectors/`
   rows, add `/skills` to the slash table, point Validation/CLI tables at
   `bun run typecheck` / `bun run test`.
2. README.zh-CN.md: parallel fixes (20-line ×3, `/login` ×2, tmux name,
   repo-map rows, `/skills`, validation commands).
3. knowledge.md: merge-gate claim (the four-workspace `/verify` set is a
   subset; the merge gate is the 13-workspace `bun run typecheck` chain) and
   workspace list refresh.
4. AGENTS.md Repo Map: add `packages/design-systems/`, `packages/connectors/`,
   `scripts/tmux/`.
5. docs/features.md + cli/release/README.md: remove `/login` rows.
6. cli/src/utils/constants.ts: stale "20-line" comment → 100-line.
7. WINDOWS.md login-URL troubleshooting: verify against code before touching.
8. Deletions (approved Tier A + B, protected paths excluded): debug/ ~5 GB
   (writer-checked), root firebase-debug.log + database.db*, tracked
   website/index-2.html, scratchpad conversation dumps/closed-session
   logs/one-shot scripts/archive junk + uncited scratchpad work dirs.

## Boundaries

- No commit, push, tag, or publish (G1/G2 — operator holds git).
- `.env.local` and `resources/` never touched; `dev/exports/` not in the
  approved deletion sets.
- Protected scratchpad paths (active scope + open-FID citations) excluded
  from every deletion tier: `release-readiness-2026-10-10/**`,
  `pass-through.md`, `probe-logo-geometry.tsx`, `probe-sidebar-phase.tsx`,
  `gateway-catalog-probe.ts`, `t62*.ts`, `provider-catalogs-2026-10-03/**`,
  `provider-integration-*`, `archive/2026-10-07-conversation-issues-found.md`.

## Verification plan

`bun run validate:repository`, `bun run lint:md`, `bun x prettier --check`,
`bun run hygiene:check`, `bun run version:check`, then workspace typecheck
for `cli/src/utils/constants.ts`. Evidence appended below after execution.
