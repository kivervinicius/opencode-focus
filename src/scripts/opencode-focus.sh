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
    tab_id="${3:-}"
    [ -n "$id" ] && $CALL.ActivateWindow "$id" >/dev/null 2>&1
    if [ -n "$tab_id" ] && [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ] && command -v zellij >/dev/null 2>&1; then
      zellij action go-to-tab-by-id "$tab_id" >/dev/null 2>&1 || zellij action go-to-tab-name "$tab_id" >/dev/null 2>&1
    fi
    ;;
  status)
    gdbus introspect --session --dest org.opencode.Focus --object-path /org/opencode/Focus >/dev/null 2>&1
    ;;
  get-zellij-tab-id)
    if [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ] && command -v zellij >/dev/null 2>&1; then
      zellij action current-tab-info 2>/dev/null | grep -E '^id:' | sed 's/^id:[[:space:]]*//'
    fi
    ;;
  rename-zellij-tab)
    tab_id="${2:-}"
    name="${3:-}"
    if [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ] && command -v zellij >/dev/null 2>&1; then
      if [ -n "$tab_id" ] && [ -n "$name" ]; then
        zellij action rename-tab --tab-id "$tab_id" "$name" >/dev/null 2>&1
      elif [ -n "$name" ]; then
        zellij action rename-tab "$name" >/dev/null 2>&1
      fi
    fi
    ;;
  undo-rename-zellij-tab)
    tab_id="${2:-}"
    if [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ] && command -v zellij >/dev/null 2>&1; then
      if [ -n "$tab_id" ]; then
        zellij action undo-rename-tab --tab-id "$tab_id" >/dev/null 2>&1
      else
        zellij action undo-rename-tab >/dev/null 2>&1
      fi
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
    tab_id="${2:-}"
    if [ -n "${ZELLIJ:-}${ZELLIJ_SESSION_NAME:-}" ] && command -v zellij >/dev/null 2>&1; then
      [ -z "$tab_id" ] && exit 0
      curr=$(zellij action current-tab-info 2>/dev/null | grep -E '^id:' | sed 's/^id:[[:space:]]*//')
      if [ -n "$curr" ] && [ "$curr" = "$tab_id" ]; then
        exit 0
      else
        exit 1
      fi
    fi
    exit 0
    ;;
  *)
    echo "uso: opencode-focus.sh get-active|activate <id> [tab_id]|status|get-zellij-tab-id|rename-zellij-tab <tab_id> <name>|undo-rename-zellij-tab [tab_id]|is-zellij|is-zellij-tab-focused <tab_id>" >&2
    exit 1
    ;;
esac