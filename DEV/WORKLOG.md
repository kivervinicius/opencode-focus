# Worklog — opencode-focus

## [2026-08-20] Suporte Completo a Abas no Zellij (Título + Foco + Notificação)

### O que foi feito
- Implementada renomeação de aba do Zellij via `zellij action rename-tab` no plugin TUI (`src/tui.ts`).
- Implementada restauração do nome original da aba no Zellij (`undo-rename-zellij-tab`) no descarte (`onDispose`).
- Implementada verificação inteligente de foco em aba no Zellij (`is-zellij-tab-focused`): se a janela do SO estiver focada, mas o usuário estiver em outra aba dentro do Zellij, a notificação **não é suprimida**, garantindo que o usuário seja alertado.
- Implementado suporte a clique na notificação para focar diretamente a aba no Zellij (`zellij action go-to-tab-name`).
- Atualizados `src/server.ts`, `src/tui.ts`, `src/scripts/opencode-focus.sh`, `src/scripts/opencode-notify.sh`.
- Atualizados `README.md` e `docs/DEVELOPERS.md`.
- Verificado com `npm run typecheck` (0 erros).
