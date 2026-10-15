# Deep Research Request: Making Claims in Engineering Documents Mechanically Verifiable

**Sent:** 2026-10-01
**Channel:** Gemini Deep Research
**Origin:** `dev/nova/outbox/` — third-party research channel
**Related:** `FID-2026-1001-003` (active, converged), `dev/LEARNINGS.md` lessons
on archived-claims and external-citation failure

---

## 0. A warning about this prompt's own reliability

**A previous Gemini Deep Research report on our codebase fabricated three of
its four code citations** — citing a component that does not exist, and two
line numbers in files far shorter than the line cited. It was recorded as a
lesson and it is why section 5 exists.

**Therefore: do not report any code citation you cannot give a resolvable URL
for.** We cannot check a bare `path:line` claim; we can only check a URL. If
you cannot link a source, state the claim as an explicit **hypothesis** and
mark it `UNVERIFIED`. An honest gap is worth more to us than a confident
fabrication, because a confident fabrication is indistinguishable from
knowledge until someone spends an hour proving it wrong.

---

## 1. Context

We maintain a large AI-agent codebase (TypeScript monorepo, ~450 archived
engineering records). Its entire development process is documentation-driven:

- Every engineering claim lives in a markdown record ("FID") with a strict
  template, mandatory metadata, and a status lifecycle.
- Records cite the code they describe using `file:line` references as their
  primary evidence — e.g. "`pre-write-gates.ts:139` returns blocked",
  "`dirtyFiles` is populated only at `tool-pipeline.ts:182`".
- Multi-agent reviews cross-check each other's claims, and adversarial review
  is a designed phase in our process.

The codebase is roughly 100k+ lines. Records routinely live for weeks.

## 2. The problem

**Line-number citations in documents drift silently and cannot be falsified.**

Measured in a single working session, four `file:line` citations were
checked and **all four failed**:

| Citation | Claimed | Actual |
| --- | --- | --- |
| `enforcement.ts:58` | state init | line 56 |
| `write-bookkeeping.ts:29-34` | predicate body | lines 15-21 |
| `loop-iteration.ts:155` | a real call site | line never existed |
| `run-terminal-command.ts:12-17` | specific behaviour | grep failed to resolve |

Three were days-to-weeks old and accurate when written. The failure mode is
not "the docs are old" — it is that **a citation has no verification
mechanism**. It cannot fail loudly, cannot self-verify, and becomes false
silently while carrying a checked-off `[x]` box in a governance record.

The worst variant: an archived record contains
`- [x] Production caller grep — loop-iteration.ts:155 is the sole production
caller` — a *checked-box assertion that is now false*. It passes every
automated gate precisely because the box is checked.

We also observe the inverse failure in live code: enforcement logic was
selected by a hardcoded list of tool names, and one unlisted mutation path
silently defeated three separate controls simultaneously. The shared root
cause is identical in both cases: **the system trusted a hardcoded list or a
prose label instead of querying the world.**

## 3. What we have already established

Do not re-derive these; build past them.

1. **Prose is not enforcement.** When a claim and a runnable check express the
   same thing, the runnable check survives drift and the prose does not.
2. **We already solved this once, for verification gates.** Our record
   template has a gate concept: a check must be "independently runnable,
   exit 0 clean / 1 with issues", declared as `- gate: probe <path>`. That
   migration (prose assertion → command with an exit code) has held for weeks
   under conditions that killed every prose citation in the same period.
3. **Annotating evidence class is not enough.** An agent correctly labelled a
   claim "per archived docs" in its output, and the label did not prevent the
   claim from being absorbed into a later record as settled fact. The label
   existed; nothing enforced it.
4. **The system must fail CLOSED on drift**, not merely report it. A silent
   gap report recreates the original problem.

## 4. What we need researched

**Primary question.** What mechanisms exist — in any language or ecosystem —
for making claims in technical documents *machine-verifiable against a live
codebase*, such that when the code changes the claim fails loudly and
automatically?

