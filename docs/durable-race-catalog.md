# Durable race catalog

FID-2026-1006-002 WP2 (T149 idea 2), adopted from the pi harness `harness.md`
Part 9 discipline: *every* durable mutation race is enumerated with exactly two
durable histories and the required outcome of each order, and each order is
either proven by a test or carries an owner that will prove it.

**Scope of a "durable" write here:** a statement that mutated one of the domain
tables (`sessions`, `message_history`, `cost_tracking`, `agent_templates`,
`fid_documents`) through `packages/database/src/commit-journal.ts` —
`runCommit()` is the single seam (Tier B asserts its order), and a
read-modify-write of durable state goes through
`packages/database/src/mutation-line.ts` (WP4; the R6 row). Bootstrap DDL and
the `schema_version` anchors in `packages/database/src/index.ts` run once per
connection before any domain write exists and are pinned by the schema-version
assertions in `src/__tests__/durable-races.test.ts` instead.

**Durability model the catalog assumes (and pins):** one SQLite file,
`PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, autocommit — there is
no explicit close/commit API in this package, so "durable" means *a statement
that returned has been committed to the WAL and is visible to a new connection
to the same file*.

**Status vocabulary:** `PROVEN` = a named test asserts this order's outcome
today. `OPEN` = the required outcome is specified but not yet achieved; the
owner that will achieve it is named (no agent-side drop).

**Claimed API shapes, stated so they are not mistaken for races:**
`updateSession(id, snapshot)` commits a caller-held COMPLETE next state, so the
last such call wins by declaration — that is not a lost update, it is the
caller asserting it holds the state. A caller whose next state depends on what
is stored must use `mutateSessionState(id, transform)` instead. A third shape —
reading a total, then committing a delta of it — has no in-package
read-modify-write entry point today; the only such caller is the CLI's usage
persistence (`cli/src/utils/db-storage.ts`), which is synchronous and not
listed here as a race until a durable RMW entry for it exists.

| # | Race | Order A | Order B | Required outcome | Status |
|---|---|---|---|---|---|
| R1 | Session append vs process loss | `createSession` returns, then process dies | process dies before `createSession` returns | A: the row is present after reopening the file. B: no row, and no half-row | PROVEN — `durable-races.test.ts` Tier A |
| R2 | Message append vs process loss | `createMessage` returns, then process dies | dies before it returns | Same as R1, for `message_history` | PROVEN — Tier A |
| R3 | Usage row vs entry materialization | `createCostRecord` then `createMessage` | `createMessage` then `createCostRecord` | Both orders end with exactly one row in each table and an aggregate that equals the inserted sum — the two rows are independent, so no ordering may lose or duplicate one | PROVEN — Tier B composite + Tier C aggregate |
| R4 | Duplicate message id | `createMessage(id=X)` | the same `createMessage(id=X)` again | Exactly one row, whichever order the two attempts land in (`INSERT OR IGNORE`); the read-back returns the FIRST content, never a rewrite | PROVEN — Tier C |
| R5 | Two writers, different columns | `updateSessionModel` | `updateSessionUnread`, concurrently | Both effects survive: they target distinct columns, so no write may clobber the other | PROVEN — Tier C |
| R6 | Two writers, SAME JSON blob (lost update) | writer A derives its next state, writer B commits, then A commits | same, reverse enqueue order | **Required: the state a writer commits is derived from the state stored when its turn arrives, so neither writer's fields are lost; the surviving blob is exactly one transform's returned value — no merge, no partial field mix** | PROVEN — Tier C, through `mutateSessionState` (WP4's line). The discriminator is real: bypassing the lane in `mutate()` makes the Tier C assertion fail (`fromB` undefined) |
| R7 | Concurrent updates to one row via one writer | two `updateSession` calls awaited in sequence | same, reverse order of fields | The last committed snapshot is the stored one; the row is never left torn (never a blend of the two) | PROVEN — Tier C (asserts "exactly one of the two snapshots") |
| R8 | Foreign-key violation vs silent skip | `createMessage` with an unknown `session_id` | same write after the session row exists | A: **no** row is written and the failure surfaces to the caller — the write must never be silently dropped. `INSERT OR IGNORE` does not cover foreign keys (SQLite ignores UNIQUE/NOT NULL/CHECK, not FK), so the driver error propagates as `FOREIGN KEY constraint failed`. B: one row | PROVEN — Tier C |
| R9 | Bootstrap vs first domain write | schema created, then the first write | write attempt before the schema exists | A: the write lands. B: the bootstrap runs first (lazy `getDb()`), so a caller can never observe a missing-table error | PROVEN — Tier A (schema version present on a fresh connection) |
| R10 | No-op update vs write surface | `updateSessionModel` on a missing id | the same on an existing id | A: zero rows changed, but the seam still records exactly ONE commit attempt — a no-op must be observable, never invisible | PROVEN — Tier B |

## Transaction tables (Tier B write-order conformance)

The exact ordered write surface of each catalogued transaction, asserted by
`packages/database/src/__tests__/write-order-conformance.test.ts` against the
journal. Any change that adds, drops, reorders or retargets a write makes this
catalog and its test disagree — which is the point.

| Transaction | Exact ordered writes |
|---|---|
| create session | `insert sessions` |
| append message | `insert message_history` |
| record usage | `insert cost_tracking` |
| update model / scope / unread / pinned | `update sessions` (one record each) |
| update session state | `update sessions` |
| create + update agent template | `insert agent_templates`, `update agent_templates` |
| create + update FID document | `insert fid_documents`, `update fid_documents` |
| one turn (session + message + usage) | `insert sessions`, `insert message_history`, `insert cost_tracking` |
| no-op update | `update sessions` (recorded, `changes: 0`) |
| serialized session-state mutation (WP4) | `update sessions` — the reads the line performs inside the lane are not writes |

## How to extend this catalog

1. Name both durable orders and the required outcome of each.
2. Add the transaction's exact write order to the table above.
3. Add the Tier B row and the Tier C interleaving to the tests.
4. If the required outcome is not achievable today, the row is `OPEN` with the
   owning work package named — never silently removed.
