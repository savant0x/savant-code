# OpenSpec Deep Audit Report

**Date:** 2026-08-09
**Repo:** Fission-AI/OpenSpec (v1.6.0)
**Auditor:** Nova (Hermes subagent)
**Scope:** Full source-level review of CLI, validation, archive workflow, spec delta format, and ECHO-relevant patterns.

---

## Executive Summary

OpenSpec is a well-engineered, production-grade CLI for "AI-native spec-driven development." It provides a structured workflow for creating change proposals, validating them, and archiving them into a living specification. The codebase is mature (~50k lines of TypeScript), has comprehensive test coverage, and a clearly defined agent contract for machine-readable output.

**Overall Assessment: Strong with identified gaps.** The tool is well-designed for its stated purpose. However, several areas would need adaptation or extension for Savant/ECHO integration: no enforcement hooks, no agent identity binding, weak audit trails, and limited automation guardrails.

---

## 1. CLI Architecture

### 1.1 Entry Point & Command Structure
**File:** `src/cli/index.ts`

- Uses Commander.js for CLI framework
- Clean separation: root commands (`list`, `validate`, `show`, `archive`) plus nested groups (`change`, `spec`, `store`, `config`, `schema`, `context`, `workset`)
- Agent-aware: `--json` flag is first-class, producing one JSON document per invocation on stdout (human prose goes to stderr)
- Deprecation pattern: old noun-based commands (`openspec change list`) emit warnings; verb-first commands preferred
- Hidden options (`--store-path`) registered deliberately so users get a targeted rejection message instead of a generic unknown-option error

**Strengths:**
- Consistent error envelope: every `--json` failure produces `{ status: [diagnostic] }` with an exit code
- Store selection is a global concern: root resolution follows a clear 5-step precedence (store flag → nearest → declared → global default → implicit)
- Telemetry is opt-in with first-run notice

**Weaknesses:**
- No plugin architecture: all commands are hardcoded in `src/cli/index.ts`
- No middleware/hook system for third-party extensions (e.g., pre-archive hooks, custom validators)
- Commander.js limitations: no way to add commands dynamically at runtime

### 1.2 Command Inventory
The CLI exposes these commands:
- `init` — scaffold OpenSpec in a project
- `update` — regenerate instruction files for AI tools
- `list` — list changes or specs
- `show` — display a change or spec (JSON or markdown)
- `validate` — validate changes or specs
- `archive` — merge deltas into main specs, move to archive
- `new change` — create a new change directory
- `status` — artifact completion status for a change
- `instructions` — generate AI instructions for an artifact
- `templates` / `schemas` — inspect workflow definitions
- `feedback` — submit feedback
- `completion` — shell completions (bash/zsh/fish/powershell)
- `store` — manage stores (git-backed shared spec repos)
- `config` — global config (profiles, default store)
- `schema` — init/fork/validate/which schemas
- `doctor` — health checks
- `context` — VS Code workspace integration
- `workset` — working set management

---

## 2. Validation Logic

### 2.1 Validator Architecture
**File:** `src/core/validation/validator.ts`

The `Validator` class is the central validation engine. It operates in two modes:
- **Normal mode:** errors block archive, warnings are informational
- **Strict mode:** errors AND warnings block archive

**Validation layers:**
1. **Schema validation** (Zod): structural shape checks via `SpecSchema` and `ChangeSchema`
2. **Imperative rules** (custom): semantic checks not expressible in Zod

