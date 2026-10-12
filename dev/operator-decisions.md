# Operator decision queue

Fill-in form for every open item that is blocked on you. Snapshot taken
2026-10-12 on `main` @ `1a11e502` (32 commits ahead of `origin/main` `5db442b4`).

Nothing below is a bug report. Each item is either an external input (a key, a
purchase, a vendor value) or a ruling the protocol reserves for the operator.

## How to use this file

- Answer inline after each `**Answer:**` marker. Free text is fine; partial
  answers are fine and I can start on what is answered.
- `HOLD` keeps the item open and blocked. `DROP` closes it — I evict the register
  line and record the disposition in the changelog and session summary. `SKIP`
  leaves it exactly as it is today.
- You do not have to answer all of them, and you can reorder them: the priority
  order below is my recommendation, not a constraint.
- Before acting on any answer I re-verify its claim against the live tree. If an
  answer turns out to rest on stale state, that gets reported back, not executed.

## Fast path — three answers unblock the most work

1. **Q1** (publication): the only agent-actionable item currently gated on you.
2. **Q12** (Savant-Free: repair or remove): gates Q13 and the aggregate `ci` leg.
3. **Q10** (research API key): one key clears the top two lines of the learning
   ledger (`web_search` 19×, `read_url` 24×).

## Round 1 — executed 2026-10-12

What the answers already landed, with the check that proves each one:

| Answers | Landed | Proof |
|---|---|---|
| Q1, Q2, Q3 | system-wide bump to **0.0.36** (`VERSION`, 17 manifests, `protocol.config.yaml`, `bun.lock`, four desktop surfaces, CHANGELOG heading + callout, README/README.zh-CN, doc version surfaces); release **not** cut; commits stay local | `bun run version:check` → PASS |
| Q8 | `version: 0.1.0` added to `release-workflow`, `savant-design`, `savant-design-systems`, `savant-motion`, `startup-playbook` | `bun run skills:check` 35 → 30 warnings |
| Q9 | all three rituals ran | 1 quarantine skill drafted, 15 learnings retired, 5 evolve candidates |
| Q12, Q13 | T122 re-scoped to removal; T186 now carries the ordered path | `SCOPE.md` |
| Q20, Q21 | T147 and T164-D evicted; the Geaix/Excelnt probe script deleted | `SCOPE.md`, `git rm` |
| (defect found) | `bump --docs` silently no-op'd its CHANGELOG heading insert on a CRLF working copy while reporting the file changed | `scripts/version-docs.ts` + 2 regression tests, 10/10 pass |

Q4 (commit the dirty files) closes at the end of this pass. Q11, Q15, Q18 and Q19
are answered but not yet executed — see the replies below for what each needs.

## A. Publication and release

### Q1 — `SCOPE.md`'s release item is factually stale

**State.** The item still reads "publish all **189** existing local commits and
the release commit" for **v0.0.35**. That release shipped: GitHub release
`v0.0.35` is published (`isDraft: false`, `publishedAt 2026-10-11T21:18:56Z`),
npm `savant-code` dist-tag `latest: 0.0.35`, and the tagged commit `59d40a71` is
an ancestor of `origin/main`. What is genuinely pending is the **32 commits**
after the release, this session's work included.

**Blocked work.** Repository publication. Every path here is external and
hard to undo, so it needs your explicit go-ahead.

**Options.**

- (a) Re-scope the item to reality, cut **v0.0.36** from the 32 commits, and run
      the public release pipeline (preview and gates first, per the item text).
- (b) Push the 32 commits to `origin/main` with no version cut.
- (c) Declare the item discharged — nothing to publish, commits stay local — and
      evict the register line.

**Answer:**
We need to bump to 0.0.36 system wide, we're not cutting the relesae today but
since we just pushed a public release we can keep this work locally as the next
release.

### Q2 — If you answer (a): release shape for v0.0.36

**State.** `v0.0.35` shipped without its binaries and needed a backfill pass
(archived `FID-2026-1011-003`), so the binary step is not automatic.

