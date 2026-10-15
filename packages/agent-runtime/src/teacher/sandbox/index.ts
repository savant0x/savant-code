/**
 * Teacher sandbox module — FID-2026-0813-013.
 *
 * Public surface: the backend interface, the honest capability report, the
 * policy gate, and the subprocess backend. Consumers depend on the interface,
 * never the concrete spawn details.
 */
export { type SandboxBackend, type SandboxRunInput } from './backend'
export { RESTRICTED_VM_CAPABILITIES, missingCapabilities } from './capabilities'
export {
  RUNNER_VERSION,
  SandboxCancelledError,
  SubprocessSandboxBackend,
  subprocessSandboxBackend,
} from './subprocess'
export { DEFAULT_SANDBOX_POLICY_VERSION, buildSandboxPolicy } from './policy'
