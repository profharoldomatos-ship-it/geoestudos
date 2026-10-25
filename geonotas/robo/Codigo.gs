/**
 * GeoNotas — controle de notas do Prof. Haroldo Matos
 * Robô (Google Apps Script). A tela fica no GitHub Pages (pasta geonotas/ do
 * repositório geoestudos) e conversa com este robô. Ele lê e grava nas planilhas
 * "Controle [turma] | Geografia | 2026". As fórmulas continuam na planilha:
 * o app só grava em células de lançamento (sem fórmula) e lê os resultados.
 */

const CONFIG = {
  ANO: 2026,
  PERIODO: 4, // período em lançamento: abas "NOTAS 4P" e "CADERNOS 4P"
  DIAS_SESSAO: 30, // depois disso, pede a senha de novo
  // pastas dos formulários de atividade do período em curso (FORMULÁRIOS › ano › período 4)
  PASTAS_FORM: {
    '7': '1z970ApbgEkh0zedIzEcUhC0ieQzCS_rl',
    '8': '14ZZcg9T-JVZEnCoN40raShLMRIKQ4r2K',
    '9': '1aNJVfoW2M246ghRdqWxOT6AArexNu7Cs'
  },
  TURMAS: {
    '71': '19SK9aXF8Lg76aKwuIfs4Yqp9kouH3sSpPB-tx4hXUHg',
    '72': '1XhOcxuW0EKI3okjfiHzf_umGNcPfMoYwDi9keM5McBE',
    '81': '1V17IcX8JYjKOGqlSHB-62x85XqNkTYoVXZZyPDCgf7w',
    '82': '1LBDOXI0xfecIC2t4NJcSPbbC85tKqUakCI5Tj7vENn0',
    '91': '1yso3AaFqHBfCWpHdGaTTN9FsL8liGkjJ_r6jDFF3j2U',
    '92': '1K7Cg7Do-ATOTaLABcbLRsF1TAfE7aqBfaJcGy-V8dIE'
  }
};

/* =====================================================================
   SENHA DO GEONOTAS
   Para criar ou trocar a senha: escreva-a entre as aspas abaixo, escolha
   a função "definirSenha" no menu do editor e clique em Executar.
   Depois APAGUE a senha daqui (deixe '') e salve. O robô guarda só uma
   versão embaralhada, e trocar a senha encerra todas as entradas.
   ===================================================================== */
const SENHA_NOVA = '';

function definirSenha() {
  if (!SENHA_NOVA || SENHA_NOVA.length < 8) throw new Error('Escreva em SENHA_NOVA uma senha com pelo menos 8 caracteres.');
  const sal = Utilities.getUuid();
  const P = PropertiesService.getScriptProperties();
  P.setProperty('senha_sal', sal);
  P.setProperty('senha_hash', hash_(SENHA_NOVA, sal));
  encerrarTodasAsEntradas();
  Logger.log('Senha definida. Agora apague SENHA_NOVA do código (deixe \'\') e salve.');
}

/** Desconecta todos os aparelhos (útil se perder o celular). */
function encerrarTodasAsEntradas() {
  const P = PropertiesService.getScriptProperties();
  Object.keys(P.getProperties()).filter(k => k.indexOf('tok_') === 0).forEach(k => P.deleteProperty(k));
}

function hash_(senha, sal) {
  let h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '|' + senha, Utilities.Charset.UTF_8);
  for (let i = 0; i < 1000; i++) h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h.concat(Utilities.newBlob(sal).getBytes()));
  return Utilities.base64Encode(h);
}

function sessaoValida_(token) {
  if (!token || typeof token !== 'string') throw new Error('SESSAO');
  const exp = Number(PropertiesService.getScriptProperties().getProperty('tok_' + token) || 0);
  if (!exp || exp < Date.now()) throw new Error('SESSAO');
}

/* ---------- ponto de entrada: a tela (no GitHub) conversa com o robô por aqui ---------- */

function doGet() {
  return json_({ ok: true, app: 'GeoNotas', msg: 'Robô do GeoNotas funcionando.' });
}

