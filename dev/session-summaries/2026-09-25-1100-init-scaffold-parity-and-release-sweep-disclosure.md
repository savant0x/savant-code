# Session Summary — 2026-09-25 11:00

**Repo `.agents/types/` scaffold repaired to byte-parity with the shipped templates; `/init`
pinned end-to-end in a real temp project; the release automation commit can no longer sweep a
never-committed file in silently. Two product findings are registered for a ruling (Task 87).**

## Trigger

Operator instruction: read the single-agent protocol 0-EOF and ground in the project, then work
three click-through items — remove the four "generation-1 orphan" type copies in `.agents/types`,
verify the `/init` scaffold end-to-end in a temp project, and extend the automation release
commit's sweep warning beyond `dev/` + `SCOPE.md` with a pin.

A mid-course correction arrived first: the operator explained that the four untracked files came
from **their own `/init` run during testing**, which closed the provenance question this session
had opened (content byte-identical to the templates; only `init.ts` writes that content at that
path).

## Grounding (before any edit)

Governance: `ECHO-single-agent.md` is the marker — `ECHO.md` v0.2.0 does **not** govern a solo
session; `dev/echo-v0.1.2-single-agent.md` read 0-EOF (`strict_mode: true`, session ceiling
`autonomy_level: 3`). `protocol.config.yaml`, `coding-standards/typescript.md`,
`dev/LEARNING-RULES.md`, `dev/LEARNINGS.md`, `templates`/register layout, the active FID queue
(one record: FID-2026-0924-001, `verified`, not closed) and `SCOPE.md` (Task 82/83/84/85 open
items) were read. The register's own rules governed the records written here.

## RED — the premise failed before the work started

The approved item was "remove the four orphans". The census said otherwise: the four files are
the **dependency closure of a stale tracked hub**, and deleting them alone would have broken it.
Presented back with evidence and the corrected plan; the operator chose *refresh 3 + delete 4*.

```text
.agents/types/agent-definition.ts:229-237  from './agent-runtime' | './model-name' | './provider-options'
.agents/types/agent-definition.ts:254-256  from './available-tools'  (re-exported)

.agents/types state before repair (12 files)
  STALE    agent-definition.ts       8654 B  (template 8990)
  STALE    tools.ts                  4524 B  (template 3108)
  STALE    tool-params-discovery.ts  2856 B  (template 5395)
  CURRENT  agent-definition-support.ts · agent-models.ts · tool-params-core.ts
           tool-params-research.ts · util-types.ts
  EXTRA    agent-runtime.ts · available-tools.ts · model-name.ts · provider-options.ts
```

