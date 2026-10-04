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

**Twelve** items are open.
(2026-10-02: T114–T117 completed and left the register on the standing
rule — each owns a converged, implemented, verified FID in `dev/fids/`
with receipt-stamped gates, pending G2 commit authority:
`FID-2026-1002-004` (T114/D1: supervisor passes `SAVANT_PROJECT_ROOT`
env-only + `SAVANT_DESKTOP_PROFILE`; sidecar fails closed in release
without a root — 3 new Rust git-root tests, argv-exclusion pin, TS
gate test, cargo-test probe gate), `FID-2026-1002-005` (T115/D2:
turn-end baseline advance uses the captured root; captured-root
regression test — the old code failed both its assertions),
`FID-2026-1002-006` (T116/O1: graph refresh reads only changed files —
stat pre-filter + persisted import/extend tokens + legacy backfill;
zero-read second pass pinned; 19 pre-existing suites green unmodified),
`FID-2026-1002-007` (T117/D4+D5: approvals survive disconnects with
run-settle/shutdown deny; flush timer self-stops and re-arms — contract
re-pinned, new flush-lifecycle suite). Breadth: agent-runtime 1,645
pass / 0 fail; cli 3,797 pass / 0 fail / 18 skip; knowledge-graph 24
pass / 0 fail; cargo test 17 pass / 0 fail; repo ESLint zero warnings;
quality PASS; markdownlint clean. 2026-10-02: T113 completed and left the register on the standing rule —
the full-system data-flow audit report is delivered at
`dev/session-summaries/2026-10-02-full-data-flow-audit.md`: seven
evidence-backed findings D1–D7 (desktop sidecar cwd anchoring; turn-end
baseline-advance root asymmetry; gateway dispatch error containment;
approval-lifecycle contract drift; perpetual flush timer; reconnect event
loss; project-data basename collisions) and three optimization
opportunities O1–O3 (knowledge-graph full-corpus refresh IO/memory;
budget-middleware re-count; active-FID TTL sync read), with flow map,
prior-work integration spot-check, and explicit verification limits.
Markdown lint + Prettier pass on the report. Findings are recommendations,
not committed work. 2026-10-03: T118 (D3) completed and left the
register on the standing rule — `FID-2026-1002-008`
(gateway-dispatch-error-containment, status verified, receipt stamped
8/8 gates: cli typecheck, the new fault-injection containment suite 5
pass / 0 fail, the five gateway family suites 21 pass / 0 fail,
quality): the RPC dispatch boundary, the `void`-ed user_message
handler, the hello FID-snapshot timer, and the websocket transport are
all contained on the frozen vocabulary (`internalError -32603` /
`run_complete {ok:false}`) through the new
`cli/src/server/gateway/rpc-containment.ts`; fault-injection tests run
through harness DI seams only (no module mocking). 2026-10-03: T123 (D6)
and T124 (D7) completed and left the register on the standing rule —
`FID-2026-1003-002` (gateway-reconnect-event-replay, status verified,
receipt stamped 8/8 gates: cli + desktop typecheck, the new cli replay
suite 4 pass / 0 fail, gateway-handshake + gateway-user-message, the new
desktop client-replay suite 4 pass / 0 fail, the drift guard, quality):
every `event` frame flows through one seq-stamped emission primitive
(`emitEventBatch`, bounded 1,000-batch buffer) in
`cli/src/server/gateway/state.ts`; the additive `replay_events`
capability + method (`cli/src/server/gateway/replay-rpc.ts`), the
additive hello `eventSeq`, and the desktop cursor/replay path
(`gateway-client-connection.ts` + `onReplayGap`) let a reconnecting
renderer recover the disconnect window in order through the existing
`onEvents` seam — live wire format, envelope, error codes, and
protocolVersion untouched. `FID-2026-1003-003`
(project-data-basename-collision, status verified, receipt stamped 5/5
gates: cli typecheck, the new isolation suite 4 pass / 0 fail,
project-files-chat-id + run-state-storage-atomic, quality):
`getProjectDataDir()` now keys `projects/<basename>-<sha256-8>` over the
realpath-normalized root (win32-lowercased including the basename
prefix), with a one-time guarded legacy rename — non-destructive on
refusal; all consumers flow through the unchanged choke point.
2026-10-03: T127 completed and left the register on the standing rule —
`FID-2026-1003-006` (free-provider routing, catalog truth, and reliable
notifications; status verified, receipt stamped 23/23 gates via
`fid:verify --write`): D1 explicit serving identity (versioned `ModelRoute`
selection persisted atomically; explicit routes win before prefix/OAuth
logic; legacy bare-slug synthesis yields to a custom `INFERENCE_BASE_URL`
endpoint in `resolveModelRoute`); D2 canonical attribution
(`nvidia-nim -> nvidia`; readiness credential-name one-truth); D3 durable
notification service + consumer lifecycle (cli coordinator +
capability-negotiated desktop `provider_notice`); D4 semantic deltas; D5
dated health/removal + eligible 429 hints; D6 capability-based quota +
dated offer expiry; D7 picker correction retained. Whole-tree battery
green: typecheck 14 legs exit 0; per-workspace tests sdk 655, cli 3826
pass/18 skip (real-child handoff matrix 6/6), common 749, agents 156,
evals 171, agent-runtime 1648, design-systems 19, code-map 51, database
18, knowledge-graph 55, llm-providers 89, connectors 17, desktop 427,
scripts/providers 46 — zero fail; ESLint zero warnings; markdownlint
clean; Prettier clean; quality PASS. Live boundaries recorded in the FID:
native TUI tmux smoke and a live desktop smoke not run on this host (tmux
unavailable); ambient dev-machine `.env.local` reaches handoff children
(routing contract holds regardless; CI deterministic); the standing
Savant-Free e2e failures stay T122. Closure and archive await G2 commit
authority. 2026-10-03 (closure): G2 was granted — the operator picked
"Batch + close all"; the verified tree landed in batch commit `9f1b8068`
and ALL eleven October FIDs (`FID-2026-1002-002` … `-008`,
`FID-2026-1003-002`/-003/-005/-006) are closed and archived with
CHANGELOG entries under `Unreleased — 2026-10-03`. T111
(`FID-2026-1002-002`), T112 (`FID-2026-1002-003`), and T126
(`FID-2026-1003-005`) therefore also completed and left the register on
the standing rule. 2026-10-02: T109 + T110 completed and
left the register on the standing
rule — `FID-2026-1001-003` (all eight steps implemented: effect-based
mutation classification closing the terminal bypass, worktree-reconciled
Law 15, the durable Law 1 read ledger, restored Law 3 with N=3 escalation,
the Law 2 scope gate consuming this file's machine-readable targets, and
the Law 4 / fid-validator / prompt-content CI gates) and
`FID-2026-1002-001` (code_search fails loud) are closed and archived,
with CHANGELOG `2026-10-02` entries and receipts stamped via
`fid:verify --write` from the repo root. The machine-readable targets
section below STAYS: the Law 2 gate consumes it at write time for the
remaining items.)
(2026-10-01: T108 completed and left the register on the standing rule —
evidence in archived `FID-2026-1001-001-openai-platform-provider.md`,
CHANGELOG `Unreleased — 2026-10-01`, and the 2026-10-01 session summary.
2026-10-01: T108 registered — operator request, verbatim: "i have a
subscription to chat gpt pro, when i load the api key, it does not work. We
need to review the provider system for openai. However, i also have multiple
agents in resources such as openclaw/hermes you can review to look at how
they implemented the provider, see if we did something wrong." Interpreted
scope: (a) map Savant's OpenAI provider path — key loading, registry,
endpoint/auth wiring, failure surface; (b) review the vendored
`resources/openclaw` and `resources/hermes-agent`/`hermes-desktop` provider
implementations for a comparison baseline; (c) diagnose why a ChatGPT Pro
subscription credential fails and present findings + fix options. RED phase
is investigation-only — no code changes without a presented plan. Working
hypothesis to verify, not assume: ChatGPT Pro is consumer ChatGPT billing
and does not include platform-API credits; if our provider only accepts
platform `sk-` keys, the credential class itself is the failure, and the
interesting question is whether openclaw/hermes solve it via ChatGPT
OAuth/Codex-style auth instead.) Each names its own specific blocker. Nothing here
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
(2026-10-01: T107 completed and left the register on this rule —
FID-2026-0930-003 implemented + verified + receipt stamped (7/7 gates),
closed and archived, CHANGELOG `Unreleased — 2026-10-01`, commit `7187d1ec`:
the connectors catalog is exposed as the 4-tool meta-family
(`connector_search`/`connector_describe`/`connector_invoke`/
`connector_credentials`, composio precedent) with 4 offline suites. The
same ceremony applied the standing 2026-09-28 rule to the other
ground-truthed-completed entries: T98–T101 (archived
`FID-2026-0929-001`..`-005`, CHANGELOG `Unreleased — 2026-09-29/30`,
commits `bc3b31d8`/`c49d3887`/`742f3612`/`4b54e804`/`06220bc6` — verified
against archive + CHANGELOG in the 2026-10-01 status report) and the
checked T104–T106 boxes (commit `9816bbdf`); the connector-layer section
is gone entirely. Register recount: Ten open.)
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

