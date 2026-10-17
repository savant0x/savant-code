# Production acceptance records (LF-005, FID-2026-1016-016)

An agent's tool calls can all return and the feature still be broken for a person: the report confirms
that a command exited, never that the terminal rendered, that resize reflowed, that the transcript folded,
that an export kept its last row, or that a resumed session showed what it claimed. Regression tests do not
close that gap either — `cli/src/components/__tests__/transcript-recovery.render.test.tsx` proves the
*deliberate-error* path, which is a different claim from "this run behaved for a human".

Acceptance is therefore a **run-bound record**, one file per run:

```text
dev/tracking/acceptance/<runId>.json
```

Start from the template, which claims nothing:

```bash
bun run acceptance:check --template run-2026-10-17-a <sessionId>
```

Then fill it in and let the gate read it:

```bash
bun run acceptance:check     # exit 0 clean, 1 with the issues listed
```

`bun run validate:repository` runs the same collector, so a malformed record fails the repository gate.

## What the record separates

| Field | What it is | What it is not |
|---|---|---|
| `modelObservations` | what the tool calls reported | not acceptance |
| `operatorUiChecks` | observations a person made natively | the acceptance evidence |
| `automatedRegression` | test files that must exist | not proof that a human saw anything |

`sessionId` + `callLedger` bind the run to the same ledger that holds its failures and fallback steps
(`dev/experiences/raw-traces.jsonl`), so a record cannot describe a run whose ledger does not contain it.

## The rules the gate enforces

- **Every UI surface has exactly one outcome** — `resize`, `input-responsiveness`, `folding`,
  `copy-export`, `resumed-history`. No aggregate "it works" claim can stand in for a surface nobody looked
  at.
- **A claimed outcome carries its observation and resolvable evidence** (`observed`/`regressed`), and
  evidence is either a repo-relative file or `run:<runId>` for something seen during the run.
- **`unverified` carries no claim at all.** An unverified surface may not carry an observation — that is
  what keeps the word honest.
- **Tool success is not acceptance.** A record with any claimed surface must contain at least one
  operator/native check.
- **`automatedRegression` entries must name a test file that exists**; "manual click-through" is not a
  regression artifact.
- **`runId` must match the file name**, so a record cannot be copied from another run.
