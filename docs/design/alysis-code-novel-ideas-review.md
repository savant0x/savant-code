# Alysis Code — Novel Ideas Review (2026-09-13)

> Reference record of a review of the Alysis Code codebase for ideas worth adopting into Savant.
> Reviewer: Savant (Orchestrator), session of 2026-09-13. Status: reference only — nothing adopted,
> no FIDs created from this review yet.

## Purpose and provenance

This document records the findings of a read-only review of
`resources/alysis-code-main/` (Alysis Code v0.13.7) and ranks which of its ideas are novel
relative to Savant's existing capabilities. It is an input to future FIDs, not a work queue:
each idea below would still need its own FID, Perfection Loop pass, and operator approval
before implementation.

Adoption follows the ideas-not-ports discipline (FID-2026-0804-002): anything adopted is
rebuilt on Savant's own harness (Bun + TypeScript, EHEL enforcement, ZTAP provenance) with
NOTICE attribution — no 1:1 ports, no new dependencies unless independently justified.
License audit: Alysis Code is Apache-2.0 (`LICENSE`, `NOTICE`), the same family as the
accepted MCP-reference-repo precedent; no GPL present.

The source tree is gitignored (`/resources/` in `.gitignore`) — a user-added third-party
snapshot, not part of the monorepo. Paths in this document are relative to
`resources/alysis-code-main/`.

## What Alysis Code is

Alysis Code is a Python 3.11+ CLI coding agent (`pipx install alysis-code`, packages
`src/alysis_code/`): slash commands, interactive pickers, execution modes
(`readonly`/`review`/`auto`/`fullaccess`), personas, a plan-driven Forge mode with parallel
workers, sandboxed shell execution (Docker or Bubblewrap), bundled skills, custom tools,
MCP servers, and hooks. Architecturally it is a close analog of Savant Code: same agent
shape, same mode/persona split, same verify-before-proceed instincts — which makes its
distinctive mechanics directly comparable against Savant's gaps.

## Novel ideas, ranked

| # | Idea | What alysis does | What Savant has today |
|---|------|------------------|----------------------|
| 1 | Tool-output offload to re-readable artifacts | Oversized tool outputs are written to private session artifacts; the message keeps a preview + locator plus a read tool | Compactor clears/micro-compacts tool results — the data is gone, only summarized |
| 2 | Vacuous-verifier detection | Every verify command gets a `real_execution` assessment; explicit-vs-inferred repair ladder | Law 3 mandates verification, but nothing mechanically detects a vacuous pass |
| 3 | Personas + the clamp rule | Named postures with write-scope narrowing, may lower but never raise the execution mode | Modes exist; no posture layer |
| 4 | Docker/Bubblewrap shell sandbox | OS-level isolation with network off, sanitized env, protected repo metadata | Permission modes + denylist; no container isolation |
| 5 | Prompt-injection sanitization of subagent reports | Subagent output is scanned and neutralized before reaching the parent | Subagent output is pasted into parent context raw |
| 6 | Tool-schema token budgeter | Measures tool schema token cost; strips annotation-only JSON-Schema prose from model-facing schemas | Full tool lists injected every turn, unbudgeted |
| 7 | Per-task swarm write-scope guard | Structural second write gate at the tool dispatch boundary, violations fail the task closed | EHEL gates, but no swarm-layer second gate |
| 8 | Cross-session search | Bounded, redacted search over past transcripts and offloaded outputs | Session summaries; no cross-session search |
| 9 | Importance-scored compaction | Regex-scored turn importance weights what compaction keeps | Compactor is threshold/recency-based |

## Idea details

### 1. Tool-output offload to re-readable session artifacts

`src/alysis_code/compaction/tool_output_offload.py`. When a tool result exceeds a char
threshold, alysis writes the full output to a session-scoped artifact store (file mode
`0600`, atomic write via temp file + `os.replace`, directory fsync) and replaces the
in-context payload with a compact JSON stub: a summary, a preview, the original char
count, and an `artifact_locator`. A companion `session_artifact_read` tool retrieves the
full output on demand. The stub carries explicit fallback guidance for the three cases:
locator readable, filesystem-readable path, or unreadable (re-run the command narrowed).

