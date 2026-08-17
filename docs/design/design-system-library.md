# Savant Design-System Library

## Product status

The Savant design-system library is an offline, loadable product capability for
consistent visual work in the CLI. It is implemented and available in the CLI.

The implementation is covered by `FID-2026-0811-030`, which is closed and
archived. The independent implementation review returned PASS; the separate
live user-path test is tracked in the sign-off request linked below.

## 1. Purpose

AI-generated interfaces often drift because visual decisions are made locally,
without a durable vocabulary for color, typography, spacing, radius,
components, accessibility, or target limitations. The design-system library
adds that vocabulary to Savant without turning design guidance into a second
policy system.

The feature provides:

- a loadable offline catalog of 74 built-in design-system resources;
- a Savant-native `savant-cyberpunk` default system;
- explicit selection and reset behavior;
- project- and user-scoped custom systems;
- interactive creation and editing;
- import and headless authoring;
- bounded, resumable drafts;
- deterministic manifests, hashes, provenance, and validation;
- target-aware adapters for terminal, React, and web work;
- selected-contract grounding for agent runs; and
- mechanical design-contract checks at the existing EHEL write boundary.

This is deliberately more than a prompt or a copied corpus. The skill contains
resources, while the shared design-system package owns parsing, validation,
selection, authoring contracts, and normalized design data. Runtime enforcement
remains code-driven rather than prompt-driven.

## 2. Scope and non-goals

### In scope

- Offline loading of the packaged design-system skill.
- Exactly 74 admitted built-in resources in the baseline catalog.
- Canonical resource metadata and normalized design tokens.
- Selection through the `/design` command family.
- Project and user custom-system storage.
- Guided custom-system creation and editing.
- Built-in clone-before-edit behavior.
- Import, validation, drafts, resume, discard, and reset workflows.
- Headless `--design-input <path|->` authoring transport.
- Active-contract context injection with source and hash metadata.
- Theme adaptation to existing Savant surfaces.
- EHEL design-contract scanning for supported visual writes.
- Package and release-wrapper resource validation.

### Out of scope

- Rewriting any ECHO law or replacing the ECHO Perfection Loop.
- Replacing the existing `savant-design` governance skill.
- Runtime downloads, designmd.ai MCP access, or network-dependent presets.
- Treating reference brands as official partners, owners, or endorsers.
- Bundling font binaries without separate redistribution evidence.
- Making arbitrary Markdown prose a permission or policy channel.
- Guaranteeing crash durability beyond what the host filesystem can verify.
- Claiming clean-release certification while the repository remains dirty.

## 3. User experience

### 3.1 Discover the catalog

Use the command family from the chat input:

```text
/design list
/design current
```

`list` displays available built-in and valid custom systems. `current` reports
the active system, its stable ID, and the scope that supplied the selection.
The complete catalog remains available offline, but unrelated systems are not
injected into every model turn.

### 3.2 Select a system

```text
/design use <id>
/design use <id> --user
```

A selection is validated before activation. A configured but missing, corrupt,
changed-hash, unreadable, or unsafe custom system fails with an actionable
error; it does not silently fall back to a different preset.

Selection precedence is deterministic:

```text
session override > project selection > user selection > savant-cyberpunk default
```

The current runtime implementation persists project and user choices through
the existing settings/storage seams. Session-only overrides remain transient.

### 3.3 Create a custom system

The explicit interactive entry point is:

```text
/design create
/design create
```

The wizard is intentionally staged and cancellable:

1. stable ID and display name;
2. project or user scope;
3. supported targets (`terminal`, `react`, and/or `web`);
4. semantic colors;
5. typography references and fallbacks;
6. spacing scale;
7. radius scale;
8. component and state guidance;
9. accessibility requirements;
10. generated contract preview;
11. validation summary; and
12. explicit save-and-activate or save-without-activation confirmation.

No file is saved merely because the wizard was opened. Cancellation either
returns without mutation or leaves a bounded, non-active draft that can be
resumed explicitly.

