/* ============================================================
   EVAL DATA — copia di sola lettura delle competenze e delle
   funzioni di calcolo delle due schede (Valutazione e
   Autovalutazione), usata dalle pagine Squadra/Riepilogo/Confronto
   per leggere i punteggi senza dover caricare le app complete.
   Le due app originali restano invariate e continuano a scrivere
   negli stessi due localStorage key qui sotto. Legge anche le
   misure fisiche (altezza/peso) salvate dalla scheda Giocatore.
============================================================ */
(function(window){
"use strict";

var VAL_KEY = 'rugbyU14_valutazioni_v2';
var AUTO_KEY = 'rugbyU14_autovalutazione_v1';
var FISICO_KEY = 'rugbyU14_fisico_v1';

var PERIODS = [
  {key:'settembre', label:'Settembre'},
  {key:'gennaio', label:'Gennaio'},
  {key:'maggio', label:'Maggio'}
];

/* --- Tassonomia Scheda Valutazione (allenatore) --- */
var VAL_GROUPS = [
  {key:'tech', label:'Capacita Tecniche', color:'#2E75B6', short:'TEC'},
  {key:'cog', label:'Capacita Cognitive', color:'#548235', short:'COG'},
  {key:'phys', label:'Capacita Fisiche', color:'#C55A11', short:'FIS'},
  {key:'comp', label:'Capacita Comportamentali', color:'#7030A0', short:'COM'}
];
/* --- Tassonomia Autovalutazione (giocatore) --- */
var AUTO_GROUPS = [
  {key:'tech', label:'Tecnica individuale', color:'#2E75B6', short:'TEC'},
  {key:'lettura', label:'Lettura del gioco', color:'#548235', short:'LET'},
  {key:'phys', label:'Il mio fisico', color:'#C55A11', short:'FIS'},
  {key:'comp', label:'Testa e Squadra', color:'#7030A0', short:'T&S'}
];

/* Mappa di confronto: a quale area dell'autovalutazione corrisponde
   ciascuna area della scheda tecnica dell'allenatore. La corrispondenza
   e' concettuale (stessa area di competenza), non skill-per-skill:
   - Capacita Tecniche  <-> Tecnica individuale (gesti col pallone)
   - Capacita Cognitive <-> Lettura del gioco (lettura spazi/decisioni)
   - Capacita Fisiche   <-> Il mio fisico
   - Capacita Comportamentali <-> Testa e Squadra */
var COMPARISON_MAP = [
  { label:'Tecnica', color:'#2E75B6', valKey:'tech', autoKey:'tech' },
  { label:'Lettura del gioco', color:'#548235', valKey:'cog', autoKey:'lettura' },
  { label:'Fisico', color:'#C55A11', valKey:'phys', autoKey:'phys' },
  { label:'Testa e Squadra', color:'#7030A0', valKey:'comp', autoKey:'comp' }
];

function readRaw(key){
  try{
    var raw = localStorage.getItem(key);
    if(!raw) return [];
    var parsed = JSON.parse(raw);
    return (parsed && Array.isArray(parsed.players)) ? parsed.players : [];
  }catch(e){ return []; }
}

function fmt(v){ return (v===null||v===undefined||isNaN(v)) ? null : Math.round(v*10)/10; }

/* Tavolozza colori per distinguere piu' tecnici nei grafici/tabelle.
   Il giocatore (autovalutazione) usa sempre il colore oro, a parte. */
var TECNICO_COLORS = ['#004860', '#B8701F', '#548235', '#7030A0', '#B5533C'];
function tecnicoColor(index){ return TECNICO_COLORS[index % TECNICO_COLORS.length]; }

/* ---- Lettura Scheda Valutazione (supporta piu' tecnici) ---- */
function valPlayerRaw(playerId){
  return readRaw(VAL_KEY).find(function(p){return p.id===playerId;}) || null;
}
/* Elenco dei tecnici che hanno valutato questo giocatore nel periodo,
   ciascuno con un colore stabile per i grafici. */
function getValTecnici(playerId, periodKey){
  var p = valPlayerRaw(playerId);
  if(!p || !p.valutazioni || !p.valutazioni[periodKey] || !p.valutazioni[periodKey].byTecnico) return [];
  var bt = p.valutazioni[periodKey].byTecnico;
  return Object.keys(bt)
    .filter(function(tid){ return bt[tid] && bt[tid].scores && Object.keys(bt[tid].scores).length>0; })
    .sort()
    .map(function(tid, i){ return { id: tid, nome: bt[tid].nome || tid, color: tecnicoColor(i) }; });
}
function valGroupAverages(playerId, periodKey, tecnicoId){
  var p = valPlayerRaw(playerId);
  var out = {};
  VAL_GROUPS.forEach(function(g){ out[g.key] = null; });
  if(!p || !p.valutazioni || !p.valutazioni[periodKey] || !p.valutazioni[periodKey].byTecnico || !tecnicoId) return out;
  var entry = p.valutazioni[periodKey].byTecnico[tecnicoId];
  if(!entry) return out;
  var scores = entry.scores || {};
  /* Media diretta di tutte le skill del gruppo (l'elenco degli id
     skill per gruppo e' definito piu' sotto, allineato all'app). */
  Object.keys(VAL_SKILL_IDS).forEach(function(gkey){
    var ids = VAL_SKILL_IDS[gkey];
    var sum=0,n=0;
    ids.forEach(function(id){ var v=scores[id]; if(v!==undefined&&v!==null&&v!==''){ sum+=Number(v); n++; } });
    out[gkey] = n>0 ? fmt(sum/n) : null;
  });
  return out;
}
function valTotalAverage(playerId, periodKey, tecnicoId){
  var avgs = valGroupAverages(playerId, periodKey, tecnicoId);
  var sum=0,n=0;
  VAL_GROUPS.forEach(function(g){ if(avgs[g.key]!==null){ sum+=avgs[g.key]; n++; } });
  return n>0 ? fmt(sum/n) : null;
}
/* Media tra tutti i tecnici che hanno valutato (utile per una vista
   d'insieme rapida, es. la tabella Riepilogo Squadra). */
function valCombinedGroupAverages(playerId, periodKey){
  var tecnici = getValTecnici(playerId, periodKey);
  var out = {};
  VAL_GROUPS.forEach(function(g){
    var sum=0,n=0;
    tecnici.forEach(function(t){ var a = valGroupAverages(playerId, periodKey, t.id)[g.key]; if(a!==null){ sum+=a; n++; } });
    out[g.key] = n>0 ? fmt(sum/n) : null;
  });
  return out;
}
function valCombinedTotalAverage(playerId, periodKey){
  var avgs = valCombinedGroupAverages(playerId, periodKey);
  var sum=0,n=0;
  VAL_GROUPS.forEach(function(g){ if(avgs[g.key]!==null){ sum+=avgs[g.key]; n++; } });
  return n>0 ? fmt(sum/n) : null;
}
function valHasData(playerId, periodKey){
  return getValTecnici(playerId, periodKey).length > 0;
}

/* elenco id-skill per gruppo (allineato ai file delle due app) */
var VAL_SKILL_IDS = {
  tech: ['pass_dx','pass_sx','ricezione_mov','placc_frontale','placc_laterale','sicurezza_placc','efficacia_contatto','caduta_rialzata',
    'presentazione_pallone','pulizia_punto','decisione_breakdown','sostegno_attacco','scelta_linee','evasione','lettura_spazi','continuita',
    'allineamento_dif','comunicazione_dif','salita_dif','scelta_bersaglio','calcio_dx','calcio_sx','precisione_calcio','presa_volo'],
  phys: ['accelerazione','vel_massima','cambi_direzione','coordinazione','efficacia_fisica_contatto','equilibrio_dinamico','resistenza','stabilita_mobilita'],
  cog: ['lettura','decisione','concentrazione','anticipazione'],
  comp: ['comunicazione','collaborazione','leadership','disciplina','impegno','gestione_emozioni']
};
var VAL_SKILLS_BY_GROUP = VAL_SKILL_IDS; /* alias storico */

/* ---- Lettura Autovalutazione ---- */
var AUTO_SKILL_IDS = {
  tech: ['tec_pass2mani','tec_ricezione_mov','tec_presentazione','tec_vita_contatto','tec_calcio_precisione','tec_presa_volo','tec_placc_sicurezza','tec_placc_paura'],
  lettura: ['let_spazio_prericezione','let_sostegno','let_spazio_avanzare','let_posizione_campo','let_allineamento','let_bersaglio','let_comunicazione','let_salita'],
  phys: ['fis_accelerazione','fis_vel_massima','fis_cambi_direzione','fis_contatto','fis_rialzata','fis_recupero','fis_stanchezza'],
  comp: ['ts_concentrazione','ts_impegno','ts_incoraggiamento','ts_regole','ts_rispetto','ts_ascolto','ts_calma']
};
/* Testo completo di ogni domanda dell'autovalutazione (allineato alla
   scheda Giocatore), usato per stampare domanda-per-domanda, non solo
   le medie per area. */
var AUTO_SKILL_NAMES = {
  tec_pass2mani: 'Passo il pallone preciso con due mani',
  tec_ricezione_mov: 'Ricevo il pallone senza fermarmi',
  tec_presentazione: 'Dopo il contatto metto il pallone a disposizione',
  tec_vita_contatto: 'Faccio vivere il pallone a contatto',
  tec_calcio_precisione: 'Calcio il pallone con precisione',
  tec_presa_volo: 'Prendo il pallone al volo su un calcio',
  tec_placc_sicurezza: 'Placco in sicurezza con la tecnica corretta',
  tec_placc_paura: 'Placco senza paura',
  let_spazio_prericezione: 'Prima di ricevere guardo dov\'e\' lo spazio libero',
  let_sostegno: 'Mi muovo per aiutare il compagno con la palla',
  let_spazio_avanzare: 'Quando ho la palla in mano riesco a trovare lo spazio libero e avanzare',
  let_posizione_campo: 'Corro per mettermi in una posizione utile in campo',
  let_allineamento: 'In difesa mi allineo ai compagni',
  let_bersaglio: 'In difesa capisco su chi difendere',
  let_comunicazione: 'In difesa comunico con i compagni',
  let_salita: 'In difesa avanzo per andare a prendere l\'avversario',
  fis_accelerazione: 'Riesco a scattare veloce sui primi metri',
  fis_vel_massima: 'Riesco a raggiungere rapidamente la massima velocita\'',
  fis_cambi_direzione: 'Riesco a cambiare direzione rapidamente restando in equilibrio',
  fis_contatto: 'Reggo il confronto fisico sul contatto',
  fis_rialzata: 'Riesco a rialzarmi velocemente dopo essere andato a terra',
  fis_recupero: 'Tra uno sforzo e l\'altro recupero rapidamente fiato e forze',
  fis_stanchezza: 'Arrivo a fine allenamento senza essere troppo stanco',
  ts_concentrazione: 'Riesco a stare concentrato per tutta la durata dell\'allenamento',
  ts_impegno: 'Mi impegno al massimo anche negli esercizi che mi piacciono meno',
  ts_incoraggiamento: 'Aiuto e incoraggio i miei compagni in campo',
  ts_regole: 'Rispetto le regole del gioco, l\'arbitro e gli avversari',
  ts_rispetto: 'Rispetto i compagni e lo staff',
  ts_ascolto: 'Ascolto e provo ad applicare le correzioni',
  ts_calma: 'Riesco a stare calmo quando sbaglio e torno subito concentrato'
};
/* Scala di frequenza usata nella scheda Autovalutazione (invariata):
   ogni punteggio 1-5 corrisponde a una risposta testuale, per poter
   stampare la "risposta" del ragazzo e non solo il numero. */
var FREQ_LEVELS = {
  1: { emo:'😕', band:'0-2/10', lbl:'Quasi mai' },
  2: { emo:'😐', band:'3-4/10', lbl:'Raramente' },
  3: { emo:'🙂', band:'5-6/10', lbl:'A volte' },
  4: { emo:'😃', band:'7-8/10', lbl:'Spesso' },
  5: { emo:'🤩', band:'9-10/10', lbl:'Quasi sempre' }
};
function freqAnswerLabel(value){
  var n = Number(value);
  var lvl = FREQ_LEVELS[n];
  if(!lvl) return null;
  return lvl.lbl + ' (' + lvl.band + ')';
}
function autoPlayerRaw(playerId){
  return readRaw(AUTO_KEY).find(function(p){return p.id===playerId;}) || null;
}
function autoGroupAverages(playerId, periodKey){
  var p = autoPlayerRaw(playerId);
  var out = {};
  AUTO_GROUPS.forEach(function(g){ out[g.key] = null; });
  if(!p || !p.valutazioni || !p.valutazioni[periodKey]) return out;
  var scores = p.valutazioni[periodKey].scores || {};
  Object.keys(AUTO_SKILL_IDS).forEach(function(gkey){
    var ids = AUTO_SKILL_IDS[gkey];
    var sum=0,n=0;
    ids.forEach(function(id){ var v=scores[id]; if(v!==undefined&&v!==null&&v!==''){ sum+=Number(v); n++; } });
    out[gkey] = n>0 ? fmt(sum/n) : null;
  });
  return out;
}
function autoTotalAverage(playerId, periodKey){
  var avgs = autoGroupAverages(playerId, periodKey);
  var sum=0,n=0;
  AUTO_GROUPS.forEach(function(g){ if(avgs[g.key]!==null){ sum+=avgs[g.key]; n++; } });
  return n>0 ? fmt(sum/n) : null;
}
function autoHasData(playerId, periodKey){
  var p = autoPlayerRaw(playerId);
  if(!p || !p.valutazioni || !p.valutazioni[periodKey]) return false;
  return Object.keys(p.valutazioni[periodKey].scores || {}).length > 0;
}
/* Ogni singola domanda dell'autovalutazione con la relativa risposta,
   raggruppate per area (nello stesso ordine di AUTO_GROUPS): usata per
   stampare il dettaglio completo domanda-per-domanda, non solo le
   medie per area. */
function autoSkillAnswers(playerId, periodKey){
  var p = autoPlayerRaw(playerId);
  var scores = (p && p.valutazioni && p.valutazioni[periodKey] && p.valutazioni[periodKey].scores) || {};
  return AUTO_GROUPS.map(function(g){
    var ids = AUTO_SKILL_IDS[g.key] || [];
    return {
      key: g.key, label: g.label, color: g.color,
      skills: ids.map(function(id){
        var raw = scores[id];
        var hasAnswer = raw!==undefined && raw!==null && raw!=='';
        return {
          id: id,
          name: AUTO_SKILL_NAMES[id] || id,
          value: hasAnswer ? Number(raw) : null,
          answerLabel: hasAnswer ? freqAnswerLabel(raw) : null
        };
      })
    };
  });
}
function autoGoals(playerId, periodKey){
  var p = autoPlayerRaw(playerId);
  if(!p || !p.valutazioni || !p.valutazioni[periodKey]) return {obiettivoPersonale:'',obiettivoTecnico:'',ruoloDesiderato:''};
  var pd = p.valutazioni[periodKey];
  return { obiettivoPersonale: pd.obiettivoPersonale||'', obiettivoTecnico: pd.obiettivoTecnico||'', ruoloDesiderato: pd.ruoloDesiderato||'' };
}

/* ---- Lettura misure fisiche (altezza/peso per periodo) ---- */
function fisicoPlayerRaw(playerId){
  return readRaw(FISICO_KEY).find(function(p){return p.id===playerId;}) || null;
}
/* Ritorna {altezza, peso} (numeri o null) per il periodo indicato. */
function fisicoMisure(playerId, periodKey){
  var p = fisicoPlayerRaw(playerId);
  var pd = p && p.misure && p.misure[periodKey];
  var altezza = pd && pd.altezza !== undefined && pd.altezza !== null && pd.altezza !== '' ? Number(pd.altezza) : null;
  var peso = pd && pd.peso !== undefined && pd.peso !== null && pd.peso !== '' ? Number(pd.peso) : null;
  return { altezza: (altezza!==null && !isNaN(altezza)) ? altezza : null, peso: (peso!==null && !isNaN(peso)) ? peso : null };
}
/* Tutte le misure del giocatore, un oggetto per periodo, nell'ordine
   di PERIODS: utile per mostrare la crescita nel corso della stagione. */
function fisicoSeries(playerId){
  return PERIODS.map(function(per){
    var m = fisicoMisure(playerId, per.key);
    return { key: per.key, label: per.label, altezza: m.altezza, peso: m.peso };
  });
}
function fisicoHasAnyData(playerId){
  return fisicoSeries(playerId).some(function(row){ return row.altezza!==null || row.peso!==null; });
}

window.EvalData = {
  PERIODS: PERIODS,
  VAL_GROUPS: VAL_GROUPS,
  AUTO_GROUPS: AUTO_GROUPS,
  COMPARISON_MAP: COMPARISON_MAP,
  getValTecnici: getValTecnici,
  valGroupAverages: valGroupAverages,
  valTotalAverage: valTotalAverage,
  valCombinedGroupAverages: valCombinedGroupAverages,
  valCombinedTotalAverage: valCombinedTotalAverage,
  valHasData: valHasData,
  autoGroupAverages: autoGroupAverages,
  autoTotalAverage: autoTotalAverage,
  autoHasData: autoHasData,
  autoSkillAnswers: autoSkillAnswers,
  autoGoals: autoGoals,
  fisicoMisure: fisicoMisure,
  fisicoSeries: fisicoSeries,
  fisicoHasAnyData: fisicoHasAnyData,
  fmt: fmt
};

})(window);
