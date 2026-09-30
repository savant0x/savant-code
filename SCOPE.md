# SCOPE — Active Task Register

> Single-agent ECHO protocol scope artifact. Items below are the interpreted
> scope for the current task. Operator confirmation converts interpreted scope
> into approved scope. Any drop/deferral requires a blocking presentation.
>
> **Automation levels** (protocol: `dev/echo-v0.1.2-single-agent.md` →
> "Automation Levels") are recorded per task/item as `**Automation level: N**`,
> meaning the authority that item needs to be actioned *without asking*: `1` =
> approval-gated, `2` = within approved scope, `3` = fully automatable. The
> session ceiling is `protocol.config.yaml` → `session.autonomy_level`. An item
> is actioned without approval only when its level is ≤ the session level. No
> level lifts the G-laws, credential handling, Law 3, or the project-directory
> boundary.
>
> **Operator directive 2026-09-19:** "this is a project wide quality pass,
> update every issue you find w/ automation level 3" — findings from this pass
> are tagged `3` where the fix is mechanically automatable, and `1` where the
> only remaining action needs operator input (nothing to automate).
>
> **NOTHING IS EVER OUT OF SCOPE** (protocol: Scope Boundary). Operator ruling
> 2026-09-19: "NOTHING is ever permitted to be placed 'out of scope'... We
> complete the work, we never defer, and nothing is ever out of scope."
> Approved work is completed, never trimmed. `[OUT-OF-SCOPE]`,
> `[OPEN-OUT-OF-SCOPE]` and `[DEFERRED]` are **not statuses**; every item here is
> either **completed** (with its evidence) or **blocked pending an operator
> ruling** whose specific blocker is named. The sole marker that legalizes a drop
> is `dropped::operator-approved <YYYY-MM-DD> — "<the operator's words>"`, and
> only the operator can set it. These tokens now fail `validate:repository`
> (`scope.prohibited-disposition`) and are blocked at write time
> (FID-2026-0919-024).
>
> **Coverage is enforced too** (FID-2026-0919-025). The prohibition above
> removes the label, not the quiet path: an item with no line here is invisible
> in the register and can be dropped without writing any forbidden token. So
> every record in the active queue must be named in this register, and every
> task cited by an active FID or by `dev/agenda.md` (`Task NN`, `TNN-X`) must
> exist here as a `## Task NN` section or a `TNN-X` item. Both fail
> `validate:repository` (`scope.unregistered-item`) and
> `bun run scripts/scope-register-check.ts`.
>
> **This file holds open items only** (operator ruling 2026-09-28: *"if the item
> is completed, it should not even be in scope, only active/pending items should
> be in scope"*). A finished task is not in scope and does not appear here. Its
> record is `CHANGELOG.md`, the archived FID under `dev/fids/archive/`, its
> summary under `dev/session-summaries/`, and `dev/LEARNINGS.md` — the CHANGELOG
> is itself gate-covered by the ratcheted `changelog-coverage` check.
>
> **The gate was changed to permit this** (FID-2026-0928-005), and the change is
> a real narrowing that is recorded rather than absorbed. Measured first: with
> the completed index removed, the old check produced **111 issues — every one
> from a historical session summary, and none from either active FID.** Leg 2
> had been reading *"a current session summary"* as *every summary written since
> 2026-09-19*, so each finished session permanently added its task references to
> the set the register had to carry. A summary is written when a session *ends*,
> so what it cites is finished by construction. Live work is still covered: every
> active FID's id (leg 1), every task an active FID or `dev/agenda.md` cites
> (leg 2). Session summaries are no longer scanned. **Stated limit:** this cannot
> tell a *finished* task from an *abandoned* one — both look the same, and both
> are now accepted. An abandoned item is caught only if a live surface still
> names it.

## Open items

**Nine** items are open. Each names its own specific blocker. Nothing here
may be dropped, trimmed, or reclassified without an operator ruling; a working
tree state is not a disposition. When an item closes it leaves this file
entirely — its evidence goes to `CHANGELOG.md`, not to a section here.
(2026-09-29: T98–T101 completed and left the register on this rule; evidence
in archived `FID-2026-0929-001`/-002/-003/-004, CHANGELOG
`Unreleased — 2026-09-29`, and the 2026-09-29 session summary. 2026-09-30:
T102 implemented + verified. 2026-09-30: T102 closed, archived, and entered
in the CHANGELOG (commit `06220bc6`; archived `FID-2026-0929-005`, receipt
stamped, all 6 declared gates exit 0) and left the register on this rule.
Same day: T103 (the no-scripted-edits ECHO standard) completed and left the
register — the operator named the surface (`dev/echo-v0.1.2-single-agent.md`),
ordered the edit verbatim ("now we need to update SINGLE AGENT ECHO,
completely forbid editing files via python scripts. It needs to be added to
this file"), and its evidence lives in that file (Law 1 row + Additional
Rule + invariant + anti-pattern), the 2026-09-30 session summary, and the
diagnosis behind it: a scripted edit is Law 1 bypassed at scale — one blind
transform rewrites N unread files.)
(2026-09-28: T96-followup, FID-2026-0927-006, T63, T67, T84-C, T61,
FID-2026-0928-009, T90-F3 and T62-followup(1) all completed and left the
register on this rule; evidence in archived `FID-2026-0928-006`/-007/-008/
-009/-010 and `FID-2026-0927-003`, the AGENTS.md T67 guard, and the
2026-09-28 session summaries.)

**Ground-truthed against the live tree 2026-09-28.** Eleven items were re-checked
against source read 0-EOF, not by re-implementing repo logic. **Three were wrong
or incomplete and are corrected above** (T97, T95-C, T96-followup) and one gained
a materially better mechanism (R2). **The pass also caught a defect I introduced
hours earlier:** deleting the completed index unregistered the still-active
`FID-2026-0927-006`, and `scope.unregistered-item` refused the result — correct,
because that record declares itself unclosed pending T96-followup. It is now an
item in its own right. **Provenance update, later the same day:** T84-C was
reproduced exactly and filed as `FID-2026-0928-007` (the TS5102 was a
cwd/config-resolution artifact, not a repo defect); T61 and T63 were grounded
and completed (`FID-2026-0928-008` and the session summary respectively); T67
was reproduced live and its durable guard shipped in `AGENTS.md`;
T62-followup(1) was re-grounded LIVE and completed as `FID-2026-0928-010`.
T90-F3 was resolved by the operator ruling "T90-F3 residual needs no code"
(closed as `FID-2026-0927-003`).

### Release and tooling

- [ ] **T94. The release headline prose has no owner, so `version:bump` relabels
      the previous release's claims on every bump.** `updateDocSurfaces` replaces
      only the version *token*; the `> **vX.Y.Z** — …` callout body in
      `README.md:17` and `README.zh-CN.md:15` is hand-written and is never derived
      from the CHANGELOG section. The v0.0.34 cut inherited three consecutive
      releases' content under one label because of it (the `v0.0.33` bump
      relabelled the `v0.0.32` prose, which had itself been relabelled — the
      drift FID-2026-0919-023 recorded and the drift checker only *reports*).
      Fixed by hand for 0.0.34: each README now describes its own release and
      chains the previous one beneath it honestly. **Blocker:** the fix shape —
      derive the callout from the current CHANGELOG section, or have
      `version:check` assert the callout matches the section it labels and fail
      closed on drift. Either is a change to the documented-version-surface
      contract, so it is an operator call, not a patch. **Automation level: 3**
      (mechanical once the shape is chosen).

