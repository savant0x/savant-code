<!-- markdownlint-disable MD013 -->

# FID: Code Universe Document and Image Viewer

**Filename:** `FID-2026-0807-006-code-universe-document-and-image-viewer.md`
**ID:** FID-2026-0807-006
**Severity:** high
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**Author:** Savant 
**YAGNI-Compliance:** Verified

---

## Summary

The Code Universe document endpoint is currently unusable in the real export: every file displays `Document content is disabled for this export.` PNG files also cannot render because the serializer treats NUL-containing files as text-unavailable binary data, while the document schema has no media variant or image renderer. The first failure is a policy/call-site mismatch, not a browser `file://` restriction: the graph template passes `documents: true`, but the serializer additionally requires `SAVANT_GRAPH_EXPORT_DOCUMENTS=1`, and the normal `/graph-export` command does not set that environment variable. This FID makes the product export explicitly request bounded documents, adds safe offline raster-image data, and preserves metadata-only behavior for direct serializer callers.

## Environment and Evidence

- **OS:** Windows; target Chrome/Chromium and offline `file://` HTML
- **Runtime:** TypeScript, Bun 1.3.14
- **Renderer:** Sigma.js + Graphology; center browser in `cli/src/commands/graph-export/template.ts`
- **Serializer:** `packages/knowledge-graph/src/export-serializer.ts`
- **Prior FIDs:** FID-2026-0807-004 hierarchy/document viewer; FID-2026-0807-005 initialization/parser failure

```text
packages/knowledge-graph/src/export-serializer.ts:713-717
const documentsEnabled =
  options.documents === true &&
  Boolean(projectRoot) &&
  process.env.SAVANT_GRAPH_EXPORT_DOCUMENTS === '1' &&
  process.env.SAVANT_GRAPH_EXPORT_NO_PREVIEW !== '1'

cli/src/commands/graph-export/template.ts:57-71 (pre-fix evidence)
Before implementation, both serializeGraphForExport calls passed { projectRoot, documents: true }
but did not set SAVANT_GRAPH_EXPORT_DOCUMENTS. The fixed call graph now passes documents: false for
layout and documents: true only for the final product serialization.

cli/src/commands/graph-export/template.ts:458
The viewer displays DATA.universe.documentPolicy.enabled ? 'content unavailable' : 'documents disabled'.

packages/knowledge-graph/src/export-serializer.ts:64-75 (pre-fix evidence)
UniverseDocument originally contained only text/line/byte/truncated fields and an unavailableReason;
the verified implementation now uses the discriminated text/image/unavailable union described below.

packages/knowledge-graph/src/export-serializer.ts:343-351 (pre-fix evidence)
NUL-detected files originally returned unavailableReason: 'binary' with no media payload; the verified
implementation checks allowlisted raster extensions/signatures before the generic binary branch.

Pre-implementation real artifact probe:
policy { enabled: false, maxLines: 500, maxBytes: 51200 }
documents 0
files 2084
image-like payload refs 1 (branding only)

Post-implementation probe is recorded in Resolution: policy enabled; 2,084 documents; 1,424 text documents; 2 PNG images; app script parses; image data URIs contain no network URLs.
```

The unique-origin message for `file:` is informational. Inline `data:` image URLs are compatible with offline local HTML, but base64 adds approximately 33% encoding overhead and large inline payloads increase parse/memory cost. SVG is excluded by default because active content must be sanitized before embedding.

## Detailed Description

### Problem

Text file cards successfully enter the document viewer, but the real export contains no `universe.documents` entries because the command path never enables the serializer’s second opt-in gate. The user therefore sees the disabled state for every file. Raster images such as PNG are classified as binary by the text reader and have no alternative representation, so selecting them also cannot show the file.

### Expected Behavior

1. The normal `/graph-export` artifact opens capped text content without requiring the operator to set an environment variable.
2. Direct serializer callers remain metadata-only unless they explicitly pass `documents: true`; `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1` remains a hard-off.
3. Allowlisted PNG/JPEG/GIF/WebP files render in the document surface as offline images with full repository path, MIME, byte size, and an accessible alt label.
4. Unsupported binary files, malformed images, oversized images, unsafe paths, and unreadable files show explicit unavailable states, never a blank viewer or crash.
5. The export remains self-contained and makes no network requests.
6. Text and image payloads remain bounded by per-file and total export budgets so a multi-thousand-file repository cannot create an unbounded HTML artifact.

## Root Cause

