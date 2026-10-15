# ShellShock (theRizwan) — Eval + Shelf Note (2026-10-08)

Source: https://github.com/theRizwan/ShellShock (read live 10-08). 2 commits, 3 hours old,
1 star, MIT. Author: Rizwan Saleem (theRizwan), Senior Frontend Developer at Horsefly
Analytics, Manchester — "Streaming correctness at the LLM–UI boundary. Author of llm-guard."

## What it is
A local AI gateway that connects Claude Code / Codex / Cursor / Cline / OpenCode to
FREE providers through one OpenAI-compatible endpoint. Next.js dashboard + routing
engine (open-sse/) + shellshock CLI launcher + tray. Port 20128.

## Features (from README, verified in tree)
- **Free-provider policy enforced at routing time** (open-sse/providers/policy.js):
  freeOnly, categories [free, freeTier], includeHasFree, include/exclude by provider id
- **Models screen**: every model from every free provider in one searchable table,
  ready/connect status, one-click test
- **brand.json = single source**: product name, CLI command, data folder (~/.<slug>),
  modelPrefix (so models show as <prefix>/<model> in tools), MITM cert names, provider
  policy. `npm run brand:sync` propagates to package.json files
- **npm run bridge**: terminal wizard — picks model (GPT-6.1-Sol or GPT-6-Astra), tool
  (Codex or VS Code), writes config, runs in bg
- Screens: Models, Combos & Vision, Token Saver, CLI Tools, Media Models, Agent Skills,
  Proxy Pools, Console Log, Translator, Usage/Quota trackers
- Vitest suite with KNOWN failures (live-provider tests, missing cloud/ worker,
  timing-sensitive DB tests) — honest test disclosure

## The kicker (latest commit, 3h ago)
"fix: route GPT-6.1-Sol and GPT-6-Astra to **Big Pickle**; align warning box"
→ the bridge's "GPT-6.1-Sol / GPT-6-Astra" endpoints route to OpenCode Zen's Big Pickle
stealth slot. So this tool exposes stealth-lane models under front-facing names.

## Red flags / honest read
1. **The Big Pickle routing is a ToS trap**: rebranding OpenCode's free stealth slot as
   "GPT-6.1-Sol / GPT-6-Astra" in users' tools is (a) false naming of models, (b) likely
   ToS-violating redistribution of Zen's free tier through a third-party gateway
2. **Default dashboard password 123456** — fine on localhost, a footgun beyond it
3. **Proxy Pools screen** — built-in proxy rotation for geofenced providers = the same
   ToS-suspension surface as freellmapi
4. 2 commits / 1 star = very young, probably a fork/rewrite of an earlier gateway
   (structure mirrors the freellmapi/FreeLLMAPI pattern: open-sse routing + dashboard)
5. Author is real and legit (llm-guard, streaming-correctness focus) but co-committed
   with claude (AI co-author tag Spencer removed from his own projects)

## Portable patterns (worth stealing)
1. **brand.json single-source** — one file controls name/CLI/data-folder/modelPrefix/certs.
   That's the cleanest white-label architecture in the free-gateway space. Relevant to
   any Savant distribution packaging
2. **Free-provider policy as config** (freeOnly/categories/exclude enforced at routing
   time) — policy-as-data, not policy-as-code
3. **Models screen over provider list** — user-facing aggregation of every free model
   with ready/test status. The freellmapi pattern #3 done at the UI layer

## Shelf verdict
SHELVED — white-label gateway pattern (brand.json) is the reactivation trigger if
Savant ever ships a packaged gateway. The Big Pickle rebranding is NOT a pattern to
copy (false model naming + ToS exposure).
