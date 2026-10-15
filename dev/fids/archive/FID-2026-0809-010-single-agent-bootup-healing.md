<!-- markdownlint-disable MD013 -->

# FID: Single-Agent Bootup Contract Healing

**Filename:** `FID-2026-0809-010-single-agent-bootup-healing.md`
**ID:** FID-2026-0809-010
**Severity:** critical
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Planning-only boundary:** This FID defines and converges the bootup-healing work. It does not
> authorize production implementation. No runtime code, generated prompt, enforcement test, protocol
> configuration, release script, or additional protocol document may be changed under this FID until
> final operator approval and independent Nova sign-off are both explicitly recorded. No Nova sign-off
> is present in this session and none is inferred.

---

## Summary

The single-agent bootup contract is split across a marker, a protocol document, machine-readable
configuration, runtime enforcement, generated agent prompts, and tests. The marker previously pointed
to the absent `dev/nova/specs/echo-v0.1.2-single-agent.md` and absent `FREEREADME.md`; it has now been
corrected as a documentation-only change to point to the available `dev/echo-v0.1.2-single-agent.md`
and to state the no-signature policy. The remaining runtime bootup defect is that enforcement defaults
to `ECHO.md`, while production construction does not pass the configured single-agent protocol path,
and the generated prompt still instructs agents to read `ECHO.md` at session initialization.

The healing objective is one deterministic boot contract: an explicit session variant resolves one
existing protocol marker/specification, reads it completely before non-read work, keeps harness and
single-agent sessions distinct, and proves the selection through runtime, CLI, generated-prompt, and
regression tests. The resolver must not rely on the current generic precedence that prefers
`savant.protocol` whenever both namespaces are present.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript/Bun; CLI; shared agent runtime; generated agent definitions
- **Tool Versions:** Bun project contract `1.3.14`; strict TypeScript
- **Commit/State:** `main`; FIDs 003–009 are active planning artifacts; marker correction and this FID are uncommitted
- **Protocol:** `dev/echo-v0.1.2-single-agent.md`; `single_agent.protocol` in `protocol.config.yaml`
- **Dependencies:** Orchestrated by FID-2026-0809-009; prerequisite for FIDs 003–008; implementation remains blocked
- **Approval state:** Operator implementation approval pending; Nova sign-off pending; implementation blocked

## Detailed Description

### Problem

Bootup currently has several sources of truth that disagree:

1. `ECHO-single-agent.md` referenced two paths that do not exist.
2. `dev/echo-v0.1.2-single-agent.md` is the available single-agent protocol, but the runtime does not
   resolve it automatically from `single_agent.protocol`.
3. `EchoEnforcement` defaults `protocolFile` to `ECHO.md`.
4. `executeToolCall` constructs `EchoEnforcement` without a `protocolFile` value.
5. The generated Savant prompt's session-init text instructs agents to read `ECHO.md`.
6. Enforcement tests contain the absent `dev/nova/specs/echo-v0.1.2-single-agent.md` path.
7. Historical documents contain older paths and signing language; those records must remain historical
   and must not be rewritten as part of runtime healing.

### Expected Behavior

At boot, an explicit session-variant selector must resolve a protocol contract with these properties:

- **Single-agent session:** marker `ECHO-single-agent.md` → existing `dev/echo-v0.1.2-single-agent.md`
  → `single_agent.protocol` with version `0.1.2-single-agent` and strict mode enabled. This selection
  must win over the generic `savant.protocol` compatibility precedence.
- **Harness session:** existing harness routing remains on `ECHO.md` and its top-level `protocol` contract.
- **Variant selection:** the entrypoint or boot-contract resolver supplies `single-agent` or `harness`
  explicitly; no resolver guesses from product branding or silently falls back between variants.
- **No dangling required paths:** every required boot document exists before it is referenced by runtime,
  generated prompts, or active tests.
- **Fail closed:** a missing or unreadable selected protocol file produces an actionable boot failure,
  not silent fallback to the wrong governance contract.
- **Read gate:** the selected protocol file is read 0-EOF before non-read tools in strict single-agent mode.
- **Subagents:** child agents inherit the parent's satisfied protocol-read state without changing the
  parent's selected protocol contract.
- **Documentation policy:** active authored artifacts carry no signatures, author names, or agent attribution.
  Historical references remain historical unless separately approved.

### Root Cause

The protocol filename migration moved the single-agent specification from `dev/nova/specs/` to `dev/`,
but marker text, enforcement tests, generated prompts, and runtime selection were not updated as one
atomic boot contract. Configuration parsing normalizes `single_agent.protocol` into the runtime's
`savant` property, but that parsed metadata currently contains version/strictness only and no canonical
protocol-file identity. It also prefers `savant.protocol` when both namespaces are present, so a
variant-blind caller can select the wrong contract. Enforcement therefore falls back to `ECHO.md`
unless a caller supplies an option.

### Evidence

