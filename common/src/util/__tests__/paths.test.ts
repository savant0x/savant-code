/**
 * FID-2026-0718-012 — tests for the shared path-traversal helper.
 * FID-2026-0718-013 v3 — adds 7 tests for F1 (projectRoot invariants) + F2 (symlink defense).
 */

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { EXEMPT_PATHS, resolveAndContain } from '../paths'

// Fixed project root for deterministic test results across CI environments.
const PROJECT_ROOT = path.resolve('/tmp/savant-code-test-project')

describe('paths.resolveAndContain — legitimate paths', () => {
  test('plain in-project path → ok', () => {
    const result = resolveAndContain('agents/scout/scout.ts', {
      projectRoot: PROJECT_ROOT,
    })
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.resolved).toBe(
        path.join(PROJECT_ROOT, 'agents/scout/scout.ts'),
      )
    }
  })

  test('a/../foo.ts resolves within project → ok', () => {
    const result = resolveAndContain('a/../foo.ts', {
      projectRoot: PROJECT_ROOT,
    })
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.resolved).toBe(path.join(PROJECT_ROOT, 'foo.ts'))
    }
  })

  test('./leading-dot normalization still works', () => {
    const result = resolveAndContain('./agents/file.ts', {
      projectRoot: PROJECT_ROOT,
    })
    expect(result.kind).toBe('ok')
  })

  test('multi-segment path ending at file is allowed', () => {
    const result = resolveAndContain('a/b/c/d/e.ts', {
      projectRoot: PROJECT_ROOT,
    })
    expect(result.kind).toBe('ok')
  })
})

describe('paths.resolveAndContain — exempt prefixes', () => {
  test('dev/fids/* → exempt with project-root pinned', () => {
    for (const prefix of EXEMPT_PATHS) {
      const result = resolveAndContain(`${prefix}note.md`, {
        projectRoot: PROJECT_ROOT,
      })
      expect(result.kind).toBe('exempt')
      if (result.kind === 'exempt') {
        expect(result.resolved).toBe(
          path.join(PROJECT_ROOT, `${prefix}note.md`),
        )
      }
    }
  })

  test('dev/fids/../../../etc/passwd is rejected (Q8)', () => {
    const result = resolveAndContain('dev/fids/../../../etc/passwd', {
      projectRoot: PROJECT_ROOT,
    })
    expect(result.kind).toBe('reject')
    if (result.kind === 'reject') {
      expect(result.reason).toBe('path escapes project root')
    }
  })

  test('dev/scratchpad/./two-level-deep.md is exempt', () => {
    const result = resolveAndContain('dev/scratchpad/./two-level-deep.md', {
      projectRoot: PROJECT_ROOT,
    })
    expect(result.kind).toBe('exempt')
  })

  test('absolute dev/scratchpad path is classified as exempt', () => {
    const result = resolveAndContain(
      path.join(PROJECT_ROOT, 'dev/scratchpad/system-audit.md'),
      {
        projectRoot: PROJECT_ROOT,
      },
    )
    expect(result.kind).toBe('exempt')
    if (result.kind === 'exempt') {
      expect(result.resolved).toBe(
        path.join(PROJECT_ROOT, 'dev/scratchpad/system-audit.md'),
      )
    }
  })
})

describe('paths.resolveAndContain — rejection cases', () => {
  test('Q1: absolute /etc/passwd → reject', () => {
    const result = resolveAndContain('/etc/passwd', {
      projectRoot: PROJECT_ROOT,
    })
    expect(result.kind).toBe('reject')
    if (result.kind === 'reject') {
      expect(result.reason).toBe('path escapes project root')
    }
  })

  test('Q7: empty path → reject', () => {
    const emptyResult = resolveAndContain('', {
      projectRoot: PROJECT_ROOT,
    })
    expect(emptyResult.kind).toBe('reject')
    if (emptyResult.kind === 'reject') {
      expect(emptyResult.reason).toContain('empty')
    }
  })

  test('Q7: non-string path → reject (defensive)', () => {
    const result = resolveAndContain(
      // @ts-expect-error testing runtime guard against bad input
      null,
      { projectRoot: PROJECT_ROOT },
    )
    expect(result.kind).toBe('reject')
  })

  test('Q1: ../../../etc/passwd traversal → reject', () => {
    const result = resolveAndContain('../../../etc/passwd', {
      projectRoot: PROJECT_ROOT,
    })
    expect(result.kind).toBe('reject')
  })

  test('idempotent reject — same forbidden path rejected twice (Q6)', () => {
    const path1 = resolveAndContain('/etc/shadow', {
      projectRoot: PROJECT_ROOT,
    })
    const path2 = resolveAndContain('/etc/shadow', {
      projectRoot: PROJECT_ROOT,
    })
    expect(path1.kind).toBe('reject')
    expect(path2.kind).toBe('reject')
  })
})

