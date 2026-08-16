/**
 * Live teacher exercise session — the `/learn` command's runtime bridge.
 *
 * Owns the single active exercise: the headless engine with the real sandbox
 * and graders, the live ForgeFn, and the bounded event log. The command layer
 * only renders events; this module owns orchestration, cancellation, and the
 * per-attempt ZTAP receipt. Each completed attempt's evidence hashes are signed
 * by an ephemeral, memory-only teacher session key (the honest boundary the
 * teacher guide documents); if key derivation or signing fails the attempt is
 * reported `local-unverified`, never silently upgraded.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import {
  adaptAttemptReceipt,
  behaviorFirstEquivalenceGrader,
  buildPack,
  buildProgressionRecord,
  catalogDetectionGrader,
  deriveCompetencyEdge,
  subprocessSandboxBackend,
  ExerciseEngine,
  ProgressionStore,
} from '@savant-code/agent-runtime/teacher/index'
import {
  createSessionSeed,
  deriveRoleKeypair,
  type RoleKeypair,
} from '@savant-code/common/crypto'

import { getProjectDataDir } from '../project-files'
import { createTeacherForge } from './forge'
import { readProgressFromStore, type TeacherProgressSummary } from './progress'
import { getSeedChallenge } from './seed'

import type {
  SandboxBackend,
  ForgeFn,
  PhaseTransitionListener,
} from '@savant-code/agent-runtime/teacher/index'
import type {
  AttemptEvent,
  AttemptResult,
  CompetencyState,
  CompletionState,
  CritiqueSubmission,
  PublicChallenge,
  TeacherAttemptReceipt,
} from '@savant-code/common/teacher'

type ActiveExercise = {
  engine: ExerciseEngine
  controller: AbortController
  challenge: PublicChallenge
}

let active: ActiveExercise | null = null
let events: AttemptEvent[] = []
let steering = ''
let completionState: CompletionState | null = null
let forgeOverride: ForgeFn | null = null
let sandboxOverride: SandboxBackend | null = null
let teacherKeypair: RoleKeypair | null = null
let sessionReceipt: TeacherAttemptReceipt | null = null
let storeOverride: ProgressionStore | null = null
let persisted = false
let competencyState: CompetencyState | null = null

/** Test seams — dependency injection, never module mocking. */
export function setTeacherForgeOverride(forge: ForgeFn | null): void {
  forgeOverride = forge
}

export function setTeacherSandboxOverride(
  sandbox: SandboxBackend | null,
): void {
  sandboxOverride = sandbox
}

export function setTeacherStoreOverride(store: ProgressionStore | null): void {
  storeOverride = store
}

export type TeacherSessionState = {
  challenge: PublicChallenge | null
  phase: string
  completionState: CompletionState | null
  events: readonly AttemptEvent[]
  steering: string
  attemptId: string | null
  receipt: TeacherAttemptReceipt | null
  persisted: boolean
  competencyState: CompetencyState | null
}

export function getTeacherSessionState(): TeacherSessionState {
  return {
    challenge: active?.challenge ?? null,
    phase: active?.engine.currentPhase ?? 'ready',
    completionState,
    // FID-2026-0813-022: return a snapshot copy. `events` is mutated in place
    // by the engine callback; a live alias would keep the same array identity
    // across snapshots and defeat the sidebar's memoized reducer.
    events: [...events],
    steering,
    attemptId: active?.engine.attemptId ?? null,
    receipt: sessionReceipt,
    persisted,
    competencyState,
  }
}

/** Abort any in-flight run and clear the session (used by cancel and exit). */
export function resetTeacherSession(): void {
  active?.controller.abort()
  active = null
  events = []
  steering = ''
  completionState = null
  teacherKeypair = null
  sessionReceipt = null
  persisted = false
  competencyState = null
}

/** Derive a fresh, memory-only teacher signing key; null on any failure. */
async function deriveTeacherKeypair(): Promise<RoleKeypair | null> {
  try {
    return await deriveRoleKeypair(createSessionSeed(), randomUUID(), 'teacher')
  } catch {
    return null
  }
}

/** Sign a completed attempt's evidence hashes; null when unsigned/unavailable. */
function signAttempt(result: AttemptResult): TeacherAttemptReceipt | null {
  if (!active || !teacherKeypair) return null
  return adaptAttemptReceipt(result, active.challenge, teacherKeypair)
}