The wizard and headless path share the same validation and persistence service.
This keeps interactive convenience separate from the correctness boundary.

### 3.4 Natural-language creation intent

The CLI recognizes only a narrow, imperative intent and asks for confirmation
before opening the wizard. Supported examples include:

```text
create a custom design
make my design system
start a custom design
please create a custom design
```

Matching is case-insensitive and permits documented terminal punctuation and
polite prefixes. Ordinary design discussion is not treated as authorization.
Examples that must remain ordinary chat include:

```text
what is a design system?
use the colors from my design
I am designing a custom system
```

Even a positive match performs no write without an explicit confirmation in the
UI. The natural-language path delegates to the same authoring flow as
`/design create`.

### 3.5 Edit a saved system

```text
/design edit <id>
/design edit <id> --user
```

Custom systems are reopened through the validated authoring model. Editing a
built-in preset never mutates the embedded resource. Instead, the CLI creates a
custom copy with source provenance, then edits that copy.

Every successful save produces a new validated source and normalized hash. The
previous valid version remains available when persistence or validation fails.

### 3.6 Import and validate

```text
/design import <path>
/design import <path> --user
/design validate <id>
/design validate <path>
```

Imports are copied into an approved project or user design-system location.
Path references are canonicalized and checked against the selected approved
root before reading. Imported data is treated as declarative content and passes
the same parser and validation pipeline as authored data.

### 3.7 Draft recovery

```text
/design drafts
/design resume <draft-id>
/design discard <draft-id>
```

Drafts are non-active JSON records with bounded age, count, and size. They do
not enter the active manifest and cannot become selectable merely by existing.
Malformed, oversized, future-dated, or expired drafts are not resumable. A
successful save clears the corresponding draft; explicit discard removes it.

### 3.8 Reset

```text
/design reset
/design reset --project
/design reset --user
/design reset --all
```

Reset removes the requested selection scope and allows resolution to continue
according to the documented precedence. `--all` is the deliberate recovery
operation for clearing project and user choices; callers should use it as an
explicit operator action because it affects more than one scope. Reset never
hides an invalid selection silently; it reports the resulting active source.
The current command implementation does not claim an additional confirmation
prompt for `--all`; hosts that expose this destructive option should add that
confirmation before presenting it as an interactive recovery flow.

## 4. Headless authoring contract

Automation can provide a versioned JSON document through a file or standard
input:

```text
savant-code --design-input path/to/design-input.json
savant-code --design-input -
```

The input is `DesignAuthoringInputV1`. Its required shape includes:

```json
{
  "schemaVersion": "1",
  "id": "midnight-terminal",
  "displayName": "Midnight Terminal",
  "description": "A restrained terminal-first visual language.",
  "scope": "project",
  "targets": ["terminal", "react"],
  "colors": {
    "primary": "#00d4ff",
    "background": "#050508",
    "text": "#f4f7fb"
  },
  "typography": {
    "body": { "fontFamily": "system-ui, sans-serif" }
  },
  "spacing": { "sm": "8px", "md": "16px" },
  "radius": { "sm": "4px", "md": "8px" },
  "components": {},
  "accessibility": { "contrastReview": true },
  "activate": true
}
```

Malformed JSON, an unknown schema version, missing required fields, or omitted
`activate` returns a non-zero result with a machine-readable classification:

- `INTERACTIVE_INPUT_REQUIRED` when an interactive confirmation/input step is
  required; or
- `DESIGN_INPUT_INVALID` when the supplied document is malformed or fails the
  schema/normalization pipeline.

The service writes no partial design file on invalid input. Interactive and
headless callers share the schema and normalization path rather than having
separate, weaker validation rules.

## 5. Resource architecture

### 5.1 Shipped skill boundary

The user-facing resource is:

```text
.agents/skills/savant-design-systems/
├── SKILL.md
├── manifest.json
└── resources/
    ├── <design-system-id>.json
    └── ...
```

The skill's `SKILL.md` is concise activation guidance. The manifest and child
resources contain the catalog. Runtime code loads the manifest first, checks
its schema and count invariants, then resolves a resource by validated stable
ID. The raw staging corpus is not the runtime source of truth.

