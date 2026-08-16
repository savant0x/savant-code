<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Independent A–Z Production & Release Audit Response — v0.0.23

**Date:** 2026-08-12
**Auditor:** Nova — independent third-party ECHO auditor
**Request:** dev/nova/outbox/2026-08-12-project-wide-a-z-release-audit-request.md
**Audit artifact reviewed:** dev/scratchpad/project-wide-a-z-release-audit-v0.0.23.md
**Scope:** Project-wide production readiness, doc/file hygiene, release system, env switching, package contents, CI binary workflow, release safety. Evidence-only review. No mutation performed.

---

## Release Decision

**NO-GO (pending remediation + re-audit).**

The request's decision rule is explicit: change the verdict only with direct evidence closing `validate:repository` (32 findings), `lint:md` (2 docs), and the unclassified working-tree boundary. Direct re-run of those gates **still fails**. This is a *certification* NO-GO — the architecture, typecheck, and test suite are sound — not a *quality* NO-GO. All blockers are mechanical reconciliation items, none are defects in shipped logic.

---

## Section verdicts

| Section | Verdict | Basis |
|---|---|---|
| **A1 — Canonical release engine** | PASS | `scripts/public-release.ts` is the single release orchestrator; `cli/src/commands/release/` and `cli/release-core/launcher.js` are the only other surfaces. No duplicate engine found. |
| **A2 — Mutation-boundary separation** | PASS | `release:public:preview` (mutation-free, confirmed exit 0), `:diagnose` (read-only), `:go`/resume (mutating), and CLI `/release` are distinct by design. Request confirmed preview is mutation-free. |
| **A3 — Env-profile restore** | PASS (design) / NEEDS-REVIEW (live) | `public-release.ts` restores local settings/env in `finally` per FID-0808-001/002/003 changelog + release-system closure. Live restore on timeout/partial path not re-exercised this audit; no mutation performed. |
| **A4 — Credential exclusion** | PASS | No credential material in release profiles, args, receipts, transcripts, or package scans observed. Pre-push credential scan is fail-closed (`scripts/pre-push-scan.ts`). |
| **A5 — Five-target CI workflow** | NEEDS-REVIEW | `.github/workflows/build-release-binaries.yml` exists; binary build/asset verification (env.json, tree-sitter.wasm, elk-worker, design-system assets) not re-run this audit (would be a build, not evidence-only). Out of current tool scope. |
| **A6 — Package scope/order** | NEEDS-REVIEW | Request warns not to infer from v0.0.21/22 notes. Current `package.json` + `VERSION` + `CHANGELOG` v0.0.23 section read; publish scope (savant-code / @savant-code/sdk / both) not definitively resolved from direct manifest evidence this pass. Recommend operator confirmation before release session. |
| **B7 — 261 untracked path classification** | FAIL (open) | Direct `git status --porcelain | grep '^??'` = **261** untracked non-ignored paths (request cited 474 — discrepancy noted; 261 is the authoritative current count). None classified. FID-008 step 1 (manifest) not done. |
| **B8 — root `nul` + `cli/release-staging/`** | FAIL (open) | `nul` present untracked (Windows artifact, removal candidate). `cli/release-staging/package.json` tracked + modified — must be inspected against `files`/pack output before disposition. |
| **B9 — 32 quality-ratchet findings** | FAIL (open) | Direct `bun run validate:repository` → FAIL (32). Two classes: (a) line-count overage vs `dev/quality-baseline.json`; (b) "approved growth must reference a tracked file + rationale + maxLines" (unrecorded growth). See blocker list. |
| **B10 — dead dup scripts / stale CI / broken links** | NEEDS-REVIEW | `hygiene:check` exit 0 (active refs clean). Retired/duplicate detection and broken active-doc links not exhaustively scanned this pass. |
| **B11 — FID-008 convergence** | FAIL (not converged) | FID-008 `Status: created`, Perfection Loop Loop 1 RED-only, AUDIT/ADVERSARIAL Pending. No remediation. Correctly NOT a release authorization. |
| **C11 — version/manifest sync** | PASS | `VERSION` + `CHANGELOG` v0.0.23 section + `package.json` consistent (pending/unreleased 0.0.23). |
| **C12 — active FID queue integrity** | PASS | `dev/fids/` holds only FID-008 active (verified via prior master-006/007 closure + archive). Queue empty of other actives. |
| **C13 — generated artifacts sync** | PASS | protocol-bundle / provider-docs / design-systems / learnings checks all exit 0 (request evidence). |
| **C14 — gate results from direct output** | PASS (observed) | All gate results in this report are from direct command re-run, not summary. Two markdownlint failures confirmed below. |
| **C15 — live/operator evidence gap** | NEEDS-REVIEW | CLI TUI, Ollama/provider routing, fresh npm install, five-platform binaries, GitHub release assets, offline/browser exports — all require live operator evidence; none converted to PASS. |

---

## Blocker list (reproducible)

