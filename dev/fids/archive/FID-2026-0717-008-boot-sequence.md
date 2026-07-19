# FID: Wire Boot Sequence

**Filename:** `FID-2026-0717-008-boot-sequence.md`
**ID:** FID-2026-0717-008
**Severity:** high
**Status:** closed
**Created:** 2026-07-17 18:00

---

## Summary

ECHO.md defines an 8-step boot sequence. The CLI has none of it. ECHO.md is not read, protocol.config.yaml is not loaded, coding standards are not auto-loaded, dev/fids/ is not scanned, session summaries are not auto-created.

## Evidence

- ECHO.md:335-345 — 8-step boot sequence
- `cli/src/index.tsx` — zero references to ECHO.md
- `protocol.config.yaml` — dead config (only strictMode now read)
- `sdk/src/skills/load-skills.ts` — skills loaded, but no coding standard auto-load

## Proposed Solution

### Steps

1. Read `protocol.config.yaml` at CLI startup — extract `language`, `commands`, `strict_mode`
2. Auto-load `coding-{language}` skill if language is set and not `CHANGE_ME`
3. Scan `dev/fids/` for open FIDs — log them at startup
4. Inject boot context into agent system prompt: "ECHO Protocol active. Open FIDs: [list]. Language: [lang]. Strict mode: [true/false]."
5. Auto-create session summary at `dev/session-summaries/YYYY-MM-DD-HHMM.md` on first message

### What we're NOT doing

- Not reading ECHO.md as a file (already injected via ECHO_PROTOCOL_INSTRUCTIONS constant)
- Not reading ARCHITECTURE.md (already referenced in agent prompts)
- Not implementing full session lifecycle (that's agent-driven, not CLI-driven)

### Verification

- CLI startup reads protocol.config.yaml
- Coding standard skill loaded when language is set
- Open FIDs listed at startup
- Typecheck passes

### Missed Questions

1. **Should the boot sequence be in the CLI or in the agent runtime?** — CLI for config reading and skill loading. Agent runtime for FID scanning and session summary creation (agent-driven, not CLI-enforced).
2. **What if protocol.config.yaml doesn't exist?** — Use defaults. `language: "typescript"`, `strict_mode: true`. No crash.
3. **Should the boot context be in the system prompt or as a user message?** — System prompt. It's configuration, not conversation. The agent needs to know: "ECHO active. Language: typescript. Strict mode: true. Open FIDs: 2."
4. **Should the coding standard skill be auto-loaded or agent-triggered?** — Auto-loaded at boot. The agent shouldn't need to figure out which language it is — the config says it.
5. **What about the 8-step ECHO boot sequence?** — Steps 1-3 (read ECHO, load config, check language) are CLI-driven. Steps 4-8 (load standards, review FIDs, create summary) are agent-driven. The CLI does the config parts; the agent does the rest via system prompt injection.
6. **Where does session summary creation happen?** — The Scribe agent writes it at end of session. But the ECHO boot says "create session summary at start." This is a conflict. Resolution: create a minimal summary at start (date, planned work), let Scribe expand it at end.
7. **Should FID scanning happen at boot or lazily?** — At boot. The agent needs to know about open FIDs before it starts working.
8. **What if dev/fids/ doesn't exist?** — Create it. The Recorder needs it.

### AUDIT Phase

| # | Check | Method |
|---|-------|--------|
| 1 | protocol.config.yaml readable | `readStrictMode()` already works — extend to read language |
| 2 | Skills loaded from .agents/skills/ | `loadSkillsSync()` already discovers skills |
| 3 | FID scanning possible | `fs.readdirSync('dev/fids/')` works if directory exists |
| 4 | Boot context injectable | System prompt builder in `strings.ts` supports placeholders |

### SELF-CORRECT Phase

**Finding:** The original plan says "auto-create session summary at first message." But ECHO says "create at start of session." These are different.

**Correction:** Create a minimal session summary file at CLI startup (before first message). Content: date, language, strict mode, open FIDs. The Scribe agent expands it at end of session.

**Finding:** Auto-loading the coding standard skill at boot means the skill content is injected into every agent's context, even agents that don't write code (e.g., Verifier).

**Correction:** This is acceptable. All agents benefit from knowing the project's coding conventions. The Detective needs them to identify violations. The Verifier needs them to audit.

**Finding:** The boot context should be a separate section in the system prompt, not appended to ECHO_PROTOCOL_INSTRUCTIONS.

**Correction:** Add a new placeholder `{{ECHO_BOOT_CONTEXT}}` to the prompt template. Inject boot info (language, strict mode, open FIDs) via this placeholder.

### COMPLETE Phase

FID converged. Boot sequence split: CLI reads config + loads skills. Agent runtime scans FIDs + creates summary. System prompt gets `{{ECHO_BOOT_CONTEXT}}` placeholder.

## Resolution

- **Fixed By:** Pending
- **Archived:** Pending
