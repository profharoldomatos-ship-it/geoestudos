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
 * Temas Transversais: pasta "Temas Transversais" dentro da unidade, com Docs "1 Título" (a aula)
 * e, se a atividade for no próprio app, "1 Atividade". O link do formulário vai na aba "Temas Transversais".
 *
 * Não é preciso mexer no código. Tudo o que muda no dia a dia fica nas planilhas, nos Docs e nas agendas.
 */

const VERSAO_ROBO = '2026-10-21 · avisos v3';

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
  return ContentService.createTextOutput(JSON.stringify(processarInscricao_(b))).setMimeType(ContentService.MimeType.JSON);
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
  [GEO.PLANILHA_CONFIG, GEO.PLANILHA_MENSAGENS, GEO.PLANILHA_CONTEUDO].forEach(id => {
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
        lembreteDia: conf.lembreteDia || '07:00'
      },
      anos: anos,
      mensagens: lerMensagens_(),
      agenda: agenda
    };
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
  const c = { turmas: {}, anosAtivos: [], avisoNovo: true };
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
  const docs = {}, temas = {};
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
  return { caps: docs, temas: temas };
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
  els.forEach(e => {
    const t = e.getType();
    if (t === T.PARAGRAPH) {
      const p = e.asParagraph(), n = nivel_(p.getHeading());
      if (n < 0) return;                            // título do documento: o app já mostra
      const txt = n > 0 ? limpar_(p.getText()) : textoComEstilo_(p);
      if (!txt.trim()) { out.push(''); return; }
      out.push(n === 0 ? txt : (n === topo ? '## ' : '### ') + txt);
    } else if (t === T.LIST_ITEM) {
      const li = e.asListItem();
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
    const seg = s.substring(a, b);
    if (partes.length && partes[partes.length - 1].st === st) partes[partes.length - 1].tx += seg;
    else partes.push({ st: st, tx: seg });
  }
  return partes.map(p => {
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
  const antCaps = {}, antTxt = {};
  ((anterior && anterior.anos) || []).forEach(a => (a.unidades || []).forEach(u => {
    (u.caps || []).forEach(c => { if (c.doc) antCaps[c.doc] = c; });
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
  const avisos = (anterior.avisos || []).filter(a => a.quando >= limite);
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
  l.push('Avisos de novidade ativos: ' + (d.avisos || []).length);
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
    ts.forEach(t => add(t, { tipo: 'novidade', titulo: a.titulo, texto: a.texto, cap: a.cap || null, tab: a.tipo === 'resumo' ? 'resumos' : 'calendario' }));
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
