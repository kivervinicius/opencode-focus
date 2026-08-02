#!/usr/bin/env bash
set -uo pipefail

CALL="gdbus call --session --dest org.opencode.Focus --object-path /org/opencode/Focus --method org.opencode.Focus"

case "${1:-}" in
  get-active)
    out=$($CALL.GetActiveWindowID 2>/dev/null)
    echo "$out" | sed -n "s/^('\([^']*\)',)$/\1/p"
    ;;
  activate)
    id="${2:-}"
    [ -n "$id" ] && $CALL.ActivateWindow "$id" >/dev/null 2>&1
    ;;
  status)
    gdbus introspect --session --dest org.opencode.Focus --object-path /org/opencode/Focus >/dev/null 2>&1
    ;;
  *)
    echo "uso: opencode-focus.sh get-active|activate <id>|status" >&2
    exit 1
    ;;
esac