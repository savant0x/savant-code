import type {
  LearningIssue,
  LearningScope,
  LearningStatus,
  StableReference,
  StructuredLearning,
} from './learnings-types.js'

export const LEGACY_BOUNDARY =
  '<!-- Legacy entries below this line are preserved historical prose. -->'
export const LEARNINGS_INSERTION_MARKER =
  '<!-- Add new entries above this line -->'

const REQUIRED_FIELDS = [
  'Date',
  'Failure',
  'Evidence',
  'Invariant',
  'Guard',
  'Verification',
  'Scope',
  'Owning FID',
  'Status',
] as const
const OPTIONAL_FIELDS = [
  'Superseded by',
  'Canonical rule',
  'Reproduction',
  'As of',
] as const
const ALLOWED_FIELDS = new Set<string>([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS])
const FIELD_PATTERN = /^- \*\*([^*]+):\*\*\s*(.*)$/
const FID_PATTERN = /^FID-\d{4}-\d{4}-\d{3}(?:$|[-, ])/
const REFERENCE_PATTERN =
  /^([^→]+)\s*→\s*(symbol|heading|command|test|field):([^@]+?)(?:@line=(\d+))?$/
const DATE_PATTERN = /^([1-9]\d{3})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/

export const makeIssue = (code: string, message: string): LearningIssue => ({
  code,
  message,
})

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseReference(value: string): StableReference | undefined {
  const match = value.trim().match(REFERENCE_PATTERN)
  if (!match?.[1] || !match[2] || !match[3]) return undefined
  return {
    raw: value.trim(),
    path: match[1].trim(),
    kind: match[2] as StableReference['kind'],
    target: match[3].trim(),
    ...(match[4] ? { line: Number(match[4]) } : {}),
  }
}

type ParsedField = { name: string; value: string }
type ParsedFields = { fields: ParsedField[]; malformed: boolean }
function parseFields(block: string): ParsedFields {
  const fields: ParsedField[] = []
  let current: ParsedField | undefined
  let malformed = false
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(FIELD_PATTERN)
    if (match?.[1] && match[2] !== undefined) {
      current = { name: match[1].trim(), value: match[2].trim() }
      fields.push(current)
    } else if (current && line.startsWith('  ')) {
      current.value = `${current.value} ${line.trim()}`.trim()
    } else if (line.trim() && !line.trim().startsWith('<!--')) {
      malformed = true
      current = undefined
    }
  }
  return { fields, malformed }
}

