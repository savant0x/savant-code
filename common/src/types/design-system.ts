export type DesignContract = {
  id: string
  displayName: string
  targets: Array<'terminal' | 'react' | 'web'>
  colors: Record<string, string>
  typography: Record<string, Record<string, unknown>>
  spacing: Record<string, string>
  radius: Record<string, string>
  components: Record<string, Record<string, unknown>>
  /** Explicit accessibility requirements, when the selected contract defines them. */
  accessibility?: Record<string, unknown>
  /** Provenance and identity metadata travel with the active contract. */
  source?: 'embedded' | 'project' | 'user'
  status?: 'curated-reference' | 'savant-native' | 'custom'
  selectionScope?: 'session' | 'project' | 'user' | 'default'
  sourceContentHash?: string
  normalizedContentHash?: string
  provenance?: {
    sourceRepository: string
    sourceRevision: string
    sourcePath: string
    license: string
    notice?: string
  }
}
