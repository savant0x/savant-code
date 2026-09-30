import type { LanguageModel } from 'ai'

/**
 * Parameters for requesting a model.
 */
export interface ModelRequestParams {
  /** Model ID (OpenRouter format, e.g., "anthropic/claude-sonnet-4") */
  model: string
  /** If true, skip ChatGPT OAuth and use SavantCode backend (for fallback after rate limit) */
  skipChatGptOAuth?: boolean
}

/**
 * Result from getModelForRequest.
 */
export interface ModelResult {
  /** The language model to use for requests */
  model: LanguageModel
  /** Whether this model uses ChatGPT OAuth direct (affects cost tracking) */
  isChatGptOAuth: boolean
}

// Usage accounting type for OpenRouter/SavantCode backend responses
export type OpenRouterUsageAccounting = {
  cost: number | null
  costDetails: {
    upstreamInferenceCost: number | null
  }
}

/**
 * Shape of the parsed API response body from the provider for usage extraction.
 * The provider returns usage data at response.usage.cost and response.usage.cost_details.upstream_inference_cost.
 */
export interface ProviderParsedResponse {
  usage?: {
    cost?: number
    cost_details?: {
      upstream_inference_cost?: number
    }
  }
}
