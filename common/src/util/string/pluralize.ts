// Irregular plurals that cannot be derived from rules
// Note: -sis → -ses words are handled by rule, not listed here
const IRREGULAR_PLURALS: Record<string, string> = {
  // Common English irregulars
  person: 'people',
  child: 'children',
  man: 'men',
  woman: 'women',
  mouse: 'mice', // computer mice
  // Tech terms with -ex/-ix → -ices (no reliable rule)
  index: 'indices',
  vertex: 'vertices',
  matrix: 'matrices',
  appendix: 'appendices',
  // Latin -um → -a (too many exceptions like forum→forums for a rule)
  datum: 'data',
  medium: 'media',
  criterion: 'criteria',
  phenomenon: 'phenomena',
  // Latin -us → -i (too many exceptions like bus→buses for a rule)
  stimulus: 'stimuli',
  radius: 'radii',
  focus: 'foci',
  cactus: 'cacti',
  nucleus: 'nuclei',
  syllabus: 'syllabi',
}

// Words that stay the same in plural (only those not derivable from rules)
// Note: -ware words and -ics words are handled by rules, not listed here
const UNCHANGING_PLURALS = new Set([
  // Uncountable/mass nouns in tech
  'data', // already plural of datum, but often used as uncountable
  'metadata',
  'info',
  'feedback',
  'news',
  // Words ending in -s that don't change
  'series',
  'species',
  'chassis',
  'corps',
  'means',
])

// Words ending in -f that just add -s (exceptions to -f → -ves rule)
const F_EXCEPTIONS = new Set([
  // Tech/common terms
  'roof',
  'proof', // proofs (mathematical proofs, design proofs)
  'chief', // tech leads
  'brief', // design briefs
  'belief',
  'cliff',
  'staff',
  'bluff',
  'spoof',
  'motif', // design motifs
  'serif', // fonts
  'tariff',
  'plaintiff',
  'sheriff',
  'reef',
  'chef',
  'ref',
  'gif', // GIFs
  'pdf', // PDFs
])

// Words ending in -o that just add -s (exceptions to -o → -oes rule)
const O_EXCEPTIONS = new Set([
  // Tech terms
  'photo',
  'video',
  'audio',
  'studio',
  'logo',
  'demo',
  'memo',
  'repo', // repositories
  'info',
  'typo',
  'intro',
  'outro',
  'combo',
  'promo',
  'proto', // prototypes
  'retro',
  'macro',
  'micro',
  'nano',
  'auto',
  'euro',
  'pro',
  'disco',
  'duo',
  'trio',
  'solo',
  'piano',
  'casino',
  'ratio',
  'portfolio',
  'scenario',
  'studio',
  'folio',
  'manifesto',
  'motto',
  'dynamo',
  'limo',
  'albino',
  'espresso',
  'fiasco',
  'ghetto',
  'grotto',
  'inferno',
  'jumbo',
  'kimono',
  'libido',
  'lingo',
  'memento',
  'neutrino',
  'placebo',
  'silo', // data silos
  'stiletto',
  'tempo',
  'torso',
  'virtuoso',
  'volcano',
  'zero',
])

export const pluralize = (
  count: number,
  word: string,
  { includeCount = true }: { includeCount?: boolean } = {},
) => {
  let pluralWord: string
  const lowerWord = word.toLowerCase()

  if (count === 1) {
    pluralWord = word
  } else if (word === word.toUpperCase() && word.length > 1) {
    // Acronyms (API, SDK, URL, etc.) - just add 's'
    pluralWord = word + 's'
  } else if (IRREGULAR_PLURALS[lowerWord]) {
    // Check irregular plurals first (truly irregular words)
    pluralWord = IRREGULAR_PLURALS[lowerWord]
  } else if (UNCHANGING_PLURALS.has(lowerWord)) {
    // Specific words that don't change
    pluralWord = word
  } else if (lowerWord.endsWith('ware')) {
    // Rule: -ware words stay unchanged (software, hardware, firmware, malware, etc.)
    pluralWord = word
  } else if (lowerWord.endsWith('ics')) {
    // Rule: -ics words stay unchanged (analytics, graphics, physics, statistics, etc.)
    pluralWord = word
  } else if (lowerWord.endsWith('sis')) {
    // Rule: -sis → -ses (analysis→analyses, basis→bases, crisis→crises, etc.)
    pluralWord = word.slice(0, -2) + 'es'
  } else if (lowerWord.endsWith('xis')) {
    // Rule: -xis → -xes (axis→axes)
    pluralWord = word.slice(0, -2) + 'es'
  } else if (F_EXCEPTIONS.has(lowerWord)) {
    // -f words that just add -s
    pluralWord = word + 's'
  } else if (word.endsWith('f')) {
    // Handle words ending in -f → -ves
    pluralWord = word.slice(0, -1) + 'ves'
  } else if (word.endsWith('fe')) {
    // Handle words ending in -fe → -ves
    pluralWord = word.slice(0, -2) + 'ves'
  } else if (word.endsWith('y') && !word.match(/[aeiou]y$/)) {
    // Handle words ending in 'y' (unless preceded by a vowel)
    pluralWord = word.slice(0, -1) + 'ies'
  } else if (O_EXCEPTIONS.has(lowerWord)) {
    // -o words that just add -s
    pluralWord = word + 's'
  } else if (word.match(/[cs]h$/) || word.match(/o$/)) {
    // Handle words ending in sh, ch, o → add -es
    pluralWord = word + 'es'
  } else if (word.match(/[^z]z$/)) {
    // Single z at end (not zz) → double the z and add -es (quiz → quizzes)
    pluralWord = word + 'zes'
  } else if (word.match(/[sxz]$/)) {
    // Handle words ending in s, x, zz → add -es
    pluralWord = word + 'es'
  } else {
    pluralWord = word + 's'
  }

  return includeCount ? `${count} ${pluralWord}` : pluralWord
}