The source-tree and packaged lookup paths include the development skill root,
project-local skill root, executable-relative package resources, and the user
skill location where applicable. Resolution does not depend on the caller's
current working directory.

### 5.2 Baseline admission

The baseline contract is exact:

- raw input count: 74;
- admitted resource count: 74;
- manifest resource count: 74;
- duplicate IDs: 0;
- every resource has a valid schema, provenance, source hash, and normalized
  hash; and
- the manifest's default ID is `savant-cyberpunk`.

A future malformed or unsafe addition is rejected or quarantined. It is not
silently omitted while the catalog continues to claim a valid baseline.

### 5.3 Canonical resource model

The normalized resource carries the following categories of data:

- stable ID and display name;
- description and target list;
- source (`embedded`, `project`, or `user`);
- status (`curated-reference`, `savant-native`, or `custom`);
- content path;
- source-content and normalized-content SHA-256 hashes;
- provenance repository, revision, path, license, and optional notice;
- font references with fallback and redistribution metadata; and
- canonical colors, typography, spacing, radius, component guidance, and
  extension data.

Source-specific values that do not fit the canonical vocabulary are retained in
an extension namespace rather than silently discarded. The normalized contract
is the input to adapters and enforcement; raw prose is not reparsed on every
write.

### 5.4 Provenance and fonts

Built-in presets are curated reference resources sourced from the staged
VoltAgent collection. The manifest records source identity, revision/snapshot,
source path, license evidence, and hashes. Brand names can remain useful
selection/reference metadata, but product text must not imply official
ownership, endorsement, or affiliation.

Font names are references by default. A named font receives fallback metadata;
a font binary is not bundled merely because a design document mentions it.
Redistribution evidence is required before any font asset can be shipped.

User-authored and imported systems remain explicitly custom. They are not
reclassified as Savant-native or source-curated resources.

## 6. Selection and persistence model

### 6.1 Selection records

Selections are stable IDs and validated scope records, not arbitrary prompt
text. The active record includes source, status, scope, target metadata, and
source/normalized hashes. An invalid configured selection fails closed at the
scope that supplied it.

### 6.2 Custom storage

Custom systems live below approved roots:

```text
project: <project>/.savant/design-systems/
user:    <home>/.savant/design-systems/
```

The persistence service uses versioned design files, a manifest, and a commit
journal. A new version is written through a temporary file and rename before the
manifest points to it. The previous valid manifest/version is preserved until
the new commit succeeds. Failed writes clean up temporary artifacts and leave
the last valid selection intact.

The implementation reports platform durability limitations conservatively. It
does not claim crash durability where directory flush or rename guarantees
cannot be verified. Recovery and incomplete-commit handling preserve the last
known-good manifest and retain orphaned user-authored revisions for explicit
repair rather than deleting evidence automatically.

### 6.3 Active-contract ownership

One resolver owns the in-memory normalized active contract. Successful
selection, creation, editing, reset, reload, or manifest commit constructs a
new resolved record. EHEL receives the current record; it does not retain a
mutable raw-document reference.

This prevents a stale contract from remaining active after a saved design is
changed and ensures failed validation or persistence cannot replace a valid
active contract.

## 7. Security and trust boundaries

Design-system data is declarative reference data. It cannot define executable
code, tool permissions, ECHO policy, arbitrary prompt-priority directives, or
runtime commands.

The resource and custom-path boundary enforces:

- stable lowercase kebab-case IDs;
- approved-root containment;
- rejection of `..` and absolute-path escapes;
- canonicalization and re-checks before reading;
- rejection of symlink/junction/reparse-point escapes where detectable;
- regular-file requirements;
- manifest/resource ID and hash matching;
- duplicate-ID rejection;
- bounded draft and input sizes;
- regular-file and approved-resource checks at the supported resolver boundary;
  and
- explicit handling for malformed, missing, corrupt, or stale data.

