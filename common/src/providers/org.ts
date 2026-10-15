/**
 * Org-slug metadata extracted from common/src/constants/model-config.ts
 * (FID-2026-0809-001 Phase 1). These are upstream *organization* slugs and
 * domains that are NOT registry providers — they are routing prefixes for
 * bare model ids (anthropic/…, openai/…) and logo lookups.
 *
 * Registry provider ids (openrouter, tokenrouter, tokenharbor, nvidia,
 * opencode-go, commandcode, cloudflare, ollama) live in PROVIDER_REGISTRY;
 * every other prefix/domain lives here, exactly once.
 */

/** The 12 inline org slugs formerly inline in ALLOWED_MODEL_PREFIXES. */
export const ORG_PREFIXES = [
  'anthropic',
  'openai',
  'google',
  'x-ai',
  'deepseek',
  'minimax',
  'mimo',
  'tencent',
  'moonshotai',
  'bytedance-seed',
  'xiaomi',
  'miromind',
] as const

/** The 9 org-slug favicon domains formerly inline in providerDomains. */
export const ORG_DOMAINS = {
  google: 'google.com',
  anthropic: 'anthropic.com',
  openai: 'chatgpt.com',
  deepseek: 'deepseek.com',
  minimax: 'minimax.io',
  mimo: 'xiaomi.com',
  atlascloud: 'atlascloud.ai',
  tencent: 'tencent.com',
  xai: 'x.ai',
} as const
