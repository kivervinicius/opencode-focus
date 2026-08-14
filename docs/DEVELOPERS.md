# Manual de Desenvolvimento — opencode-focus

Manual extensivo para desenvolvedores que vão manter, estender ou entender o pacote
`opencode-focus`. Cobre arquitetura, contrato de plugins, cada componente, fluxo de dados,
ambientes, testes, publicação e troubleshooting.

> Leitura mínima para começar: seções 1, 2, 3 e 5.
> Leitura completa antes de alterar eventos, títulos ou notificações.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Pré-requisitos e ambiente](#3-pré-requisitos-e-ambiente)
4. [Layout do repositório](#4-layout-do-repositório)
5. [Contrato de plugins do opencode](#5-contrato-de-plugins-do-opencode)
6. [Plugin server — `src/server.ts`](#6-plugin-server)
7. [Plugin TUI — `src/tui.ts`](#7-plugin-tui)
8. [Extensão GNOME — `gnome-extension/`](#8-extensão-gnome)
9. [Scripts auxiliares — `src/scripts/*.sh`](#9-scripts-auxiliares)
10. [CLI — `bin/opencode-focus.mjs`](#10-cli)
11. [Referência de eventos](#11-referência-de-eventos)
12. [Estados e máquina de título](#12-estados-e-máquina-de-título)
13. [Desenvolvimento local](#13-desenvolvimento-local)
14. [Testes e verificação](#14-testes-e-verificação)
15. [Publicação](#15-publicação)
16. [Como estender](#16-como-estender)
17. [Troubleshooting](#17-troubleshooting)
18. [FAQ de contribuição](#18-faq-de-contribuição)

---

## 1. Visão geral

`opencode-focus` é um pacote npm (`opencode-focus`) que agrupa:

| Componente | Tipo | O que faz |
|---|---|---|
| `src/server.ts` | Plugin **server** | Notificações de erro, retry e conclusão via `notify-send` |
| `src/tui.ts` | Plugin **TUI** | Título da janela com estado e notificação de decisão pendente |
| `src/scripts/*.sh` | Helpers | Bridge D-Bus (`org.opencode.Focus`) + disparo do `notify-send` |
| `gnome-extension/` | Extensão GNOME Shell | Expõe D-Bus: janela ativa + ativar janela por ID |
| `bin/opencode-focus.mjs` | CLI | `opencode-focus setup` / `status` (instalação da extensão) |
| `scripts/install-gnome.sh` | Instalador | Instala e habilita a extensão no GNOME |
| `.github/workflows/` | CI/CD | Typecheck (CI) + publish npm (tags) |

Princípios de design:

- **Sem spam.** Só notifica quando o usuário precisa de atenção: erro, decisão pendente,
  conclusão (1x/sessão), retry. Noção de progresso é assunto do título, não do desktop.
- **Foco suprime.** Com a extensão GNOME ativa, se o terminal do opencode já estiver com
  foco, nada é notificado — o usuário está olhando para a janela.
- **Clique-foca.** A notificação tem ação "Focar terminal", que ativa a janela correta no
  desktop (via `ActivateWindow`).

---

## 2. Arquitetura

```
┌─────────────┐  cria entradas   ┌──────────────────────────────────────┐
│  opencode   │◄─────────────────│  pacote npm opencode-focus          │
│  (Bun)      │                  │  exports: ./server | ./tui          │
└─────────────┘                  └──────────────┬───────────────────────┘
      │  eventos de sessão (server)             │
      │  renderer/state (TUI)                   │
      ▼                                         ▼
 ┌─────────────┐   notify-send        ┌─────────────────┐
 │ GNOME Shell │◄─────────────────────│ opencode-notify │
 │ notificação │                      │ (script .sh)    │
 └─────────────┘                      └────────▲────────┘
                                               │  D-Bus org.opencode.Focus
                                      ┌────────┴─────────┐
                                      │ extensão GNOME   │
                                      └──────────────────┘
```

Fluxo principal (decisão pendente):

1. O TUI recebe `permission.asked` e muda o título para `◉ … ⏸ esperando permissão`.
2. O plugin TUI verifica foco por D-Bus (`get-active`).
3. Se o terminal não estiver com foco, dispara `src/scripts/opencode-notify.sh`.
4. O script chama `notify-send` com `--wait` e ação "Focar terminal".
5. Se o usuário clicar em "Focar terminal", o D-Bus chama `ActivateWindow`.

Fluxo de erro/extensão ausente: se a extensão GNOME não estiver ativa, `get-active`
devolve string vazia → `terminalIsFocused()` retorna `false` → **nada é suprimido** —
os plugins continuam funcionando, apenas sem supressão e sem focar na ação.

---

## 3. Pré-requisitos e ambiente

| Requisito | Versão mínima | Notas |
|---|---|---|
| opencode | 1.18+ | definido em `package.json` `engines.opencode` |
| Node.js | 20+ | para o CLI; o plugin em si roda sob o Bun embutido do opencode |
| Linux com `notify-send` | — | pacote `libnotify` / `libnotify-bin` |
| GNOME Shell (opcional) | 45–48 | para a extensão; exige D-Bus de sessão |

Shell dos scripts: `#!/usr/bin/env bash` com `set -uo pipefail`. O `opencode-focus.sh`
**não** usa `set -e` de propósito: falhas de D-Bus (extensão ausente) devem ser toleradas e
retornar saída vazia, não derrubar quem o chama.

No plugin usa-se `Bun.spawn[Sync]` para lançar os scripts — **não** `child_process`. O
opencode roda sob Bun, então `Bun` é global. Os types declaram `Bun` e `require`
localmente no código para o typecheck de TS não acusar.

---

## 4. Layout do repositório

```
opencode-focus/
├── bin/
│   └── opencode-focus.mjs        CLI: setup | status
├── gnome-extension/
│   └── opencode-focus@localhost/
│       ├── extension.js          implementação do serviço D-Bus
│       └── metadata.json         uuid / name / shell-version
├── src/
│   ├── scripts/
│   │   ├── opencode-focus.sh     cliente D-Bus (get-active, activate, status)
│   │   └── opencode-notify.sh    notify-send com ação "Focar terminal"
│   ├── server.ts                 plugin server
│   ├── tui.ts                    plugin TUI
│   └── process.d.ts              declaração do contexto `process` p/ TS
├── docs/
│   ├── DEVELOPERS.md             este manual
│   └── VERIFY.md                 validações rápidas pós-mudança
├── .github/workflows/
│   ├── ci.yml                    typecheck
│   └── publish.yml               npm publish em tag v*
├── scripts/
│   └── install-gnome.sh          instalador da extensão
├── package.json
├── tsconfig.json
└── README.md
```

`node_modules/` e `dist/` estão no `.gitignore`. Não há etapa de build: o TS é publicado
direto e o opencode (Bun) transpila na carga.

---

## 5. Contrato de plugins do opencode

### 5.1 Módulos de entrada

O `package.json` expõe dois pontos de entrada, cada um com um único kind:

```json
{
  "exports": {
    "./server": "./src/server.ts",
    "./tui": "./src/tui.ts"
  }
}
```

Regras do contrato (v1):

- Módulos do plugin são **target-exclusive**: um módulo com `server` não pode exportar
  `tui` e vice-versa. `opencode-focus` respeita isso com arquivos separados.
- O opencode resolve `exports["./server"]` para o runtime server e `exports["./tui"]`
  para o runtime TUI.
- A default export é um **objeto** v1: `{ id, server }` (em `src/server.ts`) e
  `{ id, tui }` (em `src/tui.ts`), validados por `readV1Plugin`.
- O runtime server tem também fallback **v0/legacy** (default export como função, aceito
  via `getLegacyPlugins`), mas o pacote **não o usa** — as duas entradas são v1.
- Para o **TUI**, o default export **deve** ser umobjeto `{ id?, tui }` (sem server).

Atenção à **descoberta automática de plugins locais**: o opencode varre o diretório de config global com
`Glob.scan("{plugin,plugins}/*.{ts,js}")` (`packages/opencode/src/config/plugin.ts`) — qualquer arquivo
nessas pastas vira um plugin **server**, mesmo sem estar listado em `opencode.json`. Um resquício de
instalação antiga ali (ex.: `notify-status.ts`) roda junto com o pacote e causa lixo no TUI
(se fizer `console.error`) e notificações duplicadas. Sempre remova esses arquivos (backup) ao migrar.

### 5.1.1 Lock de título entre instâncias (KV)

Duas cópias do plugin TUI carregadas ao mesmo tempo (pacote + cópia local antiga) escreviam o título da
janela em paralelo (spinner a cada 120ms) e davam duplo toggle em `terminal.title.toggle` — o resultado
é lixo visual no fundo do TUI (sequência OSC `ESC]0;…` intercalada com o repaint). O `src/tui.ts` se
protege com um lock via KV compartilhada do TUI:

- Chave: `opencode_focus_title_owner` (valor `{ instance, pid, ts }`); a chave `plugin_enabled` é
  reservada pelo runtime (`KV_KEY` em `plugin/tui/runtime.ts`) — nunca use.
- O lock é **escopado por processo** (`pid`): janelas abertas em processos diferentes (ex.: opencode
  rodando em outro projeto ao mesmo tempo) nunca se bloqueiam e cada janela tem o próprio título.
  Apenas cópias duplicadas do plugin dentro do **mesmo** processo disputam o lock (a primeira
  carregada vence; as demais retornam cedo).
- `acquireTitleLock()`: se existe um owner de outra instância **do mesmo processo** com `ts` recente
  (< 5s), a instância retorna cedo (sem toggle, sem título, sem listeners). Registros antigos (de
  versões anteriores, sem `pid`) não bloqueiam — a nova instância toma posse.
- Heartbeat: a instância dona renova o `ts` a cada 2s (instâncias mortas/crash são substituídas após o
  tempo de stale).
- `lifecycle.onDispose`: se ainda é o owner, limpa a chave.

### 5.2 Tipos de referência

Os tipos vêm de:

- `@opencode-ai/plugin` — `Plugin`, `PluginModule`, `PluginInput` (server)
- `@opencode-ai/plugin/tui` — `TuiPluginModule`, `TuiPluginApi`, `TuiState`
- `@opencode-ai/sdk` — client tipado (`/session`, `/message`, etc.)
- `@opencode-ai/sdk/v2` — o union `Event` usado nos handlers do TUI

As devDependencies usam `^1.18.11`; o peer é `@opencode-ai/plugin >=1.0.85`. Os typings
são só type-time, mas mantenha dev e peer próximos para não divergir da runtime instalada.

---

## 6. Plugin server

Em `src/server.ts`:

- recebe `({ client })` — client HTTP para a API do opencode;
- retorna um objeto de hooks com `event` handler;
- computa `windowId` no início (`captureWindowId`) e usa `terminalIsFocused()` para
  suprimir;
- mantém estado em memória (`Map`s/Sets) para dedupe — **sem persistência** entre
  execuções do opencode.

### 6.1 Mapa de eventos tratados

| Evento | Condição | Ação | Dedupe |
|---|---|---|---|
| `session.created` / `session.updated` | `properties.info.title` / `.directory` presentes | cacheia título e diretório por `sessionID` | — |
| `session.idle` | — | notifica "tarefa concluída" (1×/sessão) | `notified` set |
| `message.updated` | `info.role === "assistant"` e `info.error` existe | notifica "erro" (urgency `critical`) com resumo (300 chars) | `errorMessages` (sessionID:messageID) |
| `session.error` | `properties.sessionID` / `error` | notifica "erro de sessão" (critical) | — |
| `session.status` | `status.type === "retry"` | notifica "retry" (low) | — |

### 6.2 Supressão por foco

`terminalIsFocused()` compara o `windowId` capturado com a saída atual de `get-active`.
Se iguais (extensão ativa + terminal focado) → `notify()` retorna cedo, sem notificação.

### 6.3 Log de diagnóstico

`diag(...)` grava em `~/.local/share/opencode/log/opencode-focus.log`. Registra decisões
de supressão, envio, falha de spawn, captura de window. Log de append, sem rotação —
atenção em uso contínuo prolongado.

---

## 7. Plugin TUI

Em `src/tui.ts`:

- exporta `{ id: "opencode-status-title", tui } satisfies TuiPluginModule`;
- no início, se a KV `terminal_title_enabled` for `true`, chama
  `command?.trigger("terminal.title.toggle")` para **desligar o título embutido** do host
  e assumir o controle;
- mantém uma máquina de estado local: `idé | busy | error | waiting`.

### 7.1 API usada

| API | Uso |
|---|---|
| `api.renderer` | `setTerminalTitle(truncate(...))` |
| `api.event` | `on("session.status" | "session.idle" | "session.error" | "todo.updated" | …)` |
| `api.state.session` | `get`, `status`, `todo`, `permission`, `question` |
| `api.route.current` | rota atual e `sessionID` |
| `api.kv` | lê `terminal_title_enabled` |
| `api.command` | deprecado — trigger do toggle (migrar para keymap) |
| `api.lifecycle` | `onDispose` limpa título e para o spinner |

### 7.2 Estados de título

| Estado | Prefixo no render | Exemplo de título |
|---|---|---|
| `busy` | spinner (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) | `⠋ minhafunc` / `⠇ título · ▶ passo` |
| `waiting` | `◉` + `⏸ esperando permissão` / `sua resposta` | `◉ título · ⏸ esperando permissão` |
| `idle` | `✓` | `✓ título` |
| `error` | `✗` | `✗ título` |

- `render()` é chamada em mudanças de sessão/todo; `setStatus` controla o intervalo do
  spinner (`startSpinner`/`stopSpinner`).
- `sessionTitle()` tenta título real e cai para `sessionID`/`opencode`.
- `waitingReason()` usa `state.session.permission()` e `state.session.question()`.

### 7.3 Notificação de decisão (TUI-only)

`permission.asked` e `question.asked`:

- mudam o status para `waiting` e chamam `notifyDecision(key, body)`;
- têm dedupe por `id` do evento (`permission:<id>` / `question:<id>`);
- também aplicam supressão por foco (via `get-active` + windowId local);
- usam o mesmo `opencode-notify.sh`.

Por que isso vive no TUI e não no server? Porque `permission.asked` e `question.asked`
são **eventos client-side (TUI)**, só aparecem em `api.event` do runtime TUI — o server
não os vê.

---

## 8. Extensão GNOME

Em `gnome-extension/opencode-focus@localhost/`:

- `metadata.json`: UUID `opencode-focus@localhost`, `shell-version` `["45"…"52"]`,
  `version`, `url`. Precisa bater com o shell instalado (GNOME Shell 45+).
- `extension.js`: exporta uma classe com `enable`/`disable`.

### 8.1 Serviço D-Bus

Exports (D-Bus de sessão), interface `org.opencode.Focus`:

```
GetActiveWindowID() → (s)      # global.display.focuu (string ID da janela ativa)
ActivateWindow(id: s)          # ativa a janela por ID via Meta
currentWin() / daemon de polling
```

O plugin server e o TUI chamam esses métodos via `opencode-focus.sh` (`gdbus call`).

### 8.2 Por que D-Bus e não IPC serial ou arquivo?

- Wayland bloqueia introspecção de janelas client-side; o GNOME Shell é o único que
  conhece a janela ativa com segurança.
- Caminho explícito, sem depender de variável de ambiente propagada para o servidor.

---

## 9. Scripts auxiliares (`src/scripts/*.sh`)

### `opencode-focus.sh`

```bash
opencode-focus.sh get-active       # imprime o ID da janela ativa (vazio se extensão ausente)
opencode-focus.sh activate <id>    # foca a janela de id
opencode-focus.sh status           # sai 0 se a interface D-Bus existe
```

- usa `gdbus call --session --dest org.opencode.Focus ...`;
- `get-active`: extrai a string do output (`sed` para remover aspas);
- sem `set -e` para tolerar extensão ausente.

### `opencode-notify.sh`

```bash
opencode-notify.sh [summary] [body] [urgency] [winid]
```

- tenta `notify-send -a opencode -u <urgency> --wait --action="focus=Focar terminal"`;
- **`--wait`** é obrigatório para a ação funcionar depois do click;
- `timeout 60` para não deixar processos zumbis;
- se a ação devolvida for `focus`, chama `opencode-focus.sh activate "$winid"`;
- **resiliência**: se `notify-send` não estiver instalado, cai para uma chamada D-Bus direta
  a `org.freedesktop.Notifications` (`gdbus`/`dbus-send`) quando existir; se não houver canal algum,
  registra o motivo no `opencode-focus.log` (nunca falha silenciosamente). O plugin TUI ainda assim
  avisa "precisa de você" via `api.attention.notify()` (dentro do terminal, sem depender de `notify-send`),
  então a decisão pendente sempre gera alerta mesmo em ambientes headless sem libnotify.

---

## 10. CLI

`bin/opencode-focus.mjs` (Node, roda fora do Bun):

```bash
npx opencode-focus setup    # instala/habilita a extensão GNOME (precisa relogin)
npx opencode-focus status    # exit 0 = ativa; exit 1 = inativa
```

- resolve caminhos relativos a `bin/` com `import.meta.url`;
- `setup` roda `scripts/install-gnome.sh` com `execFileSync(…, { stdio: "inherit" })`.

---

## 11. Referência de eventos

### Eventos alvo

| Evento | Shape | Plugin que trata |
|---|---|---|
| `session.created` / `session.updated` | `properties.info: { title?, directory? }` | server (cacheia título) |
| `session.idle` | `properties.sessionID` | server (concluído) e TUI (título `✓`) |
| `session.error` | `properties.sessionID? | error?` | server (erro) e TUI (título `✗`) |
| `session.status` | `properties.sessionID`, `status.type` (busy/retry/idle) | server (retry) e TUI (busy/idle) |
| `message.updated` | `properties.info: { sessionID, role, error? }` | server (erro de mensagem) |
| `todo.updated` | estado do todo da sessão | TUI (passo ativo) |
| `permission.asked` | `properties.id`, `properties.permission` | TUI (decisão) |
| `permission.replied` | `properties.id` | TUI (volta a refletir status) |
| `question.asked` | `properties.id`, `properties.questions[]` | TUI (decisão) |
| `question.replied` / `question.rejected` | `properties.id` | TUI (volta a refletir status) |

**Atenção**: o shape de `message.updated` tem `info.error` (objeto), o que permite
dedup por mensagem. Para `session.error`, é um único por sessão — sem dedupe.

---

## 12. Estados e máquinas de título

`render()` compõe: `<prefixo> <base> [ · ▶ <todo ativo> ] [ · ⏸ esperando <motivo> ]`,
truncado em 90 caracteres.

- `busy`: spinner + passo ativo (todo `in_progress`).
- `idle`: prefixo `✓`.
- `waiting`: prefixo `◉` quando há `permission()` ou `question()` não vazios; motivo
  `permissão` ou `sua resposta`.
- `error`: prefixo `✗` no TUI quando `session.error`.

O TUI atualiza título; o server envia notificação. São mudanças **independentes** — se o
server nunca vê `session.error` para uma falha específica (erro de ferramenta vira
`message.updated` com role `assistant` e `error`), o título `✗` também não aparece. Por
isso `src/tui.ts` trata `message.updated` com `info.error` como `✗`.

---

## 13. Desenvolvimento local

```bash
bun install           # ou npm install
npm run typecheck     # tsc --noEmit -p tsconfig.json  (também é o "test")
```

Testar o plugin sem publicar (a partir do opencode):

```bash
opencode plugin add /projetos/tools/opencode-focus --dir     # plugin de local
# ou copiar para node_modules da config e list
opencode plugin list --local
```

A extensão GNOME se instala com `npx opencode-focus setup` (plug à parte; instala no
`$XDG_DATA_HOME/gnome-shell/extensions/<uuid>` e habilita no gsettings `enabled-extensions`).

---

## 14. Testes e verificação

- `npm test` executas — na verdade roda `tsc --noEmit` (sem testes unitários).
- CI roda `bun install --frozen-lockfile && bunx tsc --noEmit`.
- Publicação roda `npm test && npm publish` quando a tag é `v*`.

Validação manual (GNOME):

```bash
npx opencode-focus status                      # extensão presente?
gdbus call --session --dest org.opencode.Focus --object-path /org/opencode/Focus --method org.opencode.Focus.GetActiveWindowID
tail -f ~/.local/share/opencode/log/opencode-focus.log
```

---

## 15. Publicação

```bash
npm version patch        # bump + tag
git push origin <tag>    # roda publish.yml → npm publish
# ou manual:
npm test && npm publish
```

O pacote publica `src/`, `bin/`, `scripts/`, `gnome-extension/` (via field `files`),
sem build. `types`/TS direto.

---

## 16. Como estender

- **Novo evento server**: adicione `case` no `event` em `src/server.ts`, use um `Set` de
  dedup se repetir.
- **Nota ítulo no decorrante**: mude `render()` em `src/tui.ts` (título/prefixo/spinner).
- **Nova ação da notificação**: adicione `--action` em `opencode-notify.sh` e outro `case`.
- **Som de atenção**: o host opencode tem `tui.attention` (som/notificação no TUI) —
  não duplicar aqui.
- **chave KV**: `terminal_title_enabled` é usada pelo built-in. Se mudar o comportamento,
  ajuste também a tologagem no TUI (`kv.get`) e no `app.tsx` do host.

---

## 17. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Nada é notificado | terminal focado (supressão) | alt-tab para fora; extensão se presente |
| Extensão ausente → ainda notifica | `get-active` vazio → `terminalIsFocused` false | `npx opencode-focus setup` + relogin |
| "Focar terminal" não age | extensão não carregou / windowId vazio | valide D-Bus; veja o log |
| Notificação some em <1s | `--wait` removido | restaurar `--wait` no script |
| Erro `KEYMAP.terminal.title…` | opencode < 1.18 | atualizar opencode |
| Título `✗` nunca aparece | erro só chega como `message.error` no TUI | tratado em `tui.ts` de par com `message.error` |
| Spam "tarefa concluída" | novo processo novo dedupe (memória) | esperado: 1×/execução |
| CLI diz INATIVA após setup | extensão ainda em relogin / `gnome-extensions` não recarregou | logout/login |

---

## 18. FAQ de contribuição

- **Preciso de GNOME?** Não para o título/notificações; sim para supressão por foco e clicar.
- **Wayland ou X11?** Os dois, com D-Bus do shell do GNOME.
- **Opencode não-GNOME (KDE etc.)?** `notify-send` existe; a supressão por foco definitiva
  depende da extensão GNOME.
- **Por que `Bun.spawn` e não `child_process`?** O plugin roda no Bun; é a forma idiomática.
  O CLI (Node) usa `child_process`.
- **Posso tratar `permission/question` no server?** Não — são eventos TUI-only.

---

*Manual mantido junto ao código. Atualize este arquivo sempre que mudar o contrato de
eventos, os entrypoints, os scripts shell ou o comportamento de notificação.*