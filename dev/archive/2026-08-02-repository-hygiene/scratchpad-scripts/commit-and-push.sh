#!/bin/bash
cd "C:/Users/spenc/dev/savant-code"

echo "=== Staging all changes ==="
git add -A

echo "=== Committing ==="
git commit -m "chore(release): v0.0.13 — update npm README, sync version manifests

- Replaced placeholder npm README with comprehensive feature showcase
- Bumped VERSION, root/cli/release package.json, and protocol.config.yaml to 0.0.13
- Published savant-code@0.0.13 to npm with proper multi-agent documentation"

echo "=== Pushing ==="
git push origin main

echo "=== Cleaning scratchpad ==="
rm -f dev/scratchpad/*.sh

echo "=== Done ==="
git status --short
git log --oneline -3
