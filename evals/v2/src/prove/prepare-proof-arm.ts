/** Isolated task setup for a paired skill proof. */
import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import path from 'node:path'

import { isValidSkillName } from '@savant-code/common/constants/skills'

import type { Sandbox } from '../sandbox'
import type { TaskDefinition } from '../schema'

/** Both arms receive the same task files; only the active arm sees the skill.
 * An explicit skillsDir excludes home and host project skills. */
export async function prepareProofArm(
  sandbox: Sandbox,
  task: TaskDefinition,
  opts: { projectRoot: string; skillName: string },
  arm: 'baseline' | 'active',
): Promise<string> {
  if (!isValidSkillName(opts.skillName)) throw new Error('Invalid skill name')
  await sandbox.prepare()
  const workingDir = sandbox.getWorkingDir()
  const skillsDir = path.join(workingDir, '.proof-skills')
  await mkdir(skillsDir)
  if (arm === 'active') {
    const quarantined = path.join(
      opts.projectRoot,
      '.agents',
      'skills',
      '.quarantine',
      opts.skillName,
    )
    const trusted = path.join(
      opts.projectRoot,
      '.agents',
      'skills',
      opts.skillName,
    )
    const source = existsSync(path.join(quarantined, 'SKILL.md'))
      ? quarantined
      : trusted
    if (!existsSync(path.join(source, 'SKILL.md')))
      throw new Error(`No skill source for '${opts.skillName}'`)
    await cp(source, path.join(skillsDir, opts.skillName), { recursive: true })
  }
  if (task.environment.setup_files?.length) {
    if (!task.task_dir)
      throw new Error(`Task '${task.task_id}' has setup_files but no task_dir`)
    const taskDir = path.resolve(task.task_dir)
    for (const file of task.environment.setup_files) {
      if (path.isAbsolute(file))
        throw new Error(`setup_files entry is absolute: ${file}`)
      const source = path.resolve(taskDir, file)
      const relative = path.relative(taskDir, source)
      if (relative.startsWith('..') || path.isAbsolute(relative))
        throw new Error(`setup_files entry escapes task directory: ${file}`)
      const destination = path.resolve(workingDir, file)
      await mkdir(path.dirname(destination), { recursive: true })
      await cp(source, destination, { recursive: true })
    }
  }
  if (task.environment.setup_script) {
    const setup = await sandbox.runCommand(task.environment.setup_script, {
      shell: true,
      timeout: task.validation.timeout_seconds * 1000,
    })
    if (setup.exitCode !== 0)
      throw new Error(`Task setup failed: exit ${setup.exitCode}`)
  }
  return skillsDir
}
