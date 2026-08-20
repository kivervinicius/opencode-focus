# Handoff — opencode-focus

## Estado Atual
Implementado e refinado suporte completo ao Zellij terminal multiplexer (renomeação de aba, verificação de foco granular por aba e alternância de aba no clique de notificação).

## Resumo dos Recursos no Zellij
1. **Título da Aba**: Atualiza a aba do Zellij automaticamente com o status (`⠋`, `◉`, `✓`, `✗`) e restaura ao sair.
2. **Supressão Inteligente**: Se a janela do terminal estiver ativa, mas o usuário estiver em outra aba dentro do Zellij, a notificação **é exibida**.
3. **Focar Aba pelo Clique**: Clicar na notificação ativa a janela do SO e alterna direto para a aba do opencode no Zellij.

## Validação
- `npm run typecheck`: OK (0 erros).
