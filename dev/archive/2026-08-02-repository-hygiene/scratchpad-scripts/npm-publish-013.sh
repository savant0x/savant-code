#!/bin/bash
cd "C:/Users/spenc/dev/savant-code/cli/release"
echo "=== Bumping version to 0.0.13 ==="
npm version 0.0.13 --no-git-tag-version
echo "Version bump exit code: $?"
echo "=== Publishing 0.0.13 ==="
npm publish --access public
echo "Publish exit code: $?"
