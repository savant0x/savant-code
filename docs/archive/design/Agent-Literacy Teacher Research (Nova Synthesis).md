<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Agent-Literacy Teacher — In-House Research Synthesis (Nova)

**Date:** 2026-08-13
**Method:** Web landscape (fCC curriculum structure verified; "learn-to-prompt" category scanned) + synthesis. Companion to the self-contained Gemini prompt at `docs/design/Agent-Literacy Teacher Deep Research.md`. This is the "curious now" output — not a build order.

---

## What's Real (verified)

- **fCC curriculum is extractable as data.** Structure confirmed: `curriculum/challenges/english/blocks/<block>/<challenge>.md` (one markdown per challenge), `structure/curriculum.json` + `superblocks/<superblock>.json` + `blocks/<block>.json` for ordering. Each challenge markdown embeds a known-good solution block + a test suite. The platform (React/Node/Mongo) is separate and irrelevant. **The corpus is cleanly separable from the app** — the extraction thesis holds.
- **License is BSD-3-Clause** (confirmed from repo). Extracted curriculum must retain the copyright + license notice; cannot use "freeCodeCamp" to endorse the derivative. Workable, just not MIT-free-reign.
- **"Teach steering" is unowned.** The learn-to-prompt search returned SEO spam (IBM/Andrew Ng "learn to code not fear AI" thinkpieces), not a product. freeCodeCamp/Exercism/Odin teach *writing*. LearnPrompting/dair-ai teach prompt *craft* abstractly. Cursor/Copilot *assist*. **Nobody teaches applied output-literacy against a code baseline with an adversarial grader.** Category is open.

---

## Landscape Matrix (idea × ECHO-fit × novelty × effort × leverage × risk)

| Idea | ECHO-fit | Novelty | Effort | Leverage | Risk |
|---|---|---|---|---|---|
| Curriculum extractor (fCC → challenge/known-good/tests JSON) | Neutral (consumer) | Derivative | M | High | fCC challenge format drift breaks parser |
| Terminal teacher agent (`/learn` command, OpenTUI) | Native (runs under ECHO) | High | M | High | UX sprawl if not bounded |
| Slop-injector (teacher plants defects in agent output) | Native | Category-defining | M | High | Injected slop must be detectable + gradable |
| Adversary grader (grades steered output vs known-good) | Native (reuses Adversary) | Category-defining | L→M | Highest | "Learned vs lucky" attribution gap |
| Progress store (local SQLite, ECHO-Verified %) | Neutral | High | S | Medium | Habit inflation / gamification fatigue |
| Hybrid pass-model (steer-to-equivalence OR detect-slop) | Native | Category-defining | M | High | Two grading paths = 2x surface |

---

## Top 5 Recommended Explorations (ranked)

1. **Curriculum extractor (wedge).** Smallest real artifact: a parser turning `curriculum/challenges/**/*.md` + `structure/*.json` into `{challengeId, prompt, knownGood, tests[]}`. Proves the corpus is usable. No ECHO change. *This is the thing to build first if you ever reopen.*
2. **Adversary grader.** The moat. Reuse the existing Adversary agent: given a learner's steered agent output + fCC known-good + tests, produce a CONFIRMED/REFUTED/ADJUSTED verdict on whether the output matches. The grading signal is *test pass + diff-vs-known-good + slop-identified-correctly*.
3. **Slop-injector.** Teacher takes known-good, introduces 1–3 realistic defects (missing edge case, over-engineering, silent failure), presents the steered output, asks the learner to spot them. Detection accuracy = the score. This is the *literacy* half; the extractor is the *clean* half.
4. **Terminal teacher UX.** A `/learn` command: pick challenge → show prompt → accept steering text → dispatch agent (Savant-Code runtime) → render output vs known-good side-by-side in OpenTUI → Adversary verdict. Read-only display; zero control authority (same rule as the ZTAP Trust Matrix).
5. **Progress store.** Local SQLite: per-challenge status, streak, "ECHO-Verified skill %". No telemetry, no cloud (Law 12). roadmap.sh proved graph/progression retention at 2.8M users — but that's a contribution graph, not a gated curriculum. Your version gates on *verified literacy*, not commits.

---

## Unit of "Passing a Lesson" — the open decision

Two models, both defensible:

- **A. Steer-to-equivalence:** learner writes steering; agent output must pass fCC tests + match known-good within tolerance. Pass = "you directed an agent to a correct solution."
- **B. Detect-slop:** teacher shows agent output with planted defects; learner identifies them correctly. Pass = "you can tell good from slop."

**Recommendation (Nova's read, not enforced):** Hybrid, but B is the *moat* and A is the *onboarding*. B is unduplicateable (needs a verifier that knows the right answer and can grade your judgment, not your code). A is what freeCodeCamp already does, just agent-assisted. Start with B as the graded core; A as the warm-up. The fatal risk in A alone: it's "freeCodeCamp with a chatbot," which the prompt explicitly rejects.

---

## Honest Challenge to the Thesis (per the prompt's honesty boundary)

- **Extraction fragility:** fCC challenge markdown format has drifted across v5/v6/v7. A parser pinned to today's format will break on the next curriculum rev. Mitigation: pin to a tagged fCC release; re-extract per version. Acceptable.
- **"Steering literacy" teachability:** This is the real unknown. Can you teach *judgment* as a curriculum, or only *recognition*? My read: recognition (B) is teachable — you can show slop and confirm detection. Judgment (writing good steering from scratch) is harder to grade objectively. The Adversary can grade *output*, not *the quality of the steering prompt itself* without running it. So the loop is: steer → run → Adversary grades output → learner infers steering quality. Indirect but workable.
- **Adversary can't grade "you got lucky":** If a learner steers poorly but the agent happens to produce good output (model is smart), the Adversary passes it — falsely crediting the learner. Mitigation: require the learner to *also* explain why the output is correct (short justification), which the Adversary can refute. Adds a judgment signal beyond output equivalence.

**Verdict on the concept:** Not fatal. The corpus is real, the category is open, the moat (Adversary grading) is unique to ECHO. The executable wedge is the extractor + slop-injector + Adversary grader. UX and progress are secondary.

---

## One-Sentence Positioning

*"A terminal teacher that doesn't teach you to code — it teaches you to direct the thing that codes, and proves you can tell its good output from its slop."*

---

*Nova synthesis, 2026-08-13. In-house execution of the companion Gemini prompt (which remains the max-depth pass for when you reopen build headspace). Not a build order; ZTAP is the active autonomous build.*
