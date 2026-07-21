/**
 * Randomized loading phrases for the CLI status bar.
 *
 * Each time the status transitions to 'waiting' or 'streaming', a new phrase
 * is picked at random. The phrases reference various programming concepts —
 * from concurrency and compilers to memes and DevOps — giving the terminal
 * a playful, developer-centric personality.
 */

const LOADING_PHRASES = [
  // Concurrency & systems
  'Spawning worker threads...',
  'Context switching...',
  'Allocating heap space...',
  'De-referencing pointers...',
  'Running garbage collection on bad ideas...',

  // Compilers & parsing
  'Traversing the abstract syntax tree...',
  'Compiling logic...',
  'Parsing complex regular expressions...',

  // Build & dependencies
  'Building the dependency graph...',
  'Busting the cache...',

  // Async & networking
  'Awaiting async callbacks...',
  'Resolving DNS for good_ideas.local...',

  // Algorithms & ML
  'Calculating Big O complexity...',
  'Tuning heuristic weights...',

  // Databases
  'Executing inner join on concepts...',

  // DevOps
  'Spinning up ephemeral containers...',

  // Debugging
  'Attaching GDB to the thought process...',

  // Functional programming
  'Evaluating monads...',

  // Version control
  'Resolving internal merge conflicts...',

  // Unix / CLI
  'Grepping through neural pathways...',
  'Piping thoughts to /dev/brain...',

  // Humor
  'Figuring out how to exit Vim...',
  'Searching Stack Overflow...',
  'Centering a div...',
  'Refactoring internal spaghetti...',
]

/**
 * Return a random loading phrase from the pool.
 * Pure function — no state, no side effects.
 */
export function getRandomLoadingPhrase(): string {
  const index = Math.floor(Math.random() * LOADING_PHRASES.length)
  return LOADING_PHRASES[index]
}
