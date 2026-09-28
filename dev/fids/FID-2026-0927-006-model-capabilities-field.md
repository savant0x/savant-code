# FID: Should `OpenRouterModel` carry a `capabilities` field?

**Filename:** `FID-2026-0927-006-model-capabilities-field.md`
**ID:** FID-2026-0927-006
**Severity:** low
**Status:** converged
**Created:** 2026-09-27 20:20
**Automation level:** 3

> **Status: `converged` — a decision record, not a feature. ZERO code changed.**
> The deliverable is the decision and its evidence. Ruled during the
> FID-2026-0927-005 work when the cleanapis catalog exposed the field and no
> live parser read it.

## Summary

**Do not add `capabilities` to `OpenRouterModel`.**

Four of the vendor's six flags carry no information the payload does not
already state elsewhere, the one flag that *is* independent is a single
boolean rather than an array, and the only production consumer in the repo
reads a field `capabilities` does not even contain. Adding it would introduce a
second representation of facts the type already carries — a Law 13 violation
(two truths for one fact) with no consumer to justify it.

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Scope:** read-only analysis; no workspace files modified
- **Evidence source:** live `GET https://cleanapis.com/v1/models`, 33 models
- **Governance:** ECHO Protocol v0.2.0, Law 13 (one function, one truth)

## Detailed Description

### The question

`cleanapis` is the only catalog that serves a per-model `capabilities` array:

```json
"capabilities": ["reasoning", "vision", "tools", "streaming", "json_mode"]
```

`OpenRouterModel` has no field for it, and no parser reads it. So: should the
shared type carry it, and does it duplicate what `architecture.input_modalities`
and `supported_parameters` already imply?

### Evidence 1 — four of six flags are derivable or constant

Cross-tabulated over all 33 live models:

| Flag | Count | Derivable from | Independent? |
|---|---|---|---|
| `vision` | 28/33 | `architecture.input_modalities.includes('image')` | **No — 0 disagreements** |
| `tools` | 28/33 | `supported_parameters.includes('tools')` | **No — 33 agree, 0 disagree** |
| `reasoning` | 32/33 | `supported_parameters` (`reasoning` / `include_reasoning`) | **No** |
| `streaming` | **33/33** | — | **No — constant true** |
| `json_mode` | **33/33** | — | **No — constant true** |
| **`web_search`** | **11/33** | **nothing in `architecture` or `supported_parameters`** | **YES** |

The `vision` split is *identical* in both fields — 28 with, 5 without, zero
disagreements across 33 models. That is not correlation; it is the same fact
stored twice.

`streaming` and `json_mode` are present on **every** model, so they can never
discriminate between two entries in the picker. A field that is always true
carries no decision value.

Distinct capability sets across the catalog — four, covering all 33 models:

```text
17x  ["json_mode","reasoning","streaming","tools","vision"]
11x  ["json_mode","reasoning","streaming","tools","vision","web_search"]
 4x  ["json_mode","reasoning","streaming","tools"]
 1x  ["json_mode","streaming"]
```

Note that the only three things that ever vary are `vision`, `reasoning`, and
`web_search` — and two of those are already stated elsewhere.

### Evidence 2 — the one real consumer reads a different field

A repo-wide grep for production reads of the capability-shaped fields:

- `cli/src/utils/openrouter-models/model-info.ts:67-68` — **the only genuine
  read**, and it renders `modality`:

  ```ts
  if (model.modality) {
    lines.push(`- **Modalities:** ${model.modality}`)
  }
  ```

- `cli/src/utils/openrouter-models/openrouter.ts:55,60` — *writes*
  `modality` and `reasoning` from the gateway payload.

Every other `.reasoning` hit is unrelated local state
(`headless-ndjson.ts`, `think-parsing.ts`, `prompt-agent-stream.ts`,
`convert-to-openai-compatible-chat-messages.ts`).

**`capabilities` does not contain `modality`.** The one field the UI actually
renders is not in the array. The array's `vision` flag is a *weaker proxy* for
`architecture.modality` (`"text+image->text"`), which the vendor sends and the
type already carries.

