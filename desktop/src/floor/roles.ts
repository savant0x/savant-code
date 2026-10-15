/**
 * FID-2026-0822-012 P2 — deck role-casting registry.
 *
 * Walkers cast from the spawn event's structured `agentType` / `displayName`
 * fields against the canonical 10-role ECHO roster (Savant the Orchestrator +
 * nine specialists); anything else renders the generic silhouette. Zero
 * invented characters: this registry IS the cast list. The roster is pinned
 * by the parity test in __tests__/roles.test.ts — it must always equal the
 * canonical roster, never grow a fictional member.
 *
 * Accents draw exclusively from the floor-local palette (`deck-accents.ts`)
 * — no raw hex lives here. Ten roles map onto ten distinct floor accents;
 * the v1 collisions (scout≡researcher≡savant on primary, scribe≡thinker on
 * muted) were split in FID-2026-0828-002 B so every role reads distinctly
 * on the floor.
 */

import { ROLE_FLOOR_ACCENTS } from './deck-accents'
import { DECK_TOKENS } from './deck-tokens.generated'

/** The canonical ECHO cast: Orchestrator first, then the nine specialists. */
export const DECK_ROLE_IDS = [
  'savant',
  'detective',
  'forge',
  'verifier',
  'recorder',
  'thinker',
  'scout',
  'researcher',
  'scribe',
  'adversary',
] as const

export type DeckCoreRoleId = (typeof DECK_ROLE_IDS)[number]

/** Display names for the cast chips (single truth for nameplates). */
export const ROLE_LABELS: Readonly<Record<DeckCoreRoleId, string>> = {
  savant: 'Savant',
  detective: 'Detective',
  forge: 'Forge',
  verifier: 'Verifier',
  recorder: 'Recorder',
  thinker: 'Thinker',
  scout: 'Scout',
  researcher: 'Researcher',
  scribe: 'Scribe',
  adversary: 'Adversary',
}

/** Unknown agentTypes never invent a character — they render this silhouette. */
export const GENERIC_ROLE_ID = 'generic' as const

export type DeckRoleId = DeckCoreRoleId | typeof GENERIC_ROLE_ID

const ROLE_ACCENTS: Readonly<Record<DeckCoreRoleId, string>> = {
  // FID-2026-0828-002: accents read from the floor-local desaturated palette
  // (`deck-accents.ts`) — the raw contract tokens saturated under the deck's
  // additive/emissive pipeline (the operator's cyan/yellow floor wash). The
  // muted generic-silhouette color below stays the contract token: it is
  // deliberately dim and never additively stacked.
  ...ROLE_FLOOR_ACCENTS,
} as unknown as Readonly<Record<DeckCoreRoleId, string>>

/** Contract-token accent for a cast role; the silhouette renders muted. */
export function roleAccent(roleId: DeckRoleId): string {
  return roleId === GENERIC_ROLE_ID ? DECK_TOKENS.muted : ROLE_ACCENTS[roleId]
}

function castByDisplayName(displayName: string | undefined): DeckRoleId {
  const lowered = displayName?.toLowerCase()
  if (lowered === undefined || lowered.length === 0) return GENERIC_ROLE_ID
  // Persona forms ("Savant the Thinker") must win their specialist role, so
  // scan the nine specialist ids BEFORE the orchestrator's own name.
  const specialist = DECK_ROLE_IDS.find(
    (id) => id !== 'savant' && lowered.includes(id),
  )
  if (specialist !== undefined) return specialist
  return lowered.includes('savant') ? 'savant' : GENERIC_ROLE_ID
}

/**
 * Cast a spawn event identity onto the deck roster. Exact `agentType` match
 * wins; otherwise the display name resolves (persona forms included);
 * otherwise the generic silhouette. Never throws, never invents.
 */
export function castAgent(
  agentType: string | undefined,
  displayName: string | undefined,
): DeckRoleId {
  const normalized = agentType?.trim().toLowerCase()
  if (
    normalized !== undefined &&
    normalized.length > 0 &&
    DECK_ROLE_IDS.includes(normalized as DeckCoreRoleId)
  ) {
    return normalized as DeckCoreRoleId
  }
  return castByDisplayName(displayName)
}
