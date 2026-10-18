# FID: `fid_worktree` is unreachable — its provider-facing schema has no object root

**Filename:** `FID-2026-1017-014-fid-worktree-schema-unreachable.md`
**ID:** FID-2026-1017-014
**Severity:** high
**Status:** converged
**Created:** 2026-10-17 22:40
**Automation level:** 3
**YAGNI-Compliance:** Verified — one schema declaration in an existing
parameter module, one class-level guard test, and one record update. No new
module, dependency or service.

---

## Summary

The second A–Z acceptance run (FID-2026-1017-008) could not invoke
`fid_worktree` at all: every call was refused before dispatch with
`the arguments failed the tool schema at: action — invalid_union`. The tool is
the only one in `toolParams` whose root input schema is a
`z.discriminatedUnion`. The AI SDK therefore serializes it for the provider as
`{ "$schema": …, "oneOf": [ … ] }` — with **no top-level `type: 'object'` and no
`properties`** — while every other tool emits
`{ "type": "object", "properties": { … }, "required": [ … ] }`. An
OpenAI-compatible function-calling endpoint given a parameter object with no
described fields presents the function as effectively parameter-less, so the
model emits `{}`, and the runtime's own union validation rejects it. The lane
lifecycle was unreachable from the harness session the instrument targets.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** Git 2.52, zod 4 (`zod/v4`), `ai` SDK tool conversion
- **Commit/State:** `main` at `26bbc577`

## Detailed Description

### Problem

`fidWorktreeInputSchema` is declared as
`z.discriminatedUnion('action', [...])` in
`common/src/tools/params/tool/fid-worktree.ts`. `getToolSet` hands the raw
schema to the AI SDK (`packages/agent-runtime/src/tools/prompts.ts:213`), and
`prepareTools` forwards whatever the SDK produced
(`packages/llm-providers/src/openai-compatible/chat/openai-compatible-prepare-tools.ts:63`).

Measured with the SDK's own conversion:

```text
=== fid_worktree
root keys: $schema,oneOf
root type: undefined
has properties: false
=== glob (control)
root keys: $schema,type,properties,required,description,additionalProperties
root type: "object"
has properties: true
```

The repository already had to patch this exact schema shape once, for a
different API: `toTokenCountInputSchema` backfills `type: 'object'` because
"union/intersection schemas (anyOf/allOf) don't" carry it
(`packages/agent-runtime/src/run-agent-step/token-count.ts:38-45`). The
provider-facing path has no equivalent backfill, and backfilling alone would
still leave the model without `properties`.

### Expected Behavior

Every entry in `toolParams` must present a root JSON schema of
`type: 'object'` with its `properties` enumerated, so a function-calling
provider can describe the arguments. `fid_worktree` must accept
`{ "action": "list" }` live and keep refusing each malformed action shape it
refuses today.

### Root Cause

The root schema is a composition (`oneOf`) rather than an object. Zod emits
`oneOf` for a discriminated union; the AI SDK passes it through unchanged; the
provider has no field list to advertise. The runtime then validates the model's
empty call against the union and reports `invalid_union` — a correct rejection
of a call the model could not have shaped, because nothing told it a field
existed.

### Evidence

```text
FID-2026-1017-008 run 2 report, §4:
Attempt 1: fid_worktree { "action": "list" }
Attempt 2: fid_worktree { "action": "list" }
the arguments failed the tool schema at: action — invalid_union

$ bun dev/scratchpad/fid-provider-schema-probe.ts
=== fid_worktree
root keys: $schema,oneOf
root type: undefined
has properties: false
=== glob (control)
root keys: $schema,type,properties,required,description,additionalProperties
root type: "object"
has properties: true
```

## Impact Assessment

### Affected Components

