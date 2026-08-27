// FID-2026-0820-010 Loop 10 — slash-command registry for the desktop
// composer. PURE data + filtering only: execution lives in the Composer.
// v1 ships renderer-local commands only — the gateway v1 contract has no
// command-dispatch method, so anything needing the backend (/model, /usage,
// /goal …) is deliberately absent rather than faked.

export interface SlashCommand {
  readonly name: string
  readonly description: string
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: '/clear', description: 'clear the transcript' },
  { name: '/deck', description: 'switch to the command deck view' },
  { name: '/chat', description: 'switch to the chat view' },
  { name: '/help', description: 'list available commands' },
]

/** The in-flight command word while typing (`'/cl'` → `'cl'`), else null. */
export function slashQueryOf(draft: string): string | null {
  if (!draft.startsWith('/')) return null
  if (draft.includes(' ') || draft.includes('\n')) return null
  return draft.slice(1)
}

/** Case-insensitive prefix filter over the registry ('' → everything). */
export function filterSlashCommands(query: string): SlashCommand[] {
  const needle = query.trim().toLowerCase()
  return SLASH_COMMANDS.filter((command) =>
    command.name.toLowerCase().includes(`/${needle}`),
  )
}

/** Exact-match lookup for a submitted draft ('/clear' → command). */
export function findSlashCommand(text: string): SlashCommand | null {
  const needle = text.trim().toLowerCase()
  return SLASH_COMMANDS.find((command) => command.name === needle) ?? null
}
