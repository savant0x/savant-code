# "Replace 10 Subscriptions" Video — Verified Repo Directory (2026-10-07)

Source: YouTube transcript "Replace: Suno AI, ChatGPT, Perplexity, Lovable, Manus, Opus Clip & more"
(doc_696e31edc5e2). Spencer: "grab these links — we might be able to do some wild shit w/ these repos."
All 10 repos identified and verified via web search 2026-10-07. Corrections to the video's
claims noted inline (the video is directionally right; several numbers are off).

## The 10 repos

| # | Video name | REAL repo | Replaces | Licence | Verified note |
|---|---|---|---|---|---|
| 1 | "Voice Studio" | **debpalash/VoiceStudio** — https://github.com/debpalash/VoiceStudio | ElevenLabs | AGPL-3.0 (commercial licence separate) | 50.2k stars (video said 54k, close). Built on k2-fsa/OmniVoice engine. 646 languages, 3s zero-shot cloning, dubbing, dictation, audiobooks, local API + **MCP for agents**. Creator = Indian CTO, started April 2026. CAUTION: default OmniVoice model = non-commercial; commercial use needs the $99/mo pro licence or a different engine. There is also a MantisWare/omnivoice-studio fork (0 stars) — use the original. |
| 2 | Odysseus | **pewdiepie-archdaemon/odysseus** — https://github.com/pewdiepie-archdaemon/odysseus | ChatGPT | MIT | 44k stars as of June 2026 (video's 91k unverified). Self-hosted AI workspace: chat, agents, deep research, email, notes/tasks/calendar, memory, local models via cookbook, BYO API keys. Site: odysseusai.dev. |
| 3 | "free LLM API" | **tashfeenahmed/freellmapi** — https://github.com/tashfeenahmed/freellmapi | Claude Code / paid APIs | MIT core | **This is the freellmapi already on our radar** (meta-directory verified 10-07). 29 providers, 358 free model endpoints, ~4B tokens/mo aggregated, one OpenAI-compatible /v1, auto-failover on 429, per-key quota tracking, encrypted keys. Premium = live signed catalog feed $19/yr or $49 lifetime (free installs trail 30 days / ~303 models behind). Creator Tashfeen Ahmed = ex-Microsoft product designer, Ireland (matches video). NOTE: the ToS clause nobody quotes — stacking provider free tiers may violate individual provider ToS; we already treat these lanes as expendable. |
| 4 | Vain | **ItzCrazyKns/Vane** — https://github.com/ItzCrazyKns/Vane | Perplexity | MIT-ish (repo says open source) | ~36k stars (video said 37k, close). Formerly **Perplexica** — renamed ~months ago (discussion #1108). Self-hosted answering engine, SearxNG + local (Ollama) or cloud keys, cited sources, browser search-bar integration. |
| 5 | Invoke | **invoke-ai/InvokeAI** — https://github.com/invoke-ai/InvokeAI | Midjourney | custom (Apache-based w/ restrictions) | Unified canvas, layers, inpainting, Flux/SD. Founders joined Adobe in 2025; hosted platform shut down; community maintains. Video's history is accurate. |
| 6 | "A step" | **ace-step/ACE-Step-1.5** — https://github.com/ace-step/ACE-Step-1.5 | Suno | MIT (per Medium writeup; verify in repo) | ACE Studio + StepFun. LM-planner + DiT hybrid. <4GB VRAM base; XL 4B variant needs ≥12GB. <2s/song on A100, <10s on RTX 3090. LoRA style training from a few songs. Honest quality gap vs Suno v6 acknowledged by the video itself. Site: acemusic.ai. |
| 7 | Open Shorts | **mutonby/openshorts** — https://github.com/mutonby/openshorts | Opus Clip | MIT core (cloud/ dir = commercial licence) | Clip Generator (Gemini 3.0 Flash moment detection, MediaPipe+YOLOv8 9:16 tracking, faster-whisper word-level subs), AI Shorts (UGC w/ fal.ai actors), YouTube Studio (titles/thumbs/descs). Self-host free forever; hosted $12/mo. **Has an MCP endpoint** — agent-drivable. Pipeline: yt-dlp → whisper → PySceneDetect → Gemini → FFmpeg → Upload-Post (10 free uploads/mo). CPU: 5-8 min/clip. |
| 8 | Diad | **dyad-sh/dyad** — https://github.com/dyad-sh/dyad | Lovable/v0/Bolt/Replit | AGPL-ish (see repo) | The video garbled the name ("Diad" = **Dyad**). Ex-Google engineer, HN Show HN #45296227. Local Electron app builder, BYO keys, Supabase/Neon 1-click, Vercel deploy, MCP extensible, owns clean exported code. |
| 9 | Open Manas | **FoundationAgents/OpenManus** — https://github.com/FoundationAgents/OpenManus | Manus | MIT | General-purpose agent: planning, browser-use, MCP clients, sandbox, Python exec, str-replace editor. Video's Manus/Meta story garbled — treat the $2B-acquisition-reversed claim as unverified noise; the repo is what matters. |
| 10 | Upscale | **upscayl/upscayl** — https://github.com/upscayl/upscayl | Topaz Gigapixel | AGPL-ish | The video garbled the name ("Upscale" = **Upscayl**). NCNN/Vulkan, needs a Vulkan GPU (iGPUs mostly fail), 4x/16x, batch, community models. Face repair = cloud-only $25/mo. The Windows snail joke is real. |

## Transcript-garble table (for future reference)
- "Voice Studio" → VoiceStudio (debpalash)
- "A step" → ACE-Step
- "Diad" → Dyad
- "Upscale" → Upscayl
- "Vain" → Vane (correctly the new name of Perplexica)
- "Kimiko" → Kimi
- "Open Manas" → OpenManus
- Star counts: 54k→50.2k (VoiceStudio), 91k→44k (Odysseus, unverified 91k), 37k→36k (Vane), 6k (OpenShorts, plausible), 58k (OpenManus, plausible), 13k (ACE-Step, plausible), 28k (InvokeAI, plausible)

## The pattern worth stealing (why Spencer flagged this)
This video is the consumer-facing mirror of our free-compute thesis: every closed
subscription has an open-source twin whose only costs are your hardware + your keys.
Three of the ten are directly agent-relevant:
1. **freellmapi** = the machine-readable free-tier aggregation layer (already on the shelf as pattern #3 in free-llm-api-directory-2026-10.md)
2. **OpenShorts MCP** + **VoiceStudio MCP** = media generation exposed as agent tools — pairs with CreativeClaw on-call
3. **Dyad** = the "own your stack" app-builder stance, same philosophy as Savant

## Wild-shit candidates (Spencer's ask)
- Nova + OpenShorts MCP: Spencer records content → agent clips/publishes autonomously
- VoiceStudio MCP: Nova gets a VOICE — TTS/voice-clone as a Hermes MCP server
- ACE-Step + heartmula skill already in roster: local music gen lane exists
- freellmapi self-hosted: replaces the hand-curated provider feeds in free-compute-discovery

## Status
Logged to idea-shelf per idea-farm conventions. SHELVED as a directory; the MCP-tool
angle (2) is the reactivation trigger if Spencer wants agent-driven media pipelines.
