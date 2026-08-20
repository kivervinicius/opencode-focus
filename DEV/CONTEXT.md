# Contexto do Projeto — opencode-focus

## Visão Geral

`opencode-focus` é um plugin para OpenCode (>= 1.18) que melhora a visibilidade do estado do assistente no terminal e desktop.

### Componentes

1. **Plugin Server (`src/server.ts`)**: Notificações desktop via `notify-send` / D-Bus (erros, conclusão, retry).
2. **Plugin TUI (`src/tui.ts`)**: Atualização dinâmica do título do terminal com estado (`⠋`, `◉`, `✓`, `✗`) e notificação de decisões pendentes (permissões/perguntas). Suporta integração com Zellij multiplexer.
3. **Helpers (`src/scripts/*.sh`)**: `opencode-focus.sh` (interação D-Bus e CLI Zellij) e `opencode-notify.sh` (disparo de notificações com ação de clique para focar).
4. **Extensão GNOME (`gnome-extension/`)**: Serviço D-Bus em GNOME Shell para detecção de janela ativa e supressão de notificação quando focado.
