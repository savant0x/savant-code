# Provider model catalogs — 2026-10-03

Fetched directly from each provider with its own key from `.env.local`.
All three requests returned HTTP 200. Credentials were supplied through
curl stdin configuration and do not appear in argv or saved responses.

| Provider | HTTP status | Models | Full response |
|---|---|---|---|
| CodeCraft API | 200 | 33 | [codecraft.json](codecraft.json) |
| xKiro | 200 | 129 | [xkiro.json](xkiro.json) |
| CleanAPIs | 200 | 33 | [cleanapis.json](cleanapis.json) |

Every catalog parsed as an `object: list` with unique, nonempty model IDs.
xKiro's catalog is public: HTTP 200 on this endpoint does not validate its
key or prove access to every model. Its tiers total 55 free, 63 paid, and
11 premium models. No generation or billable inference calls were made.

CodeCraft and CleanAPIs returned identical sets of 33 bare IDs. Their
responses contain both OpenRouter-style per-token price strings and
per-1,000-token aliases; the two representations agree for every row.
All rows include a context limit, but all 33 output limits are unknown
(`top_provider.max_completion_tokens: null`). Preserve that uncertainty.
Their capabilities are string arrays and creation times are numeric.
xKiro uses vendor-qualified IDs, per-million-token numeric pricing,
capability objects, and verified context/output limits in all 129 rows.

The initial sandbox attempts failed in Windows TLS before reaching the
providers. The approved retries downloaded the complete raw bodies.

## Response integrity

| Provider | Endpoint | SHA-256 |
|---|---|---|
| CodeCraft API | `https://codecraftapi.com/v1/models` | `387c70836fb0fe1f2ce87e95b066cda5dd6c83dd1a87f98b5583037aa8469c4b` |
| xKiro | `https://api.xkiro.com/v1/models` | `3a14817766de25bede109517fff90a21c65c7724c1415b150654d1aba546624a` |
| CleanAPIs | `https://cleanapis.com/v1/models` | `16d5d3025faa37116c281db6209c8d6b43de53c0e33f27c565ec18784dc73250` |

## Model IDs

### CodeCraft API

```text
muse-spark-1.1
gemma-2-2b
gpt-5.6-sol
claude-opus-5
claude-fable-5
claude-mythos-preview
kimi-k3
glm-5.3
deepseek-v4-pro-0813
qwen3.8-max
gpt-5.6-terra
claude-opus-4.8
gemini-3.7-flash
claude-sonnet-5
gpt-5.5
grok-4.5
deepseek-v4-flash-0731
grok-4.6
seed-2.1-pro
glm-5.2
qwen3.8-27b
gpt-5.6-luna
qwen3.7-max
claude-opus-4.6
gpt-5.5-pro
claude-opus-4.7
gemini-3.6-flash
kimi-k2.6
seed-2.1-turbo
gemini-3.1-pro
deepseek-v4-pro-max
claude-fable-5.1
claude-opus-5.5
```

### xKiro

