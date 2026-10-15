/**
 * Fuzz context matching for the apply_patch parser (FID-2026-0805-003).
 * Extracted from apply-patch/parser.ts verbatim.
 */

export function equalsSlice(
  source: string[],
  target: string[],
  start: number,
  mapFn: (value: string) => string,
): boolean {
  if (start + target.length > source.length) {
    return false
  }

  for (let i = 0; i < target.length; i += 1) {
    if (mapFn(source[start + i]!) !== mapFn(target[i]!)) {
      return false
    }
  }

  return true
}

export function findContextCore(
  lines: string[],
  context: string[],
  start: number,
): { newIndex: number; fuzz: number } {
  if (context.length === 0) {
    return { newIndex: start, fuzz: 0 }
  }

  for (let i = start; i < lines.length; i += 1) {
    if (equalsSlice(lines, context, i, (value) => value)) {
      return { newIndex: i, fuzz: 0 }
    }
  }

  for (let i = start; i < lines.length; i += 1) {
    if (equalsSlice(lines, context, i, (value) => value.trimEnd())) {
      return { newIndex: i, fuzz: 1 }
    }
  }

  for (let i = start; i < lines.length; i += 1) {
    if (equalsSlice(lines, context, i, (value) => value.trim())) {
      return { newIndex: i, fuzz: 100 }
    }
  }

  return { newIndex: -1, fuzz: 0 }
}

export function findContext(
  lines: string[],
  context: string[],
  start: number,
  eof: boolean,
): { newIndex: number; fuzz: number } {
  if (eof) {
    const endStart = Math.max(0, lines.length - context.length)
    const endMatch = findContextCore(lines, context, endStart)
    if (endMatch.newIndex !== -1) {
      return endMatch
    }

    const fallback = findContextCore(lines, context, start)
    return { newIndex: fallback.newIndex, fuzz: fallback.fuzz + 10000 }
  }

  return findContextCore(lines, context, start)
}
