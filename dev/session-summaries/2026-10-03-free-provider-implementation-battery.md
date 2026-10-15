# Free-provider routing and notifications — implementation battery

## Intent

Operator instruction 2026-10-03: run the full battery (typecheck, workspace
suites, ESLint, lint:md, prettier, quality) and report the whole-tree state,
then fix the failures the battery found. Continue single-agent ECHO strict
mode, automation level 3, on converged FID-2026-1003-006. Direct edits after
full reads only; no commit or release is authorized (G2 remains operator-owned).

## Progress

All work completed with evidence; every declared gate green and the receipt
stamped. Whole tree: zero failing tests across 13 workspace legs plus the
scripts/providers gates.

### Fixes applied this session

1. **D1 custom-endpoint seam restored** (`common/src/providers/model-route.ts`).
   The legacy bare-slug route synthesis in `resolveModelRoute` promoted a
   bare-slug model preference into the ambient active provider's registry
   endpoint, bypassing `INFERENCE_BASE_URL`. Probe evidence: a handoff-matrix
   child with `INFERENCE_BASE_URL=http://127.0.0.1:<port>/v1` and ambient
   `DIRECT_PROVIDER=openrouter` sent its request to
   `https://openrouter.ai/api/v1/chat/completions` instead of the local
   gateway (handoff matrix 5/6 red). Bare-slug synthesis now yields when
   `INFERENCE_BASE_URL` names a custom endpoint
   (`routeMatchesEnvironmentEndpoint` + `normalizeEndpoint`); explicit
   selections, prefix routes, and local-kind routes are untouched. Verified:
   handoff matrix 6/6 (real CLI children), sdk serving-route 7/7, bare-slug
   seam 4/4, settings-provider 7/7, common 749/0, agent-runtime route
   contracts 8/8.
2. **Static-render mock scoped** (`cli/src/components/tools/__tests__/helpers/
   mock-opentui-react-static.ts`). The four-export `mock.module('@opentui/react')`
   is sticky for the whole bun process: it removed `useKeyboard`/`createRoot`
   for fresh importers (load-time `SyntaxError`) and, in mixed graphs, leaked
   an 80-column `useTerminalDimensions` stub that pushed the model picker's
   vertical scrollbar outside the 60-column test renderer, so the scroll-geometry
   gate failed only in full runs (deterministic, bisected to
   `agent-branch-item.test.tsx` + a mock-only repro). The mock is now
   surface-complete (spread over the real module) and restores the real
   exports in `afterAll`. Verified: components 558/0, full cli 3826/0.
3. **Desktop hello capability pins updated to the implemented D3 shape**
   (`desktop/src/lib/__tests__/gateway-protocol.test.ts`,
   `gateway-client.test.ts`). The implemented `helloRequest` advertises
   `capabilities: ['provider_notices_v1']`; the frozen-v1 pins predated the
   field and the chain had never reached desktop. Protocol version stays
   frozen at 1. Verified: desktop 427/0.
4. **Gate hygiene** — import order in
   `cli/src/utils/__tests__/provider-setup-gateway.test.ts` (hand edit);
   formatting in `cli/src/chat/provider-notification-lifecycle.ts`.

### Battery (whole-tree state, 2026-10-03)

- `bun run typecheck` — 14 legs, exit 0.
- `bun test` from each workspace root (T67): sdk 657 pass/0 fail/1 skip
  (after the auth-seam hardening below added two regression tests);
  cli 3826 pass/18 skip/0 fail (includes the real-child handoff matrix 6/6);
  common 749/0/4 skip; agents 156/0; evals (test:v2) 171/0;
  packages/agent-runtime 1648/0; design-systems 19/0; code-map 51/0;
  database 18/0; knowledge-graph 55/0; llm-providers 89/0; connectors 17/0;
  desktop 427/0; scripts/providers declared gates 46/0.
- `bun x eslint . --max-warnings 0` — zero problems.
- `bun run lint:md` — clean. `bunx prettier --check .` — clean.
- `bun run quality:report` — PASS (1498 baselined files).
- `bun run fid:verify dev/fids/FID-2026-1003-006-... --write` — all 23
  declared gates re-run live, PASS; receipt stamped.

### Environment observations (recorded, not code claims)

- Full `bun run test` chains on this shared dev machine intermittently
  produced rotating timeout failures (release launcher, knowledge-graph,
  gateway server, provenance audits) that all passed standalone minutes
  later on identical code; two consecutive identical cli runs measured 142s
  and 388s. The failures were machine-load artifacts, not regressions. Each
  verification above cites its own run.
- Ambient dev-machine `.env.local` still reaches handoff-matrix children, but
  the custom-endpoint quadrant was made fully deterministic in this session
  (operator-requested hardening): when `INFERENCE_BASE_URL` names an endpoint
  other than the active provider's registry base, the bare-slug request is
  authorized by `INFERENCE_API_KEY` alone — no `OR_MASTER_KEY` exchange, no
  provider-key fallthrough, no fail-closed dependency on an unrelated
  provider; a missing `INFERENCE_API_KEY` fails fast naming the env var.
  Handoff cases now run 4.2-5.7s (previously 10-22s while the exchange was
  in play).
