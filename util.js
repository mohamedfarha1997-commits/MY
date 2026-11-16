// Pure helpers shared by the app. No DOM, no app state.
export const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
export const STAMPED=['orders','batches','done','products','materials'];
export function f(n){return nf.format(n);}
export function r3(x){return Math.round(x*1000)/1000;}
export function num(s){
  var map={'٠':0,'١':1,'٢':2,'٣':3,'٤':4,'٥':5,'٦':6,'٧':7,'٨':8,'٩':9};
  s=String(s).replace(/[٠-٩]/g,function(d){return map[d];}).replace(/[٫,]/g,'.').trim();
  var v=parseFloat(s);return isFinite(v)?v:NaN;
}
export function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
export function unesc(s){return String(s==null?'':s).replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');}
export function canon(x){return JSON.stringify(x,function(k,v){
  return v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce(function(o,kk){o[kk]=v[kk];return o;},{}):v;});}
export function recSig(r){var c={};Object.keys(r).forEach(function(k){if(k!=='_u')c[k]=r[k];});return canon(c);}
export function parseTolerant(t){
  try{return JSON.parse(t);}catch(e){
    for(var j=t.lastIndexOf('}');j>0;j=t.lastIndexOf('}',j-1)){
      try{return JSON.parse(t.slice(0,j+1));}catch(_){}
    }
    throw e;
  }
}
export function mergePlog(a,b){
  var out={};
  [a,b].forEach(function(s){
    Object.keys(s).forEach(function(id){
      var x=s[id];if(!x)return;
      var y=out[id];
      if(!y){out[id]=JSON.parse(JSON.stringify(x));return;}
      var by=(y.by||[]).slice();(x.by||[]).forEach(function(c){if(by.indexOf(c)<0)by.push(c);});
      var seen={},ev=(y.ev||[]).concat(x.ev||[]).filter(function(v){var k=v.c+'|'+v.a+'|'+v.t;if(seen[k])return false;seen[k]=1;return true;}).sort(function(p,q){return p.t-q.t;}).slice(-40);
      var at=(y.at&&x.at)?Math.min(y.at,x.at):(y.at||x.at);
      out[id]={p:y.p||x.p,qty:y.qty||x.qty,at:at,by:by,ev:ev};
    });
  });
  return out;
}
export function mergeStates(a,b){
  /* الإعدادات والمستخدمين (غير المسجلين لكل سجل) بياخدهم الأحدث، عشان الحالة الفاضية عند فتح الصفحة متمسحش اللي في درايف */
  var newer=(a.savedAt||0)>=(b.savedAt||0)?a:b,older=newer===a?b:a;
  var M=Object.assign({},older,newer);
  M.tomb={};
  STAMPED.forEach(function(c){
    var tomb={};
    [a,b].forEach(function(s){var t=(s.tomb&&s.tomb[c])||{};Object.keys(t).forEach(function(id){tomb[id]=Math.max(tomb[id]||0,t[id]);});});
    var by={};
    [a,b].forEach(function(s){(s[c]||[]).forEach(function(r){if(!by[r.id]||(r._u||0)>(by[r.id]._u||0))by[r.id]=r;});});
    M[c]=Object.keys(by).filter(function(id){return tomb[id]===undefined||(by[id]._u||0)>tomb[id];}).sort().map(function(id){return by[id];});
    M.tomb[c]=tomb;
  });
  ['stock','ready'].forEach(function(m){
    var v={},t={};
    [a,b].forEach(function(s){var st=s[m]||{},tt=s[m+'T']||{};Object.keys(st).forEach(function(id){var ti=tt[id]||0;if(!(id in t)||ti>t[id]){t[id]=ti;v[id]=st[id];}});});
    M[m]=v;M[m+'T']=t;
  });
  M.seq=Math.max(a.seq||0,b.seq||0);
  M.oseq=Math.max(a.oseq||0,b.oseq||0);
  M.fseq=Math.max(a.fseq||0,b.fseq||0);
  M.savedAt=Math.max(a.savedAt||0,b.savedAt||0);
  M.locks=Object.assign({},b.locks||{},a.locks||{});
  /* كل إعداد ليه وقته: الجهاز اللي غيّر إعداد معين هو اللي بيحسم فيه، مش الجهاز اللي حفظ آخر مرة */
  var pa=a.prefs||{},pb=b.prefs||{},ka=a.prefsK||{},kb=b.prefsK||{};
  var keys={};Object.keys(pa).concat(Object.keys(pb)).forEach(function(k){keys[k]=1;});
  M.prefs={};M.prefsK={};
  Object.keys(keys).forEach(function(k){
    var ta=ka[k]||0,tb=kb[k]||0;
    var fromA=(pa[k]!==undefined)&&(ta>=tb||pb[k]===undefined);
    M.prefs[k]=fromA?pa[k]:pb[k];
    M.prefsK[k]=Math.max(ta,tb);
  });
  M.prefsT=Math.max(a.prefsT||0,b.prefsT||0);
  /* سجل الإنتاج: الحركات من الجهازين بتتجمع، والدفعة المحذوفة بتفضل محذوفة إلا لو فيها حركة أحدث من الحذف */
  var pt={};
  [a,b].forEach(function(s){var t=s.plogTomb||{};Object.keys(t).forEach(function(id){pt[id]=Math.max(pt[id]||0,t[id]);});});
  M.plogTomb=pt;
  M.plog=mergePlog(a.plog||{},b.plog||{});
  Object.keys(M.plog).forEach(function(id){
    var e=M.plog[id],last=(e.ev||[]).reduce(function(m,v){return Math.max(m,v.t||0);},e.at||0);
    if(pt[id]!==undefined&&pt[id]>=last)delete M.plog[id];
  });
  return M;
}
export function unitGrams(u){return u==='كجم'?1000:u==='جرام'?1:u==='بيضة'?50:null;}
export function isWeightU(u){return u==='جرام'||u==='كجم';}
export function convK(ou,nu){var ao=unitGrams(ou),an=unitGrams(nu);if(ao&&an)return ao/an;return 1;}
export function isPieceU(u){return !u||['قطعة','صاج','كادر','تورته','بولة','كاس','سفنديش كبير','سفنديش صغير','سفنديش وسط','فورمة كبيرة','فورمة صغيرة','فخارة'].indexOf(u)>-1;}
export function mmss(ms){var s=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
export function ymKey(t){var d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
export function monthKey(ts){var d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
export function tstr(ts){
  if(!ts)return '';
  var d=new Date(ts);function z(n){return String(n).padStart(2,'0');}
  return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+z(d.getHours())+':'+z(d.getMinutes());
}
export function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
export function ago(ts){var m=Math.round((Date.now()-ts)/60000);if(m<1)return 'الآن';if(m<60)return 'منذ '+m+' د';return 'منذ '+Math.floor(m/60)+' س';}
export function stamp(){return new Date().toISOString().slice(0,10);}
