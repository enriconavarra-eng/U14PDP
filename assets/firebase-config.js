/* ============================================================
   CONFIGURAZIONE FIREBASE — sincronizzazione automatica multi-device
   (tablet + PC, piu' utenti contemporaneamente).

   Finche' questo file resta con i valori segnaposto qui sotto,
   l'app funziona esattamente come prima: solo in locale, salvando
   sul singolo dispositivo (nessun errore, nessuna funzione persa).

   COME ATTIVARE LA SINCRONIZZAZIONE (una tantum, gratis):
   1) Vai su https://console.firebase.google.com e accedi con un
      account Google (puo' essere lo stesso usato per il backup Drive).
   2) "Aggiungi progetto" > dai un nome (es. "Rugby U14 Pasian") >
      puoi disattivare Google Analytics (non serve) > Crea progetto.
   3) Nel menu a sinistra vai su "Compilazione" > "Firestore Database"
      > "Crea database" > scegli una posizione europea (es. eur3) >
      avvia in "modalita' produzione" > Attiva.
   4) Vai su "Compilazione" > "Authentication" > "Inizia" > nella
      scheda "Sign-in method" abilita il provider "Anonimo" > Salva.
   5) Torna alla panoramica del progetto (icona ingranaggio in alto >
      "Impostazioni progetto"). In basso, in "Le tue app", clicca
      sull'icona web "</>" per aggiungere un'app web.
      - Soprannome app: "Rugby U14 App" > Registra app.
      - Non serve Firebase Hosting.
   6) Ti verra' mostrato un blocco "firebaseConfig" con delle chiavi.
      Copia i valori (apiKey, authDomain, projectId, storageBucket,
      messagingSenderId, appId) e incollali qui sotto al posto dei
      segnaposto "INSERISCI_QUI...".
   7) Vai su Firestore Database > scheda "Regole" e incolla le regole
      indicate nella guida GUIDA-CONFIGURAZIONE.md, poi Pubblica.
   8) Salva questo file e ripubblica l'app (vedi GUIDA-CONFIGURAZIONE.md).
      Da quel momento tutti i dispositivi che aprono l'app si
      sincronizzano automaticamente tra loro, anche usati insieme.
============================================================ */
window.RUGBY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyByoxCRDUr17TkmBUEgRG5QQZwSLSym3so",
  authDomain: "u14pdp.firebaseapp.com",
  projectId: "u14pdp",
  storageBucket: "u14pdp.firebasestorage.app",
  messagingSenderId: "624280575412",
  appId: "1:624280575412:web:f401a5f4fa11dbaccb66e1"
};