- `common/src/tools/params/tool/fid-worktree.ts`
- `common/src/tools/__tests__/fid-worktree-params.test.ts`
- `common/src/tools/__tests__/tool-schema-object-root.test.ts` (new class guard)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: the FID-bound parallel-worktree lifecycle cannot be exercised live,
      so its acceptance surface is unreachable
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Declare the input as one flat, strict object — `action` an enum, `fid_id` and
`discard_changes` optional — and enforce the per-action requirements with
`superRefine`, which `z.toJSONSchema` does not serialize. The provider now sees
`type: 'object'` with all three properties; the runtime keeps every refusal it
has today (missing `fid_id` for `create`/`merge`/`dispose`, unknown keys,
`discard_changes` outside `dispose`, malformed ids, unknown actions).

Add a class-level guard so a future union-rooted tool cannot repeat this:
every `toolParams` entry's JSON schema root must be `type: 'object'`.

### Steps

1. Rewrite `fidWorktreeInputSchema` as a flat strict object + `superRefine`. —
   implemented (`common/src/tools/params/tool/fid-worktree.ts:30-63`)
2. Extend the params suite with the per-action refusals and the root shape. —
   implemented
   (`common/src/tools/__tests__/fid-worktree-params.test.ts:42,67`)
3. Add the class-level object-root guard over `toolParams`. — implemented
   (`common/src/tools/__tests__/tool-schema-object-root.test.ts:28`)
4. Re-run the provider-facing probe and the declared gates. — implemented
   (`fid_worktree` now reports `root type: "object"`, `has properties: true`)
5. Record run 2 and this blocker on FID-2026-1017-008 without claiming
   acceptance. — implemented

### Verification

The provider conversion must report `root type: "object"` and
`has properties: true` for `fid_worktree`. The params suite must keep rejecting
`{action:'list', fid_id:…}`, `{action:'create'}` without `fid_id`,
`{action:'merge', discard_changes:true}`, unknown keys and malformed ids, and
must accept `{action:'list'}` and `{action:'dispose', fid_id, discard_changes}`.
The lane suites and the real-git probe must stay green.

## Verification Gates

- gate: test common/src/tools/__tests__/fid-worktree-params.test.ts
- gate: test common/src/tools/__tests__/tool-schema-object-root.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts
- gate: probe scripts/probes/fid-worktrees.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b78dc032a743e049fa493c787e29ffced06a6cb63a52a6f53e46a2694cdb4e01
- verified: 2026-10-18T02:30:51.452Z
- test common/src/tools/__tests__/fid-worktree-params.test.ts: exit 0
- test common/src/tools/__tests__/tool-schema-object-root.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-tool.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-provision.test.ts: exit 0
- probe scripts/probes/fid-worktrees.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The provider payload for `fid_worktree` is
  `{ $schema, oneOf }`; the model saw no field list and emitted `{}`.
- **GREEN:** Flat strict object; per-action rules move to `superRefine`, which
  does not reach the provider schema.
- **AUDIT:** Every refusal the union encoded is still encoded — unknown keys by
  `.strict()`, missing `fid_id` and misplaced `discard_changes` by refinement,
  bad ids by the existing regex.
- **ADVERSARIAL:** A refinement-based refusal reports a different message than
  `invalid_union`. That is the point: the model must be told which field is
  wrong. No refusal becomes an acceptance.
- **CHANGE DELTA:** 100% (initial authoring).

### Missed Questions

1. **Why not backfill `type: 'object'` in `prepareTools`?** It would repair the
   missing keyword but still ship no `properties`, so the model would still be
   blind to `action`; and it would change every tool's wire payload to treat a
   symptom of this declaration.
2. **Does `superRefine` survive `z.toJSONSchema`?** No — refinements are not
   serialized, which is exactly why the conditional rules can live there while
   the provider schema stays a plain object.
3. **Is the text-protocol prompt also broken?** It rendered the full `allOf`
   union, so it was never parameter-less; the failing path was the native tool
   schema. Both paths improve or stay neutral.

## Resolution

- **Closed Date:** pending
- **Fix Description:** pending
- **Tests Added:** pending
- **Archived:** pending

## Lessons Learned

A schema that is valid zod is not automatically a valid *model-facing* schema:
composition at the root hides the field list from function-calling providers.
The repository had already recorded this failure class for `count_tokens`; the
lesson is now a test, not a comment.
