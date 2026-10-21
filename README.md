# GeoEstudos

Aplicativo de estudos das aulas de Geografia do **Prof. Haroldo Matos** (Rede Municipal de São Luís · 7º, 8º e 9º anos).

**Endereço do app:** https://profharoldomatos-ship-it.github.io/geoestudos/

## Como funciona

- O app (esta pasta) mostra os resumos, as atividades de fixação e as datas de cada turma. Não tem login e não guarda dados dos alunos: o que cada aluno marca (resumo copiado, atividade enviada, marca-texto, comentários) fica só no celular dele.
- O conteúdo vem do **robô** (`robo/Codigo.gs`), um Google Apps Script que roda na conta do professor e lê:
  - os resumos em Google Docs na pasta *App Geografia › Nº ano › Unidade N* (nome começando pelo número do capítulo; `[rascunho]` no início esconde o Doc);
  - os Temas Transversais na subpasta *Unidade N › Temas Transversais* ("1 Título" = aula; "1 Atividade" = atividade mostrada no app; link de formulário na aba *Temas Transversais* da planilha de Conteúdo);
  - as planilhas *Configurações*, *Mensagens de incentivo* e *Conteúdo do App Geografia*;
  - as agendas *Geografia 71*, *Geografia 72*, *Geografia 81*, *Geografia 82*, *Geografia 91*, *Geografia 92*.
- O robô atualiza os dados a cada 5 minutos e, na hora, quando o professor edita uma das planilhas ou das agendas. O app busca dados novos ao abrir e a cada 3 minutos enquanto está aberto.
- O endereço do robô fica em `config.js`.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `index.html` | O aplicativo |
| `config.js` | Endereço do robô |
| `manifest.webmanifest`, `sw.js`, `icones/` | Instalação no celular e funcionamento sem internet |
| `robo/` | Cópia do código do robô (o que roda de verdade está no script.google.com) |
