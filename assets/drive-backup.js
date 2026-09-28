/* ============================================================
   BACKUP SU GOOGLE DRIVE — modulo condiviso
   Usato sia dalla Scheda Valutazione sia dall'Autovalutazione.

   COME CONFIGURARLO (una tantum):
   1) Crea un progetto su https://console.cloud.google.com
   2) Abilita "Google Drive API" (APIs & Services > Library)
   3) Configura la schermata di consenso OAuth (External, modalita
      "Testing", aggiungi la tua email Google come "Test user")
   4) Crea credenziali > ID client OAuth > tipo "Applicazione web"
      - Origini JavaScript autorizzate: l'indirizzo dove pubblichi
        questa app, es. https://tuonome.github.io
   5) Copia il Client ID e incollalo qui sotto al posto di
      "INSERISCI_QUI_IL_TUO_CLIENT_ID"
============================================================ */
(function(window){
"use strict";

var CLIENT_ID = "85452020560-b90ouecps78mn0rjobc1on60c55eek86.apps.googleusercontent.com";
var DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
var BACKUP_FOLDER_NAME = "Backup Rugby U14 - Pasian di Prato";

var tokenClient = null;
var accessToken = null;
var tokenExpiresAt = 0;
var gisLoaded = false;
var cachedFolderId = null;

function isConfigured(){
  return CLIENT_ID && CLIENT_ID.indexOf("INSERISCI_QUI") === -1;
}

function loadGis(cb){
  if(gisLoaded && window.google && window.google.accounts){ cb(); return; }
  var existing = document.getElementById('gis-script');
  if(existing){
    existing.addEventListener('load', function(){ gisLoaded = true; cb(); });
    return;
  }
  var script = document.createElement('script');
  script.id = 'gis-script';
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = function(){ gisLoaded = true; cb(); };
  script.onerror = function(){ cb(new Error('Impossibile caricare le librerie Google.')); };
  document.head.appendChild(script);
}

function ensureTokenClient(){
  if(tokenClient) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: function(){} // sovrascritto ad ogni richiesta
  });
}

/* Ottiene un access token valido. 'interactive' = true mostra il
   popup di consenso Google se necessario (va chiamato da un click
   utente). Se false prova prima un refresh silenzioso. */
function getAccessToken(interactive, onSuccess, onError){
  if(accessToken && Date.now() < tokenExpiresAt - 30000){
    onSuccess(accessToken);
    return;
  }
  loadGis(function(err){
    if(err){ onError(err); return; }
    ensureTokenClient();
    tokenClient.callback = function(resp){
      if(resp && resp.access_token){
        accessToken = resp.access_token;
        tokenExpiresAt = Date.now() + (Number(resp.expires_in || 3600) * 1000);
        onSuccess(accessToken);
      } else {
        onError(new Error('Autorizzazione Google non riuscita.'));
      }
    };
    tokenClient.error_callback = function(err2){ onError(err2 || new Error('Autorizzazione Google annullata.')); };
    tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

function driveFetch(url, options, token){
  options = options || {};
  options.headers = options.headers || {};
  options.headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, options).then(function(res){
    if(!res.ok){
      return res.text().then(function(t){ throw new Error('Errore Google Drive ('+res.status+'): '+t); });
    }
    return res.json();
  });
}

function findFile(token, name, parentId, mimeQuery){
  var q = "name='"+name.replace(/'/g,"\\'")+"' and trashed=false";
  if(parentId) q += " and '"+parentId+"' in parents";
  if(mimeQuery) q += " and "+mimeQuery;
  var url = 'https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name)&spaces=drive';
  return driveFetch(url, {method:'GET'}, token).then(function(data){
    return (data.files && data.files.length) ? data.files[0] : null;
  });
}

function getOrCreateBackupFolder(token){
  if(cachedFolderId) return Promise.resolve(cachedFolderId);
  return findFile(token, BACKUP_FOLDER_NAME, null, "mimeType='application/vnd.google-apps.folder'")
    .then(function(existing){
      if(existing){ cachedFolderId = existing.id; return cachedFolderId; }
      return driveFetch('https://www.googleapis.com/drive/v3/files', {
        method:'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name: BACKUP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' })
      }, token).then(function(created){ cachedFolderId = created.id; return cachedFolderId; });
    });
}

function uploadOrUpdateJson(token, folderId, filename, jsonString){
  return findFile(token, filename, folderId, null).then(function(existing){
    var boundary = '-------rugbybackup' + Date.now();
    var metadata = existing ? {} : { name: filename, parents: [folderId] };
    var multipartBody =
      '--'+boundary+'\r\n'+
      'Content-Type: application/json; charset=UTF-8\r\n\r\n'+
      JSON.stringify(metadata)+'\r\n'+
      '--'+boundary+'\r\n'+
      'Content-Type: application/json\r\n\r\n'+
      jsonString+'\r\n'+
      '--'+boundary+'--';

    var url = existing
      ? 'https://www.googleapis.com/upload/drive/v3/files/'+existing.id+'?uploadType=multipart'
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    var method = existing ? 'PATCH' : 'POST';

    return driveFetch(url, {
      method: method,
      headers: { 'Content-Type': 'multipart/related; boundary='+boundary },
      body: multipartBody
    }, token);
  });
}

/* API pubblica -------------------------------------------------- */

var RugbyDriveBackup = {
  isConfigured: isConfigured,

  isConnected: function(){
    return !!(accessToken && Date.now() < tokenExpiresAt);
  },

  /* Chiede la connessione (mostra il popup Google la prima volta).
     Deve essere chiamata direttamente da un click utente. */
  connect: function(onSuccess, onError){
    if(!isConfigured()){
      onError(new Error('Il backup su Drive non e\' ancora configurato in questa app (manca il Client ID).'));
      return;
    }
    getAccessToken(true, onSuccess, onError);
  },

  /* Esegue il backup: salva/aggiorna jsonString come "filename"
     dentro la cartella dedicata su Drive. */
  backup: function(jsonString, filename, onSuccess, onError){
    if(!isConfigured()){
      onError(new Error('Il backup su Drive non e\' ancora configurato in questa app (manca il Client ID).'));
      return;
    }
    getAccessToken(true, function(token){
      getOrCreateBackupFolder(token).then(function(folderId){
        return uploadOrUpdateJson(token, folderId, filename, jsonString);
      }).then(function(){
        onSuccess();
      }).catch(function(err){ onError(err); });
    }, onError);
  },

  /* Scarica "filename" dalla cartella di backup su Drive e restituisce
     il suo contenuto (stringa JSON) a onSuccess. Se il file non esiste
     ancora su Drive, chiama onError con un messaggio chiaro. */
  restore: function(filename, onSuccess, onError){
    if(!isConfigured()){
      onError(new Error('Il backup su Drive non e\' ancora configurato in questa app (manca il Client ID).'));
      return;
    }
    getAccessToken(true, function(token){
      getOrCreateBackupFolder(token).then(function(folderId){
        return findFile(token, filename, folderId, null);
      }).then(function(file){
        if(!file) throw new Error('Nessun backup "'+filename+'" trovato su Google Drive.');
        return driveFetch('https://www.googleapis.com/drive/v3/files/'+file.id+'?alt=media', {method:'GET'}, token);
      }).then(function(data){
        onSuccess(JSON.stringify(data));
      }).catch(function(err){ onError(err); });
    }, onError);
  }
};

window.RugbyDriveBackup = RugbyDriveBackup;

})(window);
