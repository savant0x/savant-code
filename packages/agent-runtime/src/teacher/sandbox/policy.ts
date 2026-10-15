/**
 * Sandbox policy derivation — FID-2026-0813-014.
 *
 * V1 algorithmic-JavaScript challenges run under a fixed policy that requires
 * only the dimensions the restricted-vm subprocess backend actually enforces.
 * Requiring an unproven OS boundary here would make every challenge fail
 * closed to `unavailable`, so the policy stays within the honest capability
 * report while the backend remains the single source of truth for what is
 * provable.
 */
import type {
  ChallengeLimits,
  SandboxPolicy,
} from '@savant-code/common/teacher'

export const DEFAULT_SANDBOX_POLICY_VERSION = 'teacher-sandbox-policy-v1'

/** Capabilities every V1 challenge requires (all `enforced` by the backend). */
const V1_REQUIRED_CAPABILITIES: SandboxPolicy['required'] = [
  'temp_workspace',
  'stripped_environment',
  'output_cap',
  'timeout',
  'deterministic_runtime',
  'cancellation',
  'cleanup',
]

export function buildSandboxPolicy(limits: ChallengeLimits): SandboxPolicy {
  return {
    policyVersion: DEFAULT_SANDBOX_POLICY_VERSION,
    required: [...V1_REQUIRED_CAPABILITIES],
    limits: {
      timeLimitMs: limits.timeLimitMs,
      maxOutputBytes: limits.maxOutputBytes,
    },
  }
}