Root cause of the drift: `init.ts` copies only **absent** files (never clobbering user edits), so
a project `/init`-ed before the 8-file decomposition keeps its old hub forever and nothing
detects it. The current template closure never references the four names (verified: the 8
templates' relative imports are a closed set).

## GREEN

| Area | Change |
| --- | --- |
| `.agents/types/` | 3 stale files synced byte-exact from `common/src/templates/initial-agents-dir/types/`; 4 generation-1 siblings removed → exactly the 8 `/init` files |
| `cli/src/commands/__tests__/init-scaffold.test.ts` (new) | 4 tests driving the real command into a real temp project (lands/skips/orphans, no-clobber, import closure, external dependency surface) |
| `scripts/public-release/git-publish.ts` | `untrackedPaths(porcelainZ)` + a never-committed disclosure; the status read switched to the `-z` form |
| `scripts/public-release-git.test.ts` | 2 pins (positive incl. a path with spaces; negative for tracked-only sweeps) |
| `scripts/public-release-desktop.test.ts`, `scripts/public-release-tag-hygiene.test.ts` | formatter-only repair of two files already failing the live format gate |
| `scripts/public-release-desktop-release-contract.test.ts` (new) | the desktop workflow-contract block moved out of the primitives suite (300-line ceiling split, content unchanged) |
| `scripts/public-release-sweep-disclosure.test.ts` (new) | the two sweep-disclosure pins moved out of the git & worktree suite (same ceiling) |

## AUDIT (all live this session)

| Gate | Result |
| --- | --- |
| `bun run typecheck` | **12/12 exit 0** |
| `eslint . --max-warnings 0` | exit 0 |
| `prettier --check .` | clean (was **red on 2 files** at session start) |
| `lint:md` | clean (was **red on 2 inline-HTML lines** at session start) |
| `quality:report` | **PASS (1498 baselined files)** — was **red on 2 over-ceiling suites** |
| `validate:repository` | **PASS** (was FAIL, 10 issues) |
| FID-2026-0924-001 receipt | **5/5 gates PASS** live, stamped `sha256:2f771f07…` @ `2026-09-25T15:06:12Z` |
| Release battery (22 files) | **145 pass / 0 fail** (was 143) |
| cli init suites (2 files) | **14 pass / 0 fail** |
| `/init` e2e pin | **4 pass / 0 fail**, 65 expects |
| Scaffold parity | `cmp -s` 8/8 identical to templates |
| Scaffold compile, root-inheriting probe | **exit 0** with `zod`; exactly one TS2307 without it |
| Changed release module, root-inheriting `tsc` probe | **exit 0** (probe deleted after use) |
| Mutation proof (pin is load-bearing) | collapsing `?? ` → `!! ` fails the positive leg (`Received: ""`); restored, 9/9 |

Call-graph (Law 4): `untrackedPaths` → `commitAllAutomationChanges:102` →
`commitAutomationChangesOrTagHead` → `stages.ts:92`.

## Inherited red gates (found by running the whole battery, repaired in-pass)

The working tree carried uncommitted work from 2026-09-24 whose gates were **red before this
session changed anything**. Each was measured first:

| Gate | State found | Repair |
| --- | --- | --- |
| `prettier --check .` | red: `scripts/public-release-desktop.test.ts`, `scripts/public-release-tag-hygiene.test.ts` (diff-pure reflows) | formatted both, path-scoped |
| `quality:report` | red: `scripts/public-release-desktop-workflow.test.ts` 324 lines and `scripts/public-release-git.test.ts` 333 lines, both over the 300-line absolute ceiling | split each along its own seam into a sibling file; no test dropped (battery 145 across 24 files) |
| `lint:md` | red: raw `<version>` inline HTML at `dev/fids/README.md:27` and `SCOPE.md:286` | backticked the placeholder; prose untouched |
| `validate:repository` | FAIL (10 issues), 7 of them from FID-2026-0924-001's receipt block reading `pending` while its Resolution claimed a live five-gate receipt | ran `fid:verify --write`: 5/5 declared gates PASS live, receipt stamped; gate now PASS |

Those four repairs are registered as T86-C, T86-E, T86-F and T86-G rather than narrated here, so
the register — not this summary — is the record of what was fixed and with which evidence.

## Adversarial pass

1. **Was the delivered scope the approved scope?** No — the approved deletion would have broken a
   tracked file. The corrected plan was presented and approved *before* any mutation, and the
   register records the correction rather than the original instruction.
2. **Is the new pin tautological?** Proven not: mutating the helper silences the disclosure and
   the positive leg fails. The negative leg keeps the disclosure evidence-derived rather than
   unconditional.
3. **Does the `-z` switch change anything else?** No: the other status read in the same module is
   untouched, and `-z` was measured (`?? <path>`, NUL-separated, unquoted) rather than assumed —
   the non-`-z` form quotes a spaced path, which is precisely how a comparison goes silent.
4. **Could the scaffold repair hide a real user-facing break?** Checked rather than asserted: the
   template closure is self-contained, and the only external requirement is `zod/v4/core`
   (T87-A) — a pre-existing product property, now measured and registered instead of discovered
   by a user.

## Corrections made in this session (own errors, recorded)

- The first closure pin failed on a **false positive**: the scan matched `from
  './types/agent-definition'` inside the scaffold's own doc comment. Fixed by stripping comments
  before scanning (house practice) plus a non-vacuous guard.
- `bun run --cwd=cli typecheck` was run from inside `cli/`, resolving to `cli/cli` and reporting a
  false failure; re-run correctly from the repository root.
- A comment added to `git-publish.ts` landed on a signature line (HEAD splits that
  `if`/`fail` pair; the working copy had it joined). Repaired with the formatter.
- My own new test file failed `tsc` once (`string | undefined` into `toBe`); fixed by iterating
  the map rather than indexing it.

## Findings registered

- **T87-A** — the scaffold imported `zod/v4/core`, which a user project does not declare:
  measured `TS2307` in a temp project, `exit 0` once zod was present. Ruled and fixed in this
  session (below).
- **T87-B** — a scaffold older than a decomposition can never refresh, and nothing checks
  parity; this repo's own drift is the worked example. Still awaiting a ruling.

## Ruled and executed in-session (three operator directives)

**T87-A — the `/init` scaffold is now self-contained.** `util-types.ts` imports nothing;
`JsonSchema` is `boolean | JsonSchemaObject`, with values typed `unknown` because that is the
bound the runtime enforces when it compiles a schema (`convertJsonSchemaToZod`) and because
schemas also arrive from dynamic sources. That bound was reached by measurement: a `JSONValue`
bound was tried first and **failed the gate** (`TS2322` on `dynamic-agent-template.test.ts`) —
the dynamic layer produces `{[key: string]: unknown}`, so a JSON-value bound is narrower than
what the pipeline accepts. Evidence: a temp user project with **no `node_modules`** compiles
`tsc --strict` at **exit 0** (was `TS2307`); `.agents/types/util-types.ts` re-synced byte-exact;
the `/init` pin's dependency ceiling updated to **empty** with an anti-vacuity guard (4/4);
full typecheck 12/12.

**T84-B — `scripts/` has a standing type-check surface.** New `scripts/tsconfig.json`
(root-inheriting) covers the release engine, its `public-release*.test.ts` suites and the two
release suites in `scripts/__tests__/`; wired as `package.json` → `typecheck:scripts` inside the
`typecheck` chain, mirrored in `protocol.config.yaml` → `commands.type_check`. The recorded
blocker's assumption was **wrong**: no `VALIDATION_WORKSPACE_POLICY` edit is possible or needed,
because that parity check runs over the workspace inventory and `scripts/` is not a workspace —
adding an entry would have been flagged as missing from the inventory. Making the surface green
rather than scoping around it surfaced 7 errors, all one class: fetch doubles rejected because
`typeof fetch` is Bun's global (it carries `preconnect`) while the seam only calls
`(input, init?) => Promise<Response>`. Fixed once at the seam (`fetch-seam.ts` → `ReleaseFetch`,
consumed by five modules) instead of a double assertion per test. **Load-bearing, proven by
mutation:** changing `positiveEnvMs`'s return type to `string` fails the leg at **5 call sites**
(exit 2) — precisely the class that needed a hand-built probe in each of the last three sessions.
T84-C records the remaining boundary (`scripts/**` outside the engine, still 117 errors) as an
open item rather than letting the narrowed include imply the tree is typed.

**T85-E — FID-2026-0924-001 closed and archived.** Status `verified` → `closed`; Resolution
restructured to the closure format; moved to `dev/fids/archive/`; receipt re-stamped LIVE at the
archived path (**5/5 gates**, `sha256:0cbb8d44…`, `2026-09-25T15:31:07Z`); CHANGELOG subsection,
archive index entry and ledger annotation added. **The active FID queue is empty.**

## Records

- `SCOPE.md` — **Task 86** (complete, 5 items with evidence) and **Task 87** (blocked pending an
  operator ruling, specific blocker named per item). Inserted at the head of the register: the
  file is at 98,781 chars before this edit, so tail inserts would hit the 100,000-char read
  limit recorded in `dev/LEARNINGS.md`.
- This summary. No FID was opened (simple-task path: no new APIs, no novel architecture, both
  changes under 100 lines); no CHANGELOG entry, since none was closed.
- No signatures or attribution anywhere, per the protocol's signing policy.

## Open items

- **G2 (operator):** nothing was committed. The tree now carries this session's changes plus the
  2026-09-24 set; every standing gate in the battery is green on that tree.
- **T84-C (operator ruling):** the rest of `scripts/**` (providers tree, remaining test globals)
  is still untyped — measured 117 errors; whether to fix them or widen the surface tree by tree is
  a scoping decision.
- **T87-B (operator ruling):** whether `/init` gains a refresh or parity path for a scaffold that
  predates a decomposition (the never-clobber guarantee is what makes the drift permanent).
- **Deliberate non-change:** the release test helpers still carry `as unknown as typeof fetch`
  casts from before the seam was typed. They remain valid and were left alone — the seam now
  accepts them, and removing working casts in other people's helpers is churn, not a fix.
- **Task 87 (operator ruling):** the scaffold's `zod/v4/core` dependency, and whether `/init`
  gains a refresh/parity path.
- **T84-B (operator ruling, unchanged):** `scripts/` still has no standing type-check surface —
  this session built the third hand-made `tsc` probe in three sessions, which is itself the
  evidence for that ruling.
- **Boundary (honest):** the `/init` verification ran the command's implementation through the
  real project-root seam, not the interactive TUI path; the release-sweep disclosure was proven
  against real temp git repositories, not against a live release cut.
