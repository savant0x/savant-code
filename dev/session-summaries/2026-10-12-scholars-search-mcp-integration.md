# Session summary — scholars-search MCP integration (FID-2026-1012-001)

**Date:** 2026-10-12 ~01:10-01:57
**FID:** FID-2026-1012-001 (converged → verified → closed this session)

## Work performed

Wired the public Scholars Reading List search MCP server
(`https://api.sciencemadereadable.com/mcp`) into the `researcher-web` agent
persona, per the converged FID:

- `agents/researcher/researcher-web.ts` — `mcpServers` block (remote HTTP,
  no key) between `spawnableAgents` and `systemPrompt`; "Scholarly Literature"
  discipline section appended to the system prompt.
- `agents/researcher/researcher-web.test.ts` — new definition-shape pin
  (3 tests), following the `agents/github/github.test.ts` pattern.
- `docs/agents-and-tools.md` — Researcher row tools column + "Last verified".
- Bundle regenerated via `bun run --cwd=cli prebuild:agents`.

## Process notes

- Full FID + Perfection Loop before any code, per operator directive:
  RED catalog (11 evidence items) → GREEN spec → Verifier audit (1 FAIL,
  4 NEEDS-REVIEW) → Adversary (FAIL refuted with 0-EOF file evidence,
  resolutions confirmed) → converged → presented → approved → implemented.
- Operator-relayed Nova review (approve + 3 watch items) folded into the
  prompt text before coding: tool-use boundary, rate-limit error handling,
  citation-tool depth/direction guidance.
- Sub-agent harness defects encountered and recorded honestly in the FID:
  three `thinker` spawns failed on a native tool-call recovery defect, and
  one `recorder` spawn stalled read-without-write. The operator's main agent
  owns those bugs (tracked separately).
- lint:md repair pass on the FID itself (49 MD013 + 1 MD040 violations from
  compact authoring) — active `dev/fids/` records are governed by
  `.markdownlint.json`, only the archive is ignored.

## Gates (all exit 0 on final bytes)

`typecheck agents`, `typecheck cli`, `test agents/researcher/researcher-web.test.ts`
(3/3), `quality` (1502 baselined files), eslint on both changed TS files,
prettier, and `fid:verify --write` (4/4 gates, receipt stamped).

## Concurrency notes

The worktree carried concurrent uncommitted work (FID-2026-1011-005
clean-install-bundle artifacts, FID-2026-1012-002 stream-parser work from the
operator's main agent). Commits were strictly path-scoped (G4); no foreign
files were staged.