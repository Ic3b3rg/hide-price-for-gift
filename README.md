# Sorpresa

Estensione Chrome per scegliere regali su **Amazon.it e Zalando.it** senza mostrare i prezzi dei prodotti. Raccoglie idee con foto e link in una lista locale, esportabile in PDF o CSV per Excel.

## Funzioni

- Modalità regalo persistente, con interruttore e badge `ON` / `OFF`.
- Prezzi nascosti nei risultati di ricerca e nelle **schede di dettaglio**, comprese varianti, menu delle taglie, altre offerte e barre fisse.
- Aggiornamento automatico durante scorrimento, navigazione e caricamento dinamico.
- Fino a 150 prodotti salvati con nome, foto principale e link, senza duplicati.
- PDF con foto e link cliccabili; CSV con nome, negozio, link al prodotto e all’immagine.

Vengono nascosti **solo i prezzi dei prodotti**, inclusi prezzi precedenti e unitari. Spedizione, totali del carrello e sconti percentuali restano visibili: il totale del carrello può quindi rivelare la spesa.

## Build

Requisiti: **Node.js 22+**, npm e il comando `zip` nel terminale. Su macOS `zip` è già disponibile; sugli altri sistemi installalo se manca.

```sh
git clone https://github.com/Ic3b3rg/hide-price-for-gift.git
cd hide-price-for-gift
npm ci
npm run build
```

La build controlla sintassi, versione, risorse e permessi del manifest, poi genera:

- **`dist/sorpresa/`**: cartella pronta da caricare in Chrome.
- **`dist/sorpresa-<versione>.zip`**: archivio da condividere o conservare.

Il codice non richiede compilazione e non ci sono dipendenze di produzione: la build prepara una copia installabile dei sorgenti. `npm run package` resta disponibile come alias di `npm run build`.

## Installazione manuale in Chrome

Serve **Google Chrome 120 o successivo**.

1. Dopo la build, individua **`dist/sorpresa/`**. Se hai ricevuto lo ZIP, estrailo e usa la cartella **`sorpresa`**.
2. Apri Chrome e digita **`chrome://extensions`** nella barra degli indirizzi.
3. Attiva **Modalità sviluppatore**, in alto a destra.
4. Premi **Carica estensione non pacchettizzata** e seleziona la cartella del punto 1. Deve contenere direttamente `manifest.json`: non selezionare lo ZIP o la radice del repository.
5. Dal menu delle estensioni di Chrome (icona del puzzle), fissa **Sorpresa** alla barra degli strumenti.
6. Ricarica le schede Amazon/Zalando già aperte. Il badge `ON` indica che la modalità regalo è attiva.

Conserva la cartella scelta: Chrome continua a leggerne i file. Se hai già i sorgenti, puoi anche caricare direttamente **`extension/`** con la stessa procedura, senza eseguire comandi né installare Node.js.

