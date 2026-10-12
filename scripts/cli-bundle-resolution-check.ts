#!/usr/bin/env bun
/**
 * cli-bundle-resolution-check — the CLI bundle gate, run against a PRISTINE
 * install.
 *
 * This is the root gate contract's `cli-bundle-resolution` label
 * (`scripts/validation-gates.ts`) and the probe that contract invokes. It used
 * to be the bare `bun build cli/src/index.tsx --production --target=bun …`
 * command, which bundles against whatever `node_modules` the machine has. That
 * is exactly how v0.0.35 shipped: a stray `C:\Users\spenc\node_modules` supplied
 * `ajv/dist/2020.js` to an undeclared import, the bundle resolved, every local
 * gate passed, and CI — resolving the committed lockfile, which has only ajv 6 —
 * failed on all five binary jobs after npm had published.
 *
 * So the gate now resolves inside a tree materialized for this run and installed
 * from the frozen lockfile, and reads the bundler's metafile to prove every
 * module it loaded came from that tree. Two fences, both fail-closed:
 * a module resolved outside the tree is a violation (an install the release does
 * not have is doing the work), and a metafile that records no modules is not
 * evidence of anything.
 *
 * The engine (tree materialization, provenance helpers) lives in
 * `./clean-install-bundle`; this file is the sequence and the verdict. It keeps
 * the probe contract — exit 0 clean, non-zero with the bundler's own output —
 * and the scratch tree is removed in a `finally`, including on the red path.
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  BUNDLE_ARGV,
  CLEAN_BUNDLE_ROOT_ENV,
  METAFILE_NAME,
  PREBUNDLE_STEPS,
  collectTreeFiles,
  materializeTree,
  outsideTreeInputs,
  parseMetafileInputs,
  scratchRoot,
  scratchRootProblem,
} from './clean-install-bundle'

const REPO_ROOT = path.resolve(import.meta.dir, '..')
const PASS =
  'cli-bundle-resolution-check PASS — the CLI entry bundles with every import resolved in a pristine install.'
const FAIL = 'cli-bundle-resolution-check FAILED'

/** One spawned command: a label for the headline, argv, and its cwd. */
type Step = { label: string; argv: readonly string[]; cwd: string }

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Remove a tree, tolerating Windows handle-release delay. */
function removeTree(treeRoot: string, swallow: boolean): string | undefined {
  try {
    fs.rmSync(treeRoot, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    })
    return undefined
  } catch (error) {
    if (!swallow) throw error
    return message(error)
  }
}

/** Spawn one step through `process.execPath` (never a PATH-resolved `bun`). */
function run(step: Step): string | undefined {
  const result = Bun.spawnSync([process.execPath, ...step.argv], {
    cwd: step.cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const status = result.exitCode ?? 1
  return status === 0
    ? undefined
    : `${step.label} failed (exit ${status.toString()})`
}

/** The commands this run executes, in order, rooted in the scratch tree. */
function stepsFor(treeRoot: string, metafile: string): Step[] {
  return [
    {
      label: 'bun install --frozen-lockfile --ignore-scripts',
      argv: ['install', '--frozen-lockfile', '--ignore-scripts'],
      cwd: treeRoot,
    },
    ...PREBUNDLE_STEPS.map((step) => ({
      label: `bun ${step.argv.join(' ')}`,
      argv: step.argv,
      cwd: path.join(treeRoot, step.cwd),
    })),
    {
      label: 'bun build cli/src/index.tsx',
      argv: [...BUNDLE_ARGV, `--metafile=${metafile}`],
      cwd: treeRoot,
    },
  ]
}

/**
 * Read the module graph and grade its provenance: every input must live inside
 * the tree the frozen lockfile installed. An input outside it is a resolution
 * the pristine install did not satisfy — the v0.0.35 precondition, named with
 * the file the bundler actually loaded.
 */
function report(treeRoot: string, metafile: string): number {
  let inputs: string[]
  try {
    inputs = parseMetafileInputs(fs.readFileSync(metafile, 'utf8'))
  } catch (error) {
    console.error(
      `${FAIL} — the bundler wrote no readable module graph: ${message(error)}`,
    )
    return 1
  }
  if (inputs.length === 0) {
    console.error(
      `${FAIL} — the module graph recorded no inputs, so a clean resolution is not proven.`,
    )
    return 1
  }
  const outside = outsideTreeInputs(inputs, treeRoot)
  if (outside.length > 0) {
    console.error(
      `${FAIL} — ${outside.length.toString()} module(s) resolved OUTSIDE the pristine install:`,
    )
    for (const input of outside) console.error(`  ${input}`)
    console.error(
      '  Each one resolves from a node_modules the release will not have (an ' +
        'ancestor directory such as the user profile, or a stale local install). ' +
        'Declare the dependency, or stop depending on a resolution the lockfile ' +
        'does not provide.',
    )
    return 1
  }
  console.log(PASS)
  console.log(
    `  ${inputs.length.toString()} modules resolved, all inside the pristine tree.`,
  )
  return 0
}

/** Materialize, install, build the release inputs, bundle, grade provenance. */
function verify(treeRoot: string, files: readonly string[]): number {
  removeTree(treeRoot, false)
  fs.mkdirSync(treeRoot, { recursive: true })
  materializeTree(REPO_ROOT, treeRoot, files)
  const metafile = path.join(treeRoot, METAFILE_NAME)
  for (const step of stepsFor(treeRoot, metafile)) {
    const failure = run(step)
    if (failure !== undefined) {
      console.error(`${FAIL} — ${failure}`)
      return 1
    }
  }
  return report(treeRoot, metafile)
}

function main(): number {
  const treeRoot = scratchRoot()
  const problem = scratchRootProblem(REPO_ROOT, treeRoot)
  if (problem !== undefined) {
    console.error(
      `${FAIL} — ${problem}. Point ${CLEAN_BUNDLE_ROOT_ENV} at a path outside ` +
        'the repository.',
    )
    return 1
  }
  let files: string[]
  try {
    files = collectTreeFiles(REPO_ROOT)
  } catch (error) {
    console.error(
      `${FAIL} — cannot enumerate the release file set: ${message(error)}`,
    )
    return 1
  }
  console.log(
    `cli-bundle-resolution: pristine tree at ${treeRoot} (${files.length.toString()} files)`,
  )
  try {
    return verify(treeRoot, files)
  } finally {
    const leftover = removeTree(treeRoot, true)
    if (leftover !== undefined) {
      console.error(
        `cli-bundle-resolution: could not remove the scratch tree ${treeRoot} — ` +
          `${leftover} (it is outside the repository and safe to delete by hand)`,
      )
    }
  }
}

if (import.meta.main) process.exitCode = main()
