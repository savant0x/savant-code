import { PROVIDER_GRAMMAR_WORDS } from '../utils/provider-wizard'

/**
 * /provider add|edit|list|remove subcommand handling (FID-2026-0910-004
 * Step 8; FID-2026-0913-002 facade). Extracted from the /provider command
 * definition so the subcommand surface is testable without the TUI (Law 13
 * — one module owns the subcommand grammar; the command def only
 * dispatches). The family is split by concern:
 * - `provider-subcommands-parse.ts` — the pure argument grammar
 * - `provider-subcommands-replies.ts` — the two reply shapes (echo/no-echo)
 * - `provider-subcommands-picker.ts` — the picker selection path
 * - `provider-subcommands-handlers.ts` — the typed handlers + dispatch
 * This module re-exports every public symbol in place (zero import-site
 * churn) and keeps the grammar-word single truth re-export alive for the
 * command definition.
 *
 * Grammar (the FID's Expected Behavior + MQ1):
 * - `/provider add`             — start the wizard (add mode)
 * - `/provider edit <id>`       — reopen the wizard pre-filled (custom-only)
 * - `/provider list`            — built-ins + customs with markers
 * - `/provider remove <id>`     — delete a custom definition (custom-only;
 *   removing the active provider resets selection + routing)
 * - `/provider <name> [update]` — existing selection/key semantics preserved
 *   (FID-2026-0907-009 `update` token honored)
 */

/** Grammar words re-exported for the command definition (single truth lives
 * in provider-wizard.ts next to the wizard's id-step reservation). */
export { PROVIDER_GRAMMAR_WORDS }

export { parseProviderArgs } from './provider-subcommands-parse'
export type {
  ProviderArgs,
  ProviderSubcommand,
} from './provider-subcommands-parse'

export { handleProviderSubcommand } from './provider-subcommands-handlers'

export { handleProviderPickerSelection } from './provider-subcommands-picker'
export type { PickerSelectionParams } from './provider-subcommands-replies'
