/**
 * Skill-management engine — re-export facade (FID-2026-0819-005 Loop 304).
 * Implementation lives in `./skill-management/` (types, paths, helpers,
 * mutations, files, trust). The `@savant-code/common/util/skill-management`
 * specifier resolves to this file (package exports map `./*` -> `./src/*.ts`),
 * so every consumer import stays untouched.
 */
export * from './skill-management/types'
export * from './skill-management/paths'
export * from './skill-management/helpers'
export * from './skill-management/mutations'
export * from './skill-management/files'
export * from './skill-management/trust'
