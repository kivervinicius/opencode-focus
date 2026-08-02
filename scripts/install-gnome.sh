#!/usr/bin/env bash
set -euo pipefail

# Instalador da extensão GNOME Shell "opencode-focus@localhost"
# Uso: scripts/install-gnome.sh
#
# Requisitos: GNOME Shell 45+, sessão X11 ou Wayland, gsettings acessível.

UUID="opencode-focus@localhost"
PKG_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../gnome-extension/$UUID" && pwd)
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
EXT_DIR="$DATA_HOME/gnome-shell/extensions/$UUID"

echo "==> Instalando extensão GNOME '$UUID'"
mkdir -p "$DATA_HOME/gnome-shell/extensions"
cp -r "$PKG_DIR" "$EXT_DIR"
chmod -R u+rw "$EXT_DIR"

CURRENT=$(gsettings get org.gnome.shell enabled-extensions)
echo "   enabled-extensions atual: $CURRENT"
if ! printf '%s' "$CURRENT" | grep -q "$UUID"; then
  # converte ['a', 'b'] -> ["a", "b", "uuid"]
  NEW=$(python3 -c "
import ast, sys, subprocess
cur = gsettings_get = subprocess.run(['gsettings','get','org.gnome.shell','enabled-extensions'],capture_output=True,text=True).stdout.strip()
items = ast.literal_eval(cur) if cur != '@as []' else []
if '$UUID' not in items:
    items.append('$UUID')
print(str(items))
" 2>/dev/null || true)
  if [ -n "${NEW:-}" ]; then
    gsettings set org.gnome.shell enabled-extensions "$NEW"
    echo "   extensão habilitada no gsettings."
  else
    echo "   AVISO: não foi possível atualizar o gsettings automaticamente." >&2
  fi
else
  echo "   extensão já estava habilitada."
fi

echo
if gnome-extensions info "$UUID" >/dev/null 2>&1; then
  echo "==> OK: o GNOME Shell já reconheceu a extensão."
else
  echo "==> A extensão foi instalada, mas o GNOME Shell só a descobre após relogin."
  echo "    Faça logout/login (ou reinicie a sessão gráfica) para ativá-la."
fi
echo
echo "Depois do relogin, valide com:"
echo "  gnome-extensions info $UUID"
echo "  gdbus call --session --dest org.opencode.Focus --object-path /org/opencode/Focus --method org.opencode.Focus.GetActiveWindowID"