# GeoEstudos · histórico de versões

Formato **MAIOR.MENOR.CORREÇÃO** (versionamento semântico):

- **MAIOR** (2.0.0): mudança grande, de estrutura (ex.: novo ano letivo com os livros novos de 2027).
- **MENOR** (1.2.0): recurso novo para alunos ou professor.
- **CORREÇÃO** (1.1.1): ajuste de texto, visual ou conserto, sem recurso novo.

A versão aparece no fim da página do app e no painel do professor. O robô tem numeração própria (v15, v16…), mostrada no painel e na página de situação.

## 1.23.2 · 09/11/2026 (correção)

- Onde a fixação já existe no app, o Calendário ("Fazer a atividade no app") e o botão do topo do resumo levam para a atividade no app, e não mais para o formulário.

## 1.23.1 · 09/11/2026 (correção)

- Atividade (fixação e avaliativa): quando a questão era maior que a tela (vídeo + enunciado longo), o topo ficava escondido e não dava para rolar até o vídeo. Agora a tela rola normalmente, do vídeo até os botões.

## 1.23.0 · 09/11/2026 (com o robô v30 e o robô do GeoNotas v12)

- **Questão escrita nas Atividades de Fixação:** no Doc, o enunciado e a linha "Escrita: 5 pontos". O aluno escreve numa caixa com contador (até 1.500 caracteres); colar texto não funciona nessa caixa. Os pontos que sobram ficam divididos entre as objetivas.
- Ao enviar, o aluno vê a nota das objetivas e o aviso de que a escrita será corrigida pelo professor. A nota final e o comentário do professor aparecem com o gabarito, depois do prazo.
- **Corrigir questões escritas** (modo professor, no cartão da fixação): por turma, com o texto de cada aluno, quantas vezes saiu do app, pontos de 0 ao máximo com meio ponto e comentário opcional. "Salvar · próximo aluno".
- Painel › Notas mostra "em correção" para quem ainda não foi corrigido.
- "[teste] NN Fixação": o professor pode ver o gabarito (prévia) e a própria correção.

## Robô v30 · 09/11/2026

- Lê "Escrita: N pontos" (só nas fixações; na avaliativa a questão fica de fora, com aviso). Grava a resposta escrita na planilha de notas (colunas "Objetivas", "Escrita", "Situação", "Respostas escritas") e deixa a nota em branco até a correção.
- Ações do painel `esc.listar` e `esc.salvar`; o gabarito devolve ao aluno a própria correção (pela chave que o app recebe ao enviar). Envios longos podem chegar por POST.
- Conversor de formulários: pasta dentro de App Geografia, só Unidade 4, pede a permissão de Formulários (marcado como temporário: sai em 2027).

## 1.22.0 · 09/11/2026 (com o robô v28 e o robô do GeoNotas v11)

- **Atividade de Fixação no app (Nota 2):** Doc "NN Fixação" na pasta da unidade vira atividade dentro do GeoEstudos, no lugar do formulário. Nota de 0 a 10, só o primeiro envio vale, sem envio depois do prazo. Ao enviar, o aluno vê só a nota; gabarito comentado e "Praticar de novo" só depois do prazo.
- Questões com vídeo do YouTube ("Vídeo: link") e com alternativa E. "[teste] NN Fixação" aparece só no celular do professor; problemas do Doc aparecem para o professor no cartão.
- Prazo em Painel › Ajustes: mesmo prazo para todas (por unidade, todas as turmas e anos) ou o "Prazo:" de cada Doc.
- Contra cópia para IA (fixação e avaliativa): texto das questões sem seleção/cópia, ordem embaralhada por aluno e registro de quantas vezes o aluno saiu do app (vai para a planilha de notas das atividades).
- Avaliativa: depois do prazo, "Ver gabarito comentado".
- Aba Atividades, progresso e "Já enviei" reconhecem a atividade feita no app.

## Robô v28 · 09/11/2026

