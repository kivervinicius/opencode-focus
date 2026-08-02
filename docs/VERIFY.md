# Validação rápida — opencode-focus

Checklist para rodar antes de declarar uma mudança concluída.

## Sempre

- [ ] `npm test` / `npm run typecheck` verde.
- [ ] Se mudou eventos ou shapes: conferir contra os tipos de `@opencode-ai/plugin` e
      `@opencode-ai/sdk/v2` (union `Event`).
- [ ] Se mudou entrypoints: `exports` do `package.json` `/server` + `/tui` intactos e com
      kind único (server tem `server`, TUI tem `tui`, nunca ambos no mesmo módulo).

## Runtime (GNOME + opencode >= 1.18)

- [ ] `npx opencode-focus status` → ATIVA (exit 0) com a extensão instalada.
- [ ] `get-active` devolve string vazia sem extensão; numérico com a extensão.
- [ ] Terminal focado: NENHUMA notificação chega.
- [ ] Terminal sem foco: conclusão notifica 1x; decisão pendente notifica.
- [ ] Ação "Focar terminal" ativa a janela certa.

## Dicas

- Log de diagnóstico: `tail -f ~/.local/share/opencode/log/opencode-focus.log`.
- Teste de decisão pendente: sessão com permissão `ask` (ver README).