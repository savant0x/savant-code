# Session Closeout — 2026-08-04: Harness ECHO Compliance Layer + Diff-Viewer Highlighting

**Scope:** FID-2026-0804-009 (harness-side ECHO compliance layer) + FID-2026-0804-010 (diff-viewer line
highlighting, edit stats counter, ceremony threshold 75 → 20).

**Status:** Both FIDs implemented, independently reviewed, verified, closed, and archived.

---

## FID-2026-0804-009 — Harness-Side ECHO Compliance Layer

**Problem:** Verifier-trigger criteria and Law 1/3 existed only as `savant.ts` prompt text. Production evidence
(savant-gateway LEARNINGS.md L-001/L-003/L-004) showed 8 FIDs / 2000+ lines implemented with zero Verifier spawns.

**Implemented:**

- `EchoComplianceTracker` (`packages/agent-runtime/src/util/echo-compliance.ts`) — per-run, pure + testable.
- Recording (read/write/spawn/verification) + Law 1 write-time receipt in `tool-executor.ts` (post-sandbox, so
  sandbox-denied writes never count toward the footprint).
- Law 3 + mechanical Verifier-criteria + FID-path escalation at the `loopAgentSteps` step boundary
  (`run-agent-step.ts`), main-loop only (`parentId` gate), with budgeted corrective steering into message history.
- New `compliance_warning` PrintModeEvent variant; muted CLI receipt in `sdk-event-handlers.ts`; per-run tracker at
  `sdk/src/run.ts` (`RunOptions.echoCompliance`, `off` opt-out); 30s-TTL FID-path cache in `create-run-config.ts`.
- 28 new tests. Independent review (code-reviewer-deepseek-flash) → 3 findings fixed: subagent loops never steer,
  Law 1 recorded post-sandbox, FID-inventory cached.

**Gates:** typecheck ×4 exit 0 · agent-runtime 667/0 · CLI 2775/0 · ESLint 0 warnings · lint:md 0 · Law-4 greps at
every seam.

## FID-2026-0804-010 — Diff-Viewer Highlighting + Edit Stats + Ceremony Threshold

**Implemented:**

- `cli/src/utils/diff-stats.ts` — `parseDiffLines` (header/hunk/add/remove/context classification, counts exclude
  `+++`/`---` headers + `@@` hunks) + `blendHex` (linear RGB mix; `t=0.5` = 50%-opacity semantic).
- `DiffViewer` rewritten line-by-line — added rows get a 50% neon-green (`#39ff14`) background, removed rows a 50%
  neon-red (`#ff3131`) background, each blended against the theme background; context/hunk/header rows stay muted.
  Implementation note: OpenTUI `<text>` has no background option → each row is a box-wrapped text (boxes own
  `backgroundColor`).
- `[-N/+M]` counter via optional `footerLeft` slot threaded `ToolRenderConfig` → `tool-branch` → `CopyableBlock`,
  rendered in the same bottom-right footer row as the copy button; hidden when no diff renders; create_file reports
  its additions, delete_file has no diff.
- Ceremony threshold 75 → 20 at `savant.ts:319/607/622` + `common/src/constants/agents.ts:227`, bundled agents
  regenerated (`prebuild:agents`).
- 28 new/updated tests. Review notes applied: counter hidden on empty diff, `parseHex` regex guard, footer-placement
  integration test.

**Gates:** CLI typecheck exit 0 · 77 tools/util tests 0 fail · agent-toolnames-validation 3/3 · ESLint 0
warnings · threshold re-grep (0 `75 line` hits incl. bundle).

## Release prep performed

- README.md + README.zh-CN.md + cli/release/README.md updated with the FID-009/010 feature bullets.
- Version consistency re-verified: VERSION, root/cli/sdk/cli-release package.json, protocol.config.yaml all
  `0.0.19`.
- Stale-v0.0.18 sweep: remaining refs are historical records only (archived FIDs, nova audit, prior closeouts).
- dev/ folder audited: no dead files; FID archive complete (001–010); LEARNINGS.md + this summary updated.
