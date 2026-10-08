/* ============================================================
   CLOUD SYNC — sincronizzazione automatica multi-dispositivo
   (tablet + PC, piu' utenti anche in contemporanea) via Firebase
   Firestore. Modulo condiviso da tutte le pagine dell'app.

   Se assets/firebase-config.js non e' stato compilato (vedi quel
   file), questo modulo resta "disabilitato": tutte le sue funzioni
   pubbliche diventano no-op sicuri e l'app continua a funzionare
   esattamente come prima, solo in locale (localStorage).

   Quando invece e' configurato:
   - ogni dispositivo si autentica in modo anonimo su Firebase;
   - i dati della rosa (Squadra), delle valutazioni tecniche, delle
     autovalutazioni e delle misure fisiche (altezza/peso) vengono
     specchiati in Firestore, un documento per giocatore (cosi' due
     tecnici che lavorano su DUE giocatori diversi, o anche sullo
     stesso in momenti diversi, non si sovrascrivono mai a vicenda);
   - per la scheda Valutazione, ogni tecnico scrive SOLO la propria
     fetta di dati (identificata dal suo nome/tecnicoId), quindi due
     tecnici possono valutare lo stesso giocatore anche nello stesso
     momento senza perdere i dati l'uno dell'altro;
   - ogni pagina aperta riceve gli aggiornamenti in tempo reale
     (tramite onDataChange) e puo' aggiornare la propria vista.
============================================================ */
(function(window){
"use strict";

var KEY_SQUADRA = 'rugbyU14_squadra_v1';
var KEY_VAL = 'rugbyU14_valutazioni_v2';
var KEY_AUTO = 'rugbyU14_autovalutazione_v1';
var KEY_FISICO = 'rugbyU14_fisico_v1';
var CACHE_KEY = 'rugbyU14_cloudCache_v1';
var DEVICE_KEY = 'rugbyU14_deviceId';
var PERIOD_KEYS = ['settembre', 'gennaio', 'maggio'];
var FB_VERSION = '10.13.0';
var PUSH_DEBOUNCE_MS = 900;

var cfg = window.RUGBY_FIREBASE_CONFIG || null;

function isConfigured(){
  return !!(cfg && cfg.apiKey && String(cfg.apiKey).indexOf('INSERISCI_QUI') === -1);
}

var db = null;
var sdkReady = false;
var initStarted = false;
var ctx = { tecnicoId: null, tecnicoNome: null };
var statusState = { state: isConfigured() ? 'connecting' : 'disabled', message: '' };
var statusListeners = [];
var dataListeners = {};
var timers = {};
var pendingDirty = {};

/* Aumentare quando si corregge un bug nella logica di "cosa ho gia'
   sincronizzato": azzera la cache su ogni dispositivo al primo avvio
   con la nuova versione, cosi' tutto viene ricontrollato da capo con la
   logica corretta (innocuo: la cache serve solo a evitare invii/letture
   ripetuti, non contiene dati reali; niente viene cancellato in locale
   o nel cloud, solo re-inviato/re-scaricato una volta). */
var CACHE_SCHEMA_VERSION = 2;
function defaultCache(){
  return { schemaVersion: CACHE_SCHEMA_VERSION, squadraMeta: null, squadraPlayers: {}, valSlices: {}, valReceived: {}, autoPlayers: {}, fisicoPlayers: {} };
}
function loadCache(){
  var c = defaultCache();
  try{
    var raw = localStorage.getItem(CACHE_KEY);
    if(raw){
      var parsed = JSON.parse(raw);
      if(parsed.schemaVersion === CACHE_SCHEMA_VERSION){
        Object.keys(c).forEach(function(k){ if(parsed[k]) c[k] = parsed[k]; });
      }
      /* se la versione non corrisponde (o manca, cioe' cache vecchia),
         si riparte volutamente da una cache vuota */
    }
  }catch(e){}
  return c;
}
var cache = loadCache();
var cacheSaveTimer = null;
function saveCacheSoon(){
  if(cacheSaveTimer) return;
  cacheSaveTimer = setTimeout(function(){
    cacheSaveTimer = null;
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }catch(e){}
  }, 300);
}

function getDeviceId(){
  var id = null;
  try{ id = localStorage.getItem(DEVICE_KEY); }catch(e){}
  if(!id){
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    try{ localStorage.setItem(DEVICE_KEY, id); }catch(e){}
  }
  return id;
}

function readJson(key){
  try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function writeJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(e){}
}

/* ---------------- stato e notifiche ---------------- */
function setStatus(state, message){
  statusState = { state: state, message: message || '' };
  statusListeners.forEach(function(cb){ try{ cb(statusState); }catch(e){} });
}
function onStatusChange(cb){ statusListeners.push(cb); try{ cb(statusState); }catch(e){} }
function getStatus(){ return statusState; }

function onDataChange(storageKey, cb){
  if(!dataListeners[storageKey]) dataListeners[storageKey] = [];
  dataListeners[storageKey].push(cb);
}
function fireDataChange(storageKey){
  (dataListeners[storageKey] || []).forEach(function(cb){ try{ cb(); }catch(e){} });
}

function setTecnico(id, nome){
  ctx.tecnicoId = id;
  ctx.tecnicoNome = nome || id;
  if(pendingDirty[KEY_VAL]) debouncePush(KEY_VAL);
  maybeBootstrapValPush();
}

/* ---------------- invio iniziale dei dati gia' presenti ----------------
   Se questo dispositivo aveva gia' rosa/valutazioni/autovalutazioni/
   misure fisiche salvate in locale PRIMA di configurare la
   sincronizzazione (o prima di essersi mai connesso con successo),
   quei dati non verrebbero mai inviati al cloud da soli:
   notifyLocalChange() parte solo quando l'utente modifica qualcosa.
   Per evitare che restino "intrappolati" su un solo dispositivo, la
   prima volta che questo dispositivo si connette con successo
   inviamo una volta sola tutto cio' che ha gia' in locale. E'
   innocuo da richiamare piu' volte: i flag sotto fanno si' che
   avvenga una sola volta per dispositivo, e le funzioni pushX
   inviano comunque solo cio' che differisce dall'ultima cache nota. */
var BOOTSTRAP_KEY = 'rugbyU14_cloudBootstrap_v1';
var BOOTSTRAP_VAL_KEY = 'rugbyU14_cloudBootstrapVal_v1';
var SAFE_MODE_KEY = 'rugbyU14_syncSafeMode';
var SAFE_MODE_PUSH_WAIT_MS = 3500;

/* ---------------- "sincronizzazione sicura" (invia prima di ricevere) ----------------
   Attivata da un pulsante dell'app (vedi requestSafeModeOnNextLoad): al
   prossimo avvio, PRIMA di ascoltare qualsiasi aggiornamento dal cloud,
   invia tutto cio' che questo dispositivo ha gia' in locale (rosa,
   autovalutazioni, misure fisiche, e le valutazioni del tecnico
   configurato qui). Solo dopo una breve attesa per dare tempo
   all'invio di arrivare, inizia ad ascoltare gli aggiornamenti in
   arrivo dagli altri dispositivi. Serve a evitare che, riattivando un
   dispositivo con dati buoni dopo un problema altrove, riceva subito
   dati piu' vecchi o incompleti prima di aver avuto la possibilita'
   di inviare i propri. */
function isSafeModeRequested(){
  try{ return localStorage.getItem(SAFE_MODE_KEY) === '1'; }catch(e){ return false; }
}
function clearSafeMode(){
  try{ localStorage.removeItem(SAFE_MODE_KEY); }catch(e){}
}
function requestSafeModeOnNextLoad(){
  try{ localStorage.setItem(SAFE_MODE_KEY, '1'); }catch(e){}
}
function forceFullPushThen(cb){
  /* force=true: ignora la cache locale "gia' inviato" (che potrebbe
     essere gia' allineata da un invio precedente) e riscrive comunque
     tutto su Firestore, perche' lo scopo della modalita' sicura e'
     proprio garantire che i dati di QUESTO dispositivo arrivino,
     indipendentemente da cosa il dispositivo ricorda di aver gia'
     inviato in passato. */
  pushSquadra(true);
  pushAuto(true);
  pushFisico(true);
  pushVal(true);
  setTimeout(cb, SAFE_MODE_PUSH_WAIT_MS);
}
function maybeBootstrapPush(){
  if(!sdkReady) return;
  try{
    if(localStorage.getItem(BOOTSTRAP_KEY)) return;
    localStorage.setItem(BOOTSTRAP_KEY, '1');
  }catch(e){}
  notifyLocalChange(KEY_SQUADRA);
  notifyLocalChange(KEY_AUTO);
  notifyLocalChange(KEY_FISICO);
}
function maybeBootstrapValPush(){
  if(!sdkReady) return;
  try{
    if(localStorage.getItem(BOOTSTRAP_VAL_KEY)) return;
    localStorage.setItem(BOOTSTRAP_VAL_KEY, '1');
  }catch(e){}
  notifyLocalChange(KEY_VAL);
}

/* ---------------- caricamento SDK Firebase ---------------- */
function loadScript(src){
  return new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = src;
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error('Impossibile caricare ' + src)); };
    document.head.appendChild(s);
  });
}
function loadFirebaseSdk(){
  var base = 'https://www.gstatic.com/firebasejs/' + FB_VERSION + '/';
  return loadScript(base + 'firebase-app-compat.js')
    .then(function(){ return loadScript(base + 'firebase-auth-compat.js'); })
    .then(function(){ return loadScript(base + 'firebase-firestore-compat.js'); });
}