export function parseEntry(
  block: string,
  title: string,
): { entry?: StructuredLearning; issues: LearningIssue[] } {
  const parsedFields = parseFields(block)
  const fields = new Map<string, string>()
  const duplicateFields = new Set<string>()
  const unknownFields = new Set<string>()
  for (const field of parsedFields.fields) {
    if (!ALLOWED_FIELDS.has(field.name)) unknownFields.add(field.name)
    if (fields.has(field.name)) duplicateFields.add(field.name)
    fields.set(field.name, field.value)
  }
  const issues: LearningIssue[] = []
  if (parsedFields.malformed)
    issues.push(
      makeIssue(
        'learning.structure.malformed-prose',
        `${title}: structured lessons may contain only fields, indented continuations, or comments.`,
      ),
    )
  for (const field of unknownFields)
    issues.push(
      makeIssue(
        'learning.field.unknown',
        `${title}: unsupported field ${field}.`,
      ),
    )
  for (const field of duplicateFields)
    issues.push(
      makeIssue(
        'learning.field.duplicate',
        `${title}: field ${field} must appear exactly once.`,
      ),
    )
  for (const field of REQUIRED_FIELDS)
    if (!fields.get(field))
      issues.push(
        makeIssue(
          'learning.field.missing',
          `${title}: missing required field ${field}.`,
        ),
      )
  const date = fields.get('Date') ?? ''
  const scope = fields.get('Scope') as LearningScope | undefined
  const status = fields.get('Status') as LearningStatus | undefined
  if (!DATE_PATTERN.test(date))
    issues.push(
      makeIssue(
        'learning.date.invalid',
        `${title}: Date must use YYYY-MM-DD or YYYY-MM-DD HH:MM.`,
      ),
    )
  if (scope && !['internal', 'embedded', 'release'].includes(scope))
    issues.push(
      makeIssue(
        'learning.scope.invalid',
        `${title}: unsupported Scope ${scope}.`,
      ),
    )
  if (
    status &&
    !['active', 'superseded', 'historical', 'needs-review'].includes(status)
  )
    issues.push(
      makeIssue(
        'learning.status.invalid',
        `${title}: unsupported Status ${status}.`,
      ),
    )
  const evidence = splitList(fields.get('Evidence') ?? '').map(parseReference)
  if (!evidence.length || evidence.some((reference) => !reference))
    issues.push(
      makeIssue(
        'learning.evidence.invalid',
        `${title}: every Evidence item must use path → kind:target syntax.`,
      ),
    )
  const owningFids = splitList(fields.get('Owning FID') ?? '')
  if (owningFids.some((fid) => !FID_PATTERN.test(fid)))
    issues.push(
      makeIssue(
        'learning.fid.invalid',
        `${title}: Owning FID contains an invalid FID identifier.`,
      ),
    )
  const supersededBy = fields.get('Superseded by') || undefined
  const reproduction = fields.has('Reproduction')
    ? splitList(fields.get('Reproduction') ?? '').map(parseReference)
    : undefined
  if (
    reproduction &&
    (!reproduction.length || reproduction.some((reference) => !reference))
  )
    issues.push(
      makeIssue(
        'learning.reproduction.invalid',
        `${title}: Reproduction must use path → kind:target references.`,
      ),
    )
  const asOf = fields.get('As of') || undefined
  if (asOf && (status !== 'historical' || !/^[a-f0-9]{40}$/.test(asOf)))
    issues.push(
      makeIssue(
        'learning.history.invalid',
        `${title}: As of requires a historical lesson and a full commit SHA.`,
      ),
    )
  if (status === 'superseded' && !supersededBy)
    issues.push(
      makeIssue(
        'learning.supersession.missing',
        `${title}: superseded lessons require Superseded by.`,
      ),
    )
  if (issues.some((entry) => entry.code === 'learning.field.missing'))
    return { issues }
  return {
    issues,
    entry: {
      title,
      date,
      failure: fields.get('Failure') ?? '',
      evidence: evidence.filter((reference): reference is StableReference =>
        Boolean(reference),
      ),
      invariant: fields.get('Invariant') ?? '',
      guard: fields.get('Guard') ?? '',
      verification: fields.get('Verification') ?? '',
      scope: scope ?? 'internal',
      owningFids,
      status: status ?? 'needs-review',
      ...(supersededBy ? { supersededBy } : {}),
      ...(reproduction
        ? {
            reproduction: reproduction.filter(
              (reference): reference is StableReference => Boolean(reference),
            ),
          }
        : {}),
      ...(asOf ? { asOf } : {}),
      ...(fields.get('Canonical rule')
        ? { canonicalRule: fields.get('Canonical rule') }
        : {}),
    },
  }
}

export function structuredBlocks(
  content: string,
): Array<{ title: string; block: string }> {
  const boundary = content.indexOf(LEGACY_BOUNDARY)
  const governed = boundary < 0 ? content : content.slice(0, boundary)
  const headings = [...governed.matchAll(/^## Lesson: (.+)$/gm)]
  return headings.map((heading, index) => ({
    title: heading[1]?.trim() ?? 'Untitled lesson',
    block: governed.slice(
      (heading.index ?? 0) + heading[0].length,
      headings[index + 1]?.index ?? governed.length,
    ),
  }))
}

export function parseDate(value: string): number {
  const match = value.match(DATE_PATTERN)
  if (!match) return Number.NaN
  const parts = match
    .slice(1)
    .map((part) => (part === undefined ? undefined : Number(part)))
  const year = parts[0] ?? 0
  const month = parts[1] ?? 1
  const day = parts[2] ?? 1
  const hour = parts[3] ?? 0
  const minute = parts[4] ?? 0
  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute))
  return candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day &&
    candidate.getUTCHours() === hour &&
    candidate.getUTCMinutes() === minute
    ? candidate.getTime()
    : Number.NaN
}
