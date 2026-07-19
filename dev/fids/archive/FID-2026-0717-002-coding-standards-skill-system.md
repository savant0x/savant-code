# FID: Coding Standards → Skill System Integration

**Filename:** `FID-2026-0717-002-coding-standards-skill-system.md`
**ID:** FID-2026-0717-002
**Severity:** high
**Status:** closed
**Created:** 2026-07-17 15:00
**Author:** Spencer Howell

---

## Summary

The `coding-standards/` directory contains 6 language-specific standards (TypeScript, Rust, Python, Go, Java, C#) plus 2 auxiliary standards (release-workflow, x402). These are dead config — no runtime code reads them. The `protocol.config.yaml` `language` field is also dead config. ECHO.md's boot sequence says "Load `coding-standards/{language}.md`" but there's no enforcement mechanism. The existing skill system (SKILL.md with YAML frontmatter, loaded from `.agents/skills/`) provides the perfect infrastructure to make coding standards loadable, enforceable, and extensible.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Commit/State:** Post FID-2026-0717-001 (FSM enforcement fixes)

## Detailed Description

### Problem

1. **Dead config**: `coding-standards/*.md` files exist but no code reads them. Agents have no runtime access to coding standards.
2. **Dead language field**: `protocol.config.yaml` has `language: "typescript"` but nothing parses it.
3. **No enforcement**: ECHO Law 6 (type safety shortcuts) and Law 11 (follow discovered patterns) reference coding standards, but agents can't access them at runtime.
4. **Not extensible**: Users can't add custom coding standards without modifying core files.
5. **Boot sequence is aspirational**: ECHO.md says "Load `coding-standards/{language}.md`" but this is a prompt instruction, not a code path.

### Expected Behavior

1. At boot, the runtime reads `protocol.config.yaml` → `language` field
2. The corresponding coding standard is auto-loaded into the agent's context
3. Agents can also load any standard on-demand via the `skill` tool
4. Users can add custom standards as skills in `.agents/skills/`
5. The `language` field becomes live config, not dead config

### Root Cause

The coding standards were written as documentation and never wired into the runtime. The skill system was built separately and doesn't know about `coding-standards/`. The two systems were designed to work together but were never connected.

### Evidence

**Coding standards exist but aren't loaded**:
```
coding-standards/typescript.md  — 85 lines, naming/patterns/anti-patterns/quality overrides
coding-standards/rust.md        — 78 lines, ownership/error handling/overrides
coding-standards/python.md      — 82 lines, type hints/imports/anti-patterns
coding-standards/go.md          — 71 lines, exported/unexported/concurrency
coding-standards/java.md        — 74 lines, exception hierarchy/imports
coding-standards/csharp.md      — 77 lines, I-prefix/async/await patterns
coding-standards/release-workflow.md — 64 lines, CHANGELOG/version bumping
coding-standards/x402.md        — 204 lines, agent payment standard
```

**Skill system exists and works** (`sdk/src/skills/load-skills.ts`):
- Loads from 4 directories: `~/.claude/skills/`, `~/.agents/skills/`, `{cwd}/.claude/skills/`, `{cwd}/.agents/skills/`
- Format: `SKILL.md` with YAML frontmatter (name, description, license, metadata)
- Available via `skill` tool at runtime
- Name regex: `/^[a-z0-9]+(-[a-z0-9]+)*$/`

**protocol.config.yaml language field is dead**:
- No `.ts` file reads `protocol.config.yaml`
- `language: "typescript"` is only referenced in documentation
- `CHANGELOG.md` line 92: "protocol.config.yaml inspected — no tooling reads it (dead config)"

## Impact Assessment

### Affected Components

- `coding-standards/*.md` — need SKILL.md frontmatter added
- `sdk/src/skills/load-skills.ts` — may need project-root scanning
- `cli/src/utils/skill-registry.ts` — may need auto-load on boot
- `protocol.config.yaml` — language field becomes live config
- ECHO boot sequence — becomes enforceable, not aspirational

### Risk Level

- [x] High: ECHO Laws 6, 9, 11 reference coding standards that agents can't access

## Proposed Solution

### Approach

Agent-driven, dynamic, per-context. The coding standards become skills. The agent loads the right standard for the files it's working with. No boot-time detection. No config changes. The agent already has the `skill` tool — it just needs the skills to exist.

### Steps

**Phase 1: Convert Standards to Skills**
1. Add YAML frontmatter to each `coding-standards/{language}.md` file (name, description)
2. Name format: `coding-typescript`, `coding-rust`, `coding-python`, `coding-go`, `coding-java`, `coding-csharp`
3. Keep `release-workflow.md` and `x402.md` as separate skills: `release-workflow`, `x402`

**Phase 2: Wire Skill Loading**
4. Add `coding-standards/` to `loadSkillsSync()` search paths in `sdk/src/skills/load-skills.ts`
5. This makes coding standard skills discoverable via the `skill` tool
6. The `{{AVAILABLE_SKILLS}}` placeholder will list them in the tool description

**Phase 3: Agent-Driven Dynamic Loading**
7. No boot sequence changes — agent loads standards on-demand
8. When agent reads/edits a `.ts` file → calls `skill({ name: "coding-typescript" })`
9. When agent reads/edits a `.rs` file → calls `skill({ name: "coding-rust" })`
10. Skill content stays in context until agent loads a different standard
11. Multi-language projects work naturally — agent switches standards as it switches contexts

### What We're NOT Doing

- No `protocol.config.yaml` changes — the `language` field stays as documentation
- No boot-time auto-detection — agent decides dynamically
- No per-directory language mapping — agent detects from files, not config
- No runtime code to parse config — agent uses existing tools (`read_files`, `skill`)

### Verification

1. Typecheck: `bun run --cwd=common typecheck && bun run --cwd=sdk typecheck && bun run --cwd=cli typecheck`
2. Verify `loadSkillsSync()` finds coding standard skills
3. Verify boot auto-loads the correct standard based on `language` field
4. Verify `skill({ name: "coding-typescript" })` returns the standard content

## Perfection Loop

### RED Phase — Issues Identified

| # | Issue | Evidence |
|---|-------|----------|
| 1 | Coding standards are dead config — no runtime code reads them | `coding-standards/*.md` exist but `loadSkillsSync()` doesn't search this directory |
| 2 | `protocol.config.yaml` `language` field is dead config | No `.ts` file parses this file; CHANGELOG confirms "no tooling reads it" |
| 3 | ECHO boot sequence is aspirational, not enforced | ECHO.md says "Load `coding-standards/{language}.md`" but it's a prompt instruction |
| 4 | No mechanism for agents to access standards at runtime | Standards are documentation files, not skills |
| 5 | Users can't add custom standards without modifying core files | No extension point for custom coding standards |
| 6 | Single `language` field can't handle multi-language projects | `language: "typescript"` assumes one language per project |
| 7 | Skill system and coding standards were designed together but never connected | Both exist independently; neither references the other |

### GREEN Phase — Proposed Fixes

**Fix 1: Add frontmatter to coding standards** (`coding-standards/*.md`)

Each file gets YAML frontmatter:
```yaml
---
name: coding-typescript
description: TypeScript naming conventions, patterns, anti-patterns, and quality overrides for ECHO Protocol.
---
```

Name mapping:
| File | Skill Name |
|------|-----------|
| `typescript.md` | `coding-typescript` |
| `rust.md` | `coding-rust` |
| `python.md` | `coding-python` |
| `go.md` | `coding-go` |
| `java.md` | `coding-java` |
| `csharp.md` | `coding-csharp` |
| `release-workflow.md` | `release-workflow` |
| `x402.md` | `x402` |

**Fix 2: Add `coding-standards/` to skill search paths** (`sdk/src/skills/load-skills.ts`)

Add `{cwd}/coding-standards/` as a 5th search path in `loadSkillsSync()`. This makes coding standard skills discoverable by the existing skill infrastructure.

**Fix 3: Auto-load at boot** (`cli/src/utils/skill-registry.ts`)

In `initializeSkillRegistry()`:
1. Read `protocol.config.yaml` from `{cwd}`
2. Parse `language` field
3. Find skill with name `coding-{language}`
4. Auto-inject its content into the system prompt context

**Fix 4: Document the skill names in protocol.config.yaml**

Update the comment in `protocol.config.yaml` to reference skill names:
```yaml
language: "typescript"  # Maps to skill: coding-typescript | coding-rust | coding-python | coding-go | coding-java | coding-csharp
```

### AUDIT Phase — Verification

| # | Check | Method |
|---|-------|--------|
| 1 | Frontmatter valid on all 8 files | `gray-matter` parse test |
| 2 | `loadSkillsSync()` finds coding standards | Unit test: mock filesystem, verify discovery |
| 3 | Boot auto-loads correct standard | Integration test: set `language: "rust"`, verify `coding-rust` loaded |
| 4 | Skill tool can load standards on-demand | Integration test: call `skill({ name: "coding-typescript" })` |
| 5 | Typecheck passes | `bun run --cwd=common typecheck && bun run --cwd=sdk typecheck && bun run --cwd=cli typecheck` |
| 6 | No breaking changes to existing skills | Existing `~/.agents/skills/` still load correctly |

### SELF-CORRECT Phase

**Finding S1**: The original approach assumed boot-time auto-loading via `protocol.config.yaml`. But the agent should drive this dynamically, not the runtime. The config file stays as documentation.

**Correction**: Removed all boot-time auto-detection, config parsing, and `protocol.config.yaml` changes. The agent uses existing tools (`read_files`, `skill`) to load standards on-demand.

**Finding S2**: Not all agents have the `skill` tool. Forge, Verifier, Detective may need coding standards but can't load them.

**Correction**: This is a tool set issue. If an agent needs coding standards, add `skill` to its tool set. This is a separate concern from the skill system itself.

**Finding S3**: The original FID said "Add `coding-standards/` to skill search paths." But `loadSkillsSync()` is called at CLI startup, not at agent runtime. The search paths are fixed at startup.

**Correction**: The `loadSkillsSync()` function scans directories at startup and caches results. Adding `coding-standards/` to the search paths means the skills are discovered at startup and available via the `skill` tool at runtime. This is correct — the discovery is static, but the loading is dynamic.

### COMPLETE Phase

FID converged. 7 issues identified, 3 fixes specified, 3 self-corrections applied. The approach is now agent-driven, dynamic, and multi-language by design.

## Blind Spots (Questions I Should Have Asked)

1. **What if a project uses multiple languages?** — The agent loads standards dynamically based on the files it touches. TypeScript frontend + Rust backend = agent loads `coding-typescript` when working on frontend, `coding-rust` when working on backend. The `skill` tool is the switch.

2. **Should the coding standard be injected into every agent's system prompt, or just the ones that write code?** — All agents benefit from knowing the project's coding conventions. The Detective needs them to identify violations. The Forge needs them to write correct code. The Verifier needs them to audit. But the standard is loaded via the `skill` tool, which is only available to agents that have it in their tool set. Not all agents have the `skill` tool.

3. **What about the `max_file_lines`, `max_function_lines` quality overrides in the standards?** — These override `protocol.config.yaml` defaults. When the agent loads a standard, it should also apply these overrides. This is an agent-side decision, not a runtime enforcement.

4. **Should `release-workflow.md` and `x402.md` be skills or remain as documentation?** — They're not language-specific. Making them skills is consistent but they shouldn't be auto-loaded. Available on-demand only.

5. **What happens if `protocol.config.yaml` doesn't have a `language` field?** — No change needed. The agent detects languages from files, not from config. The `language` field becomes purely informational.

6. **Does this conflict with the existing `.agents/skills/` convention?** — No. The coding standards are project-level skills (in `{cwd}/coding-standards/`), not user-level skills (in `~/.agents/skills/`). Both coexist.

7. **What about the Orchestrator not having the `skill` tool?** — The Orchestrator DOES have `skill` in its tool set (`base2.ts:111`). It can load coding standards. Other agents that need standards (Forge, Verifier, Detective) would need `skill` added to their tool sets if they don't have it.

8. **What if the agent loads the wrong standard for a file?** — The agent reads the file first (Law 1: Read 0-EOF), detects the language from extension/content, then loads the matching standard. If it loads the wrong one, the standard's anti-patterns section will flag issues that don't apply, which is harmless but wasteful.

9. **Should there be a way to force a specific standard regardless of file type?** — Yes. The agent can always call `skill({ name: "coding-rust" })` explicitly, regardless of what file it's working on. The dynamic loading is the default, not a constraint.

## Resolution

- **Fixed By:** Spencer Howell
- **Fixed Date:** 2026-07-17 16:00
- **Fix Description:** Converted 7 coding standards to skills in .agents/skills/. Each file got YAML frontmatter (name, description). Standards moved from coding-standards/ to .agents/skills/coding-{language}/SKILL.md. ECHO.md updated to reference new paths. No code changes needed — existing loadSkillsSync() discovers .agents/skills/ automatically.
- **Tests Added:** No (typecheck verification only)
- **Verified By:** typecheck (common clean, sdk pre-existing only), skill directory structure verified
- **Commit/PR:** Pending
- **Archived:** 2026-07-17 (set when moved to `dev/fids/archive/`)

## Lessons Learned

- Dead config is worse than no config — it gives the illusion of enforcement without the reality
- Skill system was designed for extensibility but never connected to existing documentation
- The gap between "documented in ECHO.md" and "enforced in code" is where protocols go to die
