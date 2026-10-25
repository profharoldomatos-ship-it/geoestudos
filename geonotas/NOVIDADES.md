# GeoNotas · histórico de versões

Formato **MAIOR.MENOR.CORREÇÃO** (o mesmo do GeoEstudos):

- **MAIOR** (2.0.0): mudança de estrutura (ex.: novo ano letivo, planilhas de 2027).
- **MENOR** (1.5.0): recurso novo.
- **CORREÇÃO** (1.4.2): ajuste de texto, visual ou conserto, sem recurso novo.

A versão do app e a do robô aparecem no rodapé do GeoNotas. O robô (Google Apps Script) tem numeração própria (v1, v2…): sempre que ele muda, é preciso colar o código novo e fazer uma nova versão da implantação.

## Planejado para 2027
- Chamada: registro do conteúdo do dia, a partir do planejamento mensal.

## 1.8.3 · 25/10/2026 · atalho para as observações
- No alto da ficha do aluno (aba Notas), o botão "✎ Observações sobre este aluno" leva direto à caixa de texto.

## 1.8.2 · 25/10/2026 · botões da chamada equilibrados
- "Todos presentes" e "Desmarcar todos" dividem a largura meio a meio, com a mesma altura; ficam apagados quando não há o que fazer.

## 1.8.1 · 25/10/2026 · desmarcar na chamada
- Tocar de novo em P, F ou FJ já marcado desmarca o aluno.
- Novo botão "Desmarcar todos" (pede confirmação). Se ninguém ficar marcado, o dia volta a "pendente" e sai da planilha.
- Robô continua v9.

## 1.8.0 · 25/10/2026 · alinhamento com o GeoEstudos
- Abas embaixo (Notas, Cadernos, Chamada, Resultados), como no GeoEstudos; topo limpo com "‹ GeoEstudos", "Um por vez" e ↻.
- Cada turma ganha a cor do seu ano (7º verde, 8º laranja, 9º roxo).
- Cores das notas só onde decidem: Média regular e Final (verde a partir de 7, vermelho ▼ abaixo). N1, N2, N3 e RP ficam neutras.
- Ficha do aluno com seções no estilo do GeoEstudos (Média regular, Recuperação paralela, Final, Observações).
- Nomes das colunas em linguagem de leitura: "ATIV. C12" vira "Atividade · Cap. 12".
- Importar formulários agora fica em Lançar → Nota 2.
- Chamada por semana: ‹ › troca a semana e cada dia mostra se está feita, pendente, futura ou sem aula.
- Botões P/F/FJ e campos maiores (44 px), foco visível pelo teclado e "Sair do GeoNotas" no rodapé.
- Robô continua v9 (nada a atualizar no Apps Script).

## 1.7.1 · 25/10/2026 · robô v9
- Chamada: todas as datas do período aparecem, inclusive as futuras (marcadas como futuras). Nelas dá para registrar NA com antecedência; a presença abre no dia.

## 1.7.0 · 25/10/2026 · robô v9
- Nova aba Chamada: dias de aula de cada turma pelo horário semanal (segunda: 81, 82, 91; quinta: 71, 72; sexta: 91, 92), feriados nacionais, P / F / FJ por aluno, botão Todos presentes e totais do dia. Salva sozinha na aba CHAMADA da planilha da turma.
- NA (não houve aula) ao lado da data: dia todo ou parte das aulas, com justificativa (inclusive ausência do professor).
- Faltas contadas por aula; aba Frequência com % de cada aluno, alerta abaixo de 75%, faltas seguidas e chamadas pendentes.

## 1.6.0 · 25/10/2026 · robô v8
- Observações do professor na ficha de cada aluno (Por aluno): registro com data e hora, guardado na aba OBSERVAÇÕES da planilha da turma (criada automaticamente). Não aparecem no modo Um aluno por vez.

## 1.5.0 · 25/10/2026 · robô v7
- Aba Notas organizada por blocos: Nota 1 (desempenho + caderno), Nota 2 (atividades), Nota 3 (prova) → Média regular; Recuperação paralela → Final.
- Novo modo Resumo: todas as notas da turma lado a lado (N1, N2, N3, MR, RP, FINAL).
- Modo Lançar: escolha o bloco e a atividade; a marcação e a nota da atividade ficam lado a lado, com o resultado do bloco ao lado do nome.
- Ficha do aluno (Por aluno e Um aluno por vez) mostra como cada nota foi formada, com o resultado de cada bloco.

## 1.4.1 · 24/10/2026 · robô v7
- Importação: resposta sem aluno identificado fica na lista até você escolher o aluno; nova opção "descartar esta resposta".
- Registro do que já foi importado passa a usar o nome do aluno (resiste à inclusão de alunos no meio da lista).
- Versão do app e do robô no rodapé.

## 1.4.0 · 24/10/2026 · robô v6
- Importação automática de hora em hora das respostas com nome conferido; nunca sobrescreve nota já lançada.
- Respostas já importadas não reaparecem; aviso "Não há respostas novas".

## 1.3.0 · 24/10/2026 · robô v5
- Importação das notas dos formulários de atividade do período 4, com conferência dos nomes. Vale o primeiro envio; nota = pontos ÷ total × 10.

## 1.2.0 · 24/10/2026
- Cores Sépia e Claro do GeoEstudos; botões das turmas na largura toda; modo "um aluno por vez" para mostrar notas sem expor os colegas.

## 1.1.0 · 24/10/2026 · robô v4
- Entrada com senha própria; a tela passa a morar no GitHub, como página do GeoEstudos (botão no painel do professor e volta ao painel).

## 1.0.0 · 24/10/2026 · robô v1
- Primeira versão: lançamento por atividade ou por aluno, cadernos e resultados finais, lidos e gravados direto nas planilhas "Controle [turma] | Geografia | 2026".
