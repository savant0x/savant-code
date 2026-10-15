/**
 * Shared custats free-models catalog parsing (FID-2026-1003-006) and
 * offer→host attribution. The models catalog's unique value is the delta
 * (`newModelIds`) and retirement (`expiration_date`, `archivedModels`)
 * fields — enrichment + retirement signal, not new-host discovery.
 */

/** Free-model row lifted from free_models.json. */
export type CustatsModel = {
  id: string
  providerId: string | null
  contextLength: number | null
  expirationDate: string | null
}

/** Archived (retired) free-model row. */
export type CustatsArchivedModel = {
  id: string
  providerId: string | null
  removedAt: string
}

export type CustatsModels = {
  fetchedAt: string
  totalModels: number | null
  newModelIds: string[]
  models: CustatsModel[]
  archived: CustatsArchivedModel[]
}

/** Defensive typed lift of one model row; unknown shapes are skipped. */
function liftModel(raw: Record<string, unknown>): CustatsModel | null {
  const id = raw['id']
  if (typeof id !== 'string' || !id) return null
  const providerId =
    typeof raw['providerId'] === 'string' ? raw['providerId'] : null
  const contextLength =
    typeof raw['context_length'] === 'number' ? raw['context_length'] : null
  const expirationDate =
    typeof raw['expiration_date'] === 'string' && raw['expiration_date']
      ? raw['expiration_date']
      : null
  return { id, providerId, contextLength, expirationDate }
}

/**
 * Parse the free_models.json envelope. Returns null on any structural
 * mismatch (untrusted input contract).
 */
export function parseCustatsModels(raw: unknown): CustatsModels | null {
  if (typeof raw !== 'object' || raw === null) return null
  const j = raw as Record<string, unknown>
  const fetchedAt = typeof j['fetchedAt'] === 'string' ? j['fetchedAt'] : null
  if (!fetchedAt || !Array.isArray(j['models'])) return null

  const models: CustatsModel[] = []
  for (const entry of j['models']) {
    if (typeof entry !== 'object' || entry === null) continue
    const model = liftModel(entry as Record<string, unknown>)
    if (model) models.push(model)
  }

  const archived: CustatsArchivedModel[] = []
  if (Array.isArray(j['archivedModels'])) {
    for (const entry of j['archivedModels']) {
      if (typeof entry !== 'object' || entry === null) continue
      const a = entry as Record<string, unknown>
      const id = typeof a['id'] === 'string' ? a['id'] : null
      const removedAt =
        typeof a['removedAt'] === 'string' ? a['removedAt'] : null
      if (!id || !removedAt) continue
      const providerId =
        typeof a['providerId'] === 'string' ? a['providerId'] : null
      archived.push({ id, providerId, removedAt })
    }
  }

  const newModelIds = Array.isArray(j['newModelIds'])
    ? j['newModelIds'].filter((v): v is string => typeof v === 'string')
    : []
  const totalModels =
    typeof j['totalModels'] === 'number' ? j['totalModels'] : null

  return { fetchedAt, totalModels, newModelIds, models, archived }
}

const GENERIC_LABELS = new Set([
  'api',
  'www',
  'platform',
  'console',
  'chat',
  'free',
  'gateway',
  'cloud',
  'app',
  'studio',
  'inference',
  'token',
  'tokens',
  'llm',
  'models',
  'open',
  'com',
  'net',
  'org',
  'ai',
  'io',
  'sh',
  'dev',
  'cn',
  'info',
])

/**
 * The host's brand label: its second-to-last domain label, when ≥3 chars
 * and not a generic infrastructure word. `vercel.com` → `vercel`;
 * `api.z.ai` → `z` → null (a 1-char match rule is a false-positive machine).
 */
function brandLabel(host: string): string | null {
  const labels = host.split('.')
  if (labels.length < 2) return null
  const label = labels[labels.length - 2] ?? ''
  if (label.length < 3 || GENERIC_LABELS.has(label)) return null
  return label
}

function textTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter(Boolean),
  )
}

/**
 * Attribute offers to known hosts. Two conservative mechanisms:
 *
 * (a) **Host literal** — a dotted domain appearing in the prose matches the
 *     known host (exact or subdomain-of either direction).
 * (b) **Brand-label token** — a standalone word in the prose equal to the
 *     host's brand label. This is what makes "Vercel AI Gateway" prose
 *     attribute to the vercel lanes.
 *
 * Everything else — short labels like `z` in "Z AI", unlisted brands — lands
 * in `unattributed` for operator review BY DESIGN: attribution never
 * auto-queues a candidate; new lanes enter through SEED_HOSTS review. The
 * custats host itself never counts.
 */
/** The offer shape the matcher consumes (structurally = CustatsOffer). */
export type MatchableOffer = {
  title: string
  url: string
  description: string
  category: string | null
  expiryKind: 'ongoing' | 'expires'
  expiryDate: string | null
  amountHint: string | null
}

export function matchOfferHosts(
  offers: readonly MatchableOffer[],
  knownHosts: ReadonlySet<string>,
): {
  attributed: Array<{ offer: MatchableOffer; hosts: string[] }>
  unattributed: Array<{ offer: MatchableOffer }>
} {
  const known = [...knownHosts].map((h) => h.toLowerCase())
  const attributed: Array<{ offer: MatchableOffer; hosts: string[] }> = []
  const unattributed: Array<{ offer: MatchableOffer }> = []

  for (const offer of offers) {
    const text = `${offer.title} ${offer.description}`.toLowerCase()
    const tokens = textTokens(text)
    const hits = new Set<string>()
    for (const host of known) {
      if (host === 'freetokens.custats.info') continue
      // (a) host literal (exact or subdomain-of either direction)
      let matched = false
      for (const literal of text.matchAll(/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/g)) {
        const candidate = literal[1] ?? ''
        if (
          candidate === host ||
          candidate.endsWith(`.${host}`) ||
          host.endsWith(`.${candidate}`)
        ) {
          matched = true
          break
        }
      }
      // (b) brand-label token
      if (!matched) {
        const label = brandLabel(host)
        if (label && tokens.has(label)) matched = true
      }
      if (matched) hits.add(host)
    }
    if (hits.size > 0) attributed.push({ offer, hosts: [...hits].sort() })
    else unattributed.push({ offer })
  }

  return { attributed, unattributed }
}
