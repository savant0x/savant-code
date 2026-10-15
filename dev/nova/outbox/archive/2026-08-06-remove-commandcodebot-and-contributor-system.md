<!-- markdownlint-disable MD013 MD022 MD040 -->
# Task: Remove CommandCodeBot from Git History + Create Contributor System

## Task 1: Remove CommandCodeBot from Git History

The GitHub contributors page shows `CommandCodeBot` with 2 commits (539 additions, 62 deletions). This happened when Spencer used CommandCode to code — the bot committed with its own authorship.

### Step 1: Find the commits

```bash
cd /c/Users/spenc/dev/savant-code
git log --author="CommandCodeBot" --format="%H %s" --all
```

### Step 2: Rewrite history using git filter-branch

```bash
# Rewrite those commits to Spencer's authorship
git filter-branch -f --env-filter '
  if [ "$GIT_AUTHOR_NAME" = "CommandCodeBot" ]; then
    export GIT_AUTHOR_NAME="savant0x"
    export GIT_AUTHOR_EMAIL="snkgeek87@gmail.com"
  fi
  if [ "$GIT_COMMITTER_NAME" = "CommandCodeBot" ]; then
    export GIT_COMMITTER_NAME="savant0x"
    export GIT_COMMITTER_EMAIL="snkgeek87@gmail.com"
  fi
' -- $(git log --author="CommandCodeBot" --format="%H" | tr '\n' ' ')
```

### Step 3: Verify the rewrite

```bash
# Should return empty
git log --author="CommandCodeBot" --oneline --all

# Should show savant0x as author of those commits
git log --oneline --all | head -10
```

### Step 4: Force push

```bash
git push --force origin main
```

⚠️ **Warning:** This rewrites history. All contributors will need to re-clone. But since this is a new repo with only 1 contributor, it's safe.

### Step 5: Verify on GitHub

After force push, check https://github.com/savant0x/savant-code/graphs/contributors — CommandCodeBot should be gone.

---

## Task 2: Create `/contribute` Command

Create a `/contribute` slash command that lets users add themselves as contributors to the savant-code project.

### How it works:

1. User runs `/contribute` in the chat
2. Agent prompts for GitHub username (or detects from git config)
3. Agent adds the user to `CONTRIBUTORS.md` at the repo root
4. Agent creates a PR via GitHub API with the change
5. User approves the PR → they're now a contributor

### Files to create/modify:

1. **`cli/src/commands/contribute.ts`** (new) — The command handler
2. **`cli/src/commands/defs/core.ts`** (modify) — Register the command
3. **`CONTRIBUTORS.md`** (new) — Repo root file listing contributors

### Implementation:

**File: `cli/src/commands/contribute.ts`**

```typescript
import { execSync } from 'child_process'
import { readFileSync, appendFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getSystemMessage } from '../utils/message-history'
import type { CommandResult, RouterParams } from './command-registry'

/**
 * /contribute — Add yourself as a contributor to savant-code.
 *
 * Usage: /contribute [github-username]
 *
 * If no username provided, reads from git config.
 * Creates a PR adding the user to CONTRIBUTORS.md.
 */
export async function handleContributeCommand(
  params: RouterParams,
  args: string,
): Promise<CommandResult> {
  const username = args.trim() || getGitUsername()

  if (!username) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        'Usage: /contribute [github-username]\n\nExample: /contribute spencer',
      ),
    ])
    return
  }

  // 1. Check if already a contributor
  if (checkContributorExists(username)) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(`@${username} is already a contributor! 🎉`),
    ])
    return
  }

  // 2. Add to CONTRIBUTORS.md
  appendContributor(username)

  // 3. Create branch and commit
  const branchName = `contribute/add-${username.toLowerCase()}`
  execSync(`git checkout -b ${branchName}`, { cwd: process.cwd() })
  execSync('git add CONTRIBUTORS.md', { cwd: process.cwd() })
  execSync(`git commit -m "docs: add @${username} as contributor"`, {
    cwd: process.cwd(),
  })

  // 4. Push and create PR
  execSync(`git push origin ${branchName}`, { cwd: process.cwd() })

  // 5. Create PR via gh CLI
  const prOutput = execSync(
    `gh pr create --title "Add @${username} as contributor" --body "Welcome @${username} to the Savant Code contributors! 🎯" --base main --head ${branchName}`,
    { cwd: process.cwd(), encoding: 'utf-8' },
  )

  // 6. Return to main
  execSync('git checkout main', { cwd: process.cwd() })

  params.setMessages((prev) => [
    ...prev,
    getSystemMessage(
      `Added @${username} as a contributor!\n\nPR created. Approve it to become an official contributor. 🎯`,
    ),
  ])
}

function getGitUsername(): string {
  try {
    return execSync('git config user.name', { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

function checkContributorExists(username: string): boolean {
  const contributorsPath = join(process.cwd(), 'CONTRIBUTORS.md')
  if (!existsSync(contributorsPath)) return false
  const content = readFileSync(contributorsPath, 'utf-8')
  return content.includes(`@${username}`) || content.includes(username)
}

function appendContributor(username: string): void {
  const contributorsPath = join(process.cwd(), 'CONTRIBUTORS.md')
  const date = new Date().toISOString().split('T')[0]

  if (!existsSync(contributorsPath)) {
    // Create new file
    const header = `# Contributors\n\nThank you to everyone who has contributed to Savant Code!\n\n| GitHub | Added |\n|--------|-------|\n`
    const entry = `| @${username} | ${date} |\n`
    const fs = require('fs')
    fs.writeFileSync(contributorsPath, header + entry)
    return
  }

  // Append to existing file
  const entry = `| @${username} | ${date} |\n`
  appendFileSync(contributorsPath, entry)
}
```

**File: `CONTRIBUTORS.md`** (repo root)

```markdown
# Contributors

