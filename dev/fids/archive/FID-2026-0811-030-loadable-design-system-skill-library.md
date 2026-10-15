# FID: Loadable Design-System Skill Library and CLI Integration

**Filename:** `FID-2026-0811-030-loadable-design-system-skill-library.md`
**ID:** FID-2026-0811-030
**Severity:** high
**Status:** closed
**Created:** 2026-08-11
**YAGNI-Compliance:** Verified

---

## Summary

Savant needs a complete, shippable design-system capability that is available as a loadable skill rather than a partial protocol-bundle experiment. The capability must ship with the existing 74 approximately 2.15 MB design-system presets, make one preset active for an agent session, support project and user custom systems, expose usable `/design` CLI controls, preserve provenance and license metadata, adapt selected systems to Savant's existing OpenTUI/React theme surfaces, and mechanically validate visual writes against the active contract. The full library remains loadable offline and selectable; only the active system is placed into the agent's design context. This FID defines the complete implementation boundary. No implementation is authorized until this FID is approved.

## Environment

- **OS:** Windows workstation; cross-platform Bun CLI behavior required
- **Language/Runtime:** TypeScript, Bun 1.3.14, React 19, OpenTUI 0.2.2
- **Tool Versions:** ECHO Protocol v0.2.0; single-agent ECHO adaptation v0.1.2; existing skill loader uses `gray-matter` and Zod
- **Commit/State:** Working tree on `main`; implementation and generated/package resources are working-tree evidence pending commit. No release, push, publication, or deployment is part of this closure.

---

## Detailed Description

### Problem

The existing repository has a reusable skill mechanism, but no complete design-system product. The current design work is described as a protocol-bundle retrofit, while the intended product is a selectable offline design library: built-in presets, custom user systems, agent grounding, CLI selection, and enforcement. The existing `savant-design` skill is a design-governance constitution and explicitly does not modify Savant's UI, theme, or runtime. It is not the preset library requested here.

The staged design corpus is usable product input: exactly 74 `.design.md` files totaling approximately 2.15 MB, with 64 frontmatter files and 10 plain-Markdown files. The implementation must preserve the value of that corpus without injecting all 74 systems into every prompt or treating a skill's prose as a substitute for runtime enforcement. The shipped baseline must admit exactly 74 validated presets; a baseline parse/normalization failure blocks packaging rather than silently reducing the catalog. Quarantine is reserved for later untrusted additions and rejected/custom inputs.

### Expected Behavior

1. Savant ships a valid `savant-design-systems` skill with its complete preset resources and a deterministic manifest. The shipped default is the Savant-native `savant-cyberpunk` system; first run and reset select it explicitly, while an invalid persisted selection fails rather than silently falling back.
2. The skill loader and packaged CLI can resolve the skill and its child resources from source-tree, installed, global, and project-local locations without relying on the caller's current working directory.
3. The user can list presets, select one, inspect the current selection, validate a system, import a custom system, interactively create a custom system, edit a saved system, and remove/reset a custom system from the CLI. `/design create` is the canonical explicit trigger; the natural-language intent “create a custom design” (and equivalent supported phrasing) routes to the same guided workflow with confirmation before entering it.
4. A project may select exactly one active design system per target profile/session. A built-in preset, project-local file, or user-level custom file may be selected. Invalid, ambiguous, missing, or unsafe selections fail with actionable errors and never silently fall back to another system. The normative precedence is session override > project selection > user selection > explicit `savant-cyberpunk` default.
5. Only the active design system's relevant contract is loaded into the agent context. The complete preset catalog remains available as skill resources without injecting every preset into every turn.
6. Presets retain source names where useful for selection and context, but the manifest distinguishes source reference material from Savant-native systems and never claims official brand ownership or endorsement.
7. Font metadata is supported with explicit availability and license/provenance fields. Font names may be referenced with fallbacks; font files are bundled only when redistribution evidence is present. No proprietary font file is silently shipped.
8. The active design system is normalized into a canonical token contract while preserving unmapped/source-specific tokens in an extension namespace. Normalization never silently drops values or invents missing semantics.
9. The active contract adapts to the existing Savant theme surfaces (`ChatTheme`, Savant-UI tokens, Markdown palette, syntax/diff tokens) without creating a competing theme system. Target adapters distinguish OpenTUI terminal constraints from React/CSS constraints.
10. Visual writes in supported consumer files are checked against the active contract at the existing EHEL/tool-executor boundary. Unsupported syntax, unavailable post-write content, or ambiguous token resolution fails closed or produces an explicit `NEEDS-REVIEW` result according to the validated policy; it never silently passes.
11. Enforcement receipts use a dedicated design-contract classification and do not mislabel design violations as ECHO Law 15 violations. Repeated blocks produce actionable token guidance and bounded escalation without infinite loops.
12. Built-in and custom systems have deterministic validation, tests, documentation, and packaging evidence. The feature is not considered complete with only a `SKILL.md` prompt file or only a corpus copy.
13. A user can create a custom design interactively without hand-authoring Markdown: the wizard collects identity, scope, targets, colors/semantic roles, typography references and fallbacks, spacing/radius, component/state guidance, and accessibility requirements; shows a review/preview summary; validates the complete contract; and saves only after explicit confirmation.
14. A saved custom design can be reloaded, selected, and edited in a later session. Editing uses the same schema/validation pipeline, preserves provenance and revision history, writes atomically through a temporary file plus rename, and never replaces the last valid saved version with an invalid or incomplete draft. Cancelling or failing validation leaves the prior active system unchanged.

