/* Panoramica: intestazione, numeri chiave, mappa d'Italia con piazzali e spedizioni, grafici, attività.
   Uso: FPAN.html(H) → HTML; FPAN.after(root, anim) dopo il disegno (animazioni, mappa interattiva).
   H = funzioni e dati passati da app.js. */
(() => {
  'use strict';
  const IT_PATH = 'M53.8 55.2L55.6 56.8L57.3 57.0L60.8 55.6L63.5 55.5L67.4 53.1L70.2 53.7L71.5 55.1L75.1 55.6L76.9 53.2L79.2 52.6L80.3 49.3L82.5 48.0L83.0 45.6L81.6 43.2L87.0 39.4L88.0 37.2L90.2 36.5L90.9 36.6L91.4 37.9L91.1 44.2L93.0 45.1L95.5 48.2L97.5 49.2L98.8 48.7L100.9 49.3L101.6 50.2L99.9 53.1L102.6 54.4L103.7 56.7L103.4 58.7L106.0 58.9L107.7 56.1L105.5 53.8L106.4 52.8L106.0 51.1L107.6 50.4L107.8 48.3L111.9 44.4L113.3 40.8L112.3 37.0L113.4 34.9L115.3 34.9L116.1 36.0L117.4 34.8L117.6 39.0L120.1 42.0L123.8 42.2L125.0 40.1L126.3 40.5L130.3 39.4L131.4 39.9L131.8 42.0L133.2 43.3L133.5 44.7L134.4 44.7L136.5 43.2L134.8 40.9L136.1 38.2L133.1 36.7L133.2 33.6L134.9 30.9L137.5 30.3L138.5 30.6L138.5 32.1L140.2 33.0L144.2 33.4L144.5 30.4L142.8 29.8L142.2 28.6L143.7 25.7L143.4 24.1L144.3 21.9L146.3 22.6L149.5 21.9L151.9 23.1L151.5 24.6L155.4 25.4L158.7 25.2L160.2 23.6L161.0 20.5L163.4 18.3L167.1 17.5L169.6 18.1L171.2 16.8L172.7 17.4L176.9 17.3L178.2 18.1L182.6 16.0L190.0 14.0L190.6 14.2L190.5 15.1L188.2 17.2L188.9 19.6L188.5 20.2L192.3 21.7L192.4 24.7L194.2 25.3L195.9 28.0L199.7 29.4L205.0 29.8L207.1 30.9L215.4 31.8L217.7 32.9L224.2 32.5L230.1 34.1L229.5 36.5L227.4 36.8L225.6 38.7L223.1 40.0L221.2 42.3L222.4 45.1L223.1 45.1L222.8 44.4L224.0 44.6L226.4 46.0L228.5 46.2L227.9 48.1L225.0 50.2L223.8 52.3L225.0 53.7L227.6 53.1L228.1 53.7L226.6 58.6L227.7 59.7L232.2 61.6L235.2 65.5L234.0 67.3L230.4 67.0L230.8 66.3L232.9 66.3L231.1 65.0L231.5 64.2L230.8 63.1L226.8 60.0L226.2 59.9L225.4 61.1L226.3 61.9L222.2 64.1L221.5 63.8L222.9 63.3L222.8 62.4L221.3 61.6L218.3 61.2L217.3 60.4L215.5 61.4L214.8 60.7L214.9 61.9L213.7 62.2L213.5 63.3L215.5 63.1L213.8 65.3L210.1 65.7L205.8 68.4L196.1 72.6L196.5 70.9L197.7 70.8L197.5 70.2L198.8 70.6L200.5 68.4L199.4 69.0L198.6 67.7L197.3 68.6L197.1 69.9L195.9 69.7L195.7 68.9L195.5 69.8L196.4 70.4L193.4 70.7L191.9 72.6L192.1 74.1L190.7 77.1L189.3 76.9L190.0 78.9L190.4 77.4L190.9 77.7L191.3 80.8L192.3 81.1L193.3 79.9L193.9 84.5L193.3 83.5L193.0 84.9L193.9 85.2L193.7 84.7L194.5 85.7L194.9 87.7L195.4 86.7L194.9 85.8L198.1 88.9L198.4 88.4L199.3 89.1L196.9 94.5L196.8 91.6L196.0 91.9L195.7 94.2L196.4 94.5L195.7 95.4L193.2 93.7L192.3 94.2L191.9 99.9L192.7 101.8L193.6 110.8L194.9 114.7L202.6 123.3L209.7 126.6L218.3 134.2L224.1 137.4L225.2 136.7L227.9 139.2L233.6 154.6L236.5 166.3L240.0 173.4L252.8 186.7L256.7 188.4L257.6 191.7L261.0 193.5L264.2 194.3L265.6 195.8L268.8 197.2L276.2 198.0L291.5 196.6L294.5 197.5L295.6 198.5L295.9 202.1L288.2 208.4L288.1 211.2L289.0 213.2L306.5 222.8L318.8 227.3L324.5 230.9L329.8 236.2L334.3 238.0L339.5 241.1L342.4 241.9L342.4 242.8L343.8 242.6L344.7 244.3L344.6 245.9L350.0 249.5L355.2 256.2L357.3 262.0L354.5 266.5L353.9 272.2L352.5 272.8L345.5 268.9L343.5 265.9L344.1 264.4L342.7 263.7L344.0 262.3L341.7 259.4L341.3 256.7L340.0 255.6L330.8 254.9L327.8 254.0L322.5 250.8L323.6 250.0L323.2 248.9L325.0 248.9L325.7 248.0L323.7 247.9L322.2 248.6L321.3 247.5L318.5 247.3L316.6 248.2L314.9 249.9L311.5 255.0L310.1 258.6L306.8 262.7L306.6 264.5L307.5 266.9L304.2 271.5L303.8 273.7L305.3 277.8L307.3 279.1L311.5 279.5L313.2 281.6L317.5 284.0L319.5 286.3L321.4 286.8L320.2 291.7L321.1 293.8L320.5 298.0L321.2 299.6L322.7 300.2L321.8 301.1L321.8 302.6L320.0 304.9L319.7 304.1L317.8 304.6L316.1 303.4L313.0 304.1L310.0 305.6L305.9 308.9L304.9 311.9L306.0 318.0L305.7 322.0L303.2 324.4L299.8 326.1L295.3 331.7L293.8 337.7L292.8 338.9L290.8 339.7L284.6 339.4L282.5 338.5L281.2 336.5L281.8 335.3L280.8 333.5L281.5 331.7L281.1 329.0L281.6 328.2L285.2 326.9L288.3 320.0L288.6 317.2L286.5 314.5L286.6 313.7L290.9 311.0L294.4 311.1L295.6 310.2L296.5 307.9L296.6 304.9L296.2 303.6L294.9 302.9L293.0 298.6L291.7 289.0L290.7 285.7L287.3 281.2L285.7 276.5L284.8 269.6L280.9 263.0L278.6 263.0L275.2 265.9L273.4 265.6L272.4 264.4L271.3 264.7L271.8 264.1L271.3 263.1L267.7 259.7L265.6 259.7L264.5 258.2L262.0 257.2L262.6 253.9L264.3 253.0L264.4 251.6L260.8 244.1L258.7 241.9L254.5 242.6L252.4 243.9L250.9 243.2L247.1 245.5L246.9 243.5L250.6 241.0L250.5 239.8L245.8 235.9L243.9 236.2L243.4 237.2L240.2 236.2L240.2 237.9L239.3 237.7L238.5 233.0L235.9 229.4L234.1 224.9L230.7 221.2L227.3 221.2L226.5 221.8L226.8 222.8L226.0 222.8L219.2 219.7L212.8 222.1L211.5 219.0L208.8 216.0L205.0 215.2L202.4 213.7L201.9 214.3L197.0 207.8L193.9 204.9L191.5 204.1L189.7 199.0L185.7 194.9L183.0 193.3L180.7 193.5L176.2 184.8L173.1 182.3L168.8 180.2L164.8 179.7L163.6 181.6L161.6 180.8L161.1 179.4L161.7 178.8L163.2 179.1L163.7 177.6L163.0 174.6L162.2 174.9L160.9 172.2L159.0 171.0L157.3 168.3L151.7 166.1L152.6 165.0L152.9 162.9L152.2 161.8L149.1 160.6L146.6 160.9L146.8 161.5L146.1 161.8L145.6 161.2L145.0 159.5L146.1 158.3L146.8 153.9L146.3 150.4L144.0 145.3L140.7 141.6L139.0 129.1L138.0 126.4L134.7 122.7L132.1 121.5L131.1 121.9L128.3 119.8L127.6 120.3L128.4 121.0L128.0 122.1L124.0 118.8L122.4 118.3L118.8 114.9L117.5 115.1L112.1 111.0L111.5 112.8L109.8 111.9L108.7 110.3L99.7 108.3L91.9 112.8L90.4 116.7L86.4 119.1L85.3 122.0L83.6 124.2L84.0 125.2L81.4 127.3L71.5 131.1L66.4 131.0L66.2 127.6L71.4 121.2L70.1 118.5L70.5 117.4L62.2 119.2L54.4 115.1L52.7 115.0L49.8 110.7L50.0 108.9L51.0 108.1L49.5 106.8L48.8 104.7L51.8 101.4L52.1 99.3L54.6 99.3L53.1 95.4L53.4 94.4L52.7 93.5L49.1 93.1L46.4 91.3L45.9 87.6L44.0 86.8L42.7 84.4L46.2 82.5L49.1 83.5L52.0 80.6L53.9 80.0L54.6 80.5L56.0 78.9L55.7 76.6L57.5 73.5L52.7 69.9L51.9 67.3L52.2 65.3L48.3 63.3L47.4 60.4L48.0 58.7L51.9 57.6L53.8 55.2ZM185.2 378.2L186.5 379.8L186.0 381.5L183.5 379.8L183.5 378.2L185.2 378.2ZM278.4 326.0L281.5 327.3L279.4 328.7L279.6 329.7L277.6 333.8L270.0 345.2L270.2 347.2L268.8 352.1L267.0 354.8L267.0 360.1L271.1 363.2L271.3 364.0L270.9 363.6L270.2 364.5L269.8 363.6L269.2 365.0L270.1 366.8L271.0 366.7L270.5 367.0L271.0 368.1L272.4 368.7L271.9 370.6L272.9 370.9L273.1 371.9L271.5 372.3L271.5 373.3L268.6 375.0L266.9 379.4L268.0 383.4L266.9 384.6L264.6 382.9L263.9 383.4L261.3 381.9L258.6 383.0L253.4 380.1L250.9 379.7L247.8 373.3L243.5 369.4L240.4 368.2L235.2 368.8L233.6 367.4L230.5 366.2L226.7 362.6L222.8 361.1L219.0 358.3L216.2 355.0L212.0 354.7L211.6 353.3L210.1 352.1L202.6 352.3L200.9 349.7L198.5 348.7L196.4 344.0L197.5 343.1L198.2 336.0L200.4 334.3L201.3 334.6L202.7 332.6L203.8 332.9L204.5 329.9L205.3 330.4L206.8 334.0L209.0 335.8L213.3 333.8L213.1 331.7L214.3 330.1L217.1 330.5L217.9 329.5L220.0 329.0L221.4 330.7L221.9 333.1L225.1 332.9L226.3 335.0L228.8 336.8L232.5 337.7L238.5 335.0L240.2 335.9L245.2 336.2L249.4 335.0L251.5 335.2L254.8 333.9L257.4 331.2L261.9 330.1L266.8 332.2L269.1 331.3L270.7 327.4L270.9 329.1L272.1 329.5L275.0 328.5L278.4 326.0ZM91.6 298.6L92.3 298.8L90.7 302.6L89.2 300.2L88.7 297.8L89.1 297.1L91.3 297.6L91.6 298.6ZM126.9 245.9L127.8 246.9L127.1 249.5L125.8 252.3L124.8 252.7L122.5 256.4L123.2 260.6L125.3 262.7L124.1 267.1L125.0 268.1L124.0 269.9L124.4 271.0L122.6 283.4L123.1 284.0L121.8 289.1L122.8 290.7L121.3 291.8L121.0 296.0L119.7 297.5L119.1 296.5L117.6 296.8L113.7 293.4L111.7 293.2L110.4 294.6L106.3 291.9L107.0 293.2L108.1 293.3L106.5 296.0L107.2 299.2L106.7 301.4L102.1 305.6L98.5 303.7L97.2 304.4L96.5 306.1L96.5 305.2L95.4 304.9L95.9 303.1L94.9 302.6L94.3 299.2L92.9 299.0L92.9 298.0L92.3 298.4L89.4 293.3L91.0 290.5L89.5 287.8L90.3 286.1L89.8 284.6L91.8 280.7L91.3 274.4L93.2 276.3L94.5 276.4L92.9 275.6L94.0 273.4L93.3 274.1L94.2 272.1L94.0 270.1L91.8 268.8L91.1 269.3L91.8 269.3L91.1 270.8L90.6 269.6L90.0 268.8L90.4 265.0L89.5 264.5L92.0 263.5L92.4 262.6L91.7 258.1L92.2 255.4L89.8 253.2L89.9 250.0L87.3 244.6L85.3 245.5L84.7 245.2L85.3 244.0L84.6 243.8L83.9 245.7L83.6 245.2L83.3 243.5L84.8 241.1L83.1 239.8L85.3 234.4L85.1 233.2L84.3 232.7L84.9 231.1L86.9 235.0L93.3 236.3L95.4 235.4L96.5 233.9L98.3 233.0L99.8 233.3L101.3 232.1L102.8 229.4L103.9 228.9L106.1 225.8L109.7 224.8L110.5 221.6L112.1 220.9L113.4 223.3L113.5 222.3L113.5 223.3L114.8 223.5L114.9 222.7L117.2 223.8L116.8 224.5L117.6 225.5L117.6 226.9L118.4 225.0L119.8 224.9L120.8 225.7L119.5 229.6L120.3 228.9L120.6 229.9L122.3 229.5L123.5 230.1L121.5 230.3L121.1 232.5L119.3 232.8L121.1 233.5L123.0 233.0L122.2 234.0L125.1 235.7L123.3 237.3L124.6 238.7L126.1 244.9L126.9 245.9ZM144.1 164.7L143.8 166.7L142.6 167.5L143.6 168.4L143.4 169.5L141.3 167.5L140.6 168.3L140.4 167.7L139.4 168.2L138.8 167.8L138.6 168.6L136.3 168.5L135.0 166.8L136.5 165.6L138.8 166.2L139.6 165.3L141.0 165.3L140.9 165.9L141.8 166.0L143.3 163.6L144.1 164.7Z';
  const IT_P = { c: 0.743145, k: 35.5311, minx: 4.9079, miny: -47.0848, ox: 42.726, oy: 14 };
  const proj = ([lon, lat]) => [(lon * IT_P.c - IT_P.minx) * IT_P.k + IT_P.ox, (-lat - IT_P.miny) * IT_P.k + IT_P.oy];
  // magazzini e piazzali (stessi punti di Centro di Costo); il nome è quello del piazzale
  const GEO = {
    'torino': [7.776, 45.201, 'Volpiano (TO)'], 'gorgonzola': [9.405, 45.532, 'Gorgonzola (MI)'], 'piacenza': [9.69, 45.05, 'Piacenza'],
    'verona': [11.274, 45.396, 'San Bonifacio (VR)'], 'venezia': [12.372, 45.578, "Quarto d'Altino (VE)"], 'bologna': [11.272, 44.565, 'Calderara di Reno (BO)'],
    'ravenna': [12.143, 44.405, 'Fornace Zarattini (RA)'], 'rimini': [12.53, 43.948, 'Taverna di Monte Colombo (RN)'], 'pisa': [10.43, 43.687, 'Ospedaletto (PI)'],
    'corropoli': [13.839, 42.827, 'Corropoli (TE)'], 'pescara': [14.059, 42.518, "Città Sant'Angelo (PE)"], 'san cesareo': [12.80, 41.82, 'San Cesareo (RM)'],
    'ferentino': [13.25, 41.69, 'Ferentino (FR)'], 'roma': [12.612, 41.857, 'Roma']
  };
  const ORIGIN = [11.934, 45.388];   // Fischer, Padova
  const key = s => String(s || '').toLowerCase().replace(/^(magazzino|piazzale)\s+/, '').replace(/\s*\([a-z]{2}\)\s*$/, '').trim();

  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const ICO = {
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
    truck: '<path d="M2 6h11v9H2zM13 9h4l3 3v3h-7"/><circle cx="6" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
    split: '<path d="M4 12h16M12 4v16" opacity=".35"/><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    euro: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5"/><path d="M5 10.5h8M5 13.5h8"/>'
  };
  const ico = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;

  function html(H) {
    const { esc, num, eur, dt, today } = H, O = H.orders(), D = H.ddts(), act = O.filter(H.open);
    const now = new Date(), hh = now.getHours(), saluto = hh < 13 ? 'Buongiorno' : hh < 18 ? 'Buon pomeriggio' : 'Buonasera';
    const dataLunga = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const viaggio = [...D.filter(d => H.tkIdx(d) < 4 && (!H.ordOf(d) || H.open(H.ordOf(d)))), ...act.filter(o => !H.ddtsOf(o).length && o.track && H.tkIdx(o) < 4)];
    const lt = act.filter(H.late), part = act.filter(o => H.shipSt(o) === 'parte'), dx = D.filter(d => !H.ordOf(d));
    const notrk = D.filter(d => !d.track && H.tkIdx(d) < 4 && (!H.ordOf(d) || H.open(H.ordOf(d))));
    const impAperto = act.reduce((s, o) => s + (o.imponibile || 0), 0);
    const pzArrivo = act.reduce((s, o) => s + H.shortOf(o, H.shipped(o)).reduce((a, x) => a + x.r, 0), 0);
    const cons = O.filter(o => o.stato === 'consegnato');
    // puntualità: consegnati entro la data prevista da Fischer
    const quando = o => ((o.mov || []).filter(m => m.st === 'consegnato').pop() || {}).d || '';
    const valut = cons.filter(o => quando(o) && H.nextDel(o)), inTempo = valut.filter(o => quando(o) <= H.nextDel(o)).length;
    const punt = valut.length ? Math.round(inTempo / valut.length * 100) : null;
    const todo = [];
    act.forEach(o => H.checksO(o).filter(c => c.t === 'warn').forEach(c => todo.push({ id: o.id, h: `Ordine ${o.num} · ${H.pzName(o)}`, c })));
    D.forEach(d => H.checksD(d).filter(c => c.t === 'warn').forEach(c => todo.push({ id: d.id, h: `DDT ${d.num} · ${H.pzOfD(d)}`, c })));

    const frase = [act.length ? `<b>${num(act.length)}</b> ${act.length === 1 ? 'ordine aperto' : 'ordini aperti'}` : 'nessun ordine aperto', viaggio.length ? `<b>${num(viaggio.length)}</b> ${viaggio.length === 1 ? 'spedizione' : 'spedizioni'} in viaggio` : '', lt.length ? `<b class="t-bad">${num(lt.length)}</b> in ritardo` : '', todo.length ? `<b class="t-warn">${num(todo.length)}</b> da controllare` : 'tutto in ordine'].filter(Boolean);
    const cents = v => { const t = eur(v).replace(/\s*€$/, ''), k = t.lastIndexOf(','); return k < 0 ? esc(t) : `${esc(t.slice(0, k))}<span class="cents">${esc(t.slice(k))}</span>`; };
    const words = t => t.split(' ').map((w, i) => `<span class="word" style="--i:${i}">${esc(w)}</span>`).join(' ');
    const glance = (ic, n, l, s) => `<div class="gl-i"><span class="gl-ic">${ico(ic)}</span><span><b>${n}</b><small>${l}</small></span>${s ? `<em>${s}</em>` : ''}</div>`;
    const hero = `<section class="hero">
      <div class="hero-copy"><p class="hero-eyebrow">${esc(dataLunga.charAt(0).toUpperCase() + dataLunga.slice(1))} · ecco la situazione degli ordini Fischer</p>
        <h1>${words(saluto + '!')}</h1>
        <div class="hero-actions"><button type="button" class="btn xl white" data-up>${'<svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>'}Carica PDF</button><button type="button" class="btn xl white" data-paste>${ico('link')}Incolla link</button>
          <div class="glance">${glance('box', num(act.length), act.length === 1 ? 'ordine aperto' : 'ordini aperti')}${glance('truck', num(viaggio.length), 'in viaggio', lt.length ? `${num(lt.length)} in ritardo` : '')}${glance('clock', num(todo.length), 'da controllare')}</div></div></div>
      <div class="stack"><span class="stack-layer l3"></span><span class="stack-layer l2"></span><div class="stack-card">
        <div class="stack-top"><span class="dot"></span><span>Ordini aperti · ${now.getFullYear()}</span><b>FISCHER</b></div>
        <div class="stack-val">${cents(impAperto)}<span class="cur"> €</span></div>
        <div class="stack-pill">${ico('box')}${num(pzArrivo)} pezzi in arrivo</div>
        <p class="stack-sub">${num(act.length)} ${act.length === 1 ? 'ordine aperto' : 'ordini aperti'} · puntualità ${punt == null ? '—' : punt + '%'}</p></div></div></section>`;
    const kpi = (cls, ic, l, n, s, go, pct) => `<button type="button" class="kp ${cls} rv" data-go="${go}"><span class="kp-i">${ico(ic)}</span><small>${l}</small><b data-count="${n}">${num(n)}</b><span class="kp-s">${s}</span>${pct != null ? `<i class="kp-bar"><i style="--w:${Math.max(0, Math.min(100, pct))}%"></i></i>` : ''}</button>`;
    const inCons = act.filter(o => o.stato === 'spedito');
    const kpis = `<div class="kps">
      ${kpi('', 'box', 'Ordini aperti', act.length, `${num(O.length)} in totale`, 'ord:aperti', O.length ? act.length / O.length * 100 : 0)}
      ${kpi('blue', 'truck', 'In viaggio', viaggio.length, `${num(inCons.length)} ${inCons.length === 1 ? 'ordine' : 'ordini'} in consegna`, 'ddt:viaggio', act.length ? inCons.length / act.length * 100 : 0)}
      ${kpi(part.length ? 'warn' : 'good', 'split', 'Spediti in parte', part.length, part.length ? 'manca ancora merce' : 'nessuno', 'ord:parte')}
      ${kpi(lt.length ? 'bad' : 'good', 'clock', 'In ritardo', lt.length, lt.length ? 'oltre la data prevista' : 'tutti in tempo', 'ord:ritardo')}
      ${kpi(dx.length ? 'warn' : 'good', 'doc', 'DDT senza conferma', dx.length, dx.length ? 'carica la conferma' : 'tutti collegati', 'ddt:senza')}
      ${kpi(notrk.length ? 'warn' : 'good', 'link', 'Senza tracciamento', notrk.length, notrk.length ? 'incolla il link' : 'tutti con link', 'ddt:notrk')}
    </div>`;

    // piazzali sulla mappa
    const P = new Map(), pz = n => { const k = key(n); if (!P.has(k)) P.set(k, { k, n: n || '—', a: 0, v: 0, lt: 0, pzA: 0, last: '', tot: 0, cons: 0 }); return P.get(k); };
    Object.values(H.PZ_LIST).forEach(pz);
    O.forEach(o => { const p = pz(H.pzName(o)); p.tot++; if (o.stato === 'consegnato') p.cons++; if (H.open(o)) { p.a++; p.pzA += H.shortOf(o, H.shipped(o)).reduce((s, x) => s + x.r, 0); if (H.late(o)) p.lt++; } });
    D.forEach(d => { const p = pz(H.pzOfD(d)); if (String(d.data) > p.last) p.last = d.data; });
    viaggio.forEach(x => { pz(x.tipo === 'ddt' ? H.pzOfD(x) : H.pzName(x)).v++; });
    const pins = [...P.values()].map(p => ({ ...p, g: GEO[p.k] })).filter(p => p.g);
    const [ox, oy] = proj(ORIGIN);
    // inquadratura: solo la zona dei piazzali, con margine; dimensioni di testi e punti in proporzione
    const pts = pins.map(p => { const [x, y] = proj(p.g); return { p, x, y, st: p.lt ? 'bad' : p.v ? 'go' : p.a ? 'open' : p.tot ? 'ok' : 'idle' }; });
    const xs = [ox, ...pts.map(q => q.x)], ys = [oy, ...pts.map(q => q.y)];
    let vx0 = Math.min(...xs) - 34, vx1 = Math.max(...xs) + 34, vy0 = Math.min(...ys) - 22, vy1 = Math.max(...ys) + 22;
    const AR = .95; let vw = Math.max(150, vx1 - vx0), vh = Math.max(150 / AR, vy1 - vy0);
    if (vw / vh < AR) vw = vh * AR; else vh = vw / AR;
    const cx = (vx0 + vx1) / 2, cy = (vy0 + vy1) / 2; vx0 = cx - vw / 2; vy0 = cy - vh / 2;
    const z = vw / 336 * 1.25, F = 8.5 * z;
    // etichette: la prima posizione libera tra destra, sinistra, sopra, sotto (prima i piazzali con più ordini)
    const taken = [{ x: ox - 6 * z, y: oy - 6 * z, w: 12 * z, h: 12 * z }], hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    pts.forEach(q => { q.r = (4.2 + Math.min(5, q.p.a * 1.2 + q.p.v * .8)) * z; taken.push({ x: q.x - q.r, y: q.y - q.r, w: 2 * q.r, h: 2 * q.r }); });
    const lblO = { t: 'Fischer Padova', w: 14 * F * .56 };
    [{ x: ox - lblO.w / 2, y: oy - 9 * z - F, w: lblO.w, h: F * 1.2, a: 'middle', tx: 0, ty: -9 * z }, { x: ox - lblO.w / 2, y: oy + 8 * z, w: lblO.w, h: F * 1.2, a: 'middle', tx: 0, ty: 8 * z + F * .9 }].some(c => { if (!taken.some(t => hit(c, t))) { lblO.c = c; taken.push(c); return true; } return false; }) || (lblO.c = { a: 'middle', tx: 0, ty: -9 * z });
    pts.slice().sort((a, b) => b.p.a + b.p.v - (a.p.a + a.p.v) || a.y - b.y).forEach(q => {
      const w = q.p.n.length * F * .56, h = F * 1.2, g = q.r + 3 * z;
      const C = [{ x: q.x + g, y: q.y - h / 2, a: 'start', tx: g, ty: F * .35 }, { x: q.x - g - w, y: q.y - h / 2, a: 'end', tx: -g, ty: F * .35 }, { x: q.x - w / 2, y: q.y - g - h, a: 'middle', tx: 0, ty: -g - F * .25 }, { x: q.x - w / 2, y: q.y + g, a: 'middle', tx: 0, ty: g + F * .85 }]
        .map(c => ({ ...c, w, h }));
      q.l = C.find(c => !taken.some(t => hit(c, t))) || C[0]; taken.push(q.l);
    });
    const mapSvg = `<svg class="itmap" viewBox="${vx0.toFixed(1)} ${vy0.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" style="--z:${z.toFixed(3)}" role="img" aria-label="Mappa dei piazzali e delle spedizioni in viaggio">
      <defs><radialGradient id="mglow"><stop offset="0" stop-color="var(--red)" stop-opacity=".25"/><stop offset="1" stop-color="var(--red)" stop-opacity="0"/></radialGradient>
        <pattern id="mdots" width="${(3 * z).toFixed(2)}" height="${(3 * z).toFixed(2)}" patternUnits="userSpaceOnUse"><circle cx="${(.75 * z).toFixed(2)}" cy="${(.75 * z).toFixed(2)}" r="${(.42 * z).toFixed(2)}" class="mdot"/></pattern></defs>
      <path class="m-land" d="${IT_PATH}"/><path class="m-dots" d="${IT_PATH}"/>
      ${pts.filter(q => q.p.v).map((q, i) => { const { x, y } = q, mx = (ox + x) / 2 + (y - oy) * .18, my = (oy + y) / 2 - Math.abs(x - ox) * .22 - 8 * z, d = `M${ox.toFixed(1)} ${oy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`; return `<path id="rt${i}" class="m-route${q.p.lt ? ' bad' : ''}" d="${d}" pathLength="1" style="--d:${.3 + i * .15}s"/><g class="m-truck${q.p.lt ? ' bad' : ''}"><circle r="${(3 * z).toFixed(2)}"/><animateMotion dur="${3.2 + i * .4}s" repeatCount="indefinite" begin="${(.6 + i * .3).toFixed(1)}s" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .55 1"><mpath href="#rt${i}"/></animateMotion></g>`; }).join('')}
      <g class="m-origin" transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)})"><circle r="${(18 * z).toFixed(1)}" fill="url(#mglow)"/><rect x="${(-5 * z).toFixed(2)}" y="${(-5 * z).toFixed(2)}" width="${(10 * z).toFixed(2)}" height="${(10 * z).toFixed(2)}" rx="${(2.5 * z).toFixed(2)}"/><text x="${lblO.c.tx.toFixed(1)}" y="${lblO.c.ty.toFixed(1)}" text-anchor="middle">Fischer Padova</text></g>
      ${pts.map((q, i) => { const p = q.p; return `<g class="m-pin ${q.st}" data-mpz="${esc(p.n)}" transform="translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})" style="--d:${(.15 + i * .06).toFixed(2)}s" tabindex="0" role="button" aria-label="${esc(p.n)}: ${p.a} ordini aperti">
          ${q.st === 'bad' || q.st === 'go' ? `<circle class="m-pulse" r="${q.r.toFixed(2)}"/>` : ''}<circle class="m-dot" r="${q.r.toFixed(2)}"/>${p.a ? `<text class="m-n" dy="${(2.4 * z).toFixed(2)}" text-anchor="middle">${p.a}</text>` : ''}
          <text class="m-lbl" x="${q.l.tx.toFixed(1)}" y="${q.l.ty.toFixed(1)}" text-anchor="${q.l.a}">${esc(p.n)}</text></g>`; }).join('')}
    </svg>`;
    const ranking = [...P.values()].filter(p => p.tot || p.last).sort((a, b) => b.a - a.a || b.pzA - a.pzA || a.n.localeCompare(b.n, 'it'));
    const maxA = Math.max(1, ...ranking.map(p => p.pzA));
    const mapCard = `<section class="card mapc rv"><div class="card-h"><h3>Italia · piazzali e spedizioni</h3><span class="mleg"><i class="go"></i>in viaggio<i class="open"></i>ordini aperti<i class="bad"></i>in ritardo<i class="ok"></i>tutto consegnato</span></div>
      <div class="mapw"><div class="mapbox">${mapSvg}<div class="mtip" hidden></div></div>
      <div class="mrank">${ranking.length ? ranking.map(p => `<button type="button" class="mr" data-pz="${esc(p.n)}"><span class="mr-h"><b>${esc(p.n)}</b>${p.lt ? '<span class="chip late">ritardo</span>' : p.v ? '<span class="chip blue">in viaggio</span>' : p.a ? '<span class="chip soon">aperti</span>' : '<span class="chip ok">ok</span>'}</span><span class="mr-s">${num(p.a)} ${p.a === 1 ? 'ordine aperto' : 'ordini aperti'} · ${num(p.pzA)} pz in arrivo${p.last ? ' · ultimo DDT ' + esc(dt(p.last)) : ''}</span><i class="mr-bar"><i style="--w:${(p.pzA / maxA * 100).toFixed(1)}%"></i></i></button>`).join('') : '<div class="empty">I piazzali compaiono quando carichi conferme e DDT</div>'}</div></div></section>`;

    // grafici: ordini per stato, mese per mese, puntualità
    const stN = ['confermato', 'spedito', 'consegnato', 'annullato'].map(k => [k, O.filter(o => o.stato === k).length]);
    const stTot = Math.max(1, O.length), stLbl = { confermato: 'Confermati', spedito: 'In consegna', consegnato: 'Consegnati', annullato: 'Annullati' };
    const stack = `<div class="stk">${stN.filter(([, n]) => n).map(([k, n], i) => `<i class="s-${k}" style="--w:${(n / stTot * 100).toFixed(2)}%;--d:${i * .12}s" title="${stLbl[k]}: ${n}"></i>`).join('') || '<i class="s-vuoto" style="--w:100%"></i>'}</div>
      <div class="stl">${stN.map(([k, n]) => `<span><i class="s-${k}"></i>${stLbl[k]} <b>${num(n)}</b></span>`).join('')}</div>`;
    const months = []; for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, l: MESI[d.getMonth()], v: 0, n: 0 }); }
    O.filter(o => o.stato !== 'annullato').forEach(o => { const m = months.find(x => x.k === String(o.data).slice(0, 7)); if (m) { m.v += o.imponibile || 0; m.n++; } });
    const mMax = Math.max(1, ...months.map(m => m.v));
    const bars = `<div class="bars">${months.map((m, i) => `<div class="bc${i === months.length - 1 ? ' cur' : ''}" title="${m.l}: ${num(m.n)} ordini · ${eur(m.v)}"><span class="bv">${m.v ? eur(m.v).replace(/,\d\d €$/, ' €') : ''}</span><i style="--h:${(m.v / mMax * 100).toFixed(1)}%;--d:${i * .07}s"></i><small>${m.l}</small></div>`).join('')}</div>`;
    const C = 2 * Math.PI * 30, pv = punt == null ? 0 : punt;
    const donut = `<div class="dn"><svg viewBox="0 0 80 80"><circle class="dn-bg" cx="40" cy="40" r="30"/><circle class="dn-v${pv < 70 ? ' bad' : pv < 90 ? ' warn' : ''}" cx="40" cy="40" r="30" style="--c:${C.toFixed(1)};--v:${(C * (1 - pv / 100)).toFixed(1)}"/></svg><div><b>${punt == null ? '—' : `<span data-count="${punt}">${punt}</span>%`}</b><small>${punt == null ? 'nessuna consegna ancora' : `${num(inTempo)} su ${num(valut.length)} in tempo`}</small></div></div>`;
    const charts = `<div class="g3">
      <section class="card rv"><div class="card-h"><h3>Ordini per stato</h3><span class="muted small">${num(O.length)} in totale</span></div>${stack}</section>
      <section class="card rv"><div class="card-h"><h3>Ordinato mese per mese</h3><span class="muted small">imponibile</span></div>${bars}</section>
      <section class="card rv"><div class="card-h"><h3>Puntualità</h3><span class="muted small">consegne entro la data Fischer</span></div>${donut}</section></div>`;

    // spedizioni in viaggio, attività, da controllare
    const trav = viaggio.slice().sort((a, b) => String((a.trk && a.trk.eta) || '9').localeCompare(String((b.trk && b.trk.eta) || '9')));
    const travCard = `<section class="card rv"><div class="card-h"><h3>Spedizioni in viaggio</h3><button type="button" class="btn sm" data-go="ddt:viaggio">Tutte</button></div>${trav.length ? trav.slice(0, 4).map(x => `<button type="button" class="trv" data-open="${esc(x.id)}"><div class="trv-h"><b>${esc(x.tipo === 'ddt' ? 'DDT ' + x.num : 'Ordine ' + x.num)} · ${esc(x.tipo === 'ddt' ? H.pzOfD(x) : H.pzName(x))}</b><span>${x.trk && x.trk.auto && x.trk.auto.carr ? esc(x.trk.auto.carr) + ' · ' : ''}${x.trk && x.trk.eta ? 'prevista ' + esc(dt(x.trk.eta)) : ''}</span></div>${H.stepper(x)}</button>`).join('') : '<div class="empty">Nessuna spedizione in viaggio</div>'}</section>`;
    const feed = [];
    O.forEach(o => (o.mov || []).forEach((m, i) => feed.push({ id: o.id, d: m.d, i, n: m.n, st: m.st, w: `Ordine ${o.num} · ${H.pzName(o)}` })));
    feed.sort((a, b) => String(b.d).localeCompare(String(a.d)) || b.i - a.i);
    const fIco = f => /consegnat/i.test(f.n) ? 'ok' : /^Spedizione|in consegna|DDT/i.test(f.n) ? 'truck' : /link/i.test(f.n) ? 'link' : 'doc';
    const feedCard = `<section class="card rv"><div class="card-h"><h3>Attività recenti</h3><span class="muted small">tutti gli ordini</span></div><div class="feed">${feed.slice(0, 9).map(f => `<button type="button" class="fd" data-open="${esc(f.id)}"><span class="fd-i ${fIco(f)}">${ico(fIco(f))}</span><span><b>${esc(f.n)}</b><small>${esc(f.w)} · ${esc(dt(f.d))}</small></span></button>`).join('') || '<div class="empty">Ancora nessuna attività</div>'}</div></section>`;
    const todoCard = `<section class="card rv"><div class="card-h"><h3>Da controllare</h3><span class="muted small">${todo.length ? `${num(todo.length)} ${todo.length === 1 ? 'avviso' : 'avvisi'}` : 'tutto in ordine'}</span></div>${todo.slice(0, 8).map(t => `<button type="button" class="todo" data-open="${esc(t.id)}"><i class="${t.c.h === 'In ritardo' ? 'bad' : ''}"></i><div><b>${esc(t.h)}</b><span>${esc(t.c.h)}: ${esc(t.c.d)}</span></div></button>`).join('') || `<div class="allok">${ico('ok')}<b>Tutto in ordine</b><span>Numeri, quantità e collegamenti tornano</span></div>`}</section>`;

    return `<div class="pan">${hero}${kpis}${mapCard}${charts}<div class="g2b"><div>${travCard}${feedCard}</div><div>${todoCard}</div></div></div>`;
  }

  /* ---------- dopo il disegno: animazioni e mappa ---------- */
  function after(root, anim, fmt) {
    const pan = root.querySelector('.pan'); if (!pan) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (anim && !reduce) {
      pan.classList.add('go');
      pan.querySelectorAll('.rv').forEach((el, i) => el.style.setProperty('--rv', `${Math.min(i, 14) * 55}ms`));
      pan.querySelectorAll('[data-count]').forEach(el => {
        const to = Number(el.dataset.count) || 0, f = el.dataset.fmt === 'eur' ? fmt.eur : fmt.num, t0 = performance.now(), dur = 1100;
        if (!to) return;
        const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = f(el.dataset.fmt === 'eur' ? to * e : Math.round(to * e)); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
    } else pan.classList.add('still');
    // suggerimento sulla mappa
    const box = pan.querySelector('.mapbox'), tip = box && box.querySelector('.mtip');
    if (!box) return;
    const show = g => {
      const n = g.dataset.mpz, rr = [...pan.querySelectorAll('.mr')].find(b => b.dataset.pz === n);
      tip.innerHTML = `<b>${fmt.esc(n)}</b><span>${rr ? fmt.esc(rr.querySelector('.mr-s').textContent) : 'nessun ordine'}</span><small>Clic per vedere gli ordini</small>`;
      const b = box.getBoundingClientRect(), p = g.getBoundingClientRect();
      tip.hidden = false; tip.style.left = `${Math.min(b.width - 200, Math.max(0, p.left - b.left + p.width / 2 - 100))}px`; tip.style.top = `${Math.max(0, p.top - b.top - tip.offsetHeight - 8)}px`;
      pan.querySelectorAll('.mr').forEach(x => x.classList.toggle('hl', x.dataset.pz === n));
    };
    const hide = () => { tip.hidden = true; pan.querySelectorAll('.mr.hl').forEach(x => x.classList.remove('hl')); };
    box.addEventListener('mouseover', e => { const g = e.target.closest('[data-mpz]'); if (g) show(g); });
    box.addEventListener('mouseout', e => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('[data-mpz]')) hide(); });
    box.addEventListener('focusin', e => { const g = e.target.closest('[data-mpz]'); if (g) show(g); });
    box.addEventListener('focusout', hide);
    pan.querySelectorAll('.mr').forEach(b => {
      b.addEventListener('mouseenter', () => { const g = [...box.querySelectorAll('[data-mpz]')].find(x => x.dataset.mpz === b.dataset.pz); if (g) g.classList.add('hl'); });
      b.addEventListener('mouseleave', () => box.querySelectorAll('.m-pin.hl').forEach(x => x.classList.remove('hl')));
    });
  }

  window.FPAN = { html, after, GEO, proj };
})();
