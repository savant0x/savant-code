/**
 * Resolve the shared OpenCode API key (FID-2026-0905-003 key merge).
 *
 * One credential powers OpenCode Go and OpenCode Zen. Resolution order:
 * 1. `OPENCODE_API_KEY` — the official shared key (works for both endpoints)
 * 2. `OPENCODE_GO_API_KEY` — legacy Go-only var, honored as a fallback so
 *    existing setups keep working without a rename.
 *
 * Deliberately cache-free (unlike the OpenRouter resolver): this chain is a
 * pure environment read with no network exchange, so there is nothing to
 * cache and no reset hook for `saveProviderApiKey` to call.
 */
function readNonEmptyEnvVar(name: string): string | undefined {
  const value = process.env[name]
  return value !== undefined && value.trim() !== '' ? value : undefined
}

export async function resolveOpencodeApiKey(): Promise<string | undefined> {
  return (
    readNonEmptyEnvVar('OPENCODE_API_KEY') ??
    readNonEmptyEnvVar('OPENCODE_GO_API_KEY')
  )
}
