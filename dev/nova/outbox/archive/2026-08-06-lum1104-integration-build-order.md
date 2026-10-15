# Build Order: Lum1104 Ecosystem Integration into ECHO Protocol

**Date:** 2026-08-06
**Source:** ECHO Agent Skills Integration Plan
**Status:** Ready for implementation

---

## Phase 1: Sensory & State Upgrade (Foundation)

**Goal:** Give agents structural awareness and session continuity

### 1.1 code-review-graph Integration
- **Agent:** Detective, Scout
- **Enhancement:** Replace naive grep with AST structural mapping
- **Source:** `resources/lum1104/code-review-graph/`
- **Implementation:**
  - Port Tree-sitter + SQLite indexing to Savant Code's code-map package
  - Expose blast_radius and call_graph queries via native tools
  - Replace Scout's read_files with graph queries
  - Replace Detective's grep with AST-aware search
- **Success Criteria:**
  - Graph indexes codebase in < 2.5s
  - Agents fetch context via graph queries instead of raw reads
  - Token consumption reduced by 8x

### 1.2 Session Continuity
- **Agent:** Orchestrator
- **Enhancement:** Context survival across agent handoffs
- **Source:** `resources/lum1104/uni-code/`
- **Implementation:**
  - Persist FID state, prompt history, and FSM state in SQLite
  - Hydrate context window on agent spawn
  - Prevent context collapse between Orchestrator → Detective → Thinker → Forge
- **Success Criteria:**
  - Spawned agents resume at correct FSM node
  - Zero fidelity loss in agent handoffs

---

## Phase 2: Epistemic Enforcement (Verification)

**Goal:** Replace heuristic self-reporting with formal proofs

### 2.1 no-vibes Integration
- **Agent:** Verifier, Recorder
- **Enhancement:** Terminal output required for completion claims
- **Source:** `resources/lum1104/no-vibes/`
- **Implementation:**
  - Intercept phase transition calls
  - Assert tool_output_present() == True
  - Reject completion claims without stdout evidence
  - Penalize agent credibility for vibes-based reporting
- **Success Criteria:**
  - Agents cannot transition phases without cited tool output
  - Hallucinated verification drops to 0%

### 2.2 bet-on-it Integration
- **Agent:** Verifier, Thinker
- **Enhancement:** Prediction before action
- **Source:** `resources/lum1104/bet-on-it/`
- **Implementation:**
  - Force Verifier to log explicit prediction before executing tests
  - Compare actual outcome against prediction
  - Reject hypothesis modification after observation
  - Serialize prediction → execution → comparison flow
- **Success Criteria:**
  - Verifier predicts before every test execution
  - Post-hoc rationalization eliminated
  - Token burn reduced (fewer blind debugging loops)

---

## Phase 3: Execution Safety (Risk Management)

**Goal:** Prevent risky changes without rollback plans

### 3.1 red-button Integration
- **Agent:** Orchestrator
- **Enhancement:** Blast radius gating
- **Source:** `resources/lum1104/red-button/`
- **Implementation:**
  - Trigger before Forge writes to >3 files or sensitive paths
  - Require Rollback_Patch and Metric_Observable
  - Halt execution if blast_radius > max_allowed
  - Require manual human override for high-risk changes
- **Success Criteria:**
  - High-risk changes automatically halted
  - Rollback patches generated before execution
  - Observable success metrics defined in FID

### 3.2 auto-debug Integration
- **Agent:** Forge
- **Enhancement:** Runtime telemetry injection
- **Source:** `resources/lum1104/auto-debug/`
- **Implementation:**
  - Wrap new module entry points in execution wrappers
  - Emit file:line:args on DEBUG_TRACE
  - Allow Verifier to parse trace logs instead of static files
  - Ensure Law 14 compliance (all error paths handled)
- **Success Criteria:**
  - New functions emit namespaced telemetry
  - Verifier parses runtime traces
  - Error diagnosis speed improved

---

## Phase 4: Meta-Analysis (Adversarial)

**Goal:** Turn adversarial nature into a feature

### 4.1 prove-me-wrong Integration
- **Agent:** Adversary
- **Enhancement:** Mutation testing + falsification
- **Source:** `resources/lum1104/prove-me-wrong/`
- **Implementation:**
  - Generate adversarial inputs (Unicode boundary, null pointers, race conditions)
  - Execute against isolated codebase
  - Trigger runtime panics if vulnerabilities found
  - Override Verifier if failures found
