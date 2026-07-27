# CLI Test Prompt: Goal/Loop System End-to-End

## Purpose
Validate that the `/goal` and `/loop` slash commands work end-to-end,
including scheduling, goal evaluation, sidebar status, and CLI output.

## Live Run Prompt (paste into the CLI)

```
Run a full goal/loop smoke test in this project:
1. Set a goal: /goal typecheck and lint pass with no new errors
2. Start a 30-second loop: /loop 30s run typecheck and report the result
3. Confirm the right sidebar shows the active loop with cadence "30s"
4. Run /loop status and verify it shows the schedule and next run time
5. Wait for the next loop tick (~30 seconds), verify the agent sends another message, then run /loop stop
6. Confirm the sidebar returns to "No active loop"
```

## Prerequisites
- The SavantCode CLI is running in an interactive tmux session
- The agent runtime is connected and ready

---

## Test 1: /goal command

### Step 1 — Set a goal
Type the following in the CLI:
```
/goal all tests pass with no new failures
```

### Expected Result
- The CLI shows a confirmation message with the goal condition
- The goal condition is injected into the system message for the agent runtime
- A new message appears in the chat listing the active goal

### Verified
- [ ] Goal confirmation message appears
- [ ] Goal condition is visible in system message injection
- [ ] Goal is listed in the chat as an active goal

---

## Test 2: /loop command — start

### Step 2 — Start a loop
Type the following in the CLI:
```
/loop 1m review and fix any failing tests
```

### Expected Result
- The CLI shows a "Loop started" confirmation with cadence and prompt
- The first run executes immediately (prompt is sent to the agent)
- The sidebar shows an active loop indicator with cadence "1m"
- The system schedules the next run for 1 minute from now
- `/loop status` returns valid schedule data (cadence label, next run time, iteration count)
- `/loop stop` deactivates the loop and clears the schedule

### Verified
- [ ] "Loop started" confirmation message appears
- [ ] First run executes immediately
- [ ] Sidebar shows 🔄 Active with cadence "1m"
- [ ] `/loop status` shows schedule data
- [ ] `/loop stop` stops the loop
- [ ] `/loop status` returns null after stop

---

## Test 3: /loop command — stop

### Step 3 — Stop the loop
Type the following in the CLI:
```
/loop stop
```

### Expected Result
- The CLI shows a "Loop stopped" confirmation
- The sidebar loop status changes to "No active loop"
- The schedule is cleared (`/loop status` returns null)

### Verified
- [ ] "Loop stopped" confirmation appears
- [ ] Sidebar shows "No active loop"
- [ ] `/loop status` returns null

---

## Test 4: Goal evaluation across loop runs

### Step 4 — Start a loop with a goal
Type the following in the CLI:
```
/goal all tests pass with no new failures
```
Then:
```
/loop 2m run the test suite and report results
```

### Expected Result
- The goal condition persists across loop iterations
- Each loop run receives the goal condition in context
- The agent can evaluate whether the goal is satisfied after each run
- When the goal is satisfied, the loop stops (or the agent reports goal completion)

### Verified
- [ ] Goal condition persists between loop iterations
- [ ] Each loop run includes the goal condition in context
- [ ] Agent reports goal status after each run

---

## Test 5: Sidebar loop indicator

### Step 5 — Verify sidebar integration
While a loop is active:
1. Check the right sidebar for the "Loop" section
2. Verify it shows: Status (🔄 Active), Cadence, Next run, Iterations
3. Stop the loop and verify the sidebar shows "No active loop"

### Verified
- [ ] Sidebar shows Loop section when active
- [ ] Loop section shows correct cadence and next run time
- [ ] Loop section shows iteration count
- [ ] Loop section shows "No active loop" when stopped

---

## Exit Criteria
All 5 test steps pass with no errors. The goal/loop system is fully functional:
1. `/goal` sets a condition that persists across loop runs
2. `/loop` runs on a cadence schedule with recurring execution
3. `/loop stop` deactivates the loop and clears state
4. `/loop status` reflects accurate state
5. The sidebar shows real-time loop status

## Notes
This test prompt is designed for manual CLI testing via tmux. Run each step
sequentially and verify the expected result before proceeding to the next step.
