# Ficha de RPG

Ficha de personagem editável com rolador de dados. Funciona 100% no dispositivo: sem servidor, sem conta, sem internet.

## Como abrir

| Onde | Como |
|---|---|
| **PC** | Duplo clique em **"Ficha de RPG"** na Área de Trabalho. Abre numa janela própria; feche no X. |
| **PC (atalho sumiu ou pasta mudou de lugar)** | Clique direito em `criar-atalho.ps1` → *Executar com o PowerShell*. |
| **Navegador** | Abra o `index.html`. |
| **Celular** | Precisa estar hospedado em `https://` (ex.: GitHub Pages). Depois: Android → menu ⋮ → *Instalar app*; iPhone → Compartilhar → *Adicionar à Tela de Início*. |

## Como usar

- **Preencher a ficha:** é só digitar. Tudo é salvo automaticamente.
- **Editar layout:** botão no topo. Libera arrastar campos e seções pela alça ⠿ (ou setas do teclado), renomear, adicionar, excluir e mudar o estilo da seção. Clique em **Concluir** para travar de novo.
- **Rolar dados:** escolha o dado, quantidade, bônus e o modo (**Somar tudo** ou **Maior resultado**).
- **Macros:** atalhos de rolagem. A quantidade de dados e o bônus podem vir de campos da ficha (ex.: `[Força]d20 (maior) + [Luta]`), sempre com o valor atual. Também dá para somar **dados de bônus** (ex.: `1d20 + 1d6 + 2d4 + 3`) — eles são sempre somados, mesmo no modo "Maior resultado".
- **Backup:** menu **⋯ → Exportar** gera um `.json`; **Importar** carrega de volta. Use isso para passar a ficha entre PC e celular — cada aparelho guarda os seus próprios dados.

## Onde ficam os dados

No `localStorage` do navegador, chave `ficha-rpg-v1`. Limpar os dados do site apaga a ficha — exporte backups.

## Estrutura do código

Sem frameworks e sem build. Os scripts são carregados em ordem pelo `index.html` e compartilham o objeto global `Ficha` (ES modules não funcionam em `file://`, que é como o atalho do PC abre o app).

```
index.html            estrutura da página
style.css             visual (tema claro/escuro automático)
js/
  core.js             DOMÍNIO — regras da ficha, macros e dados (sem DOM)
  storage.js          INFRAESTRUTURA — localStorage e arquivos .json
  store.js            APLICAÇÃO — ações que alteram o estado e avisam as telas
  ui/dom.js           utilitários de interface (criar elementos, arrastar, aviso)
  ui/sheet-view.js    tela da ficha e modo "Editar layout"
  ui/dice-view.js     rolador, resultado, macros e histórico
  ui/macro-dialog.js  janela de criar/editar macro
  main.js             ponto de entrada: monta tudo e liga topo, abas e menu
manifest.webmanifest  dados para instalar como app
sw.js                 uso offline quando hospedado
criar-atalho.ps1      cria o atalho do PC
icons/                ícones do app
```

### Fluxo de dados

```
tela  →  store.actions.x()  →  regra em core.js  →  salva (300 ms)  →  avisa tópico  →  telas redesenham
```

- Só a `store` altera o estado.
- Tópicos: `sheet`, `macros`, `roller`, `history`. Cada tela escuta só o que mostra.
- Digitar valores na ficha **não** redesenha nada (para não perder o foco).
- O card de resultado é sempre o primeiro item do histórico.

### Formato dos dados

```js
{
  sections: [{ id, title, style: 'cards' | 'big' | 'list',
               fields: [{ id, label, kind: 'text' | 'number' | 'resource' | 'textarea', value, max? }] }],
  macros:   [{ id, name, count, countField, sides, bonus, bonusField,
               extraDice: [{ count, sides }],          // dados de bônus (máx. 10)
               mode: 'sum' | 'max' }],
  roller:   { count, sides, bonus, mode },
  history:  [{ id, label, detail, time, count, sides, bonus, mode, dice, kept,
               extra: [{ count, sides, dice }], total }]  // máx. 50
}
```

Dados carregados ou importados passam por `core.normalizeState`, que valida tudo e descarta o que for inválido.

### Tarefas comuns

- **Mudar a ficha padrão:** `createDefaultState` em `js/core.js` (listas `ATTRIBUTES` e `SKILLS`).
- **Novo tipo de campo:** adicione em `FIELD_KINDS` (`core.js`) e em `CONTROLS` (`ui/sheet-view.js`).
- **Publicou uma versão nova hospedada:** aumente `CACHE` em `sw.js` para os celulares baixarem os arquivos novos.
