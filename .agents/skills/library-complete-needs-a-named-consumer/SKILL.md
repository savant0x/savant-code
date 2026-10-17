---
name: library-complete-needs-a-named-consumer
description: library complete needs a named consumer
version: 0.1.0
metadata:
    origin: agent
provenanceRef: lesson:library-complete-needs-a-named-consumer
---

# Library-Complete Work Needs a Named Consumer

## When to Use

Before closing any FID, plan or task that leaves an artifact with no production
caller: a module with only its own suite, a limiter with no reader, a command
with no entry point. "Ready for the first consumer" is a hand-off, and a
hand-off is complete only when a live surface names the owner of the next step.

## Procedure

1. Name the live surface that will call the artifact, and say in the closure
   text which register item or active FID owns the wiring — a closed record is
   no longer a register item, so a limitation stated inside it is invisible to
   every register-shaped check.
2. Create the wiring item in the same pass: a scope line with its write
   targets, or an active FID with its own gates.
3. Prove the caller with Law 4 grep evidence before the feature is called
   complete.

## Pitfalls

- Closing on "no production call path yet" as a stated limitation. The
  limitation leaves the record with the record, and no gate reads a closed
  record's prose.
- Delegating adoption to "its own registered item" without creating it: the
  delegation is a claim, the register line is the evidence.
- Offering a green module suite as the completeness argument. The suite proves
  the module; only the caller proves the feature.

## Verification

- The wiring record exists (register item or active FID) and closes on Law 4
  grep evidence naming the production caller.
- `bun run validate:repository` passes: the disposition must be a register item
  or an active FID.

> Re-authored from lesson: A library-complete hand-off needs a named consumer,
> not a readiness note (dev/LEARNINGS.md → Owning FID FID-2026-1006-003). The
> previous draft's description and "When to Use" were the read_files error
> string sliced at 60 characters and its Procedure was its own name — the
> defect FID-2026-1016-015 repaired in the drafter.