function doPost(e) {
  let q = {};
  try { q = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, erro: 'Pedido inválido.' }); }
  try {
    switch (q.acao) {
      case 'entrar': return json_({ ok: true, token: entrar_(q.senha) });
      case 'sair':
        if (q.token) PropertiesService.getScriptProperties().deleteProperty('tok_' + q.token);
        return json_({ ok: true });
      case 'config':
        sessaoValida_(q.token);
        return json_({ ok: true, ano: CONFIG.ANO, periodo: CONFIG.PERIODO, turmas: Object.keys(CONFIG.TURMAS) });
      case 'dados':
        sessaoValida_(q.token);
        return json_({ ok: true, dados: readSheet_(sheetFor_(q.turma, q.kind), q.kind) });
      case 'formularios':
        sessaoValida_(q.token);
        return json_({ ok: true, lista: listarFormularios_(q.turma), auto: ultimaAutomatica_() });
      case 'previa':
        sessaoValida_(q.token);
        return json_({ ok: true, previa: previaImport_(q.turma, q.form, q.todas), auto: ultimaAutomatica_() });
      case 'importar':
        sessaoValida_(q.token);
        return json_({ ok: true, gravadas: gravarImport_(q.turma, q.cols, q.itens, q.form, q.processados) });
      case 'salvar':
        sessaoValida_(q.token);
        return json_({ ok: true, linha: saveCell_(q.turma, q.kind, q.row, q.col, q.value, q.nome) });
      default:
        return json_({ ok: false, erro: 'Ação desconhecida.' });
    }
  } catch (err) {
    const m = String(err && err.message || err);
    return json_(m === 'SESSAO' ? { ok: false, sessao: false, erro: 'Entre de novo com a senha.' } : { ok: false, erro: m });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function entrar_(senha) {
  const P = PropertiesService.getScriptProperties();
  const sal = P.getProperty('senha_sal'), alvo = P.getProperty('senha_hash');
  if (!sal || !alvo) throw new Error('A senha ainda não foi criada no editor (função definirSenha).');
  // bloqueio contra tentativas: 5 erros seguidos travam a entrada por 15 minutos
  const C = CacheService.getScriptCache();
  const erros = Number(C.get('erros') || 0);
  if (erros >= 5) throw new Error('Muitas tentativas erradas. Aguarde 15 minutos.');
  if (hash_(String(senha || ''), sal) !== alvo) {
    C.put('erros', String(erros + 1), 900);
    throw new Error('Senha incorreta.');
  }
  C.remove('erros');
  const token = Utilities.getUuid() + Utilities.getUuid();
  P.setProperty('tok_' + token, String(Date.now() + CONFIG.DIAS_SESSAO * 864e5));
  const agora = Date.now(), todas = P.getProperties();
  Object.keys(todas).forEach(k => { if (k.indexOf('tok_') === 0 && Number(todas[k]) < agora) P.deleteProperty(k); });
  return token;
}

/** Grava um valor numa célula de lançamento e devolve a linha recalculada. */
function saveCell_(turma, kind, row, col, value, expectedName) {
  row = Number(row); col = Number(col);
  if (!(row > 0 && col > 2)) throw new Error('Célula inválida.');
  if (!(value === '' || value === null || typeof value === 'boolean' || typeof value === 'number')) throw new Error('Valor inválido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = sheetFor_(turma, kind);
    const nome = String(sh.getRange(row, 2).getDisplayValue()).trim();
    if (!nome || nome !== expectedName) {
      throw new Error('A planilha mudou (linha ' + row + ' agora é "' + nome + '"). Atualize o app.');
    }
    const cell = sh.getRange(row, col);
    if (cell.getFormula()) throw new Error('Esta célula tem fórmula na planilha e não pode ser editada pelo app.');
    if (value === '' || value === null) cell.clearContent();
    else cell.setValue(value);
    SpreadsheetApp.flush();
    return readRow_(sh, row);
  } finally {
    lock.releaseLock();
  }
}

/* ---------- importação das notas dos formulários (Google Formulários) ---------- */

/** Rode uma vez no editor depois de colar este código, para autorizar a leitura dos formulários. */
function autorizarFormularios() {
  Object.keys(CONFIG.PASTAS_FORM).forEach(a => Logger.log(a + 'º ano: ' + DriveApp.getFolderById(CONFIG.PASTAS_FORM[a]).getName()));
  const f = DriveApp.getFolderById(CONFIG.PASTAS_FORM['9']).getFilesByType(MimeType.GOOGLE_FORMS);
  if (f.hasNext()) Logger.log('Formulário lido: ' + FormApp.openById(f.next().getId()).getTitle());
}

function anoDaTurma_(turma) { return String(turma).charAt(0); }

/* Registro do que já foi importado, por formulário:
   ids = respostas já processadas (não aparecem de novo); rs = alunos que já receberam a nota (por turma). */
function registro_(formId) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('imp_' + formId) || '') || { ids: {}, rs: {} }; }
  catch (e) { return { ids: {}, rs: {} }; }
}
function salvarRegistro_(formId, reg) {
  PropertiesService.getScriptProperties().setProperty('imp_' + formId, JSON.stringify(reg));
}

