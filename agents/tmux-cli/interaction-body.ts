/**
 * Interaction logic for the tmux-cli handleSteps generator (extracted verbatim
 * from the compiled body: TS-only `as`/type annotations stripped, backslashes
 * and backticks escaped for the template literal; the factory re-evals this as
 * plain JS, matching what prebuild-agents serialized from the original).
 */
export const TMUX_INTERACTION_BODY = `    const startCommand =
      params && typeof params.command === 'string' ? params.command : ''

    if (!startCommand) {
      logger.error('No command provided in params.command')
      yield {
        toolName: 'set_output',
        input: {
          overallStatus: 'failure',
          summary:
            'No command provided. Pass params.command with the CLI command to start.',
          sessionName: '',
          scriptIssues: [],
          captures: [],
        },
      }
      return
    }

    // Generate a unique session name
    const sessionName =
      'tui-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
    const helperPath = '/tmp/tmux-helper-' + sessionName + '.sh'

    logger.info('Setting up tmux session: ' + sessionName)

    // Combined setup: write helper script, start session, send command (single yield to reduce round-trips)
    const escapedCommand = startCommand.replace(/'/g, "'\\\\''")
    const setupScript =
      'set -e\\n' +
      'cat > ' +
      helperPath +
      " << 'TMUX_HELPER_EOF'\\n" +
      helperScript +
      'TMUX_HELPER_EOF\\n' +
      'chmod +x ' +
      helperPath +
      '\\n' +
      'OUTPUT=$(' +
      helperPath +
      " start '" +
      sessionName +
      '\\') || { echo "FAIL_START" >&2; exit 1; }\\n' +
      helperPath +
      " send '" +
      sessionName +
      "' '" +
      escapedCommand +
      "' || { " +
      helperPath +
      " stop '" +
      sessionName +
      '\\' 2>/dev/null; echo "FAIL_SEND" >&2; exit 1; }\\n' +
      'echo "$OUTPUT"'

    const { toolResult: setupResult } = yield {
      toolName: 'run_terminal_command',
      input: {
        command: setupScript,
        timeout_seconds: 30,
      },
      includeToolCall: false,
    }

    let setupSuccess = false
    let setupError = ''

    const setupOutput = setupResult?.[0]
    if (setupOutput && setupOutput.type === 'json') {
      const value = setupOutput.value
      const stdout =
        typeof value?.stdout === 'string' ? value.stdout.trim() : ''
      const stderr =
        typeof value?.stderr === 'string' ? value.stderr.trim() : ''
      const exitCode =
        typeof value?.exitCode === 'number' ? value.exitCode : undefined

      if (exitCode === 0 && stdout === sessionName) {
        setupSuccess = true
      } else {
        setupError = stderr || stdout || 'Setup failed with no error message'
      }
    } else {
      setupError = 'Unexpected result type from run_terminal_command'
    }

    if (!setupSuccess) {
      const isSendFailure = setupError.includes('FAIL_SEND')
      const isStartFailure = setupError.includes('FAIL_START')

      let summary
      let suggestedFix
      if (isSendFailure) {
        summary = 'Started session but failed to send command. ' + setupError
        suggestedFix = 'Check that the command is valid.'
      } else if (isStartFailure) {
        summary = 'Failed to start tmux session. ' + setupError
        suggestedFix = 'Ensure tmux is installed and the command is valid.'
      } else {
        summary = 'Failed to write helper script to /tmp. ' + setupError
        suggestedFix = 'Check /tmp is writable'
      }

      logger.error(setupError, 'Setup failed')
      yield {
        toolName: 'set_output',
        input: {
          overallStatus: 'failure',
          summary,
          sessionName: isSendFailure ? sessionName : '',
          scriptIssues: [
            { script: helperPath, issue: setupError, suggestedFix },
          ],
          captures: [],
        },
      }
      return
    }

    logger.info('Session ready: ' + sessionName)

    // Capture initial state so the agent starts with context (0.5s is enough since send already waits ~0.6s)
    const { toolResult: initCapture } = yield {
      toolName: 'run_terminal_command',
      input: {
        command:
          'sleep 0.5 && ' +
          helperPath +
          " capture '" +
          sessionName +
          "' --wait 0 --label startup-check || { " +
          helperPath +
          " stop '" +
          sessionName +
          "' 2>/dev/null; exit 1; }",
        timeout_seconds: 10,
      },
    }

    let initialOutput = '(no initial capture available)'
    const initResult = initCapture?.[0]
    if (initResult && initResult.type === 'json') {
      const initValue = initResult.value
      if (typeof initValue?.stdout === 'string' && initValue.stdout.trim()) {
        initialOutput = initValue.stdout.trim()
      }
    }

    const captureDir = '/tmp/tmux-captures-' + sessionName

    yield {
      toolName: 'add_message',
      input: {
        role: 'user',
        content:
          'A tmux session has been started and \`' +
          startCommand +
          '\` has been sent to it.\\n\\n' +
          '**Session:** \`' +
          sessionName +
          '\`\\n' +
          '**Helper:** \`' +
          helperPath +
          '\`\\n' +
          '**Captures dir:** \`' +
          captureDir +
          '/\`\\n\\n' +
          '**Initial terminal output:**\\n\`\`\`\\n' +
          initialOutput +
          '\\n\`\`\`\\n\\n' +
          'Check the initial output above — if you see errors like "command not found" or "No such file", report failure immediately.\\n\\n' +
          '## Helper Script Implementation\\n\\n' +
          'The helper script at \`' +
          helperPath +
          '\` is a Bash script that wraps tmux commands to interact with the CLI. Here is its full implementation:\\n\\n' +
          '\`\`\`bash\\n' +
          helperScript.replace(/\`\`\`/g, '\\\\\`\\\\\`\\\\\`') +
          '\\n\`\`\`\\n\\n' +
          '## Quick Reference\\n\\n' +
          '- Send input: \`' +
          helperPath +
          ' send "' +
          sessionName +
          '" "..."\`\\n' +
          '- Send with paste mode: \`' +
          helperPath +
          ' send "' +
          sessionName +
          '" "..." --paste\`\\n' +
          '- Send + wait for output: \`' +
          helperPath +
          ' send "' +
          sessionName +
          '" "..." --wait-idle 3\`\\n' +
          '- Send key: \`' +
          helperPath +
          ' key "' +
          sessionName +
          '" C-c\`\\n' +
          '- Raw tmux send-keys: \`' +
          helperPath +
          ' raw "' +
          sessionName +
          '" "text" Enter\`\\n' +
          '- Capture visible pane: \`' +
          helperPath +
          ' capture "' +
          sessionName +
          '" --label "..."\`\\n' +
          '- Capture full scrollback: \`' +
          helperPath +
          ' capture "' +
          sessionName +
          '" --full --label "final"\`\\n' +
          '- Capture without ANSI colors: \`' +
          helperPath +
          ' capture "' +
          sessionName +
          '" --strip-ansi\`\\n' +
          '- Check session status: \`' +
          helperPath +
          ' status "' +
          sessionName +
          '"\`\\n' +
          '- Wait for stable output: \`' +
          helperPath +
          ' wait-idle "' +
          sessionName +
          '" 3\`\\n' +
          '- Stop session: \`' +
          helperPath +
          ' stop "' +
          sessionName +
          '"\`\\n\\n' +
          'Captures are saved to \`' +
          captureDir +
          '/\` — use the file paths in your output so the parent agent can verify with \`read_files\`.',
      },
      includeToolCall: false,
    }

    yield 'STEP_ALL'`
