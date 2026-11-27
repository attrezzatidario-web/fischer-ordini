/* Fischer · ordini e consegne — script Google collegato al Foglio.
   Fogli: «Ordini» e «DDT» (una riga per documento, colonne leggibili + colonna «dati» con tutto).
   PDF: cartella «Fischer PDF» nel Drive di chi ha distribuito lo script.
   Accesso: il codice si legge dalla proprietà dello script CHIAVE (mai scritto qui).
   Tracciamento: dai link Shippeo legge fasi, hub, date e consegna prevista; ogni ora aggiorna da solo
   le spedizioni ancora in viaggio (attivare una volta con la funzione «attivaAggiornamenti»). */

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
  if (q.action === 'track') return { ok: true, info: leggiTracciamento(String(q.url || '')) };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (q.action === 'list') return { ok: true, docs: elenco() };
    if (q.action === 'save') { (q.docs || []).forEach(salva); return { ok: true }; }
    if (q.action === 'delete') { elimina(String(q.id || '')); return { ok: true }; }
    if (q.action === 'aggiorna') return { ok: true, n: aggiornaTracciamenti(true) };
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

/* ---------- tracciamento automatico (Shippeo) ---------- */
const FASI = [['caricato', 'Caricato'], ['hub', "All'hub"], ['partito', "Partito dall'hub"], ['consegna', 'In consegna'], ['consegnato', 'Consegnato']];
const FK = FASI.map(function (f) { return f[0]; });
const PROBLEMA = /fail|refus|reject|damag|missing|absent|exception|incident|anomal|hold|return|giacenz|blocked|cancel/i;

function tokenShippeo(url) {
  const m = /shippeo\.com\/.*?orderPublic\/([A-Za-z0-9]+)/.exec(url) || /shippeo\.com\/.*?[?&]token=([A-Za-z0-9]+)/.exec(url);
  return m ? m[1] : '';
}
function shippeo(path) {
  const r = UrlFetchApp.fetch('https://api.shippeo.com/core/public/' + path, {
    muteHttpExceptions: true,
    headers: { Accept: 'application/json', Origin: 'https://view.shippeo.com', Referer: 'https://view.shippeo.com/' }
  });
  if (r.getResponseCode() !== 200) throw new Error('Shippeo ha risposto ' + r.getResponseCode());
  return JSON.parse(r.getContentText());
}
function leggiTracciamento(url) {
  const t = tokenShippeo(url);
  if (!t) throw new Error('per ora la lettura automatica funziona con i link Shippeo');
  const ord = shippeo('orders?token=' + t);
  let ov = null;
  try { ov = shippeo('goods/order/overview?token=' + t); } catch (e) { /* senza dettaglio delle tappe */ }
  return traduciShippeo(ord, ov);
}

