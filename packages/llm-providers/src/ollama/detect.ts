/**
 * Ollama auto-detection utility.
 *
 * Probes the local Ollama daemon using its public HTTP API. The default host
 * is `http://localhost:11434`, which mirrors Ollama's own default and can be
 * overridden with the standard `OLLAMA_HOST` environment variable.
 */

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434'

/** Public shape returned by Ollama's /api/tags endpoint. */
interface OllamaTagsResponse {
  models?: Array<{
    name?: string
    model?: string
    size?: number
    digest?: string
  }>
}

/** Public shape returned by Ollama's /api/version endpoint. */
interface OllamaVersionResponse {
  version?: string
}

export interface OllamaDetectionResult {
  /** Whether Ollama answered successfully on the expected endpoints. */
  available: boolean
  /** The base URL that was probed (useful when OLLAMA_HOST is set). */
  host: string
  /** Ollama server version, if available. */
  version?: string
  /** List of locally available model names. */
  models: string[]
  /** Human-readable error or hint when Ollama is not available. */
  error?: string
}

/**
 * Resolve the Ollama host to probe.
 * Honors `OLLAMA_HOST` when set, otherwise falls back to localhost.
 */
export function resolveOllamaHost(): string {
  const envHost = process.env.OLLAMA_HOST?.trim()
  if (envHost) {
    return envHost
  }
  return DEFAULT_OLLAMA_HOST
}

/**
 * Detect whether Ollama is running and which models are available.
 * This function is side-effect free and does not throw; failures are returned
 * as part of the result object so callers can degrade gracefully.
 */
export async function detectOllama(
  host = resolveOllamaHost(),
): Promise<OllamaDetectionResult> {
  const baseUrl = host.endsWith('/') ? host.slice(0, -1) : host

  let version: string | undefined
  try {
    const versionResponse = await fetch(`${baseUrl}/api/version`, {
      signal: AbortSignal.timeout(3000),
    })
    if (versionResponse.ok) {
      const versionJson =
        (await versionResponse.json()) as OllamaVersionResponse
      version = versionJson.version
    }
  } catch {
    // Fall through to the tags probe; if both fail we report unavailability.
  }

  try {
    const tagsResponse = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })

    if (!tagsResponse.ok) {
      return {
        available: false,
        host: baseUrl,
        models: [],
        error: `Ollama responded with HTTP ${tagsResponse.status}. Make sure the server is running: ollama serve`,
      }
    }

    const tagsJson = (await tagsResponse.json()) as OllamaTagsResponse
    const models = (tagsJson.models ?? [])
      .map((model) => model.name ?? model.model ?? '')
      .filter(Boolean)
      .sort()

    return {
      available: true,
      host: baseUrl,
      version,
      models,
      error: undefined,
    }
  } catch (error) {
    return {
      available: false,
      host: baseUrl,
      models: [],
      error:
        error instanceof Error
          ? error.message
          : 'Ollama is not running. Start it with: ollama serve',
    }
  }
}
