/**
 * SDK environment helper for dependency injection.
 *
 * This module provides SDK-specific env helpers that extend the base
 * process env with SDK-specific vars for binary paths and WASM.
 */

import { BYOK_OPENROUTER_ENV_VAR } from '@savant-code/common/constants/byok'
import { CHATGPT_OAUTH_TOKEN_ENV_VAR } from '@savant-code/common/constants/chatgpt-oauth'
import { API_KEY_ENV_VAR } from '@savant-code/common/constants/paths'
import { getBaseEnv } from '@savant-code/common/env-process'

import type { SdkEnv } from './types/env'

/**
 * Get SDK environment values.
 * Composes from getBaseEnv() + SDK-specific vars.
 */
export const getSdkEnv = (): SdkEnv => ({
  ...getBaseEnv(),

  // SDK-specific paths
  SAVANT_CODE_RG_PATH: process.env.SAVANT_CODE_RG_PATH,
  SAVANT_CODE_WASM_DIR: process.env.SAVANT_CODE_WASM_DIR,

  // Build flags
  VERBOSE: process.env.VERBOSE,
  OVERRIDE_TARGET: process.env.OVERRIDE_TARGET,
  OVERRIDE_PLATFORM: process.env.OVERRIDE_PLATFORM,
  OVERRIDE_ARCH: process.env.OVERRIDE_ARCH,
})

export const getSavantCodeApiKeyFromEnv = (): string | undefined => {
  return process.env[API_KEY_ENV_VAR]
}

/**
 * Runtime override for the SavantCode backend base URL. Remote hosts that bundle
 * the SDK (Convex Node actions, Next server routes) set this at deploy time;
 * the bundle-time value can inline a dev-machine localhost URL the remote
 * runtime cannot reach.
 */
export const getRuntimeAppUrlFromEnv = (): string | undefined => {
  return (
    process.env['NEXT_PUBLIC_SAVANT_CODE_APP_URL'] ??
    process.env['SAVANT_CODE_APP_URL']
  )
}

export const getSystemProcessEnv = (): NodeJS.ProcessEnv => {
  return process.env
}

export const getByokOpenrouterApiKeyFromEnv = (): string | undefined => {
  return process.env[BYOK_OPENROUTER_ENV_VAR]
}

/**
 * Get the inference base URL from environment.
 * Returns undefined when not set, falling back to SavantCode backend.
 */
export const getInferenceBaseUrlFromEnv = (): string | undefined => {
  return process.env['INFERENCE_BASE_URL']
}

/**
 * Get the inference API key from environment.
 */
export const getInferenceApiKeyFromEnv = (): string | undefined => {
  return process.env['INFERENCE_API_KEY']
}
export const getChatGptOAuthTokenFromEnv = (): string | undefined => {
  return process.env[CHATGPT_OAUTH_TOKEN_ENV_VAR]
}

/**
 * Get the TokenRouter API key from environment.
 */
export const getTokenRouterApiKeyFromEnv = (): string | undefined => {
  return process.env['TOKENROUTER_API_KEY']
}

/**
 * Get the NVIDIA NIM API key from environment.
 */
export const getNvidiaApiKeyFromEnv = (): string | undefined => {
  return process.env['NVIDIA_API_KEY']
}

/**
 * Get the OpenCode Go API key from environment.
 */
export const getOpenCodeGoApiKeyFromEnv = (): string | undefined => {
  return process.env['OPENCODE_GO_API_KEY']
}

/**
 * Get the Cloudflare Workers AI API token from environment.
 */
export const getCloudflareApiTokenFromEnv = (): string | undefined => {
  return process.env['CLOUDFLARE_API_TOKEN']
}

/**
 * Get the Cloudflare account ID from environment.
 */
export const getCloudflareAccountIdFromEnv = (): string | undefined => {
  return process.env['CLOUDFLARE_ACCOUNT_ID']
}

/**
 * Get the CommandCode API key from environment.
 */
export const getCommandCodeApiKeyFromEnv = (): string | undefined => {
  return process.env['COMMAND_CODE_API_KEY']
}
