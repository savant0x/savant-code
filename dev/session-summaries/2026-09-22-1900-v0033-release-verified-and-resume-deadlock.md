# Session Summary — 2026-09-22 19:00

**Task 83 — v0.0.33 shipped and verified complete; the `--resume` recovery path is deadlocked.**

Continues `2026-09-22-1400-t82-i-pre-push-rewrite-executed.md` (that summary is
left intact per this directory's no-rewrite rule).

## Trigger

The operator ran the release themselves and reported it back: *"looking at
https://github.com/savant0x/savant-code, it shows the release? same for npm too"*,
with the pipeline's terminal output ending in
`Post-release verification failed for savant-code@0.0.33.` /
`error: script "release:public" exited with code 1`. The question was whether the
exit code meant the release had failed.

## 1. The release is complete (T83-A)

It had not failed. All five `POST_RELEASE_VERIFY` assertions were verified
independently from this machine:

| Assertion | Evidence |
|---|---|
| GitHub release exists | `draft: false`, `pre: false`, published `2026-09-22T18:22:40Z`; HTTP 200 |
| Tag ↔ release HEAD | `v0.0.33^{commit}` = `8f40f6f2` = `HEAD`; `git ls-remote` confirms on origin |
| Five binary assets | darwin-arm64/x64, linux-arm64/x64, win32-x64 — all attached |
| npm published | `savant-code@0.0.33`, `dist-tags.latest` = `0.0.33`, 81 files |
| npm artifact content | `README.md` ✓, `index.js` ✓ (`npm pack --json`) |
| Desktop absence claim | `…/releases/download/v0.0.33/latest.json` → **404** |
| Version surfaces | `VERSION` = `0.0.33`; shipped heading `## 0.0.33 — 2026-09-22` |

The CHANGELOG date fix from T82-M reached the release.

## 2. The primary failure was benign (T83-B)

`packageIsPublished` (`npm-guards.ts:70-83`) does a single `npm view` with **no
retry**, while `verifyReleaseAssets` (`assets.ts:108-126`) immediately before it
retries for a bounded window. npm's own output warned of the cause ("being processed
and may take a few minutes"), and the registry served `0.0.33` moments later. The
stage ordering proves the release was healthy: the npm leg runs **after** the
GitHub-release, tag-binding, asset and desktop-claim legs.

## 3. The real finding: `--resume` is deadlocked (T83-C)

`bun run release:public:resume` fails at its first step:

```text
[pre-audit BLOCK] tag v0.0.33 already exists on origin — the release already shipped; use --resume or delete the release
```

The message recommends the command that just failed, and the run mutated nothing
(`git status` clean afterwards). Cause, at file:line:

- `checkStaleTag` returns `severity: block` whenever the tag is on origin in
  **every** mode — the `resume` flag only alters the **local-only** tag branch
  (`pre-audit-local.ts:174-185` vs `:186-196`).
- The orchestrator makes any non-preview block fatal (`transaction.ts:256`).
- Blocking on origin is the deliberate shipped-version guard for a *re-cut*
  (FID-2026-0913-004:91) — the oversight is that it also refuses *resume*.
- The suite pins only the local-only branch (`pre-audit.test.ts:161`), so the
  combination was never tested.

Proven by direct call: `checkStaleTag(root, '0.0.33', true)` → `severity: "block"`.

**Two further constraints close every exit:** a fix commit moves HEAD and the
HEAD-bound receipt refuses (`transaction.ts:139`), while deleting the release or tag
fails the tag/release assertions (`stages-verify.ts:96-101`). Therefore any release
failure **after `GIT_PUSH`** leaves its receipt permanently `failedStage`-marked —
and the v0.0.33 receipt specifically **cannot** be rescued by the fix. That is
correct by construction, not a limitation to work around.

**Operator ruling:** document only — change no guard code this session
(SCOPE.md T83-C). Fix and RED-first pins are specified in the FID for the next
session.

## 4. Records (T83-D)

- **`dev/fids/FID-2026-0922-001-resume-unreachable-after-git-push.md`** — new,
  `analyzed`, severity high, automation level 1. Full diagnosis, live
  reproduction, the uncovered-pin gap, the three-constraint deadlock, the proposed
  fix (extend `resume` tolerance to the on-origin branch; bounded retry for the npm
  read-after-write), and five Missed Questions including why the fix cannot rescue
  this receipt and why a parallel annotated-tag implementation must not be written
  into the pre-audit.
- **`dev/fids/README.md`** — 2026-09-22 erratum block recording the verified
  completion + the deadlock, per the 2026-09-13 precedent.
- **`SCOPE.md`** — Task 83 (T83-A…E).
- The release receipt (`%TEMP%/savant-public-release-0.0.33.json`) was **left
  unmodified**. Hand-writing a `POST_RELEASE_VERIFY` mark would fabricate evidence
  for a stage the pipeline did not complete. Its `restored: true` means the next cut
  is not blocked (`local-state.ts` keys that guard to `restored`, not
  `failedStage`).

## Verification

| Leg | Result |
|---|---|
| `bun run release:public:resume` | exit 1 at pre-audit (the finding), tree untouched |
| `checkStaleTag(..., resume=true)` | `severity: "block"` (direct call) |
| `release:preaudit:check` | the expected preview-mode stale-tag block only |
| pre-push credential scan on the (now empty) pushed range | PASS — 0 files |
| GitHub release / assets / npm / desktop probes | all as tabulated above |
| `lint:md`, `validate:repository`, `scope-register`, `fid:verify --check` | re-run green after the records |

## Open items

- **T83-E (operator):** drop `backup-pre-rewrite-20260922` — the v0.0.33 tag is
  pushed and the release verified, which was its retirement condition.
- **FID-2026-0922-001:** the guard fix, deferred by operator ruling.
- Nothing committed this session (G2 withheld).
