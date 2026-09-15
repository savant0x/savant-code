/**
 * FID-2026-0914-003 — two-tier typosquat screen + dev-dir write guard.
 *
 * Loop-2 finding A3: a naive "hard-fail at distance <= 2" caught the true
 * typosquat api.celebras.ai AND false-positived api.z.ai (legitimate Zhipu,
 * distance-1 from api.x.ai). The corrected gate (Loop 3):
 * - Tier 1 (`reject`): distance 1-2 vs a vendor host, UNLESS the host itself
 *   is on the legitimate-vendor allowlist.
 * - Tier 2 (`flag`): distance 3-4 — carried into the report flagged.
 * - (`pass`): everything else.
 */

/** Canonical vendor API hosts (the real brands the screen protects). */
const VENDOR_HOSTS: readonly string[] = [
  'api.cerebras.ai',
  'api.openai.com',
  'api.anthropic.com',
  'api.groq.com',
  'api.mistral.ai',
  'api.together.xyz',
  'api.deepinfra.com',
  'api.fireworks.ai',
  'api.sambanova.ai',
  'api.cohere.com',
  'api.x.ai',
  'api.novita.ai',
  'api.hyperbolic.xyz',
  'api.deepseek.com',
  'api.moonshot.ai',
  'api.minimax.io',
  'openrouter.ai',
  'api.cloudflare.com',
  'generativelanguage.googleapis.com',
  'api-inference.huggingface.co',
]

/**
 * Legitimate hosts that are Levenshtein-close to a vendor host but ARE the
 * real brand (Loop-3 correction). Reviewed constants — extend deliberately.
 */
const LEGITIMATE_ALLOWLIST: ReadonlySet<string> = new Set([
  'api.z.ai', // Zhipu (zai) — distance-1 from api.x.ai
  'z.ai',
  // Adjudicated legitimate 2026-09-15: LIVE evidence — api.cohere.ai and
  // api.cohere.com answer /v1/models from the SAME IP (34.96.76.122) with
  // byte-identical 401 JSON (envoy); the Cohere SDK ecosystem documents
  // https://api.cohere.ai/v1 as the default base URL. The brand cannot
  // impersonate itself. (Was: tier-2 flag, distance 3 from api.cohere.com.)
  'api.cohere.ai',
])

export type TyposquatVerdict = 'pass' | 'flag' | 'reject'

export function typosquatVerdict(host: string): TyposquatVerdict {
  const normalized = host.toLowerCase().trim()
  if (
    VENDOR_HOSTS.some((v) => v.toLowerCase() === normalized) ||
    LEGITIMATE_ALLOWLIST.has(normalized)
  ) {
    return 'pass'
  }

  let worst: { distance: number; vendor: string } | null = null
  for (const vendor of VENDOR_HOSTS) {
    const distance = levenshtein(normalized, vendor)
    if (worst === null || distance < worst.distance) {
      worst = { distance, vendor }
    }
  }
  if (worst === null) return 'pass'
  if (worst.distance <= 2) return 'reject'
  if (worst.distance <= 4) return 'flag'
  return 'pass'
}

/** Human-readable reason for a reject/flag verdict (report audit trail). */
export function typosquatReason(host: string): string {
  const normalized = host.toLowerCase().trim()
  let best: { distance: number; vendor: string } | null = null
  for (const vendor of VENDOR_HOSTS) {
    const distance = levenshtein(normalized, vendor)
    if (best === null || distance < best.distance) {
      best = { distance, vendor }
    }
  }
  return best
    ? `closest vendor host ${best.vendor} at Levenshtein distance ${best.distance}`
    : 'no vendor host comparison available'
}

/** Standard DP Levenshtein distance (small inputs; no deps). */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  )
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return dp[m][n]
}

/**
 * Write guard: every artifact write must land inside `dev/`. Enforces the
 * FID invariant "zero writes outside dev/scratchpad + dev/provider-candidates"
 * structurally — a bug can never scribble on the repo.
 */
export function assertWithinDev(relativePath: string): void {
  const normalized = relativePath.replaceAll('\\', '/')
  const segments = normalized.split('/').filter((s) => s.length > 0)
  if (segments[0] !== 'dev' || normalized.includes('..')) {
    throw new Error(
      `FID-2026-0914-003 write guard: '${relativePath}' is outside dev/ — pipeline artifacts must stay under dev/`,
    )
  }
}