/** Formulários de atividade do ano da turma (só a pasta, sem subpastas), com quantas respostas novas há. */
function listarFormularios_(turma) {
  const pasta = CONFIG.PASTAS_FORM[anoDaTurma_(turma)];
  if (!pasta) throw new Error('Pasta de formulários não configurada para a turma ' + turma + '.');
  const it = DriveApp.getFolderById(pasta).getFilesByType(MimeType.GOOGLE_FORMS), lista = [];
  while (it.hasNext()) {
    const f = it.next(), t = f.getName(), m = t.match(/\bC\s*(\d{1,2})\b/i);
    let novas = null;
    try {
      const reg = registro_(f.getId());
      novas = lerRespostas_(FormApp.openById(f.getId()), turma).resp.filter(x => !reg.ids[x.id]).length;
    } catch (e) {}
    lista.push({ id: f.getId(), titulo: t, cap: m ? Number(m[1]) : null, novas });
  }
  return lista.sort((a, b) => (a.cap || 99) - (b.cap || 99));
}

function norm_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
const LIGA_ = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1 };
function tokens_(s) { return norm_(s).split(' ').filter(t => t && !LIGA_[t]); }

/** Compara o nome digitado com a lista: devolve o aluno mais provável e o grau de certeza. */
function casarNome_(digitado, alunos) {
  const tk = tokens_(digitado);
  if (!tk.length) return { r: null, certeza: 'nenhum' };
  const pont = alunos.map(a => {
    const at = tokens_(a.nome);
    let hit = 0;
    tk.forEach(t => { if (at.some(x => x === t || (t.length >= 3 && x.indexOf(t) === 0) || (x.length >= 3 && t.indexOf(x) === 0))) hit++; });
    const primeiro = at[0] === tk[0] || (tk[0].length >= 3 && at[0] && at[0].indexOf(tk[0]) === 0);
    return { r: a.r, s: hit / tk.length + (primeiro ? 0.5 : 0) + hit * 0.01 };
  }).sort((a, b) => b.s - a.s);
  const m = pont[0], seg = pont[1] || { s: 0 };
  if (!m || m.s < 0.5) return { r: null, certeza: 'nenhum' };
  // certo: primeiro nome confere, todas as palavras batem e nenhum colega empata
  const certo = m.s >= 1.5 && m.s - seg.s >= 0.3;
  return { r: m.r, certeza: certo ? 'certo' : 'duvida' };
}

function pontosItem_(item) {
  const T = FormApp.ItemType, t = item.getType();
  const conv = { MULTIPLE_CHOICE: 'asMultipleChoiceItem', CHECKBOX: 'asCheckboxItem', LIST: 'asListItem', TEXT: 'asTextItem',
    PARAGRAPH_TEXT: 'asParagraphTextItem', SCALE: 'asScaleItem', DATE: 'asDateItem', TIME: 'asTimeItem', GRID: null };
  for (const k in conv) { if (t === T[k] && conv[k]) { try { return item[conv[k]]().getPoints() || 0; } catch (e) { return 0; } } }
  return 0;
}

/** Colunas da aba de notas do período para um capítulo: a marcação da atividade e, se houver, a nota. */
function colunasCap_(dados, cap) {
  const re = new RegExp('\\bC(AP\\.?)?\\s*' + cap + '\\b', 'i');
  const marca = dados.columns.find(c => !c.calc && re.test(c.leaf) && !/^NOTA/i.test(c.leaf));
  if (!marca) return null;
  const i = dados.columns.indexOf(marca), prox = dados.columns[i + 1];
  const nota = prox && !prox.calc && !prox.check && /^NOTA/i.test(prox.leaf) ? prox : null;
  return { marca: { c: marca.c, label: marca.label, check: marca.check }, nota: nota ? { c: nota.c, label: nota.label } : null };
}

