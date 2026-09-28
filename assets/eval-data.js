/* ============================================================
   EVAL DATA — copia di sola lettura delle competenze e delle
   funzioni di calcolo delle due schede (Valutazione e
   Autovalutazione), usata dalle pagine Squadra/Riepilogo/Confronto
   per leggere i punteggi senza dover caricare le app complete.
   Le due app originali restano invariate e continuano a scrivere
   negli stessi due localStorage key qui sotto.
============================================================ */
(function(window){
"use strict";

var VAL_KEY = 'rugbyU14_valutazioni_v2';
var AUTO_KEY = 'rugbyU14_autovalutazione_v1';

var PERIODS = [
  {key:'settembre', label:'Settembre'},
  {key:'gennaio', label:'Gennaio'},
  {key:'maggio', label:'Maggio'}
];

/* --- Tassonomia Scheda Valutazione (allenatore) --- */
var VAL_GROUPS = [
  {key:'tech', label:'Capacita Tecniche', color:'#2E75B6', short:'TEC'},
  {key:'phys', label:'Capacita Fisiche', color:'#C55A11', short:'FIS'},
  {key:'cog', label:'Capacita Cognitive', color:'#548235', short:'COG'},
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
function autoGoals(playerId, periodKey){
  var p = autoPlayerRaw(playerId);
  if(!p || !p.valutazioni || !p.valutazioni[periodKey]) return {obiettivoPersonale:'',obiettivoTecnico:'',ruoloDesiderato:''};
  var pd = p.valutazioni[periodKey];
  return { obiettivoPersonale: pd.obiettivoPersonale||'', obiettivoTecnico: pd.obiettivoTecnico||'', ruoloDesiderato: pd.ruoloDesiderato||'' };
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
  autoGoals: autoGoals,
  fmt: fmt
};

})(window);
