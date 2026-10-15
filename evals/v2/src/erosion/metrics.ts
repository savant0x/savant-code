/**
 * FID-2026-0824-018 — pure erosion metrics (increment 4).
 *
 * Deterministic and unit-testable by design: no I/O, no clock, no runner
 * coupling. The input shape (`FileStat`) MIRRORS `@savant-code/code-map`
 * primitives (`ParsedTokens` line/identifier counts + `TokenCallerMap`
 * fan-in) WITHOUT importing the package — the evals runtime stays hermetic;
 * a runner-level adapter feeds real code-map output where the package is
 * already loaded (reuse boundary recorded in the -018 loop history).
 *
 * Metrics are DIRECTIONAL vectors only (amendment A4): they inform the
 * operator's trust decision at `/skills trust`; they never auto-block
 * writes.
 */

/** Per-file structural statistics (code-map-shaped). */
export interface FileStat {
  path: string
  numLines: number
  identifierCount: number
  /** Highest caller count of any symbol defined in this file. */
  maxFanIn: number
  /** Mean caller count across this file's called symbols. */
  meanFanIn: number
  /** Decision points (if/for/while/case/catch/&&/||/??) in file source. */
  decisionCount: number
}

/** Aggregated erosion snapshot for one prove-run arm's changed set. */
export interface ErosionSnapshot {
  fileCount: number
  totalLines: number
  meanVolumeRatio: number
  maxCyclomaticEstimate: number
  couplingConcentration: number
}

/** Verbosity signal: generated volume per functional identifier (bloat ↑). */
export function volumeRatio(numLines: number, identifierCount: number): number {
  return Math.max(0, numLines) / (Math.max(0, identifierCount) + 1)
}

/**
 * Cyclomatic complexity ESTIMATE over the standard decision-point formula
 * (decisions + 1). Text-based and deterministic — deliberately NOT
 * tree-sitter CC (spec clause: zero new AST machinery).
 */
export function cyclomaticEstimate(decisionCount: number): number {
  return Math.max(0, decisionCount) + 1
}

/** Complexity concentration: peak fan-in relative to mean fan-in (+1 floor). */
export function couplingConcentration(
  maxFanIn: number,
  meanFanIn: number,
): number {
  return Math.max(0, maxFanIn) / (Math.max(0, meanFanIn) + 1)
}

/** Aggregate one arm's files into an erosion snapshot (zeros when empty). */
export function snapshotErosion(files: readonly FileStat[]): ErosionSnapshot {
  if (files.length === 0) {
    return {
      fileCount: 0,
      totalLines: 0,
      meanVolumeRatio: 0,
      maxCyclomaticEstimate: 0,
      couplingConcentration: 0,
    }
  }
  let totalLines = 0
  let ratioSum = 0
  let maxCyclomatic = 0
  let maxFanIn = 0
  let fanInSum = 0
  for (const file of files) {
    totalLines += Math.max(0, file.numLines)
    ratioSum += volumeRatio(file.numLines, file.identifierCount)
    maxCyclomatic = Math.max(
      maxCyclomatic,
      cyclomaticEstimate(file.decisionCount),
    )
    maxFanIn = Math.max(maxFanIn, file.maxFanIn)
    fanInSum += Math.max(0, file.meanFanIn)
  }
  return {
    fileCount: files.length,
    totalLines,
    meanVolumeRatio: round2(ratioSum / files.length),
    maxCyclomaticEstimate: maxCyclomatic,
    couplingConcentration: round2(
      couplingConcentration(maxFanIn, fanInSum / files.length),
    ),
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