**Secondary questions:**

1. What exists specifically for detecting **drift between documented claims
   and code**, as opposed to drift between docs and their own links? Most
   tooling targets the latter.
2. What exists for **bidirectional requirements traceability** with automated
   gap detection (requirement → implementation, and implementation →
   requirement), particularly in safety-critical engineering where this is a
   regulated discipline?
3. What exists for **architecture constraints as executable rules** rather
   than as documented convention?
4. What exists for **cryptographic provenance** — binding a claim to the
   artifact it describes, such that the binding breaks when the artifact
   changes?
5. What exists for **model-checking a specification against an
   implementation** (rather than against itself)?
6. Critically: **is there an existing tool we could adapt** rather than
   build? We would strongly prefer adopting or configuring something.

### Prior art to verify or refute

These are **our hypotheses, not answers.** Given the warning in section 0,
treat them as claims to check against primary sources, and report which are
real, which are misremembered, and which are prior-art-but-not-applicable:

- Tools expressing **architecture constraints as executable rules**
  (e.g. dependency-cruiser, deptrac, ArchUnit).
- **Documentation-as-test** systems where docs fail the build when they stop
  matching reality (e.g. language-level doc tests, compile-fail tests).
- Tools detecting **declared-but-nonexistent** and
  **existing-but-undeclared** entities (e.g. dead-export / unused-symbol
  detectors). This is the inverse of our problem but the same family.
- **In-toto / SLSA**-style attestations binding claims to artifacts.
- **Requirements traceability matrices** in DO-178C / ISO 26262 and whether
  the discipline has been mechanised in any tool.
- **Formal specification tools** (TLA+, Alloy) applied to checking a spec
  against a running implementation.
- **Doc-drift detection** tooling specifically, e.g. verifying that code
  samples embedded in prose still compile or run.
- Anything in **living documentation** or **executable specification**
  traditions that has solved the "documented claim silently becomes false"
  problem generally.

## 5. Source requirements

- **Every load-bearing claim needs a resolvable URL** — papers, official
  documentation, or source repositories.
- **Prefer primary sources.** A vendor's own docs or the tool's repository
  beats a blog post describing it; a blog post beats an unsourced assertion.
- **Distinguish clearly** between: (a) verified with a link, (b) believed but
  unlinked, (c) explicitly uncertain.
- **If you cannot find prior art for something, say so.** "No mechanism found
  for X" is a genuinely valuable result for us and costs you nothing.
- **Do not invent version numbers, line numbers, file paths, or issue
  numbers.** Write "cannot confirm the exact version" rather than guessing.

## 6. Deliverable

1. **A findings table**: mechanism → what it verifies → what it does *not*
   verify → language/ecosystem → maturity (production / research / abandoned)
   → link.
2. **A ranked recommendation**: what we should adopt, what we should build,
   and what we should explicitly not do — with reasoning about our specific
   constraints (documentation-driven process, ~100k LOC, multi-agent reviews,
   records outliving the changes they describe).
3. **The failure modes of the recommended approach**, stated plainly. We would
   rather adopt something with known sharp edges that we can see than something
   that sounds clean and fails at 3am.
4. **An explicit list of what you could not verify.**

## 7. Our fallback if this research proves insufficient

We are **not blocked on this research**, and we want that on record. Our
fallback, in order of preference:

1. **Build the probe ourselves**, using the pattern that already worked for
   our verification gates: each load-bearing claim becomes an independently
   runnable check with an exit code, and the claim's validity is *inferred
   from the check's result* rather than asserted in prose. This is the
   fallback we expect to use if the research finds nothing directly
   applicable.
2. **Require cross-source agreement** before acting on any recommendation —
   a mechanism asserted by only one source is treated as a hypothesis.
3. **Verify your claims against our repository before adopting anything**,
   using the same grep discipline we apply to our own records.

If the research surfaces a mechanism that makes option 1 unnecessary, we
want that above all — it is the outcome that scales best.