/** Respostas da turma (em ordem de envio), com nota 0–10. */
function lerRespostas_(form, turma) {
  const itens = form.getItems();
  const itNome = itens.find(i => /nome/i.test(i.getTitle())), itTurma = itens.find(i => /turma/i.test(i.getTitle()));
  if (!itNome) throw new Error('O formulário não tem uma pergunta de NOME.');
  const total = itens.reduce((s, i) => s + pontosItem_(i), 0);
  const resp = form.getResponses().sort((a, b) => a.getTimestamp() - b.getTimestamp()).map(rp => {
    const ir = rp.getItemResponses();
    const val = it => { const x = it && ir.find(y => y.getItem().getId() === it.getId()); return x ? String(x.getResponse()).trim() : ''; };
    const nome = val(itNome), tur = val(itTurma), digTur = (tur.match(/\d/g) || []).join('');
    let pts = 0; rp.getGradableItemResponses().forEach(g => pts += Number(g.getScore()) || 0);
    return { id: rp.getId(), nome, turma: tur, mesmaTurma: digTur === String(turma) ? true : (digTur.length >= 2 ? false : null),
      quando: rp.getTimestamp().toISOString(), nota: total ? Math.round(pts / total * 100) / 10 : null, pontos: pts };
  }).filter(x => x.mesmaTurma !== false);
  return { total, resp };
}

/** Prévia da importação. Por padrão traz só as respostas ainda não processadas (todas=true traz tudo). */
function previaImport_(turma, formId, todas) {
  const form = FormApp.openById(formId), titulo = form.getTitle();
  const m = titulo.match(/\bC\s*(\d{1,2})\b/i);
  if (!m) throw new Error('Não achei o capítulo (ex.: C13) no título do formulário.');
  const cap = Number(m[1]);
  const sh = sheetFor_(turma, 'notas'), dados = readSheet_(sh, 'notas');
  const cols = colunasCap_(dados, cap);
  if (!cols) throw new Error('Não achei na aba ' + sh.getName() + ' da turma ' + turma + ' a coluna da atividade do capítulo ' + cap + '.');
  const alunos = dados.rows.map(r => ({ r: r.r, nome: r.nome }));
  const lidas = lerRespostas_(form, turma), reg = registro_(formId), jaRs = reg.rs[turma] || {};
  let resp = lidas.resp;
  const jaImportadas = resp.filter(x => reg.ids[x.id]).length;
  resp.forEach(x => {
    x.feita = !!reg.ids[x.id];
    const c = casarNome_(x.nome, alunos);
    x.r = c.r;
    x.certeza = x.mesmaTurma === null && c.certeza === 'certo' ? 'duvida' : c.certeza;
    // aluno que já recebeu a nota desta atividade: um envio novo dele é repetido (vale o primeiro)
    const nomeR = x.r && (alunos.find(a => a.r === x.r) || {}).nome;
    if (!x.feita && nomeR && jaRs[norm_(nomeR)]) x.certeza = 'repetido';
  });
  if (!todas) resp = resp.filter(x => !x.feita);
  const atual = {};
  dados.rows.forEach(r => atual[r.r] = { marca: r.cells[cols.marca.c].v, nota: cols.nota ? r.cells[cols.nota.c].v : null });
  return { titulo, cap, total: lidas.total, cols, alunos, respostas: resp, atual, jaImportadas, todas: !!todas };
}

/** Grava as notas: marca a atividade e, se houver coluna, a nota. Registra as respostas processadas. */
function gravarImport_(turma, cols, itens, formId, processados) {
  if (!cols || !cols.marca || !Array.isArray(itens)) throw new Error('Pedido inválido.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = sheetFor_(turma, 'notas'); let n = 0;
    const reg = formId ? registro_(formId) : null;
    if (reg && !reg.rs[turma]) reg.rs[turma] = {};
    itens.forEach(x => {
      const r = Number(x.r); if (!(r > 0)) return;
      if (String(sh.getRange(r, 2).getDisplayValue()).trim() !== x.nome) throw new Error('A planilha mudou (linha ' + r + '). Atualize o app e importe de novo.');
      if (x.soRegistro) { if (reg) reg.rs[turma][norm_(x.nome)] = 1; return; }
      const m = sh.getRange(r, Number(cols.marca.c));
      if (!m.getFormula()) m.setValue(cols.marca.check ? true : x.nota);
      if (cols.nota && typeof x.nota === 'number') {
        const c = sh.getRange(r, Number(cols.nota.c));
        if (!c.getFormula()) c.setValue(x.nota);
      }
      if (reg) reg.rs[turma][norm_(x.nome)] = 1;
      n++;
    });
    SpreadsheetApp.flush();
    if (reg) { (processados || []).forEach(id => { if (id) reg.ids[id] = 1; }); salvarRegistro_(formId, reg); }
    return n;
  } finally { lock.releaseLock(); }
}