- [ ] **T83-E. Release cleanup — two retained branches should not exist.**
      Operator ruling 2026-09-28: *"we should not be using different branches to
      begin with, i only permitted main for usage."* **Confirmed still present
      2026-09-28** — `git branch --list` returns exactly `backup-pre-rewrite-
      20260913`, `backup-pre-rewrite-20260922` and `main`. The second branch
      was never named in this register: it tracks git state, and
      `scope.unregistered-item` only walks `dev/fids/`, so a branch cannot red
      the coverage gate. Both are local to this machine and their retention
      condition is met (the v0.0.33 tag is pushed and the release verified
      complete). **Blocker:** git execution is the operator's. Delete both, then
      optionally `git reflog expire --expire=now --all && git gc --prune=now`.      **Automation level: 1.**

### Skills governance

- [ ] **T95-B. `tauri signer generate` is not on `COMMAND_ALLOWLIST`**
      (`scripts/skills-check-policy.ts:24-90`) — **confirmed still open
      2026-09-28**: `tauri` does not appear in that policy file at all, and it is
      a genuine first-class dependency of this repo's own desktop workspace
      (`desktop/package.json:12`, `"tauri": "tauri"`). It is a real CLI, so the
      RC2 label/prose rules correctly do not suppress it; the only ways to clear
      it are to widen the allowlist or to stop writing the command as an inline
      span, which would degrade the skill. Blast radius is one consumer —
      `scripts/skills-check-content.ts:215` gates whether a skill may *mention* a
      command, not whether anything executes; `BLOCKLIST_PATTERNS` runs on the
      raw body and is untouched, and `skills:check` is in neither the pre-push
      hook, the release preaudit, nor `.github/`. **Blocker:** widening a security
      control is an operator ruling. **Automation level: 1.**

