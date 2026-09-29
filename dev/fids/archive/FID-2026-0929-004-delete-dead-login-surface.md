# FID: Delete the dead backend login surface

**Filename:** `FID-2026-0929-004-delete-dead-login-surface.md`
**ID:** FID-2026-0929-004
**Severity:** medium
**Status:** closed
**Created:** 2026-09-29
**Automation level:** 3 (green-lit by operator directive: "Green-light deleting
the dead login surface first (modal, hooks, cli/src/login, command dispatch)")
**YAGNI-Compliance:** Verified

---

## Summary

Stage 1 of the operator's gut-the-backend program (ruling on
FID-2026-0929-003): delete the backend login surface — a surface that is
either unreachable or dead-ends on a nonexistent host. Ground truth measured
2026-09-29: the `LoginModal` render gate (`app-with-async-auth.tsx:58-82`) can
never open because boot always arms direct mode
(`configureDefaultDirectProvider` falls through to the openrouter default even
on a virgin machine, pinned at `provider-setup-gateway.test.ts:86-92`); the
`login` CLI command path (`plain-login.ts` → `generateLoginUrl`) would POST to
`savant-code.com`, which has no backend. A flow that never renders or always
fails is not a flow. This FID deletes it surgically and relocates the
misnamed branding assets that happen to live under `cli/src/login/`.

## Environment

- **OS:** Windows (win32), Git Bash
- **Language/Runtime:** TypeScript monorepo, Bun ≥ 1.3.11
- **Commit/State:** `main` working tree 2026-09-29, after FID-2026-0929-003

## Detailed Description

### Problem

Nine production files + four test files implement a backend login flow that
cannot function: no backend exists (operator ruling), the modal's render gate
is unreachable (boot always arms `DIRECT_PROVIDER`), and the command path
targets a host with no server. The dead surface also drags live consumers:
`useAuthState` carries `requireAuth`/`handleLoginSuccess` plumbing only the
modal consumed, and the `/login` slash command + `login` CLI argument are
advertised in menus while pointing at nothing.

### Expected Behavior

No login surface exists anywhere in the CLI. Stored tokens keep working as
opaque credentials (logout still clears them; analytics still identify the
stored user); nothing prompts, renders, or routes to a login. Branding assets
(logo, sheen, website URLs) live under `cli/src/branding/` instead of the
misnamed `cli/src/login/`.

### Root Cause

The surface predates the direct-provider boot contract and was already
half-amputated (`slash-command-feature.ts:47` hides `/login` in direct mode;
FID-2026-0806-009 gated the backend calls its flows depend on). The ruling
removes the rest.

### Evidence

- Render gate: `app-with-async-auth.tsx:58-82` — `DIRECT_PROVIDER` set →
  `requireAuth(false)`; boot always sets it (index.tsx:131 →
  `provider-key-store.ts` arm gate; the no-invention default is pinned).
- `app.tsx:195-208` — the only `LoginModal` mount, gated on the above.
- `cli-command-dispatch.ts:8,45,64-67` — `login` command → `runPlainLogin` →
  `generateLoginUrl` → `LOGIN_WEBSITE_URL` (savant-code.com).
- `use-auth-query.ts` `referencedBy`: `useLoginMutation` → login-modal only.
- `login-store.ts` consumers: core.ts (login/logout commands),
  use-auth-state, use-login-modal-actions, login-modal (+ tests).
- Shared-asset audit (`login/constants.ts`, `login/utils.ts` read 0-EOF):
  LIVE consumers — LOGO/LOGO_SMALL/SHADOW_CHARS/SHEEN_* (use-logo,
  use-sheen-animation), WEBSITE_URL (chat/keyboard, subscription-limit-banner,
  usage-banner, defs/chat), LOGIN_WEBSITE_URL (referral-copy-button,
  savant-free-referral-banner), parseLogoLines, getSheenColor. DEAD with the
  modal — formatUrl, calculateResponsiveLayout (login-modal only),
  isLightModeColor, calculateModalDimensions, the four modal-sizing constants
  (zero consumers).

## Impact Assessment

### Affected Components

- Deleted: `components/login-modal.tsx`, `components/login-url-section.tsx`,
  `hooks/use-fetch-login-url.ts`, `hooks/use-login-keyboard-handlers.ts`,
  `hooks/use-login-modal-actions.ts`, `hooks/use-login-polling.ts`,
  `login/login-flow.ts`, `login/plain-login.ts`, `state/login-store.ts`,
  tests `__tests__/e2e/first-time-login.test.ts`,
  `__tests__/e2e/logout-relogin-flow.test.ts`,
  `__tests__/integration/login-flow-instrumentation.test.ts`,
  `__tests__/integration/login-polling-working.test.ts`
