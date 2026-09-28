# Rugby U14 - Pasian di Prato — Guida alla pubblicazione e al backup su Drive

Questa cartella contiene un'app web installabile (PWA), semplificata in
un'unica pagina per ogni giocatore: una pagina Home con l'annata
sportiva, una pagina **Squadra** (rosa condivisa dei giocatori, dove si
aggiungono/modificano i giocatori) e, per ogni giocatore, una pagina
**Giocatore** che raccoglie in un solo posto la sua **Valutazione**
(allenatore — con supporto per **piu' tecnici** che valutano lo stesso
giocatore), la sua **Autovalutazione**, i suoi **Obiettivi** e la
**Panoramica** di confronto tra tutte le valutazioni (ogni tecnico piu'
l'autovalutazione del giocatore), sempre suddivise per periodo
(Settembre/Gennaio/Maggio). C'e' anche una pagina **Riepilogo Squadra**
da cui scaricare il PDF riassuntivo di ciascun giocatore o di tutta la
squadra. Il backup manuale su una cartella dedicata di Google Drive
resta disponibile (dalla pagina Squadra) come rete di sicurezza in piu',
e (opzionale, vedi Parte 4) c'e' la **sincronizzazione automatica
multi-dispositivo** tramite Firebase, che tiene i dati sempre allineati
e aggiornati alla versione piu' recente su tutti i dispositivi collegati.

Per funzionare come app installabile e per il backup su Drive, l'app deve
essere pubblicata su un indirizzo web vero (non basta piu' aprire il file
sul tablet). Se e' la prima volta, segui la Parte 1 e la Parte 2 qui sotto.
Se hai gia' pubblicato l'app in precedenza e stai solo aggiornando alle
nuove funzioni, leggi prima la sezione **"Aggiornare un'app gia'
pubblicata"** subito dopo questo paragrafo.

---

## Aggiornare un'app gia' pubblicata (solo se hai gia' fatto Parte 1 e 2)

Questo pacchetto e' un aggiornamento: contiene tutti i file della tua app
(compresa la nuova pagina unica **Giocatore**, che sostituisce le
vecchie pagine separate Valutazione/Autovalutazione/Confronto) con il
tuo Client ID di Google gia' inserito in `assets/drive-backup.js`,
quindi **non devi rifare la configurazione di Google Cloud per il
backup su Drive**. Se avevi gia' attivato la sincronizzazione
automatica multi-dispositivo (Parte 4), continua a funzionare senza
bisogno di rifare la configurazione: i dati e la struttura su Firebase
non sono cambiati. Per ripubblicare i file:

1. Apri il tuo repository su GitHub (quello che avevi creato, es.
   `enriconavarra-eng/U14PDP`).
2. **Elimina le cartelle vecchie** `valutazione`, `autovalutazione` e
   `confronto` dal repository (aprile una alla volta, poi l'icona del
   cestino o "Delete directory" in alto a destra nella vista file) — sono
   state sostituite dalla nuova cartella `giocatore` e non servono piu'.
3. Apri la cartella `pwa` che hai ricevuto ora, seleziona **tutto** il suo
   contenuto (tutti i file e le cartelle: `index.html`, `manifest.json`,
   `service-worker.js`, `assets`, `icons`, `giocatore`, `squadra`,
   `riepilogo`) e trascinali nella pagina del repository su GitHub ("Add
   file" > "Upload files"). GitHub ti chiedera' se vuoi sostituire i file
   gia' esistenti con lo stesso nome: conferma. La cartella nuova
   (`giocatore`) verra' semplicemente aggiunta.
4. Scrivi un messaggio tipo "Aggiornamento: pagina Giocatore unica,
   valutazione a pulsanti" e clicca **Commit changes**. Dopo 1-2 minuti
   GitHub Pages pubblica la nuova versione.
5. **Importante — sul tablet**: chiudi del tutto l'app installata (non
   basta metterla in secondo piano: rimuovila dalle app recenti/multitasking
   di Android) e riaprila. Il file `service-worker.js` in questo pacchetto
   ha gia' un numero di versione piu' alto (serve proprio a far scaricare
   la nuova versione ai tablet che avevano gia' l'app installata), quindi
   al riavvio l'app si aggiornera' da sola. Se non vedi le novita', prova
   a riaprire l'app una seconda volta (la prima riapertura scarica
   l'aggiornamento, la seconda lo mostra).
6. I dati che avevi gia' inserito (giocatori, valutazioni, autovalutazioni)
   restano sul tablet: al primo avvio dopo l'aggiornamento l'app li
   importa automaticamente nella nuova pagina Squadra, in una stagione
   creata di default con l'annata sportiva corrente. Da li' potrai
   spostarli in una nuova stagione quando vuoi, dalla pagina Squadra.

---

## Parte 1 — Pubblicare l'app online con GitHub Pages (gratis)

1. Vai su https://github.com e crea un account gratuito (basta un'email).
2. Una volta dentro, clicca sul "+" in alto a destra > **New repository**.
   - Nome repository: `rugby-u14-pasian` (o quello che preferisci)
   - Visibilita': **Public**
   - Non aggiungere README, .gitignore ecc. — lascialo vuoto.
   - Clicca **Create repository**.
3. Nella pagina del repository appena creato, clicca su **uploading an
   existing file** (o "Add file" > "Upload files").
4. Trascina dentro TUTTI i file e le cartelle presenti in questo pacchetto
   (`index.html`, `manifest.json`, `service-worker.js`, la cartella
   `assets`, la cartella `icons`, la cartella `giocatore`, la cartella
   `squadra`, la cartella `riepilogo`) mantenendo la stessa struttura di
   cartelle.
   GitHub supporta il trascinamento di intere cartelle da Chrome/Edge su
   computer; se usi Safari trascina i file singolarmente ricreando le
   sottocartelle con "Add file > Create new file" e scrivendo il percorso
   (es. `icons/icon-192.png`).
5. In fondo alla pagina scrivi un messaggio tipo "Prima pubblicazione" e
   clicca **Commit changes**.
6. Vai su **Settings** (in alto nel repository) > **Pages** (nel menu a
   sinistra).
7. In "Build and deployment" > "Source" scegli **Deploy from a branch**,
   branch **main**, cartella **/(root)**, poi **Save**.
8. Dopo 1-2 minuti la pagina ti mostrera' l'indirizzo pubblico, del tipo:
   `https://tuonome.github.io/rugby-u14-pasian/`
   Aprilo per verificare che l'app funzioni. **Segna questo indirizzo**:
   ti servira' al passaggio successivo.

> Ogni volta che vorrai aggiornare l'app in futuro, basta ricaricare i
> file modificati nello stesso repository (Add file > Upload files):
> GitHub Pages si aggiorna da solo in 1-2 minuti.

---

## Parte 2 — Attivare il backup automatico su Google Drive

### 2.1 Crea il progetto Google Cloud (gratuito, nessuna carta richiesta)

1. Vai su https://console.cloud.google.com e accedi con l'account Google
   che vuoi usare per i backup (es. quello del club).
2. In alto clicca sul selettore progetti > **New Project**.
   - Nome progetto: `Rugby U14 Backup` (o quello che preferisci)
   - Clicca **Create** e attendi qualche secondo.
3. Assicurati che il progetto appena creato sia selezionato in alto.

### 2.2 Abilita la Google Drive API

1. Nel menu (☰) vai su **APIs & Services > Library**.
2. Cerca "Google Drive API" e aprila.
3. Clicca **Enable**.

### 2.3 Configura la schermata di consenso OAuth

1. Vai su **APIs & Services > OAuth consent screen**.
2. Tipo utente: **External** > **Create**.
3. Compila i campi obbligatori (nome app "Rugby U14 Pasian di Prato",
   la tua email nei campi richiesti) e vai avanti (Save and Continue)
   nelle schermate successive senza aggiungere scope manualmente.
4. Nella schermata **Test users**, clicca **Add users** e aggiungi
   l'indirizzo Gmail (o Google Workspace) che userai per autorizzare il
   backup (puoi aggiungerne piu' di uno, es. allenatore + dirigente).
5. Salva e torna alla dashboard. L'app restera' in modalita' **Testing**:
   va benissimo per questo uso, non serve pubblicarla ne' farla verificare
   da Google (la verifica serve solo per app pubbliche con molti utenti).

### 2.4 Crea le credenziali OAuth

1. Vai su **APIs & Services > Credentials**.
2. Clicca **Create Credentials > OAuth client ID**.
3. Tipo applicazione: **Web application**.
4. Nome: "Rugby U14 App".
5. In **Authorized JavaScript origins** clicca **Add URI** e incolla
   l'indirizzo di GitHub Pages ottenuto prima, **senza slash finale**,
   ad esempio: `https://tuonome.github.io`
   (solo il dominio, non il percorso completo della pagina).
6. Clicca **Create**. Ti verra' mostrato un **Client ID** del tipo:
   `123456789-abcdefg.apps.googleusercontent.com`
   Copialo.

### 2.5 Inserisci il Client ID nell'app

1. Apri il file `assets/drive-backup.js` (dentro il pacchetto che ti ho
   inviato, oppure direttamente su GitHub cliccando sul file e poi sulla
   matita "Edit").
2. Trova la riga:
   ```
   var CLIENT_ID = "INSERISCI_QUI_IL_TUO_CLIENT_ID.apps.googleusercontent.com";
   ```
3. Sostituisci il testo tra virgolette con il Client ID copiato al passo
   precedente. Deve restare tra virgolette, es.:
   ```
   var CLIENT_ID = "123456789-abcdefg.apps.googleusercontent.com";
   ```
4. Salva/carica di nuovo il file su GitHub (Commit changes). Dopo 1-2
   minuti GitHub Pages si aggiorna da solo.

---

## Parte 3 — Installare l'app sul tablet e usare il backup

1. Sul tablet Android apri **Chrome** e vai all'indirizzo di GitHub Pages
   (es. `https://tuonome.github.io/rugby-u14-pasian/`).
2. Tocca i tre puntini in alto a destra > **Installa app** (oppure
   "Aggiungi a schermata Home"). Comparira' un'icona con lo stemma del
   club nella home del tablet: da quel momento si apre come un'app vera,
   a schermo intero, anche offline.
3. Nella pagina **Squadra**, tocca il pulsante **☁ Drive** in alto. La
   prima volta comparira' la richiesta di accesso Google: accedi con
   l'account che hai autorizzato come "test user" al passo 2.3 e concedi
   il permesso.
4. L'app creera' automaticamente su Google Drive una cartella chiamata
   **"Backup Rugby U14 - Pasian di Prato"** e salvera' dentro tre file
   (`backup_squadra.json`, `backup_valutazione.json` e
   `backup_autovalutazione.json`) con tutti i dati di rosa, valutazioni e
   autovalutazioni. Ogni volta che tocchi di nuovo "Drive" i file vengono
   aggiornati con i dati più recenti — niente duplicati.

### Nota sulla connessione Google

Google richiede di norma di riconfermare l'accesso ogni tanto (in genere
resta valido per diverse settimane su un dispositivo gia' autorizzato).
Se il backup dovesse fallire con un messaggio di autorizzazione, basta
toccare di nuovo "Drive" e riconfermare l'accesso Google: e' normale e
richiede pochi secondi.

---

## Parte 4 — Sincronizzazione automatica multi-dispositivo (facoltativa)

Il backup su Drive del Parte 2 e' manuale (bisogna toccare il pulsante
"Drive") e riguarda un dispositivo alla volta. Se invece vuoi che **piu'
tablet/PC usati da piu' persone contemporaneamente (fino a 3) vedano
sempre gli stessi dati aggiornati in automatico**, senza dover premere
nulla, puoi attivare la sincronizzazione con **Firebase** (un servizio
gratuito di Google per questo scopo). E' del tutto facoltativa: se non
la configuri, l'app continua a funzionare come prima, salvando solo sul
dispositivo in uso.

### 4.1 Crea il progetto Firebase (gratuito)

1. Vai su https://console.firebase.google.com e accedi con un account
   Google (puo' essere lo stesso del backup Drive).
2. Clicca **"Aggiungi progetto"**, dai un nome (es. "Rugby U14 Pasian"),
   clicca Continua. Puoi disattivare Google Analytics (non serve per
   questa app). Clicca **Crea progetto** e attendi.

### 4.2 Attiva Firestore Database

1. Nel menu a sinistra vai su **Compilazione > Firestore Database**.
2. Clicca **Crea database**.
3. Scegli una posizione europea (es. `eur3 (europe-west)`).
4. Avvia in **modalita' produzione**, poi **Attiva**.

### 4.3 Attiva l'accesso anonimo

1. Nel menu a sinistra vai su **Compilazione > Authentication**.
2. Clicca **Inizia**, poi nella scheda **Sign-in method** clicca
   **Aggiungi nuovo provider** e scegli **Anonimo**.
3. Attivalo (interruttore su ON) e clicca **Salva**.
   (Non serve creare account/password per nessuno: ogni dispositivo si
   identifica da solo in modo anonimo, e' solo un modo tecnico per
   permettere all'app di leggere/scrivere su Firestore in sicurezza.)

### 4.4 Registra l'app web e copia la configurazione

1. Clicca sull'icona a forma di ingranaggio in alto > **Impostazioni
   progetto**.
2. In basso, sezione "Le tue app", clicca sull'icona web **&lt;/&gt;**.
3. Soprannome app: "Rugby U14 App" > **Registra app**. Non serve
   Firebase Hosting: salta pure quel passaggio.
4. Comparira' un blocco di codice `firebaseConfig` con dei valori tipo:
   ```
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "rugby-u14-pasian.firebaseapp.com",
     projectId: "rugby-u14-pasian",
     storageBucket: "rugby-u14-pasian.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
   Tieni aperta questa pagina, ti servono questi valori al passo dopo.

### 4.5 Inserisci la configurazione nell'app

1. Apri il file `assets/firebase-config.js` (nel pacchetto ricevuto,
   oppure direttamente su GitHub cliccando sul file e poi sulla matita
   "Edit").
2. Sostituisci i valori segnaposto `INSERISCI_QUI...` con i valori
   copiati al passo 4.4, mantenendo le virgolette, es.:
   ```
   window.RUGBY_FIREBASE_CONFIG = {
     apiKey: "AIzaSy...",
     authDomain: "rugby-u14-pasian.firebaseapp.com",
     projectId: "rugby-u14-pasian",
     storageBucket: "rugby-u14-pasian.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
3. Salva/carica di nuovo il file su GitHub (Commit changes).

### 4.6 Regole di sicurezza di Firestore

1. Torna alla console Firebase > **Firestore Database** > scheda
   **Regole**.
2. Sostituisci il contenuto con:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   Questo permette la lettura/scrittura solo a chi ha aperto l'app (e
   quindi si e' autenticato in modo anonimo come al passo 4.3) — nessun
   altro puo' leggere o modificare i dati della squadra.
3. Clicca **Pubblica**.

### 4.7 Aggiorna l'app sui dispositivi

1. Ripubblica i file su GitHub Pages come descritto all'inizio di
   questa guida (sezione "Aggiornare un'app gia' pubblicata").
2. Su ogni tablet/PC, chiudi del tutto l'app installata e riaprila (la
   prima riapertura scarica l'aggiornamento, la seconda lo mostra).
3. In alto in ogni pagina comparira' un piccolo indicatore di stato
   della sincronizzazione ("Sincronizzato", "Connessione...", "Solo su
   questo dispositivo" se non configurato). Da questo momento, tutti i
   dispositivi che aprono l'app con questa configurazione si tengono
   allineati automaticamente, anche usati insieme.

### Come funziona in pratica (e i suoi limiti)

- Ogni giocatore viene sincronizzato separatamente: se un tecnico sta
  valutando Mario e un altro sta valutando Luca nello stesso momento su
  due dispositivi diversi, non c'e' alcun conflitto.
- Anche sullo **stesso** giocatore, due tecnici diversi possono
  valutare in contemporanea senza sovrascriversi: ognuno "possiede" la
  propria fetta di dati (identificata dal nome inserito la prima volta
  che si apre la pagina di un Giocatore su quel dispositivo — tocca
  l'icona &#128100; in alto per cambiarlo).
- L'autovalutazione del giocatore e i dati anagrafici della rosa
  seguono invece la logica "ultima modifica vince": va benissimo per
  questi casi, dato che di norma c'e' una sola persona alla volta che
  li modifica (il giocatore stesso, o chi gestisce la rosa).
- La sincronizzazione richiede una connessione internet (Wi-Fi o dati
  mobili) per aggiornarsi tra dispositivi diversi; se un tablet resta
  offline, continua a funzionare in locale e si riallinea da solo
  appena torna online.
- Il backup manuale su Google Drive (Parte 2) resta comunque
  disponibile e utile come copia di sicurezza indipendente.

---

## Come funziona la nuova struttura (Squadra, Giocatore, PDF)

La struttura e' stata semplificata: ogni giocatore ha adesso **un'unica
pagina** con tutto quello che lo riguarda, invece di tre pagine separate.

- **Home** → scegli o crea l'**annata sportiva** (es. 2026/2027), poi
  tocca "Vai alla Rosa".
- **Squadra** → qui gestisci l'elenco dei giocatori di quella stagione:
  nome, anno di nascita, ruoli, foto (con la possibilita' di modificare
  ogni giocatore o aggiungerne di nuovi), e da qui tocchi "Apri scheda"
  su un giocatore per entrare nella sua pagina. E' anche il posto dove si
  fa il backup manuale su Drive (pulsante **☁ Drive** in alto).
- **Giocatore** → la pagina di ogni singolo giocatore, sempre suddivisa
  per periodo (Settembre/Gennaio/Maggio), con quattro sezioni:
  - **Valutazione** → la scheda tecnica compilata dall'allenatore, ora
    con semplici pulsanti (come nell'Autovalutazione) al posto delle
    barre a scorrimento. Se piu' di un tecnico usa l'app, ognuno tocca
    l'icona &#128100; in alto e inserisce il proprio nome: le valutazioni
    di ciascun tecnico restano distinte e comparabili tra loro, e nessuno
    sovrascrive i dati di un collega sullo stesso giocatore.
  - **Autovalutazione** → come si vede il giocatore, sempre a pulsanti.
  - **Obiettivi** → gli obiettivi personali, tecnici e di ruolo del
    giocatore.
  - **Panoramica** → mette a confronto TUTTE le valutazioni disponibili
    sulle stesse quattro aree (Tecnica, Lettura del gioco, Fisico, Testa
    e Squadra): una linea colorata per ciascun tecnico che lo ha
    valutato, piu' la sua autovalutazione, con un grafico radar, una
    tabella comparativa e il pulsante per scaricare il PDF del giocatore.
- **Riepilogo Squadra** → resta una pagina a se' stante, con la tabella
  delle medie di tutti i giocatori della stagione scelta (media tra i
  tecnici quando sono piu' di uno), un pulsante PDF per ciascuno e un
  pulsante per scaricare un unico PDF con tutta la squadra (un giocatore
  per pagina).

Nota: per ulteriore semplicita', i vecchi pulsanti di esportazione/
importazione di un file JSON locale (usati raramente) sono stati tolti:
restano il backup su Google Drive e la sincronizzazione automatica
(Parte 4) come modi per salvare e recuperare i dati.

### Il pulsante "Scarica PDF"

Il PDF non si scarica con un click diretto: si apre una pagina di
anteprima gia' formattata e parte automaticamente la finestra di stampa
del tablet. Nella finestra di stampa, come "Stampante" scegli **"Salva
come PDF"**: il file verra' salvato nella cartella Download del tablet
(o dove preferisci). E' il modo piu' affidabile per avere un vero file
PDF anche offline, senza bisogno di librerie esterne. Se la finestra di
stampa non si apre da sola, tocca il pulsante "🖨 Stampa / Salva PDF" in
alto nella pagina di anteprima.

---

## Serve una mano dal vivo?

Se vuoi, posso guidarti passo passo mentre segui la procedura (dimmi
quando sei pronto/a a partire dalla Parte 1), oppure — se colleghi
questo computer alla conversazione — posso provare a eseguire alcuni
passaggi al posto tuo nel browser.
