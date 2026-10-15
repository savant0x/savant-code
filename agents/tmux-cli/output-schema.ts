export const outputSchema = {
  type: 'object' as const,
  properties: {
    overallStatus: {
      type: 'string' as const,
      enum: ['success', 'failure', 'partial'],
      description:
        '"success" when all tasks completed, "failure" when the primary task could not be done, "partial" when some subtasks succeeded but others failed',
    },
    summary: {
      type: 'string' as const,
      description:
        'Brief summary of the CLI interaction: what was done, key outputs observed, and the outcome',
    },
    sessionName: {
      type: 'string' as const,
      description:
        'The tmux session name used for this run (needed for cleanup if the session lingers)',
    },
    results: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string' as const,
            description: 'Short name of the task or interaction step',
          },
          passed: {
            type: 'boolean' as const,
            description: 'Whether this step succeeded',
          },
          details: {
            type: 'string' as const,
            description: 'What happened during this step',
          },
          capturedOutput: {
            type: 'string' as const,
            description:
              'Relevant CLI output observed (keep concise — full output is in capture files)',
          },
        },
        required: ['name', 'passed'],
      },
      description: 'Ordered list of interaction steps and their outcomes',
    },
    scriptIssues: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          script: {
            type: 'string' as const,
            description:
              'Which helper command had the issue (e.g., "send", "capture", "wait-idle")',
          },
          issue: {
            type: 'string' as const,
            description: 'What went wrong when using the helper script',
          },
          errorOutput: {
            type: 'string' as const,
            description: 'The actual error message or unexpected output',
          },
          suggestedFix: {
            type: 'string' as const,
            description: 'Suggested fix for the parent agent to implement',
          },
        },
        required: ['script', 'issue', 'suggestedFix'],
      },
      description:
        'Problems encountered with the helper script that the parent agent should address',
    },
    captures: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string' as const,
            description:
              'Absolute path to the capture file in /tmp/tmux-captures-{session}/',
          },
          label: {
            type: 'string' as const,
            description:
              'Descriptive label for what this capture shows (e.g., "after-login", "error-state", "final")',
          },
          timestamp: {
            type: 'string' as const,
            description: 'ISO 8601 timestamp of when the capture was taken',
          },
        },
        required: ['path', 'label'],
      },
      description:
        'Saved terminal captures the parent agent can read to verify results',
    },
    lessons: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
      },
      description:
        'Advice for future runs: timing adjustments needed, unexpected CLI behavior, workarounds discovered, input quirks',
    },
  },
  required: [
    'overallStatus',
    'summary',
    'sessionName',
    'scriptIssues',
    'captures',
  ],
}
