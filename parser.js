/* Lettura dei PDF Fischer: conferme d'ordine e DDT (testo con posizioni tramite pdf.js).
   Uso: await FP.read(Uint8Array) → { tipo: 'ordine' | 'ddt', doc }; await FP.unzip(File) → File[] dei PDF contenuti. */
(() => {
  'use strict';
  const N = s => { s = String(s == null ? '' : s).trim(); if (!s) return 0; const neg = /-$/.test(s) || /^-/.test(s); const v = parseFloat(s.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')); return isNaN(v) ? 0 : (neg ? -v : v); };
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const dIso = s => { const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
  const title = s => { s = String(s || '').trim(); return s && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'(-])([a-zà-ù])/g, (m, a, b) => a + b.toUpperCase()) : s; };
  const same = (a, b) => Math.abs(a - b) <= 0.02;

  async function extract(u8) {
    if (!window.pdfjsLib) throw new Error('lettore PDF non caricato');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib-pdfjs-worker.js';
    const pdf = await pdfjsLib.getDocument({ data: u8.slice() }).promise, items = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      tc.items.forEach(i => { if (String(i.str).trim()) items.push({ p, x: i.transform[4], y: i.transform[5], w: i.width || 0, s: String(i.str) }); });
    }
    return items;
  }
  // righe di testo ricostruite dalle posizioni (dall'alto in basso, da sinistra a destra)
  function lines(items, keep) {
    const out = [];
    [...new Set(items.map(i => i.p))].sort((a, b) => a - b).forEach(p => {
      let cur = null;
      items.filter(i => i.p === p && (!keep || keep(i))).sort((a, b) => b.y - a.y || a.x - b.x).forEach(i => {
        if (cur && Math.abs(cur.y - i.y) <= 2.5) cur.it.push(i); else { cur = { p, y: i.y, it: [i] }; out.push(cur); }
      });
    });
    out.forEach(l => {
      l.it.sort((a, b) => a.x - b.x);
      let t = '', end = null;
      l.it.forEach(i => { t += (end != null && i.x - end < 0.8 ? '' : ' ') + i.s; end = i.x + i.w; });
      l.t = t.replace(/\s+/g, ' ').trim();
    });
    return out.filter(l => l.t);
  }
  const ROW = /^(\d{8})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s+([A-Z]{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d+)\s+([A-Z]{2})\s+(?:(\d{1,2}(?:,\d+)?(?:\s*\/\s*\d{1,2}(?:,\d+)?)*)\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,2})$/;
  // sconti in cascata («45,0/ 6,0» = 45% poi 6%) → sconto effettivo
  const scontoEff = s => { if (!s) return 0; const L = s.split('/').map(x => N(x)); return Math.round((1 - L.reduce((a, p) => a * (1 - p / 100), 1)) * 1e4) / 100; };

  // items = testo del PDF con posizioni → ordine (senza stato e piazzale collegato)
  function parse(items) {
    const all = lines(items), txt = all.map(l => l.t).join('\n');
    if (!/Conferma\s+D.ordine/i.test(txt) || !/fischer/i.test(txt)) throw new Error('non sembra una conferma d\'ordine Fischer');
    const o = { righe: [], dest: {} };
    const left = lines(items, i => i.p === 1 && i.x < 290);
    const g = (re, from) => { for (const l of from || left) { const m = re.exec(l.t); if (m) return m; } return null; };
    let m;
    if ((m = g(/^Data\s+(\d{2}\.\d{2}\.\d{4})/))) o.data = dIso(m[1]);
    if ((m = g(/Numero di cliente\s+(\d+)/))) o.cliente = m[1];
    if ((m = g(/Numero d.ordine\s+(\d+)/))) o.num = m[1];
    if (!o.num) throw new Error('numero d\'ordine non trovato');
    // destinazione della merce: righe sotto «Destinazione merce» fino a «Contatto»
    const i0 = left.findIndex(l => /^Destinazione merce/i.test(l.t)), D = [];
    if (i0 >= 0) for (let k = i0 + 1; k < left.length && !/^Contatto/i.test(left[k].t); k++) D.push(left[k].t);
    if (!D.length) throw new Error('destinazione della merce non trovata');
    const last = D[D.length - 1], cm = /^(\d{5,6})\s+(.+?)\s+([A-Z]{2})$/.exec(last);
    if (cm) { o.dest.cap = cm[1]; o.dest.citta = title(cm[2]); o.dest.prov = cm[3]; D.pop(); }
    o.dest.rs = title(D[0] || '');
    const mg = D.slice(1).find(t => /^\(?\s*(magazzino|mag\.?)\s+/i.test(t));
    if (mg) { o.dest.mag = title(mg.replace(/^\(?\s*(magazzino|mag\.?)\s+/i, '').replace(/\)\s*$/, '').trim()); }
    o.dest.via = title(D.slice(1).filter(t => t !== mg).join(', '));
    o.pz = o.dest.mag || o.dest.citta || o.dest.rs;
    // testata e righe
    let r = null;
    all.forEach(l => {
      const t = l.t;
      if ((m = /Peso totale:?\s*([\d.,]+)\s*KG/i.exec(t))) o.peso = N(m[1]);
      if ((m = /Magazzino:\s*(.+?)(?:\s+Peso|$)/i.exec(t))) o.magForn = m[1].trim();
      if ((m = /Condizioni Pagamento\s*:?\s*(.+)$/i.exec(t))) o.pagamento = m[1].trim();
      if ((m = /Spediz\.\/Corriere\s+(.+)$/i.exec(t))) o.corriere = m[1].trim();
      if ((m = /Porto\s*\/\s*Resa\s+(.+)$/i.exec(t))) o.porto = m[1].trim();
      if ((m = ROW.exec(t))) { r = { cod: m[1], desc: m[2].trim().replace(/(\d)(con\b)/gi, '$1 $2').replace(/\.$/, ''), ean: '', q: N(m[3]), um: m[4], prezzo: N(m[5]), per: N(m[6]), umPrezzo: m[7], sconto: scontoEff(m[8]), scontoTxt: m[8] ? m[8].split('/').map(x => x.trim().replace(/,0+$/, '')).join(' + ') + '%' : '', importo: N(m[9]), iva: Number(m[10]), consegna: '' }; o.righe.push(r); return; }
      if (r && /^\d{13}$/.test(t)) { r.ean = t; return; }
      // descrizione che continua sulla riga sotto (prima del codice EAN)
      if (r && !r.ean && !r.consegna && t.length < 60 && !/^(Data presunta|Importo|_{3,}|Sconto|IVA|Totale)/i.test(t) && !/\d{1,3}(?:\.\d{3})*,\d{2}\s+\d{1,2}$/.test(t)) { r.desc += ' ' + t.trim(); return; }
      if (r && (m = /Data presunta consegna il\s+(\d{2}\.\d{2}\.\d{4})/i.exec(t))) { r.consegna = dIso(m[1]); return; }
      if ((m = /^Importo totale EUR\s+([\d.,]+)/i.exec(t))) o.importoRighe = N(m[1]);
      else if ((m = /^Sconto di testata\(%\)\s+([\d.,]+)-?\s*%\s+([\d.,]+)/i.exec(t))) { o.scontoPct = N(m[1]); o.scontoImp = N(m[2]); }
      else if ((m = /^Spese di spedizione\s+([\d.,]+)/i.exec(t))) o.spese = N(m[1]);
      else if ((m = /^IVA Vend\.?\s+(\d+)\s*%\s+([\d.,]+)\s*%\s+imponibile:\s*([\d.,]+)\s+([\d.,]+)/i.exec(t))) { o.ivaPct = N(m[2]); o.imponibile = N(m[3]); o.iva = N(m[4]); }
      else if ((m = /^Totale ordine EUR\s+([\d.,]+)/i.exec(t))) o.totale = N(m[1]);
    });
    if (!o.righe.length) throw new Error('nessuna riga articolo trovata');
    o.scontoPct = o.scontoPct || 0; o.scontoImp = o.scontoImp || 0; o.spese = o.spese || 0;
    if (o.importoRighe == null) o.importoRighe = r2(o.righe.reduce((s, x) => s + x.importo, 0));
    o.id = 'o' + o.num;
    return o;
  }
  const isDdt = txt => /Documento di Trasporto/i.test(txt) && /fischer/i.test(txt) && /\bDDT:\s*\d+/i.test(txt);
  const QTY = /^\d{1,3}(?:\.\d{3})*(?:,\d+)?$/;
  function parseDdt(items) {
    const all = lines(items), txt = all.map(l => l.t).join('\n');
    if (!isDdt(txt)) throw new Error('non sembra un DDT Fischer');
    const d = { righe: [], dest: {}, colliN: [] };
    const left = lines(items, i => i.p === 1 && i.x < 290), right = lines(items, i => i.p === 1 && i.x >= 290);
    const g = (re, from) => { for (const l of from) { const m = re.exec(l.t); if (m) return m; } return null; };
    let m;
    if ((m = g(/^Data:\s*(\d{2}\.\d{2}\.\d{4})/i, left))) d.data = dIso(m[1]);
    if ((m = g(/Numero di Cliente:\s*(\d+)/i, left))) d.cliente = m[1];
    if ((m = g(/^Consegna:\s*(\d+)/i, left))) d.consegna = m[1];
    if ((m = g(/^DDT:\s*(\d+)/i, left))) d.num = m[1];
    if (!d.num) throw new Error('numero del DDT non trovato');
    if ((m = g(/No\.?\s*ordine\s+(\d+)(?:\s+(\d{2}\.\d{2}\.\d{4}))?/i, all))) { d.ord = m[1]; d.ordData = dIso(m[2] || ''); }
    if ((m = g(/No\.?\s*ord\.? d.acquisto\s+(.+)$/i, right))) d.ordAcq = m[1].trim();
    if ((m = g(/Peso totale:?\s*([\d.,]+)\s*KG/i, all))) d.peso = N(m[1]);
    if ((m = g(/^Colli\s+(\d+)/i, left))) d.colli = +m[1];
    if ((m = g(/^Corriere\s+(.+)$/i, right))) d.corriere = m[1].trim();
    if ((m = g(/^Magazzino\s+(.*(?:fiit|Warehouse).*)$/i, right))) d.magForn = m[1].trim();
    if ((m = g(/^Porto\s*\/?\s*Resa\s+(.+)$/i, all))) d.porto = m[1].trim();
    if ((m = g(/^Causale del trasporto\s+(.+)$/i, all))) d.causale = m[1].trim();
    if ((m = /SEGNACOLL[OI]:?\s*([\d,;\s]+)/i.exec(txt))) d.colliN = m[1].split(/[,;\s]+/).filter(s => /^\d{6,}$/.test(s));
    const nt = all.find(l => /^CONSEGNARE\b/i.test(l.t)); if (nt) d.istr = nt.t;
    // destinatario: colonna di destra sotto «Destinatario Merce», fino ad «Agente»
    const i0 = right.findIndex(l => /Destinatario Merce/i.test(l.t)), D = [];
    if (i0 >= 0) for (let k = i0 + 1; k < right.length && !/^(Agente|No\.|Corriere|Magazzino\s+fiit)/i.test(right[k].t); k++) if (!/^Spett\.?\s*le$/i.test(right[k].t)) D.push(right[k].t);
    const last = D[D.length - 1], cm = last && /^(\d{5,6})\s+(.+?)\s+([A-Z]{2})$/.exec(last);
    if (cm) { d.dest.cap = cm[1]; d.dest.citta = title(cm[2]); d.dest.prov = cm[3]; D.pop(); }
    d.dest.rs = title(D[0] || '');
    const mg = D.slice(1).find(t => /^\(?\s*(magazzino|mag\.?)\s+/i.test(t));
    if (mg) d.dest.mag = title(mg.replace(/^\(?\s*(magazzino|mag\.?)\s+/i, '').replace(/\)\s*$/, '').trim());
    d.dest.via = title(D.slice(1).filter(t => t !== mg).join(', '));
    d.pz = d.dest.mag || d.dest.citta || d.dest.rs;
    // righe: la colonna «Qta. res» (residuo) si separa dalla descrizione per posizione
    let resX = null, r = null;
    all.forEach(l => {
      if (/COD\.?\s*ART/i.test(l.t)) { const h = l.it.find(i => /Qta/i.test(i.s)); resX = h ? h.x : null; r = null; return; }
      if (/^\d{8}\s/.test(l.t)) {
        let a = l.t, tk;
        if (resX != null) { a = l.it.filter(i => i.x < resX - 4).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim(); tk = l.it.filter(i => i.x >= resX - 4).map(i => i.s).join(' ').trim().split(/\s+/).filter(Boolean); }
        else { const mm = /^(.+?)\s+(\S+)\s+([A-Z]{2})$/.exec(l.t); if (!mm) return; a = mm[1]; tk = [mm[2], mm[3]]; }
        const um = tk[tk.length - 1], q = tk[tk.length - 2], res = tk.length >= 3 ? tk[tk.length - 3] : '';
        const mm = /^(\d{8})\s+(.+)$/.exec(a);
        if (!mm || !/^[A-Z]{2}$/.test(um || '') || !QTY.test(q || '')) return;
        r = { cod: mm[1], desc: mm[2].trim().replace(/(\d)(con\b)/gi, '$1 $2').replace(/\.$/, ''), ean: '', q: N(q), um, res: QTY.test(res) ? N(res) : null };
        d.righe.push(r); return;
      }
      if (r && /^\d{13}$/.test(l.t)) { r.ean = l.t; r = null; }
    });
    if (!d.righe.length) throw new Error('nessuna riga articolo trovata nel DDT');
    d.id = 'd' + d.num;
    return d;
  }
  async function unzip(file) {
    const buf = await file.arrayBuffer(), dv = new DataView(buf), u8 = new Uint8Array(buf), out = [];
    let e = -1; for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('zip non valido');
    let n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true);
    for (; n > 0 && dv.getUint32(p, true) === 0x02014b50; n--) {
      const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      if (!/\.pdf$/i.test(name) || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
      const ds = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), raw = u8.subarray(ds, ds + csz);
      let data;
      if (meth === 0) data = raw; else if (meth === 8 && window.DecompressionStream) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); else throw new Error('compressione dello zip non supportata: estrai i PDF e caricali');
      out.push(new File([data], name.split('/').pop(), { type: 'application/pdf' }));
    }
    return out;
  }


  // piazzale: il magazzino indicato nella destinazione (es. «magazzino Corropoli»), altrimenti la provincia
  const PROV_PZ = { RM: 'San Cesareo', TO: 'Torino', VE: 'Venezia', VR: 'Verona', MI: 'Gorgonzola', RA: 'Ravenna', RN: 'Rimini', BO: 'Bologna', PI: 'Pisa', TE: 'Corropoli', PE: 'Pescara' };
  const pzOf = d => (d && (d.mag || PROV_PZ[String(d.prov || '').toUpperCase()] || d.citta || d.rs)) || '';
  const isConf = txt => /Conferma\s+D.ordine/i.test(txt) && /fischer/i.test(txt);
  // legge un PDF e dice che cos'è: { tipo: 'ordine' | 'ddt', doc }
  async function read(u8) {
    const items = await extract(u8), txt = lines(items).map(l => l.t).join('\n');
    if (isDdt(txt)) { const d = parseDdt(items); d.pz = pzOf(d.dest); return { tipo: 'ddt', doc: d }; }
    if (isConf(txt)) { const o = parse(items); o.pz = pzOf(o.dest); return { tipo: 'ordine', doc: o }; }
    if (/Cedente\/prestatore/i.test(txt)) throw new Error('è una fattura: qui si caricano solo conferme d\'ordine e DDT');
    throw new Error('non è una conferma d\'ordine né un DDT Fischer');
  }

  window.FP = { read, unzip, parse, parseDdt, extract, lines, pzOf };
})();
