# Learnings: the root-cause matrix

**Date:** 2026-10-12
**Subject:** the defect classes behind `dev/LEARNINGS.md`, measured from the mechanical trace
ledger, and what fixes them at the source.
**Supersedes the focus of:** `docs/design/learnings-boot-loading-and-lifecycle-review.md`
(that review is retained for its measurements of the boot contract; its *programme* — a boot
digest, ceilings, retirement plumbing, consolidation — treats the file's size. This document
treats the defects. Size is a symptom.)

## 1. Why the size framing was the wrong target

The ledger's purpose is dog-fooding: every entry records a real failure from a real run so the
class can be fixed. A file that keeps growing is not evidence that the file is too small a
container; it is evidence that **classes keep recurring unfixed**. Trimming, digesting or
capping the file leaves every one of those classes running and simply resets the counter — the
file grows back to the same place, which is why the entry count is a *measurement of unfixed
classes*, not a storage problem.

## 2. Method

`dev/experiences/raw-traces.jsonl` is the mechanical capture — one immutable record per tool
failure (`ts`, `toolName`, `errorFirstLine`, `sessionId`), written by the `PostToolUseFailure`
hook and never boot-read. It is the only surface that can answer "is this class still
happening", so the matrix is built from it and cross-checked against the lessons the ledger
claims.

```text
records=559  classes=70  distinct sessions=195
classes at the repo's own >=3-distinct-session promotion bar (FID-2026-1005-003): 27
```

## 3. The matrix

Ranked by recorded volume. "Ledger" is whether `dev/LEARNINGS.md` covers the class at all
(`grep -ci`, live file, measured 2026-10-12).

| # | Class (tool \| failure) | Hits | Sessions | Last seen | Ledger | Owning FID | Still live? |
|---|---|---|---|---|---|---|---|
| 1 | `read_url` \| `Failed to fetch URL: 404 Not Found` | 114 | 18 | 2026-10-10 | **0** | **none** | yes |
| 2 | `read_files` \| incomplete arguments | 48 | 19 | **2026-10-12** | 1 (via FID-2026-1012-009) | partial | **yes, today** |
| 3 | `str_replace` \| old string not found | 29 | 13 | 2026-10-11 | **0** | **none** | yes |
| 4 | `str_replace` \| incomplete arguments | 28 | 18 | 2026-10-11 | **0** | **none** | yes |
| 5 | `read_url` \| incomplete arguments | 27 | 3 | 2026-10-10 | **0** | **none** | yes |
| 6 | `read_url` \| no readable text found | 25 | 7 | 2026-10-11 | **0** | **none** | yes |
| 7 | `web_search` \| no results, add a research API key | 24 | 7 | 2026-10-10 | 1 (incidental) | **none** | yes |
| 8 | `write_file` \| incomplete arguments | 23 | 20 | **2026-10-12** | **0** | **none** | **yes, today** |
| 9 | `str_replace` \| no change to the file | 19 | 12 | 2026-10-11 | **0** | **none** | yes |
| 10 | `spawn_agents` \| incomplete arguments | 17 | 15 | 2026-10-11 | **0** | **none** | yes |
| 11 | `run_readonly_command` \| incomplete arguments | 15 | 8 | **2026-10-12** | **0** | **none** | **yes, today** |
| 12 | `code_search` \| ripgrep ENOENT (vendored binary not found) | 13 | 5 | 2026-09-17 | **0** | **none** | yes |
| 13 | `read_url` \| 403 / 401 / 429 / >2 MB | 10+9+7+7 | 7/8/3/6 | 2026-10-12 | **0** | **none** | yes |
| 14 | `code_search` \| exit 0, matches existed, 0 collected | 7 | 4 | 2026-10-10 | **0** | **none** | yes |
| 15 | `run_readonly_command` \| timed out after 30 s | 7 | 6 | 2026-10-10 | **0** | **none** | yes |
| 16 | `write_todos`, `suggest_followups`, `basher` \| incomplete arguments | 7+6+5 | 5/5/3 | 2026-10-11 | **0** | **none** | yes |

**The single most important number in this document:** the `Incomplete arguments for tool X`
family totals **193 of 559 recorded failures (35%)** across **nine tools and ≥40 distinct
sessions**, and it fired **16 times today (2026-10-12)**. The ledger learned this class on
**2026-08-16** — the lesson "A retry that re-emits the same oversized tool call is not
recovery" — and in `ac4bad20` (2026-10-12) that lesson was **retired out of the boot read**
into `dev/LEARNINGS-RETIRED.md:1373` while the class was still firing. A lesson that gets
archived while its class recurs is the dog-fooding loop failing in both directions: the file
neither drove a fix nor kept the signal.

**Coverage gap:** 5 of the 6 highest-volume classes have **zero** mention in the ledger. The
ledger covers the *interesting* findings (process, architecture, agent behaviour) and misses
the *frequent* ones (mechanical tool friction), which is why it grows with narrative while the
top defect runs 114 times unseen.

## 4. Root causes