/* ---------------- inizializzazione ---------------- */
function init(){
  if(initStarted) return;
  initStarted = true;
  if(!isConfigured()){
    setStatus('disabled', 'Sincronizzazione non configurata');
    return;
  }
  setStatus('connecting', 'Connessione in corso...');
  loadFirebaseSdk().then(function(){
    firebase.initializeApp(cfg);
    db = firebase.firestore();
    try{ db.enablePersistence({ synchronizeTabs: true }).catch(function(){}); }catch(e){}
    var auth = firebase.auth();
    auth.onAuthStateChanged(function(user){
      if(user){
        sdkReady = true;
        if(isSafeModeRequested()){
          setStatus('connecting', 'Modalita\' sicura: invio prima i dati di questo dispositivo, poi ricevo gli aggiornamenti...');
          forceFullPushThen(function(){
            clearSafeMode();
            setStatus('online', 'Sincronizzato');
            attachListeners();
            flushAllPending();
          });
        } else {
          setStatus('online', 'Sincronizzato');
          attachListeners();
          flushAllPending();
          maybeBootstrapPush();
          maybeBootstrapValPush();
        }
      }
    });
    auth.signInAnonymously().catch(function(err){
      setStatus('error', "Accesso non riuscito: " + (err && err.message || ''));
    });
  }).catch(function(){
    setStatus('error', 'Librerie di sincronizzazione non disponibili (verifica la connessione)');
  });
}

