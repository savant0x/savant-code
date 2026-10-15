import fs from 'node:fs'
import path from 'node:path'

import {
  getDefaultDesignSystemResource,
  loadDesignManifest,
  resolveActiveDesignSystem,
  resolveEmbeddedDesignSystem,
  toDesignContract,
  validateDesignAuthoringInput,
  type ActiveDesignSystem,
  type DesignSystemResource,
} from '@savant-code/design-systems'

import {
  listCustomDesignSystems,
  resolveCustomInScope,
} from './design-system-custom'
import {
  customRoot,
  DESIGN_SYSTEM_ID,
  projectRootOrCwd,
} from './design-system-roots'
import { loadSettings, saveSettings } from './settings'
import { writeFileAtomic } from './write-file-atomic'

function candidateSkillRoots(): string[] {
  const executableDir = path.dirname(process.execPath)
  const sourceRoot = path.resolve(
    import.meta.dir,
    '../../../.agents/skills/savant-design-systems',
  )
  const projectRoot = projectRootOrCwd()
  const home = process.env.HOME ?? process.env.USERPROFILE
  return [
    sourceRoot,
    path.join(projectRoot, '.agents', 'skills', 'savant-design-systems'),
    path.join(executableDir, 'savant-design-systems'),
    path.join(executableDir, 'resources', 'savant-design-systems'),
    ...(home
      ? [path.join(home, '.agents', 'skills', 'savant-design-systems')]
      : []),
  ]
}

function findSkillRoot(): string {
  const root = candidateSkillRoots().find((candidate) =>
    fs.existsSync(path.join(candidate, 'manifest.json')),
  )
  if (!root) {
    throw new Error(
      'The savant-design-systems skill is unavailable. Reinstall the CLI or restore its packaged resources.',
    )
  }
  return root
}

function manifest() {
  return loadDesignManifest(path.join(findSkillRoot(), 'manifest.json'))
}

export function resolveBuiltIn(id: string): DesignSystemResource | undefined {
  if (!DESIGN_SYSTEM_ID.test(id)) return undefined
  const currentManifest = manifest()
  if (!currentManifest.resources.some((item) => item.id === id))
    return undefined
  return resolveEmbeddedDesignSystem({
    skillRoot: findSkillRoot(),
    manifest: currentManifest,
    id,
  })
}

export function resolveDesignSystemInScope(
  scope: 'project' | 'user' | 'embedded',
  id: string,
): DesignSystemResource | undefined {
  if (scope === 'embedded') {
    return id === 'savant-cyberpunk'
      ? getDefaultDesignSystemResource()
      : resolveBuiltIn(id)
  }
  return resolveCustomInScope(scope, id)
}

export function resolveDesignSystem(
  id: string,
): DesignSystemResource | undefined {
  if (id === 'savant-cyberpunk') return getDefaultDesignSystemResource()
  return (
    resolveDesignSystemInScope('project', id) ??
    resolveDesignSystemInScope('user', id)
  )
}

export function listDesignSystems(): DesignSystemResource[] {
  const builtIns = manifest()
    .resources.map((entry) => resolveBuiltIn(entry.id))
    .filter((item): item is DesignSystemResource => Boolean(item))
  return [
    getDefaultDesignSystemResource(),
    ...builtIns.filter((item) => item.id !== 'savant-cyberpunk'),
    ...listCustomDesignSystems(),
  ]
}

export function getDesignSystemSelection(): {
  project?: string
  user?: string
} {
  const settings = loadSettings()
  const projectSelectionPath = path.join(
    customRoot('project'),
    'selection.json',
  )
  let project: string | undefined
  if (fs.existsSync(projectSelectionPath)) {
    try {
      const parsed = JSON.parse(
        fs.readFileSync(projectSelectionPath, 'utf8'),
      ) as { id?: unknown }
      if (typeof parsed.id === 'string' && DESIGN_SYSTEM_ID.test(parsed.id))
        project = parsed.id
    } catch {
      throw new Error(
        'Project design-system selection is corrupt; run /design reset --project.',
      )
    }
  }
  return { project, user: settings.designSystemUser }
}

function setProjectSelection(id: string | undefined): void {
  const root = customRoot('project')
  if (id === undefined) {
    const selectionPath = path.join(root, 'selection.json')
    if (fs.existsSync(selectionPath)) fs.rmSync(selectionPath)
    return
  }
  fs.mkdirSync(root, { recursive: true })
  writeFileAtomic(
    path.join(root, 'selection.json'),
    `${JSON.stringify({ id }, null, 2)}\n`,
  )
}

export function setDesignSystemSelection(
  scope: 'project' | 'user',
  id: string,
): void {
  const resource =
    scope === 'project' || scope === 'user'
      ? (resolveDesignSystemInScope(scope, id) ?? resolveBuiltIn(id))
      : resolveDesignSystem(id)
  if (!resource)
    throw new Error(`Cannot activate unavailable design system: ${id}`)
  if (scope === 'project') {
    setProjectSelection(resource.id)
  } else {
    saveSettings({ designSystemUser: resource.id })
  }
}

export function resetDesignSystemSelection(
  scope: 'project' | 'user' | 'all' = 'all',
): void {
  if (scope === 'project' || scope === 'all') setProjectSelection(undefined)
  if (scope === 'user' || scope === 'all')
    saveSettings({ designSystemUser: undefined })
}

export function resolveCurrentDesignSystem(
  session?: string,
): ActiveDesignSystem {
  const selection = getDesignSystemSelection()
  return resolveActiveDesignSystem({
    selection: { session, project: selection.project, user: selection.user },
    resolve: resolveDesignSystem,
    resolveScoped: (scope, id) =>
      scope === 'session'
        ? resolveDesignSystem(id)
        : scope === 'project' || scope === 'user'
          ? (resolveDesignSystemInScope(scope, id) ??
            (scope === 'project' || scope === 'user'
              ? resolveBuiltIn(id)
              : undefined))
          : resolveDesignSystem(id),
  })
}

export function getActiveDesignContract() {
  return toDesignContract(resolveCurrentDesignSystem())
}

export function validateDesignInput(input: unknown) {
  return validateDesignAuthoringInput(input)
}
