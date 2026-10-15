# VoxelBench — live human-preference arena for voxel/creative-build generation

**Source:** https://voxelbench.ai/leaderboard (saved 2026-10-10)
**Status:** REFERENCE SOURCE (live, tracked)

## What it is
A **live, human-voted Elo arena** for voxel/creative-build generation — the
LMArena/Chatbot-Arena equivalent, but for the demanding-self-contained-build eval
lane. Modes: Vote / Explore / Leaderboard / Achievements / Gallery / Classic, with
Text and Image tabs. Explicitly blocks AI voters ("If you are an AI visitor, you are
unauthorized to vote as your judgement may be unreliable") — **pure human preference,
no model self-judging.**

## Why it's worth keeping
It measures the one axis the standardized benchmarks don't: **human aesthetic
preference on generated output.** AA Intelligence, Vals, and Terminal-Bench measure
reasoning and agentic correctness. VoxelBench measures "does a human think this looks
good" — which is otherwise only Spencer's design eye, applied manually, one build at a
time. This is a scalable proxy for that judgment. Directly relevant to Spencer's eval
method (one demanding self-contained build — "cyberpunk 3D earth, go ALL out") and to
the Vibe Code lane where Step 5 scored 70.4% on the standardized analog (Vals Vibe
Code Bench v1.1).

## Methodology (honest, worth noting)
Columns: RANK / MODEL / RATING (Elo) / 95% CI / VOTES / WIN RATE / W-L-T / COSTS
(In+Out per 1M) / CONFIDENCE. Reports confidence intervals and vote counts per model,
and flags thin-data entries "Low Confidence" — methodologically transparent. **It is
LIVE**: rankings shift as votes arrive (GPT-6.1 Sol was #1 on a read minutes after
GPT-6 Astra held the top cached slot). Treat any single pull as a snapshot, not a
fixed ranking. Prefer models with high vote counts + tight CI over a high rating on
thin data.

## Snapshot (2026-10-10, LIVE — will drift)
Top of board at pull: GPT-6.1 Sol (Max) ~2638 / Claude Opus 5.5 (Max) ~2586 (94.7%
win rate, 2406 votes, tight ±48) / GPT-6 Astra (Max) ~2569 (5039 votes, tightest
high-volume CI) / GPT-6-Sol ~2406 / Claude Opus 5 ~2186 / GPT-5.6 Sol ~2169. Mid-pack
where the free/cheap lane lives: Kimi K3 ~1899, DeepSeek-v4.1-flash ~1831,
Qwen3.8-Max ~1812, GLM-5.3 ~1762, stealth/ox-alpha (GLM-5.3-Flash) ~1719. Stealth
entries appear under aliases (e.g. space-bunny-alpha, stealth/ox-alpha) — cross-ref
the stealth shelf for identity. Step 5 is NOT on the board at pull.

## Relationship to the benchmark stack
- **Standardized (AA / Vals / Terminal-Bench):** correctness, reasoning, agentic.
- **VoxelBench:** human preference on creative/visual output — the "does it look
  good" axis. Complementary, not redundant.
- Cross-ref: `ai-frontier-snapshot-2026-10-08.md` (statement-day baseline, revisit
  ~2026-11-06/07) — VoxelBench adds the preference dimension the snapshot's
  intelligence-index numbers lack.

## Re-activation trigger
Revisit when (a) a new frontier or free-lane model drops and Spencer wants the
human-preference read, (b) cross-checking a model Spencer just hand-evaluated against
the arena consensus, or (c) the ~Nov statement-day revisit — pull the live board and
diff against this snapshot. Watch for: new models appearing, stealth aliases resolving,
and the Image-tab rankings diverging from Text (multimodal creative quality is a
separate signal).
