# Fischer · ordini e consegne ai piazzali

Sito per seguire gli acquisti di tasselli dal fornitore Fischer, con consegna ai piazzali.

- **Conferme d'ordine (PDF)**: vengono lette e controllate (righe, sconto, IVA, totale). Il piazzale si ricava dalla destinazione.
- **DDT (PDF)**: vengono letti (colli, segnacollo, corriere, articoli) e si **collegano da soli** alla conferma tramite il numero d'ordine. Per ogni articolo si vede confermato, spedito e quanto resta da spedire.
- **Tracciamento automatico**: si incolla il link Shippeo (nel campo dell'ordine o del DDT, oppure con «Incolla link»). Lo script legge dal corriere fasi, hub, date, vettore e consegna prevista. Collega il link al **DDT con lo stesso numero di consegna Fischer**, oppure all'ordine aperto dello stesso piazzale, anche se è stato incollato nel posto sbagliato. Ogni ora aggiorna da solo tutte le spedizioni in viaggio, anche a sito chiuso. L'ordine passa da solo a «In consegna» e poi a «Consegnato». Per i corrieri senza lettura automatica si possono aggiungere aggiornamenti a mano.
- **Panoramica**: ordini aperti, in consegna, spediti in parte, in ritardo, DDT senza conferma e situazione per piazzale.

Si possono caricare più PDF insieme, o uno zip: il sito riconosce da solo se ogni file è una conferma o un DDT.

## File

| File | Cosa contiene |
|---|---|
| `index.html`, `style.css`, `theme.css` | la pagina; `theme.css` è il tema «vetro» ripreso dal pacchetto Glassy Dashboard 42 (foto `bg.jpg`, font Inter) |
| `pan.js` | la Panoramica: intestazione, numeri chiave, mappa d'Italia, grafici, attività |
| `app.js` | ordini, DDT, collegamenti, controlli, tracciamento, salvataggio |
| `parser.js` | lettura dei PDF Fischer (conferma d'ordine e DDT) |
| `lib-pdfjs*.js` | pdf.js di Mozilla, la libreria che estrae il testo dai PDF |
| `google/Code.gs` | script da incollare nel Google Foglio (non viene usato dal sito pubblicato) |

I dati **non stanno su GitHub**: stanno nel tuo Google Foglio, con i PDF archiviati in una cartella del tuo Drive. Su GitHub c'è solo il programma.

## Collegare il Google Foglio (una volta sola)

1. Crea un nuovo Google Foglio, ad esempio «Fischer ordini».
2. **Estensioni → Apps Script**. Cancella il contenuto, incolla tutto `google/Code.gs` e salva.
3. **Impostazioni progetto** (ingranaggio) **→ Proprietà script → Aggiungi proprietà**:
   - nome `CHIAVE`;
   - valore: un codice lungo inventato da te. È la password del sito: non scriverlo in chat e non metterlo su GitHub.
4. Torna all'editor, scegli la funzione **`prepara`** e premi **Esegui**. Google chiede le autorizzazioni (Fogli e Drive): accetta. Vengono creati i fogli «Ordini» e «DDT» e la cartella «Fischer PDF».
5. Scegli la funzione **`attivaAggiornamenti`** e premi **Esegui**. Accetta l'autorizzazione «connessione a servizi esterni»: serve per leggere Shippeo. Da quel momento le spedizioni si aggiornano ogni ora.
6. **Esegui il deployment → Nuovo deployment → tipo App web**:
   - Esegui come: **Me**;
   - Chi ha accesso: **Chiunque**. Lo script risponde solo a chi conosce il codice.

   Premi Esegui il deployment e copia l'indirizzo che finisce con `/exec`.
7. Apri il sito, clicca sul pallino in alto a destra e inserisci l'indirizzo e il codice. Il pallino diventa verde.

Se modifichi `Code.gs`: **Esegui il deployment → Gestisci deployment → matita → Versione: nuova versione**. L'indirizzo resta lo stesso.

## Modalità prova

Senza Google Foglio si può provare tutto con «Usa in prova». I dati restano solo in quel browser e i PDF non vengono archiviati.

## Pubblicazione

GitHub Pages: **Settings → Pages → Branch `main`, cartella `/ (root)`**. Quando si cambia un file, aumentare `?v=N` in `index.html`, così i browser scaricano la versione nuova.
