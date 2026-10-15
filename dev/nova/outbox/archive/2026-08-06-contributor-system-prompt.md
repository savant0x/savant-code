<!-- markdownlint-disable MD013 MD022 MD032 MD040 -->
# Task: Contributor System for Savant Code

**Two tasks:**

## Task 1: Remove commandcodebot from Contributors

The GitHub contributors page shows `commandcodebot` as a contributor. This needs to be removed.

**Approach: Branch rename trick (safest)**

1. Rename `main` to `temp-branch` locally and push
2. Set `temp-branch` as default in GitHub Settings (Settings → General → Default branch)
3. Delete the `main` branch on GitHub
4. Rename `temp-branch` back to `main` locally and push
5. Set `main` as default again

This refreshes GitHub's contributor cache and removes stale bot entries.

**If that doesn't work:** Use `git filter-branch` or BFG Repo Cleaner to rewrite commits authored by commandcodebot to your own authorship. This rewrites history — force push required, all contributors would need to re-clone.

**Check first:** Run `git log --author="commandcodebot" --oneline` to see how many commits are affected.

## Task 2: Create `/contribute` Command

Create a `/contribute` slash command that lets users add themselves as contributors to the savant-code project.

### How it works:

1. User runs `/contribute` in the chat
2. Agent prompts for GitHub username (or detects from git config)
3. Agent adds the user to `CONTRIBUTORS.md` at the repo root
4. Agent creates a PR via GitHub API with the change
5. User approves the PR → they're now a contributor

### Implementation:

**File: `cli/src/commands/contribute.ts`**

```typescript
import { getSystemMessage, getUserMessage } from '../utils/message-history'
import type { CommandResult, RouterParams } from './command-registry'

/**
 * /contribute — Add yourself as a contributor to savant-code.
 *
 * Usage: /contribute [github-username]
 *
 * If no username provided, reads from git config:
 *   git config user.name
 *
 * Creates a PR adding the user to CONTRIBUTORS.md.
 */
export async function handleContributeCommand(
  params: RouterParams,
  args: string,
): Promise<CommandResult> {
  const username = args.trim() || await getGitUsername()

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
  const alreadyContributor = await checkContributorExists(username)
  if (alreadyContributor) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(`${username} is already a contributor! 🎉`),
    ])
    return
  }

  // 2. Add to CONTRIBUTORS.md
  await appendContributor(username)

  // 3. Create PR via GitHub API
  const prUrl = await createContributorPR(username)

  params.setMessages((prev) => [
    ...prev,
    getSystemMessage(
      `Added ${username} as a contributor!\n\nPR created: ${prUrl}\n\nApprove the PR to become an official contributor. 🎯`,
    ),
  ])
}
```

**File: `CONTRIBUTORS.md`** (repo root)

```markdown
# Contributors

Thank you to everyone who has contributed to Savant Code!

<!-- AUTO-GENERATED — do not edit below this line -->
| GitHub | Added |
|--------|-------|
| @spencer | 2026-01-01 |
| @commandcodebot | REMOVED |
```

**File: `cli/src/commands/defs/core.ts`** (register the command)

Add to the core commands:
```typescript
import { handleContributeCommand } from '../contribute'

// In the commands array:
{
  name: 'contribute',
  description: 'Add yourself as a contributor to savant-code',
  handler: handleContributeCommand,
},
```

### GitHub API Integration:

The agent will need to:
1. Read `CONTRIBUTORS.md`
2. Add the new row
3. Create a branch `contribute/add-{username}`
4. Commit the change
5. Create a PR via `gh pr create` or GitHub API
6. Return the PR URL

### Files to create/modify:
- `cli/src/commands/contribute.ts` (new)
- `cli/src/commands/defs/core.ts` (modify — register command)
- `CONTRIBUTORS.md` (new — repo root)
- `cli/src/utils/github-api.ts` (may need to extend for PR creation)

### Testing:
- Test with a valid GitHub username
- Test with an already-existing contributor
- Test with no username (should read from git config)
- Test PR creation flow