1. **Double opt-in mismatch:** `options.documents === true` is not sufficient; the serializer requires `SAVANT_GRAPH_EXPORT_DOCUMENTS=1`. The product caller passes the first gate but not the second.
2. **Text-only document schema:** `UniverseDocument` has no discriminant, MIME, data URI, or media metadata.
3. **Binary terminal branch:** the NUL probe correctly prevents treating binary data as text but routes all binary files to one unavailable state.
4. **Viewer has no media branch:** `renderDocument()` only creates line-numbered text rows or an unavailable message.
5. **No aggregate payload budget:** the current contract has per-file caps but no aggregate text/media limits, so the product export has no explicit total-content bound.

## Impact Assessment

### Affected Components

- `packages/knowledge-graph/src/export-serializer.ts` — document policy, media types, text/image readers, byte budgets
- `cli/src/commands/graph-export/template.ts` — explicit product document mode and image viewer branch
- `cli/src/commands/graph-export.ts` — no API change expected; command continues using the product template
- `cli/src/commands/__tests__/graph-export.test.ts` — policy, text, image, safety, and HTML contracts
- `dev/test-prompts/graph-export-e2e.ts` — generated artifact media/document markers
- `dev/exports/graph/savant-graph.html` — regenerated real artifact

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Core document inspection is broken; workaround requires hidden environment configuration
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Cosmetic issue

## Proposed Solution

### Exact Document Contract

Extend the canonical `GraphUniverse.documents` map with a discriminated union:

```ts
interface UniverseTextDocument {
  kind: 'text'
  text: string
  lineCount: number
  byteCount: number
  truncated: boolean
}

interface UniverseImageDocument {
  kind: 'image'
  mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  dataUri: string
  byteCount: number
  truncated: false
  width?: number
  height?: number
}

interface UniverseUnavailableDocument {
  kind: 'unavailable'
  // null means the source could not be safely stat'ed/read (for example,
  // unreadable or outside-root); otherwise this is the full source size.
  byteCount: number | null
  unavailableReason:
    | 'binary'
    | 'unsupported-image'
    | 'malformed-image'
    | 'oversized'
    | 'unreadable'
    | 'outside-root'
}

type UniverseDocument =
  | UniverseTextDocument
  | UniverseImageDocument
  | UniverseUnavailableDocument
```

`documentPolicy` becomes:

```ts
interface UniverseDocumentPolicy {
  enabled: boolean
  maxTextLines: number
  maxTextBytes: number
  maxImageBytes: number
  maxTotalTextBytes: number
  maxTotalMediaBytes: number
}
```

The `documents` map remains the one canonical document location. Do not duplicate content on `UniverseFile`.

### Exact Policy and Budgets

Policy precedence is deterministic:

1. `SAVANT_GRAPH_EXPORT_NO_PREVIEW=1` is the highest-priority hard-off and disables previews and documents for every caller.
2. Otherwise, `options.documents === true` explicitly requests bounded documents; `options.documents !== true` remains metadata-only.
3. `SAVANT_GRAPH_EXPORT_DOCUMENTS=0` is a lower-priority operator override that disables documents even when the caller requests them.
4. `SAVANT_GRAPH_EXPORT_DOCUMENTS=1` is compatibility opt-in for legacy explicit-document callers, but is not required when `options.documents === true`; an unset variable does not disable an explicit request.

The normal product export relies on the explicit final-call option, not process-environment mutation. Direct callers that omit `documents` remain metadata-only. Text defaults remain **500 lines / 50 KiB per file**.