Hardening worth copying regardless of the feature: symlink/junction/REPARSE_POINT
rejection, `_has_safe_directory_ancestors` containment re-verification before publish,
and a fail-open degradation (offload errors become preview-only stubs, never failures).

Why it is novel: Savant's compactor clears and micro-compacts tool results, but the data
is then gone — the four-layer design trades information for budget. Offload resolves that
tension instead of accepting it. Natural fit: an extension of
`packages/agent-runtime` compaction with a read path exposed through the existing
`read_files` tooling.

### 2. Vacuous-verifier detection

`src/alysis_code/verify_gate.py`. Every verification command result is classified:
`real_execution` is true only when the command actually exercised the change. Detected
vacuous shapes include pytest exit 5 / "collected 0 items", `go test` `[no tests to
run]` / `[no test files]`, make/just "nothing to be done", npm test with zero tests
markers, non-assertive commands, and execution-layer failures (exit 126/127 plus
"command not found" markers). A vacuous pass is reported as "verified nothing", never as
success. Separately, a repair ladder handles unusable selections: explicitly requested
commands are kept with a warning (never silently substituted), inferred commands are
dropped, detection falls through to whatever runner the workspace exposes, and an empty
result degrades to a best-effort contract rather than an error. Refused commands (unsafe
pipeline, masked failure) still fail fast — the distinction is "could not classify" vs
"recognized and refused".