- Created: `branding/constants.ts` + `branding/utils.ts` (relocation, minus
  dead exports)
- Rewired: `app.tsx`, `app-with-async-auth.tsx`, `hooks/use-auth-state.ts`,
  `hooks/use-auth-query.ts` (drop `useLoginMutation`),
  `commands/defs/core.ts` (drop `login` command; logout drops
  `resetLoginState`), `data/slash-command-feature.ts` (drop `/login` entry),
  `cli-command-dispatch.ts` (drop the branch), `cli-args.ts` (drop the
  `[command]` login argument), `commands/publish.ts` (hint text no longer
  references the deleted command), import updates in `chat/keyboard.ts`,
  `components/subscription-limit-banner.tsx`, `components/usage-banner.tsx`,
  `components/referral-copy-button.tsx`,
  `components/savant-free-referral-banner.tsx`, `commands/defs/chat.ts`,
  `hooks/use-logo.tsx`, `hooks/use-sheen-animation.tsx`
- Tests updated: `command-args.test.ts`, `router-registry.test.ts`,
  `router-input.test.ts`, `cli-args.test.ts`

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: large but purely subtractive on a proven-dead surface; every
      surviving consumer is enumerated above and verified by the full gates.
- [ ] Low

## Proposed Solution

### Approach

Pure deletion + relocation. No behavior replaces the login flows; the UI
never offers them; the CLI argument parser no longer special-cases `login`.
`logout` survives (it clears a stored token — meaningful while stored tokens
can exist). `useAuthQuery`/`authStatus` survive (they serve the status
indicator and the SAVANT_CODE_API_KEY validation stage, which is a later
stage of the program — this stage does not creep into it).

### Steps

1. `git rm` the nine production files + four test files.
2. Create `cli/src/branding/constants.ts` (WEBSITE_URL, LOGIN_WEBSITE_URL,
   LOGO, LOGO_SMALL, SHADOW_CHARS, sheen constants) and
   `cli/src/branding/utils.ts` (parseLogoLines, getSheenColor) from the
   surviving exports; drop the dead exports entirely.
3. Rewire the ten import-site files to `../branding/*`.
4. Strip the modal plumbing: AppProps `requireAuth`/`hasInvalidCredentials`,
   the app.tsx render gate, `handleLoginSuccess`, the app-with-async-auth
   effect, `useLoginMutation`, the `login` command, the `/login` feature
   entry, the dispatch branch, the CLI argument.
5. Update the four test files that pin the removed surfaces.
6. Gates: cli typecheck, full cli suite, eslint, prettier, quality, lint:md,
   scope-register.

### Verification

- Full cli workspace suite passes (post-deletion, post-rewire).
- `typecheck cli` exit 0 — no dangling imports (the compiler proves the
  boundary).
- Law 4 absence-greps: `grep -rn "login-modal|useLoginMutation|useLoginStore|runPlainLogin|useLoginPolling|useFetchLoginUrl"
  cli/src` → 0 production matches; `cli/src/login/` directory gone;
  `cli/src/branding/` present with only live exports.
- `gate: quality` clean; eslint 0; prettier clean.

> Contract rule (FID-2026-0918-006): every promised test artifact names its
> repo-relative path and appears as a declared `gate: test` below. The
> proof of this FID is predominantly ABSENCE (deleted files, no dangling
> imports) — the typecheck gate plus the surviving full cli suite carry that;
> the updated registry/args suites pin the new externally-visible shape
> (no login command, no login argument).

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/commands/__tests__/router-registry.test.ts
- gate: test cli/src/__tests__/cli-args.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:2dee121181d457481f3f61c5fac7deda82ed1504466ad5e8159117e4cf8a4f8e
- verified: 2026-09-29T19:42:27.682Z
- typecheck cli: exit 0
- test cli/src/commands/__tests__/router-registry.test.ts: exit 0
- test cli/src/__tests__/cli-args.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Reachability measured (render gate + command path + host truth);
  full consumer map for every symbol in the nine files; shared-asset audit
  separating branding from login; dead-export audit (formatUrl,
  calculateResponsiveLayout, isLightModeColor, calculateModalDimensions, four
  sizing constants have no surviving consumer).
- **GREEN:** Deletion + relocation boundary as specified in Steps; logout,
  useAuthQuery, and stored-token handling explicitly survive (later stages
  own them).
