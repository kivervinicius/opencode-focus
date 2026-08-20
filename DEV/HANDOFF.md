# Handoff — opencode-focus

## Estado Atual
Problema de flickering e troca de abas no Zellij corrigido. O plugin agora direciona todas as alterações estritamente para o ID da aba onde o opencode está rodando (`--tab-id`) e não spamma a CLI do Zellij em cada frame de animação.

## Validação
- `npm run typecheck`: OK (0 erros).
- Testes de comando `get-zellij-tab-id` e `is-zellij-tab-focused`: OK.