- Lê "NN Fixação" ("[teste]" só para o professor, "[rascunho]" fora), aceita "Vídeo:", alternativa E e "Comentário:", ignora as linhas do conversor e aponta questões "marque todas", resposta curta e escrita.
- Prazo das fixações (fix.ler / fix.salvar), gabarito só depois do prazo (?gabarito=), colunas "Saiu do app" e "Tempo fora do app".

## Robô v27 · 09/11/2026

- Nova função `converterFormulariosEmDocs()` (rodar uma vez, à mão): lê os Formulários Google das atividades e escreve um Doc de fixação para cada um em "Meu Drive › Fixações convertidas (2027) › Nº ano › Unidade N › NN Fixação", com alternativas, respostas marcadas e avisos "← REVISAR" onde faltar algo. Os formulários não são alterados. A pasta fica fora do app até as Atividades de Fixação entrarem no GeoEstudos (2027).

## 1.21.1 · 08/11/2026 (correção urgente)

- Correção: desde a 1.20.0, o app abria com a tela vazia em celulares que já tinham os dados guardados e não estavam no modo professor (a turma era lida antes de existir). Agora abre normalmente.

## 1.21.0 · 08/11/2026

- Tela da turma: "Escolha a unidade" virou **Unidade em andamento** (o aluno não escolhe; só a vigente fica aberta). Logo abaixo, só o cartão da unidade vigente.
- As unidades passadas ficam no recolhível **Unidades anteriores** (fechado por padrão; o app lembra se ficou aberto). No início do ano, as futuras ficam em **Próximas unidades**.

## 1.20.2 · 06/11/2026 (limpeza de código)

- App: removidos o cartão antigo de avisos e dúvidas do modo professor (substituído pelo Painel em 1.13), com seus estilos, ícones e cliques. Nenhuma mudança visível.
- GeoNotas 1.11.1: removido um auxiliar sem uso.
- Robô: removido um auxiliar sem uso (`planilhaId`). Sem mudança de funcionamento; não precisa colar de novo, vai junto na próxima versão do robô.
- Mantido, de propósito: Conteúdo do Dia (suspenso, `DIA_ATIVO=false`) para eventual retomada em 2027.

## 1.20.1 · 06/11/2026

- Correção: o cartão **Continuar de onde parei** aparecia dentro de qualquer unidade (ex.: a aula de aprofundamento da Unidade 4 surgia na Unidade 2). Agora ele só aparece na unidade a que pertence o texto.

## 1.20.0 · 06/11/2026 (com o robô v26)

- **O que cada turma vê:** o professor oculta ou exibe conteúdo por turma, sem apagar nada e sem mexer no Drive.
  - Item por item, dentro do resumo ou da aula de aprofundamento (resumo, atividade de fixação, aula, atividade escrita, avaliativa).
  - Um tipo inteiro por turma em Painel › Ajustes (resumos, atividades de fixação, aulas de aprofundamento, avaliativas), para adaptar a metodologia de cada turma.
- Para a turma oculta, o item some da lista, da busca, da aba Atividades, da barra de progresso, dos avisos e dos lembretes de prazo. No modo professor, a etiqueta cinza diz para quem está oculto.
- Avaliativa oculta: o robô recusa os envios da turma; respostas e notas continuam na planilha.
- Roteiro novo no guia do painel e seção nova no manual (cap. 22).

## Robô v26 · 06/11/2026

- Lista de ocultos por turma (propriedade do script), ação do painel `oc.mudar` e campo `ocultos` no arquivo do app.
- Avisos de resumo/aula nova e lembretes de prazo não vão para a turma que não vê o item; envio de avaliativa oculta é recusado.

## 1.19.0 · 05/11/2026 (com o robô v25)

