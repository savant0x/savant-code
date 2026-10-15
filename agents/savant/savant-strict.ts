import { createSavant } from './savant'

// FID-2026-0805-001: STRICT mode agent. Runs the full ECHO Perfection Loop
// for every code change — FID per change (Recorder), RED (Detective),
// GREEN (Forge writes), AUDIT (Verifier), archive (Recorder).
//
// NOTE: enforcement is prompt-contract + FID-009 harness warnings at `warn`
// level — this agent still has write_file/str_replace/apply_patch (FSM-gated)
// so a determined model could write directly. Hard `block` mode is deferred
// future work (FID-009); do not assume the prohibition is mechanical.
const definition = {
  ...createSavant('default', { strictMode: true }),
  id: 'savant-strict',
  displayName: 'Savant the Ceremony Orchestrator',
  spawnerPrompt:
    'Full-ceremony agent. Every code change runs the complete ECHO Perfection Loop: FID per change (Recorder), RED (Detective) → GREEN (Forge) → AUDIT (Verifier). No direct writes, no phase skipping, no self-verification.',
}

export default definition
