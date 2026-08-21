import fs from 'fs'
import os from 'os'
import path from 'path'

const agentFileExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

const shouldSkipAgentDirectory = (name: string): boolean =>
  name.startsWith('.') ||
  name === 'node_modules' ||
  name === 'scripts' ||
  name === 'skills' ||
  name.startsWith('skills-')

const isLoadableAgentFileName = (fileName: string): boolean => {
  const extension = path.extname(fileName).toLowerCase()
  return (
    agentFileExtensions.has(extension) &&
    !fileName.endsWith('.d.ts') &&
    !/[./](test|spec)\.[cm]?[tj]sx?$/.test(fileName)
  )
}

// FID-2026-0815-007 (F-10): async recursive walk via fs.promises so the boot
// path never blocks the event loop while `.agents` trees are enumerated.
export const getAllAgentFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = []
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (shouldSkipAgentDirectory(entry.name)) continue
        files.push(...(await getAllAgentFiles(fullPath)))
        continue
      }
      const isAgentFile = entry.isFile() && isLoadableAgentFileName(entry.name)
      if (isAgentFile) {
        files.push(fullPath)
      }
    }
  } catch {
    // Expected for user agent directories that may not exist
  }
  return files
}

export const getDefaultAgentDirs = () => {
  const cwdAgents = path.join(process.cwd(), '.agents')
  const parentAgents = path.join(process.cwd(), '..', '.agents')
  const homeAgents = path.join(os.homedir(), '.agents')
  return [cwdAgents, parentAgents, homeAgents]
}