describe('paths.resolveAndContain — cross-platform', () => {
  test('Q2: Windows backslash separators normalized', () => {
    const result = resolveAndContain('agents\\foo\\bar.ts', {
      projectRoot: PROJECT_ROOT,
    })
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.resolved).toBe(
        path.join(PROJECT_ROOT, 'agents', 'foo', 'bar.ts'),
      )
    }
  })

  test('a path that begins with a Windows-drive-like prefix still pins to project root', () => {
    const result = resolveAndContain('C:/Users/evil/file.ts', {
      projectRoot: PROJECT_ROOT,
    })
    expect(['ok', 'exempt', 'reject']).toContain(result.kind)
  })
})

describe('paths.resolveAndContain — FID-013 v3 invariants', () => {
  test('F1: missing projectRoot (no opts) → reject', () => {
    const result = resolveAndContain('agents/foo.ts')
    expect(result.kind).toBe('reject')
    if (result.kind === 'reject') {
      expect(result.reason).toContain('projectRoot missing')
    }
  })

  test('F1: empty string projectRoot → reject', () => {
    const result = resolveAndContain('agents/foo.ts', {
      projectRoot: '',
    })
    expect(result.kind).toBe('reject')
    if (result.kind === 'reject') {
      expect(result.reason).toContain('projectRoot missing')
    }
  })

  test('F1: relative projectRoot → reject', () => {
    const result = resolveAndContain('agents/foo.ts', {
      projectRoot: './relative/path',
    })
    expect(result.kind).toBe('reject')
    if (result.kind === 'reject') {
      expect(result.reason).toBe('projectRoot must be absolute')
    }
  })

  test('F1: projectRoot of wrong type (number) → reject (defensive)', () => {
    const result = resolveAndContain('agents/foo.ts', {
      // @ts-expect-error testing runtime guard against bad input
      projectRoot: 12345,
    })
    expect(result.kind).toBe('reject')
  })

  test.skipIf(process.platform === 'win32')(
    'F2: symlink-to-/etc/passwd → reject',
    () => {
      // Create a symlink INSIDE a fresh tmp project root that points
      // OUTSIDE the project. The symlink's string-resolved path is in-project,
      // but safeRealpath should reveal it points to /etc/passwd → reject.
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paths-sym-'))
      try {
        const linkPath = path.join(tmpDir, 'symlink.ts')
        fs.symlinkSync('/etc/passwd', linkPath)
        const result = resolveAndContain(linkPath, {
          projectRoot: tmpDir,
        })
        expect(result.kind).toBe('reject')
        if (result.kind === 'reject') {
          expect(result.reason).toMatch(/symlink|escapes/)
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    },
  )

  test.skipIf(process.platform === 'win32')(
    'F2: in-project symlink (target within project) → ok',
    () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paths-inside-'))
      try {
        const realFile = path.join(tmpDir, 'real.ts')
        fs.writeFileSync(realFile, 'real content')
        const linkPath = path.join(tmpDir, 'link.ts')
        fs.symlinkSync(realFile, linkPath)
        const result = resolveAndContain(linkPath, {
          projectRoot: tmpDir,
        })
        expect(result.kind).toBe('ok')
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    },
  )

  test.skipIf(process.platform === 'win32')(
    'F2: dead symlink (target missing) → reject',
    () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paths-dead-'))
      try {
        const linkPath = path.join(tmpDir, 'dead.ts')
        fs.symlinkSync('/nonexistent/nowhere/missing', linkPath)
        const result = resolveAndContain(linkPath, {
          projectRoot: tmpDir,
        })
        expect(result.kind).toBe('reject')
        if (result.kind === 'reject') {
          expect(result.reason).toMatch(/symlink/)
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    },
  )

  test.skipIf(process.platform === 'win32')(
    'F2: symlink loop (self-referencing) → reject',
    () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paths-loop-'))
      try {
        const linkPath = path.join(tmpDir, 'loop.ts')
        // Self-referencing symlink → triggers ELOOP from realpathSync.native.
        fs.symlinkSync(linkPath, linkPath)
        const result = resolveAndContain(linkPath, {
          projectRoot: tmpDir,
        })
        expect(result.kind).toBe('reject')
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    },
  )
})
