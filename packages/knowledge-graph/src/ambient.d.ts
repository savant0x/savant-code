/**
 * Ambient module declarations for assets imported by @savant-code/code-map
 * sources. code-map's own `src/types.ts` provides these, but that file is only
 * pulled into a compilation when code-map's root entry (`index.ts`) is part of
 * the program. This package imports code-map subpaths directly, so the
 * declarations are mirrored here to keep `tsc --noEmit` green.
 */
declare module '*.scm' {
  const content: string
  export default content
}
