# Session summary — scholars-search completion review

**Date:** 2026-10-12
**Status:** completed
**FID:** FID-2026-1012-001
**Governance:** ECHO v0.1.2 single-agent; strict mode; autonomy level 3.

## Initial state

The operator requested review and completion. Implementation is committed at
`346d74ca84363a001109afed839fd1d2346b9ac8`; the active FID says verified but
retains pre-approval/uncommitted language. The earlier summary claims closure,
although the record is active, its scope entry remains, and no changelog entry exists.
The working tree was clean at intake. All four original FID gates pass live.

## Review findings and intended repairs

- Align scholarly routing across system and instruction prompts. The existing
  instructions unconditionally demand web search and three fetched web pages,
  contradicting the new MCP-first paper path. Keep that rule for web research;
  require fetched paper records and honest abstract/full-text limits for literature.
- Correct arguments against the live MCP schemas: `abstracts` is a string enum
  (`none`, `short`, `full`), result count is `limit`, and citation exploration
  uses `breadth` plus `limit`. Remove hardcoded coverage numbers from instructions.
- Add definition regression pins and a hermetic runtime test exercising the real
  MCP loader and model tool-set builder, including server-failure fallback.
- Update the four capability summaries noted by the prior audit and regenerate
  the agent bundle. No new dependency, tool union, runtime API, or role is needed.
- Correct the FID and earlier summary, add the missing changelog entry, commit
  explicit paths, archive the completed record, and remove its scope authority.

## Live evidence

The existing MCP client discovers all four tools with read-only annotations.
The production `getMCPToolData` and `getToolSet` chain produces seven model tools:
three native research tools and four `scholars-search__*` tools.
A one-result semantic search succeeds; citation traversal succeeds. A DOI lookup
returned not found, and similarity on that DOI reported an unembedded paper.
These are service-result boundaries, not proof the client failed. Further checks
will use an OpenAlex id returned by the successful search.

No LLM request, model-credit spend, credential change, or publication is needed.

Further live checks succeeded using `W4390591490` from search: paper lookup
returned its full record and DOI `10.1039/bk9781837670178-00159`, and similarity
returned `W4290802925`. All four MCP tool paths therefore have successful
round trips. The prompt treats missing records as evidence gaps and does not
infer the cause of 502/503 responses.

## Verification

- RED-first definition regression: 3 pass / 2 fail before the prompt repair;
  5 pass / 0 fail afterward.
- Agent workspace suite plus the researcher pin: 163 pass / 0 fail.
- Runtime exposure/fallback/stdio pins: 3 pass / 0 fail; executor/recovery pins:
  5 pass / 0 fail.
- Eleven declared FID gates: PASS; full runtime: 1993 pass / 0 fail;
  full root typecheck: exit 0.
- Receipt timestamp: 2026-10-12T07:03:16.787Z (before closure edits).
- Full eslint, changed-file formatting, and repository validation: exit 0.
- Agent bundle regenerated through `prebuild:agents`; the generated researcher
  artifact contains the same MCP config and both corrected prompts.

## Lessons

Adding a tool to a persona requires reconciling every prompt path, not just
the new system section. Verify prompt argument examples against the live MCP
schemas, and pin runtime exposure separately from the definition shape.
Use fetched identifiers to distinguish a missing service record from a failed
integration; do not silently turn a missing record into evidence of absence.

## Closure

The final executor audit reopened the uncommitted closure: MCP tools were
discoverable but classified mixed and rejected outside the native list. Loop 5
in the FID records the repair plan before implementation. The actual executor
and recovery pins now pass, along with the full runtime suite.

Loop 5 repairs the real executor path: remote MCP definitions carry network
effects and retain prompt permission; only offered tools from this agent's
configured servers pass capability filtering. Safe-mode calls stay blocked,
and stdio definitions remain mixed. Recovery uses the offered model tool set.
Five executor/recovery pins pass, and the discovery/fallback/stdio pins pass 3/3.
One legacy drift fixture incorrectly expected three retries for a template name
with no definition; the actual tool set never offers that name. It now pins
two calls, retains the warning, and asserts the honest unavailable message.

The repaired executor also performed a live server round trip: one dispatch,
one result, `tool_call` and `tool_result` events, and paper `W4390591490`.
The ephemeral test used permission mode `unsafe`; the safe-mode denial pin
passes and no persistent permission setting changed. No LLM call was made.

Completion-review code is committed in `7f386adf66155790ee365d40aa6d0e73ea027a5a`;
the original wiring is in `346d74ca84363a001109afed839fd1d2346b9ac8`.
Runtime repairs are committed in `f0b8ca82af7346d2ee153525a2e8fb401cb17528`.
One filesystem/git recapture test passed in isolation but exceeded its five-second
harness timeout under full-suite load; its timeout is now 30 seconds, with
assertions and production budgets intact.
The FID is closed and moved to `dev/fids/archive/`, its register item and
write targets are removed, and the required changelog entry is recorded.
The original session summary's premature closure claim is corrected.
Model-driven selection and synthesis remain a stated verification boundary.
