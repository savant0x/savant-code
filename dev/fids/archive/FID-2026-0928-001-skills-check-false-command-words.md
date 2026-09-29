# FID: `skills:check` reports backticked prose as shell commands

**Filename:** `FID-2026-0928-001-skills-check-false-command-words.md`
**ID:** FID-2026-0928-001
**Severity:** low
**Status:** closed
**Created:** 2026-09-28 10:05
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

`skills:check` is red (17 errors) on three agent-authored quarantined skills. Five
of those errors are **false positives**: the command-allowlist rule reads
backticked English prose and the first word of fenced code blocks as shell
invocations. The remaining defects are real — one SKILL.md whose YAML frontmatter
does not parse, a duplicated frontmatter block, and missing required sections.
This FID fixes the checker root cause and the three files, and leaves exactly one
item blocked on an operator ruling: whether to widen the command allowlist.

## Environment

- **OS:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14` (pinned in `.bun-version`)
- **Commit/State:** `06967570`, clean working tree, v0.0.34
- **Governance:** ECHO Protocol v0.1.2-single-agent, `strict_mode: true`,
  session autonomy level 3

## Detailed Description

### Problem

`bun run skills:check` exits 1. Triage separates the 17 errors into three
classes; this FID owns the two in-project ones.

### Root cause — two independent defects in `extractCommandWords`

**RC1 — fenced code blocks are not excluded, and they flip pairing parity.**
`scripts/skills-check-content.ts:59-61` matches inline spans with
`` /`([^`]+)`/g `` over the raw body. A ` ``` ` fence contributes **three**
backticks. The regex cannot pair three, so it consumes the first backtick of the
*closing* fence and returns the entire fenced block as one "inline span". Every
subsequent inline span is then paired off-by-one, so a span's reported first word
is a word from unrelated prose.

Measured on `.agents/skills/.quarantine/release-workflow/SKILL.md` (29 spans):

```text
HIT 22 "markdown\n## 0.0.30 — 2026-09-08\n\n### <Area heading> …"
HIT 26 "with project-specific overrides\n(release workflow, build/test commands, …"
HIT 28 "and propagates to every\nmanifest (verify with"
```

`markdown` is a fence **info string**, not a command. `with` and `and` are the
second words of sentences on lines 76-77 and 85-86, mispaired because of the
fence. One fence desynchronises the whole rest of the document.

**RC2 — a `label: value` span is quoted content, not an invocation.**
`.quarantine/minisign-pubkey-vs-secret-key/SKILL.md:15-16` quotes the first line
of a minisign key file:

```text
- `untrusted comment: rsign encrypted secret key` → PRIVATE …
- `untrusted comment: minisign public key: <HEXID>` → shareable …
```

The rule's own comment (`skills-check-content.ts:58`) says it extracts words
"if it looks like a CLI invocation". A `name: value` record is quoted file
content. It has no leading binary, so it must not be gated as one.

**RC3 — parse failure masks every later rule.** `skills-check-content.ts:96-99`
pushes the finding and `return findings`. The 4 `section-order` errors and the
command-allowlist errors in `fid-gates-unfenced-parser-contract/SKILL.md` are
**invisible today** because `matter()` throws first. Confirmed by repairing the
frontmatter in a scratch copy: the file then parses (desc len 57) and its heading
list is `[ "Verification Gates" ]` — none of the four required sections.

**RC4 — unparseable frontmatter.** `.quarantine/fid-gates-unfenced-parser-contract/SKILL.md:3`
has an unquoted `description` containing a colon-space
(`… declare bare - gate: lines`). In a YAML plain scalar `: ` opens a nested
mapping, so `gray-matter` throws.

**RC5 — duplicated frontmatter block.**
`.quarantine/release-workflow/SKILL.md:9-12` carries a second `---\nname:\ndescription:\n---`
block. `gray-matter` reads only the first, so it parses — the duplicate is dead
text in the rendered body.

### Evidence

```text
$ bun run skills:check
skills:check: 28 skill(s) scanned · 17 error(s) · 33 warning(s)
error: script "skills:check" exited with code 1

$ bun -e "matter(fs.readFileSync('<quarantined SKILL.md>','utf8'))"
THREW: incomplete explicit mapping pair … at line 3, column 64
```

After the fix, measured on the three quarantined files:

```text
minisign-pubkey-vs-secret-key    -> ["tauri"]
release-workflow                 -> []
regression: `evil-mystery-tool --flag` -> ["evil-mystery-tool"]   (still caught)
regression: `sudo rm -rf /tmp`        -> ["sudo"]                 (still caught)
regression: `tauri signer generate`   -> ["tauri"]                (still caught)
regression: `bun run x`               -> []                       (allowlisted)
```

## Impact Assessment

### Affected Components

- `scripts/skills-check-content.ts` — `extractCommandWords`
- `scripts/__tests__/skills-check-rules.test.ts` — regression cover
- `.agents/skills/.quarantine/fid-gates-unfenced-parser-contract/SKILL.md`
- `.agents/skills/.quarantine/minisign-pubkey-vs-secret-key/SKILL.md`
- `.agents/skills/.quarantine/release-workflow/SKILL.md`

### Risk Level

- [x] Low: a non-blocking lint gate reports false errors. The blocklist
      (`BLOCKLIST_PATTERNS`, `skills-check-policy.ts:7-17`) is evaluated against
      the **raw** body and is **not** narrowed by this change, so no dangerous
      pattern loses coverage.

## Proposed Solution

1. **Strip fenced code blocks** before matching inline spans. Handles ```` ``` ````
   and `~~~`, with or without an info string.
2. **Require an invocation shape** — a leading word plus at least one argument.
   A bare backticked word is prose.
3. **Skip `label: value` spans** — a second token of the form `word:` is a
   record, not a shell line.

Alternatives rejected: adding the offending words to `COMMAND_ALLOWLIST` would
launder prose into the allowlist and re-flag them the moment prose changes;
narrowing the span regex to a fixed command dictionary duplicates
`COMMAND_ALLOWLIST` as a second truth (Law 13).

4. Neutralise an inline run of 3+ backticks. RC1 has a second form: a fence
   written *inline* (``a ```markdown fence``) is not line-anchored, survives
   fence stripping, and is still an odd backtick count. A 3+ run is never a valid
   inline delimiter (inline spans use single backticks), so it is removed.
5. Quote the `fid-gates-…` description; delete the duplicated frontmatter block in
   `release-workflow`; add the four required sections (`When to Use`, `Procedure`,
   `Pitfalls`, `Verification`) to all three quarantined skills.

### Steps

1. `extractCommandWords` strips fenced blocks, then inline 3+ backtick runs,
   then requires an invocation shape and skips `label: value` spans.
2. Regression suite in a new file
   `scripts/__tests__/skills-check-false-command-words.test.ts` (8 legs: 5
   false-positive, 3 regression). Split into its own file because the 300-line
   `quality:report` ceiling left no room in `skills-check-rules.test.ts`, and
   the repo already has that precedent (FID-2026-0819-005).
3. The three quarantined `SKILL.md` files corrected.

## Perfection Loop

### Loop 1 — RED

- **RED:** 5 of 8 new legs fail on the unmodified extractor. The load-bearing
  one is `still reports a real command that follows a fence`: the parity bug
  does not only invent false commands, it **swallows a real one**, so the rule
  was under-reporting as well as over-reporting.
- **GREEN:** `extractCommandWords` rewritten per steps 1 and 4.
- **AUDIT:** 8/8 pass, 3/3 pre-existing rule legs still pass. Mutation-proven:
  with the extractor stashed, 2 pass / 6 fail; restored, 8/8.
- **ADVERSARIAL:** Tried to break the narrowing — `evil-mystery-tool --flag`,
  `sudo rm -rf /tmp`, and `tauri signer generate -w <path>` are all still
  reported. `BLOCKLIST_PATTERNS` is evaluated against the **raw** body and is not
  narrowed at all, so no dangerous pattern lost coverage.
- **CHANGE DELTA:** ~35 lines of logic.

### Missed Questions

> Questions that should have been asked at creation.

1. *Does the rule only over-report, or also under-report?* → **Both.**
   `still reports a real command that follows a fence` fails pre-fix, so a real
   non-allowlisted command after any fence was invisible. This raises the fix
   from cosmetic to a soundness fix in the gate.
2. *Is the "17 errors" figure comparable before and after?* → **Only within
   project scope.** `skills-check.ts:167` counts `errors` **only** for
   project-scoped findings; home-directory errors are demoted to warnings. The
   17 → 3 comparison is like-for-like on that counter; the `✗` line count is a
   different, larger number.
3. *Did my own change break another FID's gate?* → **Yes, and it was caught.**
   My first test file exceeded the 300-line `quality:report` ceiling, which
   turned the repo-wide `quality` gate red and therefore FID-2026-0927-003's
   `fid.gates.red` finding. Fixed by splitting the suite, not by loosening the
   ceiling.
4. *Is the allowlist a second truth for command-ness?* → It is the **authority**;
   `extractCommandWords` decides only *what to check*, never *what is safe*.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Call-graph evidence for the repaired wiring
- [x] FID status reflects the actual implementation state

**Call-graph (Law 4).** `extractCommandWords` has exactly one production
caller — the command-allowlist loop in `checkSkillContent`
(`scripts/skills-check-content.ts`). Reachability confirmed by test, not by
compilation: the 5 false-positive legs all assert an **empty** finding list, so
they can only pass if the extractor actually runs and returns nothing.

```text
$ grep -n "extractCommandWords" scripts/skills-check-content.ts
59:function extractCommandWords(text: string): string[] {
186:    const words = extractCommandWords(body)
```

**Why no `typecheck` gate:** `scripts` is not in `VALIDATION_WORKSPACE_POLICY`
(`scripts/validation-gates.ts:22-48`), so no such declaration is accepted —
`fid:verify` refuses it as "unsafe typecheck workspace". `scripts/` is also
outside `scripts/tsconfig.json`'s include list, so no typecheck gate could cover
the changed file even if one were legal. ESLint (`--max-warnings 0`) and the
three suites carry the static check here.

### Loop 2 — T95-A: `discoverSkillDirs` reported quarantined skills as missing

**RED.** Two of four new legs fail. The other two passed before *and* after by
design — they are the fail-closed guards, and a fix that could not keep them
passing would have been the wrong fix.

**GREEN.** `discoverSkillDirs` (`scripts/skills-check.ts:51-105`) is now two
passes. Pass 1 collects the quarantined draft names; pass 2 walks the trusted
tier and skips a directory that has **no** `SKILL.md` and **does** have a
quarantined twin. A single pass was impossible: the draft names have to be known
before the trusted tier can be filtered, and `readdirSync` order is not
guaranteed to yield `.quarantine` first.

**AUDIT.** 4/4 new legs; the three `skills-check*` suites total 29 pass / 0
fail. Live `skills:check` project-scoped errors **3 → 1**.

**ADVERSARIAL.** The tempting simplification is to skip *every* trusted dir with
no `SKILL.md`. That would silently discard genuine corruption — a ledger with no
skill and no draft. The twin check is what keeps it fail-closed, and it has its
own leg. A second near-miss: a trusted skill that *does* have a `SKILL.md` plus
a quarantined draft is a trusted skill with a pending edit, not a duplicate — it
must still yield both entries. Pinned by the fourth leg.

**CHANGE DELTA.** ~35 lines, one function, one new test file.

**Rejected alternative.** Downgrading the `missing` finding to a warning. That
keeps the same false positive in the report and would leave a real corruption
indistinguishable from an in-flight trust.

## Verification Gates

- gate: test scripts/__tests__/skills-check-false-command-words.test.ts
- gate: test scripts/__tests__/skills-check-rules.test.ts
- gate: test scripts/__tests__/skills-check.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:2b80c33e3ce1993b439bd1f48713d4fe3e544baae876b8008a23e0028644099e
- verified: 2026-09-28T13:29:07.041Z
- test scripts/__tests__/skills-check-false-command-words.test.ts: exit 0
- test scripts/__tests__/skills-check-rules.test.ts: exit 0
- test scripts/__tests__/skills-check.test.ts: exit 0
- quality: exit 0

## Resolution

- **Closed Date:** 2026-09-28 13:30
- **Fix Description:** `extractCommandWords` (`scripts/skills-check-content.ts:59`)
  now strips fenced code blocks, then any inline run of 3+ backticks, and only
  treats a span as a command candidate when it reads like an invocation (leading
  word plus an argument) and is not a `label: value` record. Three quarantined
  `SKILL.md` files corrected: the `fid-gates-…` description is now quoted so
  `gray-matter` parses it, `release-workflow`'s duplicated frontmatter block was
  deleted, and all three gained the four required agent-authored sections.
- **Tests Added:** Yes —
  `scripts/__tests__/skills-check-false-command-words.test.ts`, 8 legs
  (5 false-positive, 3 regression). Mutation-proven: 6 of 8 fail with the
  extractor stashed.
- **Verification Evidence:**

```text
$ bun run fid:verify dev/fids/FID-2026-0928-001-...md --write
[PASS] test scripts/__tests__/skills-check-false-command-words.test.ts (exit 0)
[PASS] test scripts/__tests__/skills-check-rules.test.ts (exit 0)
[PASS] test scripts/__tests__/skills-check.test.ts (exit 0)
[PASS] quality (exit 0)
receipt stamped (4/4)

$ bun run skills:check
skills:check: 28 skill(s) scanned · 3 error(s) · 33 warning(s)
   (was: 17 error(s) · 33 warning(s))
```

Full battery on the changed tree: `typecheck` 12/12 PASS, `test` 12 suites PASS
(7667 pass / 0 fail), `eslint --max-warnings 0` PASS, `prettier --check` PASS,
`lint:md` PASS, `validate:repository` PASS, `fid:verify --check` PASS,
`quality:report` PASS, `verify:clean` PASS, `hygiene:check` PASS.

At Loop 1 the 3 remaining project-scoped errors were **not** this FID's: `tauri`
(T95-B, operator ruling) and the 2 `missing` — the latter closed in Loop 2, which
cleared `skills:check` from 3 to 1 project-scoped error.
- **Archived:** 2026-09-28 13:30
- **Loop 2** (added 2026-09-28) closed T95-A, the `discoverSkillDirs` defect
  that was open at this FID's closure. Same-day, same record — not a second FID.

## Lessons Learned

A regex that pairs delimiters must account for delimiters it does not own. The
inline-span regex assumed every backtick was an inline delimiter, so a single
fenced block — three backticks — silently desynchronised every span after it.
The tell was not the false words themselves (`markdown`, `with`, `and` read as
harmless noise) but the *shape* of the defect: it also hid a real command, which
is what made it worth fixing rather than suppressing.

A second lesson: a `return` on the first finding turns one parse failure into an
**invisible** file. `fid-gates-…/SKILL.md` appeared to have one defect and had
five. When a gate can short-circuit, its error count is a lower bound, not a
measure.

## Open Remediation

**`tauri` — blocked on an operator ruling.** After the fix,
`minisign-pubkey-vs-secret-key/SKILL.md` reports exactly one remaining error:
`command 'tauri' is not allowlisted`. `tauri signer generate` is a genuine CLI
invocation, so RC2's label/prose rules do not and should not suppress it. The
only two ways to clear it are to widen `COMMAND_ALLOWLIST`
(`scripts/skills-check-policy.ts:24-90`) — a security-control change the agent
does not make unilaterally — or to stop writing the command as an inline span,
which would degrade the skill's accuracy. **Recorded as blocked pending an
operator ruling; it is not a defect in the checker.**
