# Sorpresa

## Scopo

Scegliere un regalo insieme alla persona che lo riceverà, nascondendo i prezzi dei prodotti durante la navigazione su Amazon.it e Zalando.it.

## Funzioni concordate

- Modalità regalo che continua a funzionare scorrendo, ricaricando e cambiando pagina.
- Solo prezzi dei prodotti nascosti: spedizione, sconti percentuali e totali restano visibili.
- Una lista locale di idee con nome, link e immagine principale del prodotto.
- Esportazione scaricabile, senza prezzi.
- Implementazione semplice, pulita e organizzata; verifiche concentrate sul funzionamento effettivo.

## Scelte di implementazione

Scelte tecniche dell’implementazione: estensione Chrome Manifest V3 in JavaScript, HTML e CSS, senza dipendenze di produzione; attiva per impostazione predefinita, con interruttore persistente; PDF tramite stampa del browser e CSV compatibile con Excel. Nessun account o servizio applicativo esterno. Le sole richieste dell’estensione scaricano le immagini dei prodotti dai CDN dei negozi.
