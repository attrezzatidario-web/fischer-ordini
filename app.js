/* Fischer · ordini e consegne ai piazzali.
   Si caricano conferme d'ordine e DDT in PDF (anche zip): vengono letti, controllati e collegati tra loro
   tramite il numero d'ordine; su ogni DDT (o sull'ordine) si incolla il link di tracciamento.
   Dati: Google Foglio tramite Apps Script (fogli «Ordini» e «DDT», PDF su Drive) oppure, in prova, solo in questo browser. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

  /* ---------- formati ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d = 0) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
  const eur = n => num(n, 2) + ' €';
  const dt = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const plur = (n, a, b) => `${num(n)} ${n === 1 ? a : b}`;
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const same = (a, b) => Math.abs(a - b) <= 0.02;
  const title = s => { s = String(s || '').trim(); return s && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'(-])([a-zà-ù])/g, (m, a, b) => a + b.toUpperCase()) : s; };
  const carrier = s => title(String(s || '').split(',')[0].replace(/\s+S\.?\s?R\.?\s?L\.?$/i, '').trim());
  const okUrl = s => /^https?:\/\/[^\s"'<>]+$/i.test(String(s || '').trim());
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- archivio: Google Foglio (Apps Script) o prova nel browser ---------- */
  // indirizzo dell'app web dello script Google (non è segreto: senza il codice di accesso non apre nulla)
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyXc-j_cRU_6sTQn-u1KV8SIGySOqK1wBXJ2waKlVLn5QnO946yS5Vb1WRh6J8nBl4OEA/exec';
  let cfg = LS.get('fo_cfg', {});   // { url, key } oppure { prova: true }
  // link di invito: …/#accesso=CODICE → si collega da solo; il codice viene tolto subito dalla barra degli indirizzi
  (() => { const m = /[#&]accesso=([^&]+)/.exec(location.hash); if (!m) return; cfg = { url: SCRIPT_URL, key: decodeURIComponent(m[1]) }; LS.set('fo_cfg', cfg); try { history.replaceState(null, '', location.pathname + location.search); } catch { } })();
  if (cfg.key && !cfg.url) cfg.url = SCRIPT_URL;
  const inviteLink = () => `${location.origin}${location.pathname}#accesso=${encodeURIComponent(cfg.key || '')}`;
  const mode = () => cfg.url && cfg.key ? 'google' : cfg.prova ? 'prova' : '';
  async function post(action, extra) {
    const r = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, key: cfg.key, ...extra }), credentials: 'omit', referrerPolicy: 'no-referrer' });
    let j; try { j = await r.json(); } catch { throw new Error('risposta non valida dallo script Google'); }
    if (!j.ok) throw new Error(j.error || 'errore dello script Google');
    return j;
  }
  const Store = {
    async load() {
      if (mode() === 'google') return (await post('list')).docs || [];
      if (mode() === 'prova') return LS.get('fo_docs', []);
      return [];
    },
    async save(docs) {
      if (mode() === 'google') return post('save', { docs: docs.map(d => ({ id: d.id, tipo: d.tipo, cols: cols(d), dati: JSON.stringify(d) })) });
      const all = new Map(LS.get('fo_docs', []).map(d => [d.id, d])); docs.forEach(d => all.set(d.id, d)); LS.set('fo_docs', [...all.values()]);
    },
    async del(id) {
      if (mode() === 'google') return post('delete', { id });
      LS.set('fo_docs', LS.get('fo_docs', []).filter(d => d.id !== id));
    },
    async track(url) {
      if (mode() !== 'google') throw new Error('la lettura automatica funziona con il Google Foglio collegato');
      return (await post('track', { url })).info;
    },
    async refresh() { if (mode() === 'google') await post('aggiorna'); },
    async pdf(name, u8) {
      if (mode() !== 'google') return '';
      let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
      return (await post('pdf', { name, data: btoa(s) })).url || '';
    }
  };
  // colonne leggibili nel Google Foglio (l'ultima colonna «dati» contiene tutto)
  function cols(d) {
    if (d.tipo === 'ordine') {
      const L = ddtsOf(d), sh = shipped(d);
      return { 'Ordine': d.num, 'Data': d.data, 'Piazzale': pzName(d), 'Destinatario': d.dest.rs, 'Città': [d.dest.citta, d.dest.prov].filter(Boolean).join(' '), 'Stato': stLabel(d), 'Articoli': d.righe.map(x => `${x.cod} ${x.desc} × ${x.q}`).join(' | '), 'Pezzi ordinati': d.righe.reduce((s, x) => s + x.q, 0), 'Pezzi spediti': [...sh.values()].reduce((s, q) => s + q, 0), 'Consegna prevista': nextDel(d), 'Imponibile': d.imponibile, 'Totale': d.totale, 'DDT': L.map(x => x.num).join(', '), 'Tracciamento': trkOf(d), 'Stato spedizione': [d, ...L].map(tkLabel).filter(Boolean).pop() || '', 'Consegna prevista corriere': etaOf(d), 'PDF': d.pdf || '' };
    }
    return { 'DDT': d.num, 'Data': d.data, 'Ordine': d.ord || '', 'Piazzale': ordOf(d) ? pzName(ordOf(d)) : d.pz, 'Destinatario': d.dest.rs, 'Corriere': carrier(d.corriere), 'Colli': d.colli || '', 'Segnacollo': (d.colliN || []).join(', '), 'Articoli': d.righe.map(x => `${x.cod} ${x.desc} × ${x.q}`).join(' | '), 'Pezzi': d.righe.reduce((s, x) => s + x.q, 0), 'Tracciamento': d.track || '', 'Stato spedizione': tkLabel(d), 'Ultimo aggiornamento': tkLast(d) ? `${tkLast(d).d} ${tkLast(d).luogo || ''}`.trim() : '', 'Consegna prevista corriere': (d.trk && d.trk.eta) || '', 'PDF': d.pdf || '' };
  }

  /* ---------- dati in memoria e collegamenti ---------- */
  let DOCS = new Map();
  const orders = () => [...DOCS.values()].filter(d => d.tipo === 'ordine').sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.num).localeCompare(String(a.num)));
  const ddts = () => [...DOCS.values()].filter(d => d.tipo === 'ddt').sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.num).localeCompare(String(a.num)));
  const ordOf = d => d && d.ord ? DOCS.get('o' + d.ord) || null : null;
  const ddtsOf = o => ddts().filter(d => d.ord && d.ord === o.num);
  const shipped = o => { const s = new Map(); ddtsOf(o).forEach(d => d.righe.forEach(x => s.set(x.cod, (s.get(x.cod) || 0) + x.q))); return s; };
  const shortOf = (o, sh) => o.righe.map(x => ({ cod: x.cod, desc: x.desc, um: x.um, r: x.q - (sh.get(x.cod) || 0) })).filter(x => x.r > 0);
  const shipSt = o => !ddtsOf(o).length ? '' : shortOf(o, shipped(o)).length ? 'parte' : 'tutto';
  const nextDel = o => (o.righe || []).map(x => x.consegna).filter(Boolean).sort()[0] || '';
  const pzName = o => o.pzMan || o.pz || '—';
  const pzOfD = d => { const o = ordOf(d); return o ? pzName(o) : d.pz || '—'; };
  const trkOf = o => ddtsOf(o).map(d => d.track).filter(Boolean)[0] || o.track || '';
  const open = o => o.stato !== 'consegnato' && o.stato !== 'annullato';
  const etaOf = o => [o, ...ddtsOf(o)].map(x => x.trk && x.trk.eta).filter(Boolean).sort().pop() || '';
  const dueOf = o => etaOf(o) || nextDel(o);
  const late = o => open(o) && shipSt(o) !== 'tutto' && !!dueOf(o) && dueOf(o) < today();
  const ST = { confermato: 'Confermato', spedito: 'In consegna', consegnato: 'Consegnato', annullato: 'Annullato' };
  const stLabel = o => late(o) ? 'In ritardo' : ST[o.stato] || ST.confermato;
  const stChip = o => `<span class="chip ${late(o) ? 'late' : o.stato === 'consegnato' ? 'ok' : o.stato === 'spedito' ? 'blue' : o.stato === 'annullato' ? '' : 'soon'}">${esc(stLabel(o))}</span>`;
  const shipChip = o => { const s = shipSt(o); return s === 'tutto' ? '<span class="chip ok">Spedito tutto</span>' : s === 'parte' ? '<span class="chip soon">Spedito in parte</span>' : ''; };

  /* ---------- controlli ---------- */
  function checksO(o) {
    const A = [], R = o.righe || [];
    const bad = R.filter(x => x.per && !same(r2(x.q * x.prezzo / x.per * (1 - (x.sconto || 0) / 100)), x.importo));
    if (bad.length) A.push({ t: 'warn', h: 'Importo di riga diverso dal calcolo', d: `${bad.map(x => x.cod).join(', ')}: quantità × prezzo non corrisponde all'importo.` });
    const sr = r2(R.reduce((s, x) => s + x.importo, 0));
    if (o.importoRighe != null && !same(sr, o.importoRighe)) A.push({ t: 'warn', h: 'La somma delle righe non torna', d: `Righe ${eur(sr)} contro importo totale ${eur(o.importoRighe)}.` });
    const imp = r2((o.importoRighe || 0) - (o.scontoImp || 0) + (o.spese || 0));
    if (o.imponibile != null && !same(imp, o.imponibile)) A.push({ t: 'warn', h: 'Imponibile diverso dal calcolo', d: `Righe − sconto + spese = ${eur(imp)}, sul documento ${eur(o.imponibile)}.` });
    if (o.ivaPct != null && o.iva != null && !same(r2(o.imponibile * o.ivaPct / 100), o.iva)) A.push({ t: 'warn', h: 'IVA diversa dal calcolo', d: `${o.ivaPct}% di ${eur(o.imponibile)} = ${eur(r2(o.imponibile * o.ivaPct / 100))}, sul documento ${eur(o.iva)}.` });
    if (o.totale != null && o.iva != null && !same(r2(o.imponibile + o.iva), o.totale)) A.push({ t: 'warn', h: 'Totale diverso dal calcolo', d: `Imponibile + IVA = ${eur(r2(o.imponibile + o.iva))}, sul documento ${eur(o.totale)}.` });
    const sh = shipped(o), over = R.filter(x => (sh.get(x.cod) || 0) > x.q);
    if (over.length) A.push({ t: 'warn', h: 'Spedito più del confermato', d: over.map(x => `${x.cod}: ${num(sh.get(x.cod))} spediti su ${num(x.q)}`).join(' · ') });
    if (late(o)) A.push({ t: 'warn', h: 'In ritardo', d: `Consegna prevista il ${dt(dueOf(o))}${etaOf(o) ? ' (dal corriere)' : ''}${ddtsOf(o).length ? ', spedito solo in parte' : tkIdx(o) >= 0 ? ', ancora in viaggio' : ', nessun DDT ancora'}.` });
    else if (open(o) && etaOf(o) && nextDel(o) && etaOf(o) > nextDel(o)) A.push({ t: 'info', h: 'Consegna posticipata', d: `Fischer prevedeva il ${dt(nextDel(o))}, il corriere ora indica il ${dt(etaOf(o))}.` });
    const sl = shortOf(o, sh); if (ddtsOf(o).length && sl.length && open(o)) A.push({ t: 'info', h: 'Consegna parziale', d: `Ancora da spedire: ${sl.map(x => `${x.cod} ${num(x.r)} ${x.um}`).join(' · ')}.` });
    if (open(o) && ddtsOf(o).length && !trkOf(o)) A.push({ t: 'info', h: 'Link di tracciamento da inserire', d: 'Incolla il link del corriere nella sezione Spedizioni.' });
    if (o.spese > 0) A.push({ t: 'info', h: 'Spese di spedizione', d: `${eur(o.spese)} addebitati (ordine sotto la soglia di porto franco).` });
    if (/anticip/i.test(o.pagamento || '') && o.stato === 'confermato' && !ddtsOf(o).length) A.push({ t: 'info', h: 'Pagamento anticipato', d: 'Da pagare prima della spedizione.' });
    return A;
  }
  function checksD(d) {
    const A = [], o = ordOf(d);
    if (!d.ord) A.push({ t: 'warn', h: 'Numero d\'ordine non indicato', d: 'Il DDT non riporta il numero d\'ordine Fischer: non si può collegare.' });
    else if (!o) A.push({ t: 'warn', h: 'Conferma d\'ordine non caricata', d: `Il DDT si riferisce all'ordine ${d.ord}${d.ordData ? ' del ' + dt(d.ordData) : ''}: carica quella conferma e si collegano da soli.` });
    else {
      const oc = new Set(o.righe.map(x => x.cod)), fuori = d.righe.filter(x => !oc.has(x.cod));
      if (fuori.length) A.push({ t: 'warn', h: 'Articoli non presenti nell\'ordine', d: `${fuori.map(x => x.cod + ' ' + x.desc).join(', ')}: non sono nella conferma ${o.num}.` });
      if (String(d.pz || '').toUpperCase() !== String(o.pz || '').toUpperCase() && d.pz && o.pz) A.push({ t: 'warn', h: 'Destinazione diversa dall\'ordine', d: `Il DDT va a «${d.pz}», la conferma d'ordine a «${o.pz}».` });
    }
    if (d.colli && d.colliN && d.colliN.length && d.colliN.length !== d.colli) A.push({ t: 'warn', h: 'Segnacolli e colli non coincidono', d: `${plur(d.colli, 'collo dichiarato', 'colli dichiarati')}, ${plur(d.colliN.length, 'segnacollo', 'segnacolli')} sul documento.` });
    if (d.trk && d.trk.auto && d.trk.auto.ref && d.consegna && d.trk.auto.ref !== d.consegna) A.push({ t: 'warn', h: 'Il link è di un\'altra consegna', d: `Il link di tracciamento riguarda la consegna Fischer ${d.trk.auto.ref}, questo DDT è la consegna ${d.consegna}.` });
    if (tkProb(d)) A.push({ t: 'warn', h: 'Problema sulla spedizione', d: `${dt(tkProb(d).d)}${tkProb(d).luogo ? ' · ' + tkProb(d).luogo : ''}${tkProb(d).n ? ' · ' + tkProb(d).n : ''}` });
    if (!d.track && tkIdx(d) < 4) A.push({ t: 'info', h: 'Link di tracciamento da inserire', d: 'Incolla il link del corriere (es. Shippeo) nel campo Tracciamento.' });
    return A;
  }

  /* ---------- stato della pagina ---------- */
  const V = { tab: 'pan', open: '', q: '', fst: '', fpz: '', lim: 50, anim: true };

  /* ---------- viste ---------- */
  const ckHtml = (C, ok) => C.length ? C.map(c => `<div class="ck ${c.t}"><i>${c.t === 'warn' ? '!' : 'i'}</i><div><b>${esc(c.h)}</b><span>${esc(c.d)}</span></div></div>`).join('') : `<div class="empty">${ok}</div>`;

  /* ---------- tracciamento: corriere, fasi, aggiornamenti ---------- */
  const TS = [['caricato', 'Caricato', 'Partito dal magazzino Fischer'], ['hub', 'All\'hub', 'Arrivato all\'hub di consegna'], ['partito', 'Partito dall\'hub', 'In viaggio verso il piazzale'], ['consegna', 'In consegna', 'Sul mezzo per la consegna'], ['consegnato', 'Consegnato', 'Merce arrivata al piazzale']];
  const TSK = TS.map(t => t[0]);
  const CARR = [[/shippeo/i, 'Shippeo'], [/brt\.it|bartolini/i, 'BRT'], [/fedex/i, 'FedEx'], [/gls/i, 'GLS'], [/dhl/i, 'DHL'], [/tnt/i, 'TNT'], [/ups\.com/i, 'UPS'], [/sda\.it|poste/i, 'Poste / SDA'], [/fercam/i, 'Fercam'], [/dachser/i, 'Dachser']];
  const platOf = u => { const m = CARR.find(([re]) => re.test(u || '')); if (m) return m[1]; try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const tkEv = x => ((x.trk && x.trk.ev) || []).slice().sort((a, b) => String(a.d).localeCompare(String(b.d)));
  const tkLast = x => { const E = tkEv(x).filter(e => e.st !== 'nota'); return E[E.length - 1] || null; };
  const tkProb = x => { const E = tkEv(x); const l = E[E.length - 1]; return l && l.st === 'problema' ? l : null; };
  // fase raggiunta: dagli aggiornamenti; un DDT vuol dire almeno «caricato»
  const tkIdx = x => { let i = x.tipo === 'ddt' ? 0 : -1; tkEv(x).forEach(e => { const k = TSK.indexOf(e.st); if (k > i) i = k; }); return i; };
  const tkLabel = x => { const p = tkProb(x); if (p) return 'Problema'; const i = tkIdx(x); return i < 0 ? (x.track ? 'Link inserito' : '') : TS[i][1]; };
  const stepDate = (x, k) => { const e = tkEv(x).filter(e => e.st === TSK[k]).pop(); return e ? e.d : k === 0 && x.tipo === 'ddt' ? x.data : ''; };
  function stepper(x, mini) {
    const i = tkIdx(x), pb = tkProb(x);
    if (mini) return `<span class="tkm${pb ? ' bad' : ''}" title="${esc(tkLabel(x))}">${TS.map((t, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</span>`;
    return `<ol class="steps${pb ? ' bad' : ''}">${TS.map((t, k) => { const d = stepDate(x, k); return `<li class="${k < i ? 'done' : k === i ? 'cur' : ''}"><i>${k < i || (k === i && k === 4) ? '✓' : k + 1}</i><b>${t[1]}</b><small>${d ? dt(d) : k === 4 && x.trk && x.trk.eta ? 'prevista ' + dt(x.trk.eta) : '&nbsp;'}</small></li>`; }).join('')}</ol>`;
  }
  function trkPanel(k, x, opts = {}) {
    const i = tkIdx(x), last = tkLast(x), pb = tkProb(x), eta = x.trk && x.trk.eta, au = x.trk && x.trk.auto, plat = platOf(x.track), carr = (au && au.carr) || (x.tipo === 'ddt' ? carrier(x.corriere) : '');
    const agg = au && au.agg ? new Date(au.agg) : null, aggTxt = agg ? `${dt(agg.toISOString().slice(0, 10)) === dt(today()) ? 'oggi' : agg.toLocaleDateString('it-IT')} alle ${agg.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : '';
    const E = tkEv(x).slice().reverse();
    const head = `<div class="tkh"><div class="tkc"><div class="tkb">${plat ? `<span class="carr">${esc(plat)}</span>` : ''}${carr && carr !== plat ? `<span class="carr alt">${esc(carr)}</span>` : ''}${x.tipo === 'ddt' ? `<span class="muted small">DDT ${esc(x.num)}${x.consegna ? ' · consegna Fischer ' + esc(x.consegna) : ''}</span>` : au && au.ref ? `<span class="muted small">consegna Fischer ${esc(au.ref)}</span>` : ''}${au ? '<span class="auto">● aggiornato in automatico</span>' : ''}</div>
        <b class="tks${pb ? ' bad' : i === 4 ? ' ok' : ''}">${pb ? 'Problema segnalato' : i < 0 ? (x.track ? 'In attesa del primo aggiornamento' : 'Nessun tracciamento') : esc(TS[i][2])}</b>
        <small class="muted">${last ? `Ultimo movimento ${esc(dt(last.d))}${last.h ? ' ore ' + esc(last.h) : ''}${last.luogo ? ' · ' + esc(last.luogo) : ''}` : x.track ? 'Nessun movimento ancora registrato dal corriere' : 'Incolla il link del corriere: stato e fasi si aggiornano da soli'}${aggTxt ? ` · controllato ${esc(aggTxt)}` : ''}</small></div>
      <div class="tkr">${eta && i < 4 ? `<div class="eta"><small>Consegna ${x.trk.etaTipo === 'stimata' ? 'stimata' : 'prevista'}${eta < today() ? ' · superata' : ''}</small><b class="${eta < today() ? 'late' : ''}">${esc(dt(eta))}</b></div>` : ''}${au && !opts.compact ? `<button type="button" class="btn" data-tkref="${k}:${esc(x.id)}">Aggiorna ora</button>` : ''}${x.track ? `<a class="btn primary" href="${esc(x.track)}" target="_blank" rel="noopener noreferrer">Apri tracciamento ↗</a>` : ''}</div></div>`;
    if (opts.compact) return `<div class="tkp compact">${head}${stepper(x)}</div>`;
    const id = `${k}:${esc(x.id)}`;
    return `<div class="tkp">${head}${stepper(x)}
      ${pb ? `<div class="ck warn" style="margin-top:12px"><i>!</i><div><b>Problema segnalato il ${esc(dt(pb.d))}</b><span>${esc([pb.luogo, pb.n].filter(Boolean).join(' · ') || 'nessun dettaglio')}</span></div></div>` : ''}
      <label class="fld lk"><small>Link di tracciamento</small><input type="url" data-trk="${id}" value="${esc(x.track || '')}" placeholder="Incolla qui il link del corriere (es. Shippeo): il resto si aggiorna da solo" autocomplete="off"></label>
      ${E.length ? `<div class="tkev">${E.map(e => `<div class="${e.st === 'problema' ? 'bad' : ''}"><i></i><span><b>${esc(e.st === 'nota' ? 'Nota' : e.st === 'problema' ? 'Problema / giacenza' : (TS.find(t => t[0] === e.st) || ['', e.st])[1])}${e.luogo ? ' · ' + esc(e.luogo) : ''}</b><small>${esc(dt(e.d))}${e.h ? ' · ore ' + esc(e.h) : ''}${e.n ? ' · ' + esc(e.n) : ''} · ${e.src === 'auto' ? esc((au && au.fonte) || 'corriere') : 'inserito a mano'}</small></span>${e.src === 'auto' ? '' : `<button type="button" class="x" data-tkdel="${id}:${esc(e.id)}" title="Togli questo aggiornamento">×</button>`}</div>`).join('')}</div>` : ''}
      <details class="tkman"><summary>Aggiungi un aggiornamento a mano (corrieri senza lettura automatica, note, giacenze)</summary>
      <div class="tku" data-tku="${id}">
        <label class="fld"><small>Stato</small><select name="st">${TS.map((t, n) => `<option value="${t[0]}"${n === Math.min(4, Math.max(0, i + 1)) ? ' selected' : ''}>${t[1]}</option>`).join('')}<option value="problema">Problema / giacenza</option><option value="nota">Solo nota</option></select></label>
        <label class="fld"><small>Data</small><input type="date" name="d" value="${today()}"></label>
        <label class="fld"><small>Dove / dettaglio</small><input type="text" name="luogo" placeholder="es. Hub Teramo" autocomplete="off"></label>
        <label class="fld"><small>Consegna prevista</small><input type="date" name="eta" value="${esc(eta || '')}"></label>
        <button type="button" class="btn primary" data-tkadd="${id}">Registra aggiornamento</button>
      </div></details>
    </div>`;
  }
  const trkField = (k, x) => `<div class="trk">${x.track ? `<a class="btn sm primary" href="${esc(x.track)}" target="_blank" rel="noopener noreferrer">Segui la spedizione ↗</a>` : '<small class="muted">Link di tracciamento non inserito</small>'}<input type="url" data-trk="${k}:${esc(x.id)}" value="${esc(x.track || '')}" placeholder="Incolla qui il link di tracciamento (es. Shippeo)" autocomplete="off" aria-label="Link di tracciamento"></div>`;
  const hayO = o => `${o.num} ${pzName(o)} ${o.dest.rs} ${o.dest.citta} ${o.righe.map(x => x.cod + ' ' + x.desc).join(' ')} ${ddtsOf(o).map(d => d.num + ' ' + (d.colliN || []).join(' ')).join(' ')}`.toLowerCase();
  const hayD = d => `${d.num} ${d.ord} ${pzOfD(d)} ${d.dest.rs} ${carrier(d.corriere)} ${(d.colliN || []).join(' ')} ${d.righe.map(x => x.cod + ' ' + x.desc).join(' ')}`.toLowerCase();
  const match = (s, q) => q.toLowerCase().split(/\s+/).filter(Boolean).every(w => s.includes(w));

  function rowO(o) {
    const L = ddtsOf(o), w = checksO(o).some(c => c.t === 'warn' && c.h !== 'In ritardo');
    return `<button type="button" class="or" data-open="${esc(o.id)}"><span><b>${esc(o.num)}</b><small>${esc(dt(o.data))}</small></span><span><b>${esc(pzName(o))}</b><small>${[plur(o.righe.length, 'articolo', 'articoli'), num(o.righe.reduce((s, x) => s + x.q, 0)) + ' pz', L.length ? 'DDT ' + L.map(d => d.num).join(', ') : '', open(o) && dueOf(o) && shipSt(o) !== 'tutto' ? 'consegna prevista ' + dt(dueOf(o)) : ''].filter(Boolean).map(esc).join(' · ')}</small></span><span class="cs">${stChip(o)}${shipChip(o)}${trkOf(o) ? '<span class="chip blue">Tracciamento</span>' : ''}${w ? '<span class="chip late">Controlla</span>' : ''}</span><span class="am">${eur(o.imponibile)}</span></button>`;
  }
  function rowD(d) {
    const o = ordOf(d);
    return `<button type="button" class="or d" data-open="${esc(d.id)}"><span><b>DDT ${esc(d.num)}</b><small>${esc(dt(d.data))}</small></span><span><b>${esc(pzOfD(d))}</b><small>${['ordine ' + (d.ord || '—'), d.colli ? plur(d.colli, 'collo', 'colli') : '', carrier(d.corriere), num(d.righe.reduce((s, x) => s + x.q, 0)) + ' pz'].filter(Boolean).map(esc).join(' · ')}</small></span><span class="cs">${o ? '' : '<span class="chip late">Conferma non caricata</span>'}${tkProb(d) ? '<span class="chip late">Problema</span>' : tkIdx(d) === 4 ? '<span class="chip ok">Consegnato</span>' : d.track ? `<span class="chip blue">${esc(tkLabel(d))}</span>` : '<span class="chip">Senza tracciamento</span>'}${stepper(d, true)}</span></button>`;
  }

  function overview() {
    const O = orders(), D = ddts();
    if (!O.length && !D.length) return `<div class="card"><div class="empty" style="padding:50px 10px"><b style="font-size:16px;color:var(--ink)">Nessun documento ancora</b><br>Carica le conferme d'ordine e i DDT di Fischer in PDF, oppure trascinali in questa pagina (anche più file insieme, o uno zip).<br>Vengono letti, controllati e collegati tra loro in automatico.<br><br><button type="button" class="btn primary" data-up>+ Carica PDF</button></div></div>`;
    return FPAN.html({ orders, ddts, open, late, shipSt, shortOf, shipped, pzName, pzOfD, tkIdx, ordOf, ddtsOf, nextDel, dueOf, etaOf, checksO, checksD, stepper, PZ_LIST, esc, num, eur, dt, today });
  }
  function pzChips(names) {
    return names.length > 1 ? `<div class="chips">${[['', 'Tutti i piazzali'], ...names.sort((a, b) => a.localeCompare(b, 'it')).map(n => [n, n])].map(([k, l]) => `<button type="button" class="chip-f${V.fpz === k ? ' on' : ''}" data-fpz="${esc(k)}">${esc(l)}</button>`).join('')}</div>` : '';
  }
  function ordersView() {
    const O = orders();
    const is = (o, k) => k === 'aperti' ? open(o) : k === 'confermato' ? o.stato === 'confermato' : k === 'spedito' ? o.stato === 'spedito' : k === 'parte' ? open(o) && shipSt(o) === 'parte' : k === 'ritardo' ? late(o) : k === 'consegnato' ? o.stato === 'consegnato' : k === 'annullato' ? o.stato === 'annullato' : true;
    const R = O.filter(o => (!V.q || match(hayO(o), V.q)) && (!V.fpz || pzName(o) === V.fpz) && (!V.fst || is(o, V.fst)));
    const F = [['', 'Tutti'], ['aperti', 'Aperti'], ['confermato', 'Confermati'], ['spedito', 'In consegna'], ['parte', 'Spediti in parte'], ['ritardo', 'In ritardo'], ['consegnato', 'Consegnati'], ['annullato', 'Annullati']];
    return `<div class="card"><div class="card-h"><h3>Ordini</h3><span class="muted small">${plur(R.length, 'ordine', 'ordini')}${R.length !== O.length ? ' su ' + num(O.length) : ''}</span></div>
      <div class="chips">${F.map(([k, l]) => { const n = O.filter(o => is(o, k)).length; return !k || n ? `<button type="button" class="chip-f${V.fst === k ? ' on' : ''}" data-fst="${k}">${l}<em>${num(n)}</em></button>` : ''; }).join('')}</div>
      ${pzChips([...new Set(O.map(pzName))])}
      <div class="ol">${R.slice(0, V.lim).map(rowO).join('') || `<div class="empty">${O.length ? 'Nessun ordine con questi filtri' : 'Nessuna conferma d\'ordine caricata'}</div>`}</div>
      ${R.length > V.lim ? '<div style="text-align:center;margin-top:12px"><button type="button" class="btn sm" data-more>Mostra altri</button></div>' : ''}</div>`;
  }
  function ddtView() {
    const D = ddts();
    const is = (d, k) => k === 'viaggio' ? tkIdx(d) < 4 : k === 'arrivati' ? tkIdx(d) === 4 : k === 'problema' ? !!tkProb(d) : k === 'senza' ? !ordOf(d) : k === 'notrk' ? !d.track : k === 'trk' ? !!d.track : true;
    const R = D.filter(d => (!V.q || match(hayD(d), V.q)) && (!V.fpz || pzOfD(d) === V.fpz) && (!V.fst || is(d, V.fst)));
    const F = [['', 'Tutti'], ['viaggio', 'In viaggio'], ['arrivati', 'Consegnati'], ['problema', 'Con problemi'], ['senza', 'Senza conferma'], ['notrk', 'Senza tracciamento'], ['trk', 'Con tracciamento']];
    return `<div class="card"><div class="card-h"><h3>DDT</h3><span class="muted small">${plur(R.length, 'DDT', 'DDT')}${R.length !== D.length ? ' su ' + num(D.length) : ''}</span></div>
      <div class="chips">${F.map(([k, l]) => { const n = D.filter(d => is(d, k)).length; return !k || n ? `<button type="button" class="chip-f${V.fst === k ? ' on' : ''}" data-fst="${k}">${l}<em>${num(n)}</em></button>` : ''; }).join('')}</div>
      ${pzChips([...new Set(D.map(pzOfD))])}
      <div class="ol">${R.slice(0, V.lim).map(rowD).join('') || `<div class="empty">${D.length ? 'Nessun DDT con questi filtri' : 'Nessun DDT caricato'}</div>`}</div>
      ${R.length > V.lim ? '<div style="text-align:center;margin-top:12px"><button type="button" class="btn sm" data-more>Mostra altri</button></div>' : ''}</div>`;
  }

  function orderDetail(o) {
    const L = ddtsOf(o), sh = shipped(o), st = shipSt(o), C = checksO(o);
    const names = [...new Set([...orders().map(pzName), ...Object.values(PZ_LIST)])].filter(n => n && n !== '—').sort((a, b) => a.localeCompare(b, 'it'));
    const kv = [['Destinatario', o.dest.rs], ['Indirizzo', [o.dest.via, [o.dest.cap, o.dest.citta, o.dest.prov].filter(Boolean).join(' ')].filter(Boolean).join(' · ')], ['Pagamento', o.pagamento], ['Corriere previsto', carrier(o.corriere)], ['Porto / resa', o.porto], ['Peso', o.peso ? num(o.peso, 3) + ' kg' : ''], ['Consegna prevista', dt(nextDel(o))], ['Magazzino Fischer', o.magForn], ['N. cliente', o.cliente]].filter(([, v]) => v);
    return `<div class="back"><button type="button" class="btn sm" data-back>‹ Indietro</button>${stChip(o)}${shipChip(o)}<span class="sp"></span>${o.pdf ? `<a class="btn sm" href="${esc(o.pdf)}" target="_blank" rel="noopener noreferrer">Apri PDF</a>` : ''}<button type="button" class="btn sm danger" data-del="${esc(o.id)}">Elimina</button></div>
      <div class="card"><div class="card-h"><h3>Ordine ${esc(o.num)} · ${esc(pzName(o))}</h3><span class="muted small">conferma del ${esc(dt(o.data))}</span></div>
        <div class="kv">${kv.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
        <div class="acts"><label class="fld"><small>Piazzale</small><select data-pzsel="${esc(o.id)}">${names.map(n => `<option${pzName(o) === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <div class="fld"><small>Stato</small><div class="seg">${Object.keys(ST).map(k => `<button type="button" data-st="${k}" class="${o.stato === k ? 'on' : ''}">${ST[k]}</button>`).join('')}</div></div></div></div>
      <div class="card"><div class="card-h"><h3>Spedizioni</h3><span class="muted small">${L.length ? `${plur(L.length, 'DDT', 'DDT')} · ${st === 'tutto' ? 'spedito tutto' : 'spedito in parte'}` : 'nessun DDT caricato'}</span></div>
        ${L.length ? L.map(d => `<div class="tkw">${trkPanel('d', d, { compact: true })}<div style="text-align:right;margin:-4px 0 12px"><button type="button" class="btn sm" data-open="${esc(d.id)}">Aggiorna spedizione e dettagli del DDT ›</button></div></div>`).join('') : `<div class="muted small" style="margin:0 0 10px">Nessun DDT ancora: quando arriva caricalo con «+ Carica PDF» e si collega da solo tramite il numero d'ordine ${esc(o.num)}. Se hai già il link del corriere, incollalo qui.</div>${trkPanel('o', o)}`}
        <div class="mx-wrap"><table class="mx"><thead><tr><th class="l">Codice</th><th class="l">Descrizione</th><th>Confermato</th><th>Spedito</th><th>Da spedire</th></tr></thead><tbody>${o.righe.map(x => { const q = sh.get(x.cod) || 0, r = x.q - q; return `<tr><td class="l">${esc(x.cod)}</td><td class="l">${esc(x.desc)}</td><td>${num(x.q)} ${esc(x.um)}</td><td><b>${num(q)}</b></td><td>${r > 0 ? `<span class="chip soon">${num(r)}</span>` : r < 0 ? `<span class="chip late">+${num(-r)}</span>` : '<span class="chip ok">0</span>'}</td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Articoli e prezzi</h3><span class="muted small">IVA esclusa</span></div><div class="mx-wrap"><table class="mx"><thead><tr><th class="l">Codice</th><th class="l">Descrizione</th><th>Quantità</th><th>Prezzo</th><th>Sconto</th><th>Importo</th><th>Consegna prevista</th></tr></thead><tbody>
        ${o.righe.map(x => `<tr><td class="l">${esc(x.cod)}</td><td class="l">${esc(x.desc)}${x.ean ? `<small>EAN ${esc(x.ean)}</small>` : ''}</td><td>${num(x.q)} ${esc(x.um)}</td><td>${eur(x.prezzo)}<small>per ${num(x.per || 1)} ${esc(x.umPrezzo || x.um)}</small></td><td>${x.scontoTxt ? esc(x.scontoTxt) : x.sconto ? num(x.sconto, 2) + '%' : '—'}</td><td><b>${eur(x.importo)}</b></td><td>${x.consegna ? esc(dt(x.consegna)) : '—'}</td></tr>`).join('')}</tbody></table></div>
        <div class="tot"><div><span>Importo righe</span><b>${eur(o.importoRighe)}</b></div>${o.scontoImp ? `<div><span>Sconto di testata ${num(o.scontoPct, 2)}%</span><b>− ${eur(o.scontoImp)}</b></div>` : ''}${o.spese ? `<div><span>Spese di spedizione</span><b>${eur(o.spese)}</b></div>` : ''}<div><span>Imponibile</span><b>${eur(o.imponibile)}</b></div><div><span>IVA ${num(o.ivaPct)}%</span><b>${eur(o.iva)}</b></div><div class="tt"><span>Totale ordine</span><b>${eur(o.totale)}</b></div></div></div>
      <div class="grid2"><div><div class="card"><div class="card-h"><h3>Controlli</h3><span class="muted small">${C.some(c => c.t === 'warn') ? 'da verificare' : 'i numeri tornano'}</span></div>${ckHtml(C, 'Quantità, prezzi, sconto, IVA e totale sono coerenti')}</div></div>
      <div><div class="card"><div class="card-h"><h3>Storico</h3><span class="muted small">movimentazioni dell'ordine</span></div>
        <div class="mv">${(o.mov || []).slice().reverse().map(v => `<div><i></i><span><b>${esc(v.n)}</b><small>${esc(dt(v.d))}${v.st ? ' · ' + esc(ST[v.st] || '') : ''}</small></span></div>`).join('') || '<div class="empty">Nessuna movimentazione</div>'}</div>
        <div class="note"><input type="text" id="note" placeholder="Aggiungi una nota (es. merce arrivata, collo danneggiato…)" autocomplete="off"><button type="button" class="btn sm" data-note="${esc(o.id)}">Aggiungi</button></div></div></div></div>`;
  }

  function ddtDetail(d) {
    const o = ordOf(d), C = checksD(d), oq = new Map(o ? o.righe.map(x => [x.cod, x.q]) : []);
    const kv = [['Destinatario', d.dest.rs], ['Indirizzo', [d.dest.via, [d.dest.cap, d.dest.citta, d.dest.prov].filter(Boolean).join(' ')].filter(Boolean).join(' · ')], ['Corriere', carrier(d.corriere)], ['Colli', d.colli ? String(d.colli) : ''], ['Peso', d.peso ? num(d.peso, 3) + ' kg' : ''], ['N. consegna Fischer', d.consegna], ['Porto / resa', d.porto], ['Causale', d.causale], ['Magazzino Fischer', d.magForn], ['N. cliente', d.cliente]].filter(([, v]) => v);
    return `<div class="back"><button type="button" class="btn sm" data-back>‹ Indietro</button>${o ? '' : '<span class="chip late">Conferma non caricata</span>'}<span class="chip ${d.track ? 'blue' : ''}">${d.track ? 'Con tracciamento' : 'Senza tracciamento'}</span><span class="sp"></span>${d.pdf ? `<a class="btn sm" href="${esc(d.pdf)}" target="_blank" rel="noopener noreferrer">Apri PDF</a>` : ''}<button type="button" class="btn sm danger" data-del="${esc(d.id)}">Elimina</button></div>
      <div class="card"><div class="card-h"><h3>DDT ${esc(d.num)} · ${esc(pzOfD(d))}</h3><span class="muted small">del ${esc(dt(d.data))}</span></div>
        <div class="kv">${kv.map(([k, v]) => `<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
        <div class="acts"><div class="fld"><small>Conferma d'ordine</small>${o ? `<button type="button" class="chip-f" data-open="${esc(o.id)}">Ordine ${esc(o.num)} del ${esc(dt(o.data))} ›</button>` : `<b>${d.ord ? 'ordine ' + esc(d.ord) + ' non ancora caricato' : 'non indicata'}</b>`}</div>
</div>
        ${d.colliN && d.colliN.length ? `<div class="fld" style="margin-top:6px"><small>Segnacollo</small><b>${d.colliN.map(esc).join(' · ')}</b></div>` : ''}
        ${d.istr ? `<p class="muted small" style="margin:12px 0 0">${esc(d.istr)}</p>` : ''}</div>
      <div class="card"><div class="card-h"><h3>Spedizione</h3><span class="muted small">${esc(tkLabel(d) || 'senza tracciamento')}</span></div>${trkPanel('d', d)}</div>
      <div class="card"><div class="card-h"><h3>Articoli consegnati</h3><span class="muted small">${plur(d.righe.length, 'riga', 'righe')}</span></div><div class="mx-wrap"><table class="mx"><thead><tr><th class="l">Codice</th><th class="l">Descrizione</th><th>Quantità</th>${o ? '<th>Nella conferma</th>' : ''}</tr></thead><tbody>
        ${d.righe.map(x => `<tr><td class="l">${esc(x.cod)}</td><td class="l">${esc(x.desc)}${x.ean ? `<small>EAN ${esc(x.ean)}</small>` : ''}</td><td><b>${num(x.q)} ${esc(x.um)}</b></td>${o ? `<td>${oq.has(x.cod) ? num(oq.get(x.cod)) : '<span class="chip late">non c\'è</span>'}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Controlli</h3><span class="muted small">${C.some(c => c.t === 'warn') ? 'da verificare' : 'tutto torna'}</span></div>${ckHtml(C, 'Articoli e destinazione coincidono con la conferma d\'ordine')}</div>`;
  }
  const PZ_LIST = { RM: 'San Cesareo', TO: 'Torino', VE: 'Venezia', VR: 'Verona', MI: 'Gorgonzola', RA: 'Ravenna', RN: 'Rimini', BO: 'Bologna', PI: 'Pisa', TE: 'Corropoli', PE: 'Pescara' };

  /* ---------- tracciamento automatico ---------- */
  // unisce la lettura del corriere con gli aggiornamenti a mano e aggiorna l'ordine; restituisce i documenti da salvare
  function applyInfo(x, info, url) {
    const n = clone(x); n.track = url;
    const old = (n.trk && n.trk.ev) || [], prev = new Set(old.filter(e => e.src === 'auto').map(e => e.id));
    n.trk = { ...(n.trk || {}), ev: [...old.filter(e => e.src !== 'auto'), ...info.ev] };
    if (info.eta) { n.trk.eta = info.eta; n.trk.etaTipo = info.etaTipo; }
    n.trk.auto = { fonte: info.fonte, ref: info.ref, carr: info.carr, dest: info.dest, stato: info.stato, agg: info.agg };
    const nuovi = info.ev.filter(e => !prev.has(e.id)), out = [n];
    const o0 = n.tipo === 'ordine' ? n : ordOf(n), o = o0 && o0 !== n ? clone(o0) : o0;
    if (o) {
      o.mov = [...(o.mov || []), ...nuovi.map(e => ({ d: e.d, st: '', n: `Spedizione: ${(TS.find(t => t[0] === e.st) || ['', e.st === 'problema' ? 'Problema / giacenza' : e.st])[1]}${e.luogo ? ' · ' + e.luogo : ''}${n.tipo === 'ddt' ? ' (DDT ' + n.num + ')' : ''} · da ${info.fonte}` }))];
      const f = tkIdx(n);
      if (f >= 0 && f < 4 && o.stato === 'confermato') { o.stato = 'spedito'; o.mov.push({ d: today(), st: 'spedito', n: 'Merce in consegna' }); }
      if (f === 4 && open(o)) {
        const all = n.tipo === 'ddt' ? ddtsOf(o).map(z => z.id === n.id ? n : z) : [];
        if (n === o || (shipSt(o) === 'tutto' && all.every(z => tkIdx(z) === 4))) { o.stato = 'consegnato'; o.mov.push({ d: today(), st: 'consegnato', n: 'Merce consegnata al piazzale' }); }
      }
      if (o !== n) out.push(o);
    }
    return out;
  }
  const cityKey = s => String(s || '').toLowerCase().replace(/\s*\([a-z]{2}\)\s*$/, '').trim();
  // a chi appartiene il link: DDT con lo stesso numero di consegna Fischer, altrimenti ordine aperto dello stesso piazzale
  function ownerOf(info, pref) {
    const D = ddts().find(d => info.ref && d.consegna === info.ref); if (D) return D;
    const c = cityKey(info.dest && info.dest.citta), same = x => c && [x.pz, x.pzMan, x.dest && x.dest.citta, x.dest && x.dest.mag].some(v => cityKey(v) === c);
    if (pref && (pref.tipo === 'ordine' || !pref.consegna || pref.consegna === info.ref) && (!c || same(pref) || pref.tipo === 'ordine')) return pref;
    const O = orders().filter(o => open(o) && same(o));
    return O.find(o => !trkOf(o)) || O[0] || (pref && pref.tipo === 'ordine' ? pref : null);
  }
  async function pasteLink(url, pref) {
    if (!okUrl(url)) return toast('Il link deve iniziare con https://');
    let info = null;
    try { busy('Leggo la spedizione dal corriere…'); info = await Store.track(url); }
    catch (e) { busy(); if (pref) { const n = clone(pref); n.track = url; await save([n], 'Link salvato. Lettura automatica non riuscita: ' + e.message); } else toast('Lettura non riuscita: ' + e.message); return; }
    finally { busy(); }
    const ow = ownerOf(info, pref);
    if (!ow) return toast(`Il link è della consegna ${info.ref || '—'} per ${info.dest.citta || info.dest.nome || '—'}: nessun DDT od ordine aperto corrispondente. Carica prima la conferma d'ordine o il DDT.`);
    const out = applyInfo(DOCS.get(ow.id), info, url);
    // il link non resta su un altro documento
    [...DOCS.values()].filter(x => x.id !== ow.id && x.track === url && !out.some(y => y.id === x.id)).forEach(x => { const y = clone(x); y.track = ''; delete y.trk; out.push(y); });
    if (pref && pref.id !== ow.id && pref.track === url && !out.some(y => y.id === pref.id)) { const y = clone(pref); y.track = ''; delete y.trk; out.push(y); }
    V.open = ow.id;
    await save(out, `${ow.tipo === 'ddt' ? 'DDT ' + ow.num : 'Ordine ' + ow.num} · ${ow.tipo === 'ddt' ? pzOfD(ow) : pzName(ow)}: ${tkLabel(out[0])}${pref && pref.id !== ow.id ? ' (il link era di questa spedizione: collegato qui)' : ''}`);
  }
  async function refreshAll(force) {
    if (mode() !== 'google') return;
    try { await Store.refresh(); const docs = await Store.load(); DOCS = new Map(docs.filter(d => d && d.id && Array.isArray(d.righe)).map(d => [d.id, d])); render(); }
    catch (e) { if (force) toast('Aggiornamento non riuscito: ' + e.message); }
  }

  /* ---------- disegno ---------- */
  // titolo grande della pagina, parola per parola (come l'intestazione della panoramica)
  const words = t => esc(t).split(' ').map((w, i) => `<span class="word" style="--i:${i}">${w}</span>`).join(' ');
  function pageHead(doc) {
    if (doc) {
      const o = doc.tipo === 'ordine';
      return `<section class="phead"><p class="eyebrow">${o ? `Conferma d'ordine del ${esc(dt(doc.data))}` : `Documento di trasporto del ${esc(dt(doc.data))}`}</p><h1>${words(`${o ? 'Ordine' : 'DDT'} ${doc.num}`)}</h1><p class="psub">${esc(o ? pzName(doc) : pzOfD(doc))}${o ? ' · ' + esc(stLabel(doc)) : ordOf(doc) ? ' · ordine ' + esc(doc.ord) : ''}</p></section>`;
    }
    if (V.tab === 'ord') { const O = orders(), a = O.filter(open).length; return `<section class="phead"><p class="eyebrow">Conferme d'ordine Fischer</p><h1>${words('Ordini')}</h1><p class="psub">${num(O.length)} in totale · ${num(a)} ${a === 1 ? 'aperto' : 'aperti'}</p></section>`; }
    if (V.tab === 'ddt') { const D = ddts(), v = D.filter(d => tkIdx(d) < 4).length; return `<section class="phead"><p class="eyebrow">Documenti di trasporto</p><h1>${words('DDT e spedizioni')}</h1><p class="psub">${num(D.length)} DDT · ${num(v)} in viaggio</p></section>`; }
    return '';
  }
  function navSync(anim) {
    const doc = V.open && DOCS.get(V.open), cur = doc ? (doc.tipo === 'ordine' ? 'ord' : 'ddt') : V.tab;
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === cur));
    const b = document.querySelector('.nav-tab.on'), bub = document.querySelector('.nav-bubble');
    if (b && bub) { if (!anim) bub.style.transition = 'none'; bub.style.width = b.offsetWidth + 'px'; bub.style.height = b.offsetHeight + 'px'; bub.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`; if (!anim) { bub.offsetWidth; bub.style.transition = ''; } bub.classList.add('in'); }
  }
  function render() {
    const m = mode(), mb = $('#mode');
    mb.className = 'mode tool' + (m === 'google' ? ' on' : m === 'prova' ? ' prova' : ''); mb.querySelector('span').textContent = m === 'google' ? 'Google Foglio' : m === 'prova' ? 'Prova' : 'Non collegato';
    mb.title = m === 'google' ? 'Collegato al Google Foglio' : m === 'prova' ? 'Prova: i dati restano solo in questo browser' : 'Collega il Google Foglio';
    if (V.open && !DOCS.has(V.open)) V.open = '';
    const doc = V.open && DOCS.get(V.open);
    const body = doc ? (doc.tipo === 'ordine' ? orderDetail(doc) : ddtDetail(doc)) : V.tab === 'ord' ? ordersView() : V.tab === 'ddt' ? ddtView() : overview();
    const q = $('#q'); if (q && document.activeElement !== q && q.value !== V.q) q.value = V.q;
    const app = $('#app'), key = (doc ? doc.id : V.tab);
    app.classList.toggle('settled', app.dataset.k === key); app.dataset.k = key;
    app.innerHTML = `${pageHead(doc)}${body}`;
    navSync(true);
    if (!doc && V.tab === 'pan') { FPAN.after(app, V.anim, { eur, num, esc }); V.anim = false; }
  }
  addEventListener('resize', () => navSync(false));

  /* ---------- avvisi ---------- */
  let tT;
  function toast(m) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; clearTimeout(tT); tT = setTimeout(() => t.remove(), 4200); }
  function busy(m) { let b = $('.busy'); if (!m) { if (b) b.remove(); return; } if (!b) { b = document.createElement('div'); b.className = 'busy'; b.innerHTML = '<div></div>'; document.body.appendChild(b); } b.firstChild.textContent = m; }

  /* ---------- salvataggio ---------- */
  async function save(docs, msg, later) {
    docs.forEach(d => DOCS.set(d.id, d)); if (later) setTimeout(() => { const a = document.activeElement; if (!a || !a.closest('[data-tku]')) render(); }, 400); else render();
    try { await Store.save(docs); if (msg) toast(msg); }
    catch (e) { toast('Non salvato sul Google Foglio: ' + e.message); }
  }

  /* ---------- caricamento PDF ---------- */
  // impronta del contenuto: serve a dire se un doppione è identico o diverso da quello già salvato
  const finger = d => JSON.stringify([d.num, d.data, (d.righe || []).map(x => [x.cod, x.q, x.importo || 0]), d.totale || 0, d.colli || 0, d.ord || '']);
  // chiede cosa fare dei documenti già caricati
  function askDup(list) {
    return new Promise(res => {
      const d = document.createElement('div'); d.className = 'dlg';
      const diff = list.filter(x => !x.same).length;
      d.innerHTML = `<form class="dup"><h3>${list.length === 1 ? 'Documento già caricato' : `${list.length} documenti già caricati`}</h3>
        <p>${list.length === 1 ? 'Questo documento è già presente nel gestionale.' : 'Questi documenti sono già presenti nel gestionale.'} ${diff ? 'Quelli segnati «diverso» non coincidono con la versione salvata: se Fischer ti ha mandato una versione corretta, aggiornali.' : 'Sono identici a quelli salvati: puoi saltarli.'}</p>
        <div class="dup-l">${list.map(x => `<div class="dup-r"><span class="dup-i ${x.tipo}">${x.tipo === 'ddt' ? 'DDT' : 'ORD'}</span><span><b>${x.tipo === 'ddt' ? 'DDT' : 'Ordine'} ${esc(x.num)}</b><small>${esc(x.pz || '')}${x.creato ? ' · caricato il ' + esc(dt(x.creato.slice(0, 10))) : ''}${x.batch ? ' · presente 2 volte in questo caricamento' : ''}</small></span>${x.batch && !x.ex ? '<span class="chip">ripetuto</span>' : x.same ? '<span class="chip ok">identico</span>' : '<span class="chip soon">diverso</span>'}</div>`).join('')}</div>
        <div class="row"><button type="button" class="btn sm" data-skip>Salta i doppioni</button><button type="button" class="btn primary" data-upd>Aggiorna con i nuovi</button></div></form>`;
      document.body.appendChild(d);
      d.addEventListener('click', e => { if (e.target.closest('[data-skip]')) { d.remove(); res(false); } else if (e.target.closest('[data-upd]')) { d.remove(); res(true); } });
    });
  }
  async function load(files) {
    if (!mode()) return setup();
    const bad = [], up = []; let nO = 0, nD = 0, nUpd = 0, nSkip = 0, warn = 0, last = '';
    try {
      busy('Preparo i file…');
      const docs = [];
      for (const f of files) { if (/\.zip$/i.test(f.name) || f.type === 'application/zip') { try { docs.push(...await FP.unzip(f)); } catch (e) { bad.push(`${f.name}: ${e.message}`); } } else docs.push(f); }
      // 1) lettura di tutti i file
      const read = []; let i = 0;
      for (const f of docs) {
        i++; busy(`Leggo ${i} di ${docs.length}…`);
        try { const u8 = new Uint8Array(await f.arrayBuffer()), r = await FP.read(u8.slice()); read.push({ f, u8, tipo: r.tipo, doc: r.doc }); }
        catch (e) { bad.push(`${f.name}: ${e.message}`); }
      }
      // 2) doppioni: già nel gestionale, o lo stesso documento due volte in questo caricamento
      const seen = new Map(), todo = [], dups = [];
      read.forEach(r => {
        const id = r.doc.id, ex = DOCS.get(id), prev = seen.get(id);
        if (prev) { const x = dups.find(y => y.id === id); if (x) x.batch = true; else dups.push({ id, num: r.doc.num, tipo: r.tipo, pz: r.doc.pz, ex: !!ex, creato: ex && ex.creato, same: true, batch: true }); nSkip++; return; }
        seen.set(id, r);
        if (ex) { dups.push({ id, num: r.doc.num, tipo: r.tipo, pz: ex.tipo === 'ordine' ? pzName(ex) : pzOfD(ex), ex: true, creato: ex.creato, same: finger(ex) === finger(r.doc), r }); return; }
        todo.push(r);
      });
      const exDups = dups.filter(x => x.ex);
      if (exDups.length) { busy(); const upd = await askDup(dups); if (upd) exDups.forEach(x => todo.push(x.r || seen.get(x.id))); else nSkip += exDups.length; }
      // 3) salvataggio
      i = 0;
      for (const { f, u8, tipo, doc } of todo) {
        i++;
        try {
          const ex = DOCS.get(doc.id);
          const d = { ...doc, tipo, nomeFile: f.name, track: ex ? ex.track || '' : '', pdf: ex ? ex.pdf || '' : '', creato: ex ? ex.creato : new Date().toISOString() };
          if (ex && ex.trk) d.trk = ex.trk;
          if (tipo === 'ordine') { d.stato = ex ? ex.stato : 'confermato'; d.mov = ex ? (ex.mov || []) : [{ d: today(), st: 'confermato', n: 'Conferma d\'ordine caricata' }]; if (ex && ex.pzMan) d.pzMan = ex.pzMan; if (ex) d.mov = [...d.mov, { d: today(), st: '', n: 'Conferma ricaricata e aggiornata' }]; }
          if (!d.pdf && mode() === 'google') { busy(`Salvo il PDF ${i} di ${todo.length} su Drive…`); try { d.pdf = await Store.pdf(`Fischer ${tipo === 'ddt' ? 'DDT' : 'ordine'} ${d.num} ${d.data}.pdf`, u8); } catch (e) { bad.push(`${f.name}: PDF non archiviato (${e.message})`); } }
          DOCS.set(d.id, d); up.push(d); last = d.id; ex ? nUpd++ : tipo === 'ddt' ? nD++ : nO++;
          // collegamenti: DDT nuovo → ordine «In consegna»; conferma nuova con DDT già caricati → «In consegna»
          if (tipo === 'ddt' && !d.track && d.consegna) { const h = [...DOCS.values()].find(x => x.id !== d.id && x.trk && x.trk.auto && x.trk.auto.ref === d.consegna); if (h) { d.track = h.track; d.trk = clone(h.trk); if (h.tipo === 'ordine') { h.track = ''; delete h.trk; if (!up.includes(h)) up.push(h); } } }
          if (tipo === 'ddt' && !ex) { const o = ordOf(d); if (o) { const sp = o.stato === 'confermato'; if (sp) o.stato = 'spedito'; o.mov = [...(o.mov || []), { d: today(), st: sp ? 'spedito' : '', n: `DDT ${d.num} del ${dt(d.data)} caricato${d.colli ? ' · ' + plur(d.colli, 'collo', 'colli') : ''}${d.corriere ? ' · ' + carrier(d.corriere) : ''}` }]; if (!up.includes(o)) up.push(o); } }
          if (tipo === 'ordine' && !ex) { const L = ddtsOf(d); if (L.length) { d.stato = 'spedito'; d.mov.push({ d: today(), st: 'spedito', n: `Collegata ${L.length === 1 ? 'al DDT' : 'ai DDT'} ${L.map(x => x.num).join(', ')} già caricat${L.length === 1 ? 'o' : 'i'}` }); } }
          if ((tipo === 'ddt' ? checksD(d) : checksO(d)).some(c => c.t === 'warn' && c.h !== 'In ritardo')) warn++;
        } catch (e) { bad.push(`${f.name}: ${e.message}`); }
      }
      if (up.length) { busy('Salvo…'); await Store.save([...new Set(up)]); }
    } catch (e) { bad.push(e.message); }
    finally { busy(); }
    if (nO + nD + nUpd === 1 && last) V.open = last;
    render();
    const parts = [nO ? plur(nO, 'conferma caricata', 'conferme caricate') : '', nD ? plur(nD, 'DDT caricato', 'DDT caricati') : '', nUpd ? plur(nUpd, 'documento aggiornato', 'documenti aggiornati') : '', nSkip ? plur(nSkip, 'doppione saltato', 'doppioni saltati') : ''].filter(Boolean).join(' · ');
    toast(parts ? `${parts}${warn ? ` · ${warn} da controllare` : ''}${bad.length ? ` · ${bad.length} non letti` : ''}` : `Non letto: ${bad[0] || 'file non valido'}`);
    if (bad.length && parts) setTimeout(() => toast('Problemi: ' + bad.slice(0, 3).join(' | ')), 4300);
  }


  function pasteDlg() {
    if (mode() !== 'google') return toast('Collega prima il Google Foglio: la lettura automatica passa dallo script');
    const d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = `<form><h3>Incolla il link di tracciamento</h3><p>Leggo la spedizione dal corriere e la collego da sola al DDT giusto (stesso numero di consegna Fischer) o all'ordine aperto dello stesso piazzale.</p>
      <input type="url" name="u" placeholder="https://view.shippeo.com/…" required autocomplete="off"><div class="row"><button type="button" class="btn sm" data-x>Annulla</button><button class="btn primary">Collega</button></div></form>`;
    document.body.appendChild(d); const f = d.querySelector('form'); f.u.focus();
    d.addEventListener('click', e => { if (e.target.closest('[data-x]') || e.target === d) d.remove(); });
    f.addEventListener('submit', e => { e.preventDefault(); const u = f.u.value.trim(); d.remove(); pasteLink(u, null); });
  }
  /* ---------- collegamento al Google Foglio ---------- */
  function setup() {
    const d = document.createElement('div'), on = mode() === 'google'; d.className = 'dlg';
    d.innerHTML = on ? `<form><h3>Collegato al Google Foglio</h3>
      <p>Per far entrare un collega senza fargli inserire niente, mandagli il <b>link di invito</b>: contiene già il codice di accesso. Chi ha questo link può vedere e modificare ordini e DDT, quindi mandalo solo alle persone giuste.</p>
      <div class="invite"><input type="text" readonly value="${esc(inviteLink())}" aria-label="Link di invito"><button type="button" class="btn primary" data-copy>Copia link di invito</button></div>
      <div class="row"><button type="button" class="btn sm danger" data-out>Scollega questo browser</button><button type="button" class="btn sm" data-x>Chiudi</button></div></form>`
      : `<form><h3>Accesso</h3>
      <p>Se un collega ti ha mandato il link di invito, aprilo e entri subito. Altrimenti inserisci il codice di accesso.</p>
      <label class="fld"><small>Codice di accesso</small><input type="password" name="key" value="${esc(cfg.key || '')}" required autocomplete="off"></label>
      <details class="adv"><summary>Indirizzo dello script (avanzate)</summary><label class="fld"><small>https://script.google.com/macros/s/…/exec</small><input type="url" name="url" value="${esc(cfg.url || SCRIPT_URL)}"></label></details>
      <div class="row"><button type="button" class="btn sm" data-prova>Usa in prova (senza Google)</button>${mode() ? '<button type="button" class="btn sm" data-x>Annulla</button>' : ''}<button class="btn primary">Entra</button></div></form>`;
    document.body.appendChild(d);
    const f = d.querySelector('form');
    d.addEventListener('click', async e => {
      if (e.target.closest('[data-x]')) d.remove();
      if (e.target.closest('[data-prova]')) { cfg = { prova: true }; LS.set('fo_cfg', cfg); d.remove(); boot(); }
      if (e.target.closest('[data-out]') && confirm('Scollegare questo browser? I dati restano nel Google Foglio.')) { cfg = {}; LS.set('fo_cfg', cfg); DOCS = new Map(); d.remove(); boot(); }
      if (e.target.closest('[data-copy]')) { const i = d.querySelector('.invite input'); try { await navigator.clipboard.writeText(i.value); toast('Link di invito copiato: incollalo in un messaggio al collega'); } catch { i.select(); document.execCommand('copy'); toast('Link di invito copiato'); } }
    });
    if (!on) f.addEventListener('submit', async e => {
      e.preventDefault(); const url = (f.url.value || SCRIPT_URL).trim(), key = f.key.value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return toast('L\'indirizzo deve essere quello dell\'app web: https://script.google.com/macros/s/…/exec');
      const old = cfg; cfg = { url, key };
      try { busy('Controllo il collegamento…'); await post('ping'); LS.set('fo_cfg', cfg); d.remove(); boot(); }
      catch (err) { cfg = old; toast('Accesso non riuscito: ' + err.message); }
      finally { busy(); }
    });
  }
  async function boot() {
    if (!mode()) { render(); return setup(); }
    try { busy('Carico i dati…'); DOCS = new Map((await Store.load()).filter(d => d && d.id && Array.isArray(d.righe)).map(d => [d.id, d])); }
    catch (e) { toast('Dati non caricati: ' + e.message); }
    finally { busy(); }
    render();
    refreshAll(false);
  }

  /* ---------- eventi ---------- */
  document.addEventListener('click', e => {
    const b = s => e.target.closest(s); let x;
    if (b('#up') || b('[data-up]')) return $('#file').click();
    if (b('#mode')) return setup();
    if ((x = b('[data-tab]'))) { V.anim = x.dataset.tab === 'pan' && (V.tab !== 'pan' || !!V.open); V.tab = x.dataset.tab; V.open = ''; V.fst = ''; V.lim = 50; return render(); }
    if ((x = b('[data-go]'))) { const [t, f] = x.dataset.go.split(':'); V.tab = t; V.fst = f; V.fpz = ''; V.open = ''; V.q = ''; return render(); }
    if ((x = b('[data-mpz]'))) { V.tab = 'ord'; V.fpz = x.dataset.mpz; V.fst = ''; V.open = ''; return render(); }
    if ((x = b('[data-pz]'))) { V.tab = 'ord'; V.fpz = x.dataset.pz; V.fst = 'aperti'; V.open = ''; return render(); }
    if ((x = b('[data-open]'))) { V.open = x.dataset.open; window.scrollTo(0, 0); return render(); }
    if (b('[data-back]')) { V.anim = V.tab === 'pan'; V.open = ''; return render(); }
    if ((x = b('[data-fst]'))) { V.fst = x.dataset.fst; V.lim = 50; return render(); }
    if ((x = b('[data-fpz]'))) { V.fpz = x.dataset.fpz; V.lim = 50; return render(); }
    if (b('[data-more]')) { V.lim += 100; return render(); }
    if ((x = b('[data-st]'))) {
      const o = DOCS.get(V.open); if (!o || o.stato === x.dataset.st) return; const n = clone(o), st = x.dataset.st;
      n.stato = st; n.mov = [...(n.mov || []), { d: today(), st, n: st === 'consegnato' ? 'Merce consegnata al piazzale' : st === 'spedito' ? 'Merce in consegna' : st === 'annullato' ? 'Ordine annullato' : 'Riportato a confermato' }];
      return save([n], 'Stato aggiornato');
    }
    if ((x = b('[data-note]'))) { const i = $('#note'), v = i && i.value.trim(), o = DOCS.get(x.dataset.note); if (!o || !v) return; const n = clone(o); n.mov = [...(n.mov || []), { d: today(), st: '', n: v }]; return save([n], 'Nota aggiunta'); }
    if ((x = b('[data-tkadd]'))) {
      const box = x.closest('[data-tku]'), [k, id] = x.dataset.tkadd.split(':'), doc = DOCS.get(id); if (!doc || !box) return;
      const st = box.querySelector('[name=st]').value, d = box.querySelector('[name=d]').value || today(), luogo = box.querySelector('[name=luogo]').value.trim(), eta = box.querySelector('[name=eta]').value, lk = (box.closest('.tkp').querySelector('[data-trk]') || { value: '' }).value.trim();
      if (lk && !okUrl(lk)) return toast('Il link deve iniziare con https://');
      if (st === 'nota' && !luogo) return toast('Scrivi la nota nel campo «Dove / dettaglio»');
      const n = clone(doc); n.track = lk || n.track || ''; n.trk = n.trk || { ev: [] }; n.trk.ev = n.trk.ev || []; n.trk.eta = eta;
      n.trk.ev.push({ id: Date.now().toString(36), d, st, luogo: st === 'nota' ? '' : luogo, n: st === 'nota' ? luogo : '' });
      const lbl = st === 'nota' ? 'Nota spedizione: ' + luogo : st === 'problema' ? 'Problema sulla spedizione' + (luogo ? ' · ' + luogo : '') : 'Spedizione: ' + (TS.find(t => t[0] === st) || ['', st])[1] + (luogo ? ' · ' + luogo : '');
      const out = [n], o = k === 'd' ? (ordOf(n) ? clone(ordOf(n)) : null) : n;
      if (o) {
        o.mov = [...(o.mov || []), { d, st: '', n: lbl + (k === 'd' ? ' (DDT ' + n.num + ')' : '') }];
        // consegnato: se tutta la merce è spedita e tutti i DDT sono arrivati, l'ordine passa a «Consegnato»
        const all = k === 'd' ? ddtsOf(o).map(z => z.id === n.id ? n : z) : [];
        if (TSK.indexOf(st) >= 0 && st !== 'consegnato' && o.stato === 'confermato') { o.stato = 'spedito'; o.mov.push({ d, st: 'spedito', n: 'Merce in consegna' }); }
        if (st === 'consegnato' && open(o) && (k === 'o' || (shipSt(o) === 'tutto' && all.every(z => tkIdx(z) === 4)))) { o.stato = 'consegnato'; o.mov.push({ d, st: 'consegnato', n: 'Merce consegnata al piazzale' }); }
        if (o !== n) out.push(o);
      }
      return save(out, 'Aggiornamento registrato');
    }
    if ((x = b('[data-tkref]'))) { const id = x.dataset.tkref.split(':')[1], d = DOCS.get(id); if (d && d.track) pasteLink(d.track, d); return; }
    if (b('#paste') || b('[data-paste]')) return pasteDlg();
    if ((x = b('[data-tkdel]'))) {
      const [k, id, ev] = x.dataset.tkdel.split(':'), doc = DOCS.get(id); if (!doc || !confirm('Togliere questo aggiornamento della spedizione?')) return;
      const n = clone(doc); n.trk.ev = (n.trk.ev || []).filter(e => e.id !== ev); return save([n], 'Aggiornamento tolto');
    }
    if ((x = b('[data-del]'))) {
      const d = DOCS.get(x.dataset.del); if (!d || !confirm(`Eliminare ${d.tipo === 'ddt' ? 'il DDT' : 'la conferma d\'ordine'} ${d.num}? Il PDF resta su Drive.`)) return;
      DOCS.delete(d.id); V.open = ''; render(); Store.del(d.id).then(() => toast('Eliminato'), err => toast('Non eliminato dal Google Foglio: ' + err.message));
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'file') { const fs = [...t.files]; t.value = ''; if (fs.length) load(fs); return; }
    if (t.dataset.pzsel) { const o = DOCS.get(t.dataset.pzsel); if (!o) return; const n = clone(o); n.pzMan = t.value === o.pz ? '' : t.value; n.mov = [...(n.mov || []), { d: today(), st: '', n: `Piazzale impostato: ${t.value}` }]; return save([n], 'Piazzale aggiornato'); }
    if (t.dataset.trk) {
      const [k, id] = t.dataset.trk.split(':'), v = t.value.trim(), x = DOCS.get(id);
      if (v && !okUrl(v)) return toast('Il link deve iniziare con https://');
      if (!x || (x.track || '') === v) return;
      if (v && mode() === 'google') return pasteLink(v, x);
      const n = clone(x); n.track = v; const out = [n], o = k === 'd' ? ordOf(n) : n, msg = `${v ? 'Link di tracciamento inserito' : 'Link di tracciamento tolto'}${k === 'd' ? ' · DDT ' + n.num : ''}`;
      if (o === n) n.mov = [...(n.mov || []), { d: today(), st: '', n: msg }];
      else if (o) { const m = clone(o); m.mov = [...(m.mov || []), { d: today(), st: '', n: msg }]; out.push(m); }
      return save(out, v ? 'Link di tracciamento salvato' : 'Link di tracciamento tolto', !!t.closest('[data-tku]'));
    }
  });
  let qT;
  document.addEventListener('input', e => { if (e.target.id !== 'q') return; V.q = e.target.value; if (V.tab === 'pan' && V.q) V.tab = 'ord'; V.open = ''; V.lim = 50; clearTimeout(qT); qT = setTimeout(render, 120); });
  // trascina e rilascia i PDF: un riquadro a tutto schermo mostra dove rilasciarli
  const dz = document.createElement('div'); dz.className = 'dropzone'; dz.setAttribute('aria-hidden', 'true');
  dz.innerHTML = `<div class="dz-in"><div class="dz-ic"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 14v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4"/></svg></div><b>Rilascia qui i PDF</b><span class="dz-n">Conferme d'ordine e DDT Fischer, anche più file insieme o uno zip</span></div>`;
  document.body.appendChild(dz);
  let dc = 0;
  const hasFiles = e => [...(e.dataTransfer && e.dataTransfer.types || [])].includes('Files');
  const dzOff = () => { dc = 0; document.body.classList.remove('dragging'); };
  document.addEventListener('dragenter', e => {
    if (!hasFiles(e)) return; dc++; document.body.classList.add('dragging');
    const n = e.dataTransfer.items ? [...e.dataTransfer.items].filter(x => x.kind === 'file').length : 0;
    dz.querySelector('.dz-n').textContent = n > 1 ? `${n} file pronti da caricare` : n === 1 ? '1 file pronto da caricare' : "Conferme d'ordine e DDT Fischer, anche più file insieme o uno zip";
  });
  document.addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--dc <= 0) dzOff(); });
  document.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  document.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); dzOff(); const fs = [...(e.dataTransfer.files || [])].filter(f => /\.(pdf|zip)$/i.test(f.name) || /pdf|zip/.test(f.type)); if (fs.length) load(fs); else toast('Si possono caricare solo PDF o zip'); });
  addEventListener('blur', dzOff); document.addEventListener('keydown', e => { if (e.key === 'Escape') dzOff(); });

  window.FO = { docs: () => DOCS, checksO, checksD };
  boot();
})();
