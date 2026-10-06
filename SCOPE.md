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

**Four** items are open — three blocked pending operator input (T119,
T62-followups, T122) and one shelved on an operator ruling (T147). No
implementation record is open. (T149, the deep pi review, completed
2026-10-06 — its box below is closed. T150, the pi-harness adoption program,
completed and closed 2026-10-06: all twelve work packages implemented,
`fid:verify --check` 22/22, record archived to `dev/fids/archive/`, committed
as `81733c16`. T151, the CodeCraft `/model` picker, completed 2026-10-06:
record closed by operator directive and archived, code committed as
`1323eeab`. Both boxes below are checked.)
(2026-10-05 (in-pass fix, per "NOTHING IS EVER OUT OF SCOPE"): the
`validate:repository` run during the FID-drafting pass returned 1 issue,
none from the FIDs — `quality.ratchet`:
`scripts/__tests__/lessons-to-skills.test.ts` at 327 lines exceeded the
300-line absolute maximum (growth from the in-flight worktree changes).
**Automation level: 3.** Completed in the same pass on the
FID-2026-0914-001 split precedent: the `draftCandidates` block and its
fixture helpers moved verbatim to
`scripts/__tests__/lessons-to-skills-drafting.test.ts` (self-contained,
header noting the cap), import trimmed accordingly; both suites re-run
green and `validate:repository` restored to PASS below. The item is
completed, so it holds no open box here — its evidence is this note and
the two suite outputs.
(2026-10-05 (reference-project review): T138–T142 registered — the
operator-directed top-5 impact review of the vendored reference projects in
`resources/` produced five improvement records, drafted at `created` this
session per the operator directive "Draft FIDs for the top 5 ideas, ranked,
following the FID template": `FID-2026-1005-005` through
`FID-2026-1005-009`, one per item below. Perfection Loop convergence and
implementation follow the FID lifecycle; the items below hold that pending
work.)
(2026-10-03 (decision digest): the failure behind FID-2026-1003-007 —
register items sat `**Blocker:** operator ruling` for weeks because nothing
PRESENTED them — was fixed the same day. Every pending decision was
presented and ruled on in one sitting: **T94** — the operator's model ("it's
not handwritten, im pretty sure it's part of the release script system") is
now the contract: the release script owns the whole callout (label since
FID-2026-0919-023; body via `syncReleaseCallouts` + fail-closed
`version:check` callout-body drift; the real-tree drift it immediately caught
and synced proved the premise). **T83-E** — both `backup-pre-rewrite-*`
branches deleted (git execution authorized; gc not run, so recovery remains
possible). **T95-B** — `tauri` added to `COMMAND_ALLOWLIST` (operator-ruled
security widening); **T95-C**'s only error was T95-B, so `skills:check` now
exits 0 (27 skills, 0 errors, warnings demoted by design) — both leave.
**FID-2026-1003-007** (the surfacing mechanism itself) also completed and
left the register on the standing rule — its own first live run surfaced the
item *itself* as a pending decision, because that item quotes the
`**Blocker:**` convention mid-sentence to describe the failure and the
parser read the quotation as a declaration; the parser now requires a
line-leading declaration, the third pin reproduces the defect, and the
register-prose citations of the day's completed rulings are now quotations
(`scope-register-check` PASS, 0 issues; suite 12/0; `validate:repository`
PASS). Its record is archived
`FID-2026-1003-007-pending-operator-decision-surfacing.md` with the
CHANGELOG entry under `Unreleased — 2026-10-03`.
**T97** — operator bulk-close ruling: 32 pre-cutoff archive records flipped
to `closed (pre-cutoff historical record — operator bulk-close ruling,
2026-10-03)` (30 status-line flips + 2 malformed inserts, -010/-011);
`FID-2026-0919-009` stays untouched as the deliberate dated decline marker
(FID-2026-0928-013); `validate:repository` PASS. **R1** — the window
metaphor + atmosphere in the Code Universe HTML export
(`cli/src/commands/graph-export/universe-css.ts` — NOT the desktop app) are
accepted as-is (dated accept marker). **R2** — settled by measurement:
Chrome-headless render of the real `UNIVERSE_CSS` at 1280×800 / 1100×480 /
900×420 shows the footer fully visible, the 34px band exactly reserved, zero
main overflow, zero horizontal clip (probe:
`dev/scratchpad/active/r2-viewport-probe/`). **R3** — the register line was
STALE: the four D1 colours already landed as `:root` tokens
(`--gutter/--file-meta/--status/--hint`) in v0.0.34 (`d4264141`); the tail is
accepted as literals. **T87-B** — `/init --force` refresh implemented
(never-clobber stays default; knowledge.md and non-template files never
touched; 24/24 init-suite pins). All eight leave the register on the
standing rule. 2026-10-02: T114–T117 completed and left the register on the standing
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
OAuth/Codex-style auth instead.) (2026-10-05: FID-2026-1004-008 (T133) closed and archived on the standing rule;
FID-2026-1005-004 (T137) closed and archived on the standing rule.)
(2026-10-05: T137 completed and left the register on the standing rule —
evidence in archived `FID-2026-1005-004-provider-registry-reference.md`,
CHANGELOG `Unreleased — 2026-10-04`.
2026-10-05: T131 completed and left the register on the standing rule —
evidence in archived `FID-2026-1004-005-provider-runbook.md` (record authored
at closure), CHANGELOG `Unreleased — 2026-10-04`.) Each names its own specific blocker. Nothing here
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

(2026-10-05 (register pass): the seven completed item sections T131–T137 and their
machine-readable targets left this register under the standing rule. Their record is the
CHANGELOG `Unreleased — 2026-10-04`, the archived FIDs, and
`dev/session-summaries/2026-10-05-1551-echo-boot-grounding.md`. Two operator quotations
that existed only here are preserved verbatim in that summary — T132: "i want to figure
out a better way to show the info from on launch" and "rewire it into the new surface".)

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
      **Blocker:** operator account access (xKiro paid plan) and the fourth
      provider's identity — both external to the repository.

- [ ] **T62-followups (remaining items routed, not blocking `Task 62`
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
      **Blocker:** operator credits/keys — tokenharbor allowance reset and
      tokenrouter top-up, both external to the repository.

- [x] **T146. Geaix/Excelnt probe stage — blank key sections, boundary
      probe, universal probe script.** **Automation level: 3.** Operator
      request 2026-10-06, verbatim: "i need to test a new provider.
      https://excelnt.ai/dashboard, make a blank section for the key, then i
      want to probe it before proceeding", corrected the same session to
      "the correct provider is https://geaix.com/dashboard" and scoped to
      both gateways ("Look, i have 2 providers"). Both are OpenAI-style
      (`https://geaix.com/v1` / `https://excelnt.ai/v1`;
      `Authorization: Bearer`; `GEAIX_API_KEY` / `EXCELNT_API_KEY`; keys
      minted in each vendor's VS Code extension, shown once at creation).
      Completed 2026-10-06: blank hand-maintained key sections in
      `.env.example` (outside the generated block), the universal probe
      `dev/scratchpad/active/gateway-catalog-probe.ts` (sends the key as
      Bearer on its first request whenever one is present; `--chat` is the
      single-completion leg), and the live boundary probe recorded in
      `dev/session-summaries/2026-10-06-geaix-excelnt-probe.md` — public
      catalogs on both hosts (byte-identical bodies; 40 rows at 01:07, 41 at
      01:25 when `muse-spark-1.3` appeared — the roster is live-updating),
      completions key-gated (401 `missing_api_key`), key minting
      session-gated (`/api/keys` 401). The operator's "before proceeding"
      pause holds: no registry integration until the keyed probe (T147)
      runs.

- [ ] **T147. Geaix/Excelnt keyed live probe, then registry integration.**
      **Automation level: 1.** The keyed probe (T146's script with a live
      key: catalog + one minimal completion on a chosen model) followed by
      the provider-registry integration FID (catalog, window seams, docs
      surfaces). Live state 2026-10-06: Geaix 0/25 active keys ("No keys
      yet"); Excelnt 0/1 — the single key revoked (2 requests recorded
      2026-10-06 02:14 UTC). **Blocker:** a live gateway key exists only
      after the operator mints it in the vendor's VS Code extension (shown
      once at creation); `/api/keys` is session-gated ("Sign in to manage
      keys.") and `.env.local` is agent-read-blocked, so the operator
      places the key on the prepared blank line. The keyed probe runs before
      any integration work, per "then i want to probe it before
      proceeding". **deferred::operator-approved 2026-10-06 — "let's
      shelf that for now and i'll revisit it later"** (operator shelved the
      provider work; the key-creation wall and the Oct 13 balance expiry
      stay recorded above).

- [x] **T148. Reference-project review: `resources/deepseek-harness` +
      pi harness.** **Automation level: 3.** Operator request 2026-10-06,
      verbatim: "i want you to review a few resources. Take a very deep look
      at this - see if there are any ideas we can get from it" + "also pi
      harness". Deep read-only review of the vendored reference harnesses
      (architecture, agent governance, tooling, testing, docs) and an
      evidence-cited,      ranked idea list for Savant-Code. **Completed
      2026-10-06:** report delivered at
      `dev/session-summaries/2026-10-06-reference-review-deepseek-pi.md` —
      15 ranked ideas with cited evidence, prior-overlap check against
      T138–T142, and stated read limits. Adopting any idea becomes its own
      registered item.

- [x] **T149. Deep pi-harness review: `resources/pi-main` internals +
      `resources/pi-ralph` + `resources/pi-steering-hooks`.**
      **Automation level: 3.** Operator request 2026-10-06, verbatim: "now
      review pi" (follow-up to T148, whose pi coverage was README/AGENTS
      level only and whose read limits named the package internals as
      unread). Deep read-only review of pi's package sources and design
      specs (harness durability model, tool durability, compaction,
      concurrency primitives, session format, trust model), pi-ralph's
      orchestration sources (`index.ts`, `lib.ts`, `presets/`, `skills/`),
      and `pi-steering-hooks/src`, producing an evidence-cited ranked idea
      list with a duplication check against T148's 15 ideas. **Completed
      2026-10-06:** report delivered at
      `dev/session-summaries/2026-10-06-pi-deep-review.md` — 13 ranked
      ideas (top: deterministic steering hooks with audited override,
      race catalog + instrumented-storage test tiers, tool outcome
      durability `outcome_ready`/invocation memos, atomic transition rule,
      compaction split-turn semantics), T148 overlap table, and stated read
      limits (specs read as design docs; tui/ai/protocol/server packages
      and pi tests not run). Adopting any idea becomes its own registered
      item.

- [x] **T150. Pi-harness adoption program (`FID-2026-1006-002`).**
      **Automation level: 2.** Operator request 2026-10-06, verbatim: "write
      a fid to implement all of the features found + run the full perfection
      loop on the fid then present it" — author one FID covering the 13
      ranked ideas in T149's report
      (`dev/session-summaries/2026-10-06-pi-deep-review.md`), run the
      Perfection Loop on the FID document to convergence, and present the
      converged record. **Completed 2026-10-06:** all twelve adopted work
      packages implemented and gate-verified — `fid:verify --check` 22/22
      (5 workspace typechecks + 16 named test gates + `quality: PASS (1498
      baselined files)`), receipt fingerprint
      `sha256:b1a3f13c7fa33e485ca6bbffeb366226be2a1a3470d06341651d87c95b50a8c0`,
      root `bun run typecheck` (13 workspaces) exit 0, `validate:repository`
      PASS, `lint:md` exit 0, eslint `--max-warnings 0` exit 0 on the
      changed surface. The record's status flips `verified` → `closed` in
      the same session and it moves to `dev/fids/archive/` per the FID
      Auto-Archive rule (CHANGELOG + session summary updated with it).
      Three work packages (WP5 cut-point/file-tracking, WP7 loop guard
      rails, WP11 entry classes) are library-complete modules with no
      production call path yet — FID scope for WP5/WP7 (module + tests is
      the declared deliverable) and the WP4-database-half precedent for
      WP11; stated as a limitation in the record, not reported as
      reachability. Committed locally as `81733c16` (path-scoped, after the
      operator's "approve all work and local commits"); no push, tag or
      release.
      **Converged 2026-10-06:**
      `dev/fids/archive/FID-2026-1006-002-pi-harness-adoption-program.md`
      (status `closed`, automation level 2) carries twelve adopted work
      packages
      (steering rules with audited override; race catalog + write-order
      conformance; tool-outcome durability design study; atomic transition
      rule + per-path file-mutation queue; compaction cut-point/split-turn
      semantics and cumulative file tracking; branch summarization; loop
      guard rails incl. stale-cycle detection; pure decision functions with
      injected clock; project-trust inheritance; adaptive publisher; session
      entry classes; marker-based prompt isolation), one analysis-only
      non-adoption (idea 13 miscellanies, re-routed to T147/T62 where they
      belong), and per-idea de-duplication against existing Savant surfaces
      (`tool-executor/steering.ts` = EHEL injection, not rule blocking;
      `common/src/util/skill-management/trust.ts` = skills quarantine trust,
      not workspace trust). **Blocker:** operator approval of the adoption
      scope — implementation begins only after the operator rules on the
      presented FID. The FID-authoring step itself is complete; this box
      stays open because the adoption program is not implemented.

- [x] **T151. CodeCraft `/model` picker visibility (`FID-2026-1006-001`).**
      **Automation level: 2.** Register line added 2026-10-06 by the T150
      session's ECHO-compliance pass — **for coverage only, not scope
      authorship**. That record was authored by a **concurrent session**
      (`Created: 2026-10-06 03:29`) while this session's own FID was being
      loop-passed, and `bun run validate:repository` refused the tree with
      `scope.unregistered-item`: an active FID with no line here is invisible
      in the register and droppable with no operator decision, so the tree was
      red for *both* sessions until this line existed. **Completed
      2026-10-06:** the record was closed by operator closure directive
      (05:16 EDT) and archived to
      `dev/fids/archive/FID-2026-1006-001-codecraft-model-picker.md`; its
      declared gates passed per its own record (typecheck cli/common, five
      suites, the live fan-out probe, quality); and its 22 code paths were
      committed locally as `1323eeab` under the operator's "approve all work
      and local commits" authorization. This coverage line is closed rather
      than left open, which would have claimed unfinished work.

- [x] **T145. `website/` deliberate project root.** **Automation level: 3.**
      Operator ruling 2026-10-05 (structured
      question): "Leave as deliberate root" — the new top-level `website/`
      tree (one 48 KB `index.html`, created 2026-10-05 18:47) is intended
      project work, not a vendored foreign tree. `scripts/audit-vendored-tree.ts`
      accepts any root once it carries tracked content — the check is
      self-maintaining by design (no allowlist exists or is wanted). Committed
      locally as `cef88023` on 2026-10-06; `bun run validate:repository` passes.

- [x] **T144. ChatAnywhere provider + free-key star marking.**
      **Automation level: 3.** `FID-2026-1005-010` drafted at `created`
      2026-10-05 (now `verified`) per operator directive "Read over
      adding a provider. I want
      to add https://chatanywhere.tech/pricing, then in the model page, a
      special section with the 'free key', lets add a star or something for
      those entries. Add a blank key entry and we'll test gpt5.6 sol - this
      needs a fid though" (+ "i added the key under
      CHATANYWHERE_API_KEY"). Design rulings recorded verbatim in the FID:
      blank key entry = placeholder row for the free key; star = reusable
      predicate ("free" in the name OR from the free-key provider) applied
      to all free options. Live evidence already green (2026-10-05):
      `/v1/models` 200/30 rows, `gpt-5.6-sol` completion 200 "pong".
      **Implemented + verified 2026-10-05** (FID status `verified`, receipt
      stamped): registry entry + static 27-model catalog + table-section
      window seam (13 cross-gateway rows), `cli/src/utils/free-badge.ts`
      marker, FREE KEY section with blank key row on the model page, 13
      hand-maintained doc surfaces synced (`generate:provider-docs:check`
      clean). All gates green; closed and archived 2026-10-06 in local commit
      `e229d9a1` after operator G2 authorization.

- [x] **T139. Provider failure classification + bounded-probe circuit
      breaker.** **Automation level: 3.** `FID-2026-1005-006` converged
      2026-10-05 (drafted at `created` same day) from the
      reference-project review: classify every
      provider failure (transient / administrative / unknown) before any
      retry decision, add a per-provider breaker (`closed` / `open` /
      `half_open`) whose cooldown schedules one bounded probe, and validate
      retry-policy shape at load time so a mis-shaped policy can never
      produce non-finite backoff. Sources:
      `resources/OmniRoute-v3.8.51/docs/OMNIROUTE_PROVIDER_FAILOVER.md`,
      `resources/dsh-our-free-model-main/README.md` (measured 429 and
      policy-shape failures). Perfection Loop converged 2026-10-05
      (GREEN design grounded in the live retry/quota seams; audit corrected
      the `quotaEpisode` overclaim); implementation verified 2026-10-06
      (5/5 declared gates pass); closed and archived 2026-10-06 in local commit
      `e229d9a1` after operator G2 authorization.

- [x] **T141. Availability verdict taxonomy + truthful quota states.**
      **Automation level: 3.** `FID-2026-1005-008` verified 2026-10-05 (converged,
      then implemented + receipt stamped same day)
      from the reference-project review: separate provider
      verdicts (declared-not-routed, reason recorded) from gateway faults
      (5xx / 429 / timeout / parse — never a verdict) and eligibility-gated
      models; five-state quota enum where `unknown` is never `exhausted`
      and never disables a lane; notification preconditions
      (`quota-exhausted` requires an observed zero, `quota-recovered`
      requires a prior recorded exhaustion). Sources:
      `resources/dsh-our-free-model-main/README.md`,
      `resources/OmniRoute-v3.8.51/docs/OMNIROUTE_QUOTA_TELEMETRY.md`.
      Perfection Loop converged 2026-10-05 (source-absent → `unknown` vs
      source-down → `unavailable` split recorded); implementation verified
      2026-10-06 (10/10 declared gates pass); closed and archived 2026-10-06
      in local commit `e229d9a1` after operator G2 authorization.

- [x] **T142. Evidence-classed provider facts + docs-count drift gate.**
      **Automation level: 3.** `FID-2026-1005-009` verified 2026-10-05 (converged,
      then implemented + receipt stamped same day)
      from the reference-project review: provenance metadata
      (evidence class + source + verification date) on fact-bearing
      registry entries, a changed-fact-without-evidence rule inside
      `validateProviderRegistry`, and a recompute gate that fails the build
      when numeric prose claims drift from the registry. Source:
      `resources/OmniRoute-v3.8.51/docs/reference/FREE_TIERS.md`
      (`// evidence:` classes + `check:docs-counts`). Perfection Loop
      converged 2026-10-05 (baseline-diff rule proven against edited
      entries); implementation verified 2026-10-06 (7/7 declared gates pass,
      including the live drift probe); closed and archived 2026-10-06 in local
      commit `e229d9a1` after operator G2 authorization.

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

- [x] **T138. Three-tier skill evals — structural, trigger-routing,
      behavioral.** **Automation level: 3.** `FID-2026-1005-005` implemented
      and verified 2026-10-06: all 11 trusted skills have behavioral rubrics;
      structural and routing tiers pass offline; paired behavioral trials
      support dialogue and constrained file execution; description hashes
      gate trust; rejected changes record paired scores. All 11 declared
      gates pass; closed and archived 2026-10-06 in local commit `e229d9a1`
      after operator G2 authorization.

- [x] **T140. Bounded stream recovery for truncated long-reasoning turns.**
      **Automation level: 3.** `FID-2026-1005-007` converged 2026-10-05 (drafted at `created` same day)
      from the reference-project review: when a gateway cuts a
      stream mid-reasoning, one bounded recovery request (checkpoint-seeded,
      tools disabled, at most two physical requests per logical turn, hard
      budgets, no infinite continuation) rescues the turn; accounting
      separates physical requests from logical turns. Source:
      `resources/dsh-our-free-model-main/README.md` (issue #12). Perfection
      Loop converged 2026-10-05 (caps as named constants beside
      `native-strikes.ts` precedent; accounting seams grounded to
      `reconcile-token-count.ts`); implementation verified 2026-10-06
      (4/4 declared gates pass); closed and archived 2026-10-06 in local commit
      `e229d9a1` after operator G2 authorization.

## Machine-readable scope targets

<!-- 2026-10-05 (all-FIDs session): T131, T137, T134, T135, T136, T132
     completed and left the register on the standing rule; T133's FID is
     archived. 2026-10-05 (register pass): the seven completed item sections and
     their target lines were removed; completed work's record is the CHANGELOG,
     the archived FID, and the session summary. -->

<!-- FID-2026-1001-003 step 5a: per-item write targets for the Law 2 gate
     (operator-approved 2026-10-02, "present before writing" honored). Each
     line maps a register item to the paths its approved work may touch.
     No pattern = non-covering, fail-closed. Items with no write surface
     (operator-only actions) carry none. Governance surfaces the protocol
     itself mandates are GATE-LEVEL exemptions (operator ruling 2026-10-02),
     deliberately not register items. -->

- T119: `.env.local`, `docs/providers.md`,
  `dev/session-summaries/2026-10-03-provider-*.md`,
  `dev/scratchpad/active/provider-catalogs-2026-10-03/**`,
  `dev/scratchpad/active/provider-integration-*`
- T62-followups: `dev/scratchpad/active/t62*.ts` (the catalog itself is
  gateway-side; the local write surface is the probe scripts — verified
  2026-10-02: no local catalog directory exists)
- T146: `.env.example`, `dev/scratchpad/active/gateway-catalog-probe.ts`,
  `dev/session-summaries/2026-10-06-geaix-excelnt-probe.md`
- T147: `dev/scratchpad/active/gateway-catalog-probe.ts`,
  `dev/session-summaries/2026-10-06-geaix-excelnt-probe.md`,
  `dev/fids/**` (the integration FID)
- T148: `dev/session-summaries/2026-10-06-reference-review-*.md`
- T149: `dev/session-summaries/2026-10-06-pi-deep-review*.md`
- T150: `dev/fids/**`, `dev/session-summaries/2026-10-06-pi-harness-adoption*.md`,
  `packages/agent-runtime/src/**`, `packages/database/src/**`,
  `common/src/**`, `cli/src/**`, `evals/v2/**`, `docs/**`,
  `protocol.config.yaml`, `ARCHITECTURE.md`
- T151: `dev/fids/**`, `cli/src/utils/provider-credentials.ts`,
  `cli/src/utils/openrouter-models/**`, `cli/src/utils/__tests__/provider-credentials.test.ts`,
  `common/src/constants/window-coverage-register.ts`,
  `common/src/constants/provider-catalog-census.json`, `package.json`,
  `scripts/window-coverage-check.ts`,
  `scripts/provider-catalog-parity.ts`,
  `scripts/__tests__/window-coverage-check.test.ts`,
  `scripts/__tests__/provider-catalog-parity.test.ts`
- T122: (no write surface — operator-owned)
- T145: `website/index.html`
- T144: `common/src/providers/**`, `common/src/constants/**`,
  `cli/src/components/model-picker*`, `cli/src/utils/free-badge.ts`,
  `cli/src/utils/openrouter-models/**`, `docs/providers.md`, `README.md`,
  `README.zh-CN.md`, `cli/release/README.md`, `docs/index.md`,
  `docs/sdk-overview.md`, `docs/installation.md`, `docs/features.md`,
  `dev/fids/**`
- T138: `evals/**`, `scripts/skills-check*`,
  `common/src/util/skill-management/**`, `common/src/util/skill-trigger-cases.ts`,
  `cli/src/commands/skills.ts`, `cli/src/commands/skills-impact-ledger.ts`,
  `cli/src/commands/__tests__/skills-command.test.ts`,
  `scripts/lessons-to-skills.ts`
- T139: `packages/agent-runtime/src/**`,
  `common/src/providers/provider-quota-policy.ts`
- T140: `packages/agent-runtime/src/**`
- T141: `common/src/providers/**`, `cli/src/utils/free-options-render.ts`,
  `cli/src/utils/discovery-inbox.ts`, `cli/src/utils/free-options.ts`,
  `cli/src/utils/free-options-types.ts`, `cli/src/utils/__tests__/free-options.test.ts`,
  `cli/src/utils/provider-quota-monitor.ts`, `cli/src/utils/__tests__/provider-monitoring.test.ts`,
  `cli/src/components/model-picker-grouping.ts`,
  `cli/src/components/__tests__/model-picker-free-section.test.ts`,
  `packages/agent-runtime/src/provider-boundary/**`,
  `packages/agent-runtime/src/prompt-agent-stream.ts`,
  `packages/agent-runtime/src/__tests__/prompt-agent-stream-forwarding.test.ts`
- T142: `common/src/providers/types.ts`, `common/src/providers/validate.ts`,
  `scripts/generate-provider-reference.ts`, `scripts/provider-docs-drift.ts`,
  `scripts/__tests__/provider-docs-counts-drift.test.ts`, `docs/providers.md`,
  `package.json`, `scripts/provider-docs-counts-drift.ts`,
  `cli/src/utils/free-options-types.ts`, `cli/src/utils/free-options.ts`,
  `cli/src/utils/free-options-render.ts`, `cli/src/utils/__tests__/free-options.test.ts`