/** Open the project-scoped progression store, or null when unavailable. */
function openTeacherStore(): ProgressionStore | null {
  try {
    const dir = getProjectDataDir()
    mkdirSync(dir, { recursive: true })
    return ProgressionStore.open(path.join(dir, 'teacher-progression.sqlite'))
  } catch {
    return null
  }
}

/**
 * Persist a terminal attempt to the local progression store: the immutable
 * attempt record plus the derived competency edge (FID-2026-0813-019).
 * `unavailable` and `cancelled` award no progression and are not recorded.
 * Best-effort — a storage failure never fails the exercise.
 */
function persistAttempt(
  result: AttemptResult,
  receipt: TeacherAttemptReceipt | null,
): void {
  if (!active) return
  if (
    result.completionState === 'cancelled' ||
    result.completionState === 'unavailable'
  ) {
    return
  }
  const record = buildProgressionRecord(result, active.challenge, receipt)
  const store = storeOverride ?? openTeacherStore()
  if (!store) return
  try {
    store.recordAttempt(record)
    const edge = deriveCompetencyEdge(record, store.getCompetency(record.skill))
    if (edge) {
      store.upsertCompetency(edge)
      competencyState = edge.state
    }
    persisted = true
  } catch {
    persisted = false
  } finally {
    if (!storeOverride) store.close()
  }
}

/**
 * Read the local progression store's versioned competency record
 * (FID-2026-0813-019). Read-only: opens the project-scoped store, reads the
 * summary via `readProgressFromStore`, and closes it. Returns `null` when the
 * store is unavailable (no project data dir, or a newer on-disk schema) —
 * never a synthetic empty success. Never mutates progression state.
 */
export function readTeacherProgress(): TeacherProgressSummary | null {
  const store = storeOverride ?? openTeacherStore()
  if (!store) return null
  try {
    return readProgressFromStore(store)
  } finally {
    if (!storeOverride) store.close()
  }
}

/**
 * Start a new exercise attempt. Returns the terminal `AttemptResult` on an
 * early exit (cancelled or unavailable), or `null` once the engine reaches
 * `learner_critique` and is waiting for the learner's critique.
 */
export async function startTeacherExercise(
  steeringText: string,
  opts?: { onEvent?: PhaseTransitionListener },
): Promise<AttemptResult | null> {
  resetTeacherSession()
  steering = steeringText

  const source = getSeedChallenge()
  const { public: pub, private: priv } = buildPack(source)

  // Ephemeral teacher session key (memory-only seed, never persisted).
  teacherKeypair = await deriveTeacherKeypair()

  const controller = new AbortController()
  const engine = new ExerciseEngine({
    challenge: pub,
    pack: priv,
    sandbox: sandboxOverride ?? subprocessSandboxBackend,
    forge: forgeOverride ?? createTeacherForge(),
    equivalence: behaviorFirstEquivalenceGrader,
    detection: catalogDetectionGrader,
    knownGoodSource: source.knownGoodSource,
  })

  engine.onEvent((event) => {
    events.push(event)
    if (event.type === 'result') completionState = event.state
    opts?.onEvent?.(event)
  })

  active = { engine, controller, challenge: pub }
  try {
    const early = await engine.submitSteering(steeringText, {
      signal: controller.signal,
    })
    if (early) {
      completionState = early.completionState
      sessionReceipt = signAttempt(early)
      persistAttempt(early, sessionReceipt)
    }
    return early
  } catch (error) {
    // A live-Forge failure (no auth, model error) is surfaced to the learner
    // as a failed attempt, not a crashed command. Cancellation rethrows so the
    // engine can record `cancelled`; everything else becomes `unavailable`.
    if (controller.signal.aborted) throw error
    completionState = 'unavailable'
    throw error
  }
}

/** Grade the learner's critique, sign the evidence, and finalize the attempt. */
export function submitTeacherCritique(
  critique: CritiqueSubmission,
): AttemptResult {
  if (!active) throw new Error('No active exercise to critique')
  const result = active.engine.submitCritique(critique)
  completionState = result.completionState
  sessionReceipt = signAttempt(result)
  persistAttempt(result, sessionReceipt)
  return result
}

/** Cancel the active attempt (no credit, sandbox workspace cleaned up). */
export function cancelTeacherExercise(): void {
  if (active) {
    active.controller.abort()
    completionState = 'cancelled'
    sessionReceipt = null
    persisted = false
    competencyState = null
  }
}

/** Leave the teacher, restoring chat unchanged and forgetting the exercise. */
export function exitTeacherExercise(): void {
  resetTeacherSession()
}
