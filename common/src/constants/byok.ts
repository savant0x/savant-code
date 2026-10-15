export const BYOK_OPENROUTER_HEADER = 'x-openrouter-api-key'
export const BYOK_OPENROUTER_ENV_VAR = 'SAVANT_CODE_BYOK_OPENROUTER'

/**
 * OpenRouter API base (FID-2026-0806-010). `openrouter/`-prefixed models route
 * here directly with the user's key; the slug (e.g. `openrouter/free`) is the
 * full OpenRouter model ID and is sent unchanged.
 */
export const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1'