**Options.** (a) standard cut — version bump, CHANGELOG entry, binaries built and
attached, then publish; (b) source-only cut; (c) you name the version and shape.

**Answer:**
All post-release work stays local and we continue work on the new version

### Q3 — Standing git authority

**State.** The protocol record says the agent never executes git and closure
requires a committed hash, so every commit so far waited on you. Pushing is
separately gated: `.githooks/pre-push` runs the fail-closed credential scan plus
eslint and markdownlint.

**Options.** (a) commit allowed, push still ask-first; (b) commit and push
allowed on `main`, never force-push; (c) keep asking each time.

**Answer:**
local commiting is completely fine, just don't push to main unless we're
releasing. This is currently in limbo though, i am debating on lifting all push
restrictions, but currently, local commits are permitted freely.

## B. Working tree

### Q4 — Your three dirty files (untouched by me all session)

**State.** `dev/experiences/raw-traces.jsonl` (M),
`dev/telemetry/compliance.jsonl` (M),
`dev/preaudit-g2-commit-baseline.json` (deleted).

**Options.** (a) commit all three as-is; (b) commit the two telemetry appends
together and keep the deletion separate; (c) restore the deleted baseline;
(d) leave them dirty as they are today.

**Answer:** local commit, the tree should never be dirty moving forward w/ local commits permitted.

### Q5 — Aggregate `bun run ci` is red on this machine by design

**State.** The failure is the FID-2026-0805-002 gate refusing your `.env.local`
dev `NEXT_PUBLIC_*` values — not a code defect. The Savant-Free leg builds green
in the documented clean-shell condition. I have not weakened the gate to make
`ci` green and will not without your ruling.

**Options.** (a) accept red-by-design and keep documenting it; (b) authorize a
repair so the gate tolerates local dev values in `.env.local`; (c) other.

**Answer:** savant-free is going to be removed from the system soon. So this is on my to-do list. defer for now. 

## C. Feature pipeline — four drafts awaiting a routing decision

### Q6 — Which draft candidates become FIDs, and in what order?

**State.** `dev/feature-pipeline/candidates.json` holds 2 `implemented` and
4 `draft`. Each draft is an *investigation*, not an accepted remedy:

| Candidate | Frame | Acceptance sketch |
|---|---|---|
| LF-003 | six DB snapshot saves failed with cyclic serialization | diagnose the exact field; prove what survives a failed write |
| LF-004 | recover retained research evidence after compaction | resolvable locator with truthful retention bounds |
| LF-005 | separate production acceptance from tool-call success | one operator/native observation per claimed UI behavior |
| LF-006 | detect stale lesson guidance against current authority | dated guidance visibly distinguished from live policy |