const giorno = function (iso) { return iso ? Utilities.formatDate(new Date(iso), 'Europe/Rome', 'yyyy-MM-dd') : ''; };
const ora = function (iso) { const h = iso ? Utilities.formatDate(new Date(iso), 'Europe/Rome', 'HH:mm') : ''; return h === '00:00' || h === '01:00' ? '' : h; };
const titolo = function (s) { s = String(s || '').trim(); return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'(-])([a-zà-ù])/g, function (m, a, b) { return a + b.toUpperCase(); }) : s; };
function luogoDi(stop) {
  const p = stop.place || {}, a = (p.shippeoPlace && p.shippeoPlace.address) || (p.unqualifiedPlace && p.unqualifiedPlace.address) || {};
  const nome = titolo(String(a.name || '').replace(/\s*\(\d+\)\s*$/, '')), citta = titolo(String(a.town || '').replace(/\s*\([A-Z]{2}\)\s*$/, ''));
  if (/hub/i.test(stop.stopType)) return nome ? 'Hub di ' + nome : 'Hub di consegna';
  return [nome, citta && nome.toLowerCase().indexOf(citta.split(' ')[0].toLowerCase()) < 0 ? citta : ''].filter(String).join(' · ');
}
function faseTappa(tipo, nome) {
  const n = String(nome || '');
  if (PROBLEMA.test(n)) return 'problema';
  if (/loading|pickup/i.test(tipo)) return 'caricato';
  if (/hub|terminal/i.test(tipo)) return /left|depart/i.test(n) ? 'partito' : 'hub';
  if (/deliver/i.test(tipo)) return /deliver(ed|y_?compliant|y_?done)|unload|pod|complet|done|left/i.test(n) ? 'consegnato' : 'consegna';
  return '';
}
function faseStato(s) {
  s = String(s || '');
  if (!s || /^ORDER_/i.test(s)) return '';
  if (PROBLEMA.test(s)) return 'problema';
  if (/delivered|deliverycompliant|unloaded|completed|done/i.test(s)) return 'consegnato';
  if (/outfordelivery|arrivedatdelivery(?!hub)|ondeliverysite|indelivery/i.test(s)) return 'consegna';
  if (/leftdeliveryhub|drivingdeliverysite/i.test(s)) return 'partito';
  if (/deliveryhub|onterminal/i.test(s)) return 'hub';
  if (/load|pickup|picked|left/i.test(s)) return 'caricato';
  return '';
}
// risposta Shippeo → { ref, carr, dest, ev[], eta, etaTipo, stato }
function traduciShippeo(ord, ov) {
  const ev = [], visti = {};
  const add = function (st, iso, luogo, chiave) {
    if (!st || !iso) return;
    const id = 'a:' + chiave;
    if (visti[id]) return;
    visti[id] = 1;
    ev.push({ id: id, src: 'auto', st: st, d: giorno(iso), h: ora(iso), luogo: luogo || '' });
  };
  let etaS = '', etaP = '';
  ((ov && ov.stops) || []).forEach(function (stop, i) {
    const luogo = luogoDi(stop);
    (stop.milestones || []).forEach(function (m) { add(faseTappa(stop.stopType, m.name), m.occurredOn || m.recordedOn, luogo, i + ':' + m.name); });
    if (/^delivery$/i.test(stop.stopType)) {
      (stop.etas || []).forEach(function (e) { if (!etaS && e && (e.estimatedAt || e.eta || e.date)) etaS = e.estimatedAt || e.eta || e.date; });
      if (stop.dates) etaP = stop.dates.plannedArrivalStartDate || etaP;
    }
  });
  const a = ord.arrival || {};
  if (a.loadedUnloadedAt || a.arrivedAt) add('consegnato', a.loadedUnloadedAt || a.arrivedAt, luogoDi({ stopType: 'delivery', place: { shippeoPlace: { address: a } } }), 'arrivo');
  ((ord.timeline) || []).forEach(function (g) { (g.events || []).forEach(function (e) { add(faseStato(e.type), e.dateEvent, '', 't:' + e.type); }); });
  // stato attuale se più avanti delle tappe
  const max = ev.reduce(function (m, e) { return Math.max(m, FK.indexOf(e.st)); }, -1), cs = ov && ov.status, fs = faseStato(cs && cs.currentStatus);
  if (fs && (fs === 'problema' || FK.indexOf(fs) > max)) add(fs, cs.occurredOn || cs.recordedOn, '', 's:' + cs.currentStatus);
  if (!etaS && a.eta && a.eta.estimatedAt) etaS = a.eta.estimatedAt;
  if (!etaP) etaP = a.scheduledAt || a.theoreticalStartAt || '';
  ev.sort(function (x, y) { return (x.d + x.h).localeCompare(y.d + y.h); });
  return {
    fonte: 'Shippeo', ref: String(ord.reference || ''), carr: String(ord.charteredName || ord.companyToDisplay || (ord.chartering && ord.chartering.agency && ord.chartering.agency.name) || '').replace(/\s*-\s*Fischer.*$/i, ''),
    dest: { nome: a.name || '', citta: titolo(String(a.town || '').replace(/\s*\([A-Z]{2}\)\s*$/, '')) },
    ev: ev, eta: giorno(etaS || etaP), etaTipo: etaS ? 'stimata' : etaP ? 'pianificata' : '', stato: String((cs && cs.currentStatus) || ord.currentStatus || ''), agg: new Date().toISOString()
  };
}

/* fase raggiunta (indice in FASI) e ultimo problema */
function faseDoc(x) {
  let i = x.tipo === 'ddt' ? 0 : -1;
  ((x.trk && x.trk.ev) || []).forEach(function (e) { const k = FK.indexOf(e.st); if (k > i) i = k; });
  return i;
}
// unisce le letture automatiche con gli aggiornamenti scritti a mano; restituisce gli eventi nuovi
function unisci(x, info) {
  const old = (x.trk && x.trk.ev) || [], prima = {};
  old.forEach(function (e) { if (e.src === 'auto') prima[e.id] = 1; });
  x.trk = x.trk || {};
  x.trk.ev = old.filter(function (e) { return e.src !== 'auto'; }).concat(info.ev);
  if (info.eta) { x.trk.eta = info.eta; x.trk.etaTipo = info.etaTipo; }
  x.trk.auto = { fonte: info.fonte, ref: info.ref, carr: info.carr, dest: info.dest, stato: info.stato, agg: info.agg };
  return info.ev.filter(function (e) { return !prima[e.id]; });
}
function etichetta(st) { const f = FASI.filter(function (f) { return f[0] === st; })[0]; return f ? f[1] : st === 'problema' ? 'Problema / giacenza' : st; }

/* aggiorna tutte le spedizioni Shippeo ancora in viaggio (ogni ora, e quando si apre il sito) */
function aggiornaTracciamenti(soloVecchie) {
  const docs = elenco(), byId = {}, cambiati = {};
  docs.forEach(function (d) { byId[d.id] = d; });
  const oggi = giorno(new Date().toISOString());
  let n = 0;
  docs.forEach(function (x) {
    if (!x.track || !tokenShippeo(x.track) || faseDoc(x) === 4) return;
    const o = x.tipo === 'ordine' ? x : byId['o' + x.ord];
    if (o && (o.stato === 'consegnato' || o.stato === 'annullato')) return;
    if (soloVecchie === true && x.trk && x.trk.auto && Date.now() - new Date(x.trk.auto.agg).getTime() < 20 * 60000) return;
    let info;
    try { info = leggiTracciamento(x.track); } catch (e) { return; }
    const nuovi = unisci(x, info); cambiati[x.id] = x; n++;
    if (o) {
      nuovi.forEach(function (e) { o.mov = (o.mov || []).concat([{ d: e.d, st: '', n: 'Spedizione: ' + etichetta(e.st) + (e.luogo ? ' · ' + e.luogo : '') + (x.tipo === 'ddt' ? ' (DDT ' + x.num + ')' : '') + ' · da ' + info.fonte }]); });
      const f = faseDoc(x);
      if (f >= 0 && f < 4 && o.stato === 'confermato') { o.stato = 'spedito'; o.mov.push({ d: oggi, st: 'spedito', n: 'Merce in consegna' }); }
      if (f === 4 && o.stato !== 'consegnato' && o.stato !== 'annullato') {
        const L = docs.filter(function (d) { return d.tipo === 'ddt' && d.ord && d.ord === o.num; });
        const sped = {}; L.forEach(function (d) { d.righe.forEach(function (r) { sped[r.cod] = (sped[r.cod] || 0) + r.q; }); });
        const tutto = o.righe.every(function (r) { return (sped[r.cod] || 0) >= r.q; });
        if (x === o || (tutto && L.every(function (d) { return faseDoc(d) === 4; }))) { o.stato = 'consegnato'; o.mov.push({ d: oggi, st: 'consegnato', n: 'Merce consegnata al piazzale' }); }
      }
      if (nuovi.length || o === x) cambiati[o.id] = o;
    }
    Utilities.sleep(250);
  });
  Object.keys(cambiati).forEach(function (id) { salvaDati(cambiati[id]); });
  return n;
}
// riscrive «dati» e le colonne che cambiano col tracciamento
function salvaDati(x) {
  const sh = foglio(FOGLI[x.tipo]), r = rigaDi(sh, String(x.id));
  if (!r) return;
  const H = intestazioni(sh), last = (function () { const E = ((x.trk && x.trk.ev) || []).filter(function (e) { return e.st !== 'nota'; }); E.sort(function (a, b) { return (a.d + (a.h || '')).localeCompare(b.d + (b.h || '')); }); return E[E.length - 1]; })();
  const f = faseDoc(x), set = { dati: JSON.stringify(x), 'Tracciamento': x.track || '' };
  if (x.tipo === 'ddt') {
    set['Stato spedizione'] = last && last.st === 'problema' ? 'Problema' : f >= 0 ? FASI[f][1] : '';
    set['Ultimo aggiornamento'] = last ? (last.d + ' ' + (last.luogo || '')).trim() : '';
    set['Consegna prevista corriere'] = (x.trk && x.trk.eta) || '';
  } else {
    if (x.trk) { set['Stato spedizione'] = last && last.st === 'problema' ? 'Problema' : f >= 0 ? FASI[f][1] : ''; set['Consegna prevista corriere'] = x.trk.eta || ''; }
    set['Stato'] = { confermato: 'Confermato', spedito: 'In consegna', consegnato: 'Consegnato', annullato: 'Annullato' }[x.stato] || '';
  }
  Object.keys(set).forEach(function (k) { const c = H.indexOf(k); if (c >= 0) sh.getRange(r, c + 1).setNumberFormat('@').setValue(set[k]); });
}

/* ---------- da eseguire una volta: aggiornamento automatico ogni ora ---------- */
function aggiornaOgniOra() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try { aggiornaTracciamenti(false); } finally { lock.releaseLock(); }
}
function attivaAggiornamenti() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (/^aggiorna/.test(t.getHandlerFunction())) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('aggiornaOgniOra').timeBased().everyHours(1).create();
  Logger.log('Aggiornamento automatico attivo: ogni ora. Spedizioni aggiornate adesso: ' + aggiornaTracciamenti(false));
}
