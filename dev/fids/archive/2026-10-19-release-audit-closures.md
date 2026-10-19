# 2026-10-19 closures — project-wide release audit (AUDIT-2026-1018)

Five records closed on their committed implementations. Each closed record lives
in this directory; this page is the batch index. Evidence is the archived record,
the CHANGELOG entry under `## 0.0.36` and the commit names below.

| FID | Severity | Implementation | What it repaired |
|---|---|---|---|
| FID-2026-1018-010 | low | `0c50fa8e` | Clickable child identity: static `Button`/`CommandPalette` and `FollowupLine` siblings no longer report missing unique keys. |
| FID-2026-1018-011 | medium | `106ee6f8` | Shared renderer/scrollbar subscriptions: one native listener per emitter and event, released with the last consumer. |
| FID-2026-1018-012 | medium | `789ec02c` | Release-audit reconciliation: picker keyboard evidence, current distribution/scaffold docs, public links, archived commit and recovery records, 0.0.36 release-note ordering. |
| FID-2026-1018-013 | medium | `20b2f55c` | Audit lifecycle/tooling: entrypoint-gated probes, wired diagnostic resets, exact state-lifetime exemptions, scratchpad output, workspace-relative evidence runs. |
| FID-2026-1018-014 | high | `60c50a67` | Dependencies: seven unused packages removed, vulnerable pins upgraded, YAML/braces patches persisted, durable hostile-input probe in the pristine-install gate. |

## Gates on the committed tree

- 14-workspace plus `scripts/` typecheck: exit 0.
- CLI suite: 4,233 pass / 18 skip / 0 fail across 529 files.
- Scripts suite: 1,122 pass / 0 fail across 140 files.
- ESLint `--max-warnings 0` exit 0; Markdown lint exit 0.
- `validate:repository` PASS.
- `release:preaudit:check`: `pre-audit: PASS — release preconditions clear`.

## Boundaries carried, not closed here

- The raw registry audit still reports one patched `braces@3.0.3` advisory with
  no upstream fixed release; the persisted patch is a documented mitigation, not
  a zero-advisory claim.
- Root patches and overrides do not propagate to independently installed SDK
  consumers, and the SDK distribution remains unpublished.
- LIVE-004's operator acceptance (five `/model` opens, three bashers) stands as
  recorded; the keystroke-evidence residual is covered by render-level tests, not
  by manufacturing historical key logs.
- Tagging, publication and the full release pipeline run remain operator-gated.
