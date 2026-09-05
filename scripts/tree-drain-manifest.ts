/**
 * tree-drain manifest — ordered commit groups for the 2026-08-27 backlog
 * drain (v0.0.27 → v0.0.28 working tree, 646 changed paths).
 *
 * Each group: { message, paths[] } where paths are repo-relative exact paths
 * or directory prefixes. The runner assigns every changed path to exactly one
 * group and aborts on gaps/overlaps/empty groups. Order = commit order.
 *
 * The group data lives in domain modules under `tree-drain-manifest/`;
 * this file concatenates them in the original commit order.
 */
import { AGENT_RUNTIME_GROUPS } from './tree-drain-manifest/agent-runtime.js'
import { CLIENT_GROUPS } from './tree-drain-manifest/clients.js'
import { FOUNDATION_GROUPS } from './tree-drain-manifest/foundations.js'
import { RECORDS_GROUPS } from './tree-drain-manifest/records.js'

export type DrainGroup = {
  message: string
  paths: string[]
}

export const GROUPS: DrainGroup[] = [
  ...FOUNDATION_GROUPS,
  ...AGENT_RUNTIME_GROUPS,
  ...CLIENT_GROUPS,
  ...RECORDS_GROUPS,
]
