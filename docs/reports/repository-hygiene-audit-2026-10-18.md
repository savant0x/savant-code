# Repository hygiene and code/data parity audit — 2026-10-18

FID-2026-1018-007. Baseline: `31008b4f`, clean main. This is a measured
repository audit and targeted repair, not a package release or certification
that every historical sentence remains a current product contract.

## Storage inventory

The read-only disk walk used `lstat` and did not follow directory links.
Sizes below are decimal bytes, taken before cleanup; Git inventory uses HEAD.

| Surface | Bytes | Disposition |
| --- | ---: | --- |
| All 5,046 tracked paths | 67,542,802 | Source, tests, docs, assets and vendored runtime tools |
| Local `resources/` | 12,774,144,795 | Ignored reference farm; retained |
| Local root `node_modules/` | 1,011,716,330 | Installed dependencies; retained |
| Local `sdk/` | 153,961,095 | Includes build output as well as tracked source/vendor tools |
| Local `desktop/` | 141,005,734 | Includes build output; retained |
| Local `.git/` | 144,609,884 | History/metadata; no pruning or rewrite |
| Local `.savant/` | 133,009,767 | Runtime state/indexes; retained |
| Local `dev/` | 75,086,058 | Governance/evidence, mostly ignored; retained |
| Local `.opencode/` | 55,101,030 | Ignored local tool state; retained |
| Local `debug/` | 31,559,170 | Ignored local diagnostics; retained |

The five largest tracked files are shipped ripgrep binaries, approximately
26.8 MB combined, consumed by SDK resolution/packaging. Their size is not
evidence of dead code. Logo/favicon duplicates serve source assets, desktop
public URLs and Tauri icons; identical Git blobs already share object storage.
Two 38,121-byte archived integration-plan copies remain historical references.
The 1,071,866-byte changelog is historical evidence, not a runtime cache.

One proven build intermediate was tracked:
`cli/.tmp/savant-sigma-bundle/sigma-runtime.js` (174,027 bytes).
`cli/scripts/generate-sigma.ts` recreates it, then embeds it in the actual
`cli/src/constants/sigma.ts` source chunks. Removed only the intermediate from
the Git index and ignored `/cli/.tmp/`; its local copy and shipped chunks stay.
This reduces future checkout content, not local disk usage or existing history.

`git count-objects -vH` reported 12.13 MiB loose objects, 86.55 MiB packs and
two temporary garbage files totaling 577.66 KiB. No Git maintenance was run:
an audit does not establish that an interrupted pack belongs to no live writer.

## Confirmed repairs

1. **English README callout drift.** `version:check` failed even though version
   tokens agreed. The body now matches the changelog's explicit unpublished
   development status. No version, tag, package publication or npm state changed.
2. **Chinese README stale release framing.** The current note now says 0.0.36
   is unpublished. Old release material is labelled historical and collapsed;
   the older OpenAI/connector release description is no longer labelled 0.0.36.
3. **Generator metadata drift.** `design-systems:check` failed because the
   generator omitted the existing skill's `version: 0.1.0`. Corrected generator
   output; no trusted skill/resource mutation, release or trust action occurred.
4. **Obsolete active-register data.** Root scope claimed old commits were
   unpushed and acceptance was still awaiting run 3. Preserved its old content
   as `dev/tracking/scope-history-2026-10-18.md`, explicitly non-authoritative,
   and rebuilt root scope around active work, external blockers and retained
   operator-gated release authority. Closed write grants are not reintroduced.
5. **SDK example/API drift.** Store/default-agent examples contradicted
   `getAgentTemplate`'s local-only lookup. Basic examples now pass an inline
   definition; removed unsupported `onError` options. Fixed the no-options
   constructor example, actual `Promise<RunState>` description and streaming
   callback guidance. Removed current onboarding advice for retired OpenCode
   providers. Three basic examples typecheck without making inference calls.
