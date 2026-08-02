#!/bin/bash
# Sync version to 0.0.13 across all manifests, commit, and push
cd "C:/Users/spenc/dev/savant-code"

echo "=== Current VERSION ==="
cat VERSION

echo "=== Updating VERSION ==="
echo "0.0.13" > VERSION

echo "=== Updating root package.json version ==="
node -e "const p=require('./package.json');p.version='0.0.13';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"

echo "=== Updating cli/package.json version ==="
node -e "const p=require('./cli/package.json');p.version='0.0.13';require('fs').writeFileSync('cli/package.json',JSON.stringify(p,null,2)+'\n')"

echo "=== Updating cli/release/package.json ==="
cat cli/release/package.json | head -5

echo "=== Updating protocol.config.yaml version ==="
sed -i 's/version: 0.0.12/version: 0.0.13/' protocol.config.yaml

echo "=== Done ==="
cat VERSION