```text
minimax/minimax-m3
tencent/hy3
openai/gpt-6.1-sol
tencent/hy4-preview
x-ai/grok-4.5
mistralai/ministral-14b
anthropic/claude-opus-4.8
x-ai/grok-4.7
z-ai/glm-4.7-flash
inclusionai/ling-3.0-flash-sante:free
z-ai/glm-4.5-airx
sensenova/sensenova-6.8-flash-lite
anthropic/claude-opus-5
z-ai/glm-5.1
apodex/apodex-1.1-mini:free
nvidia/nemotron-3-super
anthropic/claude-fable-5-1
anthropic/claude-sonnet-4.5
cohere/aya-expanse-32b
openai/gpt-5.6-luna
openai/gpt-6-astra
anthropic/claude-fable-5
anthropic/claude-opus-4.6
anthropic/claude-opus-4.5
anthropic/claude-sonnet-4.6
anthropic/claude-haiku-4.5
tencent/hy3-preview
google/gemini-3.8-flash
google/gemini-3.5-flash
google/gemini-3.6-flash
google/gemini-3.1-pro
qwen/qwen3.7-flash:free
google/gemini-3.7-flash
x-ai/grok-4.6
cohere/aya-vision-32b
deepseek/deepseek-v4.1-flash
deepseek/deepseek-v4-pro-0813
mistralai/ministral-3b
anthropic/claude-sonnet-4
z-ai/glm-4.6v
openai/gpt-5.6-terra
openai/gpt-5.4-mini
deepseek/deepseek-v4-flash-0731
minimax/minimax-m2.7
openai/gpt-6-sol
mistralai/mistral-small-2603
openai/gpt-6-luna
anthropic/claude-sonnet-5
google/gemini-2.5-flash
moonshotai/kimi-k3-agent
z-ai/glm-5.3-flash
liquid/lfm-2.5-2.6b:free
minimax/minimax-m2.1
z-ai/glm-5.3
mistralai/mistral-medium-3.5
openai/gpt-5.5
minimax/minimax-m2.7-highspeed
z-ai/glm-4.5-air
openai/gpt-5.4
mistralai/mistral-large-2512
mistralai/devstral-medium
anthropic/claude-opus-5.5
mistralai/codestral-2508
z-ai/glm-4.5-flash
z-ai/glm-5.2
z-ai/glm-5-turbo
google/gemini-3-flash
z-ai/glm-5
z-ai/glm-4.7
moonshotai/kimi-k2.8-preview-agent
minimax/minimax-m2.5
qwen/qwen3-vl-plus:free
qwen/qwen3-omni-flash:free
mistralai/ministral-8b
z-ai/glm-4.7-flashx
z-ai/glm-5v-turbo
z-ai/glm-4.6v-flashx
z-ai/glm-4.6v-flash
z-ai/glm-4.5v
google/gemini-2.5-pro
xiaomi/mimo-v2.6-pro
xiaomi/mimo-v2.6-flash
anthropic/claude-opus-4.7
minimax/minimax-m2.5-highspeed
minimax/minimax-m2.1-highspeed
minimax/minimax-m2
xiaomi/mimo-v2.5-pro
xiaomi/mimo-v2.5
qwen/qwen3.6-27b:free
qwen/qwen3.5-plus:free
qwen/qwen3.5-omni-plus:free
meituan/longcat-2.5-preview:free
meituan/longcat-2.0
qwen/qwen3.6-plus:free
qwen/qwen3-max:free
cohere/command-r-plus-08-2024
qwen/qwen3.7-max:free
cohere/north-mini-code
cohere/command-r-08-2024
openai/gpt-5.6-sol
qwen/qwen3.7-plus:free
nvidia/nemotron-3-ultra
qwen/qwen3.8-omni-flash:free
qwen/qwen3.8-max:free
stealth/big-pickle
qwen/qwen3.5-omni-flash:free
nvidia/nemotron-3-nano-omni
cohere/command-r7b-12-2024
stealth/space-bunny-alpha:free
dots-studio/dots-3-note-preview:free
sensenova/sensenova-6.7-flash-lite
cohere/command-a
cohere/command-a-translate
qwen/qwen3.6-max-preview:free
qwen/qwen3.6-35b-a3b:free
qwen/qwen3.5-flash:free
qwen/qwen3.5-397b-a17b:free
qwen/qwen-plus-2025-07-28:free
qwen/qwen3-coder-plus:free
cohere/north-small-translate
cohere/command-a-plus
cohere/command-a-vision
cohere/command-a-reasoning
meta/muse-spark-1.3-contributor:free
cohere/tiny-aya-global
cohere/tiny-aya-fire
cohere/tiny-aya-earth
cohere/tiny-aya-water
meta/muse-spark-1.2-contributor:free
```

### CleanAPIs

```text
muse-spark-1.1
gemma-2-2b
gpt-5.6-sol
claude-opus-5
claude-fable-5
claude-mythos-preview
kimi-k3
glm-5.3
deepseek-v4-pro-0813
qwen3.8-max
gpt-5.6-terra
claude-opus-4.8
gemini-3.7-flash
claude-sonnet-5
gpt-5.5
grok-4.5
deepseek-v4-flash-0731
grok-4.6
seed-2.1-pro
glm-5.2
qwen3.8-27b
gpt-5.6-luna
qwen3.7-max
claude-opus-4.6
gpt-5.5-pro
claude-opus-4.7
gemini-3.6-flash
kimi-k2.6
seed-2.1-turbo
gemini-3.1-pro
deepseek-v4-pro-max
claude-fable-5.1
claude-opus-5.5
```
