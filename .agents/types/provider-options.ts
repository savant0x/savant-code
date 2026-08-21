/** OpenRouter provider routing and fallback options for an agent request. */
export interface ProviderOptions {
  /** List of provider slugs to try in order (e.g. ["anthropic", "openai"]). */
  order?: string[]
  /** Whether to allow backup providers when primary is unavailable (default: true). */
  allow_fallbacks?: boolean
  /** Only use providers that support all parameters (default: false). */
  require_parameters?: boolean
  /** Control whether to use providers that may store data. */
  data_collection?: 'allow' | 'deny'
  /** List of provider slugs to allow for this request. */
  only?: string[]
  /** List of provider slugs to skip for this request. */
  ignore?: string[]
  /** List of quantization levels to filter by. */
  quantizations?: Array<
    | 'int4'
    | 'int8'
    | 'fp4'
    | 'fp6'
    | 'fp8'
    | 'fp16'
    | 'bf16'
    | 'fp32'
    | 'unknown'
  >
  /** Sort providers by price, throughput, or latency. */
  sort?: 'price' | 'throughput' | 'latency'
  /** Maximum pricing you want to pay for this request. */
  max_price?: {
    prompt?: number | string
    completion?: number | string
    image?: number | string
    audio?: number | string
    request?: number | string
  }
}
