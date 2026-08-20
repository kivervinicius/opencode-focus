# Especificação Ativa: Notificação e Título por Aba no Zellij (Sem Piscar)

## Status
Concluído e Validado

## Problema Identificado
1. **Flicker e Troca de Telas**: O spinner de 120ms estava chamando `zellij action rename-tab` a cada frame (8x/segundo) com um caractere diferente do spinner (`⠋`, `⠙`, `⠹`...), sem especificar o ID da aba (`--tab-id`).
2. Isso fazia com que o Zellij renomeasse qualquer aba que estivesse com foco no momento da chamada CLI, causando redraw contínuo e piscamento na barra de abas.

## Solução Implementada
1. **Captura Estável do Tab ID**:
   - `get-zellij-tab-id`: captura o ID da aba do opencode na inicialização (`current-tab-info -> id`).
   - Todos os comandos passam `--tab-id "$tabId"`, garantindo que **apenas a aba do opencode seja alterada**, sem nunca afetar a aba onde o usuário está trabalhando.
2. **Ícone Estático na Aba do Zellij**:
   - O terminal continua com a animação suave do spinner via OSC padrão, mas o Zellij usa prefixo estático (`⠋`, `◉`, `✓`, `✗`).
   - O `rename-tab` no Zellij só é disparado quando o **estado real ou o texto mudam** (ao iniciar execução, mudar passo todo, aguardar permissão, concluir ou dar erro), em vez de 8 vezes por segundo.
3. **Detecção de Foco por Tab ID**:
   - `is-zellij-tab-focused <tabId>` compara o ID da aba ativa com o `zellijTabId`.
4. **Clique para Focar por Tab ID**:
   - `zellij action go-to-tab-by-id "$tabId"` troca diretamente para a aba correta ao clicar em "Focar terminal".