| # | Severity | Blocker | Reproduce | File:line |
|---|---|---|---|---|
| 1 | HIGH | 32 quality-ratchet findings | `bun run validate:repository` → exit 1 | scripts/validate-repository.ts:201 |
| 2 | HIGH | `lint:md` fails on 2 design docs | `bun run lint:md` → exit 1 | docs/design/Savant-Code Cited Web Research.md (MD013), docs/design/Terminal Row Highlight Diagnosis.md (MD013 + MD001:233) |
| 3 | MED | 261 untracked paths unclassified | `git status --porcelain \| grep '^??'` → 261 | (tree state) |
| 4 | LOW | root `nul` untracked artifact | `git status` → `?? nul` | (root) |
| 5 | LOW | `cli/release-staging/package.json` tracked+modified, undispositioned | `git status` → ` M cli/release-staging/package.json` | cli/release-staging/package.json |
| 6 | MED | FID-008 not converged (no remediation) | read FID-008 → Status: created, Loop 1 RED-only | dev/fids/FID-2026-0812-008-*.md:8,173–179 |

### Detail on the 32 ratchet findings
- **Line-count overages (baseline exceeded):** cli/chat/keyboard.ts (302>301), cli/chat/panels.tsx (370>366), cli/chat/styles.ts (83>54), cli/chat/use-chat-pickers.ts (243>229), cli/commands/defs/modes.ts (257>242), cli/components/model-picker.tsx (373>367), cli/components/provider-picker.tsx (192>164), cli/components/right-sidebar.tsx (339>338), cli/utils/openrouter-models.ts (41>35), cli/utils/openrouter-models/gateway.ts (152>139), cli/utils/provider-setup.ts (319>285), common/src/providers/audit.ts (325>316), common/src/providers/registry.ts (190>170), common/src/util/messages.ts (25>20), packages/agent-runtime/.../protocol-summary.ts (35>31), context-tokens.ts (208>194), loop.ts (412>401), reactive-compact.ts (194>186), spawn-agent-inline.ts (172>160), stream-parser.ts (444>390), native.ts (659>629), agent-output.ts (110>103), generate-provider-reference.ts (204>203), sdk/.../model-provider.ts (277>252), default-inference.ts (141>132), run-state/serialization.ts (253>121).
- **Unrecorded approved growth (no tracked file/rationale/maxLines):** cli/src/index.tsx, cli/src/utils/theme-config.ts, common/src/types/session-state.ts, packages/agent-runtime/src/echo/enforcement.ts, packages/agent-runtime/src/echo/index.ts, packages/agent-runtime/src/run/execution/session-state.ts.

**Auditor note:** the overage deltas are small (1–69 lines) and land on exactly the files built during the v0.0.23 sprint (providers, pickers, stream-parser, native executor, session-state). These are *legitimate feature growth*, not defects. The correct remediation per FID-008 step 3 is **tracked approval entries with rationale + maxLines**, not decomposition or baseline lowering. The "unrecorded growth" subset requires adding the missing approval records to `dev/quality-baseline.json`. None of the 32 warrant blind baseline inflation.

---

## Historical / intentional references — DO NOT clean up

- All `dev/fids/archive/` records, dated session summaries, archived Nova exchanges — immutable per no-signature/immutable-history policy.
- `CHANGELOG.md` historical sections (v0.0.21/0.0.22) — preserved.
- FreeBuff / path terminology in *archived* records — not active defects.
- `ECHO.md` and single-agent protocol — out of FID-008 scope; not to be altered.
- Savant-Free (`savant-free/`) — separately scoped, non-public; excluded from this release.

---

## Files / artifact classes requiring operator disposition

1. **261 untracked paths** — must be manifest-classified (production / required docs+audit evidence / generated / scratchpad / remove-archive) before any release commit.
2. **root `nul`** — confirm non-intentional, then remove or gitignore.
3. **`cli/release-staging/`** — inspect `package.json` `files`/pack output + launcher flow; decide keep/retire.
4. **Two design docs** — either fix markdownlint (wrap long lines, fix MD001 heading at Terminal Row Diagnosis:233) or grant a narrowly-scoped lint exemption with recorded rationale. They are research/design outputs, not shipping code.
5. **Package publish scope** — operator must confirm whether v0.0.23 publishes `savant-code`, `@savant-code/sdk`, or both.

---

## Mutation confirmation

This review performed **no** source, documentation, FID, baseline, generated-artifact, credential, settings, Git-history, GitHub, npm, or deployment mutation. No commit, tag, push, publish, or deploy was executed. All findings are from read-only commands and file reads against the current working tree.

---

## Conditions before a later release-session request can be approved

1. `bun run validate:repository` → exit 0 (all 32 findings resolved via tracked approval or decomposition).
2. `bun run lint:md` → exit 0 (both design docs fixed or narrowly exempted with rationale).
3. All 261 untracked paths classified via manifest; `nul` + `cli/release-staging/` dispositioned.
4. FID-008 converged through RED→GREEN→AUDIT→ADVERSARIAL; cleanup implemented and re-verified.
5. `bun run release:public:diagnose` → exit 0 (currently fails at repository-validation).
6. Package dry-runs (`npm pack --dry-run` for sdk/ + cli/release/) captured; binary-asset verification for five CI targets recorded.
7. Operator-confirmed package publish scope.
8. Separate Nova implementation/release-readiness audit returns PASS on the remediated tree.

Until all eight conditions hold, the verdict remains **NO-GO**.

---

*Audit complete. Request archived to dev/nova/outbox/archive/.*