- [ ] **T95-C. `skills:check` cannot ever exit 0 in this environment.** Re-measured
      2026-09-28: **17** finding lines sit outside the project directory — 10
      under `C:\Users\spenc\.agents\` and 7 under `C:\Users\spenc\.claude\`. The
      line previously said 14, which was stale. The error *counter* is
      unaffected — `skills-check.ts:167` demotes home-dir findings to warnings by
      design — and the run reports `26 skill(s) scanned · 1 error · 33
      warning(s)`; the 1 error is T95-B. A CI or fresh-clone run inherits the
      home-dir findings. **Blocker:** they live outside the project directory,
      which is read-only to this session; fixing them means editing operator
      home-dir skills. **Automation level: 1.**

### Archived-FID disposition

- [ ] **T97. 39 archived FIDs carry a non-`closed` status** — re-measured
      2026-09-29 with the repo's own `parseFidStatus`, not a re-implemented
      regex: the archive holds **436** records, of which **395** are `closed`
      (including decorated forms like `closed (2026-08-09 — …)`) and **41**
      are problem records (39 non-`closed` + 2 with no `**Status:**` line —
      `FID-2026-0807-010` / `-011`, genuinely malformed). **The 2026-09-28
      figures (428/386/39) were stale.** The 9 records created on/after the
      2026-09-15 closure-vocabulary cutoff were repaired and are now
      mechanically guarded (`FID-2026-0928-013`: eight status flips to
      `closed` aligned to their own ledger/Resolution evidence, one dated
      operator-decline marker on `FID-2026-0919-009`); the guard fails
      `validate:repository` on any future post-cutoff non-`closed` archived
      record. **Remaining disposition surface for this item: the pre-cutoff
      August batch (~30 records: 2026-08 code-universe/deck/desktop-era
      `fixed`/`verified`/`implemented`) + the 2 malformed records.**
      **Risk:** the archive is outside the active queue, so
      `scope.unregistered-item` — which walks only `dev/fids/FID-*.md` —
      cannot see any of them. **Blocker:** closing them requires per-record
      implementation evidence (commit SHA or file:line + grep); bulk-setting
      them to `closed` would be exactly the Ground-Truth violation this
      protocol exists to prevent, and the alternative — moving them back to
      the active queue — would put ~30 unverifiable items in front of the
      operator at once. This needs an operator ruling on the disposition.      **Automation level: 1.**

### Code Universe rulings (FID-2026-0928-003 / -004)

- [ ] **R1. Draggable OS-window metaphor plus comet/starfield/watermark/SFX** —
      Gate 7 product-identity call, confirmed present in the stylesheet read
      2026-09-28: `.window-title-bar` with `cursor:grab` and `user-select:none`
      (the drag affordance), `.window-btn` with `.window-minimized` /
      `.window-maximized` variants, the `.docked-sibling` stacked-taskbar
      arithmetic whose comment spells out the load-bearing sum
      (`8px + 38px + 34px + 6px`), `.space-stars` / `.space-star` /
      `.shooting-star` with a `9s linear` travel animation, and the
      `CHARACTER_WATERMARK_DATA_URI` `::after` layer. Genuinely dual: the
      windows carry real panel state (that arithmetic is not decorative) while
      the atmosphere is. **Blocker:** product identity is the operator's.      **Automation level: 1.**

- [ ] **R2. `body{overflow:hidden}` + `height:100vh` may clip short viewports**,
      and the D3 type lift makes tight one-line headers more likely to wrap.
      Re-grounded against the stylesheet 2026-09-28, which gives a real mechanism
      rather than the earlier hand-wave. The load-bearing property is
      **`min-height:0` on `.universe-main`** (`universe-css.ts:10`) — that is
      what lets a flex child shrink below its content size, so a taller header
      shrinks the main region instead of pushing it out of the shell. Every
      overlay is `position:absolute` with its space reserved rather than
      overlapped: `.universe-footer` is `bottom:0;height:34px` and
      `.viewport-wrap` is `inset:0 0 34px`, so the footer never covers content;
      the header is a normal in-flow flex row that wraps at the 1100px
      breakpoint. Scrollable regions (`.region-nav`, `.graph-sidebar`,
      `.browser-grid`, `.document-surface`) each carry an explicit
      `overflow-*:auto` plus `max-height`/`min-height` bounds. **The CSS
      structure therefore argues against clipping, and the D3 lift is absorbed
      by `min-height:0`.** That is still a *reasoning from source*, not a
      render, and the D3 lift made it likelier to matter. **Blocker:** only a
      real render at a short viewport settles it. **Automation level: 1.**

- [ ] **R3. Distinct literals remain, and the D1 fix added more.** Confirmed by
      reading the stylesheet 2026-09-28: the six colours lifted for WCAG AA are
      now literals rather than tokens — `#4f80a1` (`.document-line-number`,
      `.document-breadcrumb-sep`), `#5e81a3` (`.region-file small`), `#667fa2`
      (`.universe-footer`), `#6780a4` (`.center-focus-hint`, `.region-more`) —
      so routing *those four* through `:root` is the obvious next step and needs
      no `color-mix()` or browser-support decision. Beyond them, a longer tail
      of one-off values remains (`#17304c`, `#173b55`, `#99b4d5`, `#06152b`,
      `#dbeafe`, `#c4e8ff`, `#8fd9d8`, …), many alpha variants, which would need
      `color-mix()`. **Blocker:** the browser-support call applies to the tail
      only, not to the four D1 colours. **Automation level: 3** for the four
      tokens, 1 for the tail.

