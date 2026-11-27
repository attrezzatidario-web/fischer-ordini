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
  let cfg = LS.get('fo_cfg', {});   // { url, key } oppure { prova: true }
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
      return { 'Ordine': d.num, 'Data': d.data, 'Piazzale': pzName(d), 'Destinatario': d.dest.rs, 'Città': [d.dest.citta, d.dest.prov].filter(Boolean).join(' '), 'Stato': stLabel(d), 'Articoli': d.righe.map(x => `${x.cod} ${x.desc} × ${x.q}`).join(' | '), 'Pezzi ordinati': d.righe.reduce((s, x) => s + x.q, 0), 'Pezzi spediti': [...sh.values()].reduce((s, q) => s + q, 0), 'Consegna prevista': nextDel(d), 'Imponibile': d.imponibile, 'Totale': d.totale, 'DDT': L.map(x => x.num).join(', '), 'Tracciamento': trkOf(d), 'PDF': d.pdf || '' };
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
    if (tkProb(d)) A.push({ t: 'warn', h: 'Problema sulla spedizione', d: `${dt(tkProb(d).d)}${tkProb(d).luogo ? ' · ' + tkProb(d).luogo : ''}${tkProb(d).n ? ' · ' + tkProb(d).n : ''}` });
    if (!d.track && tkIdx(d) < 4) A.push({ t: 'info', h: 'Link di tracciamento da inserire', d: 'Incolla il link del corriere (es. Shippeo) nel campo Tracciamento.' });
    return A;
  }

  /* ---------- stato della pagina ---------- */
  const V = { tab: 'pan', open: '', q: '', fst: '', fpz: '', lim: 50 };

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
    const i = tkIdx(x), last = tkLast(x), pb = tkProb(x), eta = x.trk && x.trk.eta, plat = platOf(x.track), carr = x.tipo === 'ddt' ? carrier(x.corriere) : '';
    const E = tkEv(x).slice().reverse();
    const head = `<div class="tkh"><div class="tkc"><div class="tkb">${plat ? `<span class="carr">${esc(plat)}</span>` : ''}${carr && carr !== plat ? `<span class="carr alt">${esc(carr)}</span>` : ''}${x.tipo === 'ddt' ? `<span class="muted small">DDT ${esc(x.num)}${x.consegna ? ' · consegna Fischer ' + esc(x.consegna) : ''}</span>` : ''}</div>
        <b class="tks${pb ? ' bad' : i === 4 ? ' ok' : ''}">${pb ? 'Problema segnalato' : i < 0 ? (x.track ? 'In attesa del primo aggiornamento' : 'Nessun tracciamento') : esc(TS[i][2])}</b>
        <small class="muted">${last ? `Ultimo aggiornamento ${esc(dt(last.d))}${last.luogo ? ' · ' + esc(last.luogo) : ''}` : x.track ? 'Apri il tracciamento e registra lo stato che vedi' : 'Incolla il link del corriere per seguire la spedizione'}</small></div>
      <div class="tkr">${eta ? `<div class="eta"><small>Consegna prevista</small><b>${esc(dt(eta))}</b></div>` : ''}${x.track ? `<a class="btn primary" href="${esc(x.track)}" target="_blank" rel="noopener noreferrer">Apri tracciamento ↗</a>` : ''}</div></div>`;
    if (opts.compact) return `<div class="tkp compact">${head}${stepper(x)}</div>`;
    const id = `${k}:${esc(x.id)}`;
    return `<div class="tkp">${head}${stepper(x)}
      ${pb ? `<div class="ck warn" style="margin-top:12px"><i>!</i><div><b>Problema segnalato il ${esc(dt(pb.d))}</b><span>${esc([pb.luogo, pb.n].filter(Boolean).join(' · ') || 'nessun dettaglio')}</span></div></div>` : ''}
      <div class="tku" data-tku="${id}">
        <label class="fld lk"><small>Link di tracciamento</small><input type="url" data-trk="${id}" value="${esc(x.track || '')}" placeholder="Incolla qui il link del corriere (es. Shippeo)" autocomplete="off"></label>
        <label class="fld"><small>Stato</small><select name="st">${TS.map((t, n) => `<option value="${t[0]}"${n === Math.min(4, Math.max(0, i + 1)) ? ' selected' : ''}>${t[1]}</option>`).join('')}<option value="problema">Problema / giacenza</option><option value="nota">Solo nota</option></select></label>
        <label class="fld"><small>Data</small><input type="date" name="d" value="${today()}"></label>
        <label class="fld"><small>Dove / dettaglio</small><input type="text" name="luogo" placeholder="es. Hub Teramo" autocomplete="off"></label>
        <label class="fld"><small>Consegna prevista</small><input type="date" name="eta" value="${esc(eta || '')}"></label>
        <button type="button" class="btn primary" data-tkadd="${id}">Registra aggiornamento</button>
      </div>
      ${E.length ? `<div class="tkev">${E.map(e => `<div class="${e.st === 'problema' ? 'bad' : ''}"><i></i><span><b>${esc(e.st === 'nota' ? 'Nota' : e.st === 'problema' ? 'Problema / giacenza' : (TS.find(t => t[0] === e.st) || ['', e.st])[1])}${e.luogo ? ' · ' + esc(e.luogo) : ''}</b><small>${esc(dt(e.d))}${e.n ? ' · ' + esc(e.n) : ''}</small></span><button type="button" class="x" data-tkdel="${id}:${esc(e.id)}" title="Togli questo aggiornamento">×</button></div>`).join('')}</div>` : ''}
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
    const O = orders(), D = ddts(), act = O.filter(open);
    if (!O.length && !D.length) return `<div class="card"><div class="empty" style="padding:50px 10px"><b style="font-size:16px;color:var(--ink)">Nessun documento ancora</b><br>Carica le conferme d'ordine e i DDT di Fischer in PDF (anche più file insieme, o uno zip).<br>Vengono letti, controllati e collegati tra loro in automatico.<br><br><button type="button" class="btn primary" data-up>+ Carica PDF</button></div></div>`;
    const inCons = act.filter(o => o.stato === 'spedito'), lt = act.filter(late), part = act.filter(o => shipSt(o) === 'parte'), dx = D.filter(d => !ordOf(d)), notrk = D.filter(d => !d.track && tkIdx(d) < 4 && (!ordOf(d) || open(ordOf(d))));
    const k = (cls, l, n, s, go) => `<button type="button" class="kpi ${cls}" data-go="${go}"><small>${l}</small><b>${n}</b><span>${s}</span></button>`;
    const kp = `<div class="kpis">
      ${k('', 'Ordini aperti', num(act.length), eur(r2(act.reduce((s, o) => s + (o.imponibile || 0), 0))) + ' imponibile', 'ord:aperti')}
      ${k('', 'In consegna', num(inCons.length), 'merce partita', 'ord:spedito')}
      ${k(part.length ? 'warn' : 'good', 'Spediti in parte', num(part.length), part.length ? 'manca ancora merce' : 'nessuno', 'ord:parte')}
      ${k(lt.length ? 'bad' : 'good', 'In ritardo', num(lt.length), lt.length ? 'oltre la data prevista' : 'nessuno', 'ord:ritardo')}
      ${k(dx.length ? 'warn' : 'good', 'DDT senza conferma', num(dx.length), dx.length ? 'carica la conferma' : 'tutti collegati', 'ddt:senza')}
      ${k(notrk.length ? 'warn' : 'good', 'Senza tracciamento', num(notrk.length), notrk.length ? 'DDT ancora in viaggio' : 'tutti con link', 'ddt:notrk')}
    </div>`;
    // per piazzale
    const P = new Map();
    O.forEach(o => { const n = pzName(o); if (!P.has(n)) P.set(n, { n, a: 0, pz: 0, imp: 0, last: '', lt: 0 }); const p = P.get(n); if (open(o)) { p.a++; p.imp += o.imponibile || 0; p.pz += shortOf(o, shipped(o)).reduce((s, x) => s + x.r, 0); if (late(o)) p.lt++; } });
    D.forEach(d => { const n = pzOfD(d); if (!P.has(n)) P.set(n, { n, a: 0, pz: 0, imp: 0, last: '', lt: 0 }); const p = P.get(n); if (String(d.data) > p.last) p.last = d.data; });
    const trav = [...D.filter(d => tkIdx(d) < 4 && (!ordOf(d) || open(ordOf(d)))), ...act.filter(o => !ddtsOf(o).length && o.track && tkIdx(o) < 4)].sort((a, b) => String((a.trk && a.trk.eta) || '9').localeCompare(String((b.trk && b.trk.eta) || '9')));
    const pzs = [...P.values()].sort((a, b) => b.a - a.a || a.n.localeCompare(b.n, 'it'));
    const todo = [];
    act.forEach(o => checksO(o).filter(c => c.t === 'warn').forEach(c => todo.push({ id: o.id, h: `Ordine ${o.num} · ${pzName(o)}`, c })));
    D.forEach(d => checksD(d).filter(c => c.t === 'warn').forEach(c => todo.push({ id: d.id, h: `DDT ${d.num} · ${pzOfD(d)}`, c })));
    return `${kp}<div class="grid2"><div>
      <div class="card"><div class="card-h"><h3>Piazzali</h3><span class="muted small">${plur(pzs.length, 'piazzale', 'piazzali')}</span></div><div class="pzs">${pzs.map(p => `<button type="button" class="pz" data-pz="${esc(p.n)}"><h4>${esc(p.n)}${p.lt ? '<span class="chip late">ritardo</span>' : p.a ? '<span class="chip blue">aperti</span>' : '<span class="chip ok">ok</span>'}</h4><dl><dt>Ordini aperti</dt><dd>${num(p.a)}</dd><dt>Pezzi da ricevere</dt><dd>${num(p.pz)}</dd><dt>Ultimo DDT</dt><dd>${p.last ? dt(p.last) : '—'}</dd></dl></button>`).join('')}</div></div>
      <div class="card"><div class="card-h"><h3>Spedizioni in viaggio</h3><button type="button" class="btn sm" data-go="ddt:viaggio">Tutte</button></div>${trav.length ? trav.slice(0, 5).map(x => `<button type="button" class="trv" data-open="${esc(x.id)}"><div class="trv-h"><b>${esc(x.tipo === 'ddt' ? 'DDT ' + x.num : 'Ordine ' + x.num)} · ${esc(x.tipo === 'ddt' ? pzOfD(x) : pzName(x))}</b><span>${x.trk && x.trk.eta ? 'prevista ' + esc(dt(x.trk.eta)) : ''}</span></div>${stepper(x)}</button>`).join('') : '<div class="empty">Nessuna spedizione in viaggio</div>'}</div>
      <div class="card"><div class="card-h"><h3>Ultimi DDT</h3><button type="button" class="btn sm" data-go="ddt:">Tutti</button></div><div class="ol">${D.slice(0, 5).map(rowD).join('') || '<div class="empty">Nessun DDT caricato</div>'}</div></div>
    </div><div>
      <div class="card"><div class="card-h"><h3>Da controllare</h3><span class="muted small">${todo.length ? plur(todo.length, 'avviso', 'avvisi') : 'tutto in ordine'}</span></div>${todo.slice(0, 30).map(t => `<button type="button" class="todo" data-open="${esc(t.id)}"><i class="${t.c.h === 'In ritardo' ? 'bad' : ''}"></i><div><b>${esc(t.h)}</b><span>${esc(t.c.h)}: ${esc(t.c.d)}</span></div></button>`).join('') || '<div class="empty">Numeri, quantità e collegamenti tornano</div>'}</div>
      <div class="card"><div class="card-h"><h3>Ordini aperti</h3><button type="button" class="btn sm" data-go="ord:aperti">Tutti</button></div><div class="ol">${act.slice(0, 6).map(o => `<button type="button" class="todo" data-open="${esc(o.id)}"><div style="flex:1"><b>${esc(o.num)} · ${esc(pzName(o))}</b><span>${esc(dt(o.data))} · ${esc(stLabel(o))}${shipSt(o) === 'parte' ? ' · spedito in parte' : ''}</span></div>${stChip(o)}</button>`).join('') || '<div class="empty">Nessun ordine aperto</div>'}</div></div>
    </div></div>`;
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
      <div class="card"><div class="card-h"><h3>Articoli e prezzi</h3><span class="muted small">IVA esclusa</span></div><div class="mx-wrap"><table class="mx"><thead><tr><th class="l">Codice</th><th class="l">Descrizione</th><th>Quantità</th><th>Prezzo ogni ${o.righe[0] ? num(o.righe[0].per) : 100}</th><th>Sconto</th><th>Importo</th><th>Consegna prevista</th></tr></thead><tbody>
        ${o.righe.map(x => `<tr><td class="l">${esc(x.cod)}</td><td class="l">${esc(x.desc)}${x.ean ? `<small>EAN ${esc(x.ean)}</small>` : ''}</td><td>${num(x.q)} ${esc(x.um)}</td><td>${eur(x.prezzo)}</td><td>${x.sconto ? num(x.sconto, 2) + '%' : '—'}</td><td><b>${eur(x.importo)}</b></td><td>${x.consegna ? esc(dt(x.consegna)) : '—'}</td></tr>`).join('')}</tbody></table></div>
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

  /* ---------- disegno ---------- */
  function render() {
    const m = mode(), mb = $('#mode');
    mb.className = 'mode' + (m === 'google' ? ' on' : m === 'prova' ? ' prova' : ''); mb.querySelector('span').textContent = m === 'google' ? 'Google Foglio' : m === 'prova' ? 'Prova (solo questo browser)' : 'Non collegato';
    if (V.open && !DOCS.has(V.open)) V.open = '';
    const doc = V.open && DOCS.get(V.open);
    const body = doc ? (doc.tipo === 'ordine' ? orderDetail(doc) : ddtDetail(doc)) : V.tab === 'ord' ? ordersView() : V.tab === 'ddt' ? ddtView() : overview();
    const ae = document.activeElement, keep = ae && ae.id === 'q' ? ae.selectionStart : null;
    $('#app').innerHTML = `<div class="bar"><div class="seg">${[['pan', 'Panoramica'], ['ord', 'Ordini'], ['ddt', 'DDT']].map(([k, l]) => `<button type="button" data-tab="${k}" class="${!doc && V.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="q" type="search" placeholder="Cerca ordine, DDT, piazzale, articolo, segnacollo…" value="${esc(V.q)}" autocomplete="off"></label></div>
      ${!doc && V.tab === 'pan' && DOCS.size ? '<div class="drop" data-up>Trascina qui conferme d\'ordine e DDT in PDF, oppure <b>scegli i file</b></div>' : ''}${body}`;
    if (keep != null) { const i = $('#q'); i.focus(); try { i.setSelectionRange(keep, keep); } catch { } }
  }

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
  async function load(files) {
    if (!mode()) return setup();
    const bad = [], up = []; let nO = 0, nD = 0, nUpd = 0, warn = 0, last = '';
    try {
      busy('Preparo i file…');
      const docs = [];
      for (const f of files) { if (/\.zip$/i.test(f.name) || f.type === 'application/zip') { try { docs.push(...await FP.unzip(f)); } catch (e) { bad.push(`${f.name}: ${e.message}`); } } else docs.push(f); }
      let i = 0;
      for (const f of docs) {
        i++; busy(`Leggo ${i} di ${docs.length}…`);
        try {
          const u8 = new Uint8Array(await f.arrayBuffer()), { tipo, doc } = await FP.read(u8.slice()), ex = DOCS.get(doc.id);
          const d = { ...doc, tipo, nomeFile: f.name, track: ex ? ex.track || '' : '', pdf: ex ? ex.pdf || '' : '', creato: ex ? ex.creato : new Date().toISOString() };
          if (tipo === 'ordine') { d.stato = ex ? ex.stato : 'confermato'; d.mov = ex ? (ex.mov || []) : [{ d: today(), st: 'confermato', n: 'Conferma d\'ordine caricata' }]; if (ex && ex.pzMan) d.pzMan = ex.pzMan; if (ex) d.mov = [...d.mov, { d: today(), st: '', n: 'Conferma ricaricata e aggiornata' }]; }
          if (!d.pdf && mode() === 'google') { busy(`Salvo il PDF ${i} di ${docs.length} su Drive…`); try { d.pdf = await Store.pdf(`Fischer ${tipo === 'ddt' ? 'DDT' : 'ordine'} ${d.num} ${d.data}.pdf`, u8); } catch (e) { bad.push(`${f.name}: PDF non archiviato (${e.message})`); } }
          DOCS.set(d.id, d); up.push(d); last = d.id; ex ? nUpd++ : tipo === 'ddt' ? nD++ : nO++;
          // collegamenti: DDT nuovo → ordine «In consegna»; conferma nuova con DDT già caricati → «In consegna»
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
    const parts = [nO ? plur(nO, 'conferma caricata', 'conferme caricate') : '', nD ? plur(nD, 'DDT caricato', 'DDT caricati') : '', nUpd ? plur(nUpd, 'documento aggiornato', 'documenti aggiornati') : ''].filter(Boolean).join(' · ');
    toast(parts ? `${parts}${warn ? ` · ${warn} da controllare` : ''}${bad.length ? ` · ${bad.length} non letti` : ''}` : `Non letto: ${bad[0] || 'file non valido'}`);
    if (bad.length && parts) setTimeout(() => toast('Problemi: ' + bad.slice(0, 3).join(' | ')), 4300);
  }

  /* ---------- collegamento al Google Foglio ---------- */
  function setup() {
    const d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = `<form><h3>Collegamento al Google Foglio</h3>
      <p>Incolla l'indirizzo dell'app web dello script Google e il codice di accesso (quello scritto nelle proprietà dello script). Si salvano solo in questo browser.</p>
      <label class="fld"><small>Indirizzo dello script (https://script.google.com/macros/s/…/exec)</small><input type="url" name="url" value="${esc(cfg.url || '')}" required></label>
      <label class="fld"><small>Codice di accesso</small><input type="password" name="key" value="${esc(cfg.key || '')}" required autocomplete="off"></label>
      <div class="row"><button type="button" class="btn sm" data-prova>Usa in prova (senza Google)</button>${mode() ? '<button type="button" class="btn sm" data-x>Annulla</button>' : ''}<button class="btn primary">Collega</button></div></form>`;
    document.body.appendChild(d);
    const f = d.querySelector('form');
    d.addEventListener('click', e => { if (e.target.closest('[data-x]')) d.remove(); if (e.target.closest('[data-prova]')) { cfg = { prova: true }; LS.set('fo_cfg', cfg); d.remove(); boot(); } });
    f.addEventListener('submit', async e => {
      e.preventDefault(); const url = f.url.value.trim(), key = f.key.value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return toast('L\'indirizzo deve essere quello dell\'app web: https://script.google.com/macros/s/…/exec');
      const old = cfg; cfg = { url, key };
      try { busy('Controllo il collegamento…'); await post('ping'); LS.set('fo_cfg', cfg); d.remove(); boot(); }
      catch (err) { cfg = old; toast('Collegamento non riuscito: ' + err.message); }
      finally { busy(); }
    });
  }
  async function boot() {
    if (!mode()) { render(); return setup(); }
    try { busy('Carico i dati…'); DOCS = new Map((await Store.load()).filter(d => d && d.id && Array.isArray(d.righe)).map(d => [d.id, d])); }
    catch (e) { toast('Dati non caricati: ' + e.message); }
    finally { busy(); }
    render();
  }

  /* ---------- eventi ---------- */
  document.addEventListener('click', e => {
    const b = s => e.target.closest(s); let x;
    if (b('#up') || b('[data-up]')) return $('#file').click();
    if (b('#mode')) return setup();
    if ((x = b('[data-tab]'))) { V.tab = x.dataset.tab; V.open = ''; V.fst = ''; V.lim = 50; return render(); }
    if ((x = b('[data-go]'))) { const [t, f] = x.dataset.go.split(':'); V.tab = t; V.fst = f; V.fpz = ''; V.open = ''; V.q = ''; return render(); }
    if ((x = b('[data-pz]'))) { V.tab = 'ord'; V.fpz = x.dataset.pz; V.fst = 'aperti'; V.open = ''; return render(); }
    if ((x = b('[data-open]'))) { V.open = x.dataset.open; window.scrollTo(0, 0); return render(); }
    if (b('[data-back]')) { V.open = ''; return render(); }
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
      const st = box.querySelector('[name=st]').value, d = box.querySelector('[name=d]').value || today(), luogo = box.querySelector('[name=luogo]').value.trim(), eta = box.querySelector('[name=eta]').value, lk = box.querySelector('[data-trk]').value.trim();
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
      const n = clone(x); n.track = v; const out = [n], o = k === 'd' ? ordOf(n) : n, msg = `${v ? 'Link di tracciamento inserito' : 'Link di tracciamento tolto'}${k === 'd' ? ' · DDT ' + n.num : ''}`;
      if (o === n) n.mov = [...(n.mov || []), { d: today(), st: '', n: msg }];
      else if (o) { const m = clone(o); m.mov = [...(m.mov || []), { d: today(), st: '', n: msg }]; out.push(m); }
      return save(out, v ? 'Link di tracciamento salvato' : 'Link di tracciamento tolto', !!t.closest('[data-tku]'));
    }
  });
  let qT;
  document.addEventListener('input', e => { if (e.target.id !== 'q') return; V.q = e.target.value; if (V.tab === 'pan' && V.q) V.tab = 'ord'; V.open = ''; V.lim = 50; clearTimeout(qT); qT = setTimeout(render, 120); });
  // trascina e rilascia i PDF
  let dc = 0;
  document.addEventListener('dragenter', e => { if ([...(e.dataTransfer && e.dataTransfer.types || [])].includes('Files')) { dc++; document.body.classList.add('dragging'); } });
  document.addEventListener('dragleave', () => { if (--dc <= 0) { dc = 0; document.body.classList.remove('dragging'); } });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => { e.preventDefault(); dc = 0; document.body.classList.remove('dragging'); const fs = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (fs.length) load(fs); });

  window.FO = { docs: () => DOCS, checksO, checksD };
  boot();
})();
