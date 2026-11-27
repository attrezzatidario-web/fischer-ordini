/* Fischer · ordini e consegne — script Google collegato al Foglio.
   Fogli: «Ordini» e «DDT» (una riga per documento, colonne leggibili + colonna «dati» con tutto).
   PDF: cartella «Fischer PDF» nel Drive di chi ha distribuito lo script.
   Accesso: il codice si legge dalla proprietà dello script CHIAVE (mai scritto qui). */

const FOGLI = { ordine: 'Ordini', ddt: 'DDT' };

function doGet() {
  return ContentService.createTextOutput('Fischer · ordini e consegne: script attivo');
}

function doPost(e) {
  let out;
  try {
    const q = JSON.parse(e.postData.contents);
    const chiave = PropertiesService.getScriptProperties().getProperty('CHIAVE');
    if (!chiave) throw new Error('codice di accesso non impostato: aggiungi la proprietà CHIAVE nelle impostazioni dello script');
    if (String(q.key || '') !== chiave) throw new Error('codice di accesso errato');
    out = esegui(q);
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function esegui(q) {
  if (q.action === 'ping') return { ok: true };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (q.action === 'list') return { ok: true, docs: elenco() };
    if (q.action === 'save') { (q.docs || []).forEach(salva); return { ok: true }; }
    if (q.action === 'delete') { elimina(String(q.id || '')); return { ok: true }; }
    if (q.action === 'pdf') return { ok: true, url: archiviaPdf(String(q.name || 'documento.pdf'), String(q.data || '')) };
  } finally {
    lock.releaseLock();
  }
  throw new Error('azione sconosciuta: ' + q.action);
}

/* ---------- fogli ---------- */
function foglio(nome) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, 2).setValues([['id', 'dati']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function intestazioni(sh) {
  return sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
}
function rigaDi(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function elenco() {
  const out = [];
  Object.keys(FOGLI).forEach(function (t) {
    const sh = foglio(FOGLI[t]), H = intestazioni(sh), c = H.indexOf('dati'), n = sh.getLastRow() - 1;
    if (c < 0 || n < 1) return;
    sh.getRange(2, c + 1, n, 1).getValues().forEach(function (r) {
      try { if (r[0]) out.push(JSON.parse(r[0])); } catch (e) { /* riga non valida: ignorata */ }
    });
  });
  return out;
}

function salva(d) {
  const nome = FOGLI[d.tipo];
  if (!nome || !d.id) throw new Error('documento non valido');
  const sh = foglio(nome), cols = d.cols || {};
  let H = intestazioni(sh);
  // aggiunge le colonne leggibili che mancano, sempre prima di «dati»
  Object.keys(cols).forEach(function (k) {
    if (H.indexOf(k) >= 0) return;
    const c = H.indexOf('dati') + 1;
    sh.insertColumnBefore(c);
    sh.getRange(1, c).setValue(k).setFontWeight('bold');
    H = intestazioni(sh);
  });
  const riga = H.map(function (h) {
    if (h === 'id') return d.id;
    if (h === 'dati') return d.dati;
    const v = cols[h];
    return v == null ? '' : v;
  });
  let r = rigaDi(sh, String(d.id));
  if (!r) r = sh.getLastRow() + 1;
  const rg = sh.getRange(r, 1, 1, riga.length);
  rg.setNumberFormat('@');   // tutto come testo: codici articolo e numeri restano come sono
  rg.setValues([riga.map(function (v) { return typeof v === 'number' ? v : String(v); })]);
}

function elimina(id) {
  Object.keys(FOGLI).forEach(function (t) {
    const sh = foglio(FOGLI[t]), r = rigaDi(sh, id);
    if (r) sh.deleteRow(r);
  });
}

/* ---------- PDF su Drive ---------- */
function cartella() {
  const P = PropertiesService.getScriptProperties(), id = P.getProperty('CARTELLA_PDF');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* cartella eliminata: se ne crea un'altra */ } }
  const f = DriveApp.createFolder('Fischer PDF');
  P.setProperty('CARTELLA_PDF', f.getId());
  return f;
}
function archiviaPdf(nome, b64) {
  if (!b64) throw new Error('PDF vuoto');
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/pdf', nome.replace(/[\\/:*?"<>|]/g, '-'));
  return cartella().createFile(blob).getUrl();
}

/* ---------- da eseguire una volta dall'editor (menu Esegui) per autorizzare e creare fogli e cartella ---------- */
function prepara() {
  foglio(FOGLI.ordine);
  foglio(FOGLI.ddt);
  const f = cartella();
  const ok = !!PropertiesService.getScriptProperties().getProperty('CHIAVE');
  Logger.log('Fogli «Ordini» e «DDT» pronti. Cartella PDF: ' + f.getUrl() + (ok ? '' : '\nATTENZIONE: manca la proprietà CHIAVE.'));
}
