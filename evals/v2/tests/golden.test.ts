import { existsSync } from 'node:fs'
import { writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, it, expect } from 'bun:test'

import { applyGoldenPatchText } from '../src/golden'
import { TempDirSandbox } from '../src/sandboxes/tempdir'

describe('applyGoldenPatchText', () => {
  it('applies a simple unified diff to a file', async () => {
    const sandbox = new TempDirSandbox({ prefix: 'golden-test-' })
    await sandbox.prepare()

    try {
      const workingDir = sandbox.getWorkingDir()
      const filePath = path.join(workingDir, 'hello.txt')
      await writeFile(filePath, 'Hello World\n', 'utf-8')

      const patch = `--- hello.txt
+++ hello.txt
@@ -1 +1 @@
-Hello World
+Hello Savant
`

      await applyGoldenPatchText(sandbox, patch)
      const content = await readFile(filePath, 'utf-8')
      expect(content).toBe('Hello Savant\n')
    } finally {
      await sandbox.teardown()
    }
  })

  it('creates a new file from an addition patch', async () => {
    const sandbox = new TempDirSandbox({ prefix: 'golden-test-' })
    await sandbox.prepare()

    try {
      const workingDir = sandbox.getWorkingDir()
      const filePath = path.join(workingDir, 'new.txt')

      const patch = `--- /dev/null
+++ new.txt
@@ -0,0 +1 @@
+created by patch
`

      await applyGoldenPatchText(sandbox, patch)
      const content = await readFile(filePath, 'utf-8')
      expect(content).toBe('created by patch\n')
    } finally {
      await sandbox.teardown()
    }
  })

  it('deletes a file from a deletion patch', async () => {
    const sandbox = new TempDirSandbox({ prefix: 'golden-test-' })
    await sandbox.prepare()

    try {
      const workingDir = sandbox.getWorkingDir()
      const filePath = path.join(workingDir, 'remove.txt')
      await writeFile(filePath, 'goodbye\n', 'utf-8')

      const patch = `--- remove.txt
+++ /dev/null
@@ -1 +0,0 @@
-goodbye
`

      await applyGoldenPatchText(sandbox, patch)
      expect(existsSync(filePath)).toBe(false)
    } finally {
      await sandbox.teardown()
    }
  })

  it('throws when the file does not match the expected pre-image', async () => {
    const sandbox = new TempDirSandbox({ prefix: 'golden-test-' })
    await sandbox.prepare()

    try {
      const workingDir = sandbox.getWorkingDir()
      await writeFile(
        path.join(workingDir, 'hello.txt'),
        'Wrong Content\n',
        'utf-8',
      )

      const patch = `--- hello.txt
+++ hello.txt
@@ -1 +1 @@
-Hello World
+Hello Savant
`
      expect(applyGoldenPatchText(sandbox, patch)).rejects.toThrow(
        'golden patch',
      )
    } finally {
      await sandbox.teardown()
    }
  })
})