- Native TUI tmux smoke and a live desktop reconnect/read/dismiss smoke were
  not run on this host (tmux unavailable — the tmux suites skip themselves);
  protocol-level coverage is green. No live provider or account call was made.
- The standing operator-owned Savant-Free e2e failures remain T122; no
  full-repository-green claim is made for them.

## Status

FID-2026-1003-006: status `verified`, receipt stamped (23/23 gates),
implementation record and step status written into the FID; SCOPE.md T127
left the register on the standing rule with the completion evidence.
Closure, CHANGELOG entry, and archive were executed later the same session
after the operator granted G2 (ceremony section below).

## Pristine single-run chain record (2026-10-03)

One uninterrupted `bun run test` invocation on a quiet machine, full output
retained at `dev/scratchpad/archive/chain-pristine.log`, chain exit code 0, zero
failures in any leg:

| Leg (`bun run --cwd=<ws> test`) | Pass | Skip | Fail | Files | Duration |
| --- | --- | --- | --- | --- | --- |
| sdk | 655 | 1 | 0 | 110 | 4.70s |
| cli | 3826 | 18 | 0 | 459 | 111.77s |
| common | 749 | 4 | 0 | 95 | 0.94s |
| agents | 153 | 0 | 0 | 20 | 0.32s |
| evals (test:v2) | 171 | 0 | 0 | 24 | 4.76s |
| packages/agent-runtime | 1648 | 0 | 0 | 270 | 18.82s |
| packages/design-systems | 19 | 0 | 0 | 8 | 0.20s |
| packages/code-map | 51 | 0 | 0 | 7 | 0.10s |
| packages/database | 18 | 0 | 0 | 1 | 0.04s |
| packages/knowledge-graph | 55 | 0 | 0 | 7 | 0.55s |
| packages/llm-providers | 89 | 0 | 0 | 17 | 0.13s |
| packages/connectors | 17 | 0 | 0 | 4 | 0.89s |
| desktop | 427 | 0 | 0 | 69 | 7.22s |
| **Total** | **7878** | **23** | **0** | 1091 | ~151s |

The agents leg reports 153 tests here versus 156 in a bare `bun test` of the
same workspace: the workspace's own `test` script scopes the run (20 files
versus 21), so the chain leg is the canonical record.

## Handoff to the next session (2026-10-03, operator directives verbatim)

- "when i say push, i mean locally only - we're not pushing a release yet" —
  commits are local-only; no push, no release.
- "i still have a lot of clean up to do before any of that and im opening
  another session after this one ends" — the operator deferred execution of
  the authorized G2 action until after their own cleanup, in a new session.

Authorized and NOT executed in this session: one batch commit of the whole
verified tree (350 changed files; message headlines FID-2026-1003-006 and
lists the co-committed FIDs), then the closure ceremony (status flip to
closed + archive move + CHANGELOG entry) for all 11 verified active FIDs —
FID-2026-1002-002/-003/-004/-005/-006/-007/-008, FID-2026-1003-002/-003/
-005/-006. Exclusions: `old-chat.txt` (untracked operator debris) stays out;
`dev/scratchpad/**` is gitignored. Nothing was staged or committed; the tree
is exactly the battery-verified state. FID-2026-1003-006 remains `verified`,
receipt stamped 23/23 gates.

## Closure ceremony executed (2026-10-03, later the same session)

The operator granted G2 mid-session ("Batch + close all") and re-confirmed:
"make sure you properly update the changelog and move the completed fids".
Executed, local-only:

- Batch commit `9f1b8068` landed on main (351 files, +22849/−3333): "feat:
  land the verified T111-T127 provider, budget, audit and sidecar work",
  listing all 11 FIDs. The first attempt was rejected by the repo's
  commit-msg hook (agent-attribution watermark); it was re-committed without
  attribution trailers per the no-attribution law. No push, no release.
- All 11 FIDs flipped to `closed (implemented + verified, 2026-10-03, commit
  9f1b8068)`, pending-commit bullets resolved, PENDING lessons filled, and
  `git mv`'d to `dev/fids/archive/`. The active FID queue is empty.
- CHANGELOG `Unreleased — 2026-10-03` now documents the landed work (gateway
  replay, provider notifications, token budgets, changed-only graph refresh,
  audit corrections, sidecar root, baseline advance, approvals/flush timer,
  dispatch containment, project-data isolation, picker row identity) with a
  closure/validation paragraph citing `9f1b8068` and the pristine 7,878/0
  battery.
- SCOPE.md register: T111/T112/T126 left on the standing rule (count 15 →
  12); machine-readable targets retained (T127 precedent).

The two handoff directives above were superseded by the operator's in-session
authorization; the standing rule remains: commits are local-only — no push,
no release.
