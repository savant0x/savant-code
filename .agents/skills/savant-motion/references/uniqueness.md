# Uniqueness: the signature move and the fingerprint gate

## 1. The signature move

Every build invents **one bespoke interaction that exists on that site alone**,
coded as page-local JS reading the engine's published state (`--sm-p`,
`--sm-vy`, `sm:waypoint`). A recoloured spotlight is not one; a retuned tilt is
not one. The interview question "what should this site do that no site you
have seen does?" is its seed.

The engine is never edited to make room for a signature move.

## 2. The fingerprint gate

A proposed build must differ from EVERY registry row by a weighted score of at
least **5 of a possible 8**:

| Dimension       | Weight |
| --------------- | ------ |
| `grammar`       | 2      |
| `signatureMove` | 2      |
| `nav`           | 1      |
| `hero`          | 1      |
| `actShape`      | 1      |
| `close`         | 1      |

Two builds sharing grammar AND signatureMove can score at most 4 — the
"same site twice" collision is structurally impossible to pass. The gate is
evaluated per row by `scripts/gate.ts` against `motion/registry.json`; rows are
append-only and never edited to make room.

## 3. Exhaustion

When no candidate clears the gate after two failed convergence attempts, the
gate reports `status: "exhausted"` with advice listing the highest-value
dimensions still shared with blocked rows. Present the collision to the
operator; only an explicit operator override (`--allow-collision`) proceeds,
and the shipped row records `overriddenBy: "operator"`.

## 4. What counts as a dimension value

Write concrete, comparable values — not prose:

```text
grammar:       "pinned-chapters"
nav:           "waypoint map, left edge"
hero:          "title page, no media above fold"
actShape:      "pin > flow > scrub > pan > pin, 6 acts, ~12vh"
close:         "running-text ask inside resolving stage"
signatureMove: "pointer lamp reveals the only lit region"
```

## 5. Range

Premium-minimal is a default, not a ceiling: brutalist, maximalist, playful,
retro, dense, editorial are all in range. The brief governs the aesthetic
family; the floor (taste-floor.md) governs execution everywhere.