- `ECHO-single-agent.md:5-22` previously referenced the absent `dev/nova/specs/echo-v0.1.2-single-agent.md`
  and absent `FREEREADME.md`; the marker is corrected in this session to reference
  `dev/echo-v0.1.2-single-agent.md` and the no-signature policy.
- `dev/echo-v0.1.2-single-agent.md:1-5` identifies the available active single-agent protocol and version.
- `dev/echo-v0.1.2-single-agent.md:14-24` requires no signatures, author attribution, or agent names.
- `protocol.config.yaml:92-99` declares `single_agent.protocol` version `0.1.2-single-agent` with
  `strict_mode: true`.
- `common/src/util/protocol-config.ts:176-207` parses `single_agent.protocol` but returns only the
  normalized version and strictness in `ProtocolConfig.savant`.
- `packages/agent-runtime/src/echo/enforcement.ts:20-31,59-62` defines `protocolFile` but defaults it
  to `ECHO.md`.
- `packages/agent-runtime/src/tools/tool-executor/native.ts:205-220` constructs enforcement without
  passing a protocol file; only `protocolPreSeeded` is supplied for children.
- `agents/savant/system-prompt.ts:136-138` instructs session init to read `ECHO.md`.
- `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts:162-167` still targets the absent
  `dev/nova/specs/echo-v0.1.2-single-agent.md` path.
- `cli/src/index.tsx:255` calls `initializeApp`, after which the runtime proceeds through provider,
  registry, and TUI/headless initialization; no single-agent protocol selection is visible in that boot path.

### Impact Assessment

- A single-agent session can be governed by the harness protocol by default.
- Boot can appear successful while enforcing the wrong protocol.
- Tests can pass against a path that users cannot read.
- Missing required protocol files may silently fall back instead of failing early.
- Generated prompts can contradict runtime enforcement and the user-facing marker.
- Future protocol migrations can repeat the same split-brain boot failure.

### Risk Level

- [x] Critical: governance selection and write/tool safety can be wrong at session start
- [ ] High
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Create one explicit boot-contract resolver for session variant, protocol metadata, and required protocol
file. Prefer the existing `single_agent.protocol` configuration and current protocol parser rather than
introducing a second configuration format. The resolver must validate the selected file exists and is
readable, expose the resolved path to enforcement and prompt generation, and never silently substitute
`ECHO.md` for a strict single-agent session.

Keep the harness contract unchanged. Preserve child pre-seeding, but make the parent's selected protocol
identity explicit and testable. Treat historical documents and archived records as immutable history.

### Steps

1. Define the boot-contract shape and explicit `harness | single-agent` session-variant selection rule.
2. Extend the existing protocol configuration boundary only as needed to expose the selected protocol
   file identity and variant-specific contract; do not change harness compatibility precedence globally.
3. Resolve and validate the existing single-agent marker/spec path before runtime enforcement starts.
4. Make the selected variant authoritative: single-agent explicitly reads `single_agent.protocol`,
   while harness explicitly reads the top-level `protocol` contract; neither silently falls back to the other.
5. Resolve and validate the selected protocol file before runtime enforcement starts.
6. Pass the resolved path into production `EchoEnforcement` construction.
7. Update the generated/system prompt session-init text from hardcoded `ECHO.md` to the selected contract.
8. Replace stale active test paths with the existing canonical file and add missing-file/fail-closed fixtures.
9. Prove harness sessions still select `ECHO.md` and single-agent sessions select the single-agent file.
10. Add CLI/headless startup coverage that reaches the boot contract without requiring a live provider where possible.
11. Add a drift scan that fails when active boot references point to absent files or when the marker and config disagree.
12. Keep the marker's no-signature policy as the active documentation rule; do not add signatures to this FID or other active artifacts.

### Verification

- Unit tests prove protocol config resolves the correct single-agent contract and harness contract.
- Enforcement tests prove the selected existing path clears the strict read gate.
- Tests prove a missing selected protocol file fails closed with an actionable message.
- Tests prove subagent pre-seeding preserves the parent's resolved protocol identity.
- Generated prompt tests prove the session-init instruction names the resolved protocol, not a stale hardcoded path.
- CLI startup/headless smoke tests prove initialization reaches the correct boot boundary.
- Active-reference scan returns no required references to absent `dev/nova/specs/echo-v0.1.2-single-agent.md` or `FREEREADME.md`.
- `bun run typecheck`, targeted runtime/common/CLI tests, root tests, ESLint, Markdownlint, Prettier, and
  `git diff --check` pass after implementation.
- Call-graph search proves the resolver is used by production enforcement and prompt construction.
- Implementation remains prohibited until operator final approval and independent Nova sign-off.

## Perfection Loop

### Loop 1 — RED

- **RED:** Boot references, parser metadata, enforcement defaults, generated prompt text, and tests are
  inconsistent. The marker had two absent paths; production enforcement defaulted to `ECHO.md`; and the
  available single-agent file was not selected by the production constructor.
- **GREEN:** Proposed a single boot-contract resolver using existing protocol configuration, explicit
  protocol-file identity, fail-closed validation, production enforcement wiring, generated-prompt parity,
  and regression/smoke coverage. Harness behavior remains unchanged.
