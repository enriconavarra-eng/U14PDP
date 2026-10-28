/* ============================================================
   REPORT BUILDER — genera pagine di stampa/PDF (riepilogo giocatore,
   riepilogo squadra, confronto) usando la stampa nativa del browser
   ("Salva come PDF" nella finestra di stampa). Nessuna libreria
   esterna: funziona anche offline nella PWA.
============================================================ */
(function(window){
"use strict";

function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
}
function fmt(v){ return (v===null||v===undefined||isNaN(v)) ? '-' : v.toFixed(1); }
function scoreColor(v){
  if(v===null||v===undefined||isNaN(v)) return '#999';
  if(v<2) return '#B5533C';
  if(v<3.5) return '#B8701F';
  return '#2E8F72';
}

function barRow(label, value, color){
  var pct = value===null ? 0 : (value/5*100);
  return '<div class="rb-bar-row">'+
    '<div class="rb-bar-label"><span>'+esc(label)+'</span><span class="rb-mono" style="color:'+scoreColor(value)+'">'+fmt(value)+'</span></div>'+
    '<div class="rb-bar-track"><div class="rb-bar-fill" style="width:'+pct+'%;background:'+color+'"></div></div>'+
  '</div>';
}

function playerHeaderHtml(player){
  var initials = window.SquadraStore.getInitials(player.nome);
  var photo = player.foto
    ? '<div class="rb-photo" style="background-image:url(&quot;'+player.foto+'&quot;)"></div>'
    : '<div class="rb-photo rb-photo-fallback">'+esc(initials||'?')+'</div>';
  var meta = [];
  if(player.annoNascita) meta.push('Nato nel '+esc(player.annoNascita));
  if(player.ruoloPrevalente) meta.push(esc(player.ruoloPrevalente));
  return '<div class="rb-player-header">'+photo+
    '<div><h2>'+esc(player.nome)+'</h2><div class="rb-meta">'+meta.join(' &middot; ')+'</div></div>'+
  '</div>';
}

/* Tabellina con altezza/peso nei tre periodi della stagione, per
   seguire la crescita fisica del giocatore. Non mostrata se non ci
   sono affatto misure salvate. */
function fisicoCardHtml(player){
  var ED = window.EvalData;
  if(!ED.fisicoHasAnyData(player.id)) return '';
  var series = ED.fisicoSeries(player.id);
  function fmtNum(v, suffix){ return (v===null||v===undefined||isNaN(v)) ? '-' : (v + suffix); }
  function deltaCell(curr, prev){
    if(curr===null || prev===null) return '';
    var d = Math.round((curr-prev)*10)/10;
    if(d===0) return '';
    return ' <span class="rb-delta">('+(d>0?'+':'')+d+')</span>';
  }
  var prevAltezza = null, prevPeso = null;
  var altezzaCells = '', pesoCells = '';
  series.forEach(function(row){
    altezzaCells += '<td class="rb-mono">'+fmtNum(row.altezza,' cm')+deltaCell(row.altezza, prevAltezza)+'</td>';
    pesoCells += '<td class="rb-mono">'+fmtNum(row.peso,' kg')+deltaCell(row.peso, prevPeso)+'</td>';
    if(row.altezza!==null) prevAltezza = row.altezza;
    if(row.peso!==null) prevPeso = row.peso;
  });
  return '<div class="rb-card"><h3>Crescita fisica</h3>'+
    '<table class="rb-table"><thead><tr><th>Misura</th>'+
      series.map(function(row){ return '<th>'+esc(row.label)+'</th>'; }).join('')+
    '</tr></thead><tbody>'+
    '<tr><td>Altezza</td>'+altezzaCells+'</tr>'+
    '<tr><td>Peso</td>'+pesoCells+'</tr>'+
    '</tbody></table></div>';
}

/* Sezione completa per un giocatore: dati, valutazione tecnica,
   autovalutazione, confronto. periodKey e' una delle chiavi di
   EvalData.PERIODS ('settembre'|'gennaio'|'maggio'). */
function playerSectionHtml(player, periodKey, opts){
  opts = opts || {};
  var ED = window.EvalData;
  var periodLbl = (ED.PERIODS.find(function(p){return p.key===periodKey;})||{}).label || periodKey;

  var tecnici = ED.getValTecnici(player.id, periodKey); /* [{id,nome,color}, ...] */
  var autoHas = ED.autoHasData(player.id, periodKey);
  var autoAvgs = ED.autoGroupAverages(player.id, periodKey);
  var autoTot = ED.autoTotalAverage(player.id, periodKey);

  var html = opts.skipHeader ? '' : playerHeaderHtml(player);
  html += '<div class="rb-period-banner">Periodo: '+esc(periodLbl)+'</div>';

  html += fisicoCardHtml(player);

  html += '<div class="rb-grid2">';

  if(tecnici.length===0){
    html += '<div class="rb-card"><h3>Valutazione tecnica <span class="rb-tag">allenatore</span></h3>'+
      '<p class="rb-empty">Nessun tecnico ha ancora valutato questo giocatore in questo periodo.</p></div>';
  } else {
    tecnici.forEach(function(t){
      var avgs = ED.valGroupAverages(player.id, periodKey, t.id);
      var tot = ED.valTotalAverage(player.id, periodKey, t.id);
      html += '<div class="rb-card"><h3>'+esc(t.nome)+' <span class="rb-tag">tecnico</span></h3>';
      ED.VAL_GROUPS.forEach(function(g){ html += barRow(g.label, avgs[g.key], t.color); });
      html += '<div class="rb-total">Media totale: <strong style="color:'+scoreColor(tot)+'">'+fmt(tot)+'</strong></div>';
      html += '</div>';
    });
  }

  html += '<div class="rb-card"><h3>Autovalutazione <span class="rb-tag">giocatore</span></h3>';
  if(!autoHas){
    html += '<p class="rb-empty">Nessun dato per questo periodo.</p>';
  } else {
    ED.AUTO_GROUPS.forEach(function(g){ html += barRow(g.label, autoAvgs[g.key], g.color); });
    html += '<div class="rb-total">Media totale: <strong style="color:'+scoreColor(autoTot)+'">'+fmt(autoTot)+'</strong></div>';
    var goals = ED.autoGoals(player.id, periodKey);
    if(goals.obiettivoPersonale || goals.obiettivoTecnico){
      html += '<div class="rb-goals">';
      if(goals.obiettivoPersonale) html += '<p><strong>Obiettivo personale:</strong> '+esc(goals.obiettivoPersonale)+'</p>';
      if(goals.obiettivoTecnico) html += '<p><strong>Obiettivo tecnico:</strong> '+esc(goals.obiettivoTecnico)+'</p>';
      html += '</div>';
    }
  }
  html += '</div>';

  html += '</div>'; /* /rb-grid2 */

  if(tecnici.length>0 || autoHas){
    html += '<div class="rb-card"><h3>Confronto tra tutte le valutazioni</h3>';
    html += '<table class="rb-table"><thead><tr><th>Area</th>';
    tecnici.forEach(function(t){ html += '<th style="color:'+t.color+'">'+esc(t.nome)+'</th>'; });
    html += '<th style="color:#7C6650">Giocatore</th></tr></thead><tbody>';
    ED.COMPARISON_MAP.forEach(function(m){
      var av = autoAvgs[m.autoKey];
      html += '<tr><td>'+esc(m.label)+'</td>';
      tecnici.forEach(function(t){
        var vv = ED.valGroupAverages(player.id, periodKey, t.id)[m.valKey];
        html += '<td class="rb-mono">'+fmt(vv)+'</td>';
      });
      html += '<td class="rb-mono">'+fmt(av)+'</td></tr>';
    });
    html += '</tbody></table>';
    if(tecnici.length>1){
      html += '<p class="rb-note">Quando piu\' di un tecnico ha valutato lo stesso giocatore, un forte scostamento tra le loro colonne puo\' segnalare un criterio di valutazione da allineare.</p>';
    }
    if(tecnici.length>0 && autoHas){
      var avgTecTot = 0, nTec=0;
      tecnici.forEach(function(t){ var tt=ED.valTotalAverage(player.id, periodKey, t.id); if(tt!==null){avgTecTot+=tt; nTec++;} });
      if(nTec>0 && autoTot!==null){
        var diff = autoTot - (avgTecTot/nTec);
        var note = Math.abs(diff)<0.4
          ? 'Il giocatore ha una percezione di se\' molto allineata alla media dei tecnici.'
          : (diff>0
            ? 'In media il giocatore si valuta piu\' in alto rispetto ai tecnici.'
            : 'In media il giocatore si valuta piu\' in basso rispetto ai tecnici.');
        html += '<p class="rb-note">'+note+'</p>';
      }
    }
    html += '</div>';
  }

  return html;
}

var PAGE_CSS = ''+
'@page{ size:A4; margin:16mm 14mm; }'+
'*{box-sizing:border-box;}'+
'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#12232A;margin:0;background:#fff;}'+
'.rb-toolbar{position:sticky;top:0;background:#F2EFE6;border-bottom:1px solid #DDD1B8;padding:12px 18px;display:flex;gap:10px;align-items:center;justify-content:space-between;z-index:10;}'+
'.rb-toolbar h1{font-size:15px;margin:0;color:#00212F;}'+
'.rb-toolbar button{background:#004860;color:#fff;border:none;padding:10px 16px;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer;}'+
'.rb-doc{max-width:760px;margin:0 auto;padding:18px 22px 40px 22px;}'+
'.rb-brand{display:flex;align-items:center;gap:10px;margin-bottom:6px;color:#51666D;font-size:12px;}'+
'.rb-player-header{display:flex;align-items:center;gap:14px;margin:14px 0 4px 0;}'+
'.rb-player-header h2{font-size:21px;margin:0;}'+
'.rb-meta{font-size:12.5px;color:#51666D;}'+
'.rb-photo{width:64px;height:64px;border-radius:50%;background-size:cover;background-position:center;flex-shrink:0;border:2px solid #DDD1B8;}'+
'.rb-photo-fallback{display:flex;align-items:center;justify-content:center;background:#F6F3EC;color:#51666D;font-weight:700;}'+
'.rb-period-banner{display:inline-block;background:#EDE4D2;color:#00212F;font-size:12px;font-weight:600;padding:5px 10px;border-radius:8px;margin:8px 0 14px 0;}'+
'.rb-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}'+
'.rb-card{background:#F6F3EC;border:1px solid #DDD1B8;border-radius:12px;padding:14px 16px;margin-bottom:14px;break-inside:avoid;}'+
'.rb-card h3{font-size:14px;margin:0 0 10px 0;color:#004860;}'+
'.rb-tag{font-size:10px;font-weight:600;color:#7C6650;text-transform:uppercase;letter-spacing:.4px;}'+
'.rb-empty{font-size:12.5px;color:#51666D;font-style:italic;}'+
'.rb-bar-row{margin-bottom:9px;}'+
'.rb-bar-label{display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:3px;}'+
'.rb-bar-track{height:8px;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #DDD1B8;}'+
'.rb-bar-fill{height:100%;}'+
'.rb-total{margin-top:8px;font-size:12.5px;}'+
'.rb-mono{font-family:Consolas,Menlo,monospace;font-weight:700;}'+
'.rb-delta{font-weight:600;color:#2E8F72;}'+
'.rb-goals{margin-top:10px;font-size:12px;line-height:1.5;}'+
'.rb-goals p{margin:0 0 6px 0;}'+
'.rb-table{width:100%;border-collapse:collapse;font-size:12.5px;}'+
'.rb-table th,.rb-table td{padding:7px 8px;text-align:center;border-bottom:1px solid #DDD1B8;}'+
'.rb-table th:first-child,.rb-table td:first-child{text-align:left;}'+
'.rb-table th{color:#51666D;font-weight:600;font-size:11px;text-transform:uppercase;}'+
'.rb-qa-group{margin-bottom:14px;break-inside:avoid;}'+
'.rb-qa-group:last-child{margin-bottom:0;}'+
'.rb-qa-group h4{font-size:11.5px;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:.3px;}'+
'.rb-qa-table td:first-child{font-size:12px;}'+
'.rb-note{font-size:12px;color:#51666D;margin:8px 0 0 0;}'+
'.rb-page-break{page-break-after:always;}'+
/* Versione compatta usata SOLO dal riepilogo stampabile "solo
   autovalutazioni" (window.RugbyReport.openSquadAutoReport): deve
   stare, per quanto possibile, in un unico foglio per giocatore pur
   elencando ogni singola domanda/risposta di ogni periodo compilato.
   Tutte le regole sono annidate sotto .rb-auto-doc per non toccare
   l'aspetto degli altri report (Riepilogo Squadra, PDF singolo
   giocatore). */
'.rb-auto-doc{font-size:11px;}'+
'.rb-auto-doc .rb-player-header{margin:1px 0 3px 0;gap:8px;}'+
'.rb-auto-doc .rb-photo{width:30px;height:30px;}'+
'.rb-auto-doc .rb-player-header h2{font-size:16px;}'+
'.rb-auto-doc .rb-meta{font-size:10px;}'+
'.rb-auto-doc .rb-card{padding:5px 8px;margin-bottom:5px;break-inside:auto;}'+
'.rb-auto-doc .rb-card h3{font-size:11.5px;margin:0 0 3px 0;}'+
'.rb-auto-doc .rb-tag{font-size:8px;}'+
/* I 4 gruppi di competenza affiancati su un'unica riga (invece di 2x2):
   dimezza l'altezza occupata da ciascun periodo rispetto a impilarli,
   il cambiamento con la maggiore resa nel far stare tutto in un foglio. */
'.rb-auto-doc .rb-qa-groups{display:grid;grid-template-columns:repeat(4,1fr);gap:0 6px;}'+
'.rb-auto-doc .rb-qa-group{margin-bottom:3px;break-inside:avoid;}'+
'.rb-auto-doc .rb-qa-group h4{font-size:7.6px;margin:1px 0 1px 0;}'+
'.rb-auto-doc .rb-qa-table{font-size:6.6px;line-height:1.05;}'+
'.rb-auto-doc .rb-qa-table th,.rb-auto-doc .rb-qa-table td{padding:0.5px 2px;}'+
'.rb-auto-doc .rb-qa-table td:first-child{font-size:6.6px;}'+
'.rb-auto-doc .rb-qa-table td:last-child,.rb-auto-doc .rb-qa-table th:last-child{white-space:nowrap;}'+
'.rb-auto-doc .rb-total{font-size:9.5px;margin-top:2px;}'+
'.rb-auto-doc .rb-goals{font-size:9px;margin-top:2px;line-height:1.25;}'+
'.rb-auto-doc .rb-goals p{margin:0 0 1px 0;}'+
'.rb-auto-doc .rb-empty{font-size:10px;}'+
'@media print{ .rb-toolbar{display:none;} body{background:#fff;} .rb-doc{max-width:none;padding:0;} }';

function openReportWindow(title, innerHtml){
  var win = window.open('', '_blank');
  if(!win){
    alert('Il browser ha bloccato l\'apertura della finestra di stampa. Consenti i popup per questo sito e riprova.');
    return null;
  }
  var doc = '<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">'+
    '<title>'+esc(title)+'</title><style>'+PAGE_CSS+'</style></head><body>'+
    '<div class="rb-toolbar"><h1>'+esc(title)+'</h1>'+
    '<button onclick="window.print()">&#128424; Stampa / Salva PDF</button></div>'+
    '<div class="rb-doc">'+innerHtml+
    '<p style="margin-top:10px;font-size:9px;color:#9AA;">Generato il '+esc(new Date().toLocaleDateString('it-IT'))+' — Rugby Club Pasian di Prato</p>'+
    '</div></body></html>';
  win.document.open();
  win.document.write(doc);
  win.document.close();
  return win;
}

function openPlayerReport(player, periodKey){
  var html = playerSectionHtml(player, periodKey);
  openReportWindow('Riepilogo — ' + player.nome, html);
}

function openSquadReport(players, periodKey, seasonLabel){
  var html = '<h2 style="font-family:inherit;margin-top:0;">Riepilogo Squadra'+(seasonLabel?' — '+esc(seasonLabel):'')+'</h2>';
  if(players.length===0){
    html += '<p class="rb-empty">Nessun giocatore in rosa.</p>';
  }
  players.forEach(function(player, i){
    html += '<div'+(i>0?' class="rb-page-break-wrap"':'')+'>'+playerSectionHtml(player, periodKey)+'</div>';
    if(i < players.length-1) html += '<div class="rb-page-break"></div>';
  });
  openReportWindow('Riepilogo Squadra', html);
}

/* Tabella domanda/risposta per un gruppo di competenze (una riga per
   ciascuna domanda dell'autovalutazione, con la risposta testuale del
   ragazzo, non solo il numero), usata dal dettaglio completo qui sotto. */
function autoSkillGroupTableHtml(group){
  var rows = group.skills.map(function(s){
    return '<tr><td>'+esc(s.name)+'</td>'+
      '<td class="rb-mono" style="color:'+scoreColor(s.value)+'">'+(s.answerLabel ? esc(s.answerLabel) : '-')+'</td></tr>';
  }).join('');
  return '<div class="rb-qa-group"><h4 style="color:'+group.color+'">'+esc(group.label)+'</h4>'+
    '<table class="rb-table rb-qa-table"><thead><tr><th>Domanda</th><th>Risposta</th></tr></thead><tbody>'+rows+'</tbody></table>'+
  '</div>';
}

/* Pagina completa di un giocatore con la sola autovalutazione (senza
   la valutazione del tecnico ne' il confronto): TUTTI i periodi della
   stagione (Settembre/Gennaio/Maggio) compilati, uno di seguito
   all'altro, cosi che una sola pagina mostri l'intero percorso del
   ragazzo, non solo il periodo filtrato a video. Per ciascun periodo
   elenca ogni singola domanda con la risposta data dal ragazzo (non
   solo le medie per area), piu' gli obiettivi e il ruolo desiderato
   dichiarati. Impaginazione compatta (vedi .rb-auto-doc in PAGE_CSS):
   i due gruppi di competenze di ogni riga stanno affiancati e i
   periodi senza alcun dato non occupano spazio, cosi' il tutto resta,
   per quanto possibile, su un solo foglio per giocatore. Usata dal
   riepilogo stampabile "solo autovalutazioni" qui sotto. */
function autoOnlySectionHtml(player){
  var ED = window.EvalData;
  var html = playerHeaderHtml(player);
  var anyPeriod = false;

  ED.PERIODS.forEach(function(per){
    var autoHas = ED.autoHasData(player.id, per.key);
    var autoTot = ED.autoTotalAverage(player.id, per.key);
    var skillGroups = ED.autoSkillAnswers(player.id, per.key);
    var goals = ED.autoGoals(player.id, per.key);
    var hasGoals = !!(goals.obiettivoPersonale || goals.obiettivoTecnico || goals.ruoloDesiderato);

    /* Periodo senza alcun dato: salta del tutto la card, non occupa
       spazio sul foglio (invece di un "Nessun dato" che costa righe). */
    if(!autoHas && !hasGoals) return;
    anyPeriod = true;

    html += '<div class="rb-card"><h3>'+esc(per.label)+' <span class="rb-tag">autovalutazione</span></h3>';
    if(autoHas){
      html += '<div class="rb-qa-groups">';
      skillGroups.forEach(function(g){ html += autoSkillGroupTableHtml(g); });
      html += '</div>';
      html += '<div class="rb-total">Media totale: <strong style="color:'+scoreColor(autoTot)+'">'+fmt(autoTot)+'</strong></div>';
    } else {
      html += '<p class="rb-empty">Nessun punteggio inserito per questo periodo.</p>';
    }
    if(hasGoals){
      html += '<div class="rb-goals">';
      if(goals.obiettivoPersonale) html += '<p><strong>Obiettivo personale:</strong> '+esc(goals.obiettivoPersonale)+'</p>';
      if(goals.obiettivoTecnico) html += '<p><strong>Obiettivo tecnico:</strong> '+esc(goals.obiettivoTecnico)+'</p>';
      if(goals.ruoloDesiderato) html += '<p><strong>Ruolo desiderato:</strong> '+esc(goals.ruoloDesiderato)+'</p>';
      html += '</div>';
    }
    html += '</div>';
  });

  if(!anyPeriod){
    html += '<p class="rb-empty">Nessuna autovalutazione compilata per nessun periodo.</p>';
  }
  return html;
}

/* Riepilogo stampabile con le sole autovalutazioni di tutti i
   giocatori della rosa, una pagina per giocatore con il percorso
   completo nei tre periodi: resta separato dal Riepilogo Squadra (che
   confronta anche con i tecnici, periodo per periodo). */
function openSquadAutoReport(players, seasonLabel){
  var html = '<div class="rb-auto-doc">';
  html += '<h2 style="font-family:inherit;margin:0 0 4px 0;font-size:15px;">Autovalutazioni Squadra'+(seasonLabel?' — '+esc(seasonLabel):'')+'</h2>';
  if(players.length===0){
    html += '<p class="rb-empty">Nessun giocatore in rosa.</p>';
  }
  players.forEach(function(player, i){
    html += '<div>'+autoOnlySectionHtml(player)+'</div>';
    if(i < players.length-1) html += '<div class="rb-page-break"></div>';
  });
  html += '</div>';
  openReportWindow('Autovalutazioni Squadra', html);
}

/* Sottoinsieme di stili riusabile dalle pagine che incorporano
   playerSectionHtml() nel proprio DOM (es. Confronto), senza aprire
   una finestra di stampa separata. */
var CARD_CSS = ''+
'.rb-card{background:#F6F3EC;border:1px solid #DDD1B8;border-radius:12px;padding:14px 16px;margin-bottom:14px;}'+
'.rb-card h3{font-size:14px;margin:0 0 10px 0;color:#004860;}'+
'.rb-tag{font-size:10px;font-weight:600;color:#7C6650;text-transform:uppercase;letter-spacing:.4px;}'+
'.rb-empty{font-size:12.5px;color:#51666D;font-style:italic;}'+
'.rb-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}'+
'@media (max-width:640px){.rb-grid2{grid-template-columns:1fr;}}'+
'.rb-bar-row{margin-bottom:9px;}'+
'.rb-bar-label{display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:3px;}'+
'.rb-bar-track{height:8px;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #DDD1B8;}'+
'.rb-bar-fill{height:100%;}'+
'.rb-total{margin-top:8px;font-size:12.5px;}'+
'.rb-mono{font-family:Consolas,Menlo,monospace;font-weight:700;}'+
'.rb-delta{font-weight:600;color:#2E8F72;}'+
'.rb-goals{margin-top:10px;font-size:12px;line-height:1.5;}'+
'.rb-goals p{margin:0 0 6px 0;}'+
'.rb-table{width:100%;border-collapse:collapse;font-size:12.5px;}'+
'.rb-table th,.rb-table td{padding:7px 8px;text-align:center;border-bottom:1px solid #DDD1B8;}'+
'.rb-table th:first-child,.rb-table td:first-child{text-align:left;}'+
'.rb-table th{color:#51666D;font-weight:600;font-size:11px;text-transform:uppercase;}'+
'.rb-qa-group{margin-bottom:14px;}'+
'.rb-qa-group:last-child{margin-bottom:0;}'+
'.rb-qa-group h4{font-size:11.5px;margin:0 0 6px 0;text-transform:uppercase;letter-spacing:.3px;}'+
'.rb-qa-table td:first-child{font-size:12px;}'+
'.rb-note{font-size:12px;color:#51666D;margin:8px 0 0 0;}'+
'.rb-period-banner{display:inline-block;background:#EDE4D2;color:#00212F;font-size:12px;font-weight:600;padding:5px 10px;border-radius:8px;margin:8px 0 14px 0;}';

window.RugbyReport = {
  openPlayerReport: openPlayerReport,
  openSquadReport: openSquadReport,
  openSquadAutoReport: openSquadAutoReport,
  playerSectionHtml: playerSectionHtml,
  cardCss: CARD_CSS
};

})(window);
