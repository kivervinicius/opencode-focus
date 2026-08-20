# Plano de Verificação e Validação — opencode-focus

## Verificações Automatizadas
- [x] `npm run typecheck` (`tsc --noEmit -p tsconfig.json`) -> passou sem erros.

## Testes Manuais de Zellij
- [x] `src/scripts/opencode-focus.sh is-zellij` retorou status apropriado dependendo das env vars ZELLIJ.
- [x] `src/scripts/opencode-focus.sh rename-zellij-tab "teste"` executado com sucesso no Zellij.
- [x] `src/scripts/opencode-focus.sh undo-rename-zellij-tab` restaurou a aba.
- [x] Validação da compilação dos plugins TypeScript (`src/server.ts` e `src/tui.ts`).