### Providers and routing

- [ ] **T98. Provider identity leak — the free lane's supplier persona wins
      the agent's self-description.** IMPLEMENTED + VERIFIED 2026-09-29
      (`dev/fids/FID-2026-0929-001-provider-identity-leak-brand-guard.md`,
      status `verified`, receipt stamped): harness identity counter-clause in
      `agents/savant/system-prompt.ts` (shared base → all 6 modes), 9-test pin
      at `agents/savant/__tests__/system-prompt-identity.test.ts`, bundle
      regenerated (13/13 savant chunks carry the clause). Remaining:
      closure ceremony (commit + archive + CHANGELOG) awaits operator git
      authorization, and the live APInex identity probe is operator-run
      (NEEDS-REVIEW in the FID). **Automation level: 3.**

- [ ] **T99. In direct-provider mode, a provider 402 is misreported as a
      SavantCode-backend out-of-credits error.** IMPLEMENTED + VERIFIED
      2026-09-29
      (`dev/fids/FID-2026-0929-002-direct-provider-402-out-of-credits-misfire.md`,
      status `verified`, receipt stamped): both 402 branches in
      `run-results.ts` gated on `isDirectProviderMode()` — direct mode now
      renders the provider's own message + `/health` pointer via
      `providerOutOfCreditsError` (new selector) and the widened `quotaHint`
      (bare 402s now match); no input-mode flip, no backend usage poll in
      direct mode; backend mode byte-identical (regression pin green). Full
      cli suite 3881/0. Remaining: closure ceremony (commit + archive +
      CHANGELOG) awaits operator git authorization, and the live direct-lane
      402 reproduction is operator-run (NEEDS-REVIEW in the FID).
      **Automation level: 3.**