- Aggregate embedded text is capped at **8 MiB raw UTF-8 bytes**. Once the aggregate text budget is exhausted, later text entries become `unavailableReason: 'oversized'` while metadata remains visible.
- Images use an allowlist of PNG, JPEG, GIF, and WebP. SVG is unsupported unless a future FID adds sanitization.
- Each image is capped at **2 MiB raw bytes**.
- Total embedded media is capped at **16 MiB raw bytes**. Once the aggregate media budget is exhausted, later media entries become `unavailableReason: 'oversized'` while metadata remains visible.
- The separate text and media budgets bound total embedded content to **24 MiB raw bytes** before data-URI encoding overhead; the generated HTML may be larger because base64 is intentionally offline-safe.
- The extension mapping is fixed: `.png` → `image/png`, `.jpg`/`.jpeg` → `image/jpeg`, `.gif` → `image/gif`, and `.webp` → `image/webp`; matching is case-insensitive.
- Required signatures are fixed: PNG `89 50 4E 47 0D 0A 1A 0A`; JPEG `FF D8 FF`; GIF ASCII `GIF87a` or `GIF89a`; WebP `RIFF` at bytes 0–3, `WEBP` at bytes 8–11, and a minimum 12-byte header. Extension/MIME mismatch or a missing/invalid signature becomes `malformed-image`; a valid but unsupported image extension remains `unsupported-image`.
- Validation order is containment/readability → source-byte stat/read → extension allowlist → source-byte size cap → signature check → aggregate media budget → data-URI encoding. Containment/readability failures always produce `unreadable` or `outside-root` with `byteCount: null`. For a readable file, an oversized source produces `oversized` before extension/signature classification; a readable file within the size cap with an unsupported allowlist extension produces `unsupported-image`, and an allowlisted extension with a bad/missing signature produces `malformed-image`. `byteCount` is the full source-file byte count for all readable document variants; aggregate counters count only embedded UTF-8 text bytes or embedded raw image bytes after all per-file truncation/size checks and before base64 encoding.
- The aggregate text/media counters reset at the beginning of the final serialization pass. The document-free structural/layout pass never creates document entries or increments either counter.
- Data URIs are generated from validated bytes and inserted into the DOM through the image element’s `src` property. File labels, paths, and alt text use `textContent`/attributes, never `innerHTML`.
- Text binary detection remains; a binary file that is not an allowed raster image becomes `binary` or `unsupported-image`.

### Product Export Call Site

The graph template remains the explicit product boundary. The initial layout serialization passes `documents: false` because layout only needs structural elements and must not read or budget document payloads. The final serialization alone passes `documents: true` with fresh deterministic text/media budget state, so the discarded layout pass cannot consume the final export’s content budget. The serializer’s direct default remains metadata-only when `documents` is omitted; an explicit `documents: true` becomes the documented request for bounded content and is no longer dependent on a hidden environment variable.

### Viewer Behavior

- `kind: 'text'`: existing line-numbered document surface.
- `kind: 'image'`: create an `<img>` element with `src = document.dataUri`, `alt = file.path`, and a bounded responsive style; display MIME/byte metadata and the full path.
- `kind: 'unavailable'`: display the exact safe reason and preserve the back-to-folder action.
- Missing map entries while policy is disabled: retain the disabled state only for explicitly disabled direct serializer output; the normal graph export must contain text/image entries unless hard-off is set.

### Steps

1. Update the serializer document union, policy fields, MIME allowlist, signature validation, per-image and aggregate budgets.
2. Correct the product call-site policy so normal graph exports request bounded documents without requiring a hidden environment variable.
3. Preserve hard-off and direct-library metadata-only behavior; document the precedence precisely.
4. Add the image branch to `renderDocument()` using DOM properties and safe attributes.
5. Add tests for default product export with no environment variable, explicit `documents: true` with the variable unset, `documents: false`/omitted with `SAVANT_GRAPH_EXPORT_DOCUMENTS=1`, the document-free first layout pass, text content, PNG/JPEG/GIF/WebP data-URI rendering, each required signature, malformed/mismatched/binary files, readable oversized-vs-malformed precedence, unreadable/out-of-root `byteCount: null`, both hard-off overrides, path containment, per-file caps, aggregate text/media exhaustion, exact `byteCount`/aggregate accounting, and no external URLs.
6. Extend the live harness and regenerate the real artifact. Verify it contains document entries for safe text/images, explicit unavailable states for rejected content, correct policy/budget metadata, and no external URL references.

## Five Questions

1. **All cases?** Yes within the defined contract: text, supported raster, unsupported binary, malformed/mismatched media, missing files, hostile paths, hard-off, and budget exhaustion each have explicit states.
2. **1000x scale?** Per-file plus aggregate text and media budgets prevent unbounded embedded-content growth; the UI renders one selected document, not all contents at once. The fixed budgets intentionally trade complete repository embedding for a responsive, bounded offline artifact.
3. **Hostile attacker?** Root containment, signature validation, MIME allowlisting, no SVG execution, data-only `src`, and `textContent` rendering prevent path/content injection. The export still must not read symlink escapes.
4. **Maintainable in 2 years?** A discriminated document union isolates text/image rendering and makes future media types additive.
5. **Industry standard?** Offline export of bounded validated media as data URLs is standard for self-contained artifacts; avoiding unsanitized SVG and arbitrary binary embedding is the safer standard.

## Perfection Loop

