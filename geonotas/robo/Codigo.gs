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
