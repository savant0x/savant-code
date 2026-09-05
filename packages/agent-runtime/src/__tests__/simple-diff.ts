// FID-2026-0819-005 Loop 189: the unified-diff test generator, extracted
// verbatim from propose-tools-fixture.ts so the fixture module can stay under
// the size ceiling. In production, the actual handlers use the 'diff' library.

export function generateSimpleDiff(
  path: string,
  oldContent: string,
  newContent: string,
): string {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  const diffLines: string[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)

  let inChange = false
  let _changeStart = 0

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]

    if (oldLine !== newLine) {
      if (!inChange) {
        inChange = true
        _changeStart = i
        diffLines.push(
          `@@ -${i + 1},${oldLines.length - i} +${i + 1},${newLines.length - i} @@`,
        )
      }
      if (oldLine !== undefined) {
        diffLines.push(`-${oldLine}`)
      }
      if (newLine !== undefined) {
        diffLines.push(`+${newLine}`)
      }
    } else if (inChange && oldLine === newLine) {
      diffLines.push(` ${oldLine}`)
    }
  }

  return diffLines.join('\n')
}
