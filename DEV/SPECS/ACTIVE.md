# Especificação Ativa: Notificação e Título por Aba no Zellij

## Status
Concluído e Aprimorado

## Motivação
No multiplexer Zellij:
1. Sequências ANSI/OSC padrão de alteração de título (`OSC 0/2`) não alteram o nome da aba no bar do Zellij.
2. A supressão por foco via janela do SO (GNOME Terminal) marcaria opencode como "focado" mesmo se o usuário estivesse interagindo em outra aba dentro do Zellij.

## Requisitos Implementados
1. **Renomeação Dinâmica da Aba no Zellij**:
   - `rename-zellij-tab <name>`: executa `zellij action rename-tab "$name"`.
   - `undo-rename-zellij-tab`: executa `zellij action undo-rename-tab` ao sair.
2. **Detecção de Foco em Aba do Zellij**:
   - `is-zellij-tab-focused <name>`: verifica se a aba ativa no Zellij é a aba do opencode.
   - Se o usuário estiver em outra aba do Zellij, o opencode reconhece que o usuário não está olhando para ele e **envia a notificação desktop**.
3. **Clique para Focar Aba no Zellij**:
   - Ao clicar em "Focar terminal" na notificação desktop, o script ativa a janela do SO e executa `zellij action go-to-tab-name "<title>"`, alternando direto para a aba do opencode dentro do Zellij.