/* ---------------- ascolto in tempo reale (remoto -> locale) ---------------- */
function attachListeners(){
  var FieldValue = firebase.firestore.FieldValue;

  db.collection('sync_meta').doc('squadra').onSnapshot(function(snap){
    if(!snap.exists || snap.metadata.hasPendingWrites) return;
    var remote = snap.data() || {};
    var json = JSON.stringify(remote.seasons || []);
    if(cache.squadraMeta === json) return;
    cache.squadraMeta = json;
    saveCacheSoon();
    if(window.SquadraStore && window.SquadraStore.applyRemoteSeasons){
      var changed = window.SquadraStore.applyRemoteSeasons(remote.seasons || []);
      if(changed) fireDataChange(KEY_SQUADRA);
    }
  }, function(err){ setStatus('error', err && err.message); });

  db.collection('sync_squadra_players').onSnapshot(function(snapshot){
    var any = false;
    snapshot.docChanges().forEach(function(change){
      var id = change.doc.id;
      if(change.type === 'removed'){
        delete cache.squadraPlayers[id];
        if(window.SquadraStore && window.SquadraStore.applyRemotePlayerRemoved(id)) any = true;
        return;
      }
      if(change.doc.metadata.hasPendingWrites) return;
      var remote = change.doc.data() || {};
      var player = remote.data || {};
      if(!player.id) player.id = id;
      var json = JSON.stringify(player);
      if(cache.squadraPlayers[id] === json) return;
      cache.squadraPlayers[id] = json;
      if(window.SquadraStore && window.SquadraStore.applyRemotePlayerUpsert(player)) any = true;
    });
    if(any){
      saveCacheSoon(); fireDataChange(KEY_SQUADRA);
      /* Un giocatore e' appena arrivato/aggiornato in rosa: se c'erano
         valutazioni/autovalutazioni/misure fisiche ricevute dal cloud
         PRIMA che questo dispositivo conoscesse ancora questo
         giocatore (tipico su un dispositivo appena svuotato, dove
         tutte le collection arrivano piu' o meno nello stesso momento,
         in ordine non garantito), proviamo subito a riapplicarle ora
         che la rosa esiste. */
      retryPendingRemoteMerges();
    }
  }, function(err){ setStatus('error', err && err.message); });

  /* ---------------- merge di un singolo documento valutazione/autovalutazione/fisico ----------------
     Condiviso tra l'ascolto in tempo reale qui sotto e il "riprova" piu'
     sopra (quando un giocatore compare in rosa dopo che i suoi dati
     erano gia' arrivati dal cloud). Se il giocatore non e' (ancora)
     conosciuto in rosa su questo dispositivo, il documento resta in
     attesa in pendingValDocs/pendingAutoDocs/pendingFisicoDocs: NON
     viene segnato come "gia' ricevuto" in cache, quindi non resta mai
     bloccato per sempre. */
  var pendingValDocs = {};    // id -> { valutazioni, json }
  var pendingAutoDocs = {};   // id -> { valutazioni, json }
  var pendingFisicoDocs = {}; // id -> { misure, json }

  function mergeValDoc(id, remoteValObj, json){
    var rosterPlayer = window.SquadraStore && window.SquadraStore.getPlayer ? window.SquadraStore.getPlayer(id) : null;
    if(!rosterPlayer){ pendingValDocs[id] = { valutazioni: remoteValObj, json: json }; return false; }
    delete pendingValDocs[id];
    var parsed = readJson(KEY_VAL);
    if(!parsed || !Array.isArray(parsed.players)) parsed = { players: [] };
    var localPlayer = parsed.players.find(function(p){ return p.id === id; });
    if(!localPlayer){
      localPlayer = { id: id, nome: rosterPlayer.nome, valutazioni: {} };
      parsed.players.push(localPlayer);
    }
    if(!localPlayer.valutazioni) localPlayer.valutazioni = {};
    Object.keys(remoteValObj).forEach(function(period){
      if(!localPlayer.valutazioni[period]) localPlayer.valutazioni[period] = { byTecnico: {} };
      if(!localPlayer.valutazioni[period].byTecnico) localPlayer.valutazioni[period].byTecnico = {};
      var remoteBt = remoteValObj[period].byTecnico || {};
      Object.keys(remoteBt).forEach(function(tid){
        localPlayer.valutazioni[period].byTecnico[tid] = remoteBt[tid];
      });
    });
    writeJson(KEY_VAL, parsed);
    cache.valReceived[id] = json;
    return true;
  }

  function mergeAutoDoc(id, remoteValObj, json){
    var rosterPlayer = window.SquadraStore && window.SquadraStore.getPlayer ? window.SquadraStore.getPlayer(id) : null;
    if(!rosterPlayer){ pendingAutoDocs[id] = { valutazioni: remoteValObj, json: json }; return false; }
    delete pendingAutoDocs[id];
    var parsed = readJson(KEY_AUTO);
    if(!parsed || !Array.isArray(parsed.players)) parsed = { players: [] };
    var localPlayer = parsed.players.find(function(p){ return p.id === id; });
    if(!localPlayer){
      localPlayer = { id: id, nome: rosterPlayer.nome, valutazioni: {} };
      parsed.players.push(localPlayer);
    }
    if(!localPlayer.valutazioni) localPlayer.valutazioni = {};
    Object.keys(remoteValObj).forEach(function(period){ localPlayer.valutazioni[period] = remoteValObj[period]; });
    writeJson(KEY_AUTO, parsed);
    cache.autoPlayers[id] = json;
    return true;
  }

  function mergeFisicoDoc(id, remoteMisureObj, json){
    var rosterPlayer = window.SquadraStore && window.SquadraStore.getPlayer ? window.SquadraStore.getPlayer(id) : null;
    if(!rosterPlayer){ pendingFisicoDocs[id] = { misure: remoteMisureObj, json: json }; return false; }
    delete pendingFisicoDocs[id];
    var parsed = readJson(KEY_FISICO);
    if(!parsed || !Array.isArray(parsed.players)) parsed = { players: [] };
    var localPlayer = parsed.players.find(function(p){ return p.id === id; });
    if(!localPlayer){
      localPlayer = { id: id, nome: rosterPlayer.nome, misure: {} };
      parsed.players.push(localPlayer);
    }
    if(!localPlayer.misure) localPlayer.misure = {};
    Object.keys(remoteMisureObj).forEach(function(period){ localPlayer.misure[period] = remoteMisureObj[period]; });
    writeJson(KEY_FISICO, parsed);
    cache.fisicoPlayers[id] = json;
    return true;
  }

  function retryPendingRemoteMerges(){
    var anyVal = false, anyAuto = false, anyFisico = false;
    Object.keys(pendingValDocs).forEach(function(id){
      var entry = pendingValDocs[id];
      if(mergeValDoc(id, entry.valutazioni, entry.json)) anyVal = true;
    });
    Object.keys(pendingAutoDocs).forEach(function(id){
      var entry = pendingAutoDocs[id];
      if(mergeAutoDoc(id, entry.valutazioni, entry.json)) anyAuto = true;
    });
    Object.keys(pendingFisicoDocs).forEach(function(id){
      var entry = pendingFisicoDocs[id];
      if(mergeFisicoDoc(id, entry.misure, entry.json)) anyFisico = true;
    });
    if(anyVal){ saveCacheSoon(); fireDataChange(KEY_VAL); }
    if(anyAuto){ saveCacheSoon(); fireDataChange(KEY_AUTO); }
    if(anyFisico){ saveCacheSoon(); fireDataChange(KEY_FISICO); }
  }

  db.collection('sync_val_players').onSnapshot(function(snapshot){
    var any = false;
    snapshot.docChanges().forEach(function(change){
      var id = change.doc.id;
      if(change.type === 'removed'){ delete cache.valReceived[id]; delete pendingValDocs[id]; return; }
      if(change.doc.metadata.hasPendingWrites) return;
      var remote = change.doc.data() || {};
      var remoteVal = remote.valutazioni || {};
      var json = JSON.stringify(remoteVal);
      if(cache.valReceived[id] === json) return;
      if(mergeValDoc(id, remoteVal, json)) any = true;
    });
    if(any){ saveCacheSoon(); fireDataChange(KEY_VAL); }
  }, function(err){ setStatus('error', err && err.message); });

  db.collection('sync_auto_players').onSnapshot(function(snapshot){
    var any = false;
    snapshot.docChanges().forEach(function(change){
      var id = change.doc.id;
      if(change.type === 'removed'){ delete cache.autoPlayers[id]; delete pendingAutoDocs[id]; return; }
      if(change.doc.metadata.hasPendingWrites) return;
      var remote = change.doc.data() || {};
      var remoteVal = remote.valutazioni || {};
      var json = JSON.stringify(remoteVal);
      if(cache.autoPlayers[id] === json) return;
      if(mergeAutoDoc(id, remoteVal, json)) any = true;
    });
    if(any){ saveCacheSoon(); fireDataChange(KEY_AUTO); }
  }, function(err){ setStatus('error', err && err.message); });

  db.collection('sync_fisico_players').onSnapshot(function(snapshot){
    var any = false;
    snapshot.docChanges().forEach(function(change){
      var id = change.doc.id;
      if(change.type === 'removed'){ delete cache.fisicoPlayers[id]; delete pendingFisicoDocs[id]; return; }
      if(change.doc.metadata.hasPendingWrites) return;
      var remote = change.doc.data() || {};
      var remoteMisure = remote.misure || {};
      var json = JSON.stringify(remoteMisure);
      if(cache.fisicoPlayers[id] === json) return;
      if(mergeFisicoDoc(id, remoteMisure, json)) any = true;
    });
    if(any){ saveCacheSoon(); fireDataChange(KEY_FISICO); }
  }, function(err){ setStatus('error', err && err.message); });

  /* nota: 'FieldValue' e' referenziata solo nelle funzioni di push
     qui sotto, non qui: e' catturata via firebase.firestore.FieldValue
     al momento della scrittura per evitare problemi di ordine di
     caricamento. */
  void FieldValue;
}