### Loop 1 — RED

- **CONFIRMED:** Normal product export passes `documents: true` but the serializer also requires `SAVANT_GRAPH_EXPORT_DOCUMENTS=1`; exact evidence is quoted in the Environment section.
- **CONFIRMED:** `UniverseDocument` has no image/data URI variant (`packages/knowledge-graph/src/export-serializer.ts:64-75`).
- **CONFIRMED:** NUL-detected files terminate in `'binary'` (`packages/knowledge-graph/src/export-serializer.ts:343-351`).
- **CONFIRMED:** `renderDocument()` has only text/unavailable branches (`cli/src/commands/graph-export/template.ts:446-474`).
- **CONFIRMED:** Existing test asserts metadata-only direct serialization and only enables documents by mutating the environment (`cli/src/commands/__tests__/graph-export.test.ts:476-511`).
- **CALL-GRAPH:** Production callers of `serializeGraphForExport` include the graph template; the proposed image/document fields have no callers until implementation.

### Loop 1 — GREEN

- Make product export explicitly document-enabled while preserving direct serializer metadata-only defaults.
- Use one discriminated document union, not parallel text/media maps.
- Embed only validated PNG/JPEG/GIF/WebP data under per-image and aggregate media caps.
- Apply a separate aggregate text cap so total embedded content remains bounded.
- Keep SVG excluded until a dedicated sanitizer FID exists.
- Make every failure visible and typed; never fall back to the generic disabled message when policy is enabled.
- Render image data through DOM properties, not HTML strings.

### Missed Questions and Answers

1. **Why not simply set the environment variable in the command?** → Environment mutation is hidden global state and does not travel cleanly through tests or library consumers. The product template should pass an explicit document option; the serializer should distinguish direct default behavior from an explicit request.
2. **Should all binaries be embedded?** → No. Only allowlisted raster formats with validated signatures are embedded; arbitrary binary and SVG remain unavailable.
3. **What happens when a repository has thousands of images?** → A 2 MiB per-image and 16 MiB aggregate raw-media budget preserves artifact bounds; later images show an explicit budget-unavailable state.
4. **Can an image be trusted by extension alone?** → No. Use the fixed extension mapping and required magic-byte signatures; reject mismatches in a deterministic order.
5. **What exactly do the budgets measure?** → `byteCount` is the full source size; aggregate text counts post-truncation UTF-8 bytes and aggregate media counts validated raw image bytes before base64 encoding. Counters reset for the final pass, while the document-free layout pass never increments them.
6. **What happens when an environment override conflicts with an explicit option?** → `NO_PREVIEW=1` wins globally, then `DOCUMENTS=0` disables, then explicit `documents: true` enables; `DOCUMENTS=1` is legacy compatibility only, and an unset variable does not block an explicit request.
7. **Should the browser decode image bytes itself?** → No. The exporter creates the data URI; the browser only assigns it to an `<img>` element.
8. **Should text remain opt-in for direct callers?** → Yes. The product export is an explicit bounded-document caller; the serializer’s omitted/default option remains metadata-only. `DOCUMENTS=1` alone must not enable documents when `documents` is omitted.
9. **What about SVG?** → Exclude it. SVG can contain scripts/external references; add it only with a separate sanitizer/security FID.
10. **What if the normal export would become large?** → Separate aggregate text/media caps bound embedded content; the operator can use `SAVANT_GRAPH_EXPORT_DOCUMENTS=0` or the hard-off for a metadata-only artifact.
11. **How are symlinks handled?** → Reuse the existing realpath containment guard from FID-2026-0807-004; all document/media reads must resolve inside the project root.
12. **How is the image viewer tested without Chrome?** → Assert the generated app script parses, the image branch creates an `img`, assigns `src`/`alt`, and the live harness checks media markers; direct browser interaction remains `NEEDS-REVIEW` if navigation tooling is unavailable.

### Loop 1 — AUDIT

- **PASS — current-cause evidence:** `packages/knowledge-graph/src/export-serializer.ts:713-717` quotes the environment gate; `cli/src/commands/graph-export/template.ts:57-71` quotes the product call with no environment mutation.
- **PASS — binary evidence:** `packages/knowledge-graph/src/export-serializer.ts:343-351` quotes the NUL branch returning `'binary'`.
- **PASS — viewer evidence:** `cli/src/commands/graph-export/template.ts:446-474` quotes the text/unavailable-only renderer.
- **NEEDS-REVIEW — proposed image signature parser:** not present until implementation; must be verified by tests after coding.
- **NEEDS-REVIEW — proposed aggregate text/media budgets:** not present until implementation; must be verified against generated payload accounting and the regenerated artifact after coding.
- **PASS — two-pass design:** the initial layout pass is explicitly document-free, so only the final serialization consumes content budgets; this must be verified at `cli/src/commands/graph-export/template.ts` after coding.
- **PASS — scope decision:** no renderer migration or network dependency is required; this is a serializer/viewer contract correction.