- **Liberar para os alunos** (aula de aprofundamento em rascunho): se a aula tiver atividade avaliativa em [rascunho] ou [teste], a mesma janela pergunta o destino dela: *só para eu testar*, *para os alunos* (com a data do prazo, que o robô escreve no Doc) ou *deixar como está*.
- Aluno não vê mais o cartão vazio "Aula ainda não publicada": a aula de aprofundamento só aparece quando tiver texto ou atividade. No modo professor, o cartão continua.
- Atividade da aula de aprofundamento: o texto "Aguarde" ficou alinhado com o texto de cima.
- Roteiros do painel e manual (cap. 7) atualizados.

## Robô v25 · 05/11/2026

- Lê "[rascunho] N Avaliação" (continua fora do app) e informa só ao celular do professor quantas questões ela tem.
- Nova ação do painel `rasc.aval`: vira [teste] ou libera para os alunos gravando "Prazo: dd/mm/aaaa" no Doc.

## 1.18.1 · 05/11/2026

- Painel do professor › roteiros: **Aula de aprofundamento** ganhou dois passos (escrever como [rascunho] e liberar pelo botão *Liberar para os alunos*, que não libera a avaliação).
- **Atividade avaliativa (vale nota)**: novo fluxo — [rascunho] enquanto a aula for rascunho, [teste] depois de liberar a aula, e liberar com *Prazo:* tirando o [teste] ou por Painel › Rascunhos.

## Robô v24 · 04/11/2026
- Correção: avisos, dúvidas, atividades avaliativas e inscrições de avisos não esperam mais a atualização do robô terminar. Antes, durante uma atualização longa, o envio podia falhar com “Tempo limite do bloqueio”.

## 1.18.0 · 04/11/2026
- Modo professor: botões das seis turmas no topo de Resumos, Atividades e Calendário, para trocar de turma sem sair da aba.

## 1.17.1 · 04/11/2026
- Modo professor: o celular do professor deixa de ter “minha turma” (somem as marcas “Minha turma”/“Minha” e a cor fixa da barra) e não abre mais direto numa turma.

## 1.17.0 · 04/11/2026 · robô v23
- Rascunhos que só o professor vê: aulas de aprofundamento (e atividade) e resumos com “[rascunho]” no nome aparecem no modo professor, com a etiqueta “Rascunho · só você vê”, para ditar e explicar em sala. O botão “Liberar para os alunos”, dentro da aula, tira a marca do nome no Drive e a publica. O texto dos rascunhos fica num arquivo privado e só chega ao celular com a senha do professor.
- Modo professor: o celular passa a receber os avisos de todas as turmas (botão “Receber de todas as turmas” no painel); o app não pergunta mais “Você é da turma…?” nem mostra o modo de celular compartilhado.
- Exige o robô v23.

## 1.16.0 · 02/11/2026
- Página da unidade em três blocos: Para estudar (Resumos, Atividades de fixação, Aulas de aprofundamento, na cor do ano), Da turma (Próximas datas, Mural de avisos, Dúvidas, em azul) e Para você (Guia do estudante e Trocar de turma, discretos).
- Nova seção “Atividades de fixação” na página da unidade, com enviadas e próximo prazo; novo passo no tour.
- Modo escuro: faixas azuis da página da turma com mais contraste.

## 1.15.0 · 02/11/2026 · robô v22
- Painel do professor reorganizado em botões por grupo: Comunicar (Avisos, Dúvidas), Turmas (Agenda, Prazos, Notas) e Conteúdo e app (Rascunhos, Ajustes), com selos do que pede ação.
- Avisos: editar um aviso já publicado (texto, turmas, destaque, data do topo).
- Agenda: marcar, editar e apagar datas nas agendas das turmas (entrega do caderno, atividade de fixação, aula de aprofundamento, avaliação, sem aula, outro aviso), com o título no padrão do robô.
- Prazos: atividades da unidade em andamento com o prazo de cada turma; um toque abre a data já preenchida.
- Notas: resultado das atividades avaliativas por turma (quem fez, nota, média, abaixo de 7 e quem falta).
- Rascunhos: lista dos documentos com [rascunho] ou [teste] e botão Publicar.
- Ajustes: mensagem da tela inicial, caixa de dúvidas, limite de dúvidas, aviso de atividade nova, horários dos lembretes e mensagens de incentivo.
- Exige o robô v22.

