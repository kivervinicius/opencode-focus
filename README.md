# opencode-focus

Plugins para o [opencode](https://opencode.ai) que tornam o terminal mais observável:

- **Título da janela com estado** (plugin TUI): o título da aba do terminal mostra o que o opencode está fazendo —
  `⠋ gerando`, `⠇ <título> · ▶ <passo em andamento>`, `◉ <título> · ⏸ esperando permissão`, `✓ concluído`.
- **Notificações minimalistas** (plugin server): notifica apenas quando vale a pena —
  erro (`critical`), decisão pendente ("precisa de você"), conclusão da sessão (1x, com dedupe) e retry (`low`).
  Nada de spam de progresso por mensagem/passo.
- **Clique‐para‐focar** (extensão GNOME opcional): cada notificação tem a ação **"Focar terminal"** e, se o
  terminal estiver com foco, as notificações são suprimidas.

## Funciona em

- Linux (session gráfica com `notify-send`, GNOME para o recurso de foco)
- opencode >= 1.18
- A extensão GNOME exige Wayland (mais seguro) ou X11, GNOME Shell 45–49

No Wayland GNOME, a introspação de janelas é bloqueada por segurança; por isso o foco vem de uma
extensão GNOME própria que expõe dois métodos D-Bus (`org.opencode.Focus`).

## Instalação

### 1. Plugins (server + TUI)

```bash
opencode plugin opencode-focus --global
```

> A sintaxe oficial é `opencode plugin <módulo> [--global]`. O subcomando
> `opencode plugin install` não existe nesta versão (imprime o help sem instalar).

Isso ativa dois plugins:
- **server** — notificações por `notify-send`;
- **TUI** — título da janela e a notificação de decisão pendente (as decisões/perguntas são eventos do TUI,
  portanto só o plugin TUI consegue vê‑las).

Reinicie o opencode para carregar.

### 2. Extensão GNOME (opcional, mas recomendada)

A extensão habilita a supressão por foco e o clique para focar. É uma extensão fora do pacote npm:

```bash
npx opencode-focus setup
```

...e depois **faça logout/login** (o GNOME Shell só descobre extensões novas no login). Valide com:

```bash
npx opencode-focus status
gdbus call --session --dest org.opencode.Focus --object-path /org/opencode/Focus --method org.opencode.Focus.GetActiveWindowID
```

Sem a extensão, os plugins continuam funcionando — apenas notificam sempre (sem supressão por foco) e o
clique não foca.

## Comportamento

| Estado | Título da janela | Notificação |
|---|---|---|
| Gerando | `⠋ <título>` ou `⠇ <título> · ▶ <passo>` | — |
| Pediu permissão/pergunta | `◉ <título> · ⏸ esperando permissão` (ou `resposta`) | `precisa de você` |
| Concluído | `✓ <título>` | `tarefa concluída` (1x/sessão) |
| Erro | `✗ <título>` | `erro` (`critical`) |
| Retry | `⠋ <título>` | `retry` (low) |

Regras:
- **Foco suprime**: com a extensão GNOME ativa, se o terminal já estiver com foco nenhuma notificação é enviada.
- **Dedupe**: conclusão 1x por sessão; erros 1x por mensagem.
- **Atenção do TUI**: o plugin mantém o toggle `terminal.title.toggle` desligado (ele assumine o título).
  Se quiser som dentro do TUI, habilite `tui.attention` em `~/.config/opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "attention": { "enabled": true, "notifications": true, "sound": true, "volume": 0.4 }
}
```

## Diagnóstico

Log de depuração (foco/supressão/falhas de spawn):

```bash
tail -f ~/.local/share/opencode/log/opencode-focus.log
```

## Para testar a decisão pendente

As permissões do usuário mudam quando o modal de permissão abre. Se você opera com permissões liberadas,
crie um diretório de teste:

```bash
mkdir -p /tmp/permtest && tee /tmp/permtest/opencode.json <<'EOF'
{ "permission": { "bash": { "echo MARTELO_*": "ask" } } }
EOF
OPENCODE_CONFIG=/tmp/permtest/opencode.json opencode
```

Depois peça: `use a ferramenta bash para executar: echo MARTELO_1`. O título vira `◉ … ⏸ esperando permissão`
e, se você alt-tab antes de responder, chega a notificação **"opencode · precisa de você"**.

## Desenvolvimento

Documentação completa para desenvolvedores (arquitetura, contrato de plugins, eventos,
como estender, troubleshooting): [**docs/DEVELOPERS.md**](docs/DEVELOPERS.md).

```bash
npm run typecheck   # ou: bunx tsc --noEmit -p tsconfig.json
```

Publicar:

```bash
npm test
git tag v0.1.0 && git push origin v0.1.0   # CI roda o publish automaticamente na tag
# ou manualmente:
npm publish
```

> Os plugins são publicados como **TypeScript**; o opencode (Bun) transpila ao carregar — sem etapa de build.

## Estrutura

```
src/server.ts                     plugin server (notificações)
src/tui.ts                        plugin TUI (título + decisão)
src/scripts/*.sh                 helpers (D-Bus + notify), resolvidos relativos ao pacote
gnome-extension/opencode-focus@…  extensão GNOME (serviço D-Bus org.opencode.Focus)
scripts/install-gnome.sh          instalador da extensão
bin/opencode-focus.mjs            CLI: opencode-focus setup|status
```

## Licença

MIT