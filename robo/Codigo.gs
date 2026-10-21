/**
 * GeoEstudos — robô do aplicativo
 * Prof. Haroldo Matos · Geografia · Rede Municipal de São Luís
 *
 * O que este robô faz, a cada 15 minutos:
 *  1. Lê os resumos (Google Docs) em App Geografia › Nº ano › Unidade N.
 *  2. Lê as planilhas "Configurações", "Mensagens de incentivo" e "Conteúdo".
 *  3. Lê as agendas "Geografia 71", "Geografia 72"... (datas de entrega e atividades).
 *  4. Junta tudo num arquivo de dados que o aplicativo baixa.
 *
 * Funções que você pode rodar pelo menu ▶ Executar:
 *  - instalar ......... rodar UMA vez: liga a atualização automática e faz a primeira leitura.
 *  - atualizar ........ atualiza o app na hora (ex.: depois de publicar um resumo).
 *  - verificar ........ mostra no registro um resumo do que o app está recebendo.
 *
 * Não é preciso mexer no código. Tudo o que muda no dia a dia fica nas planilhas, nos Docs e nas agendas.
 */

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
  MINUTOS: 15,
  AVISOS_DIAS: 21,                // avisos de novidade ficam visíveis por 21 dias
  AVISOS_MAX: 80
};

/* ------------------------------------------------------------------ */
/* Endereço público: o app chama este endereço para baixar os dados.   */
/* ------------------------------------------------------------------ */
function doGet(e) {
  const p = (e && e.parameter) || {};
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
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Instalação e atualização                                             */
/* ------------------------------------------------------------------ */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'atualizar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('atualizar').timeBased().everyMinutes(GEO.MINUTOS).create();
  const d = atualizar();
  Logger.log('Atualização automática ligada: a cada ' + GEO.MINUTOS + ' minutos.');
  Logger.log(resumoTexto_(d));
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
    const txt = JSON.stringify(dados);
    gravarDados_(txt);
    guardarCache_(txt);
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
  const c = { livro: {}, unidades: {}, caps: {} };
  linhas(aba('anos')).forEach(l => { const a = anoDe_(l[0]); if (a) c.livro[a] = link_(l[1]); });
  linhas(aba('unidades')).forEach(l => {
    const a = anoDe_(l[0]), u = parseInt(l[1], 10);
    if (!a || !u) return;
    (c.unidades[a] = c.unidades[a] || {})[u] = { titulo: String(l[2] || '').trim(), atual: sim_(l[3]) };
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
  // Resultado: { '7': { 13: {id, nome, unidade, atualizado}, ... }, ... }
  const docs = {};
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
    }
  }
  return docs;
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
  const antCaps = {};
  ((anterior && anterior.anos) || []).forEach(a => (a.unidades || []).forEach(u => (u.caps || []).forEach(c => {
    if (c.doc) antCaps[c.doc] = c;
  })));
  const ativos = conf.anosAtivos.length ? conf.anosAtivos : ['7', '8', '9'];
  return ativos.map(ano => {
    const unidades = {};
    const sheetU = conteudo.unidades[ano] || {};
    const sheetC = conteudo.caps[ano] || {};
    const dAno = docs[ano] || {};
    const garanteU = n => unidades[n] = unidades[n] || { n: n, titulo: (sheetU[n] && sheetU[n].titulo) || ('Unidade ' + n), caps: {} };
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
    const lista = Object.keys(unidades).map(Number).sort((a, b) => a - b).map(n => {
      const u = unidades[n];
      return { n: n, titulo: u.titulo, caps: Object.keys(u.caps).map(Number).sort((a, b) => a - b).map(k => u.caps[k]) };
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
    : /avaliac|prova|teste|simulado/.test(t) ? 'avaliacao' : 'aviso';
  const mc = String(titulo).match(/cap(?:[ií]tulo|\.)?\s*(\d+)/i);
  return { id: id + '@' + data, data: data, hora: hora, titulo: String(titulo || '').trim(), tipo: tipo, cap: mc ? +mc[1] : null, descricao: desc, link: link };
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
    '<h2 style="color:#1D3F8F">Robô do GeoEstudos: funcionando</h2><pre style="white-space:pre-wrap;background:#FBF8F1;padding:12px;border-radius:8px">' +
    esc(resumoTexto_(d)) + '</pre></div>';
  return HtmlService.createHtmlOutput(html).setTitle('GeoEstudos · robô');
}