/* ---------- importação automática (de hora em hora) ----------
   Grava sozinha só as respostas com nome conferido com segurança e turma informada.
   As duvidosas ficam esperando a conferência no app. */
function importarAutomatico() {
  const log = [];
  Object.keys(CONFIG.TURMAS).forEach(turma => {
    let forms = [];
    try { forms = listarFormularios_(turma).filter(f => f.cap && f.novas); } catch (e) { log.push(turma + ': ' + e.message); }
    forms.forEach(f => {
      try {
        const p = previaImport_(turma, f.id, false), visto = {}, itens = [], proc = [];
        p.respostas.forEach(x => {
          if (x.certeza !== 'certo' || x.mesmaTurma !== true || !x.r || visto[x.r]) return;
          visto[x.r] = 1;
          // se já há nota (ou marcação) na planilha, não sobrescreve: só registra como processada
          const at = p.atual[x.r] || {}, temValor = p.cols.nota ? String(at.nota || '') !== '' : at.marca === true;
          itens.push({ r: x.r, nome: p.alunos.find(a => a.r === x.r).nome, nota: x.nota, soRegistro: temValor });
          proc.push(x.id);
        });
        if (itens.length) {
          gravarImport_(turma, p.cols, itens, f.id, proc);
          const novas = itens.filter(x => !x.soRegistro).length;
          if (novas) log.push(turma + ' · cap. ' + f.cap + ': ' + novas + ' nota(s)');
        }
      } catch (e) { log.push(turma + ' · cap. ' + f.cap + ': ' + e.message); }
    });
  });
  PropertiesService.getScriptProperties().setProperty('auto_ultima', JSON.stringify({ quando: new Date().toISOString(), log: log.slice(0, 40) }));
  Logger.log(log.join('\n') || 'Nada novo para importar.');
}

/** Rode uma vez no editor para ligar a importação automática de hora em hora. */
function ligarImportacaoAutomatica() {
  desligarImportacaoAutomatica();
  ScriptApp.newTrigger('importarAutomatico').timeBased().everyHours(1).create();
  Logger.log('Importação automática ligada: de hora em hora.');
}
function desligarImportacaoAutomatica() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'importarAutomatico').forEach(t => ScriptApp.deleteTrigger(t));
}
function ultimaAutomatica_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('auto_ultima') || 'null'); } catch (e) { return null; }
}

/* ---------- leitura genérica, guiada pelos cabeçalhos ---------- */

function sheetFor_(turma, kind) {
  const id = CONFIG.TURMAS[turma];
  if (!id) throw new Error('Turma não configurada: ' + turma);
  const ss = SpreadsheetApp.openById(id);
  let sh = null;
  if (kind === 'notas') sh = ss.getSheetByName('NOTAS ' + CONFIG.PERIODO + 'P');
  else if (kind === 'cadernos') sh = ss.getSheetByName('CADERNOS ' + CONFIG.PERIODO + 'P');
  else if (kind === 'final') sh = ss.getSheets().filter(s => /^RESULT/i.test(s.getName()))[0] || null;
  if (!sh) throw new Error('Aba não encontrada (' + kind + ') na planilha da turma ' + turma + '.');
  return sh;
}

function firstStudentRow_(vals) {
  for (let r = 0; r < vals.length; r++) {
    const n = vals[r][0], nome = String(vals[r][1]).trim();
    if (nome && n !== '' && !isNaN(Number(n)) && Number(n) >= 1) return r;
  }
  return -1;
}