`supported_parameters` — the field `tools`/`reasoning` derive from — appears
**zero times** in `cli`, `common`, `packages`, or `sdk`. It is not on the type
either, so that derivation target is currently unavailable in-repo.

### Evidence 3 — one vendor means one populator

`cleanapis` is the only catalog that sends `capabilities`; `grep` across every
parser in `cli/src/utils/openrouter-models/*.ts` returns nothing. A field on
the shared type that exactly one of twenty providers populates makes `undefined`
the normal case — the shape of a field that *looks* load-bearing and is not,
which is the precise class `FID-2026-0927-002` documents and `FID-2026-0927-005`
already reproduced once.

## Root Cause

Not a defect. The field arrived with a vendor payload and the instinct was to
give it a home on the type. The missing step was asking whether the home would
be **read** and whether the contents were **new** — and on both counts the
answer is no.

This is the "looks load-bearing and is not" pattern in its purest form: a
plausible, well-shaped field that adds a surface without adding a capability.

## Impact Assessment

- **Severity:** low — the field does not exist, so nothing can regress.
- **Risk of the rejected option:** a shared-type field populated by one provider
  in twenty, six flags of which two are constant and two duplicative. It would
  be consulted by future authors, found empty for most providers, and either
  trusted where empty or worked around — all cost, no benefit.
- **Reversibility:** the decision is free; adding the field later is additive.

## Proposed Solution

Ruled: **no change to `OpenRouterModel`.**

1. **`capabilities` is not added.** Evidence above.
2. **`web_search` is the only flag worth keeping, and it is not worth an
   array.** If a consumer ever needs it, model it as a single explicit boolean
   derived from the vendor payload — not as a six-element string array. No such
   consumer exists today, so this is not actioned now.
3. **Do not add `supported_parameters` either**, for the same reason — nothing
   reads it, and adding it would create the same one-populator drift axis. It is
   the natural companion to a future `web_search` boolean if one is ever needed.
4. **The real gap is the nested-shape mapping**, not this field. See
   `FID-2026-0927-005` → *Open Remediation*: `topProvider`, `modality`,
   `tokenizer`, `instructType` and the pricing fields all exist on the type and
   **are** consumed, but this vendor nests them. Fixing that adds real
   information to the picker; adding `capabilities` would add none.

> **Gate-section contract:** the gate parser accepts **only** `- gate:` lines
> between the heading below and the next `##` — so this note sits **above** the
> heading, not under it. (Author's own repeat offence: this same note was placed
> below the heading in an earlier draft of this record and in FID-0927-005, and
> `fid:verify` rejected both with `malformed gate declaration`. The rule is
> positional, not semantic.)
>
> Because this record changes no code, the gates do not verify a change; they
> verify that the **current** type (without the field) compiles and that the
> catalog suites documenting the omission still pass. A decision record gating
> on tests of code it did not write would be claiming credit it has not earned.

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test cli/src/utils/__tests__/openrouter-models-cleanapis.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-vercel.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:07a4caa7513b57128d1100dd76b30226db196461d6dfd66dd725f4d25297b32c
- verified: 2026-09-28T00:27:36.568Z
- typecheck cli: exit 0
- typecheck common: exit 0
- test cli/src/utils/__tests__/openrouter-models-cleanapis.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-vercel.test.ts: exit 0
- quality: exit 0

## Step Status

- [x] Probe the live payload for the actual flag values (33 models)
- [x] Cross-tab `capabilities` against `architecture.input_modalities` — 0
      disagreements on `vision`
- [x] Cross-tab `capabilities` against `supported_parameters` — 0 disagreements
      on `tools`; `reasoning` matches too
- [x] Identify constant flags (`streaming`, `json_mode` — 33/33)
- [x] Identify the one non-derivable flag (`web_search`, 11/33)
- [x] Find every production consumer of the capability-shaped fields
      (`model-info.ts:67-68` is the only read; it uses `modality`)
- [x] Confirm `supported_parameters` has no in-repo presence
- [x] Confirm no other provider sends `capabilities`
- [x] Rule: **do not add the field**

## Perfection Loop

### Missed Questions

