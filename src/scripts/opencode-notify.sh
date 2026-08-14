#!/usr/bin/env bash
set -uo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

summary="${1:-}"
body="${2:-}"
urgency="${3:-normal}"
winid="${4:-}"

DIAG_LOG="${HOME:-.}/.local/share/opencode/log/opencode-focus.log"

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" "$*" >> "$DIAG_LOG" 2>/dev/null || true
}

# 1) notify-send (libnotify) — canal padrão
for cand in notify-send /usr/bin/notify-send /usr/local/bin/notify-send; do
  if command -v "$cand" >/dev/null 2>&1; then
    out=$(timeout 60 "$cand" -a opencode -u "$urgency" --wait --action="focus=Focar terminal" "$summary" "$body" 2>&1)
    rc=$?
    if [ $rc -ne 0 ]; then
      log "opencode-notify: notify-send falhou (rc=$rc): ${out:-sem saída}"
      exit 0
    fi
    case "$out" in
      focus)
        if [ -n "$winid" ]; then
          "$DIR/opencode-focus.sh" activate "$winid" >/dev/null 2>&1
        fi
        ;;
    esac
    exit 0
  fi
done

# 2) fallback: chamada direta ao org.freedesktop.Notifications (máquinas com daemon,
#    mas sem libnotify)
if command -v gdbus >/dev/null 2>&1; then
  gdbus call --session --dest org.freedesktop.Notifications \
    --object-path /org/freedesktop/Notifications \
    --method org.freedesktop.Notifications.Notify opencode 0 "" "$summary" "$body" \
    '[]' "{\"urgency\": <uint32 $([ "$urgency" = critical ] && echo 2 || echo 1)>}" 4500 \
    >/dev/null 2>&1
  exit 0
fi

if command -v dbus-send >/dev/null 2>&1; then
  dbus-send --session --dest=org.freedesktop.Notifications --type=method_call \
    /org/freedesktop/Notifications org.freedesktop.Notifications.Notify \
    string:opencode uint32:0 string: string:"$summary" string:"$body" \
    array:string: dict:string:uint32:urgency,1 int32:4500 >/dev/null 2>&1
  exit 0
fi

# 3) nada disponível — registra com clareza em vez de falhar silenciosamente
log "opencode-notify: notify-send e ferramentas D-Bus ausentes — notificação não exibida: $summary"
exit 0