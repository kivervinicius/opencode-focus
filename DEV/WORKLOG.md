# Worklog — opencode-focus

## [2026-08-20] Correção de Flicker e Foco Estável por Tab ID no Zellij

### Causa Raiz do Problema
- O loop de spinner de 120ms estava chamando `zellij action rename-tab` a cada 120ms porque o caractere do spinner mudava a cada tick.
- Além disso, a chamada CLI não especificava `--tab-id`, renomeando qualquer aba ativa em que o usuário estivesse, gerando recarregamento de abas e redraw constante na tela.

### Modificações Realizadas
- `src/scripts/opencode-focus.sh`:
  - Adicionado `get-zellij-tab-id` para descobrir o ID numérico estável da aba.
  - Atualizados `rename-zellij-tab`, `undo-rename-zellij-tab` e `is-zellij-tab-focused` para receberem e usarem o `tab_id`.
  - `activate` agora utiliza `zellij action go-to-tab-by-id "$tab_id"`.
- `src/tui.ts`:
  - Captura `zellijTabId` na inicialização.
  - O título da aba do Zellij agora utiliza ícones de status estáveis (`⠋`, `◉`, `✓`, `✗`) sem ciclo a cada 120ms, atualizando o Zellij apenas quando o estado ou passo de execução realmente mudam.
- `src/server.ts`:
  - Utiliza `zellijTabId` para verificar foco de forma precisa.
- Verificado com `npm run typecheck` e testes de execução direta de tab id e foco.
