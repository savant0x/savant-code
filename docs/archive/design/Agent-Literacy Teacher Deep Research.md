<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# ARCHIVED / SUPERSEDED — Deep Research Prompt — AI-Native Agent-Steering Teacher (freeCodeCamp Curriculum Retrofit)

> **Superseded on 2026-08-13:** The homegrown curriculum decision discarded
> freeCodeCamp extraction as an implementation dependency. This prompt is
> retained as historical research input only. The authoritative plan is
> [`dev/build-orders/2026-08-13-agent-steering-teacher-build-order.md`](../../dev/build-orders/2026-08-13-agent-steering-teacher-build-order.md)
> and the homegrown architecture guide.

**Prepared:** 2026-08-13
**Target system:** Savant-Code (TypeScript/Bun multi-agent AI coding assistant, ECHO Protocol v0.2.0) — see attached files
**Purpose:** Gemini Deep Research pass to map the "learn-to-code" and "learn-to-prompt" landscape and surface a concrete, buildable architecture for an **AI-native, interactive terminal teacher** that teaches *agent-output literacy* (how to steer an agent to good output) — NOT syntax — by retrofitting the freeCodeCamp curriculum as a vetted "known-good" content corpus.
**How to use:** Attach the files listed in "Files To Attach" below, paste this entire prompt into Gemini Deep Research, set research depth to maximum, and request the structured output format at the end. This prompt is self-contained; the attached files provide authoritative governance text Gemini should honor. No additional context from the operator is required.

---

## The Core Idea (operator's working thesis — NOT a fixed spec)

The operator is exploring, in real time, a product that:

