
// Pure helpers shared by the app. No DOM, no app state.
const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const STAMPED=['orders','batches','done','products','materials','users','waste','boxTpl'];
// خرائط بمفاتيح (أرشيف وأقفال): بتتجمع من الجهازين، والحذف بيتسجل كـ tombstone بوقت
const MAPS=['archive','locks'];
function mapStamp(c,v){if(typeof v==='number')return v;if(v&&typeof v==='object')return v.at||v.savedAt||0;return 0;}
function f(n){return nf.format(n);}
function r3(x){return Math.round(x*1000)/1000;}
function num(s){
  var map={'٠':0,'١':1,'٢':2,'٣':3,'٤':4,'٥':5,'٦':6,'٧':7,'٨':8,'٩':9};
  s=String(s).replace(/[٠-٩]/g,function(d){return map[d];}).replace(/[٫,]/g,'.').trim();
  var v=parseFloat(s);return isFinite(v)?v:NaN;
}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function unesc(s){return String(s==null?'':s).replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');}
function canon(x){return JSON.stringify(x,function(k,v){
  return v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce(function(o,kk){o[kk]=v[kk];return o;},{}):v;});}
/* مقارنة المحتوى بس: من غير أوقات الجهاز (devs/clk/savedAt) عشان مايحصلش رفع مستمر بين الأجهزة */
function coreKey(x){return canon(Object.assign({},x,{devs:0,clk:0,savedAt:0}));}
function recSig(r){var c={};Object.keys(r).forEach(function(k){if(k!=='_u')c[k]=r[k];});return canon(c);}
function parseTolerant(t){
  try{return JSON.parse(t);}catch(e){
    for(var j=t.lastIndexOf('}');j>0;j=t.lastIndexOf('}',j-1)){
      try{return JSON.parse(t.slice(0,j+1));}catch(_){}
    }
    throw e;
  }
}
function mergePlog(a,b){
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
/* دمج سجل واحد: لو عندنا النسخة اللي اتزامنت آخر مرة (base) بنجمع التعديلات حقل بحقل، والتعارض بس على نفس الحقل بيكسبه الأحدث */
/* تجميع ملفات الأقسام: لو أي ملف ناقص أو أقدم من الملف الأساسي بنرجع null */
function combineShards(parts,mainAt){
  if(parts.some(function(p){return !p||!p.data||(p.savedAt||0)<(mainAt||0);}))return null;
  var data={},at=0;
  parts.forEach(function(p){Object.assign(data,p.data);at=Math.max(at,p.savedAt||0);});
  return {data:data,savedAt:at};
}
/* دمج قايمتين من الأساس: العنصر بيفضل لو موجود في الاتنين، والجديد من أي طرف بيتضاف */
function mergeArr(base,a,b){
  var B={},A={},Bb={},out=[],seen={};
  base.forEach(function(x){B[canon({v:x})]=1;});
  a.forEach(function(x){A[canon({v:x})]=1;});
  b.forEach(function(x){Bb[canon({v:x})]=1;});
  base.forEach(function(x){var k=canon({v:x});if(A[k]&&Bb[k]&&!seen[k]){seen[k]=1;out.push(x);}});
  a.concat(b).forEach(function(x){var k=canon({v:x});if(!B[k]&&!seen[k]){seen[k]=1;out.push(x);}});
  return out;
}
function mergeRec(base,a,b){
  var ua=a._u||0,ub=b._u||0;
  if(!base)return ub>ua?b:a;
  var keys={};[a,b,base].forEach(function(r){Object.keys(r).forEach(function(k){keys[k]=1;});});
  delete keys._u;
  var out={};
  Object.keys(keys).forEach(function(k){
    var va=a[k],vb=b[k],v0=base[k];
    var ca=canon({v:va})!==canon({v:v0}),cb=canon({v:vb})!==canon({v:v0});
    var pick=(!ca&&!cb)?v0:(ca&&!cb)?va:(!ca&&cb)?vb:(ub>ua?vb:va);
    /* قايمتين اتغيروا من الاتنين (زي خطوات الدفعة): نجمع التغييرات بدل ما واحدة تمسح التانية */
    if(ca&&cb&&Array.isArray(va)&&Array.isArray(vb))pick=mergeArr(Array.isArray(v0)?v0:[],va,vb);
    if(pick!==undefined)out[k]=pick;
  });
  out._u=Math.max(ua,ub);
  return out;
}
/* أعلى وقت موجود في الحالة: الجهاز بياخده كأساس عشان ما يكتبش بوقت أقدم من اللي شافه */
function maxStamp(s){
  var mx=s.savedAt||0;
  STAMPED.concat(MAPS,['stock','ready']).forEach(function(c){var t=(s.tomb&&s.tomb[c])||{};Object.keys(t).forEach(function(k){mx=Math.max(mx,t[k]||0);});});
  STAMPED.forEach(function(c){(s[c]||[]).forEach(function(r){if(r)mx=Math.max(mx,r._u||0);});});
  ['stock','ready'].forEach(function(m){var tt=s[m+'T']||{};Object.keys(tt).forEach(function(k){mx=Math.max(mx,tt[k]||0);});});
  return mx;
}
/* تنظيف الـ tombstones: التومب بيتشال بس لو عمره أكتر من ١٨٠ يوم (TOMB_KEEP)
   وكل جهاز نشط (اتزامن في آخر ١٨٠ يوم) كان مزامن بعد التومب بـ ٣٠ يوم على الأقل */
const TOMB_KEEP=180*86400000, TOMB_GAP=30*86400000;
function pruneTombs(s,now){
  var devs=s.devs||{}, cutoff=now-TOMB_KEEP;
  var live=Object.keys(devs).filter(function(d){return devs[d]>=cutoff;});
  if(!live.length||!s.tomb)return 0;   // مفيش معلومات عن الأجهزة: نحتفظ بكل حاجة
  var floor=Math.min.apply(null,live.map(function(d){return devs[d];}));
  var removed=0;
  ['stock','ready'].concat(STAMPED,MAPS).forEach(function(c){
    var t=s.tomb[c]; if(!t)return;
    Object.keys(t).forEach(function(k){
      if(t[k]<cutoff&&floor>=t[k]+TOMB_GAP){delete t[k];removed++;}
    });
  });
  return removed;
}
function mergeStates(a,b,base){
  /* الإعدادات والمستخدمين (غير المسجلين لكل سجل) بياخدهم الأحدث، عشان الحالة الفاضية عند فتح الصفحة متمسحش اللي في درايف */
  var newer=(a.savedAt||0)>=(b.savedAt||0)?a:b,older=newer===a?b:a;
  var M=Object.assign({},older,newer);
  M.tomb={};
  STAMPED.forEach(function(c){
    var tomb={};
    [a,b].forEach(function(s){var t=(s.tomb&&s.tomb[c])||{};Object.keys(t).forEach(function(id){tomb[id]=Math.max(tomb[id]||0,t[id]);});});
    var ma={},mb={},by={},ids={};
    (a[c]||[]).forEach(function(r){if(r&&r.id!=null)ma[r.id]=r;});
    (b[c]||[]).forEach(function(r){if(r&&r.id!=null)mb[r.id]=r;});
    Object.keys(ma).concat(Object.keys(mb)).forEach(function(id){ids[id]=1;});
    Object.keys(ids).forEach(function(id){
      var ra=ma[id],rb=mb[id],bse=base&&base[c]&&base[c][id];
      by[id]=(ra&&rb)?mergeRec(bse,ra,rb):(ra||rb);
    });
    M[c]=Object.keys(by).filter(function(id){return tomb[id]===undefined||(by[id]._u||0)>tomb[id];}).sort().map(function(id){return by[id];});
    M.tomb[c]=tomb;
  });
  MAPS.forEach(function(c){
    var tomb={},out={};
    [a,b].forEach(function(s){var t=(s.tomb&&s.tomb[c])||{};Object.keys(t).forEach(function(k){tomb[k]=Math.max(tomb[k]||0,t[k]);});});
    [a,b].forEach(function(s){var m=s[c]||{};Object.keys(m).forEach(function(k){
      var v=m[k],st=mapStamp(c,v);
      if(tomb[k]!==undefined&&st<=tomb[k])return;
      if(out[k]===undefined||st>mapStamp(c,out[k]))out[k]=v;
    });});
    M[c]=out;M.tomb[c]=tomb;
  });
  ['stock','ready'].forEach(function(m){
    var v={},t={},tb={};
    [a,b].forEach(function(s){var x=(s.tomb&&s.tomb[m])||{};Object.keys(x).forEach(function(k){tb[k]=Math.max(tb[k]||0,x[k]||0);});});
    [a,b].forEach(function(s){var st=s[m]||{},tt=s[m+'T']||{};Object.keys(st).forEach(function(id){var ti=tt[id]||0;if(!(id in t)||ti>t[id]){t[id]=ti;v[id]=st[id];}});});
    Object.keys(v).forEach(function(id){if(tb[id]!==undefined&&t[id]<=tb[id]){delete v[id];delete t[id];}});
    M[m]=v;M[m+'T']=t;M.tomb[m]=tb;
  });
  M.clk=Math.max(a.clk||0,b.clk||0,maxStamp(a),maxStamp(b));
  M.seen={};[a,b].forEach(function(s){var m=s.seen||{};Object.keys(m).forEach(function(k){if(!M.seen[k]||(m[k].t||0)>(M.seen[k].t||0))M.seen[k]=m[k];});});
  M.devs={};[a,b].forEach(function(s){var d=s.devs||{};Object.keys(d).forEach(function(k){M.devs[k]=Math.max(M.devs[k]||0,d[k]||0);});});
  M.seq=Math.max(a.seq||0,b.seq||0);
  M.oseq=Math.max(a.oseq||0,b.oseq||0);
  M.fseq=Math.max(a.fseq||0,b.fseq||0);
  M.savedAt=Math.max(a.savedAt||0,b.savedAt||0);
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
/* البيضة مابتتحولش لجرام (ملغي التقدير 50 جرام) */
function unitGrams(u){return u==='كجم'?1000:u==='جرام'?1:null;}

function convK(ou,nu){var ao=unitGrams(ou),an=unitGrams(nu);if(ao&&an)return ao/an;return 1;}
function isPieceU(u){return !u||['قطعة','صاج','كادر','تورته','بولة','كاس','سفنديش كبير','سفنديش صغير','سفنديش وسط','فورمة كبيرة','فورمة صغيرة','فخارة'].indexOf(u)>-1;}
function mmss(ms){var s=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function ymKey(t){var d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
function monthKey(ts){var d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
/* وقت ١٢ ساعة بـ ص/م */
function fmt12(h,m){var ap=h<12?'ص':'م';var hh=h%12||12;return hh+':'+String(m).padStart(2,'0')+' '+ap;}
/* بيحوّل أي "HH:MM" جوه النص لـ ١٢ ساعة */
function fmt12str(s){return String(s||'').replace(/(\d{2}):(\d{2})/,function(_,h,m){return fmt12(+h,+m);});}
function tstr(ts){
  if(!ts)return '';
  var d=new Date(ts);function z(n){return String(n).padStart(2,'0');}
  return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+fmt12(d.getHours(),d.getMinutes());
}
function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function ago(ts){var m=Math.round((Date.now()-ts)/60000);if(m<1)return 'الآن';if(m<60)return 'منذ '+m+' د';return 'منذ '+Math.floor(m/60)+' س';}
function stamp(){return new Date().toISOString().slice(0,10);}

