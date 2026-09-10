/**
 * Re-indent the FIRST non-empty line only, leaving every other line
 * untouched. Returns null when there is no non-empty line to rescue.
 * (FID-2026-0910-003 Defect B: the observed emission quirk strips only
 * the first line's leading indent while interior lines stay intact — a
 * uniform re-indent would over-indent the interior and never match.)
 */
function withFirstLineIndent(content: string, indent: string): string | null {
  const lines = content.split('\n')
  const index = lines.findIndex((line) => line !== '')
  if (index === -1) {
    return null
  }
  lines[index] = indent + lines[index]
  return lines.join('\n')
}

export const tryToDoStringReplacementWithExtraIndentation = (params: {
  oldFileContent: string
  searchContent: string
  replaceContent: string
}) => {
  const { oldFileContent, searchContent, replaceContent } = params
  for (let i = 1; i <= 12; i++) {
    const searchContentWithIndentation = searchContent
      .split('\n')
      .map((line) => (line ? ' '.repeat(i) + line : line))
      .join('\n')
    if (oldFileContent.includes(searchContentWithIndentation)) {
      return {
        searchContent: searchContentWithIndentation,
        replaceContent: replaceContent
          .split('\n')
          .map((line) => (line ? ' '.repeat(i) + line : line))
          .join('\n'),
      }
    }
  }
  for (let i = 1; i <= 6; i++) {
    const searchContentWithIndentation = searchContent
      .split('\n')
      .map((line) => (line ? '\t'.repeat(i) + line : line))
      .join('\n')
    if (oldFileContent.includes(searchContentWithIndentation)) {
      return {
        searchContent: searchContentWithIndentation,
        replaceContent: replaceContent
          .split('\n')
          .map((line) => (line ? '\t'.repeat(i) + line : line))
          .join('\n'),
      }
    }
  }
  // FID-2026-0910-003 Defect B: first-line-only re-indent variants. Same
  // scan bounds as the uniform loops (12 spaces / 6 tabs) — the observed
  // quirk is a small-delta class. On match, the same first-line indent is
  // mirrored onto the replacement so the model's indent intent survives.
  for (let i = 1; i <= 12; i++) {
    const indent = ' '.repeat(i)
    const searchVariant = withFirstLineIndent(searchContent, indent)
    if (searchVariant !== null && oldFileContent.includes(searchVariant)) {
      return {
        searchContent: searchVariant,
        replaceContent:
          withFirstLineIndent(replaceContent, indent) ?? replaceContent,
      }
    }
  }
  for (let i = 1; i <= 6; i++) {
    const indent = '\t'.repeat(i)
    const searchVariant = withFirstLineIndent(searchContent, indent)
    if (searchVariant !== null && oldFileContent.includes(searchVariant)) {
      return {
        searchContent: searchVariant,
        replaceContent:
          withFirstLineIndent(replaceContent, indent) ?? replaceContent,
      }
    }
  }
  return null
}
