// FID-2026-0820-010 Loop 10 — slash-command registry for the desktop
// composer. PURE data + filtering only: execution lives in the Composer.
//
// FID-2026-0901-005: the registry is now MERGED from two sources:
//  - LOCAL_COMMANDS: renderer-local view commands (/deck, /chat, /clear)
//  - the gateway's `list_commands` result: the full CLI registry, with an
//    honest dispatch class — 'agent' commands are sent as prompt text through
//    the run path (the runtime intercepts command-shaped prompts, e.g.
//    /compact), 'client' commands are TUI-only and shown as unavailable.

export interface SlashCommand {
  readonly name: string
  readonly description: string
}

/** A palette entry after merging local + server registries. */
export interface PaletteCommand extends SlashCommand {
  /** 'local' executes in the renderer; 'agent' dispatches via user_message;
   *  'client' is TUI-only — shown but not executable here. */
  readonly origin: 'local' | 'agent' | 'client'
}

/** Renderer-local commands (view + transcript control). */
export const LOCAL_COMMANDS: readonly SlashCommand[] = [
  { name: '/deck', description: 'switch to the command deck view' },
  { name: '/chat', description: 'switch to the chat view' },
  { name: '/clear', description: 'clear the transcript' },
]

/**
 * Merge the local registry with the server's list_commands result. Server
 * entries become 'agent' (dispatched as prompt text) or 'client' (TUI-only);
 * local entries shadow a same-named server entry. Sorted by name.
 */
export function mergeCommands(
  serverCommands: ReadonlyArray<{
    id: string
    description: string
    dispatch: string
  }>,
): PaletteCommand[] {
  const merged: PaletteCommand[] = LOCAL_COMMANDS.map((command) => ({
    ...command,
    origin: 'local' as const,
  }))
  for (const server of serverCommands) {
    const name = `/${server.id}`
    if (merged.some((command) => command.name === name)) continue
    merged.push({
      name,
      description: server.description,
      origin: server.dispatch === 'agent' ? 'agent' : 'client',
    })
  }
  return merged.sort((a, b) => a.name.localeCompare(b.name))
}

/** The in-flight command word while typing (`'/cl'` → `'cl'`), else null. */
export function slashQueryOf(draft: string): string | null {
  if (!draft.startsWith('/')) return null
  if (draft.includes(' ') || draft.includes('\n')) return null
  return draft.slice(1)
}

/** Case-insensitive prefix filter over the merged registry ('' → all). */
export function filterCommands(
  registry: readonly PaletteCommand[],
  query: string,
): PaletteCommand[] {
  const needle = query.trim().toLowerCase()
  return registry.filter((command) =>
    command.name.toLowerCase().includes(`/${needle}`),
  )
}

/** Exact-match lookup for a submitted draft ('/clear' → command). */
export function findCommand(
  registry: readonly PaletteCommand[],
  text: string,
): PaletteCommand | null {
  const needle = text.trim().toLowerCase()
  return registry.find((command) => command.name === needle) ?? null
}
