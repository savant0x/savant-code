# Deck robot assets — licensing manifest

| File | Source | Author | License |
|---|---|---|---|
| RobotExpressive.glb | Khronos glTF sample models (three.js examples mirror) | Tomás Laulhé / Mike Bond | CC0 1.0 |

## Removed: `robot.glb` (FID-2026-1016-013)

The manifest used to carry a second row attributing `robot.glb` to the
Quaternius Animated Robot Pack. That row was wrong twice over: the file was
**byte-identical** to `RobotExpressive.glb` (same SHA-256, same 463,988 bytes —
its glTF JSON names the Khronos model's own meshes and clips), and no copy of
the Quaternius pack was ever vendored. Keeping a duplicate under an incorrect
attribution meant the cast alternated between two copies of one model while
the code and this manifest both claimed two designs.

The duplicate has been deleted. A genuinely different robot model is a
follow-up, not a rename: the second row returns when the second file does.
