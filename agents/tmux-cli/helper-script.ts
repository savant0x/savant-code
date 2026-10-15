/**
 * Self-contained tmux helper script written to /tmp at startup by the tmux-cli
 * agent's handleSteps. Lives in its own module so the agent definition stays
 * under the line bar; the handleSteps factory bakes it into the generated
 * source as a string literal (JSON.stringify), keeping the serialized
 * generator self-contained.
 */
export const TMUX_HELPER_SCRIPT = `#!/usr/bin/env bash
set -e

TMUX_COMMAND=(tmux)
if ! command -v tmux >/dev/null 2>&1; then
  if command -v wsl.exe >/dev/null 2>&1 && wsl.exe -e tmux -V >/dev/null 2>&1; then
    TMUX_COMMAND=(wsl.exe -e tmux)
  else
    echo "tmux not found natively or inside WSL" >&2
    exit 1
  fi
fi

tmux_exec() {
  "\${TMUX_COMMAND[@]}" "$@"
}

TMUX_CWD="$PWD"
if [[ "\${TMUX_COMMAND[0]}" == "wsl.exe" ]]; then
  HOST_CWD="$PWD"
  if command -v cygpath >/dev/null 2>&1; then
    HOST_CWD="$(cygpath -w "$PWD")"
  fi
  TMUX_CWD="$(wsl.exe -e wslpath -u "$HOST_CWD" | tr -d '\\r\\n')"
fi

usage() {
  echo "Usage: $0 <command> [args]"
  echo "Commands: start, send, capture, stop, key, raw, wait-idle, status"
  exit 1
}

[[ $# -lt 1 ]] && usage
CMD="$1"; shift

case "$CMD" in
  start)
    SESSION="$1"
    [[ -z "$SESSION" ]] && { echo "Usage: start <session>" >&2; exit 1; }
    tmux_exec new-session -d -s "$SESSION" -c "$TMUX_CWD" -x 120 -y 30 bash 2>/dev/null || true
    if ! tmux_exec has-session -t "$SESSION" 2>/dev/null; then
      echo "Failed to create session $SESSION" >&2; exit 1
    fi
    mkdir -p "/tmp/tmux-captures-$SESSION"
    echo "$SESSION"
    ;;

  send)
    # send <session> <text> [--no-enter] [--paste] [--wait-idle N]
    SESSION="$1"; shift
    TEXT=""; AUTO_ENTER=true; PASTE_MODE=false; WAIT_IDLE=0
    while [[ $# -gt 0 ]]; do
      case $1 in
        --no-enter) AUTO_ENTER=false; shift ;;
        --paste) PASTE_MODE=true; shift ;;
        --wait-idle) WAIT_IDLE="$2"; shift 2 ;;
        *) TEXT="$1"; shift ;;
      esac
    done
    [[ -z "$SESSION" || -z "$TEXT" ]] && { echo "Usage: send <session> <text> [--no-enter] [--paste] [--wait-idle N]" >&2; exit 1; }
    tmux_exec send-keys -t "$SESSION" C-u
    sleep 0.05
    if [[ "$PASTE_MODE" == true ]]; then
      tmux_exec send-keys -t "$SESSION" $'\\x1b[200~'"$TEXT"$'\\x1b[201~'
    else
      tmux_exec send-keys -t "$SESSION" -- "$TEXT"
    fi
    if [[ "$AUTO_ENTER" == true ]]; then
      # Allow OpenTUI to finish processing bracketed paste before Enter.
      sleep 0.25
      tmux_exec send-keys -t "$SESSION" Enter
      sleep 0.5
    fi
    if [[ "$WAIT_IDLE" -gt 0 ]]; then
      LAST_OUTPUT=""
      STABLE_START=$(date +%s)
      MAX_END=$(( $(date +%s) + 120 ))
      while true; do
        CURRENT_OUTPUT=$(tmux_exec capture-pane -t "$SESSION" -S - -p 2>/dev/null || echo "")
        NOW=$(date +%s)
        if [[ "$CURRENT_OUTPUT" != "$LAST_OUTPUT" ]]; then
          LAST_OUTPUT="$CURRENT_OUTPUT"
          STABLE_START=$NOW
        fi
        if (( NOW - STABLE_START >= WAIT_IDLE )); then break; fi
        if (( NOW >= MAX_END )); then echo "wait-idle timed out after 120s" >&2; break; fi
        sleep 0.25
      done
    fi
    ;;

  key)
    SESSION="$1"; KEY="$2"
    [[ -z "$SESSION" || -z "$KEY" ]] && { echo "Usage: key <session> <key>" >&2; exit 1; }
    tmux_exec send-keys -t "$SESSION" "$KEY"
    ;;

  raw)
    SESSION="$1"; shift
    [[ -z "$SESSION" ]] && { echo "Usage: raw <session> [tmux send-keys args...]" >&2; exit 1; }
    tmux_exec send-keys -t "$SESSION" "$@"
    ;;

  capture)
    # capture <session> [--wait N] [--label LABEL] [--full] [--strip-ansi]
    SESSION="$1"; shift
    WAIT=1; LABEL=""; FULL=false; STRIP_ANSI=false
    while [[ $# -gt 0 ]]; do
      case $1 in
        --wait) WAIT="$2"; shift 2 ;;
        --label) LABEL="$2"; shift 2 ;;
        --full) FULL=true; shift ;;
        --strip-ansi) STRIP_ANSI=true; shift ;;
        *) shift ;;
      esac
    done
    [[ -z "$SESSION" ]] && { echo "Usage: capture <session> [--wait N] [--label LABEL] [--full] [--strip-ansi]" >&2; exit 1; }
    [[ "$WAIT" -gt 0 ]] && sleep "$WAIT"
    CAPTURE_DIR="/tmp/tmux-captures-$SESSION"
    mkdir -p "$CAPTURE_DIR"
    SEQ_FILE="$CAPTURE_DIR/.seq"
    if [[ -f "$SEQ_FILE" ]]; then SEQ=$(cat "$SEQ_FILE"); else SEQ=0; fi
    SEQ=$((SEQ + 1))
    echo "$SEQ" > "$SEQ_FILE"
    SEQ_PAD=$(printf "%03d" "$SEQ")
    if [[ -n "$LABEL" ]]; then
      CAPTURE_FILE="$CAPTURE_DIR/capture-\${SEQ_PAD}-\${LABEL}.txt"
    else
      CAPTURE_FILE="$CAPTURE_DIR/capture-\${SEQ_PAD}.txt"
    fi
    if [[ "$FULL" == true ]]; then
      tmux_exec capture-pane -t "$SESSION" -S - -p > "$CAPTURE_FILE"
    else
      tmux_exec capture-pane -t "$SESSION" -p > "$CAPTURE_FILE"
    fi
    if [[ "$STRIP_ANSI" == true ]]; then
      perl -pe 's/\\e\\[[\\d;]*[a-zA-Z]//g' "$CAPTURE_FILE" > "$CAPTURE_FILE.tmp" && mv "$CAPTURE_FILE.tmp" "$CAPTURE_FILE"
    fi
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "[Saved: $CAPTURE_FILE] [$TIMESTAMP]"
    cat "$CAPTURE_FILE"
    ;;

  wait-idle)
    # wait-idle <session> [stable-seconds]
    SESSION="$1"; STABLE_SECS="\${2:-2}"
    [[ -z "$SESSION" ]] && { echo "Usage: wait-idle <session> [seconds]" >&2; exit 1; }
    LAST_OUTPUT=""
    STABLE_START=$(date +%s)
    MAX_END=$(( $(date +%s) + 120 ))
    while true; do
      CURRENT_OUTPUT=$(tmux_exec capture-pane -t "$SESSION" -S - -p 2>/dev/null || echo "")
      NOW=$(date +%s)
      if [[ "$CURRENT_OUTPUT" != "$LAST_OUTPUT" ]]; then
        LAST_OUTPUT="$CURRENT_OUTPUT"
        STABLE_START=$NOW
      fi
      if (( NOW - STABLE_START >= STABLE_SECS )); then echo "Output stable for \${STABLE_SECS}s"; break; fi
      if (( NOW >= MAX_END )); then echo "Timed out after 120s" >&2; break; fi
      sleep 0.25
    done
    ;;

  status)
    SESSION="$1"
    [[ -z "$SESSION" ]] && { echo "Usage: status <session>" >&2; exit 1; }
    if tmux_exec has-session -t "$SESSION" 2>/dev/null; then
      echo "alive"
    else
      echo "dead"
    fi
    ;;

  stop)
    SESSION="$1"
    [[ -z "$SESSION" ]] && { echo "Usage: stop <session>" >&2; exit 1; }
    tmux_exec kill-session -t "$SESSION" 2>/dev/null || true
    ;;

  *) usage ;;
esac
`
