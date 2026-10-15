// Fixture: ECHO Law 6 `unknown` enforcement — BAD cases (must be flagged)
// Run: npx eslint scripts/eslint-rules/__fixtures__/unknown-bad.ts

// 1. unknown as parameter type — FORBIDDEN
export function handleInput(data: unknown): void {
  // would force a cast or guard downstream — violates Law 6
  console.log(data)
}

// 2. unknown as return type — FORBIDDEN
export function fetchConfig(): unknown {
  return { foo: 'bar' }
}

// 3. unknown as variable declaration type — FORBIDDEN
export const payload: unknown = JSON.parse('{}')

// 4. unknown in arrow param — FORBIDDEN
export const process = (item: unknown) => {
  return item
}