1. **Extracts** freeCodeCamp's curriculum (challenge definitions + embedded known-good solutions) as a **content corpus** — NOT a fork of freeCodeCamp's platform (React/Node/Mongo app, which is explicitly out of scope).
2. **Wraps** that corpus in a persistent **teacher agent** that runs in the terminal alongside Savant-Code.
3. **Teaches agent-output literacy**: the learner is NOT asked to write code. They are asked to **steer an agent** (write the prompt + constraints) to solve a real curriculum challenge. The agent produces output; the teacher compares it to freeCodeCamp's known-good solution and to planted "slop" variants.
4. **Grades with the Adversary agent** (ECHO's meta-verifier): the pass condition is the learner's ability to (a) steer an agent to output matching the known-good baseline, or (b) correctly identify slop the teacher injected — not merely nod at it.
5. **Is interactive**: run an exercise in-terminal, teacher evaluates, Adversary confirms, next challenge unlocks. Persistent progress.

The differentiator from every existing learn-to-code platform: they teach *writing*; this teaches *directing*. The moat is ECHO's Adversary grading real steered output against a vetted baseline — something a static lesson or a chat-with-ChatGPT cannot do.

**This is explicitly NOT a concrete spec.** The operator wants the research to stress-test the thesis, map the landscape, and propose the buildable architecture — the idea will crystallize after the research result and iterate from there.

---

## The Source Repository (verified)

- **Repo:** `github.com/freeCodeCamp/freeCodeCamp` — 453.9k stars, 46.0k forks, 9 branches, public.
- **What it is:** freeCodeCamp.org's open-source codebase AND curriculum. Learn math/programming/CS for free.
- **License:** **BSD-3-Clause** (NOT MIT). Permissive, commercial-OK, but requires the copyright notice + license text be retained in redistributed source; forbids using the "freeCodeCamp" name to endorse derivatives without permission. Operator's standing rule is "MIT = free reign" — **BSD-3-Clause is close but has the notice + non-endorsement requirement; the curriculum content must carry the BSD-3 notice when extracted/embedded.** Verify the exact LICENSE file before committing to a direction.
- **The asset (not the platform):** The curriculum is a large corpus of challenge definitions (markdown/JSON specs) each with an embedded **known-good solution** and test suite. That known-good solution is the "clean code" ground truth this teacher needs — for free. The platform (React/Node/Mongo learning-management app) is the throwaway part; do NOT rebuild it.
- **Research task re: the repo:** Determine the exact location and shape of the curriculum challenge files + known-good solutions (e.g. `curriculum/` directory structure, challenge markdown format, embedded solution/test blocks). Map how to extract them as a clean data corpus (challenge → known-good solution → tests) without pulling the platform. Confirm the BSD-3 obligations for redistributing extracted curriculum content.

---

## Files To Attach (read 0-EOF before research)

1. `ECHO.md` — the 15 ECHO Laws + Perfection Loop FSM + 10-agent roster + separation-of-duties. NON-NEGOTIABLE. The teacher must run under ECHO, not circumvent it.
2. `ARCHITECTURE.md` — agent roster, tool restrictions, runtime shape.
3. `protocol.config.yaml` — build commands, quality bar, paths.
4. `FID-TEMPLATE.md` — FID format (for when this becomes build orders).
5. `README.md` — product overview, repo map, CLI surface.
6. `CHANGELOG.md` — recent feature history (context on what shipped).
7. `docs/design/Savant-Code Feature Deep Research.md` — the ZTAP provenance research (companion concept; the teacher could eventually consume ZTAP receipts as proof-of-skill).

---

## Landscape To Map (verify URLs, do not assume)

Research and verify the following categories. Include real GitHub/repo URLs and what each does:

- **Learn-to-code platforms (teach syntax):** freeCodeCamp, Exercism (mentor model), The Odin Project, codecademy, Scrimba, boot.dev. Note: NONE teach agent-steering.
- **Learn-to-prompt / AI-skill platforms:** LearnPrompting, Prompt Engineering Guide (dair-ai), Anthropic/OpenAI prompt-cookbooks, nat.dev, Hex神仙 (if real). Note: these teach prompt *craft* in the abstract, not applied output-literacy against a code baseline.
- **AI-tutor / coding-mentor tools:** GitHub Copilot Chat, Cursor's AI, Zed's assistant, Mentat, Aider's "pair programming", SWE-bench-style evals, Terminal-Bench. Note: these ASSIST coding; none TEACH literacy as a curriculum.
- **Agent-verification / grading:** the ECHO Adversary concept, agenttrace, AgentDiff, HOL Guard, Codex-style verification. The grading moat.
- **Gamified/dev-learning:** roadmap.sh (graph-as-UX, 2.8M users, one builder), Duolingo-style progression mechanics, Super Mario 64 1x PNG compression (viral "learning by constraint" meme) — cultural signal that constraint-based learning resonates.
- **Curriculum-as-data precedents:** projects that extract fCC/other OSS curricula as data (e.g. fCC's own challenge-parser, FCC-to-JSON exporters). Confirm what exists.

---

## Questions To Answer (structured research output)

1. **Defining feature.** What is the single feature that makes this a category of its own (not "freeCodeCamp but with a chatbot")? Anchor on: teaches steering, not syntax; grades with an adversarial verifier; persistent terminal teacher.
2. **Extraction architecture.** Exact path to pull fCC curriculum as a clean challenge→known-good→tests corpus. What's the minimal parser? What breaks (challenges needing a browser/DOM, video lessons)? What's the BSD-3 compliance surface?
3. **Unit of "passing a lesson."** Two candidate models: (a) learner steers agent to output matching known-good (equivalence), or (b) learner correctly identifies planted slop (detection). Which is more defensible, more engaging, more gradable by the Adversary? Can both coexist (hybrid)?
4. **AI-native interaction model.** How does a terminal teacher present a challenge, accept steering input, dispatch the agent, show output vs known-good, and inject slop — without becoming a chat loop? Concrete UX (OpenTUI overlays? a `/learn` command? a side panel?).
5. **Grading with ECHO.** How does the Adversary grade steered output? What's the verifiable signal (output diff vs known-good, test pass, slop-identified-correctly)? How is "you actually learned" distinguished from "you got lucky"?
6. **Native governance.** Does the teacher need ECHO law changes? (Likely not — it's a consumer of the agent runtime, not a modifier.) Flag any tension.
7. **Retention / ethical loop.** Progression mechanics that build habit WITHOUT dark patterns or telemetry (Law 12). Score, streak, "ECHO-Verified skill %"? Reference roadmap.sh's 2.8M-user model.
8. **Moat vs everyone.** Why can't freeCodeCamp/Exercism/Cursor ship this? (They teach writing, or they assist, or they lack an adversarial grader.) State the unduplicateable part.
9. **Sequencing.** If built, what's the wedge feature (smallest, highest-leverage) vs the deep architecture (curriculum importer, slop-injector, Adversary grader, progress store)?
10. **One-sentence positioning.** The pitch an outsider understands in 10 seconds.

---

## Structured Output Format (per idea / per section)

For each architectural proposal return:
- **name**
- **category** (extraction | interaction | grading | retention | moat)
- **problem** it solves
- **mechanism** (concrete, file-level where possible)
- **ECHO integration** (which law/agent, any change needed)
- **novelty** (category-defining / high / derivative)
- **effort** (S / M / L)
- **leverage** (why it matters)
- **risk** (top 1)
- **rejected-alternatives** (what you considered and dropped, with reason)

Plus a final **Landscape Matrix** table (idea × compatible-with-ECHO × novelty × effort × leverage × risk) and a **Top 5 Recommended Explorations** ranked list with sequencing.

---

## What We Are NOT Asking

- Do NOT propose forking or rebuilding freeCodeCamp's platform. Extract the curriculum as data only.
- Do NOT propose 1:1 adoption of any learn-to-code platform's UX.
- Do NOT propose SaaS/cloud/telemetry. Local-first, offline, zero-cost (Savant discipline).
- Do NOT propose weakening ECHO to make the teacher "easier." The Adversary grade is the moat.
- Do NOT propose feature parity with anyone. We define the category.
- Do NOT bleed in external context beyond the attached files. This prompt is self-contained.
- Do NOT recommend a specific LLM vendor. Provider-agnostic (BYOK).

---

## Operator Note (honesty boundary)

The operator is building this idea in real time and expects the research to challenge the thesis, not endorse it. If the concept has a fatal flaw (e.g. freeCodeCamp's known-good solutions aren't actually extractable cleanly, or "steering literacy" isn't teachable as a curriculum, or the Adversary can't grade steered output meaningfully), SAY SO plainly with evidence. The value is a real architecture, not a validated hypothesis.

*Prepared by Nova for Spencer — Savant-Code agent-literacy teacher exploration. Self-contained; attach ECHO.md + ARCHITECTURE.md + protocol.config.yaml + FID-TEMPLATE.md + README.md + CHANGELOG.md + the ZTAP research doc. Run on Gemini Deep Research at max depth.*