### RC1 — Nothing bounds what the model emits

- **Classes:** 2, 4, 5, 8, 10, 11, 16.
- **Problem:** Recovery runs *after* the payload is already cut — steer-and-retry with a
  3-strike budget (`packages/agent-runtime/src/run-agent-step/constants.ts`), with the advice
  text emitted at `sdk/src/impl/llm/errors.ts:142-146`. FID-2026-1012-007 windowed `read_files`
  and FID-2026-1012-009 classified the truncation; neither reduced the class.
- **Fix:** budget-aware emission — a per-tool argument budget, splitting at the source
  (append/chunked write paths), and no re-send advice for a cut payload.

### RC2 — Every upstream condition is one flat per-call error

- **Classes:** 1, 6, 13.
- **Problem:** `sdk/src/tools/read-url/fetch.ts:169,186` returns status and extraction
  failures with no taxonomy, no negative caching, no canonicalisation and no "stop trying
  this" signal.
- **Fix:** classify (not-found / denied / rate-limited / oversized / unextractable), make
  not-found one-shot with a search fallback, cache negative results for the run.

### RC3 — Silent capability degradation

- **Classes:** 7, 12, 14, 15.
- **Problem:** `packages/agent-runtime/src/llm-api/research-sources.ts:125` turns a missing key
  into an empty result set; `code_search` returns nothing on ENOENT or on the exit-0/zero-match
  anomaly; nothing checks a capability before a run needs it. The ledger already names the
  rule ("a control's degradation path needs the same specificity as its success path",
  FID-2026-1006-004) and applied it to one control, not to the tool surface.
- **Fix:** one degradation contract (a missing capability names itself once, with the fix), a
  run-start self-check (ripgrep binary, research key, network), and no silent empty result for
  a search that could not run.

### RC4 — Edit friction is reported, not diagnosed

- **Classes:** 3, 9.
- **Problem:** a mismatched `str_replace` gets "old string not found, try a different string"
  and a no-op edit gets "no change to the file"; neither carries the evidence needed to repair
  it (nearby context, whitespace/line-ending, staleness against the content last read).
- **Fix:** return the closest match plus a diagnosis; make "no change" a distinct actionable
  outcome.

### RC5 — Nothing closes the loop from recurrence to fix

- **Classes:** all.
- **Problem:** the pieces exist — `experiences:dedup` (≥3 distinct sessions in 14 days),
  `lessons:to-skills`, `lessons:features`, the Scribe session-end review — and **none of them
  files a defect fix.** 27 classes sit at the bar; the agenda has carried
  `read_files 41 / read_url 24 / web_search 19` with no owner. Every lesson in the ledger is
  written *after* a fix (each names its owning FID), so the file documents the past instead of
  driving the next change.
- **Fix:** recurrence-first work — a class at the bar with no owning FID becomes a FID; the fix
  declares a **recurrence assertion** (the class must not reappear in the next window); the
  lesson is written only once the assertion holds.

## 5. Features

- **E1 — argument budgets at the source** (RC1): a per-tool emission budget, source-side
  splitting, and no re-send advice for a cut payload.
- **E2 — fetch taxonomy and negative caching** (RC2): one classification for every fetch
  outcome, one-shot not-found with a search fallback.
- **E3 — capability self-check and loud degradation** (RC3): preflight the capabilities a run
  depends on; never return an empty success for a search that did not run.
- **E4 — diagnostic edit responses** (RC4): a mismatch answer carries the evidence to repair
  it.
- **E5 — recurrence-first loop** (RC5): class → FID → fix → recurrence assertion → lesson, with
  the class-coverage check in `validate:repository` so a top-N class with no owner fails the
  repo gate.

## 6. Records

| FID | Sev | What it fixes |
|---|---|---|
| `FID-2026-1012-017` | critical | RC1 — the 193-record incomplete-arguments class, at its source |
| `FID-2026-1012-018` | high | RC2 — read_url, the top recorded class, uncovered by the ledger |
| `FID-2026-1012-019` | high | RC3 — three tools that degrade silently |
| `FID-2026-1012-020` | medium | RC4 — edit-path friction |
| `FID-2026-1012-021` | high | RC5 — the recurrence-to-fix loop itself (E5) |

## 7. Boundaries

- Volumes, session counts and last-seen dates are measured from 559 records in
  `dev/experiences/raw-traces.jsonl` on 2026-10-12 and are reproducible with the aggregation
  in each record's evidence.
- The trace `errorFirstLine` is a *first line*: one record can stand for a class with several
  sub-causes, which is why the fix statements are written at the class level and every record
  begins with a RED that re-measures rather than trusting this table.
- Class 12's message names `@codebuff/sdk` and `CODEBUFF_RG_PATH`; whether the resolver
  involved is savant's (`sdk/src/native/ripgrep-path-fallback.ts`) or the host's must be
  established before that leg is assigned, and `FID-2026-1012-019` says so.
- This document proposes no change to the ledger's contents or size. It is the work queue the
  ledger should have produced.
