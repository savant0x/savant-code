# Session Summary: 2026-10-14 — refusal authority, guard over-breadth, SEC-3 restoration

**Session ID:** 2026-10-14-refusal-authority-and-guard-audit
**Status:** completed (local commit; no push, no release)

---

## Initial State

- **OS / shell:** Windows, bash (Git Bash)
- **Runtime:** Bun 1.3.14, TypeScript 5.5.4, local line 0.0.36
- **Branch / last commit:** `main`, `e29e6ddf` (the Loop 12 FID-census correction)

### Known Issues carried in

- The operator's objection to harness-level refusal, plus the standing request to
  audit the read-only guard for over-broad rules.
- Ten active FIDs, none archivable (unchanged by this session).

## Planned Work

1. Audit the read-only guard for legitimate read-only commands it refuses.
2. Fix what the audit finds.
3. Put the architectural question (should the harness refuse at all?) to the operator
   with evidence rather than argument.

---

## Work Completed

### Task 1: over-breadth audit of `run_readonly_command`

- **Status:** completed — `FID-2026-1014-001`
- **Method:** a 56-command corpus of legitimate read-only commands
  (`dev/scratchpad/active/readonly-overbreadth-audit.ts`, local-only), 49 declared
  read-only and 7 controls that must stay refused.
- **Result before:** `allowed=44 rejected=12`, **5 false positives** — `2>/dev/null`
  (three spellings) and `< file` (two) — while EHEL already treats `/dev/null` as a
  non-mutation target (`echo/enforcement/helpers.ts:144`).
- **Result after:** `allowed=49 rejected=7`, **0 false positives**.
- **Changes:** `readonly-command-validation.ts:29-36` (one exported non-global
  `PERMITTED_REDIRECT_REGEX` + a local global twin), `:203-208` (`< file` permitted;
  `<(`/`<<`/`<<<` still refused), `:227-228` (strip-then-rescan);
  `helpers.ts:11,150,157` (renamed consumer — Law 13, one truth).

### Task 2: the SEC-3 waiver was live again

- **Status:** completed — same FID, finding B
- **Finding:** archived `FID-2026-0919-010` (SEC-3) closes with steps `DONE`, a 4/4
  receipt and a promised suite; the tree had neither. A HEAD snapshot probe accepted
  `cat .env > /tmp/exfil.txt 2>&1`, `echo $(whoami) 2>&1` and `ls; rm x 2>&1`, and
  `git log --all --name-status -- '*redirect-waiver*'` shows only the record's add
  (`e6d06fe7`) and its archive move (`407527b2`) — no implementation commit.
- **Repair:** the span-scoped scan SEC-3 specified is implemented, and
  `run-readonly-redirect-waiver.test.ts` now exists with that record's acceptance
  matrix. Registered as its own record, `FID-2026-1014-002`, with a 569-record census
  (33 records name ≥1 test path that does not resolve — triage lead, `NEEDS-REVIEW`).

### Task 3: operator channel

- **Status:** completed (ruling pending)
- `dev/operator-decisions.md` gained section H: **Q23** (harness refusal authority —
  the full seven-site inventory, the verified absence of any agent-level task-refusal
  path, four options, and the four under-breadth holes) and **Q24** (the 33-record
  artifact census and whether it becomes a gate). Both answers left blank for the
  operator; the appendix maps what each unblocks.

---

## Validation Results

- [x] `bun run --cwd=packages/agent-runtime typecheck`: PASS (exit 0, status captured
  without a pipe)
- [x] `run-readonly-command.test.ts`: PASS 18/0 · `run-readonly-redirect-waiver.test.ts`:
  PASS 4/0 · `run-readonly-command-chains.test.ts`: PASS 10/0
- [x] `terminal-mutation-classifier.test.ts` + `deny-mutating-terminal.test.ts`: PASS 15/0
- [x] `src/tools/handlers` + `src/tools/tool-executor` + `src/echo`: PASS 644/0 (78 files)
- [x] corpus probe: PASS (0/56 false positives)
- [x] `bun run lint:md`: PASS
- [ ] Full root `bun run test` chain and root typecheck chain: **not rerun** — only the
  affected workspace leg was run, as in the previous loop

## Honest limits

- **Nothing was closed or archived.** The ten active records keep their closure
  conditions; this session added two records and changed no status.
- **The under-breadth holes are reported, not closed** — closing them adds refusals,
  which is exactly what Q23 asks the operator to decide. A second probe pass (same day,
  after the commit) showed the class is wider than the four first reported: `bun -e "…"`,
  `bun x <pkg>`, `bun run release:public`, `deno eval`, `find . -delete` and `kill -9 1`
  are all ALLOWED. **The guard is a denylist, not a boundary** — its real authority is the
  phase gate, and this session's own probe harness ran on `bun -e`, i.e. through one of
  those holes. Nothing was executed through the guard: the SEC-3 reproduction evaluated
  the predicate on a copy of the HEAD module and read/wrote nothing.
- **Q23 and Q24 are unanswered**; the architectural option (b) — route instead of
  refuse — is proposed, not implemented.
- **The 33-row census is untriaged.** No row other than SEC-3 was checked against
  history, so renames and real absences are not separated.
- No live TUI or WebView smoke; nothing pushed, released or re-credentialed.

## Lessons Learned

- A safety guard needs a **false-positive** measurement as much as an attack suite;
  every prior pass on this file asked only one direction of the question.
- A closed FID is a **claim**, not an artifact: a receipt proves gates ran, not that
  steps happened, and prose-declared artifacts escape the promise rule.
- "One truth" means one **form** as well as one value — a shared constant is not shared
  behaviour unless both callers read it the same way (the `g`-flag trap).

### Task 4: no agent may be attributed (operator directive, same session)

- **Status:** completed — `FID-2026-1014-003` (CI layer pending branch protection)
- **Measured before:** the rule had two divergent copies (hook bash `grep` +
  `WATERMARK_PATTERNS`), named only `codebuff`/`commandcode`, the hook's own
  failure text advertised the `--no-verify` bypass, a session summary invited
  footer removal "per the operator's own co-author policy", and no CI layer
  existed — so a bypassed local hook reached the remote unchallenged.
- **Now:** one rule (`scripts/attribution-guard.ts`), three layers (hook,
  pre-push range scan, CI), fail-closed `2` on any unusable input.
- **Verified:** tagged message file → exit 1 · clean → 0 · unreadable file → 2 ·
  unresolvable range → 2 · temp-repo tagged range → 1 · whole-history `--all` →
  **exit 0** (every commit, every ref). Suites 7/0 and 4/0; `typecheck:scripts`,
  `quality`, `lint:md`, eslint, prettier all exit 0.
- **Two defects found by running it, both fixed:** the rule flagged *prose* that
  quotes the watermark (its own explanatory commit), and the emoji branch was
  inert without the `u` flag (`🤖 Generated with Codebuff` passed silently).
- **Disclosed:** one commit attempt this session carried the Codebuff footer; the
  hook rejected it, no commit object was created, and the retry omitted it. No
  commit in any ref carries a trailer; `--no-verify` was never used.

## Next Session

1. Take the Q23 ruling and implement (b) if authorized: route instead of refuse.
2. Q24: decide the census gate/triage shape; `FID-2026-1014-002` stays `analyzed` until then.
3. The failure-class lanes still own the register's closure conditions — nothing here
   starts an observation window, so `--assert-repaired` still exits 1 by design.