Reference prose is data, not an instruction channel. ECHO, permissions, tool
contracts, FSM state, and project policy retain higher precedence than any
embedded design content.

## 8. Theme and target adapters

The design contract adapts into existing Savant surfaces rather than creating a
parallel theme framework. The target model distinguishes:

- `terminal` for OpenTUI and terminal color limitations;
- `react` for CLI React/OpenTUI-adjacent component surfaces; and
- `web` for CSS/HTML consumers.

Adapters can map canonical tokens into chat, Markdown, syntax, diff, and UI
surfaces. Unsupported target-specific roles produce an explicit diagnostic;
they are not silently invented. Fallbacks must remain documented and must not
weaken accessibility-critical semantics.

## 9. Mechanical enforcement

### 9.1 Enforcement boundary

The active design contract flows through CLI run configuration and session
state into the shared agent runtime. At the EHEL/tool-executor boundary,
supported visual writes are evaluated after the complete proposed content is
known.

Supported consumer classes include TSX, JSX, HTML, CSS, and OpenTUI style
properties. Token-definition files, admitted design resources, generated
artifacts, tests, fixtures, vendored code, and non-visual data are excluded
only through explicit classification rules.

### 9.2 Scanner behavior

The scanner checks for visual literals and expressions including:

- colors and CSS color declarations;
- typography properties and font declarations;
- CSS and OpenTUI spacing values;
- radii and border values;
- CSS variables and token references; and
- dynamic expressions whose value cannot be resolved as an authorized literal.

OpenTUI forms include both CSS-style names and common camelCase properties.
Unitless terminal spacing values are treated according to the OpenTUI contract,
not ignored merely because they lack CSS units.

For `str_replace` and patch operations, enforcement evaluates reconstructed
final content rather than only the replacement fragment. If final content is
unavailable, the result fails closed or is classified as explicit review.

### 9.3 Receipts and correction

Design failures use dedicated classifications:

```text
DESIGN_CONTRACT_BLOCK
DESIGN_CONTRACT_NEEDS_REVIEW
```

A receipt includes the affected path, active-system hash, target, rule, and
remediation. Design violations are not mislabeled as ECHO Law 15 violations.
Repeated blocks have bounded escalation and actionable required-token guidance;
they do not create an infinite correction loop. A blocking result is intended
to steer the agent into the existing self-correction path.

## 10. Packaging and artifact matrix

The feature is intended to be available in each artifact that advertises CLI
design-system support:

| Artifact | Expected design-system behavior |
| --- | --- |
| Repository development tree | Resolves the source skill and generated resources |
| Full CLI package | Ships the skill, manifest, and all 74 resources |
| Staging CLI package | Ships the same catalog contract for release rehearsal |
| Savant-Free package | Ships and validates the same catalog when the wrapper includes it |
| SDK package | Active-system metadata only where supported; no second CLI surface |

Release-wrapper checks assert the skill directory, manifest, resource count,
manifest integrity, and extracted-catalog validation. The verified evidence
covers the full CLI, staging wrapper, and Savant-Free wrapper with 74
resources each.

## 11. Testing and verification

The implementation includes coverage for:

- parser and normalizer behavior;
- manifest and embedded-resource integrity;
- selection precedence and invalid-selection failure;
- interactive authoring schema and rendering;
- custom persistence and atomic writes;
- draft bounds, expiry, resume, and discard;
- path containment and reparse-point checks;
- natural-language intent boundaries;
- headless input validation;
- built-in clone-before-edit;
- design-contract scanner literals, dynamic expressions, unitless and camelCase
  OpenTUI properties;
- dedicated enforcement classifications;
- production call-graph wiring; and
- release-wrapper packaging and extracted-catalog validation.

Recorded focused evidence for the implementation closure:

- 42 focused tests across 8 files, with zero failures;
- CLI, agent-runtime, and design-systems typechecks passed;
- Prettier and changed-file ESLint passed;
- design-system drift check passed;
- protocol-bundle drift check passed;
- hygiene check passed; and
- isolated pack/extract/catalog validation passed for all three release
  wrappers, with 74 resources in each.