- **Success Criteria:**
  - Adversary generates mutation tests
  - False positives broken by adversarial inputs
  - Mutation kill rate > 90%

### 4.2 archaeologist Integration
- **Agent:** Detective
- **Enhancement:** Historical intent preservation
- **Source:** `resources/lum1104/archaeologist/`
- **Implementation:**
  - Traverse Tree-sitter nodes to Git blame records
  - Map specific nodes to originating commits
  - Analyze PR descriptions and commit messages
  - Append historical context to RED phase FID
- **Success Criteria:**
  - Legacy code analyzed with Git intent
  - Chesterton's Fence preserved
  - FIDs include historical context

---

## Phase 5: Ingestion & Automation (Knowledge Capture)

**Goal:** Automate skill generation from content

### 5.1 video-to-skill Integration
- **Agent:** Researcher
- **Enhancement:** Multimodal content ingestion
- **Source:** `resources/lum1104/video-to-skill/`
- **Implementation:**
  - Isolate Python runtime for transcription
  - Ingest video/audio via FFmpeg
  - Extract executable logic gates and code patterns
  - Generate coding-standards/{language}.md
- **Success Criteria:**
  - External video documentation converted to skills
  - Generated skills pass validation tests
  - Knowledge capture scaled across organization

### 5.2 ambitious-ai-startup-playbook
- **Agent:** Scribe, Thinker
- **Enhancement:** Evidence-grounded strategic reasoning
- **Source:** `resources/lum1104/ambitious-ai-startup-playbook/`
- **Implementation:**
  - Already created as startup-playbook skill
  - Wire to Thinker for FID strategic reasoning
  - Wire to Scribe for knowledge capture
- **Success Criteria:**
  - Thinker uses playbook for architectural decisions
  - Scribe captures evidence-grounded documentation

---

## Dependency Graph

```
Phase 1 (Sensory)
    ↓
Phase 2 (Epistemic)
    ↓
Phase 3 (Safety)
    ↓
Phase 4 (Meta-Analysis)
    ↓
Phase 5 (Ingestion)
```

**Critical Path:** Phase 1 must complete before Phase 2. Phase 2 must complete before Phase 3. Phases 4 and 5 are independent.

---

## Implementation Order (Within Each Phase)

### Phase 1
1. code-review-graph (highest impact — replaces naive file reading)
2. Session continuity (prevents context collapse)

### Phase 2
1. no-vibes (blocks vibes-based completion)
2. bet-on-it (prevents post-hoc rationalization)

### Phase 3
1. red-button (prevents risky changes)
2. auto-debug (enables runtime inspection)

### Phase 4
1. prove-me-wrong (enhances Adversary)
2. archaeologist (enhances Detective)

### Phase 5
1. video-to-skill (automates skill generation)
2. startup-playbook (already created)

---

## Files to Create

- `dev/fids/FID-YYYY-MMDD-NNN-code-review-graph-integration.md`
- `dev/fids/FID-YYYY-MMDD-NNN-session-continuity.md`
- `dev/fids/FID-YYYY-MMDD-NNN-no-vibes-integration.md`
- `dev/fids/FID-YYYY-MMDD-NNN-bet-on-it-integration.md`
- `dev/fids/FID-YYYY-MMDD-NNN-red-button-integration.md`
- `dev/fids/FID-YYYY-MMDD-NNN-auto-debug-integration.md`
- `dev/fids/FID-YYYY-MMDD-NNN-prove-me-wrong-integration.md`
- `dev/fids/FID-YYYY-MMDD-NNN-archaeologist-integration.md`
- `dev/fids/FID-YYYY-MMDD-NNN-video-to-skill-integration.md`

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Token consumption per task | Baseline | -80% |
| Hallucinated verification | Some | 0% |
| Context collapse incidents | Occasional | 0% |
| High-risk changes without rollback | Possible | 0% |
| Mutation kill rate | Unknown | >90% |
| Error diagnosis speed | Baseline | -50% |
| Skill generation time | Manual | Automated |

---

*Build order written 2026-08-06 by Nova.*