- [ ] **T119. Pending provider account access and identity.**
      **Automation level: 1.** Mapped xKiro Claude Haiku live acceptance
      returned HTTP 403 requiring an active paid plan or real deposited
      balance. Operator account access is needed before repeating that leg;
      no purchase is authorized. The possible fourth provider still needs
      its name or URL before a new converged integration FID can be prepared.
      The three confirmed services and project-wide model/documentation work
      are completed in archived `FID-2026-1003-001`, implementation commit
      `72af5480`; only these two external boundaries remain here.

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

- [ ] **T122. Savant-free feature disposition (operator-owned).** Operator
      ruling 2026-10-03, verbatim: "i think it might be smarter to leave
      savant-free alone, just fix the problems you found and i'll address it
      tomorrow when i have a clear day to spend more time on the savant-free
      feature because it's in the code deeply and i don't really feel like
      untangling it right now." Context: the full-repository battery
      surfaced 13 failing / 5 erroring savant-free e2e tests (missing built
      release binary + a stale `SavantFreeSession` import in 5 committed e2e
      files); a removal scan mapped 234 reference sites outside the
      workspace (`agents/savant/*` provider agents, the CLI free-mode
      integration, `common/src/constants`, docs, release scripts).
      **Blocker:** the feature is woven deeply through the CLI/agents/common
      surfaces — disposition (repair or removal) is a dedicated
      operator-directed session. **Automation level: 1** (no agent action;
      the e2e failures are known and operator-owned until then).

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
      that fails a gate, or accepted-by-design plus      documentation.      **Automation level: 1.**

