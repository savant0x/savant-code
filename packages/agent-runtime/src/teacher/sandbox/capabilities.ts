/**
 * Sandbox capability report + policy gate — FID-2026-0813-013.
 *
 * The V1 backend is a restricted `node:vm` context inside a subprocess. It
 * genuinely enforces the process-level and language-level dimensions listed as
 * `enforced`; the OS-boundary dimensions are reported `not_enforced` because
 * language-level isolation is not a mathematical OS security boundary. Any
 * challenge whose policy requires a `not_enforced` dimension fails closed.
 */
import type {
  CapabilityDimension,
  CapabilityReport,
  SandboxPolicy,
} from '@savant-code/common/teacher'

export const RESTRICTED_VM_CAPABILITIES: CapabilityReport = {
  temp_workspace: 'enforced',
  no_project_access: 'not_enforced',
  no_corpus_access: 'not_enforced',
  no_home_access: 'not_enforced',
  no_network: 'not_enforced',
  stripped_environment: 'enforced',
  no_child_process: 'not_enforced',
  no_native_modules: 'not_enforced',
  output_cap: 'enforced',
  timeout: 'enforced',
  deterministic_runtime: 'enforced',
  path_traversal_containment: 'not_enforced',
  symlink_containment: 'not_enforced',
  cancellation: 'enforced',
  cleanup: 'enforced',
}

/** The capabilities a policy requires that the backend does not enforce. */
export function missingCapabilities(
  policy: SandboxPolicy,
  report: CapabilityReport,
): CapabilityDimension[] {
  return policy.required.filter((dimension) => report[dimension] !== 'enforced')
}
