<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Future Feature Seed — Harness-Steering Curriculum (NOT a FID yet)

**Logged:** 2026-08-15
**Status:** SHELVED — idea captured, no implementation planned until effort justifies it
**Owner:** Spencer (Savant-Code architect)

## The insight (why this is a new category, not a tutorial)

The original idea was to retrofit `leetcode-master` (translated to English, in `resources/leetcode-master-master`) into the Savant-Code Teacher module as a multi-module lesson sequence. On planning, this proved wrong:

- **leetcode-master / freeCodeCamp teach *how to write code*** (algorithms, syntax, patterns).
- **What Savant-Code needs is *how to steer the harness*** — write a FID, understand ECHO laws, spawn Detective vs Forge correctly, read a verification receipt, override an Adversary verdict, orchestrate the 10-agent roster.
- These are **entirely different surface layers**. Embedding regular coding content as a "tutorial" misses the actual need. No existing teaching platform does this, because no platform has a harness like Savant-Code.

## Why it must be built from scratch

1. **Content cannot be lifted.** Reference repos (leetcode-master, freeCodeCamp) are useful ONLY as *pedagogical-structure* inspiration — how Carl sequences difficulty, how freeCodeCamp scaffolds verifiable exercises. The subject matter (steering ECHO) has zero existing curriculum.
2. **Savant-Code itself may need changes** to host it: new commands, new state surfaces, lesson-progress tracking, steer-verification hooks (the harness confirms the learner steered correctly, not just that code compiles). This is a first-class capability, not a side module.
3. **Verification model differs.** freeCodeCamp verifies "you fixed the injected bug." The harness curriculum must verify "you steered the agents correctly" — e.g. a lesson where the learner writes a FID and the harness checks it converged through the Perfection Loop with the right agent roles.

## What the system would contain (rough shape, for later)

- Module sequence: ECHO basics → FID lifecycle → agent roster roles → verification/receipts → adversarial override → multi-agent orchestration.
- Each lesson = a real Savant-Code task the learner steers, with harness verification (not a passive read).
- Likely requires its own FID track for the Savant-Code modifications (surfaces, commands, lesson state).

## References to reuse when un-shelved

- `resources/leetcode-master-master/` — English translation (314 files, ~1,400 replacements). Use ONLY for sequencing/pedagogy structure.
  - Original GitHub: https://github.com/youngyangyang04/leetcode-master
- `dev/idea-farm/leetcode-master-deep-research-prompt.md` — the Deep Research prompt written for the *retrofit* angle. WILL NEED REWRITE to the build-from-scratch + Savant-Code-mod angle before use.
- freeCodeCamp repo (structure reference only) — how to scaffold verifiable real-world exercises.
  - GitHub: https://github.com/freeCodeCamp/freeCodeCamp

## Decision to shelf

Spencer: "Something like this will need to be done right and done right will take a lot more planning. Cool idea but not a pressing feature this early. Better to focus on real features than stop work for bells and whistles." Logged for pickup when time/effort justifies it.

## Re-activation trigger

When Spencer returns to this: rewrite the Deep Research prompt (nuke-and-rewrite per deep-research-prompts skill) to scope "design from-scratch harness-steering curriculum + identify Savant-Code changes," attach ECHO.md + ARCHITECTURE.md + the translated leetcode-master as structure reference, then run Gemini Deep Research and pick it up as a proper FID track.
