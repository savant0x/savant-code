import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, test } from 'bun:test'

import { setProjectRoot, tryGetProjectRoot } from '../../project-files'
import { handleInitializationFlowLocally } from '../init'
import { COMMON_TYPE_FILES } from '../init-type-files'

import type { ChatMessage } from '../../types/chat'

/**
 * `/init` writes `.agents/types/**` into the user's project, and no standing
 * gate resolves that scaffold the way a user project does. These tests run the
 * real command against a real temp directory and pin three properties a
 * customer would otherwise discover by hand: every sibling ships, every
 * relative import resolves inside the scaffold, and the scaffold's external
 * dependency surface stays reviewed — a declaration nobody honors is worse
 * than no declaration (FID-2026-0924-001's audit class).
 */
const repoRoot = path.resolve(import.meta.dir, '../../../..')
const templateDir = path.join(
  repoRoot,
  'common',
  'src',
  'templates',
  'initial-agents-dir',
  'types',
)
const KNOWLEDGE_FILE_NAME = 'knowledge.md'

/**
 * Bare specifiers the scaffold may import. A user project inherits each one as
 * an install requirement, so this list is a ceiling — and it is empty on
 * purpose: the scaffold must compile in a project with no packages installed
 * (SCOPE T87-A, which removed the one entry this list used to carry). Adding a
 * bare import to any template fails this suite.
 */
const REVIEWED_SCAFFOLD_DEPENDENCIES: string[] = []

const messageText = (messages: ChatMessage[]): string =>
  messages
    .map((message) =>
      typeof message.content === 'string' ? message.content : '',
    )
    .join('')

/**
 * Strips comments before scanning: the scaffold's own usage example lives in a
 * doc comment and reads `import ... from './types/agent-definition'`, which a
 * naive scan reports as a dangling edge. The `(^|\s)//` form leaves URLs in
 * string literals intact.
 */
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1')

const specifiersIn = (source: string): string[] =>
  [...codeOnly(source).matchAll(/from ['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  )

const scaffoldDirOf = (project: string): string =>
  path.join(project, '.agents', 'types')

const shippedTemplateFiles = (): string[] =>
  readdirSync(templateDir)
    .filter((name) => name.endsWith('.ts'))
    .sort()

describe('init — .agents/types scaffold end to end', () => {
  const projects: string[] = []
  let previousProjectRoot: string | undefined

  const runInit = (project: string): string => {
    previousProjectRoot = tryGetProjectRoot()
    setProjectRoot(project)
    const { postUserMessage } = handleInitializationFlowLocally()
    return messageText(postUserMessage([]))
  }

  afterEach(() => {
    setProjectRoot(previousProjectRoot ?? process.cwd())
    for (const dir of projects.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('lands every sibling for a fresh project: none skipped, none orphaned', () => {
    const project = mkdtempSync(path.join(os.tmpdir(), 'savant-init-scaffold-'))
    projects.push(project)
    const text = runInit(project)
    const scaffoldDir = scaffoldDirOf(project)

    // The copy table must match the shipped template dir exactly: a template
    // file missing from COMMON_TYPE_FILES is a hub whose sibling never ships.
    const shipped = shippedTemplateFiles()
    expect(COMMON_TYPE_FILES.map(({ fileName }) => fileName).sort()).toEqual(
      shipped,
    )

    for (const { fileName } of COMMON_TYPE_FILES) {
      const written = path.join(scaffoldDir, fileName)
      expect(existsSync(written)).toBe(true)
      expect(readFileSync(written, 'utf8')).toBe(
        readFileSync(path.join(templateDir, fileName), 'utf8'),
      )
      expect(text).toContain(`✅ Copied \`.agents/types/${fileName}\``)
    }

    expect(text).not.toContain('already exists')
    expect(text).not.toContain('⚠️ Failed')
    expect(readdirSync(scaffoldDir).sort()).toEqual(shipped)
    expect(existsSync(path.join(project, KNOWLEDGE_FILE_NAME))).toBe(true)
  })

  test('never clobbers an existing scaffold, so a second run cannot refresh it', () => {
    const project = mkdtempSync(path.join(os.tmpdir(), 'savant-init-scaffold-'))
    projects.push(project)
    runInit(project)
    const scaffoldDir = scaffoldDirOf(project)
    const original = new Map(
      COMMON_TYPE_FILES.map(({ fileName }) => [
        fileName,
        readFileSync(path.join(scaffoldDir, fileName), 'utf8'),
      ]),
    )
    expect(original.size).toBe(COMMON_TYPE_FILES.length)
    // An operator edit must survive the next run — the reason init has no
    // refresh path at all, and why a scaffold that predates a decomposition
    // stays stale until the files are removed by hand.
    writeFileSync(path.join(scaffoldDir, 'tools.ts'), '// operator edit\n')

    const text = runInit(project)

    for (const [fileName, source] of original) {
      expect(text).toContain(`📋 \`.agents/types/${fileName}\` already exists`)
      if (fileName === 'tools.ts') continue
      expect(readFileSync(path.join(scaffoldDir, fileName), 'utf8')).toBe(
        source,
      )
    }
    expect(readFileSync(path.join(scaffoldDir, 'tools.ts'), 'utf8')).toBe(
      '// operator edit\n',
    )
  })

  test('keeps every relative import resolvable inside the generated scaffold', () => {
    const project = mkdtempSync(path.join(os.tmpdir(), 'savant-init-scaffold-'))
    projects.push(project)
    runInit(project)
    const scaffoldDir = scaffoldDirOf(project)
    const generated = new Set(readdirSync(scaffoldDir))

    let edges = 0
    for (const fileName of generated) {
      const source = readFileSync(path.join(scaffoldDir, fileName), 'utf8')
      for (const specifier of specifiersIn(source)) {
        if (!specifier.startsWith('./')) continue
        const dependency = specifier.slice(2)
        expect(
          generated.has(`${dependency}.ts`),
          `${fileName} imports ./${dependency}, which the scaffold does not ship`,
        ).toBe(true)
        edges += 1
      }
    }

    // Guard against a vacuous pass: the scaffold's hubs are nothing but
    // re-exports, so zero detected edges would mean the scan stopped working.
    expect(edges).toBeGreaterThan(0)
  })

  test('imports nothing outside the scaffold beyond the reviewed list', () => {
    const project = mkdtempSync(path.join(os.tmpdir(), 'savant-init-scaffold-'))
    projects.push(project)
    runInit(project)
    const scaffoldDir = scaffoldDirOf(project)

    const scaffoldFiles = readdirSync(scaffoldDir)
    const external = new Set<string>()
    for (const fileName of scaffoldFiles) {
      const source = readFileSync(path.join(scaffoldDir, fileName), 'utf8')
      for (const specifier of specifiersIn(source)) {
        if (!specifier.startsWith('./')) external.add(specifier)
      }
    }

    // Guard against a vacuous pass: the scan must have covered the scaffold.
    expect(scaffoldFiles.length).toBe(COMMON_TYPE_FILES.length)
    for (const specifier of external) {
      expect(REVIEWED_SCAFFOLD_DEPENDENCIES).toContain(specifier)
    }
    expect(external.size).toBe(REVIEWED_SCAFFOLD_DEPENDENCIES.length)
  })
})
