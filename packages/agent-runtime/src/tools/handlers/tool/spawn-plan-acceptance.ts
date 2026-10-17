import { sha256 } from '@savant-code/common/util/hash'

import { canonicalJson, normalizePlanPath } from './spawn-plan'

import type { SpawnPlanStep } from './spawn-plan'
import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * FID-2026-1017-004 — host acceptance for a research plan step.
 *
 * A child's prose never decides acceptance. The only evidence is what the
 * child's own history proves: the `read_files` results whose bytes match the
 * pinned source, and the predecessor artifact block the host injected.
 */

export type SourceReadObservation = {
  /** Sources whose observed content matches the captured bytes. */
  verified: Set<string>
  /** Sources that were read but returned different bytes. */
  mismatched: Set<string>
}

function projectRelativePath(
  value: string,
  projectRoot: string,
): string | null {
  const slashed = value.replaceAll('\\', '/')
  const root = projectRoot.replaceAll('\\', '/').replace(/\/+$/, '')
  const stripped = slashed.startsWith(`${root}/`)
    ? slashed.slice(root.length + 1)
    : slashed
  return normalizePlanPath(stripped.replace(/^\.\//, ''))
}

/**
 * Walk the child's tool history for successful `read_files` results and
 * compare the observed bytes with the captured source bytes. A requested read
 * is not evidence; only a tool result that carries matching content is.
 */
export function observeSourceReads(
  messages: readonly Message[],
  sources: ReadonlyMap<string, string>,
  projectRoot: string,
): SourceReadObservation {
  const verified = new Set<string>()
  const mismatched = new Set<string>()
  for (const message of messages) {
    if (message.role !== 'tool' || message.toolName !== 'read_files') continue
    for (const part of message.content) {
      if (part.type !== 'json' || !Array.isArray(part.value)) continue
      for (const entry of part.value) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
          continue
        const path = (entry as Record<string, JSONValue>)['path']
        const content = (entry as Record<string, JSONValue>)['content']
        if (typeof path !== 'string' || typeof content !== 'string') continue
        const relative = projectRelativePath(path, projectRoot)
        if (relative === null) continue
        const expected = sources.get(relative)
        if (expected === undefined) continue
        if (
          content.replaceAll('\r\n', '\n') === expected.replaceAll('\r\n', '\n')
        ) {
          verified.add(relative)
        } else {
          mismatched.add(relative)
        }
      }
    }
  }
  return { verified, mismatched }
}

/** The host-authored block a dependent step receives for one predecessor. */
export function buildArtifactBlock(params: {
  stepId: string
  digest: string
  artifact: JSONValue
}): string {
  return [
    `<research_plan_artifact step="${params.stepId}" digest="${params.digest}">`,
    canonicalJson(params.artifact),
    '</research_plan_artifact>',
  ].join('\n')
}

export function artifactDigest(value: JSONValue): string {
  return sha256(canonicalJson(value))
}

function historyContainsText(
  messages: readonly Message[],
  text: string,
): boolean {
  return messages.some((message) =>
    message.content.some(
      (part) => part.type === 'text' && part.text.includes(text),
    ),
  )
}

/**
 * Acceptance issues for one completed step. Empty means accepted; every
 * non-empty reason is host-derived and is surfaced instead of the report.
 */
export function checkStepAcceptance(params: {
  step: Pick<SpawnPlanStep, 'id' | 'sources' | 'dependsOn'>
  messages: readonly Message[]
  sources: ReadonlyMap<string, string>
  projectRoot: string
  artifactBlocks: ReadonlyMap<string, string>
}): string[] {
  const { step, messages, sources, projectRoot, artifactBlocks } = params
  const issues: string[] = []
  const reads = observeSourceReads(messages, sources, projectRoot)

  for (const source of step.sources) {
    if (reads.mismatched.has(source)) {
      issues.push(`Source read does not match the pinned bytes: ${source}`)
      continue
    }
    if (!reads.verified.has(source)) {
      issues.push(`Missing verified source read: ${source}`)
    }
  }

  for (const dependency of step.dependsOn) {
    const block = artifactBlocks.get(dependency)
    if (block === undefined) {
      issues.push(`Missing predecessor artifact: ${dependency}`)
      continue
    }
    if (!historyContainsText(messages, block)) {
      issues.push(`Predecessor artifact was not delivered: ${dependency}`)
    }
  }

  return issues
}