1. **Would a picker badge ("vision" / "tools") be worth having?** Plausibly, but
   it is a **UI** change, not a type change, and it would consume
   `architecture.modality` / `architecture.input_modalities` — which already
   reach the type via the nested-shape fix. Adding `capabilities` first would
   build the badge on the weaker duplicate. Out of scope here; the honest next
   step is the mapping fix, then a badge that reads it.
2. **Should `web_search` be recorded as a follow-up FID?** Not yet — no consumer
   exists, and creating a record for a speculative boolean is the same
   speculative-shape failure one level down. Revisit when something needs it.
3. **Does the vendor document `capabilities` as stable?** Not checked, and not
   load-bearing: a field that is 4/6 redundant and 1-vendor would be rejected
   even if perfectly documented.
4. **Could a second vendor send it and make it common?** Possible, which is the
   argument for waiting rather than against acting. The decision is cheap to
   revisit when a second populator exists.

### Code Verification Evidence

- [x] **Decision is a no-op on code** — `git status` shows no file under
      `cli/src/utils/openrouter-models/`, `types.ts`, or the cleanapis parser
      changed by this record.
- [x] Typecheck — `cli` and `common` exit 0, proving the type stands without
      the field.
- [x] Tests — the cleanapis suite (8 legs) and the vercel suite both pass; the
      cleanapis suite's docblock already records that the catalog field names
      were **inferred, not measured**, which is the gap this analysis closed.
- [x] Lint — `eslint . --max-warnings 0` exit 0; `lint:md` clean; `prettier
      --check .` clean.
- [x] `validate:repository` PASS; `quality:report` PASS.

- **RED:** complete. The two questions — does anything consume it, does it
  duplicate — were both open and both answered with counts, not impressions.
- **GREEN:** complete. The decision is implemented as *not changing the type*,
  which required no edit.
- **AUDIT:** complete. The decision was re-checked against the strongest
  counter-argument: a picker badge is genuinely desirable, and the record
  routes that to the field that already carries the data rather than the
  duplicate array.
- **ADVERSARIAL:** the refutation to weigh is "two providers will send it
  eventually, so add it now." Rejected: the field is 4/6 redundant *regardless
  of how many send it*, and the badge the record defers is better served by
  `modality`, which two of six flags do not replace.
- **COMPLETE:** reached. The decision is recorded; the deferred work is named
  with its correct home.

## Resolution

- **Resolved by:** this record
- **Resolution date:** 2026-09-27
- **Verified by:** tool-mediated runs quoted in *Code Verification Evidence*
- **Verification date:** 2026-09-27
- **Verification receipt:** see `### Verification Receipt` below
- **Closed by:** _not closed_ — a decision record is closed when the ruling is
  implemented, and here the ruling is a no-op
- **Close date:** _n/a while the deferred mapping fix is open_
- **Archived:** no
- **CHANGELOG entry:** _none_ — no code shipped, and the changelog-coverage gate
  correctly requires an entry only for **archived** records. A release note for
  a decision that changed nothing would be a false claim of shipped work.

## Deferred, with its correct home

1. **The nested-shape mapping** — `FID-2026-0927-005` → *Open Remediation*.
   Populating `topProvider` / `modality` / `tokenizer` / `instructType` /
   pricing from the vendor's nested objects. This is the change that would put
   real per-model information in front of the picker.
2. **A picker capability badge**, *after* (1), reading `modality` /
   `input_modalities` — not `capabilities`.
3. **`web_search` / `supported_parameters`**, only when a consumer exists.

## Lessons Learned

- **A new field is a claim about the future.** Adding `capabilities` would have
  asserted that some consumer will need it. The cheap check is to count
  consumers first — the answer here was *one, and it reads a different field*.
- **Constant and derived data are the two ways a field is free of information.**
  `streaming` and `json_mode` are true on 33/33 models, so they cannot
  discriminate; `vision` and `tools` are perfectly derivable, so they cannot add
  to what the payload already says. Only `web_search` (11/33) survived, and one
  boolean would hold it.
- **"No other provider sends it" is a measurement, not an assumption.** The grep
  across all parsers is what turned a hunch about scope into a fact about drift
  risk — and it is the same fact pattern `FID-2026-0927-005` turned into a
  structural mapping finding.