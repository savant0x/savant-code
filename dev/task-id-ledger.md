# Permanent task-ID ledger

`dev/task-id-ledger.json` is the permanent allocation authority for numeric task IDs.
`SCOPE.md` remains the active-work register. Closing an item removes it from scope,
but never removes its ledger allocation or changes that allocation's title.

The operator approved this ledger on 2026-10-15. Legacy numbers 1 through 190 are
reserved permanently, including gaps whose original identity cannot be recovered.
The prior register (`6a0c6439:SCOPE.md`) records the attempted reuse of 188 through 190; the historical identity
of 188 is documented in the archived install-independent undeclared-import guard FID.
The initial allocations preserve the current register's exact titles and the known
retired identity. This is a conservative reservation, not a claim that every number
in that range was issued.

For a new numeric task, use one greater than the maximum of `reservedThrough` and
all allocated numeric IDs (initially 191). Append its ID and exact bold register title
to `allocations` before adding it to scope. Never allocate a new suffix under an old
number. Existing suffixes retain their identity. FID identifiers use their separate
dated allocation procedure and are unaffected.

Do not rename an allocated task to describe unrelated work. Preserve its title and
put clarifications in the item body. For an actual identity correction, present the
change to the operator; the append-only validation deliberately rejects rewriting
committed identities. No automatic repair or renumbering occurs.

Both `bun scripts/scope-register-check.ts` and `bun run validate:repository` invoke
the same ledger validator. It rejects missing or malformed ledgers, duplicate numbers,
unallocated live tasks, title mismatches, and committed allocation deletion or mutation.
When git history is available, newly appended allocations must exceed its previous
high-water mark. Source snapshots without a `.git` directory still check the current
ledger and scope, but cannot compare against an earlier commit.
