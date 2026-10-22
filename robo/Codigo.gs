/**
 * GeoEstudos — robô do aplicativo
 * Prof. Haroldo Matos · Geografia · Rede Municipal de São Luís
 *
 * O que este robô faz, a cada 5 minutos (e na hora, quando você edita as planilhas ou as agendas):
 *  1. Lê os resumos (Google Docs) em App Geografia › Nº ano › Unidade N.
 *  2. Lê as planilhas "Configurações", "Mensagens de incentivo" e "Conteúdo".
 *  3. Lê as agendas "Geografia 71", "Geografia 72"... (datas de entrega e atividades).
 *  4. Junta tudo num arquivo de dados que o aplicativo baixa.
 *
 * Funções que você pode rodar pelo menu ▶ Executar:
 *  - instalar ......... liga a atualização automática e faz a primeira leitura (rode de novo sempre que colar um código novo).
 *  - atualizar ........ atualiza o app na hora (ex.: depois de publicar um resumo).
 *  - verificar ........ mostra no registro um resumo do que o app está recebendo.
 *  - testarAviso ...... manda um aviso de teste para os celulares que ativaram os avisos.
 *
 * Vídeos, áudios e links: cole o endereço sozinho numa linha do Doc (YouTube vira player no app).
 * Imagens: cole a imagem no Doc normalmente; o robô publica uma cópia para o app mostrar.
 *
 * Temas Transversais: pasta "Temas Transversais" dentro da unidade, com Docs "1 Título" (a aula)
 * e, se a atividade for no próprio app, "1 Atividade". O link do formulário vai na aba "Temas Transversais".
 *
 * Não é preciso mexer no código. Tudo o que muda no dia a dia fica nas planilhas, nos Docs e nas agendas.
 */

const VERSAO_ROBO = '2026-10-22 · mural v7';

const GEO = {
  PASTA_APP: '1518J7jjnHF7idCCQp0FY9-uzzJCMHDSq',              // pasta "App Geografia"
  PLANILHA_CONFIG: '1NhIqN5p2rL720MS5IojsCBcB7zKQp2kX42MJxw0GncI', // "Configurações do App Geografia"
  PLANILHA_MENSAGENS: '1a9ADFpfGiAhX45623F3sS_DK-ahTw4e6THGYbTcbrZI', // "Mensagens de incentivo do App Geografia"
  PLANILHA_CONTEUDO: '1hace3ObeUvmrF95-1KEZW7ihwRhmUzLrjcxm-xdjxJ8', // "Conteúdo do App Geografia"
  ARQUIVO_DADOS: 'GeoEstudos - dados do app (não apagar).json',
  PREFIXO_AGENDA: 'Geografia ',   // agendas chamadas "Geografia 71", "Geografia 72"...
  FUSO: 'America/Fortaleza',
  DIAS_ANTES: 60,                 // a agenda do app mostra eventos de até 60 dias atrás...
  DIAS_DEPOIS: 300,               // ...até 300 dias à frente
  MINUTOS: 5,
  AVISOS_DIAS: 21,                // avisos de novidade ficam visíveis por 21 dias
  AVISOS_MAX: 80
};