### 2.2 Spec Validation (`validateSpec`)
Checks applied to `openspec/specs/<capability>/spec.md`:
- **Structure:** No delta headers (`## ADDED Requirements`, etc.) in main specs (these truncate the Requirements section)
- **Structure:** No `### Requirement:` headers outside `## Requirements` (they're invisible to the parser)
- **Purpose:** Must exist, minimum 50 characters
- **Requirements:** At least one required
- **Scenarios:** Each requirement must have at least one `#### Scenario:` block
- **SHALL/MUST:** Body text must contain RFC 2119 keywords; keyword in header only gets a targeted fix hint
- **Requirement text length:** Warns if >500 characters

### 2.3 Change Delta Validation (`validateChangeDeltaSpecs`)
This is the most complex validation path. Checks:
- **Delta presence:** At least one delta across all files (unless `skip_specs` marker is set)
- **Root-level spec guard:** `specs/spec.md` at the root is rejected (would be silently dropped during merge)
- **Section completeness:** `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` headers must have at least one requirement
- **Skipped headers:** Non-canonical `###` headers (like `### Documentation Requirements`) are surfaced as INFO
- **Duplicate detection:** Within-section duplicate requirement names
- **Cross-section conflicts:** Same requirement in both MODIFIED+REMOVED, ADDED+REMOVED, MODIFIED+ADDED
- **RENAMED interplay:** MODIFIED must reference the new header; RENAMED TO cannot collide with ADDED; RENAMED FROM cannot be in REMOVED
- **skip_specs marker:** `.openspec.yaml` with `skip_specs: true` is honored only if valid metadata; conflict if files exist under `specs/`
- **ADDED/MODIFIED:** Each must have SHALL/MUST keyword and at least one scenario
- **REMOVED:** Names only, no scenarios required

### 2.4 Validation Constants
**File:** `src/core/validation/constants.ts`
- `MIN_PURPOSE_LENGTH`: 50 characters
- `MAX_REQUIREMENT_TEXT_LENGTH`: 500 characters
- `MAX_DELTAS_PER_CHANGE`: 10 (suggestion, not hard block)
- Validation messages include guidance snippets (e.g., `GUIDE_NO_DELTAS`) with remediation steps

### 2.5 Validation Gaps

**Missing from validation:**
1. **No cross-change conflict detection:** Two changes can both modify the same requirement, and validation won't catch it until archive time (when the later one fails to apply)
2. **No spec-version tracking:** When a change modifies a requirement, there's no check that the delta targets the current version (stale deltas are silently accepted until archive)
3. **No referential integrity:** REMOVED/RENAMED operations don't validate that the target requirement actually exists in the main spec — this is deferred to archive time
4. **No semantic validation:** SHALL/MUST presence is checked, but the scenario structure (WHEN/THEN) is not parsed or validated — any `#### Scenario:` block passes
5. **No max-scenario-count guard:** A requirement can have arbitrarily many scenarios without warning
6. **Delta description minimum is only 10 characters** (`MIN_DELTA_DESCRIPTION_LENGTH`) — not enforced at schema level, only as a WARNING

---

## 3. Spec Delta Format

### 3.1 Delta Structure
Delta specs live under `openspec/changes/<change-name>/specs/<capability>/spec.md` and use four section types:

```markdown
## ADDED Requirements
### Requirement: <Name>
The system SHALL...
#### Scenario: <Name>
- WHEN ...
- THEN ...

## MODIFIED Requirements
### Requirement: <Name>
[Full replacement of the requirement body]

## REMOVED Requirements
### Requirement: <Name>
(Names only, no body needed)

## RENAMED Requirements
- FROM: `### Requirement: Old Name`
- TO: `### Requirement: New Name`
```

### 3.2 Delta Parser
**File:** `src/core/parsers/requirement-blocks.ts`

The `parseDeltaSpec()` function:
1. Splits content into top-level `##` sections
2. Case-insensitive matching for section headers
3. Parses `### Requirement:` blocks within ADDED/MODIFIED sections
4. Parses bullet-list or header-list format for REMOVED
5. Parses FROM/TO pairs for RENAMED
6. Tracks skipped (non-canonical) headers for INFO reporting
7. Code fence aware: content inside fenced blocks is ignored for structural parsing

### 3.3 Delta Application (`specs-apply.ts`)
**File:** `src/core/specs-apply.ts`

The `buildUpdatedSpec()` function applies deltas in order: RENAMED → REMOVED → MODIFIED → ADDED.

**Key behaviors:**
- **Idempotent operations:** If a REMOVED requirement is already gone (early-sync pattern), it's a no-op with a warning, not an error
- **Near-miss detection:** Case/whitespace variants of REMOVED names that still exist are rejected with a targeted error
- **MODIFIED scenario preservation:** Throws if the modified block drops scenarios that exist in the current spec (prevents silent data loss)
- **ADDED deduplication:** If an ADDED requirement already exists with identical content, it's a no-op
- **Purpose carry-over:** New specs inherit the delta's `## Purpose` section if present and readable
- **Order preservation:** Rebuilt specs maintain the original requirement ordering, appending new additions at the end
- **Cross-section conflict detection:** Validates no requirement appears in multiple operation sections
- **RENAMED+MODIFIED interaction:** MODIFIED must reference the new (renamed) header

### 3.4 Delta Format Weaknesses

1. **No conflict resolution for overlapping changes:** If two changes both MODIFY the same requirement, the second archive will fail at apply time with a cryptic "already exists" or "header mismatch" error
2. **No conflict resolution for overlapping REMOVED:** Two changes removing the same requirement — first succeeds, second warns (already gone). This is handled, but inconsistently with MODIFIED
3. **MODIFIED requires full body replacement:** There's no "patch" format — you must rewrite the entire requirement including scenarios you're not changing. This is error-prone and leads to accidental scenario drops (the validator catches this, but it's a friction point)
4. **No validation of MODIFIED matching the current spec:** A MODIFIED block that targets a requirement name but has completely different content is accepted — the validator doesn't check semantic overlap
5. **REMOVED uses simple name matching:** Whitespace/case differences cause near-miss errors, but the fold function only normalizes case and interior whitespace, not punctuation or markdown formatting
6. **No atomicity guarantee:** If archive applies 5 delta specs and fails on the 3rd, the first 2 are already written. The validator runs before writes, but the build-then-validate-then-write pattern means a validation failure on spec #3 aborts cleanly — however, a write failure mid-way could leave partial state

---

## 4. Archive Workflow

### 4.1 Archive Process
**File:** `src/core/archive.ts`

The `ArchiveCommand.execute()` flow:

1. **Root resolution** — resolves the OpenSpec root (store or local)
2. **Change selection** — interactive prompt or CLI argument
3. **Validation** — runs `validateChangeDeltaSpecs` on the change
4. **Task progress check** — reads `tasks.md` and warns on incomplete tasks
5. **Spec updates** — `findSpecUpdates` discovers delta specs, `buildUpdatedSpec` applies each, `validateSpecContent` validates rebuilt specs, then `writeUpdatedSpec` writes
6. **Archive move** — `moveDirectory` moves change folder to `archive/YYYY-MM-DD-<name>/`

### 4.2 Archive Safety Properties

**Good:**
- Validation runs before any writes
- Rebuilt specs are validated before being written (prevents writing invalid specs)
- All-or-nothing: if any rebuilt spec fails validation, no files are changed
- `--no-validate` requires `--yes` or interactive confirmation
- Archive target existence is checked (no silent overwrites)
- Incomplete tasks produce a warning but don't block (with `--yes` flag)
- Windows EPERM/EXDEV handled with copy+remove fallback

**Concerning:**
- **No atomicity across spec writes:** If spec A is written but spec B fails, spec A stays written. The comment says "No files were changed" on validation failure, but a write failure after validation would leave partial state
- **Date prefix dedup:** Archive uses `YYYY-MM-DD-` prefix; if a change already has one, it's kept. But if two changes with the same name are archived on different days, they'd collide (the archive check catches this)
- **Spec sync is optional:** `--skip-specs` allows archiving without updating main specs. This means specs can drift from implementation. The `skip_specs` marker in `.openspec.yaml` is the intended path for tooling-only changes, but there's no enforcement that the marker is accurate
- **No rollback mechanism:** Once archived, there's no `unarchive` command. The archive folder must be manually moved back and specs manually reverted

### 4.3 Archive JSON Contract
```json
{
  "archive": {
    "change": "add-dark-mode",
    "archivedAs": "2026-08-09-add-dark-mode",
    "path": "/abs/path",
    "specsUpdated": true,
    "totals": { "added": 3, "modified": 1, "removed": 0, "renamed": 0 },
    "warnings": ["..."]
  },
  "root": { "path": "...", "source": "store", "store_id": "..." }
}
```

### 4.4 Archive Weaknesses

1. **No pre-archive spec sync check:** The archive validates the change's deltas but doesn't check if the main spec has changed since the delta was written. A stale delta that applied cleanly when written might conflict with a spec that was updated by another change's archive
2. **No change-apply ordering:** When archiving multiple changes that touch the same spec, the order matters but isn't enforced
3. **No post-archive verification:** After archiving, there's no automatic re-validation of the updated main specs
4. **Task progress is informational only:** Incomplete tasks don't block archive (only warn), which means changes can be archived with unfinished work

---

## 5. Agent Integration & ECHO-Relevant Patterns

### 5.1 Agent Contract
**File:** `docs/agent-contract.md`

OpenSpec has a formal agent contract that specifies:
- One JSON document per `--json` invocation
- Diagnostic envelope shape (`severity`, `code`, `message`, `target`, `fix`)
- Exit codes: 0 for success, 1 for failure, 130 for prompt cancellation
- Machine-readable shapes for every command
- Known inconsistencies documented (snake_case vs camelCase, deprecated forms)

**Strengths:**
- Comprehensive: covers 12+ command shapes
- Practical: includes diagnostic codes for every error path
- Honest: documents known inconsistencies rather than hiding them
- The hidden `--store-path` option pattern is clever — prevents generic "unknown option" errors

**Gaps for ECHO:**
- No agent identity binding: nothing in the contract ties a change to a specific agent or session
- No authorization model: any agent with CLI access can create/modify/archive changes
- No audit trail: changes don't record who created them or when (the `.openspec.yaml` metadata is minimal)
- No provenance: no way to trace a requirement back to the agent that wrote it

### 5.2 AI Tool Integration
**File:** `src/core/config.ts` and `src/core/command-generation/`

OpenSpec generates instruction files for 25+ AI tools (Claude, Cursor, Copilot, Gemini, etc.) via adapter classes. Each adapter defines:
- Tool name and file paths
- Instructions file format
- Reference patterns

**Relevance to ECHO:**
- The adapter pattern is extensible — a Savant adapter could be written
- Instructions are static files, not dynamic — no way to inject runtime context
- No hooks for tool-specific enforcement (e.g., "don't let Cursor archive without validation")

### 5.3 Store System
**Files:** `src/core/store/`

The store system enables shared spec repositories:
- Git-backed stores with remote tracking
- Registry-based discovery (`~/.openspec/stores/registry.yaml`)
- Identity verification (store metadata must match registry)
- Drift detection (ahead/behind counts)
- File locking for concurrent access

**Relevance to ECHO:**
- Store provides a basic shared state mechanism, but no write-level access control
- Git integration enables audit via git log, but OpenSpec doesn't expose this
- No concept of "approval gates" — any user with write access to the store can archive

### 5.4 Skills System
**Directory:** `skills/`

OpenSpec ships 12 skill files for AI agents:
- `openspec-new-change`, `openspec-propose`, `openspec-apply-change`
- `openspec-archive-change`, `openspec-bulk-archive-change`
- `openspec-verify-change`, `openspec-explore`, `openspec-onboard`
- `openspec-continue-change`, `openspec-ff-change`, `openspec-update-change`
- `openspec-sync-specs`

**ECHO Relevance:**
- Skills define agent behavior, not enforcement
- Skills reference "AskUserQuestion tool" and "Bash(openspec:*)" — tool-specific, not universal
- Skills encode best practices but don't prevent bad behavior

### 5.5 ECHO Pattern Assessment

| ECHO Principle | OpenSpec Support | Gap |
|---|---|---|
| **Agent Identity** | None | No binding between agent and change |
| **Enforcement** | Validation only | No runtime hooks, no pre/post-action gates |
| **Separation of Duties** | Implicit (validation before archive) | No role-based access, no multi-party approval |
| **Audit Trail** | Git history only | No structured audit log, no provenance tracking |
| **Provenance** | None | Can't trace requirements to their author |
| **Versioning** | Metadata `version: "1.0.0"` | No semantic versioning of specs |
| **Conflict Detection** | Cross-section only | No cross-change conflict detection |

---

## 6. Weaknesses & Gaps

### 6.1 Critical Gaps

1. **No cross-change conflict detection:** Two changes can silently produce conflicting deltas for the same requirement. The conflict only surfaces at archive time when the second change fails to apply. This is the most significant gap for team workflows.

2. **No atomic archive:** Writing multiple spec files is not atomic. A failure midway through spec writes can leave the system in a partially-updated state.

3. **No rollback:** There's no way to undo an archive. If a bad change is archived, manual intervention is required to restore specs and move the archive folder back.

4. **No agent attribution:** Changes don't record who (human or agent) created or modified them. This is a fundamental gap for any multi-agent workflow.

### 6.2 Moderate Gaps

5. **MODIFIED requires full-body replacement:** The delta format has no patch syntax. Authors must rewrite entire requirements including unchanged scenarios, leading to accidental data loss (the validator catches this at archive time, but it's a friction point during authoring).

6. **No spec staleness detection:** Delta specs don't capture which version of the main spec they were written against. A delta written against spec v1 might conflict with spec v2 after another change was archived.

7. **Weak scenario validation:** Only checks for presence (`#### Scenario:` header), not structure (WHEN/THEN keywords). A scenario can be any prose.

8. **No max-deltas enforcement:** The `MAX_DELTAS_PER_CHANGE` constant (10) is only a suggestion in the validation messages, not enforced in the schema.

9. **Archive task completeness is informational only:** Incomplete tasks don't block archive. For team workflows, this could lead to premature archiving.

10. **No post-archive verification:** After writing updated specs, there's no automatic re-validation to confirm the written content is valid.

### 6.3 Minor Issues

11. **Inconsistent key casing:** snake_case in store/doctor payloads vs camelCase in workflow payloads. Documented but not resolved.

12. **Deprecated commands still emit payloads:** Old noun-form commands (`change list`, `spec show`) produce different JSON shapes without `root`/`status` keys.

13. **No telemetry opt-out beyond first-run notice:** Telemetry is tracked per command; there's no global `--no-telemetry` flag (though `NO_TELEGRAM` env var exists).

14. **`schemas`/`templates` ignore root selection:** These commands are cwd-based and don't respect `--store`, which could confuse users in multi-store setups.

15. **Store registry locking is file-based:** Uses `.lock` files, which can be left behind if the process crashes. No stale lock detection or timeout.

### 6.4 What Works Well

- **Delta format design:** The ADDED/MODIFIED/REMOVED/RENAMED sections are well-thought-out and handle most cases correctly
- **Idempotent operations:** REMOVED and ADDED operations handle already-applied state gracefully
- **Near-miss detection:** Case/whitespace variant detection prevents silent mismatches
- **Agent contract:** Comprehensive, honest about inconsistencies, practical for integration
- **Cross-platform support:** Windows EPERM handling, path normalization, code fence awareness
- **Validation guidance:** Error messages include actionable fix instructions
- **Store system:** Git-backed shared state with identity verification and drift detection
- **Skill system:** Well-structured agent instructions with clear guardrails
- **Artifact graph:** Schema-driven dependency resolution with status tracking

---

## 7. Recommendations for Savant/ECHO Integration

### 7.1 If Adopting OpenSpec as-is
- Write a Savant adapter for command generation
- Add agent identity to `.openspec.yaml` metadata (custom field)
- Use git history as the audit trail (commit messages should include agent ID)
- Run `openspec validate --strict` as a pre-archive gate in agent workflows
- Use `--json` mode exclusively for agent interactions

### 7.2 If Forking for ECHO
Priority additions:
1. **Agent identity binding:** Record `agent_id` and `session_id` in change metadata
2. **Audit logging:** Append-only log of all create/modify/archive operations with timestamps and actor identity
3. **Pre-archive hooks:** Allow registered hooks to run before archive (e.g., require N approvals, check agent authorization)
4. **Spec versioning:** Track which version of a spec a delta was written against; detect staleness at validate time
5. **Cross-change conflict detection:** At validate time, check if any other active change touches the same requirements
6. **Rollback command:** `openspec rollback <archive-name>` that moves the archive back and reverts spec changes

### 7.3 If Using OpenSpec as reference architecture
The delta format and validation patterns are the most valuable parts to study:
- The `parseDeltaSpec()` / `buildUpdatedSpec()` separation of parsing and application
- The validator's layered approach (Zod schema + imperative rules)
- The agent contract's envelope pattern
- The store system's identity verification and drift detection

---

## 8. File Inventory

Key source files reviewed:
- `src/cli/index.ts` — CLI entry point, 400+ lines
- `src/core/validation/validator.ts` — Central validation engine, 450+ lines
- `src/core/archive.ts` — Archive command, 450+ lines
- `src/core/specs-apply.ts` — Delta application logic, 400+ lines
- `src/core/parsers/change-parser.ts` — Change file parser
- `src/core/parsers/requirement-blocks.ts` — Delta spec parser, 300+ lines
- `src/core/parsers/spec-structure.ts` — Structural validation
- `src/core/schemas/spec.schema.ts` — Zod spec schema
- `src/core/schemas/change.schema.ts` — Zod change schema
- `src/core/schemas/base.schema.ts` — Base requirement/scenario schema
- `src/core/validation/constants.ts` — Validation thresholds and messages
- `src/commands/validate.ts` — Validate command, 300+ lines
- `src/core/store/foundation.ts` — Store system foundation
- `docs/agent-contract.md` — Machine-readable contract specification
- `docs/concepts.md` — Architecture documentation
- `docs/workflows.md` — Workflow patterns
- `AGENTS.md` — Agent instructions (root)
- `skills/openspec-archive-change/SKILL.md` — Archive skill
- `openspec/config.yaml` — Project configuration

---

*End of audit.*
