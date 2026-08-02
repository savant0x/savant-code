#!/bin/bash
cd "C:/Users/spenc/dev/savant-code/cli/release"
echo "Waiting 10 seconds for npm registry propagation..."
sleep 10
echo "=== Republishing 0.0.12 ==="
npm publish --access public
echo "Publish exit code: $?"