/* ------------------------------------------------------------------ */
/* Endereço público: o app chama este endereço para baixar os dados.   */
/* ------------------------------------------------------------------ */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.inscrever !== undefined) {
    // Inscrição de avisos pelo mesmo caminho que baixa os dados (mais confiável no celular)
    let b = {};
    try { b = JSON.parse(p.inscrever); } catch (err) {}
    return ContentService.createTextOutput(JSON.stringify(processarInscricao_(b))).setMimeType(ContentService.MimeType.JSON);
  }
  if (p.duvida !== undefined) {
    let b = {};
    try { b = JSON.parse(p.duvida); } catch (err) {}
    return ContentService.createTextOutput(JSON.stringify(receberDuvida_(b))).setMimeType(ContentService.MimeType.JSON);
  }
  if (p.robo !== undefined) {
    return ContentService.createTextOutput(JSON.stringify({ ok: true, versao: VERSAO_ROBO })).setMimeType(ContentService.MimeType.JSON);
  }
  let txt = lerCache_();
  if (!txt) {
    const f = arquivoDados_();
    if (f) txt = f.getBlob().getDataAsString('UTF-8');
    else {
      const d = atualizar();
      txt = d ? JSON.stringify(d) : '{}';
    }
    guardarCache_(txt);
  }
  if (p.ver !== undefined) return paginaStatus_(JSON.parse(txt));
  if (p.avisos !== undefined) {
    // Pedido do celular ao receber um aviso: devolve só as notificações recentes (arquivo pequeno)
    let n = [];
    try { n = JSON.parse(txt).notificacoes || []; } catch (err) {}
    return ContentService.createTextOutput(JSON.stringify({ notificacoes: n })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}

/** O app chama aqui para ligar ou desligar os avisos de um celular (sem nome nem dado pessoal do aluno). */
function doPost(e) {
  let b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {}
  const res = b.acao === 'duvida' ? receberDuvida_(b) : processarInscricao_(b);
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function processarInscricao_(b) {
  try {
    const ep = String((b.sub && b.sub.endpoint) || b.endpoint || '');
    if (!enderecoValido_(ep)) return { ok: false, erro: 'endereço inválido' };
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (b.acao === 'remover') { removerInscricoes_([ep]); return { ok: true }; }
      const conf = lerConfig_();
      const validas = [].concat.apply([], Object.keys(conf.turmas).map(k => conf.turmas[k]));
      // Um celular pode receber avisos de várias turmas (celular compartilhado)
      const turmas = [].concat(b.turmas || b.turma || []).map(String).filter(t => validas.indexOf(t) >= 0);
      if (!turmas.length) return { ok: false, erro: 'turma inválida' };
      salvarInscricao_(ep, turmas.join('; '));
      return { ok: true, versao: VERSAO_ROBO };
    } finally { lock.releaseLock(); }
  } catch (err) {
    return { ok: false, erro: String(err) };
  }
}

/* ------------------------------------------------------------------ */
/* Instalação e atualização                                             */
/* ------------------------------------------------------------------ */
function instalar() {
  const nossas = ['atualizar', 'atualizarAgendado', 'aoMudarAlgo'];
  ScriptApp.getProjectTriggers().forEach(t => {
    if (nossas.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  // 1) A cada 5 minutos (pega Docs novos ou editados)
  ScriptApp.newTrigger('atualizarAgendado').timeBased().everyMinutes(GEO.MINUTOS).create();
  // 2) Na hora, quando você edita uma das planilhas
  [GEO.PLANILHA_CONFIG, GEO.PLANILHA_MENSAGENS, GEO.PLANILHA_CONTEUDO, planilhaDuvidas_().getParent().getId()].forEach(id => {
    ScriptApp.newTrigger('aoMudarAlgo').forSpreadsheet(id).onEdit().create();
  });
  // 3) Na hora, quando você cria ou muda um evento nas agendas das turmas
  let agendas = 0;
  CalendarApp.getAllCalendars().forEach(c => {
    if (c.getName().indexOf(GEO.PREFIXO_AGENDA) === 0) {
      ScriptApp.newTrigger('aoMudarAlgo').forUserCalendar(c.getId()).onEventUpdated().create();
      agendas++;
    }
  });
  chavesAvisos_();
  planilhaInscricoes_();
  prepararAbaTemas_();
  prepararConfigDuvidas_();
  abaMural_();
  const d = atualizar();
  Logger.log('Atualização automática ligada: a cada ' + GEO.MINUTOS + ' minutos, e na hora quando você edita as planilhas ou as ' + agendas + ' agendas.');
  Logger.log(resumoTexto_(d));
}

/** Rodado a cada 5 minutos. De madrugada (0h às 6h) descansa, para poupar a cota do Google. */
function atualizarAgendado() {
  const h = parseInt(Utilities.formatDate(new Date(), GEO.FUSO, 'H'), 10);
  if (h < 6) return;
  atualizar();
}

/** Rodado quando uma planilha ou agenda muda. Espera alguns segundos para juntar várias edições seguidas. */
function aoMudarAlgo() {
  const props = PropertiesService.getScriptProperties();
  const marca = String(Date.now());
  props.setProperty('ultimaMudanca', marca);
  Utilities.sleep(8000);
  if (props.getProperty('ultimaMudanca') !== marca) return; // veio outra edição depois; ela cuida
  atualizar();
}

function atualizar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Outra atualização já está em andamento.'); return null; }
  try {
    const anterior = lerDadosAnteriores_();
    const conf = lerConfig_();
    const conteudo = lerConteudo_();
    const docs = lerDocs_();
    const anos = montarAnos_(conf, conteudo, docs, anterior);
    const turmas = [].concat.apply([], anos.map(a => a.turmas));
    const agenda = lerAgendas_(turmas);
    const dados = {
      versao: new Date().toISOString(),
      app: {
        nome: conf.nome || 'GeoEstudos',
        email: conf.email || '',
        mensagem: conf.mensagem || '',
        avisoNovo: conf.avisoNovo,
        lembreteVespera: conf.lembreteVespera || '18:00',
        lembreteDia: conf.lembreteDia || '07:00',
        duvidas: conf.duvidas
      },
      anos: anos,
      mensagens: lerMensagens_(),
      agenda: agenda
    };
    try { dados.duvidas = lerDuvidasRespondidas_(dados); } catch (err) { Logger.log('Dúvidas: ' + err); dados.duvidas = (anterior && anterior.duvidas) || []; }
    let mural = null;
    try { mural = lerMural_(dados); dados.mural = mural.itens; } catch (err) { Logger.log('Mural: ' + err); dados.mural = (anterior && anterior.mural) || []; }
    dados.avisos = calcularAvisos_(dados, anterior, conf);
    let novas = [];
    try {
      dados.push = { chave: chavesAvisos_().pub };
      novas = novasNotificacoes_(dados, anterior, conf);
      const limite = new Date(Date.now() - 3 * 864e5).toISOString();
      dados.notificacoes = ((anterior && anterior.notificacoes) || []).filter(n => n.quando >= limite).concat(novas).slice(-120);
    } catch (err) { Logger.log('Avisos: ' + err); dados.notificacoes = (anterior && anterior.notificacoes) || []; }
    const txt = JSON.stringify(dados);
    gravarDados_(txt);
    guardarCache_(txt);
    if (novas.length) {
      try { enviarAvisos_(novas); } catch (err) { Logger.log('Envio de avisos: ' + err); }
    }
    if (mural) { try { mural.escreverSituacao(); } catch (err) { Logger.log('Mural (situação): ' + err); } }
    return dados;
  } finally {
    lock.releaseLock();
  }
}

function verificar() {
  const f = arquivoDados_();
  if (!f) { Logger.log('Ainda não há dados. Rode "instalar" primeiro.'); return; }
  Logger.log(resumoTexto_(JSON.parse(f.getBlob().getDataAsString('UTF-8'))));
}

/* ------------------------------------------------------------------ */
/* Planilhas                                                            */
/* ------------------------------------------------------------------ */
function semAcento_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function sim_(v) { return /^s/i.test(String(v || '').trim()); }
function anoDe_(v) { const m = String(v || '').match(/(\d)/); return m ? m[1] : ''; }

function lerConfig_() {
  const linhas = SpreadsheetApp.openById(GEO.PLANILHA_CONFIG).getSheets()[0].getDataRange().getDisplayValues();
  const c = { turmas: {}, anosAtivos: [], avisoNovo: true, duvidas: true };
  linhas.forEach(l => {
    const k = semAcento_(l[0]), v = String(l[1] || '').trim();
    let m;
    if (k === 'nome do app') c.nome = v;
    else if (k.indexOf('e-mail') === 0 || k.indexOf('email') === 0) c.email = v;
    else if ((m = k.match(/^turmas do (\d)/))) c.turmas[m[1]] = v.split(/[,;\s]+/).filter(Boolean);
    else if (k.indexOf('anos ativos') === 0) c.anosAtivos = (v.match(/\d/g) || []);
    else if (k.indexOf('lembrete na vespera') === 0) c.lembreteVespera = v;
    else if (k.indexOf('lembrete no dia') === 0) c.lembreteDia = v;
    else if (k.indexOf('aviso de atividade nova') === 0) c.avisoNovo = sim_(v);
    else if (k.indexOf('mensagem da tela inicial') === 0) c.mensagem = v;
    else if (k.indexOf('caixa de duvidas') === 0) c.duvidas = sim_(v);
  });
  return c;
}

function lerMensagens_() {
  const linhas = SpreadsheetApp.openById(GEO.PLANILHA_MENSAGENS).getSheets()[0].getDataRange().getDisplayValues();
  const m = { resumo: [], atividade: [], unidade: [] };
  linhas.slice(1).forEach(l => {
    const k = semAcento_(l[0]), txt = String(l[1] || '').trim();
    if (!txt || (String(l[2] || '').trim() && !sim_(l[2]))) return;
    if (k.indexOf('resumo') >= 0) m.resumo.push(txt);
    else if (k.indexOf('atividade') >= 0) m.atividade.push(txt);
    else if (k.indexOf('unidade') >= 0) m.unidade.push(txt);
  });
  return m;
}

function link_(v, tipo) {
  v = String(v || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (tipo === 'form' && /^1FAIpQL/.test(v)) return 'https://docs.google.com/forms/d/e/' + v + '/viewform';
  if (/^[\w-]{20,}$/.test(v)) return 'https://drive.google.com/file/d/' + v + '/view';
  return '';
}

function lerConteudo_() {
  const ss = SpreadsheetApp.openById(GEO.PLANILHA_CONTEUDO);
  const aba = nome => ss.getSheets().filter(s => semAcento_(s.getName()).indexOf(nome) === 0)[0];
  const linhas = s => s ? s.getDataRange().getDisplayValues().slice(1) : [];
  const c = { livro: {}, unidades: {}, caps: {}, temas: {} };
  linhas(aba('anos')).forEach(l => { const a = anoDe_(l[0]); if (a) c.livro[a] = link_(l[1]); });
  linhas(aba('unidades')).forEach(l => {
    const a = anoDe_(l[0]), u = parseInt(l[1], 10);
    if (!a || !u) return;
    (c.unidades[a] = c.unidades[a] || {})[u] = { titulo: String(l[2] || '').trim(), atual: sim_(l[3]) };
  });
  linhas(aba('temas')).forEach(l => {
    const a = anoDe_(l[0]), u = parseInt(l[1], 10), n = parseInt(String(l[2]).replace(/\D+/g, ''), 10);
    if (!a || !u || !n) return;
    (c.temas[a] = c.temas[a] || {})[u + '-' + n] = { unidade: u, n: n, titulo: String(l[3] || '').trim(), atividade: link_(l[4], 'form'), pdf: link_(l[5]) };
  });
  linhas(aba('capitulos')).forEach(l => {
    const a = anoDe_(l[0]), u = parseInt(l[1], 10), n = parseInt(l[2], 10);
    if (!a || !u || !n) return;
    (c.caps[a] = c.caps[a] || {})[n] = {
      unidade: u, titulo: String(l[3] || '').trim(), pdf: link_(l[4]), atividade: link_(l[5], 'form')
    };
  });
  return c;
}

/* ------------------------------------------------------------------ */
/* Resumos (Google Docs)                                                */
/* ------------------------------------------------------------------ */
function lerDocs_() {
  // Resultado: { caps: { '7': { 13: {id, nome, unidade, atualizado} } },
  //             temas: { '7': { 4: { 1: {aula: {...}, atividade: {...}} } } } }
  const docs = {}, temas = {}, revs = {};
  const raiz = DriveApp.getFolderById(GEO.PASTA_APP);
  const anos = raiz.getFolders();
  while (anos.hasNext()) {
    const pa = anos.next();
    const ma = pa.getName().match(/(\d)\s*º?\s*ano/i);
    if (!ma) continue;
    const ano = ma[1];
    const unids = pa.getFolders();
    while (unids.hasNext()) {
      const pu = unids.next();
      const mu = pu.getName().match(/unidade\s*(\d+)/i);
      if (!mu) continue;
      const arqs = pu.getFilesByType(MimeType.GOOGLE_DOCS);
      while (arqs.hasNext()) {
        const f = arqs.next();
        const nome = f.getName();
        if (/^\s*\[\s*rascunho/i.test(nome)) continue;
        const mc = nome.match(/^\s*(\d+)\s*[-–—.:]?\s*(.*)$/);
        if (!mc) continue;
        if (/^revis[ãa]o\b/i.test(mc[2].trim())) {
          // "14 Revisão": perguntas da revisão rápida do capítulo 14
          (revs[ano] = revs[ano] || {})[parseInt(mc[1], 10)] = { id: f.getId(), atualizado: f.getLastUpdated().toISOString() };
          continue;
        }
        (docs[ano] = docs[ano] || {})[parseInt(mc[1], 10)] = {
          id: f.getId(), nome: mc[2].trim(), unidade: parseInt(mu[1], 10),
          atualizado: f.getLastUpdated().toISOString()
        };
      }
      // Pasta "Temas Transversais" dentro da unidade
      const subs = pu.getFolders();
      while (subs.hasNext()) {
        const pt = subs.next();
        if (!/tema/i.test(pt.getName())) continue;
        const tds = pt.getFilesByType(MimeType.GOOGLE_DOCS);
        while (tds.hasNext()) {
          const f = tds.next();
          const nome = f.getName();
          if (/^\s*\[\s*rascunho/i.test(nome)) continue;
          const mt = nome.match(/^\s*(?:tt\s*)?(\d+)\s*[-–—.:|]?\s*(.*)$/i);
          if (!mt) continue;
          const n = parseInt(mt[1], 10), resto = mt[2].trim();
          const u = parseInt(mu[1], 10);
          const t = (((temas[ano] = temas[ano] || {})[u] = temas[ano][u] || {})[n] = temas[ano][u][n] || {});
          const info = { id: f.getId(), nome: resto, atualizado: f.getLastUpdated().toISOString() };
          if (/^atividade\b/i.test(resto)) t.atividade = info; else t.aula = info;
        }
      }
    }
  }
  return { caps: docs, temas: temas, revs: revs };
}

/**
 * Lê o texto de um Doc de revisão. Formato de cada pergunta:
 *   1. Enunciado
 *   A) ...   B) ...   C) ...   D) ...
 *   Resposta: B
 *   Explicação: ...
 * Devolve { perguntas: [{q, a:[4 textos], c: índice da correta, e}], erros: ['Pergunta 3: ...'] }.
 */
function lerRevisao_(texto) {
  const linhas = String(texto || '').split(/\r?\n/).map(l => l.replace(/\u00a0/g, ' ').trim());
  const perguntas = [], erros = [];
  let solto = [], atual = null, primeira = true, num = 0;
  const limpaNum = s => s.replace(/^(pergunta|quest[ãa]o)\s*\d*\s*[.:)\-–—]?\s*/i, '').replace(/^\d+\s*[.)\-–—:]\s*/, '').trim();
  const fechar = () => {
    if (!atual) return;
    num++;
    const p = atual; atual = null;
    const falta = [];
    if (!p.q) falta.push('enunciado');
    const letras = ['A', 'B', 'C', 'D'].filter((L, i) => !p.ops[i]);
    if (letras.length) falta.push('alternativa ' + letras.join(', '));
    if (p.c < 0) falta.push('linha "Resposta:" com A, B, C ou D');
    if (falta.length) { erros.push('Pergunta ' + num + (p.q ? ' ("' + p.q.slice(0, 40) + '…")' : '') + ': falta ' + falta.join('; ')); return; }
    perguntas.push({ q: p.q, a: p.ops.slice(0, 4), c: p.c, e: p.e });
  };
  linhas.forEach(l => {
    if (!l) return;
    let m = l.match(/^([A-Da-d])\s*[)\].:\-–—]\s*(.+)$/);
    if (m && !(atual && (atual.c >= 0 || atual.temExp))) {
      const i = 'ABCD'.indexOf(m[1].toUpperCase());
      if (!atual || atual.ops[i]) {
        fechar();
        let enun = solto;
        if (primeira) {
          let k = -1; enun.forEach((x, j) => { if (/^(\d+\s*[.)\-–—:]|pergunta|quest[ãa]o)/i.test(x)) k = j; });
          enun = k >= 0 ? enun.slice(k) : enun.slice(-1);
        }
        atual = { q: limpaNum(enun.join(' ')), ops: [], c: -1, e: '', temExp: false };
        solto = []; primeira = false;
      }
      atual.ops[i] = m[2].trim();
      return;
    }
    m = l.match(/^(resposta|gabarito)[^:]*:\s*(?:letra\s*)?\(?\s*([A-Da-d])\b/i);
    if (m && atual) { atual.c = 'ABCD'.indexOf(m[2].toUpperCase()); return; }
    m = l.match(/^explica[çc][ãa]o\s*:?\s*(.*)$/i);
    if (m && atual) { atual.e = m[1].trim(); atual.temExp = true; return; }
    if (atual && (atual.temExp || atual.c >= 0)) { fechar(); solto = [l]; return; }
    if (atual && atual.ops.length) { atual.ops[atual.ops.length - 1] += ' ' + l; return; }
    solto.push(l);
  });
  fechar();
  return { perguntas: perguntas, erros: erros };
}

const NIVEIS_ = () => [
  [DocumentApp.ParagraphHeading.HEADING1, 1], [DocumentApp.ParagraphHeading.HEADING2, 2],
  [DocumentApp.ParagraphHeading.HEADING3, 3], [DocumentApp.ParagraphHeading.HEADING4, 4],
  [DocumentApp.ParagraphHeading.HEADING5, 5], [DocumentApp.ParagraphHeading.HEADING6, 6],
  [DocumentApp.ParagraphHeading.TITLE, -1], [DocumentApp.ParagraphHeading.SUBTITLE, -1]
];
function nivel_(h) {
  const par = NIVEIS_().filter(x => x[0] === h)[0];
  return par ? par[1] : 0;
}

/** Converte o Doc no texto simples que o app sabe mostrar (o aluno não consegue alterar). */
function docParaTexto_(doc) {
  const body = doc.getBody();
  const T = DocumentApp.ElementType;
  const els = [];
  for (let i = 0; i < body.getNumChildren(); i++) els.push(body.getChild(i));
  // Níveis de título usados neste Doc: o maior vira "seção", os demais "subseção".
  const usados = els.filter(e => e.getType() === T.PARAGRAPH).map(e => nivel_(e.asParagraph().getHeading())).filter(n => n > 0);
  const topo = usados.length ? Math.min.apply(null, usados) : 1;
  const out = [];
  const docId = doc.getId();
  let nImg = 0;
  // Imagens coladas no Doc: viram arquivos públicos no Drive e aparecem no app
  const imagens = (el) => {
    const linhas = [];
    try {
      for (let i = 0; i < el.getNumChildren(); i++) {
        const c = el.getChild(i);
        if (c.getType() !== T.INLINE_IMAGE) continue;
        const img = c.asInlineImage();
        const url = imagemPublica_(img);
        if (url) linhas.push('![' + limpar_(img.getAltDescription() || img.getAltTitle() || '').replace(/[\[\]]/g, '') + '](' + url + ')');
        nImg++;
      }
    } catch (err) { Logger.log('Imagem do Doc ' + docId + ': ' + err); }
    return linhas;
  };
  els.forEach(e => {
    const t = e.getType();
    if (t === T.PARAGRAPH) {
      const p = e.asParagraph(), n = nivel_(p.getHeading());
      if (n < 0) return;                            // título do documento: o app já mostra
      const imgs = imagens(p);
      const txt = n > 0 ? limpar_(p.getText()) : textoComEstilo_(p);
      if (!txt.trim()) { if (imgs.length) { out.push(''); imgs.forEach(l => out.push(l)); } out.push(''); return; }
      if (imgs.length) { out.push(''); imgs.forEach(l => out.push(l)); out.push(''); }
      out.push(n === 0 ? txt : (n === topo ? '## ' : '### ') + txt);
    } else if (t === T.LIST_ITEM) {
      const li = e.asListItem();
      imagens(li).forEach(l => { out.push(''); out.push(l); out.push(''); });
      const txt = textoComEstilo_(li);
      if (!txt.trim()) return;
      const g = li.getGlyphType();
      const G = DocumentApp.GlyphType;
      const numerada = g === G.NUMBER || g === G.LATIN_LOWER || g === G.LATIN_UPPER || g === G.ROMAN_LOWER || g === G.ROMAN_UPPER;
      out.push(numerada && li.getNestingLevel() === 0 ? '1. ' + txt : '  - ' + txt);
    } else if (t === T.TABLE) {
      const tb = e.asTable();
      out.push('');
      for (let r = 0; r < tb.getNumRows(); r++) {
        const row = tb.getRow(r), cells = [];
        for (let c = 0; c < row.getNumCells(); c++) cells.push(limpar_(row.getCell(c).getText()));
        const linha = cells.filter(Boolean).join(' · ');
        if (linha) out.push(r === 0 ? '**' + linha + '**' : linha);
      }
      out.push('');
    }
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function limpar_(s) { return String(s || '').replace(/[\r\u000b\u2028]+/g, ' ').replace(/\*/g, '∗').replace(/[ \t]+/g, ' ').trim(); }

function textoComEstilo_(el) {
  const t = el.editAsText();
  const s = t.getText();
  if (!s) return '';
  const idx = t.getTextAttributeIndices();
  const partes = [];
  for (let i = 0; i < idx.length; i++) {
    const a = idx[i], b = i + 1 < idx.length ? idx[i + 1] : s.length;
    if (b <= a) continue;
    const st = t.isBold(a) ? 'b' : (t.isItalic(a) ? 'i' : '');
    const ln = t.getLinkUrl ? (t.getLinkUrl(a) || '') : '';
    const seg = s.substring(a, b);
    const ult = partes[partes.length - 1];
    if (ult && ult.st === st && ult.ln === ln) ult.tx += seg;
    else partes.push({ st: st, ln: ln, tx: seg });
  }
  // Parágrafo que é só um link: vira o endereço sozinho (o app mostra vídeo, áudio ou botão)
  const reais = partes.filter(p => p.tx.trim());
  if (reais.length && reais.every(p => p.ln && p.ln === reais[0].ln)) return reais[0].ln;
  return partes.map(p => {
    if (p.ln) {
      const tx = limpar_(p.tx).replace(/[\[\]]/g, '');
      const pre = /^\s/.test(p.tx) ? ' ' : '', pos = /\s$/.test(p.tx) ? ' ' : '';
      return pre + (tx && tx !== p.ln ? '[' + tx + '](' + p.ln + ')' : p.ln) + pos;
    }
    const tx = limpar_(p.tx.replace(/^\s+|\s+$/g, m => m.replace(/./g, ' ')));
    if (!p.st || !tx) return p.tx.replace(/[\r\u000b\u2028]+/g, ' ').replace(/\*/g, '∗');
    const pre = /^\s/.test(p.tx) ? ' ' : '', pos = /\s$/.test(p.tx) ? ' ' : '';
    return pre + (p.st === 'b' ? '**' + tx + '**' : '*' + tx + '*') + pos;
  }).join('').replace(/[ \t]+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* Monta anos, unidades e capítulos                                    */
/* ------------------------------------------------------------------ */
function montarAnos_(conf, conteudo, docs, anterior) {
  const antCaps = {}, antTxt = {}, antRev = {};
  ((anterior && anterior.anos) || []).forEach(a => (a.unidades || []).forEach(u => {
    (u.caps || []).forEach(c => {
      if (c.doc) antCaps[c.doc] = c;
      if (c.docRevisao) antRev[c.docRevisao] = { at: c.atualizadoRevisao, r: c.revisao, err: c.revisaoErros };
    });
    (u.temas || []).forEach(t => {
      if (t.doc) antTxt[t.doc] = { at: t.atualizado, txt: t.resumo };
      if (t.docAtividade) antTxt[t.docAtividade] = { at: t.atualizadoAtividade, txt: t.atividadeTexto };
    });
  }));
  const textoDoc = (d) => {
    const ant = antTxt[d.id];
    if (ant && ant.txt && ant.at === d.atualizado) return ant.txt;
    try { return docParaTexto_(DocumentApp.openById(d.id)); }
    catch (err) { Logger.log('Não consegui ler o Doc ' + d.id + ': ' + err); return ant ? ant.txt : ''; }
  };
  const ativos = conf.anosAtivos.length ? conf.anosAtivos : ['7', '8', '9'];
  return ativos.map(ano => {
    const unidades = {};
    const sheetU = conteudo.unidades[ano] || {};
    const sheetC = conteudo.caps[ano] || {};
    const dAno = docs.caps[ano] || {};
    const garanteU = n => unidades[n] = unidades[n] || { n: n, titulo: (sheetU[n] && sheetU[n].titulo) || ('Unidade ' + n), caps: {}, temas: {} };
    Object.keys(sheetU).forEach(n => garanteU(+n));
    Object.keys(sheetC).forEach(n => {
      const c = sheetC[n];
      garanteU(c.unidade).caps[n] = { n: +n, titulo: c.titulo, pdf: c.pdf, atividade: c.atividade };
    });
    Object.keys(dAno).forEach(n => {
      const d = dAno[n];
      const u = garanteU(sheetC[n] ? sheetC[n].unidade : d.unidade);
      const cap = u.caps[n] = u.caps[n] || { n: +n, titulo: d.nome, pdf: '', atividade: '' };
      if (!cap.titulo) cap.titulo = d.nome;
      cap.doc = d.id;
      cap.atualizado = d.atualizado;
      const ant = antCaps[d.id];
      if (ant && ant.resumo && ant.atualizado === d.atualizado) cap.resumo = ant.resumo;
      else {
        try { cap.resumo = docParaTexto_(DocumentApp.openById(d.id)); }
        catch (err) { Logger.log('Não consegui ler o Doc ' + d.id + ': ' + err); cap.resumo = ant ? ant.resumo : ''; }
      }
    });
    // Revisão rápida: perguntas do Doc "NN Revisão" (o app sorteia 6 e embaralha as alternativas)
    const rAno = (docs.revs || {})[ano] || {};
    Object.keys(rAno).forEach(n => {
      const d = rAno[n];
      const u = Object.keys(unidades).map(k => unidades[k]).filter(x => x.caps[n])[0];
      if (!u) return;
      const cap = u.caps[n], ant = antRev[d.id];
      cap.docRevisao = d.id; cap.atualizadoRevisao = d.atualizado;
      if (ant && ant.r && ant.at === d.atualizado) { cap.revisao = ant.r; cap.revisaoErros = ant.err || []; return; }
      try {
        const lido = lerRevisao_(DocumentApp.openById(d.id).getBody().getText());
        cap.revisao = lido.perguntas; cap.revisaoErros = lido.erros;
      } catch (err) { Logger.log('Não consegui ler a revisão ' + d.id + ': ' + err); if (ant) { cap.revisao = ant.r; cap.revisaoErros = ant.err || []; } }
    });
    // Temas Transversais (aulas extras · recuperação paralela)
    const sheetT = conteudo.temas[ano] || {};
    Object.keys(sheetT).forEach(k => {
      const t = sheetT[k];
      garanteU(t.unidade).temas[t.n] = { n: t.n, titulo: t.titulo, atividade: t.atividade, pdf: t.pdf };
    });
    const dT = docs.temas[ano] || {};
    Object.keys(dT).forEach(un => Object.keys(dT[un]).forEach(n => {
      const d = dT[un][n], u = garanteU(+un);
      const t = u.temas[n] = u.temas[n] || { n: +n, titulo: '', atividade: '', pdf: '' };
      if (d.aula) {
        if (!t.titulo) t.titulo = d.aula.nome;
        t.doc = d.aula.id; t.atualizado = d.aula.atualizado; t.resumo = textoDoc(d.aula);
      }
      if (d.atividade) {
        t.docAtividade = d.atividade.id; t.atualizadoAtividade = d.atividade.atualizado; t.atividadeTexto = textoDoc(d.atividade);
      }
    }));
    const lista = Object.keys(unidades).map(Number).sort((a, b) => a - b).map(n => {
      const u = unidades[n];
      const temas = Object.keys(u.temas).map(Number).sort((a, b) => a - b).map(k => u.temas[k]).filter(t => t.resumo || t.atividade || t.atividadeTexto);
      return { n: n, titulo: u.titulo, caps: Object.keys(u.caps).map(Number).sort((a, b) => a - b).map(k => u.caps[k]), temas: temas };
    });
    let atual = Object.keys(sheetU).map(Number).filter(n => sheetU[n].atual)[0];
    if (!atual) atual = lista.length ? lista[lista.length - 1].n : 1;
    return {
      ano: ano,
      nome: ano + 'º ano',
      livro: conteudo.livro[ano] || '',
      turmas: conf.turmas[ano] || [],
      atual: atual,
      unidades: lista
    };
  });
}

/* ------------------------------------------------------------------ */
/* Agendas das turmas                                                   */
/* ------------------------------------------------------------------ */
function lerAgendas_(turmas) {
  const ini = new Date(Date.now() - GEO.DIAS_ANTES * 864e5);
  const fim = new Date(Date.now() + GEO.DIAS_DEPOIS * 864e5);
  const fmt = (d, f) => Utilities.formatDate(d, GEO.FUSO, f);
  const agenda = {};
  turmas.forEach(t => {
    agenda[t] = [];
    const cal = CalendarApp.getCalendarsByName(GEO.PREFIXO_AGENDA + t)[0];
    if (!cal) { Logger.log('Agenda não encontrada: ' + GEO.PREFIXO_AGENDA + t); return; }
    cal.getEvents(ini, fim).forEach(ev => {
      const dia = ev.isAllDayEvent();
      const d = dia ? ev.getAllDayStartDate() : ev.getStartTime();
      agenda[t].push(eventoParaApp_(ev.getId(), ev.getTitle(), ev.getDescription(), fmt(d, 'yyyy-MM-dd'), dia ? '' : fmt(d, 'HH:mm')));
    });
    agenda[t].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  });
  return agenda;
}

function eventoParaApp_(id, titulo, descricao, data, hora) {
  const bruto = String(descricao || '');
  const link = (bruto.match(/https?:\/\/[^\s"'<>]+/) || [''])[0];
  const desc = bruto.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/https?:\/\/[^\s"'<>]+/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
  const t = semAcento_(titulo);
  const tipo = t.indexOf('entrega do caderno') === 0 ? 'caderno'
    : t.indexOf('atividade de fixacao') === 0 ? 'atividade'
    : t.indexOf('tema transversal') >= 0 ? 'tema'
    : /avaliac|prova|teste|simulado/.test(t) ? 'avaliacao' : 'aviso';
  const mc = String(titulo).match(/cap(?:[ií]tulo|\.)?\s*(\d+)/i);
  const mt = tipo === 'tema' ? String(titulo).match(/tema transversal\s*(\d+)/i) : null;
  return { id: id + '@' + data, data: data, hora: hora, titulo: String(titulo || '').trim(), tipo: tipo, cap: mt ? 't' + mt[1] : (mc ? +mc[1] : null), descricao: desc, link: link };
}

/* ------------------------------------------------------------------ */
/* Avisos de novidade (resumo novo, data nova na agenda)                */
/* ------------------------------------------------------------------ */
function calcularAvisos_(dados, anterior, conf) {
  if (!anterior || !anterior.anos) return [];       // primeira leitura: nada é "novo"
  const agora = dados.versao;
  const hoje = Utilities.formatDate(new Date(), GEO.FUSO, 'yyyy-MM-dd');
  const limite = new Date(Date.now() - GEO.AVISOS_DIAS * 864e5).toISOString();
  const pubDuv = {};
  (dados.duvidas || []).forEach(d => pubDuv['d-' + d.id] = true);
  // Avisos de dúvidas que foram despublicadas ou apagadas também somem
  const avisos = (anterior.avisos || []).filter(a => a.quando >= limite && (a.tipo !== 'duvida' || pubDuv[a.id.replace(/-[^-]+$/, '')]));
  const ja = {};
  avisos.forEach(a => ja[a.id] = true);

  const antDocs = {};
  anterior.anos.forEach(a => a.unidades.forEach(u => u.caps.forEach(c => { if (c.doc && c.resumo) antDocs[a.ano + '-' + c.n] = true; })));
  dados.anos.forEach(a => a.unidades.forEach(u => u.caps.forEach(c => {
    const id = 'r-' + a.ano + '-' + c.n;
    if (c.doc && c.resumo && !antDocs[a.ano + '-' + c.n] && !ja[id]) {
      avisos.push({ id: id, quando: agora, ano: a.ano, tipo: 'resumo', titulo: 'Resumo novo no app', texto: 'Capítulo ' + c.n + ': ' + c.titulo + '. Leia e copie no caderno.', cap: c.n });
    }
  })));

  const antTemas = {};
  anterior.anos.forEach(a => a.unidades.forEach(u => (u.temas || []).forEach(t => { if (t.resumo) antTemas[a.ano + '-' + t.n] = true; })));
  dados.anos.forEach(a => a.unidades.forEach(u => (u.temas || []).forEach(t => {
    const id = 'tt-' + a.ano + '-' + t.n;
    if (t.resumo && !antTemas[a.ano + '-' + t.n] && !ja[id]) {
      avisos.push({ id: id, quando: agora, ano: a.ano, tipo: 'resumo', titulo: 'Tema Transversal novo', texto: 'Tema Transversal ' + t.n + ': ' + t.titulo + '. Aula extra que vale ponto na recuperação.', cap: 't' + t.n });
    }
  })));

  const antDuv = {};
  (anterior.duvidas || []).forEach(d => antDuv[d.id] = true);
  (dados.duvidas || []).forEach(d => {
    const id = 'd-' + d.id;
    if (antDuv[d.id] || ja[id]) return;
    d.turmas.forEach(t => avisos.push({ id: id + '-' + t, quando: agora, turma: t, tipo: 'duvida', titulo: 'Dúvida respondida', texto: (d.sobre ? d.sobre + ': ' : '') + d.pergunta.slice(0, 90), cap: null }));
  });

  if (conf.avisoNovo) {
    const antEv = {};
    Object.keys(anterior.agenda || {}).forEach(t => anterior.agenda[t].forEach(e => antEv[t + '|' + e.id] = true));
    Object.keys(dados.agenda).forEach(t => dados.agenda[t].forEach(e => {
      const id = 'e-' + t + '-' + e.id;
      if (e.data < hoje || antEv[t + '|' + e.id] || ja[id]) return;
      const dm = e.data.slice(8, 10) + '/' + e.data.slice(5, 7);
      avisos.push({ id: id, quando: agora, turma: t, tipo: e.tipo, titulo: 'Nova data na agenda', texto: e.titulo + ' · ' + dm, data: e.data, cap: e.cap });
    }));
  }
  return avisos.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, GEO.AVISOS_MAX);
}

/* ------------------------------------------------------------------ */
/* Arquivo de dados e cache                                             */
/* ------------------------------------------------------------------ */
function arquivoDados_() {
  const it = DriveApp.getFolderById(GEO.PASTA_APP).getFilesByName(GEO.ARQUIVO_DADOS);
  return it.hasNext() ? it.next() : null;
}
function lerDadosAnteriores_() {
  const f = arquivoDados_();
  if (!f) return null;
  try { return JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { return null; }
}
function gravarDados_(txt) {
  const f = arquivoDados_();
  if (f) f.setContent(txt);
  else DriveApp.getFolderById(GEO.PASTA_APP).createFile(GEO.ARQUIVO_DADOS, txt, MimeType.PLAIN_TEXT);
}
const PEDACO_ = 40000;
function guardarCache_(txt) {
  try {
    const c = CacheService.getScriptCache(), obj = {};
    const n = Math.ceil(txt.length / PEDACO_);
    for (let i = 0; i < n; i++) obj['d' + i] = txt.substr(i * PEDACO_, PEDACO_);
    obj.n = String(n);
    c.putAll(obj, 21600);
  } catch (e) { Logger.log('Cache: ' + e); }
}
function lerCache_() {
  try {
    const c = CacheService.getScriptCache();
    const n = parseInt(c.get('n'), 10);
    if (!n) return null;
    const ks = [];
    for (let i = 0; i < n; i++) ks.push('d' + i);
    const got = c.getAll(ks);
    let s = '';
    for (let i = 0; i < n; i++) { if (got['d' + i] == null) return null; s += got['d' + i]; }
    return s;
  } catch (e) { return null; }
}

/* ------------------------------------------------------------------ */
/* Relatórios para o professor                                          */
/* ------------------------------------------------------------------ */
function resumoTexto_(d) {
  if (!d) return 'Sem dados.';
  const l = ['Última atualização: ' + Utilities.formatDate(new Date(d.versao), GEO.FUSO, "dd/MM/yyyy 'às' HH:mm")];
  d.anos.forEach(a => {
    const u = a.unidades.filter(x => x.n === a.atual)[0];
    const pub = u ? u.caps.filter(c => c.resumo).length : 0;
    l.push(a.nome + ' (turmas ' + a.turmas.join(', ') + ') · Unidade ' + a.atual + ': ' + pub + ' resumo(s) publicado(s) de ' + (u ? u.caps.length : 0));
  });
  Object.keys(d.agenda).forEach(t => l.push('Agenda ' + t + ': ' + d.agenda[t].length + ' evento(s)'));
  d.anos.forEach(a => a.unidades.forEach(u => u.caps.forEach(c => {
    if (!c.docRevisao) return;
    l.push('Revisão ' + a.nome + ' · Cap. ' + c.n + ': ' + (c.revisao || []).length + ' pergunta(s) ok' + ((c.revisaoErros || []).length ? ' · PROBLEMAS:' : ''));
    (c.revisaoErros || []).forEach(e => l.push('   ⚠ ' + e));
  })));
  l.push('Avisos de novidade ativos: ' + (d.avisos || []).length);
  l.push('Mural de avisos: ' + (d.mural || []).length + ' aviso(s) publicado(s)');
  return l.join('\n');
}

function paginaStatus_(d) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><div style="font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px">' +
    '<h2 style="color:#1D3F8F">Robô do GeoEstudos: funcionando</h2><p>Versão publicada: <b>' + VERSAO_ROBO + '</b></p><pre style="white-space:pre-wrap;background:#FBF8F1;padding:12px;border-radius:8px">' +
    esc(resumoTexto_(d)) + '</pre></div>';
  return HtmlService.createHtmlOutput(html).setTitle('GeoEstudos · robô');
}

/* ================================================================== */
/* Avisos no celular (Web Push)                                        */
/* Enviados direto pelo robô, sem serviço de terceiros. O celular só   */
/* recebe um "toque" e busca o texto do aviso aqui no robô.            */
/* ================================================================== */

/** Monta as notificações novas desta rodada: novidades (resumo novo, data nova) e lembretes de prazo. */
function novasNotificacoes_(dados, anterior, conf) {
  const agora = dados.versao;
  const props = PropertiesService.getScriptProperties();
  const porTurma = {};
  const add = (t, item) => (porTurma[t] = porTurma[t] || []).push(item);
  const turmasDoAno = {};
  dados.anos.forEach(a => turmasDoAno[a.ano] = a.turmas);

  // 1) Novidades criadas nesta rodada
  const antes = {};
  ((anterior && anterior.avisos) || []).forEach(a => antes[a.id] = true);
  (dados.avisos || []).filter(a => !antes[a.id]).forEach(a => {
    const ts = a.turma ? [a.turma] : (turmasDoAno[a.ano] || []);
    ts.forEach(t => add(t, { tipo: 'novidade', titulo: a.titulo, texto: a.texto, cap: a.cap || null, tab: a.tipo === 'resumo' ? 'resumos' : a.tipo === 'duvida' ? 'turma' : 'calendario' }));
  });

  // 1b) Avisos do mural marcados com "Notificação no celular? = Sim" (uma vez só por aviso)
  (dados.mural || []).forEach(m => {
    if (!m.notificar || props.getProperty('mural-' + m.id)) return;
    m.turmas.forEach(t => add(t, { tipo: 'mural', titulo: '📢 ' + m.titulo, texto: m.texto.slice(0, 220), cap: m.id, tab: 'mural' }));
    props.setProperty('mural-' + m.id, agora);
  });

  // 2) Lembretes: na véspera e no dia de cada entrega, atividade ou avaliação
  const fmt = (d, f) => Utilities.formatDate(d, GEO.FUSO, f);
  const agoraD = new Date();
  const hoje = fmt(agoraD, 'yyyy-MM-dd'), amanha = fmt(new Date(agoraD.getTime() + 864e5), 'yyyy-MM-dd');
  const hm = fmt(agoraD, 'HH:mm');
  const janela = (hora) => {          // entre a hora marcada e 3 horas depois
    const m = /^(\d{1,2}):(\d{2})/.exec(hora || '');
    if (!m) return false;
    const ini = (+m[1]) * 60 + (+m[2]), cur = (+hm.slice(0, 2)) * 60 + (+hm.slice(3, 5));
    return cur >= ini && cur < ini + 180;
  };
  [['vespera', conf.lembreteVespera || '18:00', amanha, 'Amanhã'], ['dia', conf.lembreteDia || '07:00', hoje, 'Hoje']].forEach(r => {
    const chave = 'lembrete-' + r[0] + '-' + hoje;
    if (props.getProperty(chave) || !janela(r[1])) return;
    Object.keys(dados.agenda).forEach(t => {
      const evs = dados.agenda[t].filter(e => e.data === r[2] && e.tipo !== 'aviso');
      if (!evs.length) return;
      add(t, { tipo: 'lembrete', titulo: r[3] + ': ' + resumoEventos_(evs, r[0] === 'dia'), texto: textoEventos_(evs), cap: evs.length === 1 ? evs[0].cap : null, tab: evs.every(e => e.tipo === 'atividade') ? 'atividades' : 'calendario' });
    });
    props.setProperty(chave, '1');
  });

  // Uma notificação por turma (se houver várias coisas, junta numa só)
  const out = [];
  Object.keys(porTurma).forEach(t => {
    const its = porTurma[t];
    const lemb = its.filter(i => i.tipo === 'lembrete'), nov = its.filter(i => i.tipo === 'novidade');
    its.filter(i => i.tipo === 'mural').forEach((i, k) => out.push({ id: 'n-' + t + '-' + agora + '-m' + k, turma: t, quando: agora, titulo: i.titulo, texto: i.texto, cap: i.cap, tab: 'mural' }));
    lemb.forEach((i, k) => out.push({ id: 'n-' + t + '-' + agora + '-l' + k, turma: t, quando: agora, titulo: i.titulo, texto: i.texto, cap: i.cap, tab: i.tab }));
    if (nov.length === 1) out.push({ id: 'n-' + t + '-' + agora, turma: t, quando: agora, titulo: nov[0].titulo, texto: nov[0].texto, cap: nov[0].cap, tab: nov[0].tab });
    else if (nov.length > 1) out.push({ id: 'n-' + t + '-' + agora, turma: t, quando: agora, titulo: nov.length + ' novidades no GeoEstudos', texto: nov.map(i => i.texto).join(' · ').slice(0, 220), cap: null, tab: 'turma' });
  });
  return out;
}

function resumoEventos_(evs, hoje) {
  const caps = evs.filter(e => typeof e.cap === 'number').map(e => e.cap).sort((a, b) => a - b);
  const q = (tipo) => evs.filter(e => e.tipo === tipo).length;
  const partes = [];
  if (q('caderno')) partes.push(q('caderno') === 1 ? 'entrega do caderno' : q('caderno') + ' entregas do caderno');
  if (q('atividade')) partes.push(q('atividade') === 1 ? (hoje ? 'último dia da atividade de fixação' : 'prazo final da atividade de fixação') : (hoje ? 'último dia de ' : 'prazo final de ') + q('atividade') + ' atividades de fixação');
  if (q('tema')) partes.push(q('tema') === 1 ? 'prazo do Tema Transversal' : 'prazo de ' + q('tema') + ' Temas Transversais');
  if (q('avaliacao')) partes.push(q('avaliacao') === 1 ? 'avaliação' : q('avaliacao') + ' avaliações');
  return partes.join(' e ') + (caps.length === 1 ? ' (Cap. ' + caps[0] + ')' : caps.length > 1 ? ' (Caps. ' + caps[0] + ' a ' + caps[caps.length - 1] + ')' : '');
}
function textoEventos_(evs) {
  return evs.map(e => e.titulo.replace(/^(Entrega do caderno|Atividade de fixação)\s*·\s*/i, '')).join(' · ').slice(0, 220);
}

/* ---------- Inscrições (cada celular que ativou os avisos) ---------- */
function enderecoValido_(ep) {
  return /^https:\/\/(fcm\.googleapis\.com|[\w.-]*push\.apple\.com|updates\.push\.services\.mozilla\.com|[\w.-]*notify\.windows\.com|[\w.-]*push\.services\.mozilla\.com)\//.test(ep) && ep.length < 1000;
}
function planilhaInscricoes_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('planilhaInscricoes');
  if (id) { try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { } }
  const ss = SpreadsheetApp.create('GeoEstudos - celulares com avisos ativados (não apagar)');
  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(GEO.PASTA_APP));
  const sh = ss.getSheets()[0];
  sh.appendRow(['Endereço de aviso do celular (não identifica o aluno)', 'Turma(s)', 'Ativado em', 'Última confirmação']);
  sh.setFrozenRows(1);
  props.setProperty('planilhaInscricoes', ss.getId());
  return sh;
}
function lerInscricoes_() {
  const v = planilhaInscricoes_().getDataRange().getValues().slice(1);
  return v.filter(r => r[0]).map(r => ({ endpoint: String(r[0]), turmas: String(r[1]).split(/[,;\s]+/).filter(Boolean) }));
}
function salvarInscricao_(ep, turma) {
  const sh = planilhaInscricoes_();
  const v = sh.getDataRange().getValues();
  const agora = new Date();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]) === ep) { sh.getRange(i + 1, 2).setValue(turma); sh.getRange(i + 1, 4).setValue(agora); return; }
  }
  sh.appendRow([ep, turma, agora, agora]);
}
function removerInscricoes_(eps) {
  if (!eps.length) return;
  const sh = planilhaInscricoes_();
  const v = sh.getDataRange().getValues();
  for (let i = v.length - 1; i >= 1; i--) if (eps.indexOf(String(v[i][0])) >= 0) sh.deleteRow(i + 1);
}

/* ---------- Envio ---------- */
function enviarAvisos_(notifs) {
  const turmas = {};
  notifs.forEach(n => turmas[n.turma] = true);
  const alvo = lerInscricoes_().filter(s => s.turmas.some(t => turmas[t]));
  if (!alvo.length) return;
  const ch = chavesAvisos_();
  const jwts = {};
  const reqs = alvo.map(s => {
    const aud = s.endpoint.match(/^https:\/\/[^/]+/)[0];
    const jwt = jwts[aud] || (jwts[aud] = jwtAviso_(aud, ch));
    return { url: s.endpoint, method: 'post', payload: '', muteHttpExceptions: true,
      headers: { TTL: '86400', Urgency: 'high', Authorization: 'vapid t=' + jwt + ', k=' + ch.pub } };
  });
  const mortos = [];
  let ok = 0;
  for (let i = 0; i < reqs.length; i += 40) {
    const parte = reqs.slice(i, i + 40);
    UrlFetchApp.fetchAll(parte).forEach((r, k) => {
      const c = r.getResponseCode();
      if (c >= 200 && c < 300) ok++;
      else if (c === 404 || c === 410) mortos.push(parte[k].url);
      else Logger.log('Aviso não entregue (' + c + '): ' + r.getContentText().slice(0, 200));
    });
  }
  removerInscricoes_(mortos);
  Logger.log('Avisos enviados para ' + ok + ' celular(es).');
}

/** Envia um aviso de teste para todos os celulares que ativaram os avisos (todas as turmas). */
function testarAviso() {
  const f = arquivoDados_();
  const d = JSON.parse(f.getBlob().getDataAsString('UTF-8'));
  const turmas = {};
  lerInscricoes_().forEach(s => s.turmas.forEach(t => turmas[t] = true));
  const ts = Object.keys(turmas);
  if (!ts.length) { Logger.log('Nenhum celular ativou os avisos ainda.'); return; }
  const agora = new Date().toISOString();
  const ns = ts.map(t => ({ id: 'teste-' + t + '-' + Date.now(), turma: t, quando: agora, titulo: 'Teste do GeoEstudos', texto: 'Se você está lendo isto, os avisos da turma ' + t + ' estão funcionando.', cap: null, tab: 'turma' }));
  d.notificacoes = (d.notificacoes || []).concat(ns);
  const txt = JSON.stringify(d);
  gravarDados_(txt);
  guardarCache_(txt);
  enviarAvisos_(ns);
}

/* ---------- Chaves e assinatura (VAPID, curva P-256) ---------- */
const P256_ = {
  p: BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
  n: BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
  b: BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b'),
  G: [BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
      BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')]
};
function md_(a, m) { const r = a % m; return r < BigInt(0) ? r + m : r; }
function inv_(a, m) {
  let r0 = md_(a, m), r1 = m, s0 = BigInt(1), s1 = BigInt(0);
  while (r1 !== BigInt(0)) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; }
  return md_(s0, m);
}
function somaPt_(P, Q) {
  const p = P256_.p;
  if (!P) return Q; if (!Q) return P;
  let l;
  if (P[0] === Q[0]) {
    if (md_(P[1] + Q[1], p) === BigInt(0)) return null;
    l = md_((BigInt(3) * P[0] * P[0] - BigInt(3)) * inv_(BigInt(2) * P[1], p), p);
  } else {
    l = md_((Q[1] - P[1]) * inv_(Q[0] - P[0], p), p);
  }
  const x = md_(l * l - P[0] - Q[0], p);
  return [x, md_(l * (P[0] - x) - P[1], p)];
}
function multPt_(k, P) {
  let R = null, A = P;
  while (k > BigInt(0)) { if (k & BigInt(1)) R = somaPt_(R, A); A = somaPt_(A, A); k >>= BigInt(1); }
  return R;
}
function bytesParaBig_(bs) { let h = ''; bs.forEach(b => h += ((b & 255) + 256).toString(16).slice(1)); return BigInt('0x' + (h || '0')); }
function bigParaBytes_(x) { const h = x.toString(16).padStart(64, '0'); const o = []; for (let i = 0; i < 64; i += 2) { const v = parseInt(h.substr(i, 2), 16); o.push(v > 127 ? v - 256 : v); } return o; }
function b64u_(x) { return Utilities.base64EncodeWebSafe(x).replace(/=+$/, ''); }
function aleatorio_() {
  const bs = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now() + Math.random());
  return md_(bytesParaBig_(bs), P256_.n - BigInt(1)) + BigInt(1);
}
function chavesAvisos_() {
  const props = PropertiesService.getScriptProperties();
  let priv = props.getProperty('avisosPriv'), pub = props.getProperty('avisosPub');
  if (priv && pub) return { d: BigInt('0x' + priv), pub: pub };
  const d = aleatorio_();
  const Q = multPt_(d, P256_.G);
  pub = b64u_([4].concat(bigParaBytes_(Q[0]), bigParaBytes_(Q[1])));
  props.setProperties({ avisosPriv: d.toString(16), avisosPub: pub });
  return { d: d, pub: pub };
}
function assinar_(texto, d) {
  const n = P256_.n;
  const e = bytesParaBig_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8));
  for (;;) {
    const k = aleatorio_();
    const r = md_(multPt_(k, P256_.G)[0], n);
    if (r === BigInt(0)) continue;
    const s = md_(inv_(k, n) * (e + r * d), n);
    if (s === BigInt(0)) continue;
    return bigParaBytes_(r).concat(bigParaBytes_(s));
  }
}
function jwtAviso_(aud, ch) {
  const cache = CacheService.getScriptCache(), chave = 'jwt|' + aud;
  const salvo = cache.get(chave);
  if (salvo) return salvo;
  const cab = b64u_(Utilities.newBlob(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).getBytes());
  const corpo = b64u_(Utilities.newBlob(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:prof.haroldomatos@gmail.com' })).getBytes());
  const jwt = cab + '.' + corpo + '.' + b64u_(assinar_(cab + '.' + corpo, ch.d));
  cache.put(chave, jwt, 6 * 3600);
  return jwt;
}

/* ---------- Aba "Temas Transversais" na planilha de Conteúdo ---------- */
/** Cria a aba (se não existir) e acrescenta uma linha para cada Tema Transversal encontrado nas pastas. */
/* ================================================================== */
/* Mural de avisos: aba "Mural de avisos" na planilha de Configurações */
/* ================================================================== */
const ABA_MURAL = 'Mural de avisos';
const COLS_MURAL = ['Data de publicação', 'Título', 'Mensagem', 'Para quem', 'Destaque', 'Fixo no topo até', 'Notificação no celular?', 'Link (opcional)', 'Publicar?', 'Situação (o robô preenche)', 'Código'];
const NOTAS_MURAL = [
  'Opcional. Em branco: o aviso entra no ar assim que você marcar "Publicar?" = Sim, e o robô anota a data aqui. Com uma data futura, o aviso fica agendado e entra no ar nesse dia (a partir das 6h).',
  'Curto e direto. Ex.: Feriado na sexta-feira (25/10)',
  'O texto completo do aviso. Pode ter várias linhas (Ctrl+Enter ou Alt+Enter quebra a linha dentro da célula).',
  'Escolha na lista: Todas as turmas, um ano inteiro ou uma turma. Para algumas turmas, escreva separado por ponto e vírgula. Ex.: 71; 72',
  'Normal: só no mural.\nPop-up: aparece na frente da tela uma vez, quando o aluno abrir o app.\nFixo no topo: faixa vermelha no alto da página da turma até a data da coluna F.\nPop-up e fixo no topo: os dois.',
  'Só vale para avisos fixos. Último dia em que a faixa aparece. Em branco: fica fixo por 7 dias.',
  'Sim: os celulares com avisos ativados recebem uma notificação (uma vez só, quando o aviso entra no ar).',
  'Opcional. Um endereço (https://...) que vira o botão "Abrir link" no aviso.',
  'Marque Sim só quando o aviso estiver pronto. Enquanto estiver Não ou em branco, é um rascunho e ninguém vê.',
  'Preenchida pelo robô: mostra se o aviso está no ar, agendado ou se falta alguma coisa.',
  'Uso interno do robô. Não apague.'
];
function abaMural_() {
  const ss = SpreadsheetApp.openById(GEO.PLANILHA_CONFIG);
  let sh = ss.getSheetByName(ABA_MURAL);
  if (sh) return sh;
  sh = ss.insertSheet(ABA_MURAL);
  const n = COLS_MURAL.length, linhas = 400;
  sh.getRange(1, 1, 1, n).setValues([COLS_MURAL]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#B42B2B').setWrap(true).setVerticalAlignment('middle');
  sh.getRange(1, 1, 1, n).setNotes([NOTAS_MURAL]);
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 42);
  [120, 220, 380, 150, 170, 120, 120, 180, 90, 260, 80].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(2, 3, linhas, 1).setWrap(true);
  sh.getRange(2, 1, linhas, n).setVerticalAlignment('top');
  const data = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Digite uma data, ex.: 25/10/2026').build();
  sh.getRange(2, 1, linhas, 1).setDataValidation(data).setNumberFormat('dd/MM/yyyy');
  sh.getRange(2, 6, linhas, 1).setDataValidation(data).setNumberFormat('dd/MM/yyyy');
  const conf = lerConfig_();
  const turmas = [].concat.apply([], Object.keys(conf.turmas).sort().map(a => conf.turmas[a]));
  const para = ['Todas as turmas', '7º ano', '8º ano', '9º ano'].concat(turmas);
  sh.getRange(2, 4, linhas, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(para, true).setAllowInvalid(true).setHelpText('Escolha na lista ou escreva turmas separadas por ponto e vírgula, ex.: 71; 72').build());
  sh.getRange(2, 5, linhas, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Normal', 'Pop-up', 'Fixo no topo', 'Pop-up e fixo no topo'], true).build());
  const simNao = SpreadsheetApp.newDataValidation().requireValueInList(['Sim', 'Não'], true).build();
  sh.getRange(2, 7, linhas, 1).setDataValidation(simNao);
  sh.getRange(2, 9, linhas, 1).setDataValidation(simNao);
  sh.getRange(2, 10, linhas, 1).setFontColor('#5B6472').setFontStyle('italic');
  sh.hideColumns(11);
  return sh;
}
function lerMural_(dados) {
  const sh = abaMural_();
  const fmt = (d, f) => Utilities.formatDate(d, GEO.FUSO, f);
  const hoje = fmt(new Date(), 'yyyy-MM-dd');
  const dm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  const props = PropertiesService.getScriptProperties();
  const porAno = {}, todas = [];
  dados.anos.forEach(a => { porAno[a.ano] = a.turmas; a.turmas.forEach(t => todas.push(t)); });
  const ult = sh.getLastRow();
  const linhas = ult > 1 ? sh.getRange(2, 1, ult - 1, COLS_MURAL.length).getValues() : [];
  const itens = [], situacao = [];
  const isoDe = v => (v instanceof Date && !isNaN(v)) ? fmt(v, 'yyyy-MM-dd') : '';
  linhas.forEach((l, i) => {
    const linha = i + 2;
    const titulo = String(l[1] || '').trim(), texto = String(l[2] || '').trim();
    if (!titulo && !texto) { situacao.push(['']); return; }
    let id = String(l[10] || '').trim();
    if (!id) { id = 'm' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); sh.getRange(linha, 11).setValue(id); }
    if (!titulo || !texto) { situacao.push(['⚠ Falta ' + (!titulo ? 'o título' : 'a mensagem')]); return; }
    if (!sim_(l[8])) { situacao.push(['Rascunho · marque "Publicar?" = Sim quando estiver pronto']); return; }
    let data = isoDe(l[0]);
    const semData = !data;
    if (semData) data = hoje;
    if (data > hoje) { situacao.push(['Agendado para ' + dm(data)]); return; }
    // Para quem
    const p = semAcento_(l[3]);
    let ts = [];
    if (!p || p.indexOf('toda') >= 0) ts = todas.slice();
    else {
      (p.match(/(^|[^\d])[789]\s*(º|°|o\b|ano)/g) || []).forEach(x => { const a = x.match(/[789]/)[0]; (porAno[a] || []).forEach(t => ts.push(t)); });
      (p.match(/\b\d{2}\b/g) || []).forEach(t => { if (todas.indexOf(t) >= 0) ts.push(t); });
    }
    ts = ts.filter((t, k) => ts.indexOf(t) === k);
    if (!ts.length) { situacao.push(['⚠ Não reconheci a coluna "Para quem". Use a lista ou escreva, ex.: 71; 72']); return; }
    if (semData) sh.getRange(linha, 1).setValue(new Date());
    const dest = semAcento_(l[4]);
    const popup = dest.indexOf('pop') >= 0, fixo = dest.indexOf('fix') >= 0;
    let fixoAte = '';
    if (fixo) fixoAte = isoDe(l[5]) || fmt(new Date(Date.parse(data + 'T12:00:00') + 7 * 864e5), 'yyyy-MM-dd');
    let link = String(l[7] || '').trim();
    if (link && !/^https?:\/\//i.test(link)) link = '';
    const notificar = sim_(l[6]);
    itens.push({ id: id, data: data, titulo: titulo.slice(0, 120), texto: texto.slice(0, 1500), turmas: ts, todas: ts.length === todas.length, popup: popup, fixoAte: fixoAte, link: link, notificar: notificar });
    situacao.push([null]); // preenchida depois das notificações
    situacao[situacao.length - 1].item = itens[itens.length - 1];
  });
  itens.sort((a, b) => b.data.localeCompare(a.data));
  return {
    itens: itens.slice(0, 80),
    escreverSituacao: () => {
      if (!situacao.length) return;
      const out = situacao.map(r => {
        const m = r.item;
        if (!m) return [r[0]];
        let t = 'No ar desde ' + dm(m.data);
        if (m.fixoAte) t += m.fixoAte >= hoje ? ' · fixo no topo até ' + dm(m.fixoAte) : ' · já saiu do topo';
        if (m.popup) t += ' · pop-up';
        if (m.notificar) t += props.getProperty('mural-' + m.id) ? ' · notificação enviada' : ' · notificação na fila';
        return [t];
      });
      sh.getRange(2, 10, out.length, 1).setValues(out);
    }
  };
}

function prepararAbaTemas_() {
  const ss = SpreadsheetApp.openById(GEO.PLANILHA_CONTEUDO);
  let sh = ss.getSheets().filter(s => semAcento_(s.getName()).indexOf('temas') === 0)[0];
  if (!sh) {
    sh = ss.insertSheet('Temas Transversais', 3);
    sh.appendRow(['Ano', 'Unidade', 'Tema', 'Título do tema', 'Atividade (link do formulário)', 'PDF da aula (link)']);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1D3F8F').setWrap(true);
    sh.setFrozenRows(1);
    [10, 9, 8, 60, 70, 55].forEach((w, i) => sh.setColumnWidth(i + 1, w * 7));
  }
  const tem = {};
  sh.getDataRange().getDisplayValues().slice(1).forEach(l => tem[anoDe_(l[0]) + '-' + parseInt(l[1], 10) + '-' + parseInt(String(l[2]).replace(/\D+/g, ''), 10)] = true);
  const temas = lerDocs_().temas;
  Object.keys(temas).sort().forEach(a => Object.keys(temas[a]).forEach(u => Object.keys(temas[a][u]).forEach(n => {
    const t = temas[a][u][n];
    if (!t.aula || tem[a + '-' + u + '-' + n]) return;
    sh.appendRow([a + 'º ano', +u, +n, t.aula.nome, '', '']);
  })));
}

/* ---------- Imagens dos Docs ---------- */
function pastaImagens_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('pastaImagens');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  const p = DriveApp.getFolderById(GEO.PASTA_APP).createFolder('GeoEstudos - imagens do app (não apagar)');
  props.setProperty('pastaImagens', p.getId());
  return p;
}
/** Guarda a imagem (uma vez só, mesmo que o Doc seja lido de novo) e devolve um endereço público para o app. */
function imagemPublica_(img) {
  const blob = img.getBlob();
  const bytes = blob.getBytes();
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes).map(b => ((b & 255) + 256).toString(16).slice(1)).join('').slice(0, 20);
  const tipo = (blob.getContentType() || 'image/png').split('/')[1].replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '');
  const nome = 'img-' + hash + '.' + tipo;
  const pasta = pastaImagens_();
  const it = pasta.getFilesByName(nome);
  let f;
  if (it.hasNext()) f = it.next();
  else {
    f = pasta.createFile(blob.setName(nome));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  return 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w1600';
}

/* ================================================================== */
/* Caixa de dúvidas                                                    */
/* As dúvidas vão para uma planilha que só o professor vê. As respostas */
/* marcadas para publicar aparecem no app, SEM o nome de quem perguntou. */
/* ================================================================== */
function planilhaDuvidas_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('planilhaDuvidas');
  if (id) { try { return SpreadsheetApp.openById(id).getSheets()[0]; } catch (e) { } }
  const ss = SpreadsheetApp.create('GeoEstudos - dúvidas dos alunos (não apagar)');
  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(GEO.PASTA_APP));
  const sh = ss.getSheets()[0];
  sh.setName('Dúvidas');
  sh.appendRow(['Recebida em', 'Turma', 'Nome (digitado pelo aluno)', 'Sobre', 'Dúvida', 'Sua resposta (escreva aqui)', 'Publicar no app? (Turma / Ano / Não)', 'Código']);
  sh.getRange(1, 1, 1, 8).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1D3F8F').setWrap(true);
  sh.setFrozenRows(1);
  [16, 7, 24, 26, 55, 55, 22, 10].forEach((w, i) => sh.setColumnWidth(i + 1, w * 7));
  sh.getRange('G2:G1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Turma', 'Ano', 'Não'], true).build());
  sh.hideColumns(8);
  props.setProperty('planilhaDuvidas', ss.getId());
  return sh;
}
function prepararConfigDuvidas_() {
  planilhaDuvidas_();
  const sh = SpreadsheetApp.openById(GEO.PLANILHA_CONFIG).getSheets()[0];
  const tem = sh.getDataRange().getDisplayValues().some(l => semAcento_(l[0]).indexOf('caixa de duvidas') === 0);
  if (!tem) sh.appendRow(['Caixa de dúvidas', 'Sim', 'Mostrar a caixa de dúvidas no app (Sim/Não)']);
}
function textoSeguro_(s, max) {
  s = String(s || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;   // evita fórmulas na planilha
}
function receberDuvida_(b) {
  try {
    const conf = lerConfig_();
    if (!conf.duvidas) return { ok: false, erro: 'A caixa de dúvidas está fechada no momento.' };
    const validas = [].concat.apply([], Object.keys(conf.turmas).map(k => conf.turmas[k]));
    const turma = String(b.turma || '');
    const nome = textoSeguro_(b.nome, 60), sobre = textoSeguro_(b.sobre, 90), texto = textoSeguro_(b.texto, 300);
    if (validas.indexOf(turma) < 0) return { ok: false, erro: 'Escolha a sua turma.' };
    if (nome.replace(/'/g, '').length < 3) return { ok: false, erro: 'Escreva o seu nome.' };
    if (texto.replace(/'/g, '').length < 5) return { ok: false, erro: 'Escreva a sua dúvida.' };
    // Limites contra excesso: por celular e no total do dia
    const cache = CacheService.getScriptCache();
    const dia = Utilities.formatDate(new Date(), GEO.FUSO, 'yyyyMMdd');
    const disp = String(b.aparelho || '').replace(/[^\w-]/g, '').slice(0, 40) || 'sem-id';
    const kA = 'duv|' + dia + '|' + disp, kT = 'duv|' + dia + '|total';
    const nA = parseInt(cache.get(kA) || '0', 10), nT = parseInt(cache.get(kT) || '0', 10);
    if (nA >= 5) return { ok: false, erro: 'Você já enviou 5 dúvidas hoje. Tente amanhã ou pergunte na aula.' };
    if (nT >= 300) return { ok: false, erro: 'Muitas dúvidas hoje. Tente amanhã.' };
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sh = planilhaDuvidas_();
      const cod = Utilities.getUuid().slice(0, 8);
      sh.appendRow([new Date(), turma, nome, sobre, texto, '', 'Não', cod]);
    } finally { lock.releaseLock(); }
    cache.put(kA, String(nA + 1), 21600); cache.put(kT, String(nT + 1), 21600);
    // Aviso por e-mail ao professor (no máximo 40 por dia)
    try {
      if (nT < 40) {
        const url = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('planilhaDuvidas')).getUrl();
        MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'GeoEstudos · nova dúvida · Turma ' + turma,
          'Turma ' + turma + ' · ' + nome + (sobre ? '\nSobre: ' + sobre : '') + '\n\n' + texto + '\n\nResponder na planilha: ' + url);
      }
    } catch (err) { Logger.log('E-mail de dúvida: ' + err); }
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: 'Não foi possível enviar agora.' };
  }
}
/** Respostas publicadas: só a pergunta e a resposta, nunca o nome. */
function lerDuvidasRespondidas_(dados) {
  const id = PropertiesService.getScriptProperties().getProperty('planilhaDuvidas');
  if (!id) return [];
  const v = SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getValues().slice(1);
  const turmasDoAno = {};
  dados.anos.forEach(a => a.turmas.forEach(t => turmasDoAno[t] = a.turmas));
  const out = [];
  v.forEach(l => {
    const pub = semAcento_(l[6]), resp = String(l[5] || '').trim(), turma = String(l[1]);
    if (!resp || (pub !== 'turma' && pub !== 'ano' && pub !== 'sim')) return;
    const quando = l[0] instanceof Date ? l[0].toISOString() : '';
    out.push({
      id: String(l[7] || (turma + '-' + quando)),
      turmas: pub === 'ano' ? (turmasDoAno[turma] || [turma]) : [turma],
      sobre: String(l[3] || '').replace(/^'/, ''),
      pergunta: String(l[4] || '').replace(/^'/, ''),
      resposta: resp,
      data: quando
    });
  });
  return out.reverse().slice(0, 200);
}
