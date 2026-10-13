export type LearningScope = 'internal' | 'embedded' | 'release'
export type LearningStatus =
  'active' | 'superseded' | 'historical' | 'needs-review'
export type ReferenceKind = 'symbol' | 'heading' | 'command' | 'test' | 'field'
export type StableReference = {
  raw: string
  path: string
  target: string
  kind: ReferenceKind
  line?: number
}
export type StructuredLearning = {
  title: string
  date: string
  failure: string
  evidence: StableReference[]
  invariant: string
  guard: string
  verification: string
  scope: LearningScope
  owningFids: string[]
  status: LearningStatus
  supersededBy?: string
  canonicalRule?: string
  reproduction?: StableReference[]
  asOf?: string
}
export type LearningIssue = {
  code: string
  message: string
  severity?: 'warning'
}
export type LearningValidationResult = {
  entries: StructuredLearning[]
  issues: LearningIssue[]
}