function readSheet_(sh, kind) {
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  const rng = sh.getRange(1, 1, lastRow, lastCol);
  const vals = rng.getValues();
  const disp = rng.getDisplayValues();
  const form = rng.getFormulas();
  const dvs = rng.getDataValidations();

  const first = firstStudentRow_(vals);
  if (first < 0) throw new Error('Não encontrei a lista de alunos na aba ' + sh.getName());

  // cabeçalhos: todas as linhas acima do 1º aluno, com células mescladas preenchidas
  const hdr = disp.slice(0, first).map(r => r.slice());
  if (first > 0) {
    sh.getRange(1, 1, first, lastCol).getMergedRanges().forEach(m => {
      const r0 = m.getRow() - 1, c0 = m.getColumn() - 1;
      const v = hdr[r0][c0];
      for (let r = r0; r < r0 + m.getNumRows() && r < first; r++)
        for (let c = c0; c < c0 + m.getNumColumns(); c++) hdr[r][c] = v;
    });
  }

  // alunos: do 1º até o primeiro nome vazio
  const rowsIdx = [];
  for (let r = first; r < vals.length; r++) {
    if (!String(vals[r][1]).trim()) break;
    rowsIdx.push(r);
  }

  const CHECK = SpreadsheetApp.DataValidationCriteria.CHECKBOX;
  const columns = [];
  for (let c = 2; c < lastCol; c++) {
    const parts = [];
    for (let r = 0; r < first; r++) {
      const t = String(hdr[r][c] || '').trim();
      if (t && parts[parts.length - 1] !== t) parts.push(t);
    }
    let nForm = 0, nCheck = 0, nFilled = 0;
    rowsIdx.forEach(r => {
      if (form[r][c]) nForm++;
      const dv = dvs[r][c];
      if ((dv && dv.getCriteriaType() === CHECK) || typeof vals[r][c] === 'boolean') nCheck++;
      if (disp[r][c] !== '') nFilled++;
    });
    if (!parts.length && !nFilled) continue; // coluna solta, vazia
    const leaf = parts.length ? parts[parts.length - 1] : 'Nota (calc.)';
    columns.push({
      c: c + 1,
      parts: parts,
      group: parts.length > 1 ? parts.slice(0, -1).join(' › ') : '',
      leaf: leaf,
      label: parts.length ? parts.join(' › ') : leaf,
      calc: nForm > 0 && nForm >= rowsIdx.length / 2,
      check: nCheck > 0 && nCheck >= rowsIdx.length / 2
    });
  }

  // rótulos repetidos (ex.: várias colunas "NOTA" após cada atividade) ganham o nome da coluna anterior
  const count = {};
  columns.forEach(c => count[c.label] = (count[c.label] || 0) + 1);
  const base = columns.map(c => ({ leaf: c.leaf, group: c.group, top: c.parts[0] || c.leaf }));
  columns.forEach((c, i) => {
    if (count[c.label] > 1 && i > 0) {
      const prev = base[i - 1];
      // mesmo grupo: "NOTA · ATIV. C12"; grupo diferente: "MÉDIA (NOTA 2)"
      c.leaf = prev.group === base[i].group && prev.group
        ? c.leaf + ' · ' + prev.leaf
        : c.leaf + ' (' + prev.top + ')';
      c.label = (c.group ? c.group + ' › ' : '') + c.leaf;
    }
  });

  const rows = rowsIdx.map(r => rowObj_(r + 1, vals[r], disp[r], form[r], columns));
  return {
    kind: kind,
    sheet: sh.getName(),
    columns: columns,
    rows: rows,
    fetchedAt: new Date().toISOString()
  };
}

function rowObj_(rowNum, v, d, f, columns) {
  const cells = {};
  columns.forEach(col => {
    const i = col.c - 1;
    cells[col.c] = { v: typeof v[i] === 'boolean' ? v[i] : d[i], ed: !f[i] };
  });
  return { r: rowNum, n: d[0], nome: String(d[1]).trim(), cells: cells };
}

function readRow_(sh, rowNum) {
  const lastCol = sh.getLastColumn();
  const rng = sh.getRange(rowNum, 1, 1, lastCol);
  const v = rng.getValues()[0], d = rng.getDisplayValues()[0], f = rng.getFormulas()[0];
  const cells = {};
  for (let i = 2; i < lastCol; i++) cells[i + 1] = { v: typeof v[i] === 'boolean' ? v[i] : d[i], ed: !f[i] };
  return { r: rowNum, n: d[0], nome: String(d[1]).trim(), cells: cells };
}