## 1.14.0 · 02/11/2026 · robô v21
- Painel do professor: “Dúvidas dos alunos”. As dúvidas chegam no próprio app (abas Sem resposta e Respondidas, com selo de novas). O professor responde e escolhe publicar para a turma, para o ano todo ou não publicar. O nome do aluno só aparece para o professor. A planilha de dúvidas continua como registro.
- Exige o robô v21.

## 1.13.0 · 01/11/2026 · robô v20
- Painel do professor: “Enviar aviso aos alunos”. O professor escreve o aviso no próprio app (título, mensagem, para quem, destaque, notificação, agora ou agendado), confere como a notificação vai aparecer e envia. O aviso é gravado na aba Mural de avisos e o robô publica em 1 a 3 minutos.
- “Avisos recentes” no painel, com “Tirar do ar”.
- Exige o robô v20.

## 1.12.1 · 01/11/2026
- Tour e Guia do estudante: textos do menu ☰ atualizados (recados anteriores, avisos no celular, cores do app); o passo dos avisos lembra que eles podem ser ligados e desligados pelo menu.

## 1.12.0 · 01/11/2026
- Menu ☰ reorganizado: cabeçalho azul como a barra do topo; Início e Guia primeiro (o item da tela atual fica destacado); grupos com título (Sua turma, Ajustes, Sobre e contato); etiqueta “Ativados/Desativados” nos avisos; itens de Sobre e contato menores; no modo professor, o Painel vira um botão de destaque no alto.

## 1.11.4 · 31/10/2026
- Tour guiado atualizado: novos passos para os Recados, o Mural de avisos e o menu ☰; o “Pronto!” agora indica o Guia no menu e avisa que o app abre direto na turma fixada.
- Pergunta “Você é da turma…?”: explica que o app passa a abrir direto na turma, já na unidade em andamento.

## 1.11.3 · 31/10/2026
- Página inicial: texto abaixo do título encurtado para “Veja resumos, atividades e o calendário.”

## 1.11.2 · 31/10/2026
- Página inicial: texto abaixo do título passa a ser “Veja resumos, atividades e o calendário para sua turma.”

## 1.11.1 · 31/10/2026
- Página inicial: o título passa a ser “Escolha o seu ano e a sua turma”, com o texto “Para ver os resumos, as atividades e as datas.” O título se ajusta para caber numa linha na maioria dos celulares.

## 1.11.0 · 30/10/2026
- Nova ordem na página da turma: a cabeça da unidade, logo abaixo os **Recados** (só quando há recado novo) e depois os Resumos.
- "Continuar de onde parei" passou para dentro dos **Resumos da Unidade**, como primeiro item em destaque. A caixa dos Resumos vem aberta.
- Recados somem depois de lidos: ao abrir a faixa, eles ficam esmaecidos com a marca "Lido"; ao fechar ou sair da página, vão para **Recados anteriores** (no menu ☰ e no rodapé dos Recados).
- A linha "Avisos ativados…" saiu da página da turma. O ajuste agora fica no menu ☰, em **Avisos no celular**, com atalho "Gerenciar avisos" no rodapé dos Recados. Quem ainda não ativou vê o convite no fim da página.

## 1.10.0 · 30/10/2026
- "Novidades" virou **Recados**: uma faixa recolhível, fechada por padrão, com contador. O sininho balança ao abrir a página e o amarelo pulsa até o aluno tocar. Depois de "Marcar como vistos", a faixa some. Vale para todas as turmas. Quem pede menos animação no celular vê a faixa parada.

