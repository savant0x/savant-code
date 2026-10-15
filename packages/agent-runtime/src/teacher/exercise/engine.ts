/**
 * Headless exercise engine — FID-2026-0813-014.
 *
 * Owns the exercise lifecycle and evidence; the UI only renders events. Each
 * attempt is immutable (retries create new ids), never touches the user
 * project, and records only hashes — never raw critique text or private pack
 * contents — in the attempt result.
 */
import { hashChange } from '@savant-code/common/crypto'

import { SandboxCancelledError, buildSandboxPolicy } from '../sandbox'
import {
  assertTransition,
  createAttemptId,
  eventTypeForPhase,
  type ExercisePhase,
  type PhaseTransitionListener,
  type TerminalState,
} from './state'

import type { ExerciseDeps } from './grader'
import type {
  AttemptEvent,
  AttemptResult,
  CompletionState,
  CritiqueSubmission,
  DetectionResult,
  EquivalenceResult,
  EvidenceHashes,
  MutationContract,
  SandboxResult,
  TestSummary,
} from '@savant-code/common/teacher'

function emptyTestSummary(): TestSummary {
  return { total: 0, passed: 0, failed: 0, failedNames: [] }
}

function emptyEquivalenceResult(): EquivalenceResult {
  return {
    passed: false,
    testSummary: emptyTestSummary(),
    antiCheat: { passed: true, findings: [] },
    graderVersion: 'unavailable',
  }
}

function emptyDetectionResult(): DetectionResult {
  return {
    mutationId: '',
    grade: {
      mutationId: '',
      identified: false,
      evidenceCoverage: { location: false, witness: false, impact: false },
      locationMatch: false,
      witnessMatch: false,
      impactMatch: false,
      confidence: 0,
      reasonCode: 'uncalibrated',
      graderVersion: 'unavailable',
    },
    graderVersion: 'unavailable',
  }
}

function hashJson(value: unknown): string {
  return hashChange(JSON.stringify(value))
}

export class ExerciseEngine {
  readonly attemptId: string

  private readonly deps: ExerciseDeps
  private phase: ExercisePhase = 'ready'
  private steering = ''
  private solutionSource = ''
  private sandboxResult: SandboxResult | null = null
  private equivalenceResult: EquivalenceResult | null = null
  private detectionResult: DetectionResult | null = null
  private terminal: TerminalState | null = null
  private mutationContract: MutationContract | null = null
  private listeners = new Set<PhaseTransitionListener>()

  constructor(deps: ExerciseDeps) {
    this.deps = deps
    this.attemptId = createAttemptId()
  }

  get currentPhase(): ExercisePhase {
    return this.phase
  }

  get completionState(): TerminalState | null {
    return this.terminal
  }

  /** Subscribe to bounded lifecycle events (read-only, redacted). */
  onEvent(listener: PhaseTransitionListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private now(): string {
    return (this.deps.now ? this.deps.now() : new Date()).toISOString()
  }

  private emit(event: AttemptEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  private transition(to: ExercisePhase): void {
    assertTransition(this.phase, to)
    this.phase = to
    const type = eventTypeForPhase(to)
    if (type) this.emit({ type, timestamp: this.now() } as AttemptEvent)
  }

  private finish(state: TerminalState): AttemptResult {
    this.transition('result')
    this.terminal = state
    this.emit({ type: 'result', timestamp: this.now(), state })
    return this.buildResult(state)
  }

  private buildResult(state: CompletionState): AttemptResult {
    const equivalence = this.equivalenceResult ?? emptyEquivalenceResult()
    const detection = this.detectionResult ?? emptyDetectionResult()
    const evidenceHashes: EvidenceHashes = {
      submissionHash: hashJson(this.solutionSource),
      sandboxResultHash: this.sandboxResult
        ? hashJson(this.sandboxResult)
        : hashJson(null),
      equivalenceHash: hashJson(equivalence),
      detectionHash: hashJson(detection),
    }
    return {
      attemptId: this.attemptId,
      challengeHash: this.deps.challenge.challengeHash,
      // V1 corpus version is the public challenge version; FID-015 introduces
      // an explicit corpus version once packs are content-addressed at build time.
      corpusVersion: String(this.deps.challenge.version),
      sandboxPolicyVersion: buildSandboxPolicy(this.deps.challenge.limits)
        .policyVersion,
      graderVersion: this.deps.pack.gradingVersion,
      equivalenceResult: equivalence,
      detectionResult: detection,
      evidenceHashes,
      completionState: state,
      timestamp: this.now(),
    }
  }

  /** Drive the pipeline through `learner_critique`, awaiting critique input.
   *  Returns the finished `AttemptResult` on an early exit (cancelled or
   *  unavailable), or `null` when the engine is waiting for a critique. */
  async submitSteering(
    steering: string,
    opts?: { signal?: AbortSignal },
  ): Promise<AttemptResult | null> {
    if (this.phase !== 'ready') {
      throw new Error(`cannot submit steering from phase '${this.phase}'`)
    }
    this.steering = steering
    this.transition('steering_submitted')

    try {
      this.transition('forge_running')
      if (opts?.signal?.aborted) return this.finish('cancelled')
      this.solutionSource = await this.deps.forge(steering, this.deps.challenge)

      this.transition('sandbox_running')
      if (opts?.signal?.aborted) return this.finish('cancelled')
      this.sandboxResult = await this.deps.sandbox.run({
        solutionSource: this.solutionSource,
        testsSource: this.deps.pack.hiddenTests,
        policy: buildSandboxPolicy(this.deps.challenge.limits),
        signal: opts?.signal,
      })
      const sandboxResult = this.sandboxResult
      if (sandboxResult.status === 'unavailable') {
        return this.finish('unavailable')
      }

      this.transition('equivalence_review')
      this.equivalenceResult = await this.deps.equivalence.grade({
        solutionSource: this.solutionSource,
        sandboxResult,
        challenge: this.deps.challenge,
        pack: this.deps.pack,
      })

      this.transition('detection_review')
      const injected = this.deps.detection.inject({
        knownGoodSource: this.deps.knownGoodSource,
        pack: this.deps.pack,
      })
      this.mutationContract = injected.mutation

      this.transition('learner_critique')
      return null
    } catch (error) {
      if (error instanceof SandboxCancelledError || opts?.signal?.aborted) {
        return this.finish('cancelled')
      }
      throw error
    }
  }

  /** Grade the learner critique and finalize the attempt. */
  submitCritique(critique: CritiqueSubmission): AttemptResult {
    if (this.phase !== 'learner_critique') {
      throw new Error(`cannot submit critique from phase '${this.phase}'`)
    }
    this.transition('adjudication')

    if (this.mutationContract) {
      this.detectionResult = this.deps.detection.grade({
        critique,
        mutation: this.mutationContract,
        rubric: this.deps.pack.critiqueRubric,
      })
    }

    const state = this.computeTerminal()
    return this.finish(state)
  }

  private computeTerminal(): TerminalState {
    if (this.terminal) return this.terminal
    if (this.sandboxResult?.status === 'unavailable') return 'unavailable'
    const equivalencePassed = this.equivalenceResult?.passed ?? false
    const detected = this.detectionResult?.grade.identified ?? false
    return equivalencePassed && detected ? 'passed' : 'failed'
  }

  /** Convenience: full headless run with steering + critique. */
  async run(
    steering: string,
    critique: CritiqueSubmission,
    opts?: { signal?: AbortSignal },
  ): Promise<AttemptResult> {
    const early = await this.submitSteering(steering, opts)
    if (early) return early
    return this.submitCritique(critique)
  }
}
