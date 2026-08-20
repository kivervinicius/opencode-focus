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
    tab="${3:-}"
    [ -n "$id" ] && $CALL.ActivateWindow "$id" >/dev/null 2>&1
    if [ -n "$tab" ] && [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ] && command -v zellij >/dev/null 2>&1; then
      zellij action go-to-tab-name "$tab" >/dev/null 2>&1
    fi
    ;;
  status)
    gdbus introspect --session --dest org.opencode.Focus --object-path /org/opencode/Focus >/dev/null 2>&1
    ;;
  rename-zellij-tab)
    name="${2:-}"
    if [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ] && command -v zellij >/dev/null 2>&1; then
      [ -n "$name" ] && zellij action rename-tab "$name" >/dev/null 2>&1
    fi
    ;;
  undo-rename-zellij-tab)
    if [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ] && command -v zellij >/dev/null 2>&1; then
      zellij action undo-rename-tab >/dev/null 2>&1
    fi
    ;;
  is-zellij)
    if [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ]; then
      exit 0
    else
      exit 1
    fi
    ;;
  is-zellij-tab-focused)
    name="${2:-}"
    if [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ] && command -v zellij >/dev/null 2>&1; then
      [ -z "$name" ] && exit 0
      curr=$(zellij action current-tab-info 2>/dev/null | grep -E '^name:' | sed 's/^name:[[:space:]]*//')
      if [ "$curr" = "$name" ]; then
        exit 0
      else
        exit 1
      fi
    fi
    exit 0
    ;;
  *)
    echo "uso: opencode-focus.sh get-active|activate <id> [tab]|status|rename-zellij-tab <name>|undo-rename-zellij-tab|is-zellij|is-zellij-tab-focused <name>" >&2
    exit 1
    ;;
esac