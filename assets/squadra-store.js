/* ============================================================
   SQUADRA STORE — anagrafica e rosa condivisa
   Usato da: Home, Squadra, Riepilogo, Confronto, Scheda Valutazione,
   Autovalutazione. Vive nello stesso localStorage (stessa origine),
   quindi tutte le pagine leggono/scrivono gli stessi dati.

   Modello dati (chiave 'rugbyU14_squadra_v1'):
   {
     seasons: [{id,label}],
     activeSeasonId: 'xxx',
     players: [{id, seasonId, nome, annoNascita, foto, ruoli, ruoloPrevalente, note}],
     migratedLegacy: true
   }
============================================================ */
(function(window){
"use strict";

var STORAGE_KEY = 'rugbyU14_squadra_v1';
var LEGACY_VAL_KEY = 'rugbyU14_valutazioni_v2';
var LEGACY_AUTO_KEY = 'rugbyU14_autovalutazione_v1';

var ROLES_LIST = ['Pilone','Tallonatore','Seconda linea','Terza linea',
  'Mediano di mischia','Mediano di apertura','Centro','Ala','Estremo'];

var data = null;
var changeListeners = [];

function uid(prefix){ return (prefix||'p') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }

/* Notifica cloud-sync.js (se presente/configurato) che i dati locali
   sono cambiati per iniziativa dell'utente su QUESTO dispositivo, cosi'
   possono essere inviati a Firestore. E' un no-op sicuro se il modulo
   di sincronizzazione non e' caricato o non e' configurato. */
function notifyLocalChange(){
  if(window.RugbyCloudSync) window.RugbyCloudSync.notifyLocalChange('rugbyU14_squadra_v1');
}
/* Sottoscrizione per farsi avvisare quando i dati sono cambiati
   (incluso un aggiornamento arrivato da un altro dispositivo). Usata
   dalle pagine per ridisegnare la vista corrente in tempo reale. */
function onChange(cb){ changeListeners.push(cb); }
function fireChange(){ changeListeners.forEach(function(cb){ try{ cb(); }catch(e){} }); }

function currentSeasonLabel(){
  var d = new Date();
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  return (m >= 7) ? (y + '/' + (y+1)) : ((y-1) + '/' + y);
}

function normName(s){ return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }

function ensurePlayerShape(p){
  if(p.id===undefined) p.id = uid();
  if(p.seasonId===undefined) p.seasonId = data.activeSeasonId;
  if(p.nome===undefined) p.nome = 'Nuovo giocatore';
  if(p.annoNascita===undefined) p.annoNascita = '';
  if(p.foto===undefined) p.foto = '';
  if(!p.ruoli) p.ruoli = [];
  if(p.ruoloPrevalente===undefined) p.ruoloPrevalente = p.ruoli[0] || '';
  if(p.note===undefined) p.note = '';
  return p;
}

function ensureAtLeastOneSeason(){
  var changed = false;
  if(!data.seasons || data.seasons.length===0){
    data.seasons = [{ id: uid('s'), label: currentSeasonLabel() }];
    data.activeSeasonId = data.seasons[0].id;
    changed = true;
  } else if(!data.activeSeasonId || !data.seasons.some(function(s){return s.id===data.activeSeasonId;})){
    data.activeSeasonId = data.seasons[0].id;
    changed = true;
  }
  if(changed) save();
}

function readLegacyPlayers(key){
  try{
    var raw = localStorage.getItem(key);
    if(!raw) return [];
    var parsed = JSON.parse(raw);
    return (parsed && Array.isArray(parsed.players)) ? parsed.players : [];
  }catch(e){ return []; }
}

/* Migrazione una tantum: unisce i giocatori gia' presenti nelle due
   app (creati prima che esistesse la rosa condivisa) in un'unica
   lista, nella stagione attiva di default. */
function migrateLegacyIfNeeded(){
  if(data.migratedLegacy) return;
  var valPlayers = readLegacyPlayers(LEGACY_VAL_KEY);
  var autoPlayers = readLegacyPlayers(LEGACY_AUTO_KEY);
  if(valPlayers.length===0 && autoPlayers.length===0){
    data.migratedLegacy = true;
    save();
    return;
  }
  var seasonId = data.activeSeasonId;
  var byName = {};
  data.players.forEach(function(p){ byName[normName(p.nome)] = p; });

  function mergeFrom(list, rich){
    list.forEach(function(legacy){
      if(!legacy || !legacy.nome) return;
      var key = normName(legacy.nome);
      var existing = byName[key];
      if(!existing){
        existing = ensurePlayerShape({
          id: uid(),
          seasonId: seasonId,
          nome: legacy.nome,
          annoNascita: legacy.annoNascita || '',
          foto: legacy.foto || '',
          ruoli: rich && legacy.ruoli ? legacy.ruoli.slice() : [],
          ruoloPrevalente: rich && legacy.ruoloPrevalente ? legacy.ruoloPrevalente : '',
          note: rich && legacy.note ? legacy.note : ''
        });
        data.players.push(existing);
        byName[key] = existing;
      } else {
        if(!existing.foto && legacy.foto) existing.foto = legacy.foto;
        if(!existing.annoNascita && legacy.annoNascita) existing.annoNascita = legacy.annoNascita;
        if(rich){
          if((!existing.ruoli || existing.ruoli.length===0) && legacy.ruoli) existing.ruoli = legacy.ruoli.slice();
          if(!existing.ruoloPrevalente && legacy.ruoloPrevalente) existing.ruoloPrevalente = legacy.ruoloPrevalente;
          if(!existing.note && legacy.note) existing.note = legacy.note;
        }
      }
    });
  }
  /* la scheda valutazione ha dati anagrafici piu' ricchi (ruoli, note) */
  mergeFrom(valPlayers, true);
  mergeFrom(autoPlayers, false);

  data.migratedLegacy = true;
  save();
}

function load(){
  if(data) return data;
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(raw) data = JSON.parse(raw);
  }catch(e){ console.error('Errore caricamento rosa', e); }
  if(!data) data = { seasons: [], activeSeasonId: null, players: [] };
  if(!data.seasons) data.seasons = [];
  if(!data.players) data.players = [];
  ensureAtLeastOneSeason();
  migrateLegacyIfNeeded();
  return data;
}
function save(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch(e){ console.error('Errore salvataggio rosa', e); }
}

/* ---------------- Stagioni ---------------- */
function getSeasons(){ load(); return data.seasons.slice(); }
function getActiveSeasonId(){ load(); return data.activeSeasonId; }
function setActiveSeasonId(id){
  load();
  if(data.seasons.some(function(s){return s.id===id;})){ data.activeSeasonId = id; save(); }
}
function addSeason(label){
  load();
  var s = { id: uid('s'), label: label || currentSeasonLabel() };
  data.seasons.push(s);
  data.activeSeasonId = s.id;
  save();
  notifyLocalChange();
  return s;
}
function renameSeason(id, label){
  load();
  var s = data.seasons.find(function(x){return x.id===id;});
  if(s){ s.label = label; save(); notifyLocalChange(); }
}
function deleteSeason(id){
  load();
  if(data.seasons.length<=1) return false;
  var removedIds = data.players.filter(function(p){return p.seasonId===id;}).map(function(p){return p.id;});
  data.seasons = data.seasons.filter(function(s){return s.id!==id;});
  data.players = data.players.filter(function(p){return p.seasonId!==id;});
  if(data.activeSeasonId===id) data.activeSeasonId = data.seasons[0].id;
  save();
  notifyLocalChange();
  /* stessa pulizia di deletePlayer() per ogni giocatore che apparteneva
     solo a questa stagione: rimuove le sue valutazioni/autovalutazioni
     locali e avvisa cloud-sync di cancellare i suoi documenti remoti,
     cosi' non restano dati "orfani" ne' in locale ne' su Firestore. */
  removedIds.forEach(function(pid){
    [LEGACY_VAL_KEY, LEGACY_AUTO_KEY].forEach(function(key){
      try{
        var raw = localStorage.getItem(key);
        if(!raw) return;
        var parsed = JSON.parse(raw);
        if(parsed && Array.isArray(parsed.players)){
          parsed.players = parsed.players.filter(function(p){return p.id!==pid;});
          localStorage.setItem(key, JSON.stringify(parsed));
        }
      }catch(e){}
    });
    if(window.RugbyCloudSync) window.RugbyCloudSync.notifyPlayerDeleted(pid);
  });
  return true;
}

/* ---------------- Giocatori ---------------- */
function getPlayers(seasonId){
  load();
  var list = seasonId ? data.players.filter(function(p){return p.seasonId===seasonId;}) : data.players.slice();
  return list.slice().sort(function(a,b){ return a.nome.localeCompare(b.nome); });
}
function getPlayer(id){
  load();
  return data.players.find(function(p){return p.id===id;}) || null;
}
function findByName(nome, seasonId){
  load();
  var key = normName(nome);
  return data.players.find(function(p){ return normName(p.nome)===key && (!seasonId || p.seasonId===seasonId); }) || null;
}
function savePlayer(player){
  load();
  ensurePlayerShape(player);
  var idx = data.players.findIndex(function(p){return p.id===player.id;});
  if(idx===-1) data.players.push(player);
  else data.players[idx] = player;
  save();
  notifyLocalChange();
  return player;
}
function newPlayer(seasonId){
  load();
  return ensurePlayerShape({ id: uid(), seasonId: seasonId || data.activeSeasonId, nome:'Nuovo giocatore', annoNascita:'', foto:'', ruoli:[], ruoloPrevalente:'', note:'' });
}
function deletePlayer(id){
  load();
  data.players = data.players.filter(function(p){return p.id!==id;});
  save();
  notifyLocalChange();
  /* pulizia best-effort dei dati di valutazione collegati */
  [LEGACY_VAL_KEY, LEGACY_AUTO_KEY].forEach(function(key){
    try{
      var raw = localStorage.getItem(key);
      if(!raw) return;
      var parsed = JSON.parse(raw);
      if(parsed && Array.isArray(parsed.players)){
        parsed.players = parsed.players.filter(function(p){return p.id!==id;});
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    }catch(e){}
  });
  if(window.RugbyCloudSync) window.RugbyCloudSync.notifyPlayerDeleted(id);
}

/* ---------------- Foto ---------------- */
function resizeImageFile(file, maxW, maxH, quality, onDone, onError){
  var reader = new FileReader();
  reader.onerror = function(){ onError && onError(); };
  reader.onload = function(ev){
    var img = new Image();
    img.onload = function(){
      var w = img.width, h = img.height;
      var scale = Math.min(1, maxW / w, maxH / h);
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      try{ onDone(canvas.toDataURL('image/jpeg', quality)); }
      catch(e){ onError && onError(); }
    };
    img.onerror = function(){ onError && onError(); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
function getInitials(nome){
  return String(nome||'').trim().split(/\s+/).map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();
}

/* ---------------- Sincronizzazione per le app di valutazione ----------------
   Da chiamare dalle due app (valutazione/autovalutazione) dopo aver
   caricato il proprio state.players locale. Fa in modo che gli id
   locali coincidano con quelli della rosa condivisa, aggiunge le voci
   mancanti per i nuovi giocatori in rosa e rispecchia i dati
   anagrafici (nome/foto/anno/ruoli/note) da qui, che restano
   modificabili solo dalla pagina Squadra. */
function syncAppPlayers(localPlayers, seasonId, opts){
  load();
  opts = opts || {};
  var richFields = !!opts.richFields; // true per la scheda valutazione (ruoli/note)
  var createLocal = opts.createLocal; // (sharedPlayer) -> nuovo oggetto locale con lo stesso id

  /* 1) rimappa gli id locali "vecchi" (pre-rosa condivisa) sugli id condivisi */
  localPlayers.forEach(function(p){
    if(getPlayer(p.id)) return; // gia' allineato
    var match = findByName(p.nome);
    if(match){
      p.id = match.id;
    } else {
      /* nessuna corrispondenza: crea una voce in rosa da questo giocatore locale */
      var created = ensurePlayerShape({
        id: p.id || uid(),
        seasonId: seasonId,
        nome: p.nome,
        annoNascita: p.annoNascita || '',
        foto: p.foto || '',
        ruoli: richFields && p.ruoli ? p.ruoli.slice() : [],
        ruoloPrevalente: richFields && p.ruoloPrevalente ? p.ruoloPrevalente : '',
        note: richFields && p.note ? p.note : ''
      });
      data.players.push(created);
      p.id = created.id;
    }
  });
  save();

  /* 2) aggiunge le voci locali mancanti per i giocatori gia' in rosa
        per la stagione indicata (es. aggiunti dalla pagina Squadra) */
  var localIds = {};
  localPlayers.forEach(function(p){ localIds[p.id] = true; });
  var added = [];
  if(createLocal){
    getPlayers(seasonId).forEach(function(sp){
      if(!localIds[sp.id]){
        var newLocal = createLocal(sp);
        localPlayers.push(newLocal);
        added.push(sp.id);
      }
    });
  }

  /* 3) rispecchia i campi anagrafici dalla rosa su ogni giocatore locale */
  localPlayers.forEach(function(p){
    var sp = getPlayer(p.id);
    if(!sp) return;
    p.nome = sp.nome;
    p.annoNascita = sp.annoNascita;
    p.foto = sp.foto;
    if(richFields){
      p.ruoli = sp.ruoli.slice();
      p.ruoloPrevalente = sp.ruoloPrevalente;
      p.note = sp.note;
    }
  });

  return added; // id dei giocatori in rosa senza ancora una voce locale
}

/* ---------------- Applicazione di aggiornamenti remoti (cloud-sync.js) ----------------
   Queste funzioni sono chiamate SOLO da assets/cloud-sync.js quando
   arriva un aggiornamento da un altro dispositivo: aggiornano i dati
   locali e avvisano gli ascoltatori (onChange), ma non rimandano a
   loro volta i dati al cloud (altrimenti si creerebbe un rimbalzo
   inutile tra i dispositivi). */
function applyRemotePlayerUpsert(remotePlayer){
  load();
  if(!remotePlayer || !remotePlayer.id) return false;
  var merged = ensurePlayerShape(Object.assign({}, remotePlayer));
  var idx = data.players.findIndex(function(p){return p.id===merged.id;});
  var changed;
  if(idx===-1){ data.players.push(merged); changed = true; }
  else{
    changed = JSON.stringify(data.players[idx]) !== JSON.stringify(merged);
    data.players[idx] = merged;
  }
  if(changed){ save(); fireChange(); }
  return changed;
}
function applyRemotePlayerRemoved(id){
  load();
  var before = data.players.length;
  data.players = data.players.filter(function(p){return p.id!==id;});
  if(data.players.length!==before){ save(); fireChange(); return true; }
  return false;
}
function applyRemoteSeasons(seasons){
  load();
  if(!Array.isArray(seasons)) return false;
  var changed = false;
  seasons.forEach(function(rs){
    if(!rs || !rs.id) return;
    var local = data.seasons.find(function(s){return s.id===rs.id;});
    if(!local){ data.seasons.push({ id: rs.id, label: rs.label||'' }); changed = true; }
    else if(local.label !== rs.label){ local.label = rs.label; changed = true; }
  });
  if(changed){ save(); fireChange(); }
  return changed;
}

window.SquadraStore = {
  ROLES_LIST: ROLES_LIST,
  uid: uid,
  currentSeasonLabel: currentSeasonLabel,
  getSeasons: getSeasons,
  getActiveSeasonId: getActiveSeasonId,
  setActiveSeasonId: setActiveSeasonId,
  addSeason: addSeason,
  renameSeason: renameSeason,
  deleteSeason: deleteSeason,
  getPlayers: getPlayers,
  getPlayer: getPlayer,
  findByName: findByName,
  savePlayer: savePlayer,
  newPlayer: newPlayer,
  deletePlayer: deletePlayer,
  resizeImageFile: resizeImageFile,
  getInitials: getInitials,
  syncAppPlayers: syncAppPlayers,
  onChange: onChange,
  applyRemotePlayerUpsert: applyRemotePlayerUpsert,
  applyRemotePlayerRemoved: applyRemotePlayerRemoved,
  applyRemoteSeasons: applyRemoteSeasons
};

})(window);