**Options.** Name the ones to route, in order (for example "LF-003, then
LF-005") and I converge one FID per candidate; or `DROP` a candidate; or defer
the whole set behind the release.

**Answer:**
defer until later, i will begin post-release work in this session, so leave this pending. 

### Q7 — LF-001 and LF-002 are implemented: do you want live acceptance?

**State.** Both closed through FIDs (`FID-2026-1012-007` and `-008`) with
automated evidence. No live model or UI acceptance ran this session, and
`FID-2026-1012-003`'s two NEEDS-REVIEW boundaries remain recorded rather than
claimed.

**Options.** (a) run a real tmux CLI session against both and record the
transcript; (b) accept the automated evidence and move on; (c) defer.

**Answer:** if this was the tiarina provider, i already tested and confirmed it working.

**Reply (agent, 2026-10-12).** Tiarina is a different item: LF-001 is the
`read_files` window fix (the SDK truncated the whole file before line offsets
applied) and LF-002 is child-agent compaction/context propagation. Neither
touches the Tiarina provider path, and `FID-2026-1012-005` (Tiarina) is already
archived. So this answer does not settle Q7. Re-asking, narrower: (a) I run a real
tmux CLI session against LF-001 and LF-002 and record the transcript, (b) the
automated evidence closed in `FID-2026-1012-007`/`-008` is enough, (c) defer.
In the meantime both stay `implemented` with the two NEEDS-REVIEW boundaries in
`FID-2026-1012-003` recorded, not claimed.

## D. Harness and learning surfaces

### Q8 — Five trusted skills lack `version` frontmatter (register item T187)

**State.** `bun run skills:check` reports 0 errors / 35 warnings; five are
`missing 'version' frontmatter` for `release-workflow`, `savant-design`,
`savant-design-systems`, `savant-motion`, `startup-playbook`.

**Options.** (a) authorize me to add `version: 0.1.0` to those five SKILL.md
files — they live on the operator-only surface, so an agent write needs your
explicit authorization; (b) you will add it; (c) leave the warnings.

**Answer:** a

### Q9 — Run the operator-only learning rituals now?

**State.** `bun run lessons:to-skills`, `bun run learnings:retire` and
`bun run skills:evolve` are operator-run by design and have not run this session.

**Options.** (a) run all three; (b) name a subset; (c) skip.

**Answer:** a

### Q10 — Research API key (highest-recurrence ledger signal)

**State.** `web_search` "no results returned — add a research API key" fires
**19×** (total 22) and `read_url` "incomplete arguments" **24×** in
`dev/experiences/raw-traces.jsonl`; both are past the 3-recurrence promote
threshold. The tool message names Serper, Parallel, Tavily, Exa and Firecrawl.

**Options.** (a) you supply a key and I wire it into `.env.local`; (b) authorize
me to add one provider's free tier — you would still paste the key, since
`.env*` is operator-owned; (c) leave research degraded.

**Answer:** what is the service? The system was built to work without an api
key from day 1, so what are you talking about? need more details

**Reply (agent, 2026-10-12) — you are right, and my premise in this file was
wrong.** Research works with **zero** keys, as documented in `.env.example`:
`web_search` falls back to a keyless port (Qwant's JSON API plus DuckDuckGo's
HTML endpoint, `packages/agent-runtime/src/llm-api/keyless-search.ts`) and
`read_docs` falls back to a self-populating local SQLite docset cache. A key is
an opt-in upgrade, never a requirement.

The optional services (`.env.example:177-182`, managed in-app by
`/research-keys <service>`): Serper (`SERPER_API_KEY`), Parallel
(`PARALLEL_API_KEY`), Tavily (`TAVILY_API_KEY`), Exa (`EXA_API_KEY`), Firecrawl
(`FIRECRAWL_API_KEY`), plus Context7 (`CONTEXT7_API_KEY`) for indexed docs. Keys
are stored in `credentials.json`; a shell env var wins over the stored key.

The 19 recorded failures are **not** a missing-key signal. The message
(`llm-api/research-sources.ts:125`) is emitted only after the whole BYOK chain
*and* the keyless port both return nothing — i.e. the public endpoints answered
empty or rate-limited us. They cluster: 2026-09-19 (3) and 2026-10-05 (9 inside
five minutes). Nothing was configured wrong; a public endpoint was briefly
down or throttling.

So the real question is what you want from this line:

- (a) nothing — retry already covers a transient public-endpoint failure;
- (b) add one BYOK key (free tiers exist) for reliability and rate-limit
  headroom on the provider you like;
- (c) treat it as a defect: the keyless path is the *only* source a keyless user
  has, so its failures are user-visible, and the error text misattributes the
  cause to a missing key.

I have left the ledger line as-is rather than silently rewriting it; (a), (b) or
(c) tells me whether to reword it, wire a key, or open a repair.

### Q11 — `read_files` "incomplete arguments", **41×**

**State.** The top line of `dev/agenda.md`. It is agent-actionable — a tool
argument robustness repair — but it touches a hot path.

**Options.** (a) converge a FID and fix it; (b) fold it into the already
implemented pagination work (`FID-2026-1012-007`) as a follow-up; (c) leave it in
the ledger.

**Answer:** a

## E. Savant-Free and the gate chain

### Q12 — T122: repair the Savant-Free feature, or remove it?

**State.** Its known failing integration spans CLI, agents, common, docs and
release tooling. Disposition is operator-owned; this item is the sole reason the
aggregate `ci` leg is red on a clean machine.

**Options.** (a) repair — tell me the acceptance bar you will hold it to;
(b) remove — confirm the removal scope (CLI + agents + common + docs + release
tooling + its e2e suites); (c) freeze as documented-unstable and close the item.

**Answer:** plan to remove the savant-free flag/feature.

### Q13 — T186: two workspaces sit outside every typecheck and test chain

**State (verified live).** `package.json` registers **15** workspaces; the root
`typecheck` and `test` chains cover **13**. `savant-free` (17 tracked TS/TSX
files) and `scripts/tmux` (11 tracked TS/TSX files) have no leg and declare no
`typecheck` script.

**Options.** (a) add both legs; (b) add `scripts/tmux` only and leave
`savant-free` until Q12; (c) add neither, keep the documented coverage note;
(d) exclude both by declaration with a written rationale.

Any answer except (c) changes the fail-closed release gate battery in
`protocol.config.yaml`, which is itself your surface — see Q14.

**Answer:** considering removal of savant-free is coming, what is the correct path?

**Reply (agent, 2026-10-12) — the correct path, with the surface measured.**
Removal is far larger than the workspace folder: `savant-free/` holds 24 tracked
files (build entry `cli/build.ts`, the release bundle, a smoke test and nine e2e
suites), and **257 tracked files** outside `dev/` and `CHANGELOG.md` reference it
— `agents/savant/savant-free-*.ts` (the five free agent definitions),
`cli/src/**` (`SAVANT_FREE_MODE`, command aliases, branding, panels, binary
builders, release packaging), `common/**`, root scripts, `.env.example`,
`bunfig.toml`, docs. Ordered path:

1. One FID for the removal, naming this surface and its verification gates.
2. Remove the CLI surface first (`SAVANT_FREE_MODE` lane, `dev:savant-free`, the
   `savant-free` command aliases and their tests, branding/panels branches).
3. Delete the `agents/savant/savant-free-*.ts` definitions and their wiring in
   the agent roster and system prompt.
4. Drop the workspace from `package.json` workspaces, from
   `SYNCHRONIZED_PACKAGE_PATHS` (`savant-free/package.json` and
   `savant-free/cli/release/package.json`), and from `bun.lock`; the `ci` script
   becomes `bun run build:sdk`.
5. Delete the release-pipeline references and then `savant-free/` itself.
6. Docs last: `README*`, `AGENTS.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`,
   `WELCOME`/`knowledge.md` and `.env.example`.
7. Re-run the gates that touch the surface: `typecheck`, the affected suites,
   `version:check`, `validate:repository`, `providers:parity:check`, `lint:md`.
8. **Then** T186 step 2 — add the `scripts/tmux` leg — at which point the root
   chains cover every workspace that still exists.

Why not now: your Q5 answer puts this on your own to-do list and defers it, so
this pass only re-scoped the register. Say the word and step 1 starts.

### Q14 — May I edit `protocol.config.yaml` at all?

**State.** It carries the gate list, the hooks and the session ceiling; every
change so far was proposed as a diff and you applied it.

**Options.** (a) propose a diff, you apply (today's default); (b) authorize me to
edit it directly for gate additions only; (c) authorize full edits.

**Answer:** it's permitted but only with a fid and clear approval.

## F. Providers and routing — all automation level 1

### Q15 — T119: xKiro account access and the fourth provider's identity

**State.** xKiro acceptance needs a paid account; a possible fourth provider has
no name or URL. No purchase is authorized.

**Options.** (a) buy the xKiro plan; (b) name the fourth provider (name or URL);
(c) drop both and close the item.

**Answer:** we are not funding any providers, we test providers w/ free endpoints.
However, if i've stated to add the provider, i've already confirmed the provider
is live and real. We simply need to probe it for live lists.

### Q16 — T175: six inputs for the control-armed sweep re-run

**State.** The seam is built, the verdicts are not. Design is in archived
`FID-2026-1007-016` Loops 2 and 4. Inputs needed: (1) the operator-owned
`<provider>/<family>` control manifest — content, or delegation to me with your
review; (2) funding for the re-run; (3) ToS comfort for scaled dual-model
probing; (4) a probe budget, as a number; (5) the no-control verdict-naming
ruling; (6) a credential-epoch rotation source.

**Answer:** (1) … (2) … (3) … (4) … (5) … (6) … = need more info first.

**Reply (agent, 2026-10-12) — each input, what it is, and what it gates.**
Context: the identity sweep checks whether a gateway really serves the model it
claims. Every row is currently `inconclusive` (7/7) because a verdict needs a
*comparison*, and no comparison exists yet. Source:
`FID-2026-1007-016` Loops 2 and 4; code in `scripts/providers/`.

1. **Control manifest** — a table of `<provider>/<family>` pairs saying which
   model you *know* a given endpoint serves. The sweep then sends two probes per
   row: a same-endpoint known model (catches spoofing) and the reference model
   (catches undetectability). Without the manifest every row stays
   `inconclusive` — that is today's state. Gates: the whole verdict output.
2. **Funding** — an armed re-run makes real dual-model calls against paid
   lanes. Free endpoints may be enough if you accept identical rate limits and
   no reliability guarantee. Gates: whether the re-run can run at all.
3. **ToS comfort** — scaled dual-model probing may breach some providers'
   terms. You pick which providers are in bounds. Gates: the manifest's scope.
4. **Probe budget** — a number, passed as `--max-control-probes`. When it is
   exhausted the affected rows degrade to uncontrolled *explicitly* rather than
   silently. Gates: cost ceiling for the run.
5. **No-control verdict naming** — should "no control exists" read differently
   from "a control ran but the samples were insufficient"? Today both are
   `inconclusive`, which blurs two different facts. Cosmetic, but it is your
   vocabulary. Gates: the report wording only.
6. **Credential-epoch rotation source** — a control is admissible only within
   the credential epoch it was captured in; after a key rotation it is stale and
   the row must fall back to `inconclusive`. This needs a source of truth for
   "when did this key last change" (the `credentials.json` entry's hash or
   mtime is the obvious candidate). Gates: a small code addition plus one test.

Items 1 and 4 are what actually unblock the re-run; 5 and 6 are refinements.
Nothing here is research I can do for you — the content is operator knowledge.

### Q17 — T171: verdict gate and consent shape

**Options.** (a) stricter verdict gate that excludes `open-relay` — yes or no;
(b) consent shape: inline wizard with Enter per step, or one confirmation.

**Answer:** (a) … (b) … = no clue what this even is, are these stale?

**Reply (agent, 2026-10-12) — what it is, and whether it is stale.**

What it is: today a *harvested* provider (one the free-lane harvester discovered
but nobody wired) can only be seen in `/notifications`; there is no one-press
way to add it. The item is about letting the model picker reuse the discovery
wizard's existing prefill so selecting such a provider opens the same add-flow
inline. Design draft: `FID-2026-1008-004` Loop 4; the surface is roughly one
picker file plus one test suite, because every hard part (slug derivation,
env-var naming, reserved-id refusal, the `open-relay-reject` LLMjacking guard)
already exists in `provider-wizard-discovery.ts`.

The two rulings it needs:

- **(a) verdict gate.** Auto-wire only candidates whose standing verdict is
  `key-required` or `boundary-unverifiable`. Never `open-relay-reject` (the
  LLMjacking class), and never while `downStreak > 0`. The alternative reading is
  the looser "any candidate whose probe says up".
- **(b) consent shape.** Inline wizard with Enter-per-step (proposed, matches the
  registry-only flow already shipped) versus a single confirm dialog.

Stale? **Not stale in substance, but never implemented.** Option 1 from that FID
(registry-only auto-wire) shipped under `FID-2026-1008-005` item 3; option 2
(this one) is still design-only, and the two rulings still gate it. Your Q15
answer — free endpoints are how providers get adopted — makes it *more* relevant,
not less. I will re-derive both questions against the current picker code before
putting them to you again, so the next ask is grounded in live `file:line`
evidence rather than a 2026-10-08 draft.

### Q18 — T173: five KiosAPI window values

**State.** `gpt-oss-20b`, `claude-haiku-4-5-20251001`,
`llama-3.2-11b-vision-instruct`, `deepseek-v4-pro-0813` and `codex-auto-review`
have no fallback row and keep the conservative 200k default. A public-source
search did not establish them.

**Options.** (a) you supply the vendor-published values; (b) authorize a live
probe against the vendor API; (c) accept the 200k default permanently and close
the item.

**Answer:** always live probe

### Q19 — T62-followups: TokenHarbor and TokenRouter

**State.** TokenHarbor needs a free-cell identity re-run after its allowance
resets; TokenRouter self-identification needs a top-up.

**Options.** (a) both done — tell me when; (b) TokenHarbor only; (c) drop.

**Answer:** a

### Q20 — T147: Geaix/Excelnt key, plus a one-character `.env.example` fix

**State.** The live probe needs a gateway key; both vendors lacked active keys at
last check. Separately, `.env.example:152` cites task `T146`, which is not
registered — this register carries that work as T147. It is a one-character fix
left untaken on purpose, because every `.env*` surface is operator-owned under
`no-write-dotenv`.

**Options.** (a) here is the key; (b) authorize me to make that one-character
`.env.example` edit; (c) drop the vendor pair.

**Answer:** these were bad providers, we're not adding full support, remove.

**Reply (agent, 2026-10-12).** Register item T147 evicted and its only artifact
deleted (`scripts/providers/audit-probes/gateway-catalog-probe.ts`, a probe whose
entire vocabulary was `geaix | excelnt`). Two residues left deliberately, both
because they are operator-owned rather than because they were missed:
`.env.example:153-166` still carries the Geaix/Excelnt template block — including
the stale `T146` reference at line 152 — and the historical evidence stays in
`dev/session-summaries/2026-10-06-geaix-excelnt-probe.md`. Say the word and I
remove the `.env.example` block too (one edit), or leave it as a record of the
vendors that were rejected.

### Q21 — T164-D: who consumes the usage telemetry?

**State.** The print-mode `usage` wire member, the emission from the existing
`step.ts` hook and the host-facing `onUsage` callback are unbuilt. The governing
lesson — "a library-complete hand-off needs a named consumer, not a readiness
note" — requires a real consumer outside the eval harness. Eval billing keys and
wire-stage ratification are likewise open.

**Options.** (a) name the consumer and I build it; (b) evict the item.

**Answer:** evict

## G. T185 bloat audit — the listed targets are already gone

### Q22 — What is actually left to decide

**State (verified live just now).** `firebase-debug.log`, `database.db`,
`database.db-wal`, `database.db-shm` and the duplicate `website/index-2.html`
are **all absent**; `website/` now holds only `index.html`;
`dev/scratchpad/active/` is empty. The only live remnants are
`debug/cli.jsonl` and `debug/trace.jsonl`, which are local-only: `debug/` is
already ignored at `.gitignore:28`, so neither log can reach a release.

**Options.** (a) delete the two local logs anyway and confirm
`website/index.html` is still a live deployment target; (b) leave both, since
nothing untracked ships, and close the bloat half of T185.

**Answer:** files in website are the actual html files for the projects website,
if they are in website don't touch them.

## Z. Anything else

Questions I have not thought to ask, standing rules you want recorded for future
sessions, or a different priority order than the one above.

**Answer:**

## Appendix — what each answer unblocks

| Answer | Unblocks |
|---|---|
| Q1–Q3 | repository publication; whether I may commit without asking |
| Q4–Q5 | a clean working tree; whether `ci` may be made green |
| Q6–Q7 | four draft candidates routed or dropped; live acceptance for LF-001/002 |
| Q8–Q11 | skills warnings, learning rituals, research key, `read_files` repair |
| Q12–Q14 | Savant-Free disposition, gate-chain coverage, `protocol.config.yaml` authority |
| Q15–Q21 | seven provider and routing items |
| Q22 | the last of T185 |