### Interactive authoring lifecycle

- `/design create [id]` starts the guided authoring wizard. If no ID is supplied, the wizard collects a valid stable ID and display name. The user chooses project or user scope before any file is written.
- The wizard is staged and cancellable: identity/scope → target(s) → semantic palette → typography and fallbacks → spacing/radius → component/state guidance → accessibility/contrast review → generated contract preview → validation summary → explicit save-and-activate confirmation. Back/cancel returns without mutation; an interrupted session may retain a non-active draft only in a bounded, clearly marked draft location and must never make it selectable as a valid system.
- Natural-language fixtures are normative: accepted examples include `create a custom design`, `make my design system`, and `start a custom design`; matching is case-insensitive, permits terminal punctuation and documented polite prefixes (`please`, `can you`, `could you`), and rejects questions/discussion such as `what is a design system?`, `use the colors from my design`, and `I am designing a custom system`. Every match requires explicit confirmation before the wizard opens.
- The supported natural-language trigger is a dedicated imperative matching `create|make|start` + `a|my|an` + `custom design|design system`, case-insensitively, with optional polite framing; it must be confirmed in the UI before opening the wizard. Equivalent phrasing is limited to documented aliases and must not be inferred from arbitrary design discussion. Ambiguous requests ask whether to open the creator; ordinary design discussion remains ordinary chat, and no natural-language path writes without confirmation.
- `/design edit <id|path>` opens a validated custom system in the same guided editor. Editing a built-in preset never mutates embedded resources: it first creates a project/user custom copy with provenance pointing to the preset, then edits that copy. The editor supports field-by-field changes plus a deliberate raw-content escape only if the resulting declarative document passes the same parser, security, and validation gates.
- Every save creates a revision record containing system ID, scope, previous hash, new source/normalized hashes, validation result, and an explicit UTC wall-clock timestamp. Content identity and ordering are deterministic from hashes and revision sequence; the timestamp is intentionally observational metadata and is not part of content hashing. The active selection changes only after the new version passes validation and the manifest commit succeeds. Reloading discovers the saved resource by stable ID and verifies its hash before activation.
- The wizard and editor must use the existing interactive ask-user/input surfaces where possible, share one command/service implementation with headless mode, and return structured success, cancellation, validation-error, and persistence-error results. Headless authoring uses the exact transport `--design-input <path|->`, where the path contains or stdin supplies versioned `DesignAuthoringInputV1` JSON; `/design create` and `/design edit` may delegate to this same service but never infer missing fields. The schema includes `id`, `scope`, `targets`, token fields, typography, spacing/radius, component guidance, accessibility requirements, and an explicit `activate` boolean. Missing required fields, malformed JSON, unknown schema versions, or `activate` omission produce a non-zero exit and a machine-readable `INTERACTIVE_INPUT_REQUIRED` or `DESIGN_INPUT_INVALID` error, never a partial file or implicit default. Interactive-only invocation in headless mode is rejected with the same classification.

### Root Cause

The current skill infrastructure is instruction-oriented and loads only the `SKILL.md` definition, while the current theme infrastructure is runtime-oriented and has no design-system catalog/resource model. The current EHEL tracks general write compliance but has no active design-contract resolver or design-specific scanner. The previous build order also conflated corpus storage, prompt grounding, protocol-bundle generation, theme adaptation, and enforcement, and contained stale numbering and contradictory ownership/provenance assumptions.

### Evidence

The following live-tree evidence establishes the implementation seams and boundaries:

- `sdk/src/skills/load-skills.ts` discovers `<skillsDir>/<skill-name>/SKILL.md`, validates frontmatter, and merges global/project skills. It does not currently expose a manifest or child-resource resolver.
- `packages/agent-runtime/src/tools/handlers/tool/skill.ts` loads a skill's full `SKILL.md` content but has no safe resource-resolution API for a preset file or custom design-system asset.
- `cli/src/utils/skill-registry.ts` initializes the skill cache at CLI startup, and `cli/src/commands/command-registry.ts` exposes loaded skills as dynamic `skill:<name>` commands.
- `cli/src/utils/settings/types.ts`, `cli/src/utils/settings/io.ts`, `cli/src/utils/settings/preferences.ts`, and `cli/src/utils/settings/validation.ts` provide the existing persisted-settings seam for an active design-system selection, but no design-system setting exists today.
- `cli/src/types/theme-system.ts` defines `ChatTheme`, including semantic colors, surfaces, diffs, syntax tokens, and Markdown overrides. `cli/src/utils/theme-system/palette.ts` provides the current dark/light theme values and palette adapter.
- `.agents/skills/savant-design/SKILL.md` is governance-only and explicitly excludes modifying Savant's own UI, OpenTUI components, theme tokens, and HTML export; it must remain distinct from the new product skill.
- `packages/agent-runtime/src/echo/enforcement.ts` exposes the shared `EchoEnforcement` lifecycle and `beforeToolCall`/`afterToolCall` seams. `packages/agent-runtime/src/tools/tool-executor/native.ts` invokes EHEL before dispatch and supplies successful post-write content to turn-end scanning.
- `packages/design-systems/library/` contains 74 `.design.md` resources; the corpus is approximately 2.15 MB and is currently untracked working-tree input, not yet a packaged skill.