The independent auditor's sign-off is the review boundary for this
documentation-and-feature completion step.

## 12. Operational guidance

### For users

1. Start with `/design current` to see the active contract.
2. Use `/design list` to inspect available systems.
3. Use `/design use <id>` to select a preset.
4. Use `/design create` for a guided custom system.
5. Use `/design edit <id>` to revise a saved custom system.
6. Use `/design drafts` if authoring was interrupted.
7. Use `/design reset` when returning to the next lower-priority selection.
8. Use `/design validate <id>` before sharing or activating an imported system.

### For maintainers

- Keep the generated skill manifest and resources in sync with the generator.
- Treat raw corpus changes as admissions requiring validation and updated hashes.
- Do not add a resource without provenance and license evidence.
- Keep custom data declarative and path-contained.
- Run package extraction checks against every wrapper that ships the feature.
- Keep implementation evidence distinct from independent-review certification.
- Send independent review requests before changing a feature from implemented to
  fully certified.

## 13. Reference implementation map

| Concern | Primary implementation seam |
| --- | --- |
| Resource schema and hashes | `packages/design-systems/src/types.ts` |
| Parsing and normalization | `packages/design-systems/src/parser.ts` |
| Authoring DTO and rendering | `packages/design-systems/src/authoring.ts` |
| Manifest and embedded resolution | `packages/design-systems/src/library.ts` |
| Selection precedence | `packages/design-systems/src/selection.ts` |
| Draft lifecycle | `packages/design-systems/src/drafts.ts` |
| CLI command family | `cli/src/commands/design.ts` |
| Custom storage and active resolver | `cli/src/utils/design-system-service.ts` |
| Run configuration | `cli/src/hooks/helpers/send-message-run-config.ts` |
| Theme adapter | `packages/design-systems/src/theme-adapter.ts` |
| Context rendering | `packages/design-systems/src/context.ts` |
| EHEL scanner | `packages/agent-runtime/src/echo/design-contract.ts` |
| Runtime enforcement lifecycle | `packages/agent-runtime/src/echo/enforcement.ts` and tool executor |
| Shipped skill | `.agents/skills/savant-design-systems/` |
| Package validation | `cli/release-core/launcher.js` and wrapper safety tests |
| Product FID | `dev/fids/archive/FID-2026-0811-030-loadable-design-system-skill-library.md` |

## 14. Live UX and performance validation

The implementation and focused suites do not replace a live user-path test.
For design-system-specific coverage, use the
[`design-system live UX/performance prompt`](../../dev/test-prompts/design-system-live-ux-performance.md).
For a complete regression, use the
[`v0.0.25 harness A–Z live-test prompt`](../../dev/test-prompts/az-v0.0.25-harness-live-test.md),
which treats the changelog as a coverage index and also exercises protocol
boot, ECHO enforcement, LEARNINGS validation, provider/configuration parity,
Code Universe, SDK/headless paths, packaging wrappers, and release diagnostics.
It writes its report to
`dev/scratchpad/az-v0.0.25-harness-live-test-report.md` and keeps provider or
environment limitations separate from product defects. A live result is
usability/performance evidence; it is not a substitute for independent
implementation sign-off. The design-system-specific live-test prompt and its
future result remain covered by the
[`design-system live-test sign-off request`](../../dev/nova/outbox/archive/2026-08-11-fid-2026-0811-030-design-system-live-test-signoff-request.md).

## 15. Independent sign-off boundary

This document records the feature contract and the implementation evidence.
It does not replace independent review.
The associated independent-audit request asks for live verification of:

- the document's claims against the implementation;
- command and natural-language workflows;
- selection and persistence semantics;
- resource and path security;
- active-contract grounding and EHEL reachability;
- scanner coverage and receipt classifications;
- package/resource evidence across all wrappers;
- implementation evidence versus release certification;
- no-signature/no-attribution compliance; and
- any documentation contradiction or unsupported completion claim.

The feature should be described as fully certified only after the independent
auditor returns an implementation/documentation verdict.
