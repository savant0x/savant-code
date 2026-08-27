# Idea-Farm — Orchestrator Tree: Governed Fan-Out/Fan-In

**Logged:** 2026-08-25
**Status:** SHELVED — post-foundation; deep research queued (Gemini DR prompt to be authored when picked up)
**Source:** Spencer, sparked by an Apodex 1.1 video (async agent teams) — the app itself dismissed, the architectural thought kept
**Related:** Auto Drive (manual precursor), 08-22 five-concurrent-sessions night (manual proof), Cross-Agent Claim Rule, ZTAP, holographic command deck

---

## The Spark

Spencer's framing, evolved across three refinements:

1. Savant has parallel *capability* (concurrent sessions) but not parallel-as-CORE.
   Today it's "a single face doing a single job" — the operator manually partitions
   areas across sessions and coordinates by hand.
2. The deeper version: **multiple Savant Orchestrator agents working top-down as a
   team toward one goal** — a hierarchy, not just siblings.
3. That makes true **fan-out** possible, with speed boosting per branch.

> "savant is amazing currently, but what happens if it can run multiple 'savant'
> orchestrator agents and work as a top down team all at the same time towards a goal"

## The Idea, Expanded

### Current architecture (the constraint)

The Perfection Loop FSM is a **pipeline**: `idle → red → green → audit → adversarial →
complete`, strictly sequential per FID, coordinated through ONE Orchestrator face.
Concurrency today = separate sessions partitioned by area, coordinated manually by the
operator (proven workable — see manual precursors below — but not a product capability).

### Proposed architecture (the evolution)

An **Orchestrator tree**:

```
                    Goal
                      │
              [Top Orchestrator]          ← decomposes goal, owns integration authority
             /       |        \
   [Sub-Orch A]  [Sub-Orch B]  [Sub-Orch C]   ← each runs its OWN Perfection Loop FSM
    /     \         |              |
 [workers] [workers] [workers]  [workers]      ← full roster under each branch
```

- Top-level orchestrator decomposes the goal into branch-scoped sub-goals
- Each sub-orchestrator runs a complete governed loop on its subtree (laws hold at any
  depth — EHEL is per-agent regardless of tree position)
- Branch-to-branch handoffs happen through **ZTAP-signed artifact claims** (Cross-Agent
  Claim Rule extended to live inter-branch surfaces)
- Fan-in at the top: the root orchestrator verifies branch convergence before declaring
  the goal met
- Speed scales per branch, capped by Amdahl at the serial share (integration/stitching)

### Why Savant-native (not an Apodex clone)

Apodex's shared whiteboard is naive shared mutable state — drift vector wearing a
productivity costume. Savant's version inherits governance for free:

| Concern | Apodex-style answer | Savant answer |
|---|---|---|
| Agents drift apart | shared whiteboard (mutable, unverified) | ZTAP-signed claims between branches |
| Bad handoffs | staple outputs at the end | artifact-mediated, receipt-verified handoffs |
| Verification burden | "still on you" (human vigilance forever) | Verifier + Adversary per subtree |
| Silent violations | possible anywhere | EHEL gates at every depth |
| Operator role | babysitter | integration authority at fan-in only |

**Key insight: no new infrastructure required.** Separation of duties already prevents
collisions between concurrent agents; the claim rule already governs inter-agent claims;
receipts already make handoffs verifiable. This idea *repurposes existing governance as
a scheduler* — the laws don't change, the clock changes.

### Manual precursors (proof it works at small scale)

- Overnight queue-to-zero Auto Drive runs (sequential, but unattended multi-FID)
- Aug-22 five-concurrent-sessions night: Spencer manually acted as top-level
  orchestrator — decomposed, area-partitioned, coordinated handoffs himself
- The idea productizes what the operator already does by hand

### Deck synergy

The command deck visualizes this shape naturally: an orchestrator TREE on the floor,
branch subtrees lighting up as they progress, handoff sparks traveling between branches,
fan-in convergence as the finale. "One mind, a thousand faces" becomes literal org-chart
choreography.

## Honest cautions (for the eventual design)

1. **Context isolation** between branches — agents can't see each other's state; that's
   both the safety property and the coordination limitation
2. **Merge conflicts** on shared files across branches (area-partition discipline needed)
3. **Token cost × branch count** — budget scaling must be explicit
4. **Drift risk scales up** — claim verification matters MORE, not less
5. **Root bottleneck** — top orchestrator stays serial at fan-in; bad decomposition
   upstream wastes every branch (Amdahl)
6. **FSM ownership** — does each sub-orchestrator own a full FSM instance? How do
   sub-loop states roll up to the parent's phase?

## Open Questions (for the deep research pass)

1. Optimal tree topology/depth for coding workloads — wide-and-shallow vs narrow-and-deep?
2. Decomposition quality: who validates the top-level split BEFORE branches burn tokens?
   (Bad split = wasted everything — Apodex's own admission.)
3. Shared-file conflict protocol between branches (worktree-per-branch? G9 escape hatch?)
4. Rollup semantics: how do child FSM states compose into parent progress?
5. Failure isolation: what happens when one branch fails mid-run — pause siblings?
   Re-decompose? Continue and quarantine the branch output?
6. Budget governor: per-branch token ceilings + global cap enforcement point.

## Trigger

Post-foundation. Do not start until: deck closes, contacts suite lands, eval rebuild
lands. When picked up → author Gemini DR prompt from Open Questions above, then master
FID + Perfection Loop per standard pipeline.
