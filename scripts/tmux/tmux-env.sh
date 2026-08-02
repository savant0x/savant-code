#!/usr/bin/env bash

# Shared tmux bridge for native Unix hosts and Windows Git Bash with WSL tmux.
# The bridge intentionally keeps session names and command arguments unchanged.

TMUX_USE_WSL=false
TMUX_COMMAND=()

if command -v tmux >/dev/null 2>&1; then
    TMUX_COMMAND=(tmux)
elif command -v wsl.exe >/dev/null 2>&1 && wsl.exe -e tmux -V >/dev/null 2>&1; then
    TMUX_USE_WSL=true
    TMUX_COMMAND=(wsl.exe -e tmux)
else
    echo "tmux not found. Install tmux natively or inside WSL (Ubuntu: sudo apt-get install tmux)." >&2
    return 1 2>/dev/null || exit 1
fi

tmux_exec() {
    "${TMUX_COMMAND[@]}" "$@"
}

tmux_is_wsl() {
    [[ "$TMUX_USE_WSL" == true ]]
}

tmux_to_wsl_path() {
    local path="$1"
    if tmux_is_wsl; then
        wsl.exe -e wslpath -u "$path" | tr -d '\r\n'
    else
        printf '%s' "$path"
    fi
}