## Impact Assessment

### Affected Components

- `.agents/skills/savant-design-systems/` — new shipped skill, preset resources, schema, adapters, and manifest
- `packages/design-systems/` — corpus normalization, validation, provenance, and packaging support
- `sdk/src/skills/` and `common/src/types/skill.ts` — resource-aware skill loading and validation
- `packages/agent-runtime/src/tools/handlers/tool/skill.ts` — safe resource access and active-contract loading
- `cli/src/commands/` and `cli/src/data/slash-commands.ts` — `/design` command family and discoverability
- `cli/src/utils/settings/` — persisted active preset/custom-system selection and validation
- `cli/src/types/theme-system.ts`, `cli/src/utils/theme-system/`, and Savant-UI consumers — target-aware token adapters
- `packages/agent-runtime/src/echo/` and `packages/agent-runtime/src/tools/tool-executor/` — active contract resolution, design-write scanning, receipts, steering, and bounded escalation
- `common/src/types/session-state.ts` and SDK run-state initialization — active design-system identity/provenance where required by agent execution
- tests, package manifests, generated/bundled artifacts, README/release documentation, and design-system validation scripts

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Build one complete design-system product around a resource-aware `savant-design-systems` skill. The skill is the user-facing knowledge and preset surface; a small shared design-system library provides canonical parsing, manifest/resource resolution, validation, provenance, active selection, target adapters, and enforcement contracts. The skill must be progressively loaded: its catalog and metadata are discoverable, the selected preset is loaded on demand, and irrelevant preset prose is not injected into the model context. The 74 built-in presets remain available offline, while project and user custom systems can be added without modifying the installed product.

The implementation must reuse the current skill loader, settings persistence, dynamic skill command path, theme adapters, and EHEL boundaries. It must not rewrite ECHO Law 1, replace the existing skill registry, create a second theme system, or treat prompt instructions as mechanical enforcement.

### Canonical resource model

Every built-in or custom system resolves to:

```ts
type DesignSystemSource = 'embedded' | 'project' | 'user'
type DesignSystemStatus = 'curated-reference' | 'savant-native' | 'custom'
t
type ActiveDesignSystem = {
  id: string
  source: DesignSystemSource
  status: DesignSystemStatus
  displayName: string
  contentPath: string
  sourceContentHash: string
  normalizedContentHash: string
  provenance: DesignSystemProvenance
  tokens: CanonicalDesignTokens
  targets: DesignTarget[]
  selectionScope: 'session' | 'project' | 'user' | 'default'
}
```

The exact exported names may follow repository conventions, but the information must exist. Selection must be represented by stable IDs and validated paths, not by arbitrary prompt text. `sourceContentHash` covers the exact admitted source bytes; `normalizedContentHash` covers the deterministic emitted contract. The manifest must pin the upstream source commit or immutable snapshot, source path, license/notice evidence, and both hashes. A source file that fails validation is rejected or quarantined with a report; it is not counted as an admitted preset merely because it exists in the raw corpus.

### Selection and security contract