## 1.9.5 · 30/10/2026
- Atualizações chegam mais rápido: ao abrir o app com internet, o celular sempre confere a versão mais nova no site, sem usar a cópia guardada por alguns minutos.

## 1.9.4 · 30/10/2026
- Abertura: depois de parar no Brasil, os pontos do globo se desfazem suavemente e a marca original do GeoEstudos aparece limpa.

## 1.9.3 · 30/10/2026
- Nova animação de abertura: no lugar dos meridianos, o globo mostra os continentes em pontos e gira de leste para oeste (Ásia, África, Atlântico) até parar com o Brasil no centro.

## 1.9.2 · 30/10/2026
- Atividade avaliativa: o nome do aluno, lembrado só no próprio celular depois da primeira atividade, ganha a opção “Não é você? Apagar o nome”. No celular compartilhado o nome não é guardado.

## 1.9.1 · 30/10/2026
- Barra do topo azul e fixa, de ponta a ponta da tela (como a barra de baixo), com o menu ☰ e a marca em branco.
- Na marca do topo ficam só o ícone e o nome GeoEstudos.

## 1.9.0 · 30/10/2026
- Página inicial mais direta: sai o quadro azul e entra “Escolha o seu ano”, com os três anos em botões da mesma altura.
- Menu ☰ no canto de cima: Início, Guia do estudante, Instalar, Sobre o Prof. Haroldo Matos, Sobre o GeoEstudos e privacidade, Fale com o professor, Compartilhar e Cores do app. Os textos que estavam na página inicial e no rodapé foram mantidos, agora no menu.
- Quem fixou a turma (“Sim, sou da turma”) abre o app direto nela, já na unidade em andamento. Celular compartilhado continua abrindo na escolha de ano.
- O botão de cores saiu do topo: agora fica no “Aa” da leitura (“Cores do app”) e no menu.
- Rodapé enxuto: só a versão.
- Conteúdo Geográfico do Dia suspenso (o recurso e a planilha continuam guardados para voltar depois).

## 1.8.0 · 24/10/2026
- Painel do professor: botão para o GeoNotas, que agora funciona como uma página do próprio GeoEstudos (pasta geonotas/), protegida por senha própria. No GeoNotas, botão de volta ao painel.

## 1.7.1 · 24/10/2026
- Retirado o atalho do GeoNotas do painel do professor: o GeoNotas passa a ser aberto de forma independente.

## 1.7.0 · 24/10/2026
- Painel do professor: atalho para o GeoNotas (lançamento e consulta das notas), visível só no modo professor. O GeoNotas continua protegido pela conta Google do professor.

## 1.6.1 · 24/10/2026
- Painel do professor: registro dos avisos enviados (quando, para quais turmas, quantos celulares receberam), celulares inscritos por turma e opção de receber no próprio celular os avisos das turmas. Robô v19.

## 1.6.0 · 24/10/2026
- Modo professor: “Minha agenda”, ligada à agenda do Google “GeoEstudos · Professor”, com lembretes só no celular do professor (véspera, dia e 1 hora antes). Robô v18.

## 1.5.6 · 24/10/2026
- Faixa de sem internet mais destacada (fundo grafite, texto branco).

## 1.5.5 · 24/10/2026
- Faixa “Você está sem internet. Mostrando os conteúdos salvos no celular”, com a data da última atualização; some quando a conexão volta.

## 1.5.4 · 23/10/2026
- Rodapé: e-mail em parágrafo próprio, sem quebra no meio do endereço.

## 1.5.3 · 23/10/2026
- Guia do estudante: rever só uma parte do tour (6 partes) ou o tour completo.

## 1.5.2 · 23/10/2026
- Tour: novas janelas na aula de aprofundamento (atividade avaliativa e atividade da aula), na revisão rápida (opcional), em Atividades e no Calendário.

## 1.5.1 · 23/10/2026
- “Ver o tour guiado de novo” refaz o tour completo, desde a escolha do ano, inclusive com o modo professor ligado.

