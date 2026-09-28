// The injectable HTTP seam for the public-release engine (SCOPE T84-B).
//
// Why not `typeof fetch`: that is the *global* Bun fetch, which carries
// `preconnect` and other runtime extensions this pipeline never calls. It is
// also the wrong bound in the direction that matters — a test double of
// `() => Promise<Response>`, which is exactly what this seam exists for, is not
// assignable to it, so every release suite either suppressed the error with a
// double assertion or went unchecked. Declaring what the code actually calls
// keeps the seam honest and lets one standing type-check surface cover
// `scripts/`.

/** Minimal callable shape the release engine needs from an HTTP client. */
export type ReleaseFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>
