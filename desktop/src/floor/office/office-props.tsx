/**
 * FID-2026-0831-002 P7 — sci-fi prop layer for the office deck.
 *
 * The operator asked for MORE: bookshelves already exist in the scene; this
 * module adds the cyberpunk clutter that makes a floor read as lived-in —
 * server racks, glowing holo-columns, cargo crates, canisters, a charging
 * pad, and ceiling light strips. All deterministic (seeded), all authored
 * geometry + procedural materials — no bundled assets.
 *
 * Zero state: every component is a pure function of its props (same
 * discipline as the rest of the office modules).
 *
 * FID-2026-0819-005 Loop 301: components split into thematic siblings
 * (tech / cargo / living); this file is a re-export facade so consumers
 * (office-scene.tsx) are untouched.
 */

export * from './office-props-tech'
export * from './office-props-cargo'
export * from './office-props-living'
