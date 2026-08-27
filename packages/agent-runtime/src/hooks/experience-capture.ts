import * as fs from 'node:fs'
import * as path from 'node:path'

import { hashUtf8 } from '@savant-code/common/crypto/hash'
import {
  EXPERIENCES_DIR_NAME,
  RAW_TRACES_FILE_NAME,
} from '@savant-code/common/types/experience'
import {
  canonicalToolInput,
  normalizeErrorFirstLine,
} from '@savant-code/common/util/experiences'

import type { HookInputData, HookRunResult } from './types'
import type { ExperienceRecord } from '@savant-code/common/types/experience'

/**
 * FID-2026-0824-012 S1-B — in-process "experience-capture" sink.
 *
 * The capture layer MUST NOT depend on the LLM remembering to log (that is
 * the exact failure class of the OpenClaw skill and Savant's own
 * recorder-stall history). Instead the hooks engine runs this builtin sink
 * deterministically whenever a config-declared `action: experience-capture`
 * hook fires — no per-event process spawn, no prompt compliance required.
 *
 * Contract (fail-open, mirroring the external-command hook contract):
 *   - never throws: a capture failure can never affect execution;
 *   - atomic line-append: each record is one JSON line, appended under a
 *     single write so concurrent sessions cannot interleave partial lines;
 *   - path-normalized keys: Windows `\` vs POSIX `/` spellings of the same
 *     error must produce the same dedup key (canonical rule
 *     `no-environment-dependent-guards`, FID-2026-0823-009 lesson) — the
 *     normalization lives in `common/src/util/experiences.ts` so the sink and
 *     the dedup layer can never disagree;
 *   - context-hashed inputs: raw tool arguments are never persisted (they
 *     may contain credentials); only the sha256 of the canonical JSON is
 *     stored, which is enough to group identical failures.
 */

/** Build one immutable event record from the hook payload. */
export function buildExperienceRecord(input: HookInputData): ExperienceRecord {
  const errorFirstLine = normalizeErrorFirstLine(
    typeof input.error_message === 'string' ? input.error_message : '',
  )
  const toolInput =
    input.tool_input !== undefined ? canonicalToolInput(input.tool_input) : ''
  return {
    ts: new Date().toISOString(),
    triggerType: 'tool_failure',
    toolName: typeof input.tool_name === 'string' ? input.tool_name : '',
    errorFirstLine,
    // sha256 of the canonical JSON (no raw arguments persisted).
    contextHash: toolInput === '' ? '' : hashUtf8(toolInput),
    sessionId: input.session_id,
  }
}

/**
 * Atomic append of one record to `<root>/dev/experiences/raw-traces.jsonl`.
 * Creates the directory on first use. Fail-open: any filesystem error is
 * swallowed and reported on the returned result — never thrown.
 */
export function appendExperienceRecord(
  rootDir: string,
  record: ExperienceRecord,
): HookRunResult {
  try {
    const dir = path.join(rootDir, EXPERIENCES_DIR_NAME)
    const file = path.join(dir, RAW_TRACES_FILE_NAME)
    fs.mkdirSync(dir, { recursive: true })
    const line = `${JSON.stringify(record)}\n`
    fs.appendFileSync(file, line, 'utf8')
    return { outcome: 'allowed' }
  } catch (error) {
    return {
      outcome: 'allowed',
      spawnError:
        error instanceof Error
          ? error.message
          : `capture failed: ${String(error)}`,
    }
  }
}

/** Engine-facing entry: build + append in one step, never throws. */
export function runExperienceCapture(input: HookInputData): HookRunResult {
  return appendExperienceRecord(input.cwd, buildExperienceRecord(input))
}