- **AUDIT:** Evidence cites `protocol.config.yaml:92-99`, `common/src/util/protocol-config.ts:176-207`,
  `packages/agent-runtime/src/echo/enforcement.ts:20-31,59-62`,
  `packages/agent-runtime/src/tools/tool-executor/native.ts:205-220`,
  `agents/savant/system-prompt.ts:136-138`, and
  `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts:162-167`. The marker correction is
  documentation-only; runtime implementation evidence is intentionally pending.
- **AUDIT ADVERSARIAL CHECK:** The plan must not solve single-agent drift by hardcoding a new path in
  multiple consumers, silently fallback to `ECHO.md`, let generic `savant.protocol` precedence override
  an explicitly selected `single_agent.protocol`, rewrite history, or conflate harness and single-agent
  contracts. It must also avoid inventing `FREEREADME.md` merely to satisfy stale references.
- **CHANGE DELTA:** Marker documentation correction plus planning FID; no production runtime change.

### Loop 2 — Cross-Program Re-Audit

- **RED:** Re-audit confirmed that FID-010 is a program-wide prerequisite, not an optional documentation cleanup. The remaining implementation contract must explicitly select `single_agent.protocol` for single-agent sessions despite the parser's generic `savant.protocol` precedence.
- **GREEN:** Added explicit variant selection, variant-specific precedence, fail-closed missing-file behavior, and master-plan prerequisite wiring. Kept the marker-only correction separate from runtime implementation.
- **AUDIT:** Evidence remains `protocol.config.yaml:92-99`, `common/src/util/protocol-config.ts:176-207`, `packages/agent-runtime/src/echo/enforcement.ts:20-31,59-62`, `packages/agent-runtime/src/tools/tool-executor/native.ts:205-220`, `agents/savant/system-prompt.ts:136-138`, and `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts:162-167`. Master prerequisite wiring is `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md:68-75`. No runtime implementation was performed.
- **AUDIT ADVERSARIAL CHECK:** No active marker points to an absent required path, no fallback to `ECHO.md` is allowed for an explicitly selected single-agent session, and no Nova approval is claimed.
- **CHANGE DELTA:** Cross-program planning correction only.

### Missed Questions

1. **Should the missing old canonical file be recreated as a compatibility copy?** → No. The current
   canonical file is `dev/echo-v0.1.2-single-agent.md`; duplicating protocol documents creates drift.
2. **Should the runtime always use the single-agent protocol?** → No. Harness sessions must retain
   `ECHO.md`; session variant selection must be explicit.
3. **Should `ECHO.md` remain the enforcement default?** → Only for harness/default sessions. Strict
   single-agent construction must receive the resolved single-agent path.
4. **Should a missing protocol file silently fall back?** → No. Fail closed with the selected path and
   remediation guidance.
5. **Should archived documents be mass-rewritten?** → No. Historical records are evidence, not active boot inputs.
6. **Should the boot resolver parse YAML independently?** → No. Extend/reuse `readProtocolConfig` and
   its existing normalization boundary.
7. **Should the marker itself be signed as `Savant`?** → No. The active available protocol explicitly
   prohibits signatures and attribution.
8. **Can boot validation require provider credentials?** → No. Protocol selection must be testable and
   deterministic before provider/network initialization; provider readiness is a separate gate.

### Code Verification Evidence

- [x] Available protocol marker and actual single-agent protocol were read 0-EOF.
- [x] `protocol.config.yaml`, parser, enforcement, native executor, system prompt, and relevant tests were inspected.
- [x] Marker documentation was corrected to remove absent required references and align with no-signature policy.
- [x] The single-agent no-attribution rule is honored; no Author, Fixed By, Verified By, or signature field is present.
- [ ] Runtime boot-contract implementation — prohibited pending approval and Nova sign-off.
- [ ] Runtime and CLI verification — intentionally pending implementation.

## Resolution

- **Status:** Closed and archived on 2026-08-09.
- **Implementation result:** Single-agent boot contract resolves explicitly and fails closed without falling back to the harness protocol.
- **Operator approval:** Build approval supplied in-session.
- **Independent audit:** PASS recorded in `dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`.
- **Release state:** Included in pending unreleased `0.0.23`; no tag, push, publication, or deployment was performed.
- **Historical scope:** Prior planning and convergence evidence is retained; no historical FID archives were rewritten.

## Lessons Learned

A protocol version is not enough to identify a boot contract. The selected protocol file, configuration
namespace, generated instructions, enforcement instance, and tests must resolve from one explicit source.

## Closure Evidence

- **FID:** FID-2026-0809-010
- **Implementation audit:** PASS; independent response cited above.
- **Cross-cutting checks:** no credentials used; no provider routing changes; RunState backward compatibility preserved; bounded propagation verified; no-signature policy followed.
- **Environment note:** release validation still requires pinned Bun `1.3.14`; the prior host ran Bun `1.3.11`, an environment-only publication blocker.