- The built-in default is `savant-cyberpunk`, selected only when no valid session, project, or user choice exists. `/design reset` removes the active scope's override and resolves the next precedence level; `/design reset --all` removes project/user design-system selections after explicit confirmation so an invalid higher-priority selection can never strand the user. Reset reports the removed scope and the newly resolved source; it never silently masks an invalid record.
- The persisted schema is backward-compatible and target-keyed where target behavior differs: session override > project target selection > user target selection > default. The active record includes origin, ID/path, source hash, normalized hash, target, and validation status.
- Custom imports and wizard saves are copy-on-import into an approved project or user design-system directory by default, with the original path recorded as provenance. The destination uses immutable version files plus an atomically committed manifest/pointer: write and flush the complete version bytes to a temporary file, close successfully, durably rename the version into place, then atomically commit the manifest that selects it. The prior valid version is never overwritten and remains available until retention cleanup after a successful commit. Windows rename/reparse-point failures are classified and surfaced rather than swallowed. If directory fsync/durability is unavailable on a supported platform, the service records `DURABILITY_UNVERIFIED`, retains the prior manifest until the new commit is otherwise complete, and reports the result as an explicit persistence warning/NEEDS-REVIEW according to policy; it must not claim crash durability it cannot prove. Failed commits clean up temporary files and leave the prior manifest/version active.
- On startup and reload, the persistence service reconciles orphan temporary/version files and incomplete manifest commits using the journal/commit marker, keeps the last valid manifest selected, and reports recoverable stale artifacts. A simulated crash at each write/rename/manifest boundary must prove that no invalid version becomes active.
- Custom resource discovery must distinguish active saved systems from drafts, backups, orphaned versions, and failed imports. Only validated manifest entries with matching hashes are selectable; stale or corrupt entries are reported with repair/remove guidance.
- The active-contract resolver is the single owner of the in-memory normalized contract. A successful `use`, `create`, `edit`, `reset`, reload, or manifest commit constructs a new immutable resolved record and swaps it into the resolver atomically; failed validation, failed persistence, or stale-hash detection leaves the prior record untouched. The EHEL scanner receives only the resolver's current record and never retains a mutable raw-document reference. Cache replacement/invalidation is observable in tests before the next supported visual write.
- Interrupted drafts are bounded, non-active, and explicitly managed: `/design drafts` lists resumable drafts, `/design resume <draft-id>` reopens one in the wizard, and `/design discard <draft-id>` removes one after confirmation. Drafts expire or are capped by count/size, never enter the active manifest, and are cleaned after successful save or explicit discard. If reference-by-path is supported, the path is canonicalized on every use and must remain under an approved root; no arbitrary path is persisted as trusted content.
- Resolve and validate paths using platform-aware canonicalization. Reject absolute paths outside approved roots, `..` escapes, symlink/junction/reparse-point escapes, directories, oversized files, excessive nesting, duplicate IDs, unsupported extensions, scripts, HTML/script payloads, executable assets, and unbounded parser input. Re-check the canonical target before reading to cover Windows junctions and TOCTOU changes.
- Custom design data is declarative. It cannot define executable code, arbitrary regular expressions, tool instructions, ECHO policy, permissions, or prompt-priority directives. External prose is delimited as data and never overrides the harness.

### Complete implementation stages

1. **Resource-aware skill packaging**
   - Create the `savant-design-systems` skill with frontmatter and concise activation instructions.
   - Treat `packages/design-systems/library/` as raw staged input, generate deterministic normalized/admitted output under the skill resource boundary, and package exactly 74 admitted preset resources with canonical schema, manifest, provenance/license record, and target adapter references. Generated output is the shipped source of truth; raw input is never loaded directly at runtime.
   - Extend loading so resources are resolved safely in source, packaged, global, and project-local contexts; prevent path traversal, absolute-path escape, symlink escape where applicable, duplicate IDs, and resource/manifest mismatch.
   - Keep the existing `savant-design` constitution separate and preserve its governance-only scope.

2. **Canonical parsing and validation**
   - Support both YAML-frontmatter and plain-Markdown source shapes.
   - Normalize required semantic roles without silently deleting source-specific values; retain extensions and mapping evidence.
   - Validate colors, typography metadata, spacing, radius, component guidance, required accessibility fields, and source/provenance metadata.
   - Validate font references separately from font files; require explicit redistribution evidence before bundling any font asset.
   - Produce deterministic manifest and per-system validation reports. Re-running generation must be idempotent. The baseline gate requires raw count = 74, admitted count = 74, zero duplicate IDs, zero unresolved required roles, and matching raw/source and normalized/output hashes; any mismatch blocks packaging.

3. **Active selection and custom systems**
   - Add the exact command grammar `/design list`, `/design use <id|path>`, `/design current`, `/design create [id]`, `/design edit <id|path>`, `/design import <path>`, `/design validate [id|path]`, `/design drafts`, `/design resume <draft-id>`, `/design discard <draft-id>`, `/design reset`, and `/design reset --all`; register the command family in the existing command registry and slash-command surface. If the CLI has interactive and headless dispatch paths, both must call the same command/service implementation and return the same machine-readable result/error classification.
   - Route the supported natural-language create intent (“create a custom design”, including equivalent documented phrasing) to the same interactive command service only after intent confirmation; never interpret arbitrary design prose as authorization to write a file.
   - Persist a validated target-keyed project/user selection through the existing settings/config seams, with the explicit precedence session override > project selection > user selection > `savant-cyberpunk` default.
   - Support embedded IDs and validated local paths. Never silently replace a missing, changed-hash, invalid, or unreadable custom system with a built-in system; report the exact invalid source and remediation.
   - Keep selection state backward-compatible for existing settings files and prove restart/resume behavior in interactive, headless, packaged CLI, and SDK-backed runs. SDK integration carries active-system metadata and grounding/resource resolution; it does not add a second public command surface.
   - Prove create, cancel, validation failure, save, reload, edit, built-in clone-before-edit, malformed/headless input, draft resume/discard/expiry, orphan recovery, manifest-commit failure, active-contract cache replacement, and reset/reset-all behavior at the shared service and CLI levels.

4. **Agent grounding and resource disclosure**
   - Load the active contract through the existing skill/tool pathway, with explicit source, status, hash, and target metadata.
   - Delimit external/reference prose as design data, not ECHO instructions. ECHO, permissions, tools, FSM, and project policy always have higher precedence.
   - Inject only the selected contract and relevant target adapter into agent context; keep the full catalog selectable but out of unrelated turns.
   - Make custom systems available through the same validated resource path and record their origin in RunState/session evidence.