Why it is novel: Savant's Law 3 requires verification, and the harness warns on
unverified changes, but nothing mechanically detects a pass that proved nothing — the
exact failure mode documented in the 2026-08-09 release audit ("a gate that passed on a
pipe is not a verified gate"). Natural fit: an EHEL verification-gate extension plus a
`real_execution` field on `run_readonly_command` results.

### 3. Personas with the clamp rule

`src/alysis_code/personas.py`. Personas are named postures layered on top of execution
modes: `architect` (may write markdown plan documents only), `ask` (read-only),
`debug` (reproduce before you fix), `code` (default). The two rules that make it more
than prompt text:

- The clamp rule: a persona may lower the effective execution mode, never raise it —
  `clamp_persona_exec_mode` returns `min(persona_default, base_mode)` by permissiveness
  rank, so a persona switch can never become an escalation path.
- Write scope is enforced by the host gate, not prompt convention: the architect's
  `allow_write_globs: ("*.md", "**/*.md")` binds at the gate (a scoped persona running
  under fullaccess is deliberately pulled down to review, because fullaccess bypasses
  ordinary write scoping).

Custom personas load from `.alysis_personas/*.md` with a fail-closed loader: unknown
fields rejected, unknown exec modes fall closed to `readonly`, builtin names cannot be
shadowed, symlink/escape/size guards on files. Trust is split: builtin overlays are
trusted host-authored system context; custom persona bodies are injected at user-message
priority behind an untrusted-content prelude. The `switch_mode` tool never mutates the
live session mid-turn — an approved proposal is parked and applied by the chat loop at
turn end, with consecutive identical declines deduplicated.

Why it is novel: Savant has execution modes (HYBRID/STRICT/SCAFFOLD/ANALYZE) but no
posture layer — nothing like "architect can only write `.md`" with a host-enforced
scope. The clamp rule is the security pattern worth adopting verbatim as a design
principle. Natural fit: a data-driven axis beside `AGENT_MODES` (the rename precedent in
FID-2026-0805-001 shows a mode-axis addition is nearly free).

### 4. Docker/Bubblewrap shell sandbox

`src/alysis_code/sandbox_runner.py` (+ `sandbox_settings.py`, `sandbox_doctor.py`,
`bwrap_etc.py`). Shell commands run inside an OS-level sandbox with a `ShellRunner`
protocol with four backends: host, disabled, bwrap, docker. The hardened profile:

- Network off (`--unshare-net` / `--network none`), optional in docker.
- Sanitized, non-interactive env: "nobody is at the keyboard" is declared in one place
  (`_sanitized_env`), with env allowlisting for docker containers.
- Protected repo metadata: `.git` is bind-mounted read-only even when the workspace is
  read-write — the agent can build but cannot rewrite history from inside the sandbox.
- Docker: `--cap-drop=ALL`, `--security-opt no-new-privileges`, optional read-only
  rootfs with tmpfs `/tmp`, pids/memory/cpus limits, published ports restricted to
  loopback addresses by validation (not convention).
- Toolchain discovery: the bwrap backend walks PATH for common toolchains (node, cargo,
  go, java, nvm/fnm/volta layouts) and binds the discovered roots read-only, so the
  sandbox does not break verification.
- Process hygiene: a process-group reaping registry; docker containers get named
  best-effort forced cleanup on timeout/exception/unfinished process (killpg on the
  docker CLI does not stop the container).
- `with_closed_stdin`: automated callers (verification) run with stdin closed — a
  command that asks a question cannot block until its timeout.

Why it is novel: Savant's `permission.mode` (safe/prompt/unsafe) and the denylist are
policy-layer controls; a hostile command outside the denylist list has nothing beneath
it. The also-adoptable piece is `sandbox_doctor` — a guided diagnosis subcommand for
"why did my sandbox not start" (`alysis doctor sandbox`).

### 5. Prompt-injection sanitization of subagent reports

`src/alysis_code/safety/subagent_report.py`. Subagent output is sanitized before it
reaches the parent context: role and harness tags (`<system>`, `<user>`,
`<environment_context>`, `<skill_instructions>`, ...) are HTML-escaped so a subagent
cannot forge harness wrappers, and three high-risk phrasing families are rewritten to
typed markers (`[blocked untrusted subagent instruction_override]`, `..._permission_override]`,
`..._tool_demand]`): ignore-previous-instructions, permission escalation, and tool
demands. The sanitizer reports what it changed (`sanitized`, `detected_categories`,
`detected_tags`) instead of silently swallowing content.

Why it is novel: Savant spawns many subagents by design and their output is pasted into
parent context raw; EHEL gates the tools, not the prose. The typed-marker + detected-
category reporting is the right shape: visible, auditable, fail-open. Natural fit: a
sanitization seam in the spawn-result handling path, with the tag vocabulary derived
from Savant's own harness tags.

### 6. Tool-schema token budgeter

`src/alysis_code/context/tool_schema_budgeter.py`. Measures the token cost of every
tool schema (`estimate_tokens` over stable JSON), produces a report (total vs budget,
over-budget delta, top-N largest tools, a content signature), and compacts
model-facing custom/MCP schemas by stripping annotation-only JSON-Schema prose
(`$comment`, `description`, `title`, `examples`, `markdownDescription`) while preserving
constraint data (`enum`, `const`, `default`) and recursing correctly through named
schema maps (`properties`, `$defs`, `patternProperties`).

Why it is novel: Savant injects full tool lists every turn; with MCP servers and custom
tools this is an unbudgeted, invisible tax. A budget report also gives the `/usage`
surface something concrete to show. Natural fit: a
`packages/agent-runtime` tool-assembly seam plus a config key under `compression:`.

### 7. Per-task swarm write-scope guard

`src/alysis_code/swarm_write_guard.py`. The agent layer already guards writes, but the
swarm layer treats that as an honor system: a bug there would let a worker write
outside its task's `write_scope` and silently poison sibling tasks. So the swarm wraps
every tool dispatch (`ToolDef.run`) with a second, structural gate keyed to the task's
write scope plus run-scoped temp roots: raw `..` traversal rejected before resolution,
containment re-verified with `Path.resolve()` independently of the tool's own
resolution, writes through symlinked components rejected, case-insensitive matching on
win32. Violations are recorded as typed `WriteScopeViolation` records and fail the task
closed regardless of the agent exit code. Reads are never guarded; `shell_run` is
explicitly documented as out of path-guard scope (the sandbox profile and post-run
assessment remain its controls).

Why it is novel: Savant's EHEL gates are the single write gate; this is the defense-
in-depth analog for parallel work — a documented, typed, second gate that assumes the
first gate can be buggy. Natural fit: the Forge/subagent write path, where per-task
write scopes already exist conceptually in the FID spec.

### 8. Cross-session search

`src/alysis_code/ide/session_search.py`. Bounded, redacted search over past session
transcripts (JSONL events) and the offloaded tool-output artifacts from idea 1: limits
clamped at the boundary (100 sessions, 100 results, 2 MB/file, 16 MB total, 1,000
artifacts/session), `redact_secrets` on every snippet, results carry
`session_id`/`event_type`/`timestamp` and can be attached as provenance-tagged
`past_session` context blocks. Session ownership is filtered to the local owner and the
querying workspace.

Why it is novel: Savant keeps session summaries, but there is no way to ask "what
happened last Tuesday" and get a provenance-tagged answer. Pairs naturally with idea 1
(offloaded artifacts become searchable). Natural fit: a native read-only tool over
`dev/session-summaries/` + session state, honoring the audit-channel preservation
rules.

### 9. Importance-scored compaction

`src/alysis_code/compaction/importance.py`. Turns are scored by deterministic regex
signals — requirements/constraints language, errors/tracebacks, verification commands,
diffs/patches, file paths, code fences, shell/git commands, acceptance criteria — with
capped per-signal weights and role weighting (user > assistant > tool). The score and
its reasons (`requirements_or_constraints`, `errors_or_failures`, ...) are carried on
each `ScoredTurn`.

Why it is novel: Savant's compactor is threshold/recency-based; a scored importance
vector would let Layer 3 (AUTO) keep the constraint-bearing turns that the FID/evidence
trail depends on instead of pure recency. The "reasons" list also makes a compaction
decision auditable rather than opaque.

## Smaller ideas worth stealing

- `with_closed_stdin` (`sandbox_runner.py`): automated callers run with stdin closed, so
  verification can never block on an interactive prompt. One-line invariant, directly
  applicable to `run_readonly_command`-spawned processes.
- Workspace trust model (`extensions/workspace_trust.py`): trust entries keyed to
  SHA-256 of the canonical repo path plus the overrides-file hash, with `granted_at`.
  Trust is content-bound — changing the overrides file silently invalidates trust.
  Matches Savant's provenance instincts.
- `sandbox doctor` pattern: a guided diagnosis subcommand for sandbox startup failures,
  instead of error-message archaeology.
- OS-keyring credential storage (`keyring` dependency, `provider_auth/`): keys out of
  plaintext `credentials.json`.
- Silent legacy-alias forwarding (`sylliptor` → forwards to the canonical app, "remove
  no earlier than the next major"): a deprecation contract written as a comment.
- `notify_done_windows.py` (`builtin_hooks/`): an OS notification when a long run
  completes, wired as a hook — Savant's hook system (FID-2026-0814-003) could ship this
  as a bundled hook.
- Bundled skills inventory (`skills/bundled/`): `security-review`, `skill-creator`,
  `fix-ci`, `address-pr-comments`, `release-notes` — a checklist against Savant's
  bundled skill set.

## What Savant already has (skip)

Forge-style plan-driven execution (Savant Forge + STRICT + the FID lifecycle), the
subagent system, free web search, hooks, the compaction core, and the denylist. Alysis
also has an IDE integration surface (`ide/`), a job server (`server/`), and a plugin
manifest system (`extensions/`) — larger programs than this review scoped; revisit
separately if those directions interest the operator.

## Recommendation and adoption path

Top three for Savant, in order: (1) tool-output offload, (2) vacuous-verifier
detection, (3) personas with the clamp rule — they are harness-native fits (the
compactor, the EHEL verification gate, and the mode axis respectively) and each closes a
gap Savant has actually felt (context-vs-information loss; gates that pass vacuously; no
posture layer).

Any adoption proceeds as its own FID (filename per the `FID-YYYY-MMDD-NNN-` convention,
status `created`), rebuilt on Savant's stack per the ideas-not-ports rule, with NOTICE
attribution where warranted, and gated through the Perfection Loop before any code is
written. This document is the reference those FIDs cite; it is not itself approval.