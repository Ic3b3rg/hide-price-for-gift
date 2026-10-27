# Sorpresa

Estensione Chrome per scegliere regali su **Amazon.it e Zalando.it** senza mostrare i prezzi dei prodotti. Una lista locale raccoglie foto e link, con esportazione PDF e CSV per Excel.

## Installazione — nessun comando necessario

1. Apri `chrome://extensions` in Google Chrome.
2. Attiva **Modalità sviluppatore** in alto a destra.
3. Premi **Carica estensione non pacchettizzata** e seleziona la cartella **`extension`** di questo progetto. Se usi lo ZIP, estrailo e seleziona la cartella `sorpresa` estratta.
4. Fissa **Sorpresa** alla barra degli strumenti dal menu delle estensioni.
5. Ricarica una volta le schede Amazon/Zalando già aperte prima dell’installazione.

## Utilizzo

- La **modalità regalo è già attiva**: il badge dell’icona mostra `ON`. Si applica a tutte le schede dei due negozi e resta attiva nei nuovi caricamenti. L’interruttore del popup ripristina i prezzi senza ricaricare.
- Apri un singolo prodotto, clicca Sorpresa e poi **Salva questo prodotto**: vengono conservati nome, link e foto principale. I duplicati vengono riconosciuti anche se cambia il link di tracciamento.
- **Apri lista** mostra tutti i prodotti. Puoi aprirli nel negozio oppure rimuoverli singolarmente.
- **Esporta PDF** apre la lista; premi **Salva come PDF** e scegli **Salva come PDF** nella finestra di stampa. Il documento include immagini, nomi e link cliccabili, senza prezzi.
- **CSV per Excel** scarica un file UTF-8 con separatore `;`: nome, negozio, link al prodotto e link all’immagine. Il CSV contiene collegamenti alle immagini, mentre il PDF include le foto.

La lista rimane nel profilo locale di Chrome; non richiede account. Le foto vengono ridimensionate e salvate localmente, così la lista e il PDF funzionano anche offline. Se una foto non è scaricabile viene mostrato un avviso e rimane il collegamento originale. La lista può contenere fino a 150 prodotti. Rimuovere l’estensione elimina i suoi dati locali.

## Cosa viene nascosto

Solo i prezzi dei prodotti, inclusi prezzi precedenti e prezzi unitari. **Spedizione, totali del carrello e sconti percentuali restano visibili**, come richiesto. Pertanto il totale di un carrello può comunque rivelare la spesa.

Le regole CSS partono prima del rendering; un osservatore controlla gli aggiornamenti del DOM, inclusi caricamento progressivo e navigazione senza ricaricamento. La pagina non viene riscritta: foto, titoli e pulsanti restano utilizzabili e i prezzi originali vengono ripristinati disattivando la modalità.

Quando prezzo e consegna condividono lo stesso nodo di testo, l’estensione maschera soltanto i caratteri dell’importo tramite la funzione nativa CSS Custom Highlight di Chrome, preservando il resto della riga.

Supporto limitato alle versioni italiane HTTPS dei due negozi. I prezzi incorporati in immagini o video non sono riconosciuti. Un cambiamento futuro dei siti può richiedere un aggiornamento delle regole: il rilevamento generico degli importi riduce la dipendenza dalle classi dei negozi, ma non costituisce una garanzia assoluta per qualsiasi pagina futura.

## Sviluppo e verifiche

L’estensione si carica direttamente dalla cartella `extension`: nessuna build e nessuna dipendenza di produzione. Node.js 22+ serve solo per i comandi di sviluppo. Playwright è l’unica dipendenza di sviluppo.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run test:browser
npm run package
```

`test:browser` carica realmente l’estensione in un profilo Chromium temporaneo, con pagine locali controllate servite sugli indirizzi dei negozi. Verifica prezzi suddivisi in più elementi, scorrimento, mutazioni, navigazione, sincronizzazione fra schede, salvataggio, duplicati, foto offline, CSV, stampa PDF e rimozione. Le fixture non chiamano le API dei negozi. Le pagine reali sono controllate separatamente; la suite ripetibile non dipende da disponibilità dei siti o CAPTCHA.

`npm run test:live` apre quattro pagine reali (ricerca e prodotto per ogni negozio) in un profilo Chromium temporaneo, controlla i prezzi e salva due prodotti con le foto. Produce schermate, un PDF offline e un rapporto in `artifacts/verification/`. Questo controllo richiede rete e può fallire se un negozio blocca il browser di automazione; utilizza lo user agent desktop della versione Chromium installata. Non effettua accessi, aggiunte al carrello o acquisti.

`npm run package` genera `dist/sorpresa/` e `dist/sorpresa-1.0.0.zip` (richiede l’utilità `zip`). Lo ZIP contiene solo l’estensione installabile.

```text
extension/
  manifest.json       Permessi e punti di ingresso
  background.js       Scritture serializzate, immagini, badge
  content/            Rilevamento prezzi ed estrazione del prodotto
  lib/                Validazione link, CSV e utilità di interfaccia
  popup/              Interruttore e salvataggio rapido
  collection/         Lista completa e impaginazione PDF
tests/                Verifiche essenziali dei flussi
scripts/              Controllo sintassi e pacchetto ZIP
```

Riferimenti ufficiali: [content script e document_start](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [archiviazione locale](https://developer.chrome.com/docs/extensions/reference/api/storage), [test delle estensioni con Playwright](https://playwright.dev/docs/chrome-extensions).

Verifica del 27 ottobre 2026: 4 test unitari e 7 scenari nel browser superati; controllate quattro pagine reali dei negozi, con salvataggio di due foto reali ed esportazione PDF offline. La revisione ha verificato anche righe miste prezzo/consegna, percentuali e aggiornamenti dei prezzi in più passaggi.