## Machine-readable scope targets

<!-- FID-2026-1001-003 step 5a: per-item write targets for the Law 2 gate
     (operator-approved 2026-10-02, "present before writing" honored). Each
     line maps a register item to the paths its approved work may touch.
     No pattern = non-covering, fail-closed. Items with no write surface
     (operator-only actions) carry none. Governance surfaces the protocol
     itself mandates are GATE-LEVEL exemptions (operator ruling 2026-10-02),
     deliberately not register items. -->

- T94: `README.md`, `README.zh-CN.md`, `scripts/*version*`
- T127: `dev/fids/FID-2026-1003-006-free-provider-routing-notification-audit.md`,
  `dev/session-summaries/2026-10-03-free-provider-*.md`, `common/src/**`,
  `sdk/src/**`, `cli/src/**`, `packages/agent-runtime/src/**`, `desktop/src/**`,
  `scripts/providers/**`, `docs/providers.md`
- T126: `cli/src/components/model-picker*.ts*`,
  `cli/src/components/__tests__/model-picker*.test.tsx`, `dev/fids/**`,
  `dev/session-summaries/2026-10-03-free-provider-notification-audit.md`
- T95-B: `scripts/skills-check-policy.ts`, `scripts/skills-check-content.ts`
- T97: `dev/fids/archive/**`
- R1: `desktop/src/**`
- R2: `desktop/src/**`
- R3: `desktop/src/**`
- T62-followups: `dev/scratchpad/active/t62*.ts` (the catalog itself is
  gateway-side; the local write surface is the probe scripts — verified
  2026-10-02: no local catalog directory exists)
- T87-B: `cli/src/commands/init.ts`, `.agents/types/**`
- T83-E: (no write surface — operator git execution)
- T95-C: (no write surface — operator home directory)
- T111: `cli/src/**`, `sdk/src/**`, `common/src/**`, `packages/agent-runtime/src/**`,
  `packages/connectors/src/**`, `scripts/fid-verify.ts`,
  `scripts/__tests__/fid-verify.test.ts`, `dev/fids/**`, `dev/session-summaries/**`
- T112: `common/src/**`, `sdk/src/**`, `cli/src/utils/openrouter-models/**`,
  `cli/src/utils/__tests__/**`, `packages/agent-runtime/src/**`, `docs/**`,
  `.markdownlintignore`, `dev/fids/**`, `dev/session-summaries/**`
- T122: (no write surface — operator-owned)
- T123: `cli/src/server/**`, `desktop/src/**`, `desktop/scripts/**`,
  `dev/fids/**`, `dev/session-summaries/**`
- T124: `cli/src/**`, `dev/fids/**`, `dev/session-summaries/**`
- T119: `.env.local`, `docs/providers.md`,
  `dev/session-summaries/2026-10-03-provider-*.md`,
  `dev/scratchpad/active/provider-catalogs-2026-10-03/**`,
  `dev/scratchpad/active/provider-integration-*`
