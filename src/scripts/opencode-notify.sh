#!/usr/bin/env bash
set -uo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

summary="${1:-}"
body="${2:-}"
urgency="${3:-normal}"
winid="${4:-}"

out=$(timeout 60 notify-send -a opencode -u "$urgency" --wait --action="focus=Focar terminal" "$summary" "$body" 2>/dev/null)

case "$out" in
  focus)
    if [ -n "$winid" ]; then
      "$DIR/opencode-focus.sh" activate "$winid" >/dev/null 2>&1
    fi
    ;;
esac