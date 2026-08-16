# Token Harbor Partnership — Reply Draft (plain text, paste-ready)

**Date:** 2026-08-14
**Status:** DRAFT — awaiting operator send. Not an FID, not audit material.

---

Hey — circling back with the structure I mentioned. Here's the shape of it:

Two tiers:

1. Main Savant (https://github.com/savant0x/savant-code) — leans on partnerships. Fireworks is bootstrapping us now; we'd position Token Harbor as a sponsor-partner alongside them. BYOK + partner-sponsored inference.

2. Free ad-supported version — Mimo 2.5/pro, Deepseek flash/pro 0813, GLM  5.2 and a few others (Kimi K2.7 code, MiniMax M3, Qwen 3.7 Max), inference covered by an AI-friendly ad network. Launches after the main harness.

Logical scale (pre-launch projections — assumptions stated, not promises):

- Free-tier MAU: ~1,000 within ~12 months (gradual ramp), scaling beyond from there.
- Per-user profile (assumed, agentic coding-agent usage — a "request" is a tool-augmented turn, not a chat message):
  - Light: 75 requests/day → ~34M tokens/user/month
  - Active developer: 150 requests/day → ~68M tokens/user/month
  - Power user: 300 requests/day → ~135M tokens/user/month
- Blended, that's ~45B tokens/month at 1K MAU, scaling toward ~1T/month at 20K MAU.
- Multi-provider by design: our Fireworks partnership already distributes load, so no single provider carries the full volume.

Integration: Savant Gateway plugs Token Harbor in as a first-class provider — a utility-function plug-in on the OpenAI-compatible endpoint TH exposes. The only transitional piece is a proxy until the gateway ships; after that, TH is surfaced in the model selector and as a free-tier default.

What I'd ask on your side: does a sponsorship model (you cover inference volume for the free tier, featured as a partner) or a revenue-share on the ad-supported model fit how you're thinking about it? Either works from where we sit — just want to align the structure before I draft anything formal.

---

ASSUMPTIONS (operator reference — do NOT paste to TH):

- Request = tool-augmented turn (read file, run command, write, verify), not a chat message. 20/day as any floor was rejected as absurd.
- Tiers: 75 / 150 / 300 requests/day at 15k tokens/request.
- MAU timeline: 1K within ~12 months (operator's conservative external number).
- Aggregates: Light 33.75M / Active 67.5M / Power 135M tokens/user/month. Blended ~45B at 1K MAU, ~1T at 20K MAU.
- Fireworks load-share stated so TH not on hook for 100% of volume.

NOTES:

- TH is the owner (operator confirmed). Engaged. Asked for structure, said no exact numbers needed.
- Close puts model decision (sponsorship vs revenue-share) on TH.
- Not a FID sign-off request — business correspondence parked in outbox per operator instruction.
- Credentials/shared in TH channels are ephemeral — purge after deal closes.
