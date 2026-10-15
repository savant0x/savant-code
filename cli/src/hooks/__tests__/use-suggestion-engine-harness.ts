// Shared harness for the use-suggestion-engine test family.
// Sibling of the Loop 328 decomposition: mirrors the filterFileMatches
// logic so the suite files can exercise matching, prioritization, and
// edge-case behavior directly.

export type FilteredMatch = {
  filePath: string
  pathHighlightIndices?: number[] | null
}

// Helper to simulate the filterFileMatches logic
export const filterFileMatches = (
  filePaths: string[],
  query: string,
): FilteredMatch[] => {
  if (!query) {
    return []
  }

  const normalized = query.toLowerCase()
  const matches: FilteredMatch[] = []
  const seen = new Set<string>()

  const pushUnique = (target: FilteredMatch[], file: FilteredMatch) => {
    if (!seen.has(file.filePath)) {
      target.push(file)
      seen.add(file.filePath)
    }
  }

  const range = (start: number, end?: number) => {
    if (end === undefined) {
      return Array.from({ length: start }, (_, i) => i)
    }
    return Array.from({ length: end - start }, (_, i) => start + i)
  }

  // Check if query contains slashes for path-segment matching
  const querySegments = normalized.split('/')
  const hasSlashes = querySegments.length > 1

  // Helper to match path segments
  const matchPathSegments = (filePath: string): number[] | null => {
    const pathLower = filePath.toLowerCase()
    const highlightIndices: number[] = []
    let searchStart = 0

    for (const segment of querySegments) {
      if (!segment) continue

      const segmentIndex = pathLower.indexOf(segment, searchStart)
      if (segmentIndex === -1) {
        return null
      }

      // Add highlight indices for this segment
      for (let i = 0; i < segment.length; i++) {
        highlightIndices.push(segmentIndex + i)
      }

      searchStart = segmentIndex + segment.length
    }

    return highlightIndices
  }

  // Helper to calculate the longest contiguous match length in the file path
  const calculateContiguousMatchLength = (filePath: string): number => {
    const pathLower = filePath.toLowerCase()
    let maxContiguousLength = 0

    // Try to find the longest contiguous substring that matches the query pattern
    for (let i = 0; i < pathLower.length; i++) {
      let matchLength = 0
      let queryIdx = 0
      let pathIdx = i

      // Try to match as many characters as possible from this position
      while (pathIdx < pathLower.length && queryIdx < normalized.length) {
        if (pathLower[pathIdx] === normalized[queryIdx]) {
          matchLength++
          queryIdx++
          pathIdx++
        } else {
          break
        }
      }

      maxContiguousLength = Math.max(maxContiguousLength, matchLength)
    }

    return maxContiguousLength
  }

  if (hasSlashes) {
    // Slash-separated path matching
    for (const filePath of filePaths) {
      const highlightIndices = matchPathSegments(filePath)
      if (highlightIndices) {
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: highlightIndices,
        })
      }
    }

    // Sort by contiguous match length (longest first)
    matches.sort((a, b) => {
      const aLength = calculateContiguousMatchLength(a.filePath)
      const bLength = calculateContiguousMatchLength(b.filePath)
      return bLength - aLength
    })
  } else {
    // Original logic for non-slash queries

    // Prefix of file name
    for (const filePath of filePaths) {
      const fileName = filePath.split('/').pop() || ''
      const fileNameLower = fileName.toLowerCase()

      if (fileNameLower.startsWith(normalized)) {
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: [
            ...range(
              filePath.lastIndexOf(fileName),
              filePath.lastIndexOf(fileName) + normalized.length,
            ),
          ],
        })
        continue
      }

      const path = filePath.toLowerCase()
      if (path.startsWith(normalized)) {
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: [...range(normalized.length)],
        })
      }
    }

    // Substring of file name or path
    for (const filePath of filePaths) {
      if (seen.has(filePath)) continue
      const path = filePath.toLowerCase()
      const fileName = filePath.split('/').pop() || ''
      const fileNameLower = fileName.toLowerCase()

      const fileNameIndex = fileNameLower.indexOf(normalized)
      if (fileNameIndex !== -1) {
        const actualFileNameStart = filePath.lastIndexOf(fileName)
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: [
            ...range(
              actualFileNameStart + fileNameIndex,
              actualFileNameStart + fileNameIndex + normalized.length,
            ),
          ],
        })
        continue
      }

      const pathIndex = path.indexOf(normalized)
      if (pathIndex !== -1) {
        pushUnique(matches, {
          filePath,
          pathHighlightIndices: [
            ...range(pathIndex, pathIndex + normalized.length),
          ],
        })
      }
    }
  }

  return matches
}
