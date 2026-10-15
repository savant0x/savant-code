# Reference review: `resources/deepseek-harness` + Pi harness (T148)

**Date:** 2026-10-06
**Operator directive (verbatim):** "i want you to review a few resources. Take
a very deep look at this - see if there are any ideas we can get from it" +
"also pi harness".
**Method:** read-only review of the vendored trees' governance and docs
surfaces (AGENTS.md, architecture/testing/notes/snapshots docs, skill index,
package manifests, READMEs, gate-script inventory, extension presets).
Every claim cites the reference path. This report extracts **ideas for
Savant-Code**; adopting any idea becomes its own registered item.

---

## The projects

### DeepSeek Harness (`resources/deepseek-harness`)

Open-source agent harness by DeepSeek AI ("dsh"), developer preview, MIT.
Everything-is-a-plugin on the Cordis framework ("A Programming Paradigm for
Spatiotemporal Composability"); the model adapter, tool registry, session
log, and agent loop are all plugins (`docs/architecture.md`). Shape:

- `apps/` cli, desktop (Electron), desktop-host, web; `native/` node addon;
  `python/` second SDK; `benchmarks/` perf gates; `snapshots/`
  recorded-session tests; `vendor/` pinned Cordis source; `website/`
  VitePress docs projection.
- `packages/`: 50+ workspaces incl. core/{session,agent,agent-loop,tools,
  system-prompt,scope}, llm, shell, subprocess, ssh, terminal, sandbox,
  compaction, context, subagent, jobs, workflow, webhook, todo, plan, goal,
  schedule, preset, guard, extensions, hooks, session-query, spill,
  deliverables, typert, credentials, identity, telemetry, test-support.
- Governance: 20 KB `AGENTS.md` (~40 hard rules), `docs/` 24 MB with
  bilingual `.md`/`.zh.md`/`.i18n.yaml` triples, `.agents/notes/` decision
  records, `.agents/skills/` 15 agent skills, every `scripts/*.ts` gate
  paired with a `.spec.ts`.

### Pi (`resources/pi-main`, `resources/pi-ralph`)

Pi agent harness (earendil-works / badlogic — Mario Zechner), MIT. Packages:
agent, ai (unified multi-provider LLM API), chord (composition runtime with
services, replicated state, RPC, plugins), coding-agent, client, server,
session-backends, protocol, telemetry, tui (differential rendering), evals.
`pi-ralph` is a pi extension for hat-based multi-agent orchestration loops
(YAML presets of roles handing off via events). Pi's stance is the deliberate
inverse of dsh's in one place: **no built-in permissions** — isolation is
documented as containerization patterns (`packages/coding-agent/docs/
containerization.md`: Gondolin micro-VM, Docker, OpenShell).

---

## Ranked ideas for Savant-Code

### 1. Keyless recorded-session snapshot tier — HIGH

**Evidence:** `docs/testing.md` §Tiers/§"When a snapshot test is required";
`snapshots/AGENTS.md`.
Recorded agent sessions (JSONL) are simultaneously test **input** and
**expected persisted output**: replay drives user input and model responses
through the shipped profile and compares the resulting session. Every
non-trivial model/protocol/human-visible change updates a scenario **in the
same PR**. Mutating scenarios commit a complete `workspace.expected/` tree as
an independent oracle — "Model prose and tool-result text do not prove the
external effect." Volatile identities become typed relationship-preserving
tokens; `record` vs `refresh` are distinct operations, all diffs reviewed.
**Savant today:** savant-free e2e + evals v2; no transcript-replay tier, so
agent-runtime loop/prompt changes are only covered by unit tests and live
smokes.
**Adopt:** a `dev/snapshots/`-style replay tier for `packages/agent-runtime`
(a recorded turn JSONL → replay → compare committed run-state), starting with
one scenario per tool family. Natural home for the "green unit tests, broken
product" class our e2e gaps keep exposing.

### 2. Supply-chain hardening program — HIGH

**Evidence:** `resources/pi-main/README.md` §"Supply-chain hardening";
`resources/pi-main/AGENTS.md` §"Dependency and Install Security".
Exact-pinned direct dependencies; `.npmrc` `save-exact=true` +
`min-release-age=2`; lockfile as dependency ground truth with a pre-commit
block on lockfile commits (escape hatch `PI_ALLOW_LOCKFILE_CHANGE=1`); the
published CLI ships an `npm-shrinkwrap.json` pinning transitive deps; an
explicit allowlist for dependency lifecycle scripts (`--ignore-scripts`
everywhere, new script-bearing deps fail checks until reviewed); scheduled
`npm audit --omit=dev` + `npm audit signatures`; release smoke tests that
install the packed artifact into isolated npm and Bun installs before
tagging.
**Savant today:** we publish `@savant-code/sdk` + CLI release binaries; our
pre-push gate scans credentials but dependency supply chain is ad hoc.
**Adopt:** pin policy + lockfile-commit guard + lifecycle-script allowlist +
release-time isolated-install smoke (`sdk` already has verify scripts — add
the pack-and-install leg).

### 3. "Model-visible ⟺ logged" + versioned session-format migrations — HIGH

**Evidence:** `docs/architecture.md` §Session log; `AGENTS.md` §"Pre-stable
APIs and released Session data"; `docs/session-format-status.md`;
`docs/persistence-catalog.md`.
Rule: anything that reaches a model request must be reconstructable from the
session log; a new model-visible input requires a session event. The log is
the source of truth (`deriveMessages()` projects history from it), with
failed attempts retained without polluting model history. Session formats
are **versioned generations** (`session.vN.jsonl`), adjacent migration
packages each own exactly one `vN→vN+1` step, committed generations are
never renamed/replaced/deleted, unknown future versions are refused, and
`SessionEventMap` members are required-on-read — builds that don't know a
type refuse the log unless the event declares `ignorable: true`.
**Savant today:** run-state storage + ZTAP provenance receipts; no format
versioning contract, so storage-shape changes rely on convention.
**Adopt:** a `SESSION_FORMAT_VERSION` constant + required-on-read policy +
one-migration-per-step rule before the desktop/SDK session surfaces harden
around today's implicit format.

### 4. Multi-session git safety rules (sharpen G4) — HIGH

**Evidence:** `resources/pi-main/AGENTS.md` §Git.
Assumes **multiple agent sessions share one cwd concurrently**: stage
explicit paths only (never `git add -A`/`.`), verify `git status` before
committing, never run `reset --hard`, `checkout .`, `clean -fd`, `stash`, or
`commit --no-verify`, resolve rebase conflicts **only in files you modified**
(abort and ask otherwise), never force-push. Lockfile changes need an
explicit env-var opt-in to commit.
**Savant today:** G4 mandates path-scoped staging; the concurrent-session
model, the conflict rule, and the explicit forbidden-command list are not
spelled out.
**Adopt:** add the forbidden-command table + "conflicts only in your files"
rule to the G-laws in `ECHO.md`, plus the lockfile/stamp guard once idea 2
lands.

### 5. Gate discipline: "a guard only guards if the regression fails it" — HIGH

**Evidence:** `resources/deepseek-harness/docs/testing.md` §"Test the real
entry path", §"Verify the world, not the self-report", §"Prefer the real
implementation over a mock".
Three rules worth adopting verbatim: (a) prove every guard by introducing
the regression, watching the gate go red, then reverting; (b) e2e assertions
re-run the command or re-read the file externally — "a keyword probe on the
agent's own output lets a cheating agent pass" — and assert untouched files
are byte-identical; (c) mocks stop at the outermost expensive/nondeterministic
boundary (LLM adapter, network, clock) — their bridge harness mounts the
real loop, session store, tool registry, and JSONL persistence behind one
`MockAdapter`.
**Savant today:** Honest Assessment requires tool-output evidence, and
dependency injection is our convention; the regression-proving ritual and the
byte-identical-untouched-files assertion are not standard.
**Adopt:** fold (a)+(b) into `dev/echo-v0.1.2-single-agent.md` Double Audit
and the savant-free e2e assertions; (c) into the agent-runtime test guidance.

### 6. Agent Notes: durable decision-rationale records — MEDIUM-HIGH

**Evidence:** `resources/deepseek-harness/.agents/notes/README.md` (+
`scripts/verify-agent-note-format.ts`, `scripts/agent-note-tree.ts`,
`scripts/archived-agent-notes.ts`).
A second record class beside work items: `{lifecycle}/{class}/yyyy-mm-dd-
topic.md` with lifecycle folders `proposed/` → `implemented/`/`rejected/`
and a **permanently frozen** `archived/` tree; a closed class set
(feature/bug-fix/simplification/architecture/process/testing — `refactor`
deliberately absent); a mandated `## Alternatives considered` section ("a
decision recorded without what it beat invites re-litigation"); format
gates that reject proposal-era headings in implemented notes; consolidation
rules for superseded notes; bilingual triplets.
**Savant today:** FIDs track work items and `dev/LEARNINGS.md` tracks
lessons; design rationale lives loosely in `docs/design/` and FID text.
**Adopt:** a `dev/notes/` (or `docs/decisions/`) lightweight ADR class with
the mandatory-alternatives rule; start with the format + naming, defer the
bilingual/gate machinery.

### 7. Coverage philosophy: per-file 100%, uncovered = dead code — MEDIUM

**Evidence:** `resources/deepseek-harness/docs/testing.md` §Coverage gate;
`AGENTS.md` (`test:coverage` is *the* CI coverage gate, not `test`).
Per-file 100% on package `src`, with the stated interpretation: "An
uncovered line is often dead code the gate flags for deletion, not a missing
test to bolt on. Line coverage is necessary, never sufficient." Targeted
exemptions are enumerated files (`coverage-exempt.ts`), self-skipping suites
document why (pwsh-less hosts).
**Savant today:** `testing.coverage_threshold: 80` is advisory (ECHO-3);
no per-file gate.
**Adopt:** per-file gate on the highest-value package first
(`packages/agent-runtime`), with an explicit exemption list.

### 8. Orchestration presets with guard rails (pi-ralph) — MEDIUM

**Evidence:** `resources/pi-ralph/README.md`.
Hat-based loops: YAML presets name role pipelines (e.g. `spec-driven`:
Spec Writer → Critic → Implementer → Verifier; `debug`: Investigator →
Tester → Fixer → Verifier), roles hand off via a published event protocol,
with guard rails (max iterations, max runtime, completion promises),
session-persisted loop state, and history modals. A PDD ("Prompt-Driven
Development") planning mode turns rough ideas into designs first.
**Savant today:** the ECHO roster is fixed and the Perfection Loop is
protocol-enforced; no user-selectable workflow presets.
**Adopt:** declarative preset files mapping our 10 roles to named pipelines
(`/loop spec-driven …`), reusing transition-phase + circuit-breaker as the
guard rails. Also: the debug preset's hypothesis-test loop is a good shape
for our Detective→Verifier flow.

### 9. i18n pairing gate + doc budgets — MEDIUM

**Evidence:** `resources/deepseek-harness/lefthook.yml` (translation-pairing
job); `docs/AGENTS.md` conventions in root `AGENTS.md` ("Current-state prose,
one physical line per paragraph, one home per fact, and word budgets");
`dsh-translate-docs` skill; `.i18n.yaml` sidecars.
Docs carry per-language counterparts with machine-checked pairing
(`verify-translation-pairing`), sidecar YAMLs hold translation state, a
`verify-doc-budgets` gate caps doc size per file, and prose rules are
mechanical (banned words, no metaphors, exact terms over "shape"/"boundary"
slop).
**Savant today:** `README.zh-CN.md` is hand-maintained; `lint:md` checks
format only.
**Adopt:** a pairing check for `README.md`/`README.zh-CN.md` (drift when one
side changes), then a doc-budget ceiling for `dev/` records.

### 10. Benchmarks as required PR gates — MEDIUM

**Evidence:** `resources/deepseek-harness/AGENTS.md` (`test:bench`);
`docs/testing.md` §Performance benchmarks; `BENCHMARK.md`;
`resources/pi-main/README.md` (`build:offline`, release smokes).
Synthetic inputs enforce **time, heap, and scaling budgets** on user paths;
timed code runs under plain Node (never a loader); the lane is a required
Linux PR gate; package-local perf tests stay diagnostic.
**Savant today:** no performance gates; provider/token work has surfaced
budget-middleware and re-count findings (T113 O2/O3) with nothing pinning
regressions.
**Adopt:** start with one benchmark lane for `packages/agent-runtime` turn
latency + `packages/knowledge-graph` refresh cost.

### 11. Small modules worth cloning: guard / spill / deliverables / session-query — MEDIUM

**Evidence:** `resources/deepseek-harness/AGENTS.md` repository-layout
comments (`guard/` loop/tool guards, `spill/` output spill, `deliverables/`
turn deliverables, `session-query/` browsing/search/export,
`extensions/` runtime self-modification).
Four crisp module boundaries we partially reinvent: loop/tool **guards** as
a standalone seam (our circuit breaker lives in provider policy); output
**spill** contracts for oversized tool results (our micro-compact handles
the symptom); per-turn **deliverables** (structured turn outputs — feeds our
session summaries); session **search/export** (we grep JSONL ad hoc).
**Adopt:** one at a time, driven by need — `spill` first (it composes with
our compression config).

### 12. PR-scoped gate selection + tested gate scripts — MEDIUM

**Evidence:** `resources/deepseek-harness/AGENTS.md` ("Never default to the
full suite or repeat a passing check… Match evidence to the surface");
`scripts/change-scope.ts`; every `scripts/*.ts` ships a paired `.spec.ts`.
Gates are themselves unit-tested, and the gate runner selects lanes by
change scope. **Savant today:** `bun run typecheck` chains all 13 workspaces
every time and our gate scripts are untested.
**Adopt:** scope-aware gate selection in `protocol.config.yaml` tooling;
add specs for `scripts/validate-repository.ts` first.

### 13. Skills as named, referenced procedures — LOW-MEDIUM (validation + pickup)

**Evidence:** `resources/deepseek-harness/.agents/skills/` (15 skills incl.
`dsh-pre-push-checks`, `dsh-prose-standard`, `dsh-trim-cot-leakage`,
`dsh-speed-up-perf`, `dsh-find-simplifications`, `agent-experience`);
`resources/pi-main/AGENTS.md` (`.pi/skills/release.md`,
`.pi/skills/interactive-testing.md`).
Both projects route recurring procedures through skill files that rules
reference by name. This validates our `.agents/skills/` direction. Pickups:
`dsh-trim-cot-leakage` (keep reasoning out of commits/PR text — relevant to
our CHANGELOG/session prose), `dsh-find-simplifications` (a standing
simplification review class — matches our `simplification` idea space), and
the practice of testing interactive TUI flows via tmux (pi's
`interactive-testing` skill mirrors our tmux convention).

### 14. Release discipline details — LOW-MEDIUM

**Evidence:** `resources/pi-main/AGENTS.md` §Releasing/§Changelog; `resources/deepseek-harness/AGENTS.md` §upgrade guides.
Per-package changelogs with immutable released sections; generated files
(`models.generated.ts`) may never be hand-edited (generator owns them) and
their diffs are always committable; every externally perceptible breaking
change ships an upgrade guide via a named skill; `build:offline` separates
network-refreshing generation from builds.
**Savant today:** single CHANGELOG + release scripts with callout checks
(T94). **Adopt:** the "never hand-edit generated files" rule for our
generated provider docs (the generator exists; the rule should be written
down), and upgrade notes for SDK-breaking releases.

### 15. Cross-cutting observations (no action proposed)

- **Agent Teams** (`docs/architecture.md` §capability seams; experimental):
  durable roster + task board + mailbox over continuable subagents — a
  possible evolution of our inter-agent messaging (FID-2026-1005-001).
- **Telemetry conformance** (`pi-telemetry`: vendor-neutral contracts +
  conformance tests) — a pattern if our telemetry grows backends.
- **Cordis plugin tree / profiles+patch layers** — powerful but a rewrite,
  not an adoption; our registry + agent roster already play this role.
- **OSS session sharing** (pi publishes real sessions to HuggingFace) —
  interesting evals-corpus idea, privacy-sensitive for us.

## Overlap with prior reference work (do not re-do)

T138–T142 (from the earlier `resources/` review) already landed skill-eval
gates, failure classification + circuit breaker, bounded stream recovery,
availability verdicts + quota states, and evidence-classed provider facts.
None of the ideas above duplicate those.

## Verification limits

Not read in full: `docs/defensive-patterns.md`, `docs/capability-seams.md`,
`docs/agent-lifecycle.md`, package internals, `benchmarks/` bodies,
`dsh-trim-cot-leakage` body, pi package sources and `pi-ralph` sources,
`.i18n.yaml` contract details. Findings above cite the surfaces read; idea
ranks are judgment, not measurement. No files outside
`dev/session-summaries/`, `SCOPE.md` were touched.
