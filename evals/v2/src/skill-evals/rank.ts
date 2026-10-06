/**
 * Tier-2 skill trigger/routing ranking (FID-2026-1005-005).
 *
 * Deterministic, zero-model-call lexical ranking over skill metadata —
 * stemmed TF-IDF with cosine similarity, the reference design's Tier-2
 * approximation ("stemmed TF-IDF over descriptions"). It catches the two
 * dominant trigger bugs: a description missing the vocabulary users
 * actually say, and a description so broad it collides with a sibling.
 * Judging semantics is the behavioral tier's job (`runSkillProve`), not
 * this one — the limit is explicit, not hidden behind the score.
 *
 * Pure module: no I/O, no model calls. Same input, same ranking (ties
 * break by skill name so runs are reproducible).
 */

/** The fixed stopword list — small, closed, documented. */
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'for',
  'with',
  'without',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'from',
  'into',
  'if',
  'is',
  'are',
  'be',
  'been',
  'as',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'you',
  'your',
  'use',
  'used',
  'using',
  'when',
  'how',
  'what',
  'which',
  'who',
  'do',
  'does',
  'can',
  'could',
  'should',
  'would',
  'will',
  'not',
  'no',
  'my',
  'our',
  'i',
  'we',
  'they',
  'their',
  'them',
  'there',
  'here',
  'over',
  'under',
])

/**
 * Crude suffix stem (the reference's documented lexical approximation):
 * strip `-ing`, `-ed`, `-s` when what remains is still meaningful
 * (≥ 4 chars). Deliberately NOT a real stemmer — Law 7 verified the tree
 * has none, and edit distance answers a different question.
 */
function crudeStem(token: string): string {
  for (const suffix of ['ing', 'ed', 'es', 's'] as const) {
    if (token.length - suffix.length >= 4 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length)
    }
  }
  return token
}

/**
 * Tokenize: lowercase, split on non-alphanumerics and camelCase
 * boundaries, drop stopwords, crude-stem the rest.
 */
export function tokenize(text: string): string[] {
  const camelSplit = text.replace(/([a-z])([A-Z])/g, '$1 $2')
  const tokens: string[] = []
  for (const raw of camelSplit.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw === '' || STOPWORDS.has(raw)) continue
    tokens.push(crudeStem(raw))
  }
  return tokens
}

/** One skill's routing metadata: the tokens the loader exposes per turn. */
export interface SkillMetadataDoc {
  /** Skill directory name (also the tie-break key). */
  name: string
  /** Frontmatter name — usually identical to `name`. */
  frontmatterName?: string
  /** Frontmatter description. */
  description: string
}

/** A weighted TF vector over corpus terms. */
type TfVector = Map<string, number>

function termCounts(tokens: string[]): TfVector {
  const counts: TfVector = new Map()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return counts
}

/**
 * Build the corpus: one vector per skill from name tokens (weighted ×2)
 * + description tokens, with smoothed idf so unseen terms never zero out.
 */
export interface SkillCorpus {
  docs: { name: string; weights: TfVector }[]
  idf: (term: string) => number
}

export function buildCorpus(
  skills: readonly SkillMetadataDoc[],
  opts: { nameWeight?: number } = {},
): SkillCorpus {
  // Routing uses weight 2 (name tokens count double); the collision check
  // uses weight 0 — pure description vectors, so unavoidable prefix-name
  // overlap cannot mask description drift (the reference collision signal).
  const nameWeight = opts.nameWeight ?? 2
  const docTokens = skills.map((skill) => {
    const nameTokens = [
      ...tokenize(skill.name),
      ...tokenize(skill.frontmatterName ?? skill.name),
    ]
    const repeated: string[] = []
    for (let i = 0; i < nameWeight; i++) repeated.push(...nameTokens)
    return [...repeated, ...tokenize(skill.description)]
  })

  const df = new Map<string, number>()
  for (const tokens of docTokens) {
    for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1)
  }
  const n = skills.length
  const idf = (term: string): number =>
    Math.log((n + 1) / ((df.get(term) ?? 0) + 1)) + 1

  const docs = skills.map((skill, i) => ({
    name: skill.name,
    weights: termCounts(docTokens[i]),
  }))
  return { docs, idf }
}

function cosine(a: TfVector, b: TfVector, idf: (t: string) => number): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (const [term, count] of a) {
    const w = count * idf(term)
    normA += w * w
    const other = b.get(term)
    if (other !== undefined) dot += w * other * idf(term)
  }
  for (const [term, count] of b) {
    const w = count * idf(term)
    normB += w * w
  }
  if (normA === 0 || normB === 0) return 0
  return dot / Math.sqrt(normA * normB)
}

/** One ranked result. */
export interface RankedSkill {
  name: string
  score: number
  /** 1-based rank position. */
  rank: number
}

/**
 * Rank every corpus skill against one prompt. Deterministic: descending
 * score, ties broken by skill name ascending.
 */
export function rankSkills(prompt: string, corpus: SkillCorpus): RankedSkill[] {
  const promptTokens = tokenize(prompt)
  const promptVector = termCounts(promptTokens)
  const scored = corpus.docs.map((doc) => ({
    name: doc.name,
    score: cosine(promptVector, doc.weights, corpus.idf),
  }))
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return scored.map((entry, i) => ({
    name: entry.name,
    score: entry.score,
    rank: i + 1,
  }))
}

/** Cosine between two skills' metadata vectors (the collision check). */
export function skillCollision(
  a: SkillMetadataDoc,
  b: SkillMetadataDoc,
  corpus: SkillCorpus,
): number {
  const docA = corpus.docs.find((doc) => doc.name === a.name)
  const docB = corpus.docs.find((doc) => doc.name === b.name)
  if (docA === undefined || docB === undefined) return 0
  return cosine(docA.weights, docB.weights, corpus.idf)
}
