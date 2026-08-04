# FID: ECHO Enforcement Layer Documentation Drift (EC-1..EC-4)

**Filename:** `FID-2026-0803-009-echo-enforcement-doc-drift.md`
**ID:** FID-2026-0803-009
**Severity:** low
**Status:** analyzed
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Audit of the ECHO Protocol enforcement layer (`agents/savant/savant.ts`, `protocol.config.yaml`,
`ARCHITECTURE.md`, `ECHO.md` v0.2.0) found the *runtime* enforcement fully ECHO-compliant (FSM gating in
`tool-executor.ts:386-467`, SoD holds — Forge has no bash, Detective has no write tools, Verifier is zero-tool) with
**4 LOW documentation-drift items** in the bootstrap doc `ECHO.md` and one config comment. No CRITICAL/HIGH/MEDIUM.

---

## RED — Findings

### EC-1 (LOW) — ECHO.md Researcher row is stale

`ECHO.md:64` lists the Researcher tools as `web_search, read_url` only. There are **two** researcher agents:
`researcher-web` (`toolNames: ['web_search', 'read_url']`, researcher-web.ts:21) and `researcher-docs`
(`toolNames: ['read_docs']`, researcher-docs.ts:22). Since ECHO.md is the bootstrap doc the Orchestrator reads, it
never learns `read_docs` exists. `ARCHITECTURE.md:33` already documents this correctly
(`web_search, read_url (web); read_docs (docs)`).

### EC-2 (LOW) — ECHO.md "9 specialized agents" omits the 4 infra spawnables

`ECHO.md:49-51` states the harness "enforces the Perfection Loop through 9 specialized agents", but `savant.ts:123-137`
`spawnableAgents` actually lists **13**: the 9 canonical + `basher`, `tmux-cli`, `browser-use`, `context-pruner`
(infrastructure helpers). `ARCHITECTURE.md:212-238` covers this ("Helper Tool Libraries (Filesystem-Only)") and
explicitly warns "Future checklists/audits should not confuse them." ECHO.md is silent on the distinction.

### EC-3 (LOW) — ECHO.md Forge "Restricted Tools" cell lists bash it never has

`ECHO.md:59` Forge restricted cell reads `spawn_agents, bash (destructive), ask_user`. `forge.ts:33` is
`toolNames: ['write_file', 'str_replace', 'set_output']` with **zero** `bash` references in the file — bash is never
granted, so listing it as "restricted" is misleading for a bootstrap doc. The SoD table (ECHO.md:72) correctly says
"No bash (test) access".

### EC-4 (LOW) — protocol.config.yaml `commands.build` is a partial build

`protocol.config.yaml:28` `build: 'bun run ci'` compiles only SDK + Savant-Free (`package.json:29`:
`ci: "bun run build:sdk && bun run build:savant-free"`) — the CLI, agent-runtime, code-map, database, and
llm-providers are not compiled. The inline comment acknowledges this ("use type_check + lint_md for quality gates"),
but ECHO Law 1 defines `commands.build` as "your compile/build command". Verified: **no code reads `commands.build`**
— it is a pure documentation surface for agents, so a comment fix is safe and sufficient.

---

## GREEN — Proposed Fixes (minimal, docs/config only)

| # | File | Change |
|---|---|---|
| **EC-1** | `ECHO.md:64` | Researcher tools cell: `web_search, read_url` → `web_search, read_url (web); read_docs (docs)` (match ARCHITECTURE.md:33) |
| **EC-2** | `ECHO.md:49-51` | Add footnote after roster intro: 4 infra spawnables (`basher`, `tmux-cli`, `browser-use`, `context-pruner`) are helper/infra agents not in the 9-agent roster — see ARCHITECTURE.md → Helper Tool Libraries |
| **EC-3** | `ECHO.md:59` | Forge restricted cell: `spawn_agents, bash (destructive), ask_user` → `spawn_agents, ask_user` (bash never granted) |
| **EC-4** | `protocol.config.yaml:28` | Rewrite comment: build = release-artifact build (SDK + Savant-Free); full 9-workspace compile gate is `type_check` |

**Rejected alternatives (recorded):**

- Changing `commands.build` value to the full `type_check` chain — rejected: `bun run ci` is the release-pipeline
  entrypoint used by CI; the semantic split (build artifacts vs compile gate) is the correct model, it only needed
  documentation. Comment-only fix, zero runtime risk.
- Deleting/rewriting the ECHO.md roster table wholesale — rejected: 7/9 rows are accurate; only Researcher (EC-1) and
  Forge restricted cell (EC-3) need edits. Minimal-change principle (Law: MINIMAL changes).

---

## AUDIT — Verification Plan

1. **markdownlint** on `ECHO.md` (`bun run lint:md`) — table edits must not break MD tables (MD055/MD056).
2. **YAML parse** of `protocol.config.yaml` (`bun -e` with `yaml` pkg) — comment rewrite must not break the file.
3. **Table alignment** — re-grep the roster table: Researcher row contains `read_docs`, Forge cell no longer lists
   `bash`, footnote present after intro.
4. **No stale refs** — confirm no other tracked `.md` repeats the stale `web_search, read_url` Researcher cell
   (known: only ECHO.md:64; ARCHITECTURE.md:33 is already correct).
5. **No code change** — this FID touches docs/config only; typecheck not required (comment-only + markdown edits).

**Double-audit requirement:** static (grep verification) + runtime (markdownlint + YAML parse) — two independent
methods per AUDIT phase.

---

## Resolution

**Status:** verified — **Fixed Date:** 2026-08-03 · **Verified By:** Savant
(double audit: static grep + markdownlint/YAML parse)

**Changes applied (all 4, per approved GREEN section):**

- **EC-1** — `ECHO.md:69` Researcher row tools cell → `web_search, read_url (web); read_docs (docs)`
  (matches ARCHITECTURE.md:33 and the two real researcher agents).
- **EC-2** — `ECHO.md:55-58` added roster-intro footnote: 4 infra spawnables (`basher`, `tmux-cli`,
  `browser-use`, `context-pruner`) are NOT independent ECHO conversation roles → ARCHITECTURE.md →
  "Helper Tool Libraries".
- **EC-3** — `ECHO.md:64` Forge restricted cell → `spawn_agents, ask_user` (bash never granted;
  forge.ts:33 has zero bash). SoD table row (ECHO.md:77 "No bash (test) access") now consistent with the roster.
- **EC-4** — `protocol.config.yaml:28` build comment rewritten: release-artifact build (SDK + Savant-Free)
  vs. full 9-workspace compile gate (`type_check`).

**Verification (double audit — two independent methods):**

1. **Static grep** — each edit verified in place: Researcher row carries `read_docs (docs)`, Forge cell no
   longer lists `bash`, footnote present after roster intro, `commands.build` comment rewritten. No other
   tracked `.md` carries the stale Researcher cell (only ARCHITECTURE.md:33, already correct).
2. **Runtime** — `bun run lint:md` exits 0 after FID spacing fixes; `protocol.config.yaml` parses via `yaml`
   pkg (`YAML_OK commands.build = bun run ci`).

**Scope guard:** doc/config only — no TypeScript touched, so typecheck not required (per AUDIT plan item 5).
No code changed; nothing to call-graph verify (Law 4 N/A).