5. **Theme and target adapters**
   - Map canonical tokens into the existing `ChatTheme`, Markdown palette, syntax/diff palette, and Savant-UI token surfaces rather than adding a parallel theme abstraction.
   - Define explicit OpenTUI/terminal, React, and CSS/web applicability. A web-only requirement must not block an OpenTUI target, and terminal color limitations must be represented.
   - Include light/dark or target variants where the selected system supports them. Fallbacks are limited to documented semantic substitutions (never invented accessibility-critical values); unsupported required roles produce an actionable validation diagnostic and cannot become active silently.
   - Add rendering/frame or equivalent tests for the CLI surfaces affected by active theme selection, including terminal degradation and an unsupported web-only token case.

6. **Mechanical design-contract enforcement**
   - Resolve the active system before scanning; scan supported `write_file`, `str_replace`, and `apply_patch` results at the existing EHEL/tool-executor boundary.
   - Define a normative policy before implementation: supported consumer extensions are TSX/JSX/HTML/CSS plus OpenTUI style properties; token-definition/admitted-design files, generated assets, tests, fixtures, vendored code, and non-visual data are excluded only through explicit path/classification rules. The policy must enumerate hardcoded color/typography/spacing patterns, dynamic expressions, CSS variables, and pre-existing versus newly proposed content.
   - Scan complete final proposed content, not replacement fragments. For patches, reconstruct the post-write file before scanning. A compliant token reference passes; a literal visual value not represented by an authorized token is blocked; parser ambiguity and unsupported syntax are `DESIGN_CONTRACT_NEEDS_REVIEW`; unavailable post-write content is fail-closed.
   - Emit dedicated `DESIGN_CONTRACT_BLOCK` and `DESIGN_CONTRACT_NEEDS_REVIEW` receipts with path, target, active-system hash, rule, and remediation. Never label design violations as ECHO Law 15 violations.
   - Add bounded per-path/token escalation with exact required role/token guidance and prove that the existing SELF-CORRECT transition is actually reached in an integration test. Hold the active normalized contract in memory for dispatch; do not parse raw Markdown in every tool call.

7. **Documentation, packaging, and release proof**
   - Document preset selection, custom-system import, interactive create/edit workflows, natural-language and slash triggers, cancellation/draft behavior, atomic save/reload semantics, provenance, font behavior, target limitations, default/reset behavior, persistence precedence, and enforcement policy.
   - Define and verify the artifact matrix: repository/source skill, CLI development run, packaged full CLI, Savant-Free/standalone distribution if it ships skills, and SDK package only if its runtime contract exposes resource loading. Each intended artifact must contain or resolve the same 74 admitted resources, manifest, schema, and required notices; an artifact that does not support design systems must explicitly exclude the feature rather than appear to support it.
   - Add deterministic resource drift checks, raw/admitted corpus count and hash checks, skill loading tests, resource traversal/security tests, parser/normalizer fixtures, quarantine/rejection fixtures, settings migration tests, command tests for interactive/headless dispatch, adapter tests, EHEL scanner tests, and an end-to-end active-system write test.
   - Update README/release documentation only after the implementation is verified. No release, push, publication, or deployment is part of this FID.

### Provenance and source policy

- The 74 built-in presets are curated reference systems sourced from the staged VoltAgent collection; each manifest entry must identify source repository, immutable source revision/snapshot, source path, exact source-content hash, deterministic normalized-output hash, and license/notice evidence.
- Preserve required license/notice material for redistributed source content, including the applicable MIT text and copyright notices where present. Do not make legal conclusions in product documentation and do not claim official brand ownership, endorsement, or authorship.
- Brand names may remain as preset selection/reference metadata when needed to identify the preset; product copy must not imply official affiliation.
- Font names are metadata with fallbacks by default. Font binaries require separate license evidence and are not bundled merely because a source document names a font.
- User-provided custom systems are not silently reclassified as Savant or source-curated systems; their source status and validation result remain explicit.

### Verification

The implementation is complete only when all of the following are proven with command output and, where applicable, runtime artifacts:

- The skill loader discovers the skill and resolves exactly 74 admitted resources from the source tree and built/packaged CLI path; raw staged input is not a runtime source.
- The raw → normalized → packaged pipeline is explicit and deterministic: raw count = 74, admitted count = 74, generated manifest count = 74, duplicate IDs = 0, all source/output hashes and provenance fields match, and drift checks fail closed.
- All 74 baseline inputs parse and validate; the 10 plain-Markdown inputs are covered by fixtures. Future/custom malformed, unmappable, unsafe, or incomplete input is deterministically rejected or quarantined with an evidence report and is never silently admitted.
- `/design list`, `/design use`, `/design current`, `/design create`, `/design edit`, `/design import`, `/design validate`, and `/design reset` work in the CLI with persisted precedence and invalid-input errors.
- The natural-language create intent reaches the same confirmed interactive wizard as `/design create`; ordinary design discussion does not write files.
- A built-in preset and a custom preset both become active and are grounded into a run with the correct source/hash/target metadata.
- A complete interactive create flow saves a valid system, reloads it after restart, and preserves the prior manifest/version on cancellation, validation failure, simulated fsync/flush failure, Windows rename or manifest-commit failure, process interruption, orphan recovery, or simulated crash at every temporary-write/version-rename/manifest-commit boundary.
- Editing a custom system changes its validated hash and revision; editing a built-in clones it before mutation; corrupt/stale drafts never become active. Draft list/resume/discard, expiry/count/size bounds, orphan cleanup, active-contract cache replacement, and post-save cleanup are covered by tests.
- Existing settings files remain valid and selection changes survive restart.
- OpenTUI and React/CSS adapter tests prove canonical tokens reach existing theme surfaces without regressions.
- Supported visual writes are accepted when using active tokens, blocked or explicitly marked `NEEDS-REVIEW` when violating the contract, and never bypass scanning because content is unavailable.
- Design-contract receipts are distinct from ECHO Law receipts, escalation is bounded, and a blocking violation reaches the intended correction path.
- SDK/common/agent-runtime/CLI typechecks, affected suites, full applicable tests, ESLint, Markdownlint, Prettier, quality, repository validation, and package/resource smoke checks pass. Any timeout or unavailable gate is `NEEDS-REVIEW`, never PASS.
- Independent manual review re-reads the implementation and verifies call-graph reachability for every new loader, command, resolver, adapter, and enforcement entry point.

## Perfection Loop

### Loop 1 — RED

- **RED:** Completed after rereading the single-agent protocol and inspecting the live skill loader, skill handler, registry, command registry, settings persistence, theme types/palette, EHEL, tool executor, staged corpus, FID template, and prior design FID. Identified the original plan's stale FID numbering, prompt-only enforcement gap, missing resource-loading contract, absent custom-system lifecycle, absent CLI selection lifecycle, theme-system duplication risk, font/provenance ambiguity, and lack of packaged-artifact proof.
- **GREEN:** Reframed the feature as one complete resource-aware skill product with built-in 74-preset catalog, custom systems, active selection, target adapters, CLI commands, deterministic validation, and EHEL enforcement. Kept implementation out of scope until operator approval.
- **AUDIT:** PASS — the initial planning evidence was independently checked against the live skill, CLI, settings, theme, EHEL, tool-executor, and corpus seams before the corrective review.
- **ADVERSARIAL:** PASS — the initial scope was challenged for prompt-only enforcement, missing resource loading, lifecycle gaps, theme duplication, provenance ambiguity, and packaged-artifact omissions; those findings were carried into Loop 2 self-correction.
- **CHANGE DELTA:** Initial FID creation; no production implementation changed.

### Missed Questions

1. **Should the 74 presets be temporary inspiration or built-in selectable product resources?** → Built-in selectable offline presets are in scope; the user's directive explicitly requires the complete catalog in the CLI.
2. **Should every preset be injected into every session?** → No. The catalog is shipped and selectable, but only the active system and relevant target adapter enter the agent context.
3. **Is the existing `savant-design` skill the requested library?** → No. It is governance-only and remains separate; `savant-design-systems` is the product skill.
4. **Can a skill alone mechanically enforce token use?** → No. The FID includes the existing EHEL/tool-executor enforcement path as a required complete stage.
5. **How are custom systems selected and persisted?** → Through validated `/design` commands and existing settings/config precedence, with explicit project/user/session origin.
6. **Can a source font name cause a font file to ship?** → No. Font names are references with fallbacks; binaries require separate redistribution evidence.
7. **What does a missing or invalid custom system do?** → It fails closed with an actionable error; no silent fallback to a preset.
8. **How is the approximately 2 MB catalog kept manageable?** → Resources remain in the loadable skill; only the active system is injected into a turn.
9. **What is the implementation boundary for “complete”?** → Skill packaging, resource loading, validation, selection, custom import, grounding, adapters, enforcement, tests, packaging proof, and documentation all pass. A prompt-only skill is explicitly incomplete.
10. **Does this FID authorize implementation?** → No. It defines the complete implementation contract and awaits operator approval.
11. **Should custom design creation be only an import command?** → No. A guided interactive creator and editor are mandatory product surfaces; import remains available for existing files.
12. **Can the natural-language trigger write directly?** → No. Only the documented imperative grammar may offer the creator, and it must receive explicit confirmation before invoking the same wizard/service as `/design create`; no implicit write occurs from ordinary prose.
13. **What happens when editing a built-in preset?** → The embedded preset is immutable; the CLI clones it into the selected project/user scope with explicit provenance, then edits the clone.
14. **Can an invalid draft replace a valid saved design?** → No. Validation precedes activation and atomic replacement; cancellation, validation failure, and persistence failure preserve the last valid saved version.
15. **What happens when a higher-priority selection is corrupt?** → Normal resolution reports the invalid source; `/design reset` removes the current scope override, and `/design reset --all` explicitly clears project/user selections so the documented default can be recovered.
16. **Can a headless command silently create a partial system?** → No. It requires the documented JSON shape and all required fields, otherwise exits non-zero with `INTERACTIVE_INPUT_REQUIRED` and writes nothing.
17. **How are interrupted drafts handled?** → They are bounded non-active resources managed by `/design drafts`, `/design resume <draft-id>`, and `/design discard <draft-id>`, with expiry and explicit cleanup.