/* ---------------- invio (locale -> remoto), con debounce ---------------- */
function debouncePush(storageKey){
  if(timers[storageKey]) clearTimeout(timers[storageKey]);
  timers[storageKey] = setTimeout(function(){
    timers[storageKey] = null;
    if(!sdkReady){ return; } /* restera' in pendingDirty finche' non si connette */
    flushOne(storageKey);
  }, PUSH_DEBOUNCE_MS);
}
function flushOne(storageKey){
  delete pendingDirty[storageKey];
  if(storageKey === KEY_SQUADRA) pushSquadra();
  else if(storageKey === KEY_VAL) pushVal();
  else if(storageKey === KEY_AUTO) pushAuto();
  else if(storageKey === KEY_FISICO) pushFisico();
}
function flushAllPending(){
  Object.keys(pendingDirty).forEach(function(k){ flushOne(k); });
}

function notifyLocalChange(storageKey){
  pendingDirty[storageKey] = true;
  if(!isConfigured()) return;
  debouncePush(storageKey);
}

function notifyPlayerDeleted(id){
  delete cache.squadraPlayers[id];
  Object.keys(cache.valSlices).forEach(function(k){ if(k.indexOf(id + '|') === 0) delete cache.valSlices[k]; });
  delete cache.valReceived[id];
  delete cache.autoPlayers[id];
  delete cache.fisicoPlayers[id];
  saveCacheSoon();
  if(!isConfigured() || !sdkReady) return;
  db.collection('sync_squadra_players').doc(id).delete().catch(function(){});
  db.collection('sync_val_players').doc(id).delete().catch(function(){});
  db.collection('sync_auto_players').doc(id).delete().catch(function(){});
  db.collection('sync_fisico_players').doc(id).delete().catch(function(){});
}