Thank you to everyone who has contributed to Savant Code!

| GitHub | Added |
|--------|-------|
| @savant0x | 2026-01-01 |
```

**File: `cli/src/commands/defs/core.ts`** (register the command)

Add to the imports:
```typescript
import { handleContributeCommand } from '../contribute'
```

Add to the commands array:
```typescript
{
  name: 'contribute',
  description: 'Add yourself as a contributor to savant-code',
  handler: handleContributeCommand,
},
```

### Testing:

1. Test with a valid GitHub username: `/contribute testuser`
2. Test with an already-existing contributor: `/contribute savant0x`
3. Test with no username (should read from git config): `/contribute`
4. Verify PR is created on GitHub
5. Verify CONTRIBUTORS.md is updated

### Notes:

- The `gh` CLI must be authenticated (`gh auth login`)
- The agent needs write access to the repo
- PR will be created from the new branch to main
- User approves the PR → they're a contributor

---

## Task 3: Savant Code Authorship System

When savant-code makes commits (via Forge agent or automated releases), commits should be authored by `savant-code` bot, not the user. This creates a visible contributor identity for the tool itself.

### How it works:

1. Configure a `.mailmap` file to map savant-code commits
2. Set up git config for the bot identity
3. Update commit workflows to use the bot authorship

### Implementation:

**File: `.mailmap`** (repo root)

```
savant-code <bot@savant-code.com> CommandCodeBot <commandcodebot@users.noreply.github.com>
savant-code <bot@savant-code.com> savant-bot <savant-bot@users.noreply.github.com>
```

**File: `scripts/setup-bot-authorship.sh`**

```bash
#!/bin/bash
# Setup savant-code bot authorship for this repo
# Run once after cloning

cd "$(git rev-parse --show-toplevel)"

# Set local git config for bot commits
git config user.name "savant-code"
git config user.email "bot@savant-code.com"

echo "✅ Bot authorship configured for this repo"
echo "   Commits will show as: savant-code <bot@savant-code.com>"
```

**File: `.github/workflows/release.yml`** (modify existing or create)

Add authorship to release commits:

```yaml
- name: Commit release
  run: |
    git config user.name "savant-code"
    git config user.email "bot@savant-code.com"
    git add .
    git commit -m "release: v${{ steps.version.outputs.version }}"
    git push
```

**Update `CONTRIBUTORS.md`** to include the bot:

```markdown
# Contributors

Thank you to everyone who has contributed to Savant Code!

| GitHub | Added |
|--------|-------|
| @savant0x | 2026-01-01 |
| @savant-code | 2026-08-06 |
```

### How it shows on GitHub:

- Commits made by the bot show as `savant-code` in the git log
- The contributors page shows `savant-code` as a contributor with its own commit graph
- Users see the tool as an active participant, not just a utility

### Key difference from CommandCodeBot:

- **CommandCodeBot** = External tool that committed with its own identity (we're removing this)
- **savant-code** = Our own tool that commits with its own identity (we're creating this)

The user's commits stay as their own. Only automated/tool commits get bot authorship.