Riferimento: [installazione delle estensioni non pacchettizzate, guida ufficiale di Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Utilizzo

1. **Scegli il regalo.** La modalità regalo è attiva fin dall’installazione in tutte le schede dei due negozi. L’interruttore nel popup ripristina o nasconde i prezzi senza ricaricare.
2. **Salva un’idea.** Apri la pagina di un singolo prodotto, premi l’icona di Sorpresa e poi **Salva questo prodotto**. Vengono conservati nome, foto principale e link senza parametri di tracciamento.
3. **Consulta la lista.** Premi **Apri lista** per aprire i prodotti nel negozio o rimuoverli singolarmente.
4. **Esporta.** **Esporta PDF** apre la lista: premi **Salva come PDF** e scegli la destinazione omonima nella finestra di stampa. **CSV per Excel** scarica direttamente il file.

Il PDF include le foto salvate. Il CSV contiene collegamenti alle immagini, senza incorporarle; usa UTF-8 e il separatore `;`, adatto a Excel in italiano.

## Aggiornamento

Se usi la cartella generata dalla build, dalla directory del progetto esegui:

```sh
git pull --ff-only
npm ci
npm run build
```

Poi apri `chrome://extensions`, premi **Ricarica** sulla scheda di Sorpresa e ricarica le pagine dei negozi. Se usi direttamente `extension/`, la build non serve. Se hai installato uno ZIP, sostituisci i file nella stessa cartella prima di premere **Ricarica**.

Mantieni la stessa cartella e lo stesso profilo Chrome per conservare la lista. Non disinstallare l’estensione per aggiornarla: la rimozione elimina i suoi dati locali. Esporta la lista prima di disinstallare o cambiare profilo.

## Dati e permessi

La lista resta nel profilo locale di Chrome e non viene sincronizzata tra dispositivi. Non servono account o servizi applicativi esterni. Le foto vengono ridimensionate e salvate localmente, così lista e PDF funzionano anche offline. Se una foto non è scaricabile, il prodotto viene comunque salvato con il link originale all’immagine e il popup mostra un avviso.

L’estensione usa il permesso `storage` per modalità e lista. L’accesso ai siti è limitato ad Amazon.it, Zalando.it e ai relativi CDN delle immagini; le richieste aggiuntive servono a scaricare le foto. Non effettua accessi, aggiunte al carrello o acquisti.

## Limiti e problemi comuni

Il supporto riguarda le versioni italiane HTTPS dei negozi. I prezzi incorporati in immagini o video non vengono riconosciuti. Un cambiamento nella struttura dei siti può richiedere un aggiornamento delle regole.

| Problema | Soluzione |
| --- | --- |
| Prezzi ancora visibili | Controlla il badge `ON`, verifica di essere su Amazon.it o Zalando.it e ricarica la pagina. Dopo un aggiornamento, ricarica prima l’estensione. |
| Salvataggio non disponibile | Apri una scheda di dettaglio, attendi il caricamento del prodotto e riapri il popup. |
| Chrome non trova il manifest | Seleziona la cartella che contiene direttamente `manifest.json`, non il repository o lo ZIP. |
| Foto mancante | Il link al prodotto resta disponibile; il negozio potrebbe aver impedito il download. |
| Build: comando `zip` non trovato | Installa `zip` e assicurati che sia nel `PATH`, poi ripeti la build. Puoi anche caricare direttamente `extension/`. |

## Sviluppo e verifiche

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run test:browser
```

| Comando | Funzione |
| --- | --- |
| `npm run build` | Controlla i sorgenti e genera cartella installabile e ZIP in `dist/`. |
| `npm run check` | Controlla sintassi JavaScript, risorse, versione e permessi del manifest. |
| `npm test` | Verifica identità dei prodotti, URL delle foto ed esportazione CSV. |
| `npm run test:browser` | Carica l’estensione in un profilo Chromium temporaneo e verifica i flussi su pagine controllate. |
| `npm run test:live` | Controlla cinque pagine reali e il cambio taglia su Zalando. Richiede rete e può incontrare blocchi dei negozi. |

La suite ripetibile copre prezzi suddivisi tra più elementi, scorrimento, mutazioni, navigazione, dettagli prodotto e varianti, interruttore tra più schede, salvataggio, duplicati, foto offline, CSV, stampa PDF e rimozione. Non dipende dalle API o dalla disponibilità dei negozi.

Il controllo sui siti reali salva schermate, un rapporto e un PDF offline in `artifacts/verification/`. I test usano profili temporanei e non modificano il profilo Chrome personale.

## Struttura del progetto

```text
extension/
  manifest.json           Permessi e punti di ingresso
  background.js           Comandi, scritture serializzate e badge
  content/
    guard.js              Classificazione e mascheramento dei prezzi
    guard.css             Regole caricate prima del rendering
    product.js            Estrazione di titolo, foto e link
  lib/
    catalog.js            Validazione URL, identità dei prodotti e CSV
    thumbnail.js          Download e ridimensionamento delle foto
    ui.js                 Elementi condivisi e download CSV
  popup/                  Interruttore e salvataggio rapido
  collection/             Lista completa e impaginazione per la stampa
scripts/                  Controlli, build e verifica sui siti reali
tests/                    Test unitari e scenari nel browser
```

Le regole CSS vengono caricate a `document_start`; un `MutationObserver` aggiorna le maschere prima del rendering quando cambia il DOM. Nei nodi con prezzo e altri testi, CSS Custom Highlight nasconde solo i caratteri dell’importo, senza riscrivere il contenuto del negozio.

Riferimenti: [content script di Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [archiviazione locale](https://developer.chrome.com/docs/extensions/reference/api/storage), [test delle estensioni con Playwright](https://playwright.dev/docs/chrome-extensions). I requisiti concordati sono in [PRODUCT.md](PRODUCT.md).