function pushSquadra(force){
  var parsed = readJson(KEY_SQUADRA);
  if(!parsed) return;
  var FieldValue = firebase.firestore.FieldValue;
  var metaJson = JSON.stringify(parsed.seasons || []);
  if(force || cache.squadraMeta !== metaJson){
    cache.squadraMeta = metaJson; saveCacheSoon();
    db.collection('sync_meta').doc('squadra').set({
      seasons: parsed.seasons || [], updatedAt: FieldValue.serverTimestamp(), device: getDeviceId()
    }).then(function(){ setStatus('online', ''); }).catch(function(err){ setStatus('offline', err && err.message); });
  }
  (parsed.players || []).forEach(function(p){
    var json = JSON.stringify(p);
    if(!force && cache.squadraPlayers[p.id] === json) return;
    cache.squadraPlayers[p.id] = json; saveCacheSoon();
    db.collection('sync_squadra_players').doc(p.id).set({
      data: p, updatedAt: FieldValue.serverTimestamp(), device: getDeviceId()
    }).then(function(){ setStatus('online', ''); }).catch(function(err){ setStatus('offline', err && err.message); });
  });
}

function pushVal(force){
  /* NON richiediamo piu' ctx.tecnicoId qui: prima questa funzione non
     faceva nulla se non era impostato un tecnico "corrente" (cosa che
     succede solo sulla pagina Giocatore durante la compilazione), quindi
     la "sincronizzazione sicura" premuta dalla pagina Squadra non
     riusciva MAI a inviare le valutazioni dei tecnici al cloud, silenzio-
     samente. Ora inviamo la fetta di dati di OGNI tecnico gia' presente
     in locale per ogni giocatore (ognuno resta comunque un campo separato
     via merge:true, quindi due tecnici non si sovrascrivono mai a
     vicenda, esattamente come prima). */
  var parsed = readJson(KEY_VAL);
  if(!parsed) return;
  var FieldValue = firebase.firestore.FieldValue;
  (parsed.players || []).forEach(function(p){
    var tecnicoIds = {};
    PERIOD_KEYS.forEach(function(period){
      var bt = p.valutazioni && p.valutazioni[period] && p.valutazioni[period].byTecnico;
      if(bt) Object.keys(bt).forEach(function(tid){ tecnicoIds[tid] = true; });
    });
    Object.keys(tecnicoIds).forEach(function(tecnicoId){
      var slice = {}, hasAny = false;
      PERIOD_KEYS.forEach(function(period){
        var bt = p.valutazioni && p.valutazioni[period] && p.valutazioni[period].byTecnico;
        var entry = bt && bt[tecnicoId];
        if(entry){ slice[period] = entry; hasAny = true; }
      });
      if(!hasAny) return;
      var cacheKey = p.id + '|' + tecnicoId;
      var json = JSON.stringify(slice);
      if(!force && cache.valSlices[cacheKey] === json) return;
      cache.valSlices[cacheKey] = json; saveCacheSoon();
      /* IMPORTANTE: qui serve un oggetto ANNIDATO vero (non chiavi con i
         punti scritti come testo, es. "valutazioni.settembre.byTecnico.x"),
         perche' set(dati, {merge:true}) — a differenza di update() — NON
         interpreta i punti dentro il NOME di una chiave come separatori di
         percorso: li tratterebbe come un unico nome di campo letterale.
         Questo era un bug piu' vecchio (gia' presente prima delle
         correzioni di oggi): i dati arrivavano su Firestore ma finivano
         sotto un nome di campo sbagliato che l'app non riconosceva mai
         come valutazioni. Con un oggetto annidato, il merge profondo di
         set(...,{merge:true}) aggiorna solo il tecnico/periodo interessato
         senza toccare gli altri. */
      var patch = { updatedAt: FieldValue.serverTimestamp(), device: getDeviceId(), valutazioni: {} };
      Object.keys(slice).forEach(function(period){
        patch.valutazioni[period] = { byTecnico: {} };
        patch.valutazioni[period].byTecnico[tecnicoId] = slice[period];
      });
      db.collection('sync_val_players').doc(p.id).set(patch, { merge: true })
        .then(function(){ setStatus('online', ''); })
        .catch(function(err){ setStatus('offline', err && err.message); });
    });
  });
}