6. **Testing-guide drift.** CLI docs claimed a `.bin/bun` naming-based wrapper
   that does not exist. They now describe explicit suite prerequisite checks,
   CI tmux skipping, workspace-root filters and the package test command.
   Removed obsolete timing estimates and fixed the removed tmux-guide link.
7. **Markdown links.** A `remark-parse` AST audit of 146 tracked Markdown files
   found 13 space-containing destinations rendered as text, not links. Used
   angle-bracket destinations on the seven affected current documents. Fixed
   the SDK license badge and tmux-guide banner path. One changelog link claimed
   an expired scratch report survived; annotated its actual absence instead of
   inventing or restoring evidence.
8. **Current claims.** Updated effective AI SDK version/Bun pin, removed the
   false two-write-agent count, labelled old A–Z prompts version-specific,
   corrected the tmux binary environment variable and invented tester-role
   list, and removed a frozen live AIHubMix row count. Graph metadata is not
   described as an absolute secrecy guarantee: paths/symbols can be sensitive.

## Data and consumer checks

All 166 tracked JSON-family files parse using their intended formats:
71 strict JSON, 21 TypeScript JSON-with-comments configs, and 74 design resource
headers followed by source prose. A plain `JSON.parse` of whole design resources
is invalid audit methodology: production splits the header from prose.
All 74 resources additionally passed `loadDesignManifest` and
`resolveEmbeddedDesignSystem`, including schema and manifest/hash checks.

Provider parity reported 4,075 cached rows, with every modelsRef provider
contributing rows. This is local cache/code parity, not a fresh upstream
availability, entitlement, identity or live inference test.

The orphan sweep returned six candidates. All remain for explicit purposes:

- Three `common/src/templates/initial-agents-dir/examples/` files are documented
  starter examples, not production imports.
- `cli/src/server/__tests__/provider-notices-smoke-server.ts` is a standalone
  controlled smoke server.
- Desktop `compliance-browser-smoke.mjs` and `provider-notices-browser-smoke.mjs`
  are standalone browser evidence runners. Their names need no production import.

No name-index candidate was deleted on the strength of a zero-caller result.

## Verification

Initial checks: repository validation, hygiene, acceptance records, provider
references/counts, protocol bundle, catalog/window parity and repository skills
passed. Version-callout and design-generation checks failed, then passed after
the fixes above. The declared FID receipt covers typechecks, existing SDK/design
library and document-drift suites, scripts typecheck, scope parsing and quality.
Normal pre-push gates cover the full workspace typecheck/test chain and lint.

The final declared receipt reports 11/11 gates exit 0. SDK build `bun run ci`
passes. The final current-document scan covers 146 tracked Markdown files and
315 relative links, with zero missing targets, malformed space-containing
Markdown destinations or missing raw-HTML image/link targets. Anchor ids and
external URLs are not part of that result. The new audit report is checked
separately by Markdown lint rather than included in its baseline file count.

Basic SDK snippets in both root READMEs and `sdk/README.md` were typechecked in
memory through the TypeScript compiler against current SDK declarations.
No snippet executed a model call. Markdown links were checked through the real
parser, separately from raw HTML image destinations; no external URLs were fetched.

## Limits and operator-owned surfaces

`skills:check` reports zero repository errors and 22 home-skill warnings.
External installed skills include frontmatter/line-ceiling/command-policy
diagnostics for agent-reach, autoglm-browser-agent, gepeto and skill-creator,
plus legacy missing-version notices. They are outside this project; record
HOME-SKILLS-001 requires an operator decision before changing them. The earlier
external bootstrap mismatch EMBED-001 also remains operator-blocked.

No reference farm, dependency tree, diagnostic history, runtime database,
credential file, retained lane branch or prep stash was deleted. No network
provider probe, package upgrade, paid inference, UI live test or publication ran.
Historical archives remain snapshots. Generated/schema/link checks and the
manually inspected contracts provide bounded evidence; they cannot prove every
free-form statement across all historical research and reports.