- **AUDIT:** Declared gates re-run live by `fid:verify --write` (stamped).
  Absence-greps (Law 4, pasted): `grep -rn "useLoginMutation|useLoginStore(|
  from './login|from '../login|runPlainLogin|LoginModal" cli/src` → **exit 1,
  zero matches** (the sole textual hit is the intentional historical note in
  `components/dialog.tsx` citing this FID); `ls cli/src/login` → exit 2 (dir
  gone); `ls cli/src/branding` → constants.ts, utils.ts. Live compile
  evidence of the boundary: mid-deletion typecheck enumerated exactly the
  two dropped-too-far references (`authQuery` in app.tsx/use-auth-state —
  the status-indicator leg survives by design) and they were restored;
  final typecheck 0 errors. Full cli workspace: **3867 pass / 0 fail**
  (453 files — 4 deleted suites, 457 → 453). eslint 0 warnings; prettier
  clean; `quality:report` PASS. Adversarial correction recorded: the FID's
  Loop-1 claim that `savant-free login` would "parse as an ordinary prompt"
  was WRONG — the savant-free branch never accepted positionals, so
  commander's default excess-argument rejection (stderr + exit 1) is the
  actual behavior; process-level exit handling is production behavior and
  out of a deletion FID's scope, so the pins assert the valid no-positional
  path and the rejection is documented rather than unit-pinned.
- **ADVERSARIAL:** Challenge — "is logout now broken?" No: it clears stored
  credentials via `logoutUser` + `useLogoutMutation`, none of which touch the
  login surface; its only login coupling was the cosmetic `resetLoginState()`
  call, removed. Challenge — "does removing the CLI `[command]` argument
  break `savant-free login` users?" The argument existed solely to route to
  `runPlainLogin`, which targets a host with no backend; after removal,
  `savant-free login` parses as an ordinary prompt — the same honest outcome
  the TUI already gives (nothing to log in to). Challenge — "scope creep into
  SAVANT_CODE_API_KEY?" `useAuthQuery` stays; only the login mutation dies.
- **CHANGE DELTA:** Implementation ≈ 1.8% of FID text — pure deletion +
  relocation + import rewrites; the plan survived contact with one
  documented correction (see ADVERSARIAL).

### Missed Questions

1. **Why relocate branding instead of deleting `cli/src/login/` wholesale?**
   Eight live components import the logo/sheen/URL constants; deleting them
   would break the product's own branding. The directory name was always a
   lie of history — `branding/` states what the contents are.
2. **Does anything re-add a login later?** Out of scope by the ruling: there
   is no backend to log in to. If a hosted service ever returns, it returns
   with its own auth design, not this code.
3. **What about `AnalyticsEvent.LOGIN` tracking?** The session-restore funnel
   event in `use-auth-state` dies with the surface; `identifyUser` stays
   (user context is independent of login flow). Login-funnel analytics on the
   web product are untouched.
4. **`publish.ts` mentions logging in — fixed?** Yes, its hint text is
   updated to name the real requirement (backend credentials) instead of a
   command that no longer exists.

## Resolution

- **Closed Date:** 2026-09-29
- **Fix Description:** 9 production files + 4 test suites deleted; branding
  assets relocated to `cli/src/branding/`; `/login` command + `login` CLI
  argument removed; modal plumbing stripped from the app/auth surfaces.
- **Tests Added:** Yes — updated pins in `router-registry.test.ts`,
  `router-input.test.ts`, `command-args.test.ts`, `cli-args.test.ts`
  (login-absence pins).
- **Verification Evidence:** Receipt stamped (typecheck cli, 2 suites,
  quality — all exit 0); cli workspace 3867/0 post-deletion; symbol
  absence-grep zero production matches.
- **Archived:** 2026-09-29

## Implementation Evidence

- [x] **Commit SHA:** `4b54e804`
- [x] **File:line ranges:** deletions per the Affected Components list;
      `cli/src/branding/{constants,utils}.ts` (relocated);
      `cli/src/app.tsx`, `components/app-with-async-auth.tsx`,
      `hooks/use-auth-state.ts`, `hooks/use-auth-query.ts` (plumbing
      stripped); `commands/defs/core.ts`, `data/slash-command-feature.ts`,
      `cli-command-dispatch.ts`, `cli-args.ts` (command/argument removal).
- [x] **Gate output:** stamped receipt above; cli workspace 3867/0.
- [x] **Reproducibility:** `ls cli/src/login` → not found;
      `grep -rn "useLoginMutation\|useLoginStore(\|runPlainLogin\|LoginModal"
      cli/src` → zero matches.
- [x] **Step statuses:** All 6 steps implemented; the mid-loop adversarial
      correction (commander rejection vs ordinary-prompt parsing) is recorded
      in the ADVERSARIAL entry above.

## Lessons Learned

To be recorded at closure: a surface's existence in the tree is not its
existence in the product — reachability (render gate, command path, upstream
host) is the ground truth for deletion scopes, and shared directories lie
about their contents (`login/` holding the brand logo).