function pushAuto(force){
  var parsed = readJson(KEY_AUTO);
  if(!parsed) return;
  var FieldValue = firebase.firestore.FieldValue;
  (parsed.players || []).forEach(function(p){
    if(!p.valutazioni) return;
    var json = JSON.stringify(p.valutazioni);
    if(!force && cache.autoPlayers[p.id] === json) return;
    cache.autoPlayers[p.id] = json; saveCacheSoon();
    db.collection('sync_auto_players').doc(p.id).set({
      valutazioni: p.valutazioni, updatedAt: FieldValue.serverTimestamp(), device: getDeviceId()
    }, { merge: true }).then(function(){ setStatus('online', ''); })
      .catch(function(err){ setStatus('offline', err && err.message); });
  });
}

function pushFisico(force){
  var parsed = readJson(KEY_FISICO);
  if(!parsed) return;
  var FieldValue = firebase.firestore.FieldValue;
  (parsed.players || []).forEach(function(p){
    if(!p.misure) return;
    var json = JSON.stringify(p.misure);
    if(!force && cache.fisicoPlayers[p.id] === json) return;
    cache.fisicoPlayers[p.id] = json; saveCacheSoon();
    db.collection('sync_fisico_players').doc(p.id).set({
      misure: p.misure, updatedAt: FieldValue.serverTimestamp(), device: getDeviceId()
    }, { merge: true }).then(function(){ setStatus('online', ''); })
      .catch(function(err){ setStatus('offline', err && err.message); });
  });
}

