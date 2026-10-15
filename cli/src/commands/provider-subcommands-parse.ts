import { PROVIDER_GRAMMAR_WORDS } from '../utils/provider-wizard'

/**
 * /provider argument grammar (FID-2026-0910-004 Step 8, C4; FID-2026-0913-002
 * split from provider-subcommands.ts). Pure parse — no I/O, no store access.
 */

export type ProviderSubcommand = (typeof PROVIDER_GRAMMAR_WORDS)[number]

export type ProviderArgs =
  | { kind: 'subcommand'; subcommand: ProviderSubcommand; rest: string }
  | { kind: 'provider'; name: string; wantsKeyUpdate: boolean }

/** Parse the /provider argument string into a dispatch decision. */
export function parseProviderArgs(args: string): ProviderArgs {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  const first = tokens[0]?.toLowerCase()
  if (first && (PROVIDER_GRAMMAR_WORDS as readonly string[]).includes(first)) {
    return {
      kind: 'subcommand',
      subcommand: first as ProviderSubcommand,
      rest: tokens.slice(1).join(' '),
    }
  }
  // Preserve FID-2026-0907-009: a trailing `update` token forces the masked
  // key prompt even when a key is already configured; everything before it is
  // the provider name (`/provider nous update extra` → name
  // 'nous update extra', resolved (unknown) by the caller as before).
  const wantsKeyUpdate =
    tokens.length > 1 && tokens[tokens.length - 1] === 'update'
  return {
    kind: 'provider',
    name: wantsKeyUpdate ? tokens.slice(0, -1).join(' ') : tokens.join(' '),
    wantsKeyUpdate,
  }
}