### Loop 1 — ADVERSARIAL

- **CONFIRMED:** The disabled message is caused by the serializer policy mismatch, not by `file://` security.
- **CONFIRMED:** Treating PNG as text is incorrect; an image-specific data contract is required.
- **ADJUSTED:** Product export documents are explicitly enabled at the final call boundary, while the initial layout pass is document-free and direct serializer defaults remain metadata-only; this avoids hidden process environment mutation and double budget consumption.
- **ADJUSTED:** Aggregate text is now bounded separately from aggregate media, so the scale claim no longer relies on a per-file cap alone.
- **ADJUSTED:** Policy precedence, byte-accounting units, counter reset behavior, exact raster signatures, unavailable `byteCount` semantics, and oversized-vs-malformed precedence are now explicit, removing implementation ambiguity.
- **REFUTED:** Embedding arbitrary binary or unsanitized SVG is not necessary to satisfy the request and would increase security/payload risk.
- **OMISSION CHECK:** The plan covers text, supported images, malformed images, unsupported binaries, hard-off, direct-vs-product policy, root/symlink containment, per-file/aggregate limits for both text and media, two-pass budget isolation, safe DOM rendering, tests, artifact regeneration, and browser evidence honesty.
- **VERDICT:** FID was implementation-ready and remained `analyzed` pending operator approval at design-loop completion. It is now `verified` after implementation and post-implementation audit.

## Code Verification Evidence

- [x] ECHO.md reread 0-EOF before FID planning.
- [x] Existing serializer, template, command path, tests, and real artifact inspected.
- [x] RED catalogs the policy mismatch, binary branch, missing media schema, and missing viewer branch.
- [x] GREEN answers default policy, MIME safety, SVG scope, budgets, and testability.
- [x] AUDIT cites current source evidence and marks proposed implementation as NEEDS-REVIEW.
- [x] ADVERSARIAL re-audits scope, security, scale, and `file://` assumptions.
- [x] SELF-CORRECT resolves aggregate text-budget and two-pass budget-consumption findings.
- [x] SELF-CORRECT resolves policy-precedence, budget-unit, signature-validation, and test-contract findings.
- [x] Operator approval for implementation.
- [x] Production implementation and post-implementation verification.

## Resolution

- **Fixed By:** Savant 
- **Fixed Date:** 2026-08-07
- **Fix Description:** Implemented explicit product document enablement, typed text/image/unavailable documents, bounded text/media budgets, raster signature validation, SVG/known-media rejection, safe offline data-URI image rendering with visible load failure fallback, document-free layout serialization, and regression coverage.
- **Tests Added:** Yes — explicit policy precedence, hard-offs, text documents, PNG media, malformed/unsupported media, aggregate budgets, generated image viewer markers, and live product-export payload checks.
- **Verified By:** Independent code review plus knowledge-graph/CLI typechecks and tests, live E2E harness, ESLint, Prettier, markdownlint, generated app-script syntax probe, and real artifact payload probe.
- **Verification Evidence:** knowledge-graph 17/17; CLI graph-export + containers 20/20; live E2E 18/18; `KG=0 CLI=0 E2E=0 ESLINT=0 MARKDOWNLINT=0`. Real artifact `dev/exports/graph/savant-graph.html`: 13,265,876 bytes; policy enabled; 2,084 documents (1,424 text, 2 PNG images, 658 explicit budget-unavailable); app script parses; image data URIs contain no network URLs; deterministic export passed.
- **Browser Runtime:** `NEEDS-REVIEW` — browser helper returned no runtime result for the local `file://` artifact, so direct Chrome click/load behavior is not claimed.
- **Commit/PR:** Pending operator push
- **Archived:** Yes — moved to `dev/fids/archive/` on close

## Lessons Learned

A feature can be structurally present yet functionally disabled when policy is split between an explicit option and a hidden environment
variable. Offline document viewers also need a typed media contract; binary rejection is correct for text parsing but incomplete for a
code-universe explorer that must show images.