## 1.5.0 · 23/10/2026
- Tour guiado no primeiro uso: escolher ano e turma, unidade, página da turma e ferramentas de leitura (pode pular).
- Nova página “Guia do estudante”, na página inicial e na página da turma, com o botão para rever o tour.

## 1.4.1 · 23/10/2026
- Instalação (Android): aviso para manter o Chrome no celular.

## 1.4.0 · 23/10/2026
- Aberto dentro do Instagram (ou outro app): aviso no topo com botão para abrir no Chrome/Safari (Android sem Chrome vai para a Play Store).
- Tela “Instalar o GeoEstudos” com abas Android e iPhone, aviso sobre o Chrome, outros navegadores e uso sem instalar.

## 1.3.1 · 23/10/2026
- Abertura mais longa (cerca de 3,7 s) para dar tempo de ler o nome e o subtítulo.

## 1.3.0 · 23/10/2026
- Revisões rápidas em “[rascunho]” aparecem no modo professor, para testar antes de liberar. Robô v17.

## 1.2.8 · 23/10/2026
- O logo GeoEstudos no topo virou botão de volta à página inicial.

## 1.2.7 · 23/10/2026
- Rodapé completo só na página inicial; nas demais, apenas compartilhar e versão.

## 1.2.6 · 23/10/2026
- Página inicial: box do nome reorganizado (saudação, linha divisória, escola, disciplina e autoria).

## 1.2.5 · 23/10/2026
- Escola identificada: UI Prof. Carlos Cunha (página inicial, Sobre, privacidade, caixa de dúvidas).
- Saudação um pouco maior; nome GeoEstudos ajustado nos celulares.

## 1.2.4 · 23/10/2026
- Página inicial: saudação menor, em uma linha e em itálico, para se distinguir do texto de baixo.

## 1.2.3 · 23/10/2026
- Sobre: novo bloco “Linha teórica” (Geografia Crítica, GeoHistória, Milton Santos e autores de referência).

## 1.2.2 · 23/10/2026
- Página inicial: saudação “Estudante, seja bem-vinda(o)!” ao lado do nome.

## 1.2.1 · 23/10/2026
- Abertura: os meridianos esvanecem no fim e o símbolo termina no formato original.

## 1.2.0 · 23/10/2026
- Abertura animada do app instalado: o globo gira e ganha meridianos, o nome GeoEstudos sobe letra a letra (toque para pular; versão curta para quem reduz animações).

## 1.1.4 · 23/10/2026
- Sobre/avaliações: a recuperação paralela também não diminui a média (prevalece a maior).

## 1.1.3 · 23/10/2026
- Sobre/avaliações: formas de usar a recuperação paralela (A: substitui a menor nota; B: média com a nota do período) e regra de que a recuperação de período não diminui a média.

## 1.1.2 · 23/10/2026
- Sobre: novo bloco “Como funcionam as avaliações de Geografia” (3 notas, recuperação paralela, recuperação de período, frequência).

## 1.1.1 · 23/10/2026
- Sobre: novo bloco “Para pais e responsáveis” (tipo de iniciativa, marcadores de tarefas e a supervisão do caderno).

## 1.1.0 · 23/10/2026
- Conteúdo Geográfico do Dia na página inicial (caixa recolhível, conteúdos anteriores, notificação para todas as turmas). Robô v16.
- Rodapé reorganizado: nome, iniciativa do professor, Sobre, contato, compartilhar e versão.

## 1.0.0 · 22/10/2026
Primeira versão completa, pronta para divulgação aos estudantes:
resumos e PDFs, atividades de fixação, aulas de aprofundamento, revisão rápida, atividade avaliativa com nota,
agenda e lembretes, mural de avisos, caixa de dúvidas, notificações no celular, unidades pelo calendário da SEMED,
modo apresentação (TV), tela cheia, modo professor e Manual do Professor. Robô v15.