- [ ] **T100. Boot-mode precedence was unruled; ruling received and the
      routing slice implemented.** Third-party diagnosis (Nova, Discord
      2026-09-29) claimed the CLI booted in backend mode because `.env.local`
      lacked `DIRECT_PROVIDER`/`INFERENCE_BASE_URL` — adjudicated
      claim-by-claim in
      `dev/fids/FID-2026-0929-003-boot-mode-precedence-token-vs-selection.md`
      (backend-mode claim REFUTED by live probe, names only; `.env.local`
      append claim REFUTED, 0 matches). Operator ruling 2026-09-29, verbatim:
      *"we need to gut this whole 'backend' idea, we don't have a backend to
      fall back to."* **Implemented + verified** (receipt stamped): one
      predicate `hasEnvBackendCredentials()` (`auth.ts`) — only the explicit
      `SAVANT_CODE_API_KEY` defers boot routing; a stored login token defers
      to nothing (residue, not a routing command); the stub bypass token
      never counts. All three boot gates re-keyed (`provider-key-store.ts`
      ×2, `ollama-onboarding.ts` ×2 → 3 sites); 8 new pins across 3 suites;
      cli workspace 3889/0; `quality` PASS. **Remaining, blocked on operator
      direction:** (a) closure ceremony for all three 0929 FIDs — commit +
      archive + CHANGELOG needs git authorization; (b) the remaining
      gut-the-backend stages named in the ruling (login flow,
      `SAVANT_CODE_API_KEY` retirement, SDK backend-call surface,
      backend-mode `OUT_OF_CREDITS` branch) — each is a destructive-facing
      change needing its own presented plan; **blocker:** the operator names
      the next stage. **Automation level: 1** for both remainders.

- [ ] **T101. Gut-the-backend stage 1 — delete the dead login surface.**
      IMPLEMENTED + VERIFIED 2026-09-29
      (`dev/fids/FID-2026-0929-004-delete-dead-login-surface.md`, receipt
      stamped; green-lit by operator directive "Green-light deleting the dead
      login surface first"): 9 production files + 4 test suites deleted;
      `cli/src/login/{constants,utils}.ts` RELOCATED to `cli/src/branding/`
      (logo/sheen/URL assets consumed by 8 live components); modal plumbing
      stripped; `/login` slash command + `login` CLI argument removed.
      Evidence: cli workspace 3867/0 (453 files), absence-greps zero
      production matches, `cli/src/login/` gone. Honest correction recorded:
      `savant-free login` now hits commander's default excess-argument
      rejection (the branch never accepted prompts) — documented, not
      unit-pinnable. **Remaining: closure ceremony awaits operator git
      authorization. Next stage (operator's pick): `SAVANT_CODE_API_KEY`
      retirement, SDK backend-call surface, or the backend-mode
      `OUT_OF_CREDITS` branch. Automation level: 3.**

- [ ] **T62-followups (remaining items routed, not blocking Task 62
      closure):** (1) is **completed 2026-09-28** — commandcode catalog
      case-drift re-keyed to the live roster casing (`zai-org/GLM-5.2/5.3`),
      the two rows' windows re-sourced to the gateway's own publication, the
      keyless fail-open boundary documented on the registry entry, and the
      window-truth probe's four structurally-dead samples repaired (archived
      `FID-2026-0928-010`; the probe had been red since the realign and also
      caught a genuine bazaarlink drift, settled 2-of-3 to orcarouter).
      Remaining items are **level 1**, both blocked on operator
      credits/keys, so there is nothing to automate: (2) tokenharbor
      `deepseek-v4.1-flash:free` catalog add + free-cell identity re-run
      after 2026-09-19T04:32 allowance reset; (3) tokenrouter self-ID
      completion on operator top-up (`bun dev/scratchpad/active/t62-round3.ts`).

### Harness and process

- [ ] **T87-B. A scaffold that predates a decomposition can never refresh, and
      nothing detects it.** Re-grounded 2026-09-28 by reading
      `cli/src/commands/init.ts` 0-EOF. The claim holds exactly: at
      **`init.ts:70-73`** the per-file loop is
      `if (existsSync(targetPath)) { messages.push('… already exists.'); continue }`
      — a present file is never rewritten, so a project `/init`-ed before the
      8-file split keeps the old hub indefinitely, which is how this repo's own
      `.agents/types/` sat ~5 weeks stale with a hub importing modules the
      current template set does not contain (T86-A). Nothing in the file
      compares the scaffold against `COMMON_TYPE_FILES`, so parity is
      undetectable. The T87-A fix is also confirmed present in this read: the
      type sources travel inline via `COMMON_TYPE_FILES`, with no
      `zod/v4/core` import and no `node_modules` dependency. **Blocker:** the fix
      shape — a refresh/`--force` path (weakens never-clobber), a parity check
      that fails a gate, or accepted-by-design plus documentation.      **Automation level: 1.**