### Code Verification Evidence

> Implementation evidence is recorded below from the working tree after operator approval and independent review.

- [x] All referenced existing source seams were read 0-EOF or inspected through repository tools before this FID was written.
- [x] Existing skill, command, settings, theme, EHEL, and corpus paths were verified against the live tree.
- [x] Implementation matches the Proposed Solution.
- [x] Focused tests, typechecks, formatting, changed-file lint, drift checks, hygiene, and package smoke validation pass.
- [x] Production call-graph evidence proves active design context reaches shared EHEL turn-end scanning.
- [x] FID status reflects implementation closure: `closed`.

> Full repository quality and Markdownlint gates remain classified as dirty-tree NEEDS-REVIEW evidence; no clean-release certification is claimed.

### Loop 2 — Independent audit and self-correction

- **RED:** Independent review identified incomplete authoring command coverage; ambiguous 74-preset admission versus quarantine; unresolved raw/normalized/packaged source-of-truth boundaries; a manifest durability/rollback gap; incomplete startup orphan recovery; underspecified headless transport; timestamp determinism ambiguity; insufficient natural-language fixtures; and unstated active-contract cache invalidation.
- **GREEN:** Applied self-corrections: complete authoring command grammar; exactly-74 baseline admission with future-input quarantine; raw → normalized → packaged pipeline and source-of-truth boundaries; immutable version files plus atomic manifest commits; startup orphan/journal recovery; exact `--design-input <path|->` and versioned JSON errors; deterministic content identity separate from UTC timestamps; normative natural-language fixtures; and explicit active-contract cache replacement after create/edit/use/reset/reload.
- **AUDIT:** PASS after corrections. The FID now covers the complete selectable skill product rather than a prompt-only or corpus-only proof of concept. The single-FID scope is retained, with implementation stages providing internal sequencing and dependency gates.
- **ADVERSARIAL:** PASS with no unresolved blocker. The remaining legal/provenance boundary is explicitly framed as preservation/evidence and no legal conclusion; the runtime design separates reference data, active contract, skill guidance, and EHEL enforcement.
- **CHANGE DELTA:** Planning-only corrections to defaults, provenance hashes, path security, lifecycle/CLI contracts, adapter fallbacks, enforcement policy, artifact coverage, validation outcomes, and independent review evidence. No production implementation changed.

### Loop 3 — Final convergence

- **RED:** Re-read the corrected FID against the original user requirement: a complete loadable skill with the full approximately 2 MB built-in catalog, custom systems, CLI selection, active grounding, adapters, mechanical enforcement, and interactive create/edit/save/reload workflows; no half-baked prompt-only delivery.
- **GREEN:** Confirmed all requested product surfaces are mandatory: explicit slash triggers, bounded/confirmed natural-language create intent, guided authoring, editing, clone-before-edit for built-ins, documented headless JSON, resumable bounded drafts, platform-aware durable atomic persistence, validation-before-activation, and reloadable saved systems. The FID does not authorize implementation, release, publication, or archival before operator approval.
- **AUDIT:** PASS — explicit default, selection precedence, provenance, resource security, interactive lifecycle, target adapters, enforcement receipts, packaged-artifact proof, and complete test/gate expectations are present.
- **ADVERSARIAL:** PASS — no unresolved contradiction, silent write trigger, unsafe raw editor bypass, invalid-draft activation path, attribution violation, or unsupported completion claim remains in the planning document.
- **CHANGE DELTA:** Added the interactive authoring/editor lifecycle, bounded natural-language confirmation grammar, documented headless input contract, atomic durability and failure semantics, explicit reset recovery, built-in clone-before-edit behavior, resumable draft handling, and corresponding acceptance tests. No production implementation changed.

### Loop 4 — Deep convergence correction

- **RED:** Fresh independent review found nine remaining planning gaps: incomplete authoring command coverage; ambiguous baseline admission; unresolved raw/normalized/packaged source-of-truth boundaries; a manifest durability/rollback hole; incomplete startup orphan recovery; underspecified headless transport; timestamp determinism ambiguity; insufficient natural-language fixtures; and unstated active-contract cache invalidation.
- **GREEN:** Corrected each gap by adding the complete command grammar and checklist, requiring exactly 74 admitted baseline resources, defining raw → normalized → packaged ownership, switching persistence to immutable versions plus atomic manifest commits, defining journal/orphan recovery, specifying `--design-input <path|->` with `DesignAuthoringInputV1`, separating content hashes from UTC timestamps, adding positive/negative trigger fixtures, and requiring cache replacement after every selection or authoring mutation.
- **AUDIT:** PASS — the complete command set, exactly-74 baseline, raw → normalized → packaged ownership, immutable-version/manifest commit model, startup recovery, headless transport, trigger fixtures, and active-contract ownership are explicit.
- **ADVERSARIAL:** PASS — no unresolved silent fallback, invalid-draft activation, unsafe natural-language write, mutable-cache race, or unsupported durability claim remains. Platform limitations are classified rather than overstated.
- **CHANGE DELTA:** Planning-only corrections; no production implementation changed.

