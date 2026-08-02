#!/bin/bash
cd "C:/Users/spenc/dev/savant-code/cli/release"
echo "=== Unpublishing 0.0.12 ==="
npm unpublish savant-code@0.0.12
echo "Unpublish exit code: $?"
echo "=== Republishing 0.0.12 ==="
npm publish --access public
echo "Publish exit code: $?"