/* ---------------- indicatore di stato (facoltativo, per il topbar) ---------------- */
var STATUS_LABELS = {
  disabled: { text: 'Solo su questo dispositivo', color: 'rgba(255,255,255,0.55)' },
  connecting: { text: 'Connessione...', color: '#E0B274' },
  online: { text: 'Sincronizzato', color: '#7FD9B6' },
  offline: { text: 'In attesa di rete...', color: '#E0B274' },
  error: { text: 'Sync non disponibile', color: '#E38C7A' }
};
function escapeAttr(s){ return String(s == null ? '' : s).replace(/"/g, '&quot;'); }
function mountStatusBadge(containerId){
  var host = document.getElementById(containerId);
  if(!host) return;
  function render(){
    var s = STATUS_LABELS[statusState.state] || STATUS_LABELS.disabled;
    host.innerHTML = '<span title="' + escapeAttr(statusState.message) + '" style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(255,255,255,0.85);padding:8px 6px;white-space:nowrap;">' +
      '<span style="width:8px;height:8px;border-radius:50%;background:' + s.color + ';display:inline-block;flex-shrink:0;"></span>' + s.text + '</span>';
  }
  onStatusChange(render);
}

window.RugbyCloudSync = {
  isConfigured: isConfigured,
  init: init,
  setTecnico: setTecnico,
  notifyLocalChange: notifyLocalChange,
  notifyPlayerDeleted: notifyPlayerDeleted,
  onDataChange: onDataChange,
  onStatusChange: onStatusChange,
  getStatus: getStatus,
  mountStatusBadge: mountStatusBadge,
  requestSafeModeOnNextLoad: requestSafeModeOnNextLoad,
  isSafeModeRequested: isSafeModeRequested
};

init();

})(window);
