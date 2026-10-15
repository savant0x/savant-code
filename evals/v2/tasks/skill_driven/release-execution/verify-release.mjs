import { readFileSync } from 'node:fs'

const version = readFileSync('VERSION', 'utf8').trim()
const changelog = readFileSync('CHANGELOG.md', 'utf8')
const readme = readFileSync('README.md', 'utf8')
if (version !== '1.2.4')
  throw new Error(`VERSION should be 1.2.4, got ${version}`)
if (!changelog.includes('## 1.2.4'))
  throw new Error('CHANGELOG.md needs a 1.2.4 entry')
if (!readme.includes('Current version: 1.2.4'))
  throw new Error('README.md version is stale')