### Loop 5 — Final convergence

- **RED:** Re-read the complete FID after Loop 4 correction against the requested product: a fully shippable loadable skill with the complete preset catalog, custom creation, editing, save/reload, CLI and natural-language entry points, and runtime enforcement.
- **GREEN:** Confirmed the FID specifies the complete raw → normalized → packaged pipeline, exact authoring command grammar, guided wizard/editor, headless contract, bounded draft recovery, immutable version persistence, active-contract resolver ownership, target selection precedence, provenance, adapters, grounding, EHEL enforcement, and release evidence.
- **AUDIT:** PASS — independent post-Loop-5 review completed after this loop was recorded and found no remaining planning blocker. Fresh document-level checks pass for status/location, attribution, stale references, required workflow markers, Prettier, and loop structure; unavailable direct Markdownlint is recorded as a tooling limitation rather than a source PASS.
- **ADVERSARIAL:** PASS — the post-Loop-5 review found no unresolved contradiction, stale reference, forbidden attribution, silent write path, invalid activation path, mutable cache handoff, or overstated durability guarantee. Implementation then proceeded under the approved automation scope.
- **CHANGE DELTA:** Final convergence evidence update recording the post-Loop-5 independent review and fresh document checks; no production implementation changed.

### Loop 6 — Implementation closure

- **RED:** Nova's implementation audit identified four blockers: incomplete scanner coverage for OpenTUI values and dynamic expressions, unsafe arbitrary path references, missing shared headless validation, and incomplete all-wrapper archive evidence. The repository quality ratchet and Markdownlint also remained non-green because of broader dirty-tree changes.
- **GREEN:** Added shared `--design-input` validation, canonical approved-root and reparse-point containment checks, immediate pre-read rechecks, unitless/camelCase OpenTUI spacing and radius scanning, dynamic visual-expression `NEEDS-REVIEW` handling, dedicated `DESIGN_CONTRACT_BLOCK` / `DESIGN_CONTRACT_NEEDS_REVIEW` messages, and scanner regression tests. Verified all three release wrappers through isolated `npm pack`, extraction, and the production catalog validator with 74 resources each.
- **AUDIT:** PASS — focused suites passed (42 tests across 8 files), CLI/agent-runtime/design-systems typechecks passed, Prettier and changed-file ESLint passed, design-system and protocol-bundle drift checks passed, hygiene passed, and the active design contract was traced through CLI run config → SDK state → EHEL turn-end scanning.
- **ADVERSARIAL:** PASS — independent review found no critical blocker after the fixes. Built-in edit uses clone-before-edit, headless input uses the shared schema, custom paths are constrained and rechecked, scanner receipts remain distinct from Law 15, and all three package wrappers validate after extraction.
- **CHANGE DELTA:** Implementation completed under the approved automation scope; no release, push, publication, deployment, or commit was performed. The broader repository quality/Markdownlint failures remain explicitly classified as dirty-tree evidence and are not claimed green.

## Resolution

- **Closed Date:** 2026-08-11
- **Fix Description:** Shipped the loadable `savant-design-systems` skill with 74 offline resources, deterministic manifest/normalization, active selection precedence, custom import/create/edit/draft lifecycle, atomic versioned persistence, headless JSON transport, active design grounding, target-aware contract scanning, and release-wrapper packaging support.
- **Tests Added:** Design-system parser/manifest/selection/authoring/draft/service tests; EHEL design-contract tests; wrapper safety and archive validation tests.
- **Verification Evidence:** Focused implementation suites passed (42 tests across 8 files, 0 failures); CLI, agent-runtime, and design-systems typechecks passed; Prettier and changed-file ESLint passed; design-system and protocol-bundle drift checks passed; hygiene passed; isolated pack/extract/production validation passed for `savant-code`, `savant-code-staging`, and `savant-free`, each with 74 resources. Independent Nova implementation review returned PASS.
- **Archived:** Moved to `dev/fids/archive/` after closure.

> This is working-tree closure evidence. The repository remains dirty from concurrent/unrelated work, and no clean-release certification is claimed.

## Lessons Learned

A loadable skill is the correct product boundary only when it is treated as a package/resource system rather than a prompt file. Complete delivery requires resource resolution, active selection, custom-system lifecycle, target adapters, deterministic validation, packaged-artifact proof, and a mechanical enforcement seam. Progressive disclosure controls context size; it does not replace runtime enforcement. Interactive creation and editing belong in the same validated service as import and selection: the wizard improves usability, while schema validation, atomic persistence, provenance, and EHEL remain the correctness boundary. The existing governance skill and the new design-system library must remain separate capabilities.
