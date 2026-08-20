# opencode-focus

Plugins para o [opencode](https://opencode.ai) que tornam o terminal mais observável:

- **Título da janela com estado** (plugin TUI): o título da aba do terminal mostra o que o opencode está fazendo —
  `⠋ gerando`, `⠇ <título> · ▶ <passo em andamento>`, `◉ <título> · ⏸ esperando permissão`, `✓ concluído`.
- **Notificações minimalistas** (plugin server): notifica apenas quando vale a pena —
  erro (`critical`), decisão pendente ("precisa de você"), conclusão da sessão (1x, com dedupe) e retry (`low`).
  Nada de spam de progresso por mensagem/passo.
- **Suporte a Zellij**: renomeia a aba do Zellij automaticamente com o título de estado (`⠋`, `◉`, `✓`, `✗`) e restaura o nome ao sair.

## Funciona em

- Linux (session gráfica com `notify-send`, GNOME para o recurso de foco)
- Zellij terminal multiplexer (`zellij action rename-tab` automático)
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

### Migração de plugins locais antigos

Se o título da janela piscar com caracteres no fundo, ou as notificações chegarem duplicadas, provavelmente
há **plugins locais antigos** (de instalações anteriores feitas por cópia) convivendo com o pacote:

- **`~/.config/opencode/tui.json`** → remova entradas locais de título como `"./tui-status-title.ts"`
  (o array deve conter apenas `"opencode-focus"`).
- **`~/.config/opencode/plugin/` e `~/.config/opencode/plugins/`** → o opencode **carrega automaticamente**
  qualquer `*.ts`/`*.js` dessas pastas como plugin server (`Glob.scan("{plugin,plugins}/*.{ts,js}")`).
  Remova cópias antigas como `notify-status.ts`, mesmo que não estejam listadas no `opencode.json`.
- **`~/.config/opencode/scripts/`** → cópias antigas de scripts auxiliares usadas pelos plugins acima.

Não apague: apenas mova para um backup (ex.: `~/.config/opencode/backup-<data>/`).

O pacote já se protege contra recorrência: o plugin TUI usa uma KV compartilhada
(`opencode_focus_title_owner`) com heartbeat — só a primeira instância carregada escreve o título
da janela; as demais se desligam. Mesmo que duas cópias estejam carregadas, não há duplo toggle
nem escrita concorrente no título.

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
- **Decisão pendente** usa `api.attention.notify()` do TUI (alerta dentro do próprio terminal) **e** tenta
  `notify-send` quando disponível — funciona mesmo sem libnotify/notify-send instalado (ex.: sem sessão gráfica).
- **Foco suprime**: com a extensão GNOME ativa, se o terminal já estiver com foco nenhuma notificação é enviada.
- **Dedupe**: conclusão 1x por sessão; erros 1x por mensagem.
- **Janelas independentes**: cada processo opencode tem o próprio título; abrir o opencode em outro projeto
  ao mesmo tempo (ex.: um workspace de VPN + este) não bloqueia nem exige "ativar/desativar" o plugin.
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

Se a notificação não aparecer, o log explica o motivo (ex.: `notify-send ... ausentes`). Para notificações
de sistema reais (erros, conclusão, retry via server), instale `libnotify-bin`:

```bash
sudo apt install libnotify-bin
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