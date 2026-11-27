if(!RMY_CARD){
(function(){
'use strict';
var AUTH_KEY='khat-entaj-auth';
/* الـ PIN الرئيسي للمالك متخزن في S.auth (بيتزامن مع درايف)، مش في الكود */
function checkPin(p){
  if(!S.auth)return Promise.resolve(false);
  return hexPbkdf2(p,S.auth.salt,S.auth.iter||200000).then(function(h){return h===S.auth.hash;});
}
/* الدخول بالـ PIN بيتطلب مع كل فتح للتطبيق: الحالة بتتحفظ في الجلسة (sessionStorage) مش في الجهاز بس */
function sessLive(){try{return sessionStorage.getItem('khat-live')==='1';}catch(e){return true;}}
function liveSet(){try{sessionStorage.setItem('khat-live','1');}catch(e){}}
function authed(){try{var a=localStorage.getItem(AUTH_KEY)||'';return (a==='1'||a.indexOf('u:')===0)&&sessLive();}catch(e){return false;}}
/* حسابات اتشالت نهائياً: مش بتترجع من الحفظ القديم */
var REMOVED_USER_CODES=['879'];
function usersList(){
  S.users=(S.users||[]).filter(function(u){return REMOVED_USER_CODES.indexOf(u.code)<0;});
  if(S.prefs&&S.prefs.perms){REMOVED_USER_CODES.forEach(function(c){delete S.prefs.perms[c];});}
  try{var au=localStorage.getItem(AUTH_KEY)||'';if(au.indexOf('u:')===0&&REMOVED_USER_CODES.indexOf(au.slice(2))>-1)localStorage.removeItem(AUTH_KEY);}catch(e){}
  return S.users;
}
function userByCode(c){return usersList().filter(function(u){return u.code===c;})[0]||null;}
/* كود المستخدم: من ٣ لـ ١٢ حرف أو رقم (عربي أو إنجليزي)، ومينفعش يتكرر مع مستخدم تاني أو كود المالك أو كود اتشال (من غير فرق بين الكبير والصغير) */
function validUserCode(c){return /^[A-Za-z0-9\u0621-\u064A]{3,12}$/.test(String(c||'').trim());}
/* كود عشوائي من ٦ حروف وأرقام، من غير حروف متشابهة زي O/0 وI/1 */
function randUserCode(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',out='';
  var a=new Uint32Array(6);
  (window.crypto||window.msCrypto).getRandomValues(a);
  for(var i=0;i<6;i++)out+=chars.charAt(a[i]%chars.length);
  return out;
}
function userCodeTaken(c,exceptId){
  var k=String(c||'').trim().toLowerCase();
  if(k==='chef myf'||REMOVED_USER_CODES.some(function(x){return String(x).toLowerCase()===k;}))return true;
  return usersList().some(function(u){return String(u.code).toLowerCase()===k&&u.id!==exceptId;});
}
/* الإجازة: يوم واحد (زرار إجازة النهاردة) أو فترة من-إلى بتتفعل وتتقفل لوحدها حسب تاريخ القاهرة */
function userLeaveActive(u,todayK){
  if(!u||!todayK)return false;
  if(u.leave===todayK)return true;
  var mv=weekMoveOf(u);
  if(mv&&todayK===mv.to)return true;
  var wo=weekOffOf(u);
  if(wo!==null&&weekdayOfKey(todayK)===wo&&!(mv&&todayK===mv.from))return true;
  return !!(u.leaveFrom&&u.leaveTo&&todayK>=u.leaveFrom&&todayK<=u.leaveTo);
}
/* تغيير كود مستخدم: بنحوّل تفضيلاته وسجلات الإنتاج والجلسة لكوده الجديد عشان الحركات القديمة تفضل منسوبة ليه */
function renameUserCode(old,nw){
  var m=Object.assign({},pref('perms',{}));
  if(m[old]){m[nw]=m[old];delete m[old];}
  setPref('perms',m);
  var sw=function(c){return c===old?nw:c;};
  Object.keys(S.plog||{}).forEach(function(id){
    var e=S.plog[id];if(!e)return;
    if(Array.isArray(e.by))e.by=e.by.map(sw);
    if(Array.isArray(e.ev))e.ev.forEach(function(v){v.c=sw(v.c);});
  });
  (S.products||[]).forEach(function(p){
    if(p.by)p.by=sw(p.by);
    (p.fillRuns||[]).forEach(function(r){if(r.by)r.by=sw(r.by);});
  });
  try{if(sessionCode()===old)localStorage.setItem(AUTH_KEY,'u:'+nw);}catch(e){}
}
/* اسم اللي بيعمل الدفعة: المالك أو المستخدم اللي داخل بحسابه */
function actorName(){var c=sessionCode();if(!c)return 'المالك';var u=userByCode(c);return u&&u.name?u.name:'مستخدم';}
function sessionCode(){try{var a=localStorage.getItem(AUTH_KEY)||'';return a.indexOf('u:')===0?a.slice(2):'';}catch(e){return '';}}
function limited(){return !!sessionCode();}
/* لو المستخدم اتحذف والجلسة بتاعته لسه مفتوحة: بنسجّل خروجه. بنعمل كده بس بعد ما البيانات تتزامن مع درايف، عشان ما نطردش حد بسبب بيانات ناقصة */
function kickDeletedUser(){
  if(!GD.ok)return false;
  var c=sessionCode();
  if(!c||userByCode(c))return false;
  try{localStorage.removeItem(AUTH_KEY);}catch(e){}
  lockSettings();U.view='home';U.bioPrompt=false;U.loginErr='الحساب ده اتحذف، سجّل دخول تاني أو كلم المالك.';
  return true;
}
function cardOffPopupHTML(closeAttr){
  var wa='https://wa.me/201508999341?text='+encodeURIComponent('السلام عليكم، حسابي في RMY Pro موقوف، ممكن أستفسر؟');
  return '<div style="position:fixed;inset:0;z-index:9999;background:rgba(5,8,25,.72);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;direction:rtl">'+
    '<div role="dialog" aria-modal="true" style="position:relative;width:100%;max-width:340px;box-sizing:border-box;padding:26px 20px 20px;border-radius:18px;background:#16204a;color:#fff;border:1px solid rgba(255,255,255,.14);text-align:center;font-family:Tajawal,Tahoma,sans-serif;box-shadow:0 20px 50px -10px rgba(0,0,0,.6)">'+
      '<button '+closeAttr+' aria-label="إغلاق" style="position:absolute;top:6px;left:8px;background:none;border:0;color:#fff;font-size:28px;line-height:1;cursor:pointer;padding:4px 8px">×</button>'+
      '<div style="font-size:30px;color:#fbbf24;margin-bottom:6px">!</div>'+
      '<h3 style="margin:0 0 8px;font-size:18px;font-weight:800">الحساب ده موقوف حالياً</h3>'+
      '<p style="margin:0;font-size:14px;line-height:1.7;color:rgba(255,255,255,.75)">مش هتقدر تدخل التطبيق دلوقتي. لو عايز تفعّله تاني، تواصل مع المسئول.</p>'+
      '<a href="'+wa+'" target="_blank" rel="noopener" style="display:block;margin-top:14px;padding:12px;border-radius:999px;background:#25D366;color:#fff;text-decoration:none;font-weight:700">تواصل مع المسئول على واتساب</a>'+
    '</div></div>';
}
function kickStoppedUser(){
  var c=sessionCode();if(!c)return false;
  var u=userByCode(c);if(!u||u.cardActive!==false)return false;
  try{localStorage.removeItem(AUTH_KEY);}catch(e){}
  lockSettings();U.view='home';U.bioPrompt=false;U.cardOffPop=true;
  return true;
}
function actorCode(){var c=sessionCode();if(c)return c;return 'CHEF MYF';}
function findUserByPw(p){
  var list=usersList().slice();
  function next(i){
    if(i>=list.length)return Promise.resolve(null);
    var u=list[i];
    return hexPbkdf2(p,u.salt,u.iter||200000).then(function(h){return h===u.h?u:next(i+1);});
  }
  return next(0);
}
function nextUserCode(){var used={};usersList().forEach(function(u){used[u.code]=1;});REMOVED_USER_CODES.forEach(function(c){used[c]=1;});for(var i=0;i<900;i++){var c=String(100+Math.floor(Math.random()*900));if(!used[c])return c;}return String(Date.now()).slice(-6);}
/* رقم الـ ID الثابت للمستخدم: بيتولد مرة واحدة ومش بيتغير حتى لو الاسم أو الكود اتعدل */

function maskWa(w){w=String(w||'');return w.length>=6?w.slice(0,-4)+'****':'';}
/* أي تفاعل على أي تبويب بيتسجل في السجل زي الدفعات: كل تبويب صف واحد، وعملياته مضغوطة جواه */
var TAB_LBL={home:'الرئيسية',orders:'الأوردرات',shopOrders:'أوردرات المحل',shopProducts:'وصفات المحل',prep:'التحضير',prod:'الإنتاج',stock:'الخامات',fgstock:'مخزن الإنتاج',tracking:'تتبع الصلاحية',reserved:'تحت التشغيل',recipes:'الوصفات',settings:'الإعدادات',filling:'تحضير حشو',prepreq:'تحضيرات مطلوبة',waste:'الهالك',boxes:'العلب',boxcomp:'تجميع علب',calendar:'التقويم',verify:'التحقق من البطاقة'};
function actTargetOf(d){
  d=d||{};
  var pr=d.p?P(d.p):null, name=pr?pr.name:'';
  var code='';
  if(d.id){
    var s0=String(d.id);
    code=s0.indexOf('fp:')===0?'حشو':(s0?sid(s0):'');
  }
  if(!code&&d.id===''&&d.p)code='رصيد قديم';
  return [name,code].filter(Boolean).join(' · ');
}
function logUserAct(a,d){
  if(!a||ACT_SYS[a]||EVENT_LABEL[a])return;
  var cat=ACT_CAT[a]||[],tab=cat[0]||U.view||'other',key='tab:'+tab;
  S.plog=S.plog||{};
  var e=S.plog[key]||{p:key,qty:0,by:[],at:Date.now()};
  e.tabLbl=TAB_LBL[tab]||tab;
  var c=actorCode();
  if(e.by.indexOf(c)<0)e.by.push(c);
  var g=actTargetOf(d);
  e.ev=(e.ev||[]).concat([{c:c,a:a,l:cat[1]||a,g:g,t:Date.now()}]).slice(-40);
  S.plog[key]=e;
}
function markBy(b,act){
  if(!b)return;
  S.plog=S.plog||{};
  var e=S.plog[b.id]||{p:b.p,qty:b.qty,by:[],at:Date.now()};
  e.p=b.p;e.qty=b.qty;
  var c=actorCode();
  /* تنبيه: لو زميل تاني عمل حاجة على نفس الدفعة قبل أقل من دقيقة */
  var last=(e.ev||[]).slice(-1)[0];
  if(act&&last&&last.c&&last.c!==c&&Date.now()-(last.t||0)<60000)toast('⚠ الدفعة دي اتعدلت من زميل تاني قبل أقل من دقيقة، اتأكد قبل ما تكمل');
  if(e.by.indexOf(c)<0)e.by.push(c);
  if(act)e.ev=(e.ev||[]).concat([{c:c,a:act,t:Date.now()}]).slice(-40);
  S.plog[b.id]=e;
}

function tombAdd(kind,id){S.tomb=S.tomb||{};S.tomb[kind]=S.tomb[kind]||{};S.tomb[kind][id]=Date.now();}

/* تحكم موحد في الوصول للتبويبات: التبويب اللي مش متعطيله صلاحية ما يتفتحش بأي طريقة: زرار أو رابط أو الـ hash */
/* اعتماد الإنتاج بعد انتهاء الوقت: المالك دايمًا، والمستخدم بيعتمد لو التبويب "اعتماد الإنتاج" ظاهر له */
function offNote(){
  var warn=(!navigator.onLine&&hasPending())?'<div class="note" role="alert">⚠️ فيه تعديلات لسه مترفعتش على درايف. متقفلش التطبيق لحد ما النت يرجع.</div>':'';
  if(typeof LOCAL_ERR!=='undefined'&&LOCAL_ERR)return '<div class="note" role="status">تعذّر حفظ نسخة الجهاز: '+esc(LOCAL_ERR)+'</div>'+(navigator.onLine?'':'<div class="note">لا يوجد اتصال بالإنترنت؛ ستتم المزامنة عند عودة الاتصال.</div>');
  return navigator.onLine?'':'<div class="note">لا يوجد اتصال بالإنترنت؛ ستتم المزامنة عند عودة الاتصال.</div>';
}
function updateConn(){
  var ob=document.getElementById('offBanner');if(ob)ob.innerHTML=offNote();
}
window.addEventListener('online',function(){updateConn();netRetry();});
window.addEventListener('offline',function(){updateConn();netShowSoon();});
/* شاشة "مفيش إنترنت": بتتقفل لوحدها أول ما الاتصال يرجع، بعد رسالة نجاح */
var NET={shown:false,busy:false};
function netShow(){
  if(NET.shown)return;NET.shown=true;
  var d=document.createElement('div');d.id='netModal';d.setAttribute('role','alertdialog');d.setAttribute('aria-modal','true');
  d.style.cssText='position:fixed;inset:0;z-index:200;background:rgba(5,7,26,.72);display:flex;align-items:center;justify-content:center;padding:20px';
  d.innerHTML='<div style="background:#fff;color:#111;border-radius:16px;padding:24px;max-width:340px;width:100%;text-align:center;direction:rtl;font-family:inherit">'+
    '<div id="netIco" style="font-size:40px;line-height:1">📡</div>'+
    '<h3 id="netT" style="margin:12px 0 6px;font-size:18px">مفيش اتصال إنترنت</h3>'+
    '<p id="netM" style="margin:0 0 18px;color:#555;font-size:14px">اتأكد من الواي فاي أو الداتا، والتطبيق هيتفتح أول ما النت يرجع.</p>'+
    '<button id="netBtn" type="button" style="width:100%;padding:12px;border:0;border-radius:10px;background:#2B3595;color:#fff;font-size:15px;cursor:pointer">حاول الاتصال مرة أخرى</button>'+
    '</div>';
  document.body.appendChild(d);
  document.getElementById('netBtn').onclick=netRetry;
}
/* ما نفتحش شاشة النت غير لو الاتصال فعلاً واقع من غير مجرد فشل مزامنة عابر */
function netShowSoon(){setTimeout(function(){if(!navigator.onLine)netShow();},4000);}
function netPing(){
  if(!navigator.onLine)return Promise.resolve(false);
  return withTimeout(fetch('./',{method:'HEAD',cache:'no-store'}),6000).then(function(){return true;},function(){return false;});
}
function netRetry(){
  if(NET.busy||!document.getElementById('netModal'))return;
  NET.busy=true;
  var b=document.getElementById('netBtn'),m=document.getElementById('netM');
  if(b){b.disabled=true;b.textContent='جاري المحاولة...';}
  netPing().then(function(ok){
    if(ok){netSuccess();return;}
    NET.busy=false;
    if(b){b.disabled=false;b.textContent='حاول الاتصال مرة أخرى';}
    if(m)m.textContent='لسه مفيش اتصال، اتأكد من الشبكة وجرّب تاني.';
  });
}
function netSuccess(){
  var d=document.getElementById('netModal');if(!d)return;
  NET.busy=false;
  document.getElementById('netIco').textContent='✅';
  document.getElementById('netT').textContent='تم الاتصال بالإنترنت';
  document.getElementById('netM').textContent='تم الاتصال بنجاح، جاري فتح التطبيق…';
  var b=document.getElementById('netBtn');if(b)b.style.display='none';
  setTimeout(function(){
    d.remove();NET.shown=false;
    if(GD.on)gdSync();else render();
  },1800);
}
/* في تعديلات لسه مترفعتش على درايف (بعد أول مزامنة في الجلسة) */
function hasPending(){return !!GD.seeded&&(S.savedAt||0)>(GD.upAt||0);}
window.addEventListener('beforeunload',function(e){
  if(hasPending()&&!navigator.onLine){e.preventDefault();e.returnValue='';}
});
function netBoot(){if(!navigator.onLine)netShow();}
if(document.body)netBoot();else document.addEventListener('DOMContentLoaded',netBoot);


var IC={
     verify:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M14 10h4M14 14h3M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2"/>',
     boxes:'<path d="M4 9h16v11H4z"/><path d="M3 5h18v4H3zM12 5v15"/>',
     waste:'<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
     filling:'<path d="M4 5h16l-6 7v6l-4-2v-4z"/>',
     prepreq:'<path d="M5 6h14M5 12h14M5 18h9"/>',
  reserved:'<path d="M9 4h6v3H9z"/><path d="M6 6h12v15H6z"/><path d="M9 11h6M9 15h6"/>',
  fgstock:'<path d="M4 8h16v11H4z"/><path d="M8 8V5h8v3M8 13h8"/>',
  tracking:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  prep:'<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 3.5h6v3H9zM8.5 11h7M8.5 15h4.5"/>',
  prod:'<path d="M12 3c.6 3.2 4.6 5.2 4.6 9.6A4.6 4.6 0 0 1 12 17.2a4.6 4.6 0 0 1-4.6-4.6c0-1.9.9-3.1 2-4.1.1 1.6.9 2.5 1.9 2.8C11.1 8.6 10.9 5.6 12 3z"/><path d="M7 21h10"/>',
  stock:'<path d="M3.5 8.2L12 3.5l8.5 4.7v7.6L12 20.5l-8.5-4.7z"/><path d="M3.5 8.2L12 13l8.5-4.8M12 13v7.5"/>',
  settings:'<path d="M5 8h14M5 16h14"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>',
  recipes:'<path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M8 8.5h6M8 12h6"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',orders:'<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12.5h6"/>',
  shopProducts:'<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  shopOrders:'<path d="M4 9.5h16l-1.5-5h-13z"/><path d="M5.5 9.5V20h13V9.5M9.5 20v-5h5v5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chev:'<path d="M6 9l6 6 6-6"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  home:'<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9.5h12V10"/>'
};
function svg(k,cls){return '<svg viewBox="0 0 24 24" aria-hidden="true"'+(cls?' class="'+cls+'"':'')+'>'+IC[k]+'</svg>';}

var MATERIALS=[],PRODUCTS=[];


/* كود الصنف: الأصناف العادية بتاخد P-001 وهكذا، والمحشوة ليها F-xxx. مفيش تكرار */
function nextProdNo(){var mx=0;PRODUCTS.forEach(function(p){var m=/^P-(\d+)$/.exec(String(p.code||''));if(m&&+m[1]>mx)mx=+m[1];});return mx+1;}
function ensureProdCodes(){PRODUCTS.forEach(function(p){if(p.code)return;if(p.fill){p.code='F-'+String(nextFillNo()).padStart(3,'0');S.fseq=+p.code.slice(2);}else p.code='P-'+String(nextProdNo()).padStart(3,'0');});}
function bind(s){s.prefs=s.prefs||{};var ui=uiLoad();Object.keys(ui).forEach(function(k){s.prefs[k]=ui[k];});MATERIALS=s.materials;PRODUCTS=s.products;PRODUCTS.forEach(function(p){if(p.stages)syncProd(p);});ensureProdCodes();purgeProdLog(s);}
/* سجل الإنتاج بيتمسح تلقائي بعد ٣٠ يوم من آخر حركة: الدفعات بتتمسح (مع شاهد الحذف عشان المزامنة مترجعهاش)، وتحضير الحشو بيتخفي من السجل بس والمخزون ما يتأثرش */
var PROD_LOG_KEEP_MS=30*24*60*60*1000;
function purgeProdLog(s){
  var cut=Date.now()-PROD_LOG_KEEP_MS,log=s.plog||{};
  Object.keys(log).forEach(function(id){
    var e=log[id]||{},last=e.at||0;
    (e.ev||[]).forEach(function(v){if((v.t||0)>last)last=v.t;});
    if(last&&last<cut){
      delete log[id];
      s.plogTomb=s.plogTomb||{};s.plogTomb[id]=Date.now();
    }
  });
  (s.products||[]).forEach(function(p){
    if(!p.fill||!Array.isArray(p.fillRuns))return;
    p.fillRuns.forEach(function(r){if(!r.logHidden&&r.at&&r.at<cut)r.logHidden=true;});
  });
}
function fix(o){
  if(!o.materials)o.materials=[];
  if(!o.products)o.products=[];
  migrateEggRecipes(o);
  migrateProducts(o.products);
  if(!o.ready)o.ready={};if(!o.waste)o.waste=[];
  if(!o.orders)o.orders=[];
  if(!o.locks)o.locks={};
  o.orders.forEach(function(x){if(!x.kind)x.kind=(x.cust==='للمحل')?'shop':'cust';});
  if(!o.fgMig){o.fgMig=1;
    o.orders.forEach(function(x){
      if(x.deliveredAt)return;
      (x.items||[]).forEach(function(it){
        it.fs=it.fs||0;it.got=it.got||0;
        var g=0;(o.done||[]).forEach(function(d){if(d.o===x.id&&d.p===it.p)g+=d.good||0;});
        var av=o.ready[it.p]||0,mv=Math.min(g,av);
        if(mv>0){it.got=mv;o.ready[it.p]=av-mv;}
      });
    });
  }
  Object.keys(o.locks).forEach(function(k){if(k.indexOf('|')<0){o.locks['cust|'+k]=o.locks[k];delete o.locks[k];}});
  if(!o.oseq)o.oseq=o.orders.length;
  bind(o);return o;
}
var UNITS_M=['جرام','علبة','كيس','بيضة','غطا','حبة','نقطة','فخارة'];
var PROD_UNITS=['قطعة','جرام','صاج','كادر','تورته','بولة','كاس','سفنديش كبير','سفنديش صغير','سفنديش وسط','فورمة كبيرة','فورمة صغيرة','فخارة']; /* وحدة إنتاج الصنف: قطع أو وزن */
function isPiece(p){return !p||!p.unit||isPieceU(p.unit);}


/* k = الكمية الجديدة لكل وحدة قديمة */

/* بتحوّل كل الكميات المرتبطة بالصنف لما وحدته تتغير */
function convertUnitData(pid,k,nu){
  var isP=isPieceU(nu);
  var cv=function(v){if(typeof v!=='number'||!isFinite(v))return v;var x=v*k;return r3(isP?Math.round(x):x);};
  if(S.ready&&S.ready[pid]!=null)S.ready[pid]=cv(S.ready[pid]);
  (S.batches||[]).forEach(function(b){
    if(b.p===pid){if(b.rej!=null)b.rej=cv(b.rej);if(b.stk!=null)b.stk=cv(b.stk);}
    if(b.drawnC&&b.drawnC[pid]!=null)b.drawnC[pid]=cv(b.drawnC[pid]);
    if(b.drawn&&b.drawn[pid]!=null)b.drawn[pid]=cv(b.drawn[pid]);
  });
  (S.done||[]).forEach(function(d){if(d.p!==pid)return;d.qty=cv(d.qty);if(d.good!=null)d.good=cv(d.good);if(d.rej!=null)d.rej=cv(d.rej);if(d.stk!=null)d.stk=cv(d.stk);});
  (S.orders||[]).forEach(function(od){(od.items||[]).forEach(function(it){if(it.p!==pid)return;it.qty=cv(it.qty);if(it.got!=null)it.got=cv(it.got);});});
  PRODUCTS.forEach(function(p){(p.comps||[]).forEach(function(c){if(c.p===pid)c.q=r3(c.q*k);});});
  if(U.osheet&&U.osheet.items&&U.osheet.items[pid]!=null)U.osheet.items[pid]=cv(U.osheet.items[pid]);
}
function qIM(p){return isPiece(p)?'numeric':'decimal';}
function qFloor(p,v){return isPiece(p)?Math.floor(v):r3(v);}
var STORES=['مخزن جاف','ثلاجة','فريزر'];


function P(id){var p=PRODUCTS.filter(function(p){return p.id===id;})[0];
  return p||{id:id,name:'منتج محذوف',unit:'',mins:0,yield:1,recipe:{},stages:[],cat:'',seasons:[],missing:true};}
function M(id){var m=MATERIALS.filter(function(m){return m.id===id;})[0];
  return m||{id:id,name:'خامة محذوفة',unit:'',min:0,cat:'',missing:true};}



var S=load();
/* ترحيل وصفات البيض: المكوّنات اللي اتسجلت بالجرام واتحولت لعدد بيض (البيضة = 50 جرام)، بترجع للخامة بالجرام بالكمية اللي اتكتبت أصلاً. بيتعمل مرة واحدة */
function migrateEggRecipes(st){
  (st.products||[]).forEach(function(p){(p.stages||[]).forEach(function(g){(g.ings||[]).forEach(function(i){
    if(i.du!=='جرام'||!i.dq)return;
    var mm=(st.materials||[]).filter(function(x){return x.id===(i.m||i.mid);})[0];
    if(!mm||mm.unit!=='بيضة')return;
    var cp=(st.materials||[]).filter(function(x){return norm(unesc(x.name))===norm(unesc(mm.name))&&x.unit==='جرام';})[0];
    if(!cp){cp={id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:mm.name,cat:mm.cat,unit:'جرام',min:0,storage:mm.storage||'مخزن جاف',exp:'',supplier:'',notes:'',alts:[]};st.materials.push(cp);st.stock=st.stock||{};st.stock[cp.id]=0;}
    i.m=cp.id;i.mid=cp.id;i.q=i.dq;i.u='جرام';
  });});});
}
var U={view:'home',sheet:null,recv:null,filter:'all',confirm:null};
var h=(location.hash||'').slice(1);
if(['home','orders','shopOrders','shopProducts','recipes','settings','prep','prod','stock','fgstock','tracking','reserved','filling','prepreq','waste','boxes','boxcomp'].indexOf(h)>-1)U.view=h;

function liveRecipe(p){var rec={};((p&&p.stages)||[]).forEach(function(g){(g.ings||[]).forEach(function(i){if(!i.m&&i.mid)i.m=i.mid;rec[i.m]=r3((rec[i.m]||0)+i.q);});});return rec;}
function need(b){var o={},r=liveRecipe(P(b.p));for(var k in r)o[k]=r3(r[k]*b.qty);return o;}
function shortOf(b){var n=need(b),out=[];if(!TRACK())return out;for(var k in n){var have=S.stock[k]||0;if(have+1e-9<n[k])out.push({k:k,lack:n[k]-have});}return out;}
/* sub-recipes: finished pieces of other products taken from the production stock (per ONE meal of this product) */
function compsOf(pid){var p=P(pid);return (p&&p.comps)||[];}
function compNeed(b){var o={};compsOf(b.p).forEach(function(c){if(P(c.p).missing)return;o[c.p]=r3((o[c.p]||0)+c.q*b.qty);});return o;}
function compShort(b){var n=compNeed(b),out=[];for(var k in n){var have=S.ready[k]||0;if(have+1e-9<n[k])out.push({k:k,lack:r3(n[k]-have),need:n[k]});}return out;}
function compBack(b){if(b.withdrawn&&b.drawnC){for(var k in b.drawnC)S.ready[k]=r3((S.ready[k]||0)+b.drawnC[k]);}}
function applyWithdraw(s,b){var cn=compNeed(b);for(var c in cn)s.ready[c]=r3((s.ready[c]||0)-cn[c]);b.drawnC=cn;b.withdrawn=true;b.drawn={}; /* لا خصم أو رصيد للخامات */}
function TRACK(){return false;} // مخزون الخامات غير مستخدم: السحب مفتوح دائمًا
function isLow(m){return false;}
function reserved(mid){
  var t=0;S.batches.forEach(function(b){if(b.stage==='prep'&&!b.withdrawn){t+=need(b)[mid]||0;}});return t;
}
/* short display id: B-114-g7gw71 -> B-114 (the full id stays internal) */
function sid(id){var a=String(id==null?'':id).split('-');return a.length>2?a[0]+'-'+a[1]:String(id==null?'':id);}
function dur(b){return (Number(P(b.p).mins)||0)*60000;}
/* الصنف اللي وقت تشغيله فاضي (مش بيدخل فرن): بيبقى جاهز للاعتماد على طول بدون مؤقت */
function hasOven(p){return (Number(p&&p.mins)||0)>0;}
function elapsed(b){return b.startedAt?Math.min(dur(b),Date.now()-b.startedAt):0;}
function timerDone(b){if(dur(b)<=0)return true;return !!b.startedAt&&Date.now()-b.startedAt>=dur(b);}
/* مدة الصلاحية من حقل "الصلاحية" في الصنف: "3 أيام" و"2 أسابيع" و"5 ساعات" و"شهرين"... بترجع بالميلي ثانية (0 لو مش مكتوبة) */
function shelfMs(txt){
  var t=String(txt==null?'':txt).trim();if(!t)return 0;
  var m=/\d+(?:[.,]\d+)?/.exec(t);
  if(!m&&!/ساع|يوم|أسبوع|اسبوع|أسابيع|اسابيع|شهر|شهور/.test(t))return 0;
  var n=m?Number(m[0].replace(',','.')):1;
  if(!m&&/يومين|أسبوعين|اسبوعين|شهرين/.test(t))n=2;
  if(!isFinite(n)||n<=0)return 0;
  var H=3600000,D=86400000;
  var unit=/ساع/.test(t)?H:(/أسبوع|اسبوع|أسابيع|اسابيع/.test(t)?7*D:(/شهر|شهور|أشهر|اشهر/.test(t)?30*D:D));
  return n*unit;
}
/* تاريخ الصلاحية الافتراضي لدفعة هتتعتمد دلوقتي، أو '' لو الصنف مالوش مدة صلاحية */
function defExp(p){var ms=shelfMs(p&&p.shelf?unesc(p.shelf):'');return ms?ymd(new Date(Date.now()+ms)):'';}
/* عدد الأيام الباقية لتاريخ الصلاحية (0 = النهارده، أقل من 0 = خلص)، أو null لو مفيش تاريخ */
function expDays(exp){if(!exp)return null;var q=String(exp).split('-');if(q.length!==3)return null;var e=new Date(+q[0],+q[1]-1,+q[2]);if(isNaN(e))return null;var n=new Date();n.setHours(0,0,0,0);return Math.round((e-n)/86400000);}


/* رقم الدفعة مش بيتكرر: بياخد أعلى رقم موجود في الدفعات والمنتهي والأرشيف */
function nextBatchNo(){
  var mx=S.seq||100;
  var add=function(id){var n=parseInt(String(id||'').split('-')[1],10);if(isFinite(n)&&n>mx)mx=n;};
  (S.batches||[]).forEach(function(b){add(b.id);});
  (S.done||[]).forEach(function(d){add(d.id);});
  archEntries().forEach(function(a){(a.batches||[]).concat(a.done||[]).forEach(function(x){add(x.id);});});
  S.seq=mx+1;
  return S.seq;
}
function batch(id){return S.batches.filter(function(b){return b.id===id;})[0];}

/* ---------- data file: the only place the app keeps data ----------
   Edits are merged into the file right after they happen.
   The file is read and merged every 5 seconds, so changes from other devices show up here.
   Every record carries _u (last edit time). Merging keeps the newest version of each record,
   deletions are kept as tombstones, so two devices editing different things never overwrite each other. */
var SYNC_MS=10000,SYNC_WAIT=0;
/* معدل المزامنة على الجهاز ده: كل ثانية (افتراضي)، أو كل 10 ثواني، أو عند الفتح والتركيز بس */
var SYNC_CHOICES={0:'عند الفتح والتركيز بس',1000:'كل ثانية',10000:'كل 10 ثواني'};
function syncEvery(){var v=Number(uiLoad().syncEvery);return SYNC_CHOICES.hasOwnProperty(v)?v:SYNC_MS;}
var LAST={},LASTN={stock:{},ready:{}};
function isTyping(){var a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));}


function pref(k,d){var p=S.prefs||{};return p[k]!==undefined?p[k]:d;}
function setPref(k,v){
  if(UI_KEYS.indexOf(k)>-1)uiSave(k,v);
  S.prefs=S.prefs||{};S.prefs[k]=v;
  S.prefsK=S.prefsK||{};S.prefsK[k]=Date.now();
  S.prefsT=Date.now();save();
}
/* الوضع النهاري/الليلي: لكل مستخدم على حدة (محفوظ في بياناته)، والمالك ليه إعداده الخاص */
function themeOf(){var u=sessionCode()?userByCode(sessionCode()):null;if(u)return u.theme==='dark'?'dark':'light';return pref('theme','light');}
function applyTheme(){document.documentElement.setAttribute('data-theme',themeOf());}

/* remember the signature of every record, so a later stamp() can tell what was edited */
function baseline(){
  LAST={};
  STAMPED.forEach(function(c){(S[c]||[]).forEach(function(r){if(r._u===undefined)r._u=1;LAST[c+':'+r.id]=recSig(r);});});
  ['stock','ready'].forEach(function(m){LASTN[m]={};Object.keys(S[m]||{}).forEach(function(id){LASTN[m][id]=S[m][id];});});
}
/* حذف مفتاح من خريطة (أرشيف/أقفال): بيتسجل وقت الحذف عشان الجهاز التاني ما يرجّعهوش */
function tombMap(c,k){S.tomb=S.tomb||{};S.tomb[c]=S.tomb[c]||{};S.tomb[c][k]=nowStamp();}
/* mark what changed since the last mark: new or edited records get _u=now, removed records get a tombstone */
/* وقت الكتابة: ساعة الجهاز، بس مش أقل من أعلى وقت شافه الجهاز (عشان ساعة متأخرة ما تخسرش تعديلات حديثة) */
function nowStamp(){var n=Date.now(),c=S.clk||0;return n>c?n:c+1;}
function markEdits(){
  var now=nowStamp();
  S.tomb=S.tomb||{};
  STAMPED.forEach(function(c){
    S.tomb[c]=S.tomb[c]||{};
    var seen={};
    (S[c]||[]).forEach(function(r){
      var k=c+':'+r.id,sig=recSig(r);seen[k]=1;
      if(LAST[k]!==sig||r._u===undefined){r._u=now;LAST[k]=sig;}
    });
    Object.keys(LAST).forEach(function(k){
      if(k.indexOf(c+':')===0&&!seen[k]){S.tomb[c][k.slice(c.length+1)]=now;delete LAST[k];}
    });
  });
  ['stock','ready'].forEach(function(m){
    S[m]=S[m]||{};S[m+'T']=S[m+'T']||{};S.tomb[m]=S.tomb[m]||{};
    Object.keys(S[m]).forEach(function(id){
      if(LASTN[m][id]!==S[m][id]){S[m+'T'][id]=now;LASTN[m][id]=S[m][id];}
    });
    Object.keys(LASTN[m]).forEach(function(id){
      if(!(id in S[m])){S.tomb[m][id]=now;delete LASTN[m][id];}
    });
  });
  S.clk=now;
}
/* نسخة الحالة اللي اتزامنت آخر مرة: أساس الدمج حقل بحقل. بتتحفظ في IndexedDB عشان تفضل بعد تحديث الصفحة */
var SYNCBASE=null;
function snapshotBase(){
  var o={};
  STAMPED.forEach(function(c){o[c]={};(S[c]||[]).forEach(function(r){if(r&&r.id!=null)o[c][r.id]=JSON.parse(JSON.stringify(r));});});
  return o;
}
/* merge two states: per record the newest _u wins, tombstones beat older versions, stock/ready per item by its last change */



/* file access */
/* a file can end with leftover bytes from an older, longer save: read the first complete JSON object and ignore the rest */
function withTimeout(p,ms){
  return new Promise(function(res,rej){
    var done=false,tm=setTimeout(function(){if(!done){done=true;rej(new Error('timeout'));}},ms);
    p.then(function(v){if(!done){done=true;clearTimeout(tm);res(v);}},function(e){if(!done){done=true;clearTimeout(tm);rej(e);}});
  });
}
/* every edit starts a sync right away (no delay), and the 1s loop catches anything that came in while busy */
function saveSoon(){if(!GD.on)return;gdOutboxQueue();clearTimeout(GD.wt);GD.wt=setTimeout(gdSync,SYNC_WAIT);}
function fsStart(){baseline();gdStart();window.RMY_NEEDS_DATA=!!GD.on;}

/* ---------- Google Drive sync (Drive API, drive.file scope) ----------
   The app keeps one file (khat-entaj.json) in the user's Drive and syncs with it every SYNC_MS.
   Each cycle asks Drive for the file's version first (a tiny call, never cached) and only downloads when it changed. */
var GD_DEFAULT_HINT='rmyproadmin@gmail.com';
var GD_CLIENT='563440359615-lg66i4v95vggeqrgpn1j9dkgharktg5f.apps.googleusercontent.com',GD_SCOPE='https://www.googleapis.com/auth/drive.file',GD_NAME='khat-entaj.json';
var GD={on:false,id:null,tok:null,exp:0,ver:null,upAt:-1,ok:false,err:null,busy:false,busyAt:0,tc:null,pend:null,needTap:false,armed:false,loading:false,n:0,at:0,reqAt:0,shown:null};
function gdSaveCfg(){try{if(GD.on)localStorage.setItem('khat-gd',JSON.stringify({id:GD.id,sh:GD_SHARD_IDS,cid:GD.cardsId,cl:GD.cardsLast}));else localStorage.removeItem('khat-gd');}catch(e){}}
function gdLoadCfg(){
  try{var c=JSON.parse(localStorage.getItem('khat-gd')||'null');if(c){GD.on=true;GD.id=c.id||null;GD.cardsId=c.cid||null;GD.cardsLast=c.cl||null;if(c.sh)Object.keys(c.sh).forEach(function(k){GD_SHARD_IDS[k]=c.sh[k];});}}catch(e){}
  try{var t=JSON.parse(localStorage.getItem('khat-gd-tok')||'null');if(t&&t.e>Date.now()){GD.tok=t.t;GD.exp=t.e;}}catch(e){}
}
function gdTokOk(){return !!GD.tok&&Date.now()<GD.exp;}
function renderIdle(){
  if(!(U.sheet||U.form||U.osheet||U.recv||isTyping())){render();return;}
  if(!U.remoteNote){U.remoteNote=1;toast('فيه تحديث من جهاز تاني، هيظهر أول ما تقفل النافذة');}
}
function gdPaint(){
  var pill=document.querySelector('.fbar .dstat');
  if(pill)pill.outerHTML=driveHTML();
  var sg=(GD.ok?1:0)+'|'+GD.err+'|'+GD.on;
  if(sg!==GD.shown){GD.shown=sg;renderIdle();}
}
function gdLoadGis(){
  if(GD.tc||GD.loading)return;
  if(window.google&&google.accounts&&google.accounts.oauth2){gdInitTc();return;}
  GD.loading=true;
  var s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;
  s.onload=function(){GD.loading=false;gdInitTc();};
  s.onerror=function(){GD.loading=false;};
  document.head.appendChild(s);
}
function gdInitTc(){
  try{GD.tc=google.accounts.oauth2.initTokenClient({client_id:GD_CLIENT,scope:GD_SCOPE,callback:gdTokCb,error_callback:gdTokErr});}catch(e){return;}
  if(GD.on){if(gdTokOk())gdSync();else gdArm();}
  GD.shown=null;gdPaint();
}
/* بريد حساب جوجل: بيتحفظ مرة واحدة على الجهاز، ويتبعت كتلميح للحساب في الطلب الصامت */
function gdHint(){
  var el=document.getElementById('gdHint');if(el&&el.value.trim())return el.value.trim();
  try{return localStorage.getItem('khat-gd-hint')||GD_DEFAULT_HINT;}catch(e){return GD_DEFAULT_HINT;}
}
function gdHintHTML(){
  var v='';try{v=localStorage.getItem('khat-gd-hint')||'';}catch(e){}
  return '<div class="fld" style="margin-top:10px"><label for="gdHint">بريد حساب جوجل (اختياري، بيخلّي إعادة الدخول تلقائية)</label><input id="gdHint" type="email" dir="ltr" value="'+esc(v)+'" placeholder="name@gmail.com" autocomplete="email"></div>'+
    '<div class="dbtns"><button class="btn ghost sm" data-act="gdSetHint">احفظ البريد</button></div>';
}
function gdRequest(){
  if(!GD.tc||Date.now()-GD.reqAt<1500)return;
  GD.reqAt=Date.now();
  var hn=gdHint();
  try{GD.tc.requestAccessToken(hn?{prompt:'',hint:hn}:{prompt:''});}catch(e){}
}
function gdTokCb(r){
  if(r&&r.access_token){
    try{if(!google.accounts.oauth2.hasGrantedAllScopes(r,GD_SCOPE)){
      GD.tok=null;GD.exp=0;GD.needTap=true;GD.ok=false;GD.err='لازم تعلّم على مربع الوصول لـ Drive في شاشة جوجل، وبعدين اضغط زامن الآن';
      if(GD.pend){var z=GD.pend;GD.pend=null;z.rej({code:'tap'});}
      GD.shown=null;gdPaint();return;
    }}catch(x){}
    GD.tok=r.access_token;GD.exp=Date.now()+((r.expires_in||3600)-120)*1000;GD.needTap=false;GD.err=null;gdScheduleRefresh();
    try{localStorage.setItem('khat-gd-tok',JSON.stringify({t:GD.tok,e:GD.exp}));}catch(e){}
    if(GD.pend){var p=GD.pend;GD.pend=null;p.res();}else gdSync();
  }else{
    GD.needTap=true;GD.ok=false;GD.err='تعذّر الربط بجوجل ('+((r&&r.error)||'خطأ')+')';
    if(GD.pend){var q=GD.pend;GD.pend=null;q.rej({code:'tap'});}
    gdArm();GD.shown=null;gdPaint();
  }
}
/* تجديد التوكن قبل ما ينتهي بـ 10 دقايق وإحنا فاتحين التطبيق، عشان لما المستخدم يرجع يلاقي الاتصال شغال */
function gdScheduleRefresh(){
  clearTimeout(GD.rt);
  if(!GD.on||!GD.exp)return;
  var ms=GD.exp-Date.now()-10*60*1000;
  GD.rt=setTimeout(function(){if(GD.on&&GD.tc&&!document.hidden)gdRequest();},Math.max(ms,30000));
}
/* صندوق الرفع (IndexedDB): الصفحة بتكتب فيه آخر تعديلات، والـ service worker بيرفعها لدرايف حتى لو التطبيق مقفول */
var OB_DB='rmy-outbox';
function obOpen(){return new Promise(function(res,rej){var r=indexedDB.open(OB_DB,1);r.onupgradeneeded=function(){r.result.createObjectStore('q',{keyPath:'id'});};r.onsuccess=function(){res(r.result);};r.onerror=function(){rej(r.error);};});}
function obPut(item){return obOpen().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('q','readwrite');tx.objectStore('q').put(item);tx.oncomplete=function(){db.close();res();};tx.onerror=function(){rej(tx.error);};});});}
function obDel(id){return obOpen().then(function(db){return new Promise(function(res,rej){var tx=db.transaction('q','readwrite');tx.objectStore('q').delete(id);tx.oncomplete=function(){db.close();res();};tx.onerror=function(){rej(tx.error);};});});}
function obGet(id){return obOpen().then(function(db){return new Promise(function(res,rej){var rq=db.transaction('q').objectStore('q').get(id);rq.onsuccess=function(){db.close();res(rq.result||null);};rq.onerror=function(){db.close();rej(rq.error);};});});}
/* بيمسح صف الرفع بس لو مفيش تعديل أحدث اتكتب فيه أثناء المزامنة */
function obDelUpTo(id,t){return obGet(id).then(function(it){if(it&&(it.at||0)<=t)return obDel(id);});}
function obRegister(){
  try{navigator.serviceWorker.ready.then(function(reg){if(reg.sync)return reg.sync.register('rmy-sync');}).catch(function(){});}catch(e){}
}
function gdOutboxQueue(){
  if(!GD.on||!GD.id||!GD.ver||!window.indexedDB||!navigator.serviceWorker)return;
  obPut({id:'main',fileId:GD.id,baseVersion:GD.ver,token:GD.tok,body:gdBody(),at:Date.now()}).then(obRegister).catch(function(){});
  if(GD.cardsId){
    var cards=usersList().map(cardData);
    if(JSON.stringify(cards)!==GD.cardsLast){
      obPut({id:'cards',fileId:GD.cardsId,token:GD.tok,body:JSON.stringify({app:'rmy-cards',v:1,updated:new Date().toISOString(),cards:cards},null,2),at:Date.now()}).then(obRegister).catch(function(){});
    }
  }
}
function gdTokErr(e){
  var t=e&&e.type;
  GD.needTap=true;GD.ok=false;
  GD.err=t==='popup_closed'?'اتقفلت نافذة جوجل قبل التأكيد، اضغط أي مكان وجرّب تاني':(t==='popup_failed_to_open'?'المتصفح منع نافذة جوجل، اضغط أي مكان وجرّب تاني':'تعذّر الربط بجوجل');
  if(GD.pend){var p=GD.pend;GD.pend=null;p.rej({code:'tap'});}
  gdArm();GD.shown=null;gdPaint();
}
/* the browser only opens Google's window after a tap: take the first tap anywhere */
function gdArm(){
  if(GD.armed||!GD.on)return;
  GD.armed=true;
  var evs=['touchend','click','keydown'];
  function off(){evs.forEach(function(e){document.removeEventListener(e,tap,true);});GD.armed=false;}
  function tap(){
    if(!GD.on||gdTokOk()){off();return;}
    if(!GD.tc)return;
    off();gdRequest();
  }
  evs.forEach(function(e){document.addEventListener(e,tap,true);});
}
function gdAuth(){
  if(gdTokOk())return Promise.resolve();
  if(GD.needTap||!GD.tc)return Promise.reject({code:'tap'});
  return new Promise(function(res,rej){
    GD.pend={res:res,rej:rej};
    setTimeout(function(){if(GD.pend&&GD.pend.rej===rej){GD.pend=null;GD.needTap=true;rej({code:'tap'});}},8000);
    gdRequest();
  });
}
function gdApi(url,opt){
  opt=opt||{};
  opt.headers=Object.assign({Authorization:'Bearer '+GD.tok},opt.headers||{});
  opt.cache='no-store';
  return withTimeout(fetch(url,opt),20000).then(function(r){
    if(r.status===401){GD.tok=null;GD.exp=0;try{localStorage.removeItem('khat-gd-tok');}catch(e){}throw {code:401};}
    if(!r.ok)return r.text().then(function(t){
      var why='';try{var j=JSON.parse(t).error||{};why=(j.errors&&j.errors[0]&&j.errors[0].reason)||(j.details&&j.details[0]&&j.details[0].reason)||j.status||'';}catch(x){}
      throw {code:r.status,reason:why,msg:t.slice(0,160)};
    });
    return r;
  });
}
/* ترتيب الأقسام في الملف اللي على درايف: الأهم الأول، وباقي الأقسام أبجدي */
var DRIVE_ORDER=['users','prefs','hours','materials','products','orders','batches','done','ready','readyT','stock','stockT','locks','plog','plogTomb','tomb','seq','oseq','fseq','seen','savedAt','prefsK','prefsT','demo'];
function stateForDrive(s){
  var o={};
  DRIVE_ORDER.forEach(function(k){if(s[k]!==undefined)o[k]=s[k];});
  Object.keys(s).sort().forEach(function(k){if(o[k]===undefined)o[k]=s[k];});
  return o;
}
/* الملف بيتكتب مرتب (سطر لكل قيمة) عشان يتقري بسهولة لو اتفتح من درايف */
function gdBody(){return JSON.stringify({app:'khat-entaj',v:1,savedAt:Date.now(),data:stateForDrive(S)},null,2);}
function gdFindOldest(){
  var q=encodeURIComponent("name='"+GD_NAME+"' and trashed=false");
  return gdApi('https://www.googleapis.com/drive/v3/files?q='+q+'&orderBy=createdTime&pageSize=5&fields=files(id)&spaces=drive')
    .then(function(r){return r.json();}).then(function(j){return j.files&&j.files[0]?j.files[0].id:null;});
}
function gdCreate(){
  var at=S.savedAt||0,b='khat'+Date.now().toString(36);
  var body='--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:GD_NAME,mimeType:'application/json'})+'\r\n--'+b+'\r\nContent-Type: application/json\r\n\r\n'+gdBody()+'\r\n--'+b+'--';
  return gdApi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body:body})
    .then(function(r){return r.json();}).then(function(j){GD.id=j.id;GD.ver=String(j.version);GD.upAt=at;gdSaveCfg();});
}
/* every ~minute re-check which file is the oldest, so devices that connected at the same moment end up on one file */
function gdEnsureFile(){
  GD.n++;
  if(GD.id&&GD.n%30!==0)return Promise.resolve();
  return gdFindOldest().then(function(id){
    if(id){if(id!==GD.id){GD.id=id;GD.ver=null;gdSaveCfg();}return;}
    if(GD.id)return;
    return gdCreate();
  });
}
function gdDownloadMain(){
  return gdApi('https://www.googleapis.com/drive/v3/files/'+GD.id+'?alt=media').then(function(r){return r.text();})
    .then(function(t){var d=t&&t.trim()?parseTolerant(t).data:null;return d?fix(d):null;});
}
/* المرحلة 2: نقرأ ملفات الأقسام كلها. لو أي ملف ناقص أو قديم عن الملف الأساسي، بنرجع للأساسي */
function gdFetchShardParts(){
  var n=0;gdStage('جاري تنزيل البيانات…',25);
  return Promise.all(SHARD_FILES.map(function(sf){
    return gdShardLookup(sf.f).then(function(id){
      if(!id)return null;
      return gdApi('https://www.googleapis.com/drive/v3/files/'+id+'?alt=media').then(function(r){return r.text();})
        .then(function(t){return t&&t.trim()?parseTolerant(t):null;});
    }).catch(function(){delete GD_SHARD_IDS[sf.f];gdSaveCfg();return null;}).then(function(v){
      n++;gdStage('جاري تنزيل البيانات ('+n+'/'+SHARD_FILES.length+')',25+Math.round(65*n/SHARD_FILES.length));return v;
    });
  }));
}

function gdDownload(){
  return Promise.all([gdDownloadMain(),gdFetchShardParts()]).then(function(r){
    var main=r[0],mainAt=main?(main.savedAt||0):0;
    var sh=combineShards(r[1],mainAt);
    gdStage('جاري تجهيز الشاشة…',95);
    if(!sh)return main;
    /* الملفات الفرعية ما فيهاش كل الأقسام (زي قوالب العلب)، فبناخد الباقي من الملف الأساسي عشان ما يتمسحش */
  return fix(Object.assign({},main||{},sh.data,{savedAt:sh.savedAt}));
  });
}
/* ---------- ملفات الأقسام (الأقسام بتتكتب جنب الملف الأساسي، وبتتقري وتتدمج معاه عند التنزيل) ---------- */
var SHARD_FILES=[
  {f:'orders.json',keys:['orders']},
  {f:'batches.json',keys:['batches']},
  {f:'done.json',keys:['done']},
  {f:'products.json',keys:['products','materials','stock']},
  {f:'waste.json',keys:['waste']},
  {f:'owner.json',keys:['users','prefs','auth']},
  {f:'history.json',keys:['archive','locks','tomb','plog','plogTomb','ready','readyT','stockT','hours','seq','oseq','fseq','prefsK','prefsT','demo']}
];
var GD_SHARD_IDS={};
function gdShardBody(name,keys){
  var d={};keys.forEach(function(k){if(S[k]!==undefined)d[k]=S[k];});
  return JSON.stringify({app:'khat-entaj',v:1,shard:name,savedAt:Date.now(),data:d},null,2);
}
function gdShardLookup(name){
  if(GD_SHARD_IDS[name])return Promise.resolve(GD_SHARD_IDS[name]);
  var q=encodeURIComponent("name='"+name+"' and trashed=false");
  return gdApi('https://www.googleapis.com/drive/v3/files?q='+q+'&pageSize=1&fields=files(id)&spaces=drive')
    .then(function(r){return r.json();}).then(function(j){var id=j.files&&j.files[0]?j.files[0].id:null;if(id){GD_SHARD_IDS[name]=id;gdSaveCfg();}return id;});
}
function gdShardWrite(name,body){
  return gdShardLookup(name).then(function(id){
    if(id)return gdApi('https://www.googleapis.com/upload/drive/v3/files/'+id+'?uploadType=media&fields=version',{method:'PATCH',headers:{'Content-Type':'application/json'},body:body});
    var b='khat'+Date.now().toString(36);
    var mp='--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:name,mimeType:'application/json'})+'\r\n--'+b+'\r\nContent-Type: application/json\r\n\r\n'+body+'\r\n--'+b+'--';
    return gdApi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body:mp})
      .then(function(r){return r.json();}).then(function(j){if(j.id)GD_SHARD_IDS[name]=j.id;});
  });
}
/* بعد كل رفع ناجح للملف الأساسي، بنكتب نسخ الأقسام. أي فشل هنا مابيأثرش على الملف الأساسي */
function gdWriteShards(){
  SHARD_FILES.forEach(function(sf){
    gdShardWrite(sf.f,gdShardBody(sf.f,sf.keys)).catch(function(){});
  });
}
function gdUpload(){
  var at=S.savedAt||0;
  return gdApi('https://www.googleapis.com/upload/drive/v3/files/'+GD.id+'?uploadType=media&fields=version',{method:'PATCH',headers:{'Content-Type':'application/json'},body:gdBody()})
    .then(function(r){return r.json();}).then(function(j){GD.ver=String(j.version);GD.upAt=at;gdWriteShards();});
}
function gdFail(e){
  var c=e&&e.code;GD.ok=false;if(!GD.seeded)setTimeout(render,0);
  if(!navigator.onLine)netShowSoon();
  if(c==='tap'||c===401){GD.needTap=true;GD.err='محتاج تأكيد من جوجل، اضغط أي مكان في الشاشة';gdArm();}
  else if(c===404){GD.id=null;GD.ver=null;gdSaveCfg();GD.err='الملف اتمسح من درايف، هيتعمل من جديد';}
  else if(c===403){
    var rs=String((e&&e.reason)||'');
    if(/accessNotConfigured|SERVICE_DISABLED/i.test(rs))GD.err='Drive API مش مفعّل في مشروع الكونسول. فعّله من APIs & Services ثم Library ثم Google Drive API';
    else if(/insufficient|scope/i.test(rs)){GD.err='صلاحية Drive ما اتأكدتش. افصل واربط تاني، وعلّم على مربع Drive في شاشة جوجل';GD.tok=null;GD.exp=0;try{localStorage.removeItem('khat-gd-tok');}catch(x){}}
    else GD.err='جوجل رفض الطلب ('+(rs||'403')+')';
  }
  else if(e&&e.message==='timeout')GD.err='الاتصال بجوجل بطيء، هيحاول تاني';
  else if(!navigator.onLine)GD.err='مفيش إنترنت';
  else GD.err='خطأ في الاتصال بجوجل'+(c?' ('+c+')':'');
  gdPaint();
}
/* معرّف الجهاز: ثابت على الجهاز ده بس (مش بيتزامن)، وبيتسجل في الحالة المتزامنة مع وقت آخر مزامنة */
function devId(){try{var v=localStorage.getItem('khat-dev');if(!v){v=randHex().slice(0,16);localStorage.setItem('khat-dev',v);}return v;}catch(e){return 'nolocal';}}
function gdSync(){
  if(!GD.on||!LOCAL_READY)return Promise.resolve();
  if(GD.busy&&Date.now()-GD.busyAt<12000){GD.again=true;return Promise.resolve();}
  GD.again=false;
  GD.busy=true;GD.busyAt=Date.now();gdPaint();
  if(!GD.seeded)GD.pct=0;gdStage('جاري الاتصال بجوجل درايف…',5);
  var g0=guardState(S,GD.snap);if(g0!==S){S=g0;bind(S);}
  var syncStart=Date.now();
  /* التعديلات اللي لسه متترفعتش (صندوق الرفع) بتتقري وبتتدمج، ومابتتمسحش إلا بعد ما تتحفظ على درايف */
  var pendP=obGet('main').catch(function(){return null;});
  return gdAuth().then(gdEnsureFile).then(function(){
    if(!GD.id)return;
    return gdApi('https://www.googleapis.com/drive/v3/files/'+GD.id+'?fields=version,trashed').then(function(r){return r.json();}).then(function(m){
      if(m.trashed){GD.id=null;GD.ver=null;gdSaveCfg();return;}
      var pull=!GD.ver||String(m.version)!==String(GD.ver);
      var remoteP=pull?(gdStage('جاري فحص البيانات…',20),gdDownload()):(gdStage('البيانات محدّثة',95),Promise.resolve(undefined));
      return Promise.all([pendP,remoteP]).then(function(res){
        var pend=res[0],remote=res[1],pendState=null;
        if(pend&&pend.body){try{var pj=JSON.parse(pend.body);pendState=pj&&pj.data?fix(pj.data):null;}catch(e){pendState=null;}}
        markEdits();
        var need=false;
        var local=pendState?mergeStates(S,pendState,SYNCBASE):S;
        if(remote!==undefined){
          var Mg=remote?mergeStates(local,remote,SYNCBASE):local;
          need=!remote||coreKey(Mg)!==coreKey(remote);
          var fresh=GD.seeded?newRemote(S,Mg):[];
          if(canon(Mg)!==canon(S)){S=Mg;bind(S);baseline();applyTheme();persistLocal();renderIdle();}
          if(fresh.length)notifyRemote(fresh);
          GD.ver=String(m.version);
          if(!need)GD.upAt=S.savedAt||0;
        }else{
          need=pendState?true:(S.savedAt||0)!==GD.upAt;
          if(pendState&&canon(local)!==canon(S)){S=local;bind(S);baseline();applyTheme();persistLocal();renderIdle();}
        }
        /* fix() inside gdDownload points MATERIALS/PRODUCTS at the downloaded copy; re-point them at the live state, or edits go to a copy that never gets saved */
        bind(S);
        S.devs=S.devs||{};if(!S.devs[devId()]||nowStamp()-S.devs[devId()]>600000)S.devs[devId()]=nowStamp();
        S.devUser=S.devUser||{};var _du=S.devUser[devId()],_cc=sessionCode()||'owner';if(!_du||_du.c!==_cc||nowStamp()-(_du.t||0)>600000)S.devUser[devId()]={c:_cc,t:nowStamp()};
        pruneTombs(S,Date.now());
        SYNCBASE=snapshotBase();
        return need?gdUpload():undefined;
      });
    });
  }).then(function(){obDelUpTo('main',syncStart).catch(function(){});gdCardsSync();var firstLoad=!GD.seeded;GD.pct=100;GD.ok=true;GD.seeded=true;GD.err=null;GD.at=Date.now();if(limited()&&GD.snapped!==GD.ver){GD.snap=snapOf(S);GD.snapped=GD.ver;}gdPaint();if(firstLoad){render();document.dispatchEvent(new Event('rmy:loaded'));}})
    .catch(gdFail).then(function(){GD.busy=false;gdPaint();if(GD.again){GD.again=false;gdSync();}});
}
/* ملف الكروت: ملف منفصل على درايف بيتقري من صفحة الكروت (وأي حد معاه الرابط يقدر يقراه) */
var CARDS_NAME='rmy-cards.json';
function gdCardsFind(){
  var q=encodeURIComponent("name='"+CARDS_NAME+"' and trashed=false");
  return gdApi('https://www.googleapis.com/drive/v3/files?q='+q+'&pageSize=1&fields=files(id)&spaces=drive')
    .then(function(r){return r.json();}).then(function(j){return j.files&&j.files[0]?j.files[0].id:null;});
}
function gdCardsCreate(){
  var b='rmycards'+randHex().slice(0,12);
  var mp='--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:CARDS_NAME,mimeType:'application/json'})+'\r\n--'+b+'\r\nContent-Type: application/json\r\n\r\n{}\r\n--'+b+'--';
  return gdApi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body:mp})
    .then(function(r){return r.json();}).then(function(j){
      return gdApi('https://www.googleapis.com/drive/v3/files/'+j.id+'/permissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'reader',type:'anyone'})})
        .then(function(){return j.id;});
    });
}
function gdCardsSync(){
  if(!GD.on||!GD.id||!gdTokOk())return Promise.resolve();
  var cards=usersList().map(cardData);
  var arr=JSON.stringify(cards);
  if(GD.cardsId&&arr===GD.cardsLast)return Promise.resolve();
  var body=JSON.stringify({app:'rmy-cards',v:1,updated:new Date().toISOString(),cards:cards},null,2);
  return (GD.cardsId?Promise.resolve(GD.cardsId):gdCardsFind().then(function(id){return id||gdCardsCreate();}))
    .then(function(id){
      return gdApi('https://www.googleapis.com/upload/drive/v3/files/'+id+'?uploadType=media&fields=id',{method:'PATCH',headers:{'Content-Type':'application/json'},body:body})
        .then(function(){GD.cardsId=id;GD.cardsLast=arr;gdSaveCfg();obDel('cards').catch(function(){});});
    })
    .catch(function(e){
      if(e&&e.code===404){GD.cardsId=null;GD.cardsLast=null;gdSaveCfg();}
    });
}
function gdStart(){
  gdLoadCfg();
  gdLoadGis();
  document.addEventListener('visibilitychange',function(){if(!document.hidden)gdSync();});
  /* لما التطبيق يروح للخلفية: نحفظ ونرفع فورًا قبل ما المتصفح يوقفه. لو التوكن منتهي مش هنفتح نافذة، والتعديلات بتفضل محفوظة في الطابور لحد الفتح الجاي */
  var bgFlush=function(){if(!GD.on)return;try{save();if(gdTokOk())gdSync();}catch(e){}};
  document.addEventListener('visibilitychange',function(){if(document.hidden)bgFlush();});
  window.addEventListener('pagehide',bgFlush);
  if(GD.on&&!gdTokOk())gdArm();
  if(GD.on&&gdTokOk())gdScheduleRefresh();
}
/* حالة درايف في الهيدر: أيقونة متحركة بتوضح نوع الاتصال الحالي */
function driveHTML(){
  var cloud='M17.5 19H9a7 7 0 1 1 6.9-8.2A5.5 5.5 0 1 1 17.5 19z';
  var refresh='M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M18.5 2v4h-4M5.5 22v-4h4';
  var st,lbl,ico,act='syncOpen';
  if(!GD.on){st='off';lbl='غير متصل';ico='<path d="'+cloud+'"/><path d="M3 3l18 18"/>';}
  else if(GD.needTap){st='warn';lbl='محتاج تأكيد';ico='<path d="'+cloud+'"/><path d="M12 10v3M12 16v.01"/>';}
  else if(GD.err&&!GD.ok){st='bad';lbl='خطأ';ico='<path d="'+cloud+'"/><path d="M9.5 11.5l5 5M14.5 11.5l-5 5"/>';}
  else if(GD.busy){st='sync';lbl='بيزامن';ico='<path d="'+refresh+'"/>';}
  else if(GD.ok){st='ok';lbl='متصل';ico='<path d="'+cloud+'"/><path d="M9.5 13.5l2 2 3.5-3.5"/>';}
  else {st='conn';lbl='جاري الاتصال';ico='<path d="'+refresh+'"/>';}
  return '<span class="dstat '+st+'" data-act="'+act+'" role="button" tabindex="0">'+
    '<svg class="dico" viewBox="0 0 24 24" aria-hidden="true">'+ico+'</svg><span>'+lbl+'</span></span>';
}
/* شاشة حالة المزامنة: بتفتح لما تضغط على حالة درايف في الشريط اللي تحت */
function syncInfoRows(){
  var st=!GD.on?'غير متصل بدرايف':GD.needTap?'محتاج تأكيد من جوجل':GD.busy?'بيزامن دلوقتي':GD.err&&!GD.ok?'في خطأ':GD.ok?'متزامن':'جاري الاتصال';
  var rows=[
    ['الحالة',st],
    ['آخر مزامنة ناجحة',GD.at?evDateStr(GD.at):'لسه ماتمتش'],
    ['الإنترنت',navigator.onLine?'متصل':'مفيش إنترنت'],
    ['تعديلات مستنية ترفع',!hasPending()?'لا، كله اترفع':(GD.busy?'بيترفع دلوقتي':'أيوه، لسه ماترفعتش')],
    ['الملف الرئيسي على درايف',GD.id?'متوصّل · نسخة '+(GD.ver||'—'):'مش متوصّل'],
    ['ملف الكروت',GD.cardsId?'متوصّل':'لسه ماتعملش'],
    ['معدل المزامنة على الجهاز',SYNC_CHOICES[syncEvery()]||'—']
  ];
  if(GD.busy)rows.splice(1,0,['المرحلة الحالية',GD.stage||'…']);
  if(GD.err)rows.push(['آخر خطأ',GD.err]);
  return rows;
}
/* ---------- شاشة المزامنة (تصميم جديد) ---------- */
var SYN_ICO={
  cloud:'<path d="M17.5 19H9a7 7 0 1 1 6.9-8.2A5.5 5.5 0 1 1 17.5 19z"/>',
  refresh:'<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M18.5 2v4h-4M5.5 22v-4h4"/>',
  check:'<path d="M9.5 13.5l2 2 3.5-3.5"/>',
  cross:'<path d="M9.5 11.5l5 5M14.5 11.5l-5 5"/>',
  alert:'<path d="M12 10v3M12 16v.01"/>',
  off:'<path d="M3 3l18 18"/>',
  wifi:'<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".6"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  sliders:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/>',
  file:'<path d="M7 3h7l5 5v13H7zM14 3v5h5"/>',
  cards:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  device:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M11 18h2"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'
};
function synIco(k){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+(SYN_ICO[k]||'')+'</svg>';}
function synState(){
  if(!GD.on)return {k:'off',ico:'off',t:'غير متصل بدرايف',s:'اربط حساب جوجل عشان كل الأجهزة تتزامن'};
  if(GD.needTap)return {k:'warn',ico:'alert',t:'محتاج تأكيد من جوجل',s:'اضغط تأكيد الربط عشان المزامنة ترجع تشتغل'};
  if(GD.busy)return {k:'sync',ico:'refresh',t:'بيزامن دلوقتي',s:GD.stage||'…'};
  if(GD.err&&!GD.ok)return {k:'bad',ico:'cross',t:'في مشكلة في المزامنة',s:GD.err};
  if(GD.ok)return {k:'ok',ico:'check',t:'متزامن',s:GD.at?'آخر مزامنة '+synRel(GD.at):'كل حاجة محدّثة'};
  return {k:'conn',ico:'refresh',t:'جاري الاتصال',s:'استنى ثواني'};
}
function synRel(t){
  var d=Date.now()-t;
  if(d<60000)return 'دلوقتي';
  if(d<3600000)return 'من '+Math.round(d/60000)+' دقيقة';
  if(d<86400000)return 'من '+Math.round(d/3600000)+' ساعة';
  return evDateStr(t);
}
/* لون ثابت لكل حساب بيتحسب من الكود، عشان الكارت يبان مميز */
function synHue(s){var h=0;s=String(s||'');for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)%360;}
function synDevCards(){
  var devs=S.devs||{},keys=Object.keys(devs),now=Date.now(),me=devId();
  if(!keys.length)return '<div class="syn-empty">'+synIco('device')+'<b>مفيش أجهزة مسجلة لسه</b><small>أول ما جهاز يفتح التطبيق ويزامن هيظهر هنا</small></div>';
  return keys.sort(function(a,b){return (devs[b]||0)-(devs[a]||0);}).map(function(k){
    var t=devs[k]||0,online=now-t<=600000,du=(S.devUser||{})[k],uc=du?du.c:'';
    var name=!du?'غير معروف':(uc==='owner'?'المالك':((userByCode(uc)||{}).name||uc));
    var initial=esc(String(name).trim().charAt(0)||'?');
    var hue=synHue(uc||k);
    return '<div class="syn-dev'+(online?' on':'')+(k===me?' me':'')+'">'+
      '<div class="syn-av" style="--h:'+hue+'">'+initial+'</div>'+
      '<div class="syn-dtx"><b>'+esc(name)+'</b>'+
        '<small><span class="syn-chip">'+(k===me?'الجهاز ده':'جهاز')+' · <bdi dir="ltr">'+esc(k.slice(0,6))+'</bdi></span></small>'+
        '<small class="syn-seen">'+(online?'نشط الآن':'آخر ظهور '+evDateStr(t))+'</small></div>'+
      '<span class="syn-dot'+(online?' on':'')+'" aria-label="'+(online?'نشط':'غير نشط')+'"></span>'+
      (k===me||limited()?'':'<button class="syn-del" data-act="synDelDev" data-k="'+esc(k)+'" aria-label="حذف الجهاز">'+synIco('trash')+'</button>')+'</div>';
  }).join('');
}
function syncBodyHTML(){
  var st=synState();
  var pend=hasPending();
  var fileRows=
    '<div class="syn-file"><span class="syn-fi">'+synIco('file')+'</span><div class="syn-dtx"><b>الملف الرئيسي</b><small>'+(GD.id?'متوصّل · نسخة '+esc(GD.ver||'—'):'مش متوصّل')+'</small></div><span class="syn-dot '+(GD.id?'on':'')+'"></span></div>'+
    '<div class="syn-file"><span class="syn-fi">'+synIco('cards')+'</span><div class="syn-dtx"><b>ملف الكروت</b><small>'+(GD.cardsId?'متوصّل':'لسه ماتعملش')+'</small></div><span class="syn-dot '+(GD.cardsId?'on':'')+'"></span></div>';
  var kpis=
    netKpiHTML()+
    '<div class="syn-kpi '+(pend?'warn':'good')+'"><span>'+synIco('upload')+'</span><small>تعديلات مستنية</small><b>'+(pend?(GD.busy?'بتترفع':'لسه'):'كله اترفع')+'</b></div>'+
    '<div class="syn-kpi"><span>'+synIco('sliders')+'</span><small>معدل المزامنة</small><b>'+esc((GD.on&&SYNC_CHOICES[syncEvery()])||'—')+'</b></div>';
  var owner=!limited(),canEdit=owner||permLevel('sync')==='edit';
  var needConnect=owner&&(!GD.on||GD.needTap||(GD.err&&!GD.ok));
  var btns=(canEdit?'<button class="btn syn-main" data-act="syncNow"'+(GD.on&&!GD.busy?'':' disabled')+'>مزامنة الآن</button>':'')+
    (needConnect?'<button class="btn ghost sm" data-act="gdConnect">'+(GD.on?'تأكيد الربط مع جوجل':'ربط درايف')+'</button>':'')+
    '<button class="btn ghost sm" data-act="syncClose">إغلاق</button>';
  var devCount=Object.keys(S.devs||{}).length;
  return '<div class="syn syn-'+st.k+'">'+
    '<div class="syn-hero">'+
      '<div class="syn-orb">'+synIco(st.ico)+'</div>'+
      '<div class="syn-htx"><b>'+esc(st.t)+'</b><small>'+esc(st.s)+'</small></div>'+
      (GD.busy?'<div class="syn-bar"><i style="width:'+Math.round(Math.max(4,GD.pct||0))+'%"></i></div>':'')+
    '</div>'+
    '<div class="syn-kpis">'+kpis+'</div>'+
    '<div class="syn-sec"><h4>الملفات على درايف</h4><div class="syn-list">'+fileRows+'</div></div>'+
    '<div class="syn-sec"><h4>الأجهزة <span class="syn-count">'+devCount+'</span></h4><div class="syn-list">'+synDevCards()+'</div></div>'+
    '<div class="syn-foot">'+btns+'</div>'+
  '</div>';
}
function syncScreenHTML(){
  if(!U.syncOpen)return '';
  if(limited()&&permLevel('sync')==='none')return '';
  return '<button class="back" data-act="syncClose" aria-label="إغلاق"></button>'+
    '<section class="sheet f syn-sheet" style="--c:var(--stock)" role="dialog" aria-label="حالة المزامنة"><div class="sbody">'+
    '<div id="syncBody">'+syncBodyHTML()+'</div>'+
    '</div></section>';
}
/* تحديث الشاشة كل ثانية وهي مفتوحة، عشان المرحلة والتعديلات تتغير وانت شايف */
var SYNC_TMR=null,SYNC_LAST='';
function syncLiveRefresh(){
  var el=document.getElementById('syncBody');
  if(!U.syncOpen||!el){syncLiveStop();return;}
  var h=syncBodyHTML();if(h!==SYNC_LAST){SYNC_LAST=h;el.innerHTML=h;}
}
function syncLiveStart(){syncLiveStop();SYNC_TMR=setInterval(syncLiveRefresh,800);}
function syncLiveStop(){if(SYNC_TMR){clearInterval(SYNC_TMR);SYNC_TMR=null;}}
function syncChoicesHTML(){
  var cur=syncEvery();
  return '<div class="grp" style="margin-top:12px">معدل المزامنة على الجهاز ده</div><div class="dbtns">'+
    Object.keys(SYNC_CHOICES).map(function(k){var n=Number(k);return '<button class="btn '+(n===cur?'sm':'ghost sm')+'" data-act="syncEvery" data-v="'+n+'">'+SYNC_CHOICES[k]+'</button>';}).join('')+'</div>';
}
function gdBadge(){
  if(GD.ok)return '<span class="pill ok" data-act="gdNow">متصل بدرايف</span>';
  if(GD.err&&!GD.needTap)return '<span class="pill bad" data-act="tab" data-v="settings">درايف: خطأ، اضغط للتفاصيل</span>';
  return '<span class="pill low" data-act="gdNow">درايف: '+(GD.needTap?'محتاج تأكيد':'جاري الاتصال')+'</span>';
}
function gdCardHTML(){
  gdLoadGis();
  return '<section class="card" style="--c:var(--stock)"><div class="row"><h3>جوجل درايف</h3>'+(GD.on?gdBadge():'<span class="pill">غير متصل</span>')+'</div>'+
    '<p class="meta" style="margin:0">'+(GD.on?'المزامنة شغالة ('+SYNC_CHOICES[syncEvery()]+') مع ملف <span class="ltr">'+GD_NAME+'</span> على حساب جوجل بتاعك. لازم كل الأجهزة تدخل بنفس الحساب.'+(GD.at?' آخر مزامنة: '+tstr(GD.at):'')+(hasPending()?' · فيه تعديلات لسه مترفعتش':' · كل التعديلات متزامنة'):'اربط حساب جوجل عشان كل الأجهزة تشوف نفس البيانات، من غير ما تعتمد على ملف الجهاز.')+'</p>'+
    (GD.on&&GD.err?'<div class="note">'+esc(GD.err)+'</div>':'')+
    gdHintHTML()+(GD.on?syncChoicesHTML():'')+'<div class="dbtns">'+(GD.on?'<button class="btn sm" data-act="gdNow">زامن الآن</button><button class="btn ghost sm" data-act="gdOff">فصل</button>':'<button class="btn sm" data-act="gdConnect">ربط جوجل درايف</button>')+'</div></section>';
}

/* header and settings */

function exportBackup(){
  var body=JSON.stringify({app:'khat-entaj',v:1,savedAt:Date.now(),data:S},null,2);
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([body],{type:'application/json'}));
  a.download='khat-entaj-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},4000);
}
function cardShow(u,k){var s=u.show||{};return s[k]===undefined?(k!=='wa'):!!s[k];}
var CARD_FIELDS=[['name','الاسم'],['job','الوظيفة'],['joinDate','تاريخ الانضمام'],['wa','رقم الواتساب (مخفي جزئياً)']];
function cardFieldBoxes(u){
  return '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" checked disabled> الكود (هو الـ ID)</label>'+
    '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" data-cactive'+(u.cardActive!==false?' checked':'')+'> الكارت Active (نقطة خضراء) · لو مش متعلّم يبقى Inactive (نقطة حمرا)</label>'+
    CARD_FIELDS.map(function(f){return '<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" data-cf="'+f[0]+'"'+(cardShow(u,f[0])?' checked':'')+'> '+f[1]+'</label>';}).join('');
}
/* اللي بيتصدر بس: الحقول المتعلّمة. الحقول المش متعلّمة مش بتتصدر خالص */
function cardData(u){
  var c={code:u.code,active:u.cardActive!==false};
  if(cardShow(u,'name')&&u.name)c.name=u.name;
  if(cardShow(u,'job')&&u.job)c.job=u.job;
  if(cardShow(u,'joinDate')&&u.joinDate)c.joinDate=u.joinDate;
  if(cardShow(u,'wa')&&u.wa)c.wa=maskWa(u.wa);
  return c;
}
function exportCards(){
  var list=usersList().map(cardData);
  var body=JSON.stringify({app:'rmy-cards',v:1,updated:new Date().toISOString(),cards:list},null,2);
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([body],{type:'application/json'}));
  a.download='cards.json';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},4000);
  toast('اتصدّر cards.json · ارفعه جنب index.html');
}
/* restore: refresh the source first, so a stale cached copy (Google Drive on some phones) is never used */
function parseBackupText(t){
  var o=parseTolerant(t),d=(o&&o.data)?o.data:o;
  if(o&&o.app&&o.app!=='khat-entaj')throw new Error('wrong-app');
  if(!d||!d.stock||typeof d.stock!=='object'||!Array.isArray(d.batches)||!Array.isArray(d.done||[])||!Array.isArray(d.orders||[]))throw new Error('bad');
  return {d:d,at:(o&&o.savedAt)||d.savedAt||0};
}
/* Restore a backup as an intentional replacement. Tombstones prevent records removed by the
   imported snapshot from reappearing during the next Google Drive merge. */
function applyBackup(parsed){
  if(!parsed||!parsed.d)throw new Error('bad');
  var old=S, incoming=fix(parsed.d), now=Date.now();
  incoming.tomb=incoming.tomb||{};
  STAMPED.forEach(function(c){
    incoming[c]=Array.isArray(incoming[c])?incoming[c]:[];
    incoming.tomb[c]=Object.assign({},(old.tomb&&old.tomb[c])||{},incoming.tomb[c]||{});
    var keep={};incoming[c].forEach(function(r){if(r&&r.id!=null){r._u=now;keep[String(r.id)]=1;}});
    (old[c]||[]).forEach(function(r){if(r&&r.id!=null&&!keep[String(r.id)])incoming.tomb[c][r.id]=now;});
  });
  ['stock','ready'].forEach(function(m){
    incoming[m]=incoming[m]||{};incoming[m+'T']=incoming[m+'T']||{};
    var keys={};Object.keys(old[m]||{}).forEach(function(k){keys[k]=1;});Object.keys(incoming[m]).forEach(function(k){keys[k]=1;});
    Object.keys(keys).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(incoming[m],k))incoming[m][k]=0;incoming[m+'T'][k]=now;});
  });
  incoming.savedAt=now;incoming.prefsT=now;
  S=incoming;bind(S);baseline();applyTheme();persistLocal();saveSoon();render();
  toast('تم استيراد النسخة الاحتياطية؛ جاري حفظها ومزامنتها مع جوجل درايف');
}
function importFromInput(){
  var inp=document.createElement('input');
  inp.type='file';inp.accept='.json,application/json';
  inp.onchange=function(){
    var f=inp.files&&inp.files[0];if(!f)return;
    var rd=new FileReader();
    rd.onload=function(){
      try{applyBackup(parseBackupText(rd.result));}
      catch(e){toast('الملف ده مش نسخة صالحة');}
    };
    rd.onerror=function(){toast('تعذّر قراءة الملف، جرّب تاني');};
    rd.readAsText(f);
  };
  inp.click();
}
/* استيراد بيانات الكروت: بيقرأ cards.json اللي اتصدّر ويحدّث الكروت للمستخدمين الموجودين بنفس الكود.
   مش بيضيف مستخدمين جداد ولا بيغيّر الباسورد، والـ WhatsApp مش بيتستورد لأنه بيتصدّر مخفي (****) */
function applyCardsImport(text){
  var j=JSON.parse(text);
  if(!j||j.app!=='rmy-cards'||!Array.isArray(j.cards))throw new Error('bad cards file');
  var byCode={};
  usersList().forEach(function(u){byCode[String(u.code).toLowerCase()]=u;});
  var ok=0,miss=[];
  j.cards.forEach(function(c){
    if(!c||!c.code)return;
    var u=byCode[String(c.code).toLowerCase()];
    if(!u){miss.push(c.code);return;}
    u.cardActive=c.active!==false;
    if(typeof c.name==='string'&&c.name.trim())u.name=c.name.trim();
    if(typeof c.job==='string'&&c.job.trim())u.job=c.job.trim();
    if(typeof c.joinDate==='string'&&c.joinDate)u.joinDate=c.joinDate;
    ok++;
  });
  save();render();
  var msg='اتحدّث '+ok+' كارت';
  if(miss.length)msg+=' · '+miss.length+' كود مش موجود عندك';
  toast(msg);
}
function importCards(){
  var inp=document.createElement('input');
  inp.type='file';inp.accept='.json,application/json';
  inp.onchange=function(){
    var f=inp.files&&inp.files[0];if(!f)return;
    var rd=new FileReader();
    rd.onload=function(){
      try{applyCardsImport(String(rd.result));}
      catch(e){toast('الملف ده مش cards.json صالح');}
    };
    rd.onerror=function(){toast('تعذّر قراءة الملف، جرّب تاني');};
    rd.readAsText(f);
  };
  inp.click();
}
function importBackup(){importFromInput();}
/* تصدير واستيراد الوصفات: ملف JSON، الخامات بتتربط بالاسم والوحدة */
function recipeRefs(p){
  return {name:unesc(p.name),cat:unesc(p.cat||''),grp:p.grp||'',unit:p.unit||'',mins:p.mins,temp:p.temp,yield:p.yield,season:p.season||'normal',noOrder:!!p.noOrder,notes:unesc(p.notes||''),
    stages:(p.stages||[]).map(function(g){return {kind:g.kind,name:g.name||'',steps:(g.steps||[]).slice(),ings:(g.ings||[]).map(function(i){var m=M(i.m);return {mn:m?unesc(m.name):'',mu:m?(m.unit||''):'',q:i.q};}).filter(function(i){return i.mn;})};}),
    comps:(p.comps||[]).map(function(c){var q=P(c.p);return {pn:q?unesc(q.name):'',q:c.q};}).filter(function(c){return c.pn;})};
}
function recExport(d){
  var kind=d.k==='shop'?'shop':'cust';
  var list=prodsOf(kind).filter(function(p){return !isFill(p);}).map(recipeRefs);
  if(!list.length){toast('مفيش وصفات تتصدر');return false;}
  var body=JSON.stringify({app:'khat-entaj',type:'recipes',v:1,kind:kind,exportedAt:Date.now(),recipes:list},null,2);
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([body],{type:'application/json'}));
  a.download='khat-wasfat-'+(kind==='shop'?'mahal':'orders')+'-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},4000);
}
function recImportText(t,kind){
  var o=parseTolerant(t);
  if(!o||o.app!=='khat-entaj'||o.type!=='recipes'||!Array.isArray(o.recipes))throw new Error('bad');
  var shopFlag=kind==='shop',skipped=[],added=[];
  function matFor(mn,mu){
    var hit=MATERIALS.filter(function(m){return unesc(m.name).trim()===mn.trim()&&(m.unit||'')===(mu||'');})[0];
    if(hit)return hit.id;
    var id='m'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    S.materials.push({id:id,name:esc(mn),cat:'عام',unit:mu||'جرام',min:0,storage:'مخزن جاف',exp:'',supplier:'',notes:'',alts:[]});
    S.stock[id]=0;
    return id;
  }
  var pending=[];
  o.recipes.forEach(function(r){
    var nm=String(r.name||'').trim();
    if(!nm){skipped.push('(بدون اسم)');return;}
    var exists=PRODUCTS.some(function(p){return !p.archived&&!isFill(p)&&!!p.shop===shopFlag&&unesc(p.name).trim()===nm;});
    if(exists){skipped.push(nm);return;}
    var np={id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:esc(nm),cat:esc(r.cat||'')||'عام',grp:r.grp||'',unit:r.unit||'قطعة',
      mins:Number(r.mins)||0,temp:r.temp,yield:Number(r.yield)||1,season:r.season||'normal',noOrder:!!r.noOrder,notes:esc(r.notes||''),shop:shopFlag,comps:[],
      stages:(r.stages||[]).map(function(g){return {kind:g.kind||'prep',name:g.name||'',steps:(g.steps||[]).slice(),ings:(g.ings||[]).map(function(i){return {m:matFor(String(i.mn||''),i.mu||''),q:Number(i.q)||0};}).filter(function(i){return i.m&&i.q>0;})};})};
    PRODUCTS.push(np);added.push(nm);pending.push({p:np,r:r});
  });
  /* الوصفات الفرعية بتتربط بعد ما كل الأصناف تتضاف */
  pending.forEach(function(x){
    x.p.comps=(x.r.comps||[]).map(function(c){
      var q=PRODUCTS.filter(function(y){return !y.archived&&unesc(y.name).trim()===String(c.pn||'').trim();})[0];
      return q?{p:q.id,q:Number(c.q)||0}:null;
    }).filter(function(c){return c&&c.q>0;});
  });
  S.products=PRODUCTS;
  bind(S);save();render();
  toast('اتضاف '+added.length+' وصفة'+(skipped.length?'، اتخطى '+skipped.length+' لأنها موجودة قبل كده':''));
}
function recImportFile(d){
  var kind=d.k==='shop'?'shop':'cust';
  var inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
  inp.onchange=function(){
    var f=inp.files&&inp.files[0];if(!f)return;
    var rd=new FileReader();
    rd.onload=function(){try{recImportText(rd.result,kind);}catch(e){toast('الملف ده مش ملف وصفات صالح');}};
    rd.onerror=function(){toast('تعذّر قراءة الملف، جرّب تاني');};
    rd.readAsText(f);
  };
  inp.click();
}
function backupCardHTML(){
  return '<section class="card" style="--c:var(--stock)"><div class="row"><h3>نسخة احتياطية</h3></div>'+
    '<p class="meta" style="margin:0">البيانات الأساسية محفوظة ومتزامنة على Google Drive. النسخة دي ملف احتياطي تنزّله على جهازك، وتقدر ترجّعه بالاستيراد لو احتجت.</p>'+
    '<div class="dbtns"><button class="btn sm" data-act="exportBackup">تنزيل نسخة</button><button class="btn ghost sm" data-act="importBackup">استيراد نسخة</button></div></section>';
}






function seed(){
  var s={stock:{},batches:[],done:[],ready:{},orders:[],oseq:0,seq:100,demo:false,materials:[],products:[],locks:{}};
  bind(s);return s;
}
/* Local IndexedDB cache + Google Drive sync. Drive remains the shared source across devices; IndexedDB protects edits during reloads or temporary network loss. */
var LOCAL_READY=false,LOCAL_Q=Promise.resolve(),LOCAL_ERR='',LOCAL_FALLBACK=false;


/* مش بنخزن بيانات التطبيق على الجهاز: البيانات بتيجي من جوجل درايف كل مرة */
function persistLocal(){}
function restoreLocal(){
  purgeLocalData();
  S=fix(seed());bind(S);baseline();applyTheme();
  LOCAL_READY=true;
  return Promise.resolve();
}
/* أي بيانات قديمة اتخزنت على الجهاز قبل كده بتتمسح، وإعدادات الواجهة بتفضل */
function purgeLocalData(){
  try{indexedDB.deleteDatabase('khat-entaj-fs');}catch(e){}
  try{localStorage.removeItem('khat-entaj-local');}catch(e){}
}
/* إعدادات الواجهة: محفوظة على الجهاز ده بس */
var UI_KEYS=['theme','tabsHidden','seasonsHidden'];
function uiLoad(){try{return JSON.parse(localStorage.getItem('khat-ui')||'{}');}catch(e){return {};}}
function uiSave(k,v){try{var o=uiLoad();o[k]=v;localStorage.setItem('khat-ui',JSON.stringify(o));}catch(e){}}
/* مرة واحدة: كل الأجهزة تتحول لـ ١٠ ثواني (حتى اللي كانت مختارة قبل كده) */
try{if(!localStorage.getItem('khat-sync-mig10')){uiSave('syncEvery',10000);localStorage.setItem('khat-sync-mig10','1');}}catch(e){}
function load(){return seed();}
function save(){PRODUCTS.forEach(function(p){allocReady(p.id);});S.savedAt=Date.now();markEdits();saveSoon();persistLocal();}

var tt;
function toast(m){var el=document.getElementById('toast');el.textContent=unesc(m);el.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){el.classList.remove('show');},2600);}

/* ---------- views ---------- */
function dateStr(){
  try{return new Date().toLocaleDateString('ar-EG-u-nu-latn',{weekday:'long',day:'numeric',month:'long'});}catch(e){return '';}
}
/* هيدر الصفحة الرئيسية: تحية حسب الوقت واسم المستخدم لو داخل بحسابه */
/* الأصناف اللي ناقصة من مخزن الإنتاج لأوردرات مفتوحة */
function shortIdsNow(){
  var short={};
  (S.orders||[]).filter(function(o){return !o.deliveredAt;}).forEach(function(o){(o.items||[]).forEach(function(it){
    var need=(it.qty||0)-(it.got||0);
    if(need>0&&(S.ready[it.p]||0)<need)short[it.p]=1;
  });});
  return Object.keys(short).length;
}
/* رسالة أوردرات قسم معين (الأوردرات أو أوردرات المحل) */
function ordersNoteFor(kind,label){
  var now=Date.now();
  var open=ordersOf(kind).filter(function(o){return !o.deliveredAt;});
  if(!open.length)return {pr:0,v:'',t:'مفيش أوردرات مفتوحة في '+label+' · ابدأ بأوردر جديد من فوق'};
  var late=open.filter(function(o){return o.due&&new Date(o.due).getTime()<now&&!ordComplete(o);});
  if(late.length)return {pr:0,v:'',t:'⚠️ '+late.length+' أوردر في '+label+' اتجاوز معاده'};
  var soon=open.filter(function(o){if(!o.due)return false;var t=new Date(o.due).getTime()-now;return t>=0&&t<=2*3600000;}).sort(function(x,y){return new Date(x.due)-new Date(y.due);});
  if(soon.length){
    var o1=soon[0],mins=Math.max(1,Math.round((new Date(o1.due).getTime()-now)/60000));
    return {pr:0,v:'',t:'⏰ '+custName(o1)+' في '+label+' معاده بعد '+(mins<60?mins+' دقيقة':Math.round(mins/60)+' ساعة')};
  }
  var ready=open.filter(function(x){return ordComplete(x);}).length;
  if(ready)return {pr:0,v:'',t:'✅ '+ready+' أوردر في '+label+' جاهز للتسليم'};
  return {pr:0,v:'',t:'📋 '+open.length+' أوردر مفتوح في '+label};
}
/* رسالة مخصصة لكل تبويب: بتقول حاجة تخص التبويب اللي إنت فيه بس */
function tabNoteInfo(v){
  if(v==='orders')return ordersNoteFor('cust','الأوردرات');
  if(v==='shopOrders')return ordersNoteFor('shop','أوردرات المحل');
  if(v==='fgstock'){var exN=expiryCountNow();if(exN)return {pr:0,v:'',t:'⏳ '+exN+' صنف فيه دفعات منتهية أو قربت تنتهي · شوف مخزن الإنتاج'};var n1=shortIdsNow();return n1?{pr:0,v:'',t:'📦 '+n1+' صنف ناقص في مخزن الإنتاج لأوردراتك'}:{pr:0,v:'',t:'✅ مخزن الإنتاج مغطي لكل الأوردرات المفتوحة'};}
  if(v==='filling'){var n2=shortIdsNow();return n2?{pr:0,v:'',t:'🧁 '+n2+' صنف محتاج تحضير حشو'}:{pr:0,v:'',t:'🧁 مفيش تحضير حشو مطلوب دلوقتي'};}
  if(v==='prepreq'){var n3=shortIdsNow();return n3?{pr:0,v:'',t:'📋 '+n3+' تحضير مطلوب للأوردرات المفتوحة'}:{pr:0,v:'',t:'📋 مفيش تحضيرات مطلوبة دلوقتي'};}
  if(v==='recipes'){var n4=PRODUCTS.filter(function(p){return !isFill(p)&&!p.archived;}).length;return {pr:0,v:'',t:n4?'📖 '+n4+' صنف في الوصفات · اختار واحد أو ضيف وصفة جديدة':'📖 مفيش وصفات لسه · ابدأ بوصفة جديدة'};}
  if(v==='settings'){var n5=usersList().length;return {pr:0,v:'',t:'⚙️ '+n5+' حساب · التغييرات بتتحفظ تلقائي'};}
  return null;
}
/* الرسالة اللي تحت الترحيب بتتختار حسب صلاحيات الحساب: أي حد يشوف بس اللي يخص شغله، والرسالة بتفتح القسم المناسب */
function smartNoteInfo(){
  var now=Date.now();
  var tabNote=(U.view&&U.view!=='home')?tabNoteInfo(U.view):null;
  if(tabNote){
    if(hoursOpenRaw()!==false)return tabNote;
    return {pr:0,v:'',t:'🌙 بره المواعيد · '+tabNote.t};
  }
  var open=(S.orders||[]).filter(function(o){return !o.deliveredAt;});
  var out=[];
  var canOrd=routeAllowed('orders'),canShop=routeAllowed('shopOrders');
  if((canOrd||canShop)&&open.length){
    var ov=canOrd?'orders':'shopOrders';
    var late=open.filter(function(o){return o.due&&new Date(o.due).getTime()<now&&!ordComplete(o);});
    if(late.length)out.push({pr:1,v:ov,t:'⚠️ '+late.length+' أوردر اتجاوز معاده، ابدأ بيهم'});
    var soon=open.filter(function(o){if(!o.due)return false;var t=new Date(o.due).getTime()-now;return t>=0&&t<=2*3600000;}).sort(function(x,y){return new Date(x.due)-new Date(y.due);});
    if(soon.length){
      var o1=soon[0],mins=Math.max(1,Math.round((new Date(o1.due).getTime()-now)/60000));
      out.push({pr:2,v:ov,t:'⏰ '+custName(o1)+' معاده بعد '+(mins<60?mins+' دقيقة':Math.round(mins/60)+' ساعة')});
    }
    var ready=open.filter(function(x){return ordComplete(x);}).length;
    if(ready)out.push({pr:3,v:ov,t:'✅ '+ready+' أوردر جاهز للتسليم'});
    var td=open.filter(function(x){return x.due&&String(x.due).slice(0,10)===smDay(0);}).length;
    if(td)out.push({pr:5,v:ov,t:'📦 عندك '+td+' أوردر النهارده'});
    out.push({pr:6,v:ov,t:'📋 '+open.length+' أوردر مفتوح'});
  }
  /* الأصناف الناقصة في مخزن الإنتاج لأوردرات مفتوحة */
  if((routeAllowed('fgstock')||routeAllowed('filling'))&&open.length){
    var short={};
    open.forEach(function(o){(o.items||[]).forEach(function(it){
      var need=(it.qty||0)-(it.got||0);
      if(need>0&&(S.ready[it.p]||0)<need)short[it.p]=1;
    });});
    var n=Object.keys(short).length;
    if(n){
      if(routeAllowed('fgstock'))out.push({pr:4,v:'fgstock',t:'📦 '+n+' صنف ناقص في مخزن الإنتاج لأوردراتك'});
      else out.push({pr:4,v:'filling',t:'🧁 محتاج تحضر '+n+' صنف حشو للأوردرات'});
    }
  }
  if(hoursOpenRaw()===false){
    var nx=nextOpenLabel();
    out.push({pr:1.5,v:'',t:'🌙 بره مواعيد الشغل، حسابك مسموح له يكمل'+(nx?' · الشغل بيفتح '+nx:'')});
  }
  out.sort(function(x,y){return x.pr-y.pr;});
  if(out.length)return out[0];
  if(canOrd||canShop)return {pr:9,v:'',t:'مفيش أوردرات مفتوحة، يوم هادي'};
  return {pr:9,v:'',t:'يوم هادي، ابدأ شغلك'};
}

/* سطر الشريط الذكي على أي تبويب: بيتغير حسب الصلاحيات والمواعيد، واللمس بيفتح القسم المرتبط */
function stripLineHTML(){
  var f=smartNoteInfo();
  return '<style>.top .strip-line{display:block!important;width:100%!important;text-align:center!important;direction:rtl!important;margin:4px 0 0!important;padding:0!important;float:none!important}.top .strip-wrap{width:100%!important;text-align:center!important}</style>'+
    '<div class="strip-wrap" style="width:100%;text-align:center!important;direction:rtl"><div class="strip-line greet-sub" style="display:block;width:100%;text-align:center!important;text-align-last:center;direction:rtl;font-size:12px;color:var(--muted,#6b7090);font-weight:600;line-height:1.6;margin:4px 0 0;padding:0">'+esc(f.t)+'</div></div>';
}
function greetHTML(){
  var h=new Date().getHours();
  var g=h<12?'صباح الخير':h<17?'نهارك سعيد':'مساء النور';
  var c=sessionCode();var u=c?userByCode(c):null;
  return '<style>.tophome{display:block!important;text-align:center!important}.tophome .greet{display:block!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;float:none!important;text-align:center!important}</style>'+
    '<div class="greet">'+g+(u&&u.name?'، '+esc(u.name):'')+'</div>'+
    (function(){var f=smartNoteInfo();return '<div class="greet-sub"'+(f.v?' data-act="stripGo" data-v="'+f.v+'" role="button"':'')+' style="font-size:13px;color:var(--muted,#6b7090);margin-top:6px;font-weight:600'+(f.v?';cursor:pointer':'')+'">'+esc(f.t)+'</div>';})();
}
/* هيدر الصفحات الفرعية: زرار رجوع واسم القسم الحالي */
function titleHTML(){
  var name={orders:'الأوردرات',shopOrders:'أوردرات المحل',shopProducts:'وصفات المحل',prep:'التحضير',prod:'الإنتاج',stock:'الخامات',fgstock:'مخزن الإنتاج',tracking:'تتبع الصلاحية',reserved:'تحت التشغيل',recipes:'الوصفات',settings:'الإعدادات',filling:'تحضير حشو',prepreq:'تحضيرات مطلوبة',waste:'الهالك',boxes:'العلب',boxcomp:'تجميع علب',verify:'التحقق من البطاقة'}[U.view]||'';
  return '<b class="ttlname">'+esc(name)+'</b>';
}
function topHTML(){
    if(U.view!=='home')return '<header class="top" style="display:block!important;justify-content:center;text-align:center!important;direction:rtl"><div class="strip-wrap" style="display:block;width:100%;justify-self:stretch;text-align:center!important;direction:rtl">'+titleHTML().replace('<b class="ttlname"','<b class="ttlname" style="display:block;width:100%;text-align:center!important"')+stripLineHTML()+'</div></header>';
    return '<header class="top tophome" style="justify-content:center;text-align:center">'+greetHTML()+'</header>';
}
/* الشريط السفلي (تصميم 4): المعلومات يمين، والأدوات شمال بخط فاصل. زرار الرئيسية بيظهر في الصفحات الفرعية */
function footHTML(){
  var home=U.view!=='home'?'<button class="btn ghost sm themebtn" data-act="tab" data-v="home" aria-label="الرئيسية" title="الرئيسية">'+svg('home')+'</button>':'';
  return '<nav class="fbar" aria-label="أدوات">'+
    '<div class="finfo"><span class="hdate">'+dateStr()+'</span>'+driveHTML()+'</div>'+
    '<div class="hl">'+home+(tabHidden('refresh')?'':deepBtn())+(tabHidden('theme')?'':themeBtn())+(tabHidden('verify')?'':verifyBtn())+(limited()&&!canUse('settings')?'':settingsBtn())+'</div>'+
    '</nav>';
}
/* الصفحة الرئيسية: أقسام ثابتة، وكروت بمقاس واحد. الأرقام الصفر بتتعرض باهتة، والكروت اللي محتاجة متابعة بتتعلّم */
var DSH_SECS=[
  {t:'الأوردرات',keys:['orders','shopOrders','reserved','calendar']},
  {t:'التحضير والإنتاج',keys:['prep','prod','filling','prepreq']},
  {t:'المخازن',keys:['stock','fgstock','tracking','waste','boxcomp']},
  {t:'الوصفات',keys:['recipes','shopProducts']}
];
/* أيقونات الصفحة الرئيسية: ستايل واحد (خط 1.8)، ومعنى واضح لكل قسم، ومفيش أيقونتين شبه بعض */
var DSH_IC={
  orders:'<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12.5h6"/>',
  shopOrders:'<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  reserved:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  prep:'<rect x="5" y="4.5" width="14" height="16" rx="2.5"/><path d="M9 3.5h6v3H9z"/><path d="M9 13l2 2 4-4"/>',
  prod:'<path d="M12 3c.6 3.2 4.6 5.2 4.6 9.6A4.6 4.6 0 0 1 12 17.2a4.6 4.6 0 0 1-4.6-4.6c0-1.9.9-3.1 2-4.1.1 1.6.9 2.5 1.9 2.8C11.1 8.6 10.9 5.6 12 3z"/><path d="M7 21h10"/>',
  filling:'<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/>',
  prepreq:'<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  stock:'<path d="M12 3.5l8 4.5v8L12 20.5 4 16.5v-8z"/><path d="M4 8l8 4.5L20 8M12 12.5v8"/>',
  fgstock:'<path d="M3.5 10L12 4l8.5 6v9.5h-17z"/><path d="M9 19.5v-5h6v5"/>',
  tracking:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  waste:'<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',boxcomp:'<path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9"/>',
  recipes:'<path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M8 8.5h6M8 12h6"/>',
  shopProducts:'<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="8.5" r="1.2"/>'
};
function dshCss(){
  if(document.getElementById('dshCss'))return;
  var st=document.createElement('style');st.id='dshCss';
  st.textContent='.dsh{display:flex;flex-direction:column;gap:22px;padding:6px 0 14px}'+
    '.dsh-sec{display:flex;flex-direction:column;gap:10px}'+
    '.dsh-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px;font-size:13px;font-weight:700;color:var(--muted)}'+
    '.dsh-w{font-size:12px;font-weight:700;color:var(--warn)}'+
    '.dsh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}'+
    '@media (min-width:720px){.dsh-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}}'+
    '@media (min-width:1100px){.dsh-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}'+
    '.dsh-card{position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;min-height:76px;padding:14px;border-radius:16px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;text-align:start;cursor:pointer;transition:border-color .2s,box-shadow .2s,transform .15s}'+
    '.dsh-card:hover{border-color:color-mix(in srgb,var(--c) 45%,var(--line));box-shadow:0 12px 22px -18px var(--c)}'+
    '.dsh-card:active{transform:scale(.98)}'+
    '.dsh-card:focus-visible{outline:2px solid var(--c);outline-offset:2px}'+
    '.dsh-ico{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 14%,transparent);color:var(--c)}'+
    '.dsh-ico svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'+
    '.dsh-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}'+
    '.dsh-name{font-size:14px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '.dsh-unit{font-size:12px;color:var(--muted)}'+
    '.dsh-num{flex:none;font-family:var(--f-disp);font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ink)}'+
    '.dsh-card.zero .dsh-num{color:var(--muted);font-weight:700}'+
    '.dsh-card.warn{border-color:color-mix(in srgb,var(--warn) 45%,var(--line))}'+
    '.dsh-card.warn .dsh-num{color:var(--warn)}'+
    '.dsh-dot{position:absolute;top:10px;inset-inline-end:10px;width:8px;height:8px;border-radius:50%;background:var(--warn)}'+
    '.dsh-card.live{border-color:color-mix(in srgb,var(--prod) 55%,var(--line))}'+
    '.dsh-card.live .dsh-num{font-size:18px;color:var(--prod)}'+
    '.dsh-card.live{border-color:transparent;box-shadow:0 0 22px -10px var(--prod)}'+
    '.dsh-card.live .dsh-ico{background:radial-gradient(circle at 50% 70%,rgba(251,146,60,.55),rgba(124,45,18,.15) 70%);animation:dshGlow 1.2s ease-in-out infinite alternate}'+
    '.dsh-fire{overflow:visible;filter:drop-shadow(0 0 3px rgba(251,146,60,.95)) drop-shadow(0 0 10px rgba(239,68,68,.65))}'+
    '.dsh-fire .f1{transform-origin:12px 20px;animation:dshF1 .85s ease-in-out infinite alternate}'+
    '.dsh-fire .f2{transform-origin:7px 19px;animation:dshF2 .6s ease-in-out infinite alternate}'+
    '.dsh-fire .f3{transform-origin:17px 19px;animation:dshF3 .7s ease-in-out infinite alternate}'+
    '.dsh-fire .f4{transform-origin:12px 20px;animation:dshF4 .45s ease-in-out infinite alternate}'+
    '.dsh-fire .fg{transform-origin:12px 21.4px;animation:dshFg 1.2s ease-in-out infinite alternate;opacity:.5}'+
    '.dsh-fire .sp{opacity:0;animation:dshSp 1.4s ease-out infinite}'+
    '.dsh-fire .s2{animation-delay:.45s}.dsh-fire .s3{animation-delay:.9s}'+
    '@keyframes dshF1{0%{transform:scale(1,1) skewX(-4deg)}100%{transform:scale(1.06,1.14) skewX(4deg)}}'+
    '@keyframes dshF2{0%{transform:scale(1,.9) rotate(-6deg)}100%{transform:scale(.92,1.12) rotate(4deg)}}'+
    '@keyframes dshF3{0%{transform:scale(1,1.08) rotate(5deg)}100%{transform:scale(.9,.92) rotate(-4deg)}}'+
    '@keyframes dshF4{0%{transform:scale(.96,.94)}100%{transform:scale(1.08,1.1)}}'+
    '@keyframes dshFg{0%{transform:scale(.9);opacity:.35}100%{transform:scale(1.15);opacity:.7}}'+
    '@keyframes dshSp{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-7px);opacity:0}}'+
    '@media (prefers-reduced-motion:reduce){.dsh-fire *,.dsh-card.live .dsh-ico{animation:none!important}}'+
    '.dsh-card.live::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:2px;pointer-events:none;background:conic-gradient(var(--prod) calc(var(--p) * 1%),color-mix(in srgb,var(--line) 85%,transparent) 0);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}';
  document.head.appendChild(st);
}
var DSH_FIRE='<defs><linearGradient id="dshFG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7f1d1d"/><stop offset=".35" stop-color="#dc2626"/><stop offset=".7" stop-color="#f97316"/><stop offset="1" stop-color="#fde047"/></linearGradient></defs>'+
  '<ellipse class="fg" cx="12" cy="21.4" rx="6.5" ry="1.4" fill="#f97316" stroke="none"/>'+
  '<path class="f1" fill="url(#dshFG)" stroke="none" d="M12 1.6c.9 3.9 5.8 6.3 5.8 12a5.8 5.8 0 0 1-11.6 0c0-2.5 1.1-4.2 2.6-5.3.1 2.1 1.1 3.2 2.4 3.5C10.6 8.6 10.3 4.9 12 1.6z"/>'+
  '<path class="f2" fill="#ea580c" stroke="none" d="M6.6 9.2c-.5 2-1.8 3-1.8 4.9a2.2 2.2 0 0 0 4.4 0c0-1.1-.5-1.8-1-2.4-.5 1-1.1 1.3-1.6 1.4z"/>'+
  '<path class="f3" fill="#ea580c" stroke="none" d="M17.4 9.2c.5 2 1.8 3 1.8 4.9a2.2 2.2 0 0 1-4.4 0c0-1.1.5-1.8 1-2.4.5 1 1.1 1.3 1.6 1.4z"/>'+
  '<path class="f4" fill="#fef9c3" stroke="none" d="M12 10.6c.5 2.2 2.9 3.3 2.9 5.8a2.9 2.9 0 0 1-5.8 0c0-1.4.6-2.3 1.5-2.9.1 1 .6 1.7 1.3 1.9-.2-1.6 0-2.9.1-4.8z"/>'+
  '<circle class="sp s1" cx="9.6" cy="5" r=".6" fill="#fdba74" stroke="none"/>'+
  '<circle class="sp s2" cx="14.2" cy="4" r=".5" fill="#fde68a" stroke="none"/>'+
  '<circle class="sp s3" cx="12.2" cy="2.2" r=".4" fill="#fed7aa" stroke="none"/>';
function dshCard(x){
  var c=(x.k==='shopOrders'||x.k==='reserved')?'orders':x.k==='shopProducts'?'recipes':x.k==='fgstock'?'stock':x.k;
  var cd=!!(x.live&&x.k==='prod');
  var cls='dsh-card'+(cd?' live':'')+(x.warn?' warn':'')+((!cd&&!x.n)?' zero':'');
  var num=cd?'<span class="dsh-num hcdt">'+cdText()+'</span><i class="hcd" hidden></i>':'<span class="dsh-num">'+x.n+'</span>';
  var unit=cd?'قيد التشغيل':x.u;
  return '<button class="'+cls+'" style="--c:var(--'+c+');--p:'+(cd?pctOf(prodCountdown()):0)+'" data-act="tab" data-v="'+x.k+'">'+
    '<span class="dsh-ico">'+(cd?'<svg viewBox="0 0 24 24" class="dsh-fire" aria-hidden="true">'+DSH_FIRE+'</svg>':'<svg viewBox="0 0 24 24" aria-hidden="true">'+(DSH_IC[x.k]||IC[x.k]||'')+'</svg>')+'</span>'+
    '<span class="dsh-txt"><span class="dsh-name">'+x.l+'</span><span class="dsh-unit">'+unit+'</span></span>'+
    num+(x.warn?'<i class="dsh-dot"></i>':'')+
  '</button>';
}
function homeHTML(){
  dshCss();
  var st=navItems().filter(function(x){return !tabHidden(x.k)&&['verify','refresh','theme'].indexOf(x.k)<0;});
  var used={};
  var secs=DSH_SECS.map(function(sec){
    var items=sec.keys.map(function(k){used[k]=1;return st.filter(function(x){return x.k===k;})[0];}).filter(Boolean);
    return {t:sec.t,items:items};
  });
  var rest=st.filter(function(x){return !used[x.k];});
  if(rest.length)secs.push({t:'أخرى',items:rest});
  var out=secs.filter(function(sec){return sec.items.length;}).map(function(sec){
    var w=sec.items.filter(function(x){return x.warn;}).length;
    return '<section class="dsh-sec"><div class="dsh-h"><span>'+sec.t+'</span>'+(w?'<span class="dsh-w">'+w+' تحتاج متابعة</span>':'')+'</div>'+
      '<div class="dsh-grid">'+sec.items.map(dshCard).join('')+'</div></section>';
  }).join('');
  return '<div class="dsh" aria-label="الأقسام">'+out+'</div>';
}
/* عداد الإنتاج: الدايرة اللي حوالين الكارت والوقت بيتحدثوا كل ثانية */
if(!window.DSH_TICK){window.DSH_TICK=setInterval(function(){
  var c=document.querySelector('.dsh-card.live');
  if(!c)return;
  var b=prodCountdown();
  if(b)c.style.setProperty('--p',pctOf(b));
  var t=c.querySelector('.hcdt');
  if(t)t.textContent=cdText();
},1000);}
/* زرار الرجوع بيتعرض في صف تحت الهيدر */
function backHTML(){
  return '<div class="backrow"><button class="btn ghost sm ttlback" data-act="tab" data-v="home" aria-label="رجوع"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><span>رجوع</span></button></div>';
}
function navItems(){
  var by=function(st){return S.batches.filter(function(b){return b.stage===st;});};
  var low=MATERIALS.filter(isLow).length;
  var running=by('prod').some(function(b){return b.startedAt&&!timerDone(b);});
  var st=[
    {k:'orders',l:'أوردرات',n:openCount('cust'),u:'طلبية',g:'orders'},{k:'shopOrders',l:'أوردرات المحل',n:openCount('shop'),u:'طلبية',g:'orders'},{k:'reserved',l:'تحت التشغيل',n:reservedList().length,u:'طلبية',g:'orders',warn:reservedToday().length>0},
    {k:'prep',l:'تحضير',n:by('prep').length,u:'دفعة'},
    {k:'prod',l:'إنتاج',n:by('prod').length,u:'دفعة',live:running},
    {k:'stock',l:'مكوّنات',n:MATERIALS.length,u:'مكوّن'},
    {k:'fgstock',l:'مخزن الإنتاج',n:fgShortCount(),u:'ناقص',warn:fgShortCount()>0},
    {k:'tracking',l:'تتبع الصلاحية',n:trkAttn(),u:'صنف',warn:trkCounts(trkRows()).expired>0}
  ];
  st.push({k:'waste',l:'هالك',n:(S.waste||[]).length,u:'عملية'});st.push({k:'boxcomp',l:'تجميع علب',n:bcTotalBoxes(),u:'علبة'});
  st.push({k:'verify',l:'التحقق من البطاقة',n:usersList().length,u:'مستخدم'});
  st.push({k:'refresh',l:'زرار التحديث',n:0,u:''});
  st.push({k:'theme',l:'الوضع الليلي والنهاري',n:0,u:''});
  st.push({k:'filling',l:'تحضير حشو',n:PRODUCTS.filter(function(p){return isFill(p)&&!p.archived;}).length,u:'صنف'});
  st.push({k:'prepreq',l:'تحضيرات مطلوبة',n:prepReqIds().length,u:'صنف'});
  st.push({k:'recipes',l:'وصفات',n:prodsOf('cust').length,u:'وصفة',g:'recipes'});
  st.push({k:'shopProducts',l:'وصفات المحل',n:prodsOf('shop').length,u:'وصفة',g:'recipes'});
  st.splice(3,0,{k:'calendar',l:'التقويم',n:calUpcomingDays(),u:'يوم',g:'orders'});
  return st;
}
var GROUP_LABEL={orders:'الأوردرات',recipes:'الوصفات'};
function prodCountdown(){
  var r=S.batches.filter(function(b){return b.stage==='prod'&&b.startedAt&&!timerDone(b);});
  r.sort(function(a,b){return (dur(a)-elapsed(a))-(dur(b)-elapsed(b));});
  return r[0]||null;
}
function cdText(){var b=prodCountdown();return b?mmss(dur(b)-elapsed(b)):'0:00';}
function pctOf(b){return b?Math.min(100,Math.round(elapsed(b)/dur(b)*100)):0;}


function demoHTML(){
  return '<div class="demo"><span>الأصناف والأرقام الحالية تجريبية. امسحها وضيف أصنافك بتفاصيلها.</span><button class="btn ghost sm" data-act="cleanStart">'+(U.confirm==='clean'?'اضغط تاني للتأكيد':'امسح وابدأ بأصنافي')+'</button></div>';
}
/* العنوان بقى في هيدر الصفحة (في النص)، فهنا بنعرض الوصف والأزرار بس */
function head(t,sub,btn){
  return '<div class="sh"><div>'+(sub?'<p>'+sub+'</p>':'')+'</div>'+(btn||'')+'</div>';
}

/* total weight of ONE meal (sum of all ingredients per single meal); non-weight units listed separately */
function perMealHTML(p){
  var g=0,oth={},any=false;
  Object.keys(p.recipe||{}).forEach(function(k){
    var m=M(k),q=p.recipe[k];any=true;
    if(m.unit==='جرام'||m.unit==='غطا')g+=q;else if(m.unit==='كجم')g+=q*1000;
    else oth[m.unit]=r3((oth[m.unit]||0)+q);
  });
  if(!any)return '';
  g=r3(g);
  var parts=[];
  if(g>0)parts.push('<b>'+f(g)+' جرام</b>');
  Object.keys(oth).forEach(function(u){parts.push(f(oth[u])+' '+u);});
  return '<div class="livec" style="--c:var(--prep)">إجمالي الوزنة للوجبة الواحدة: '+parts.join(' + ')+'</div>';
}
function rowOpen(b,key){
  if(b.withdrawn)return '<div class="rq">';
  var on=(b.mchecks||[]).indexOf(key)>-1;
  return '<div class="rq matrow'+(on?' on':'')+'" data-act="toggleMat" data-id="'+b.id+'" data-k="'+key+'" role="checkbox" aria-checked="'+(on?'true':'false')+'">';
}
function matKeys(n,cn){return Object.keys(n).map(function(k){return 'm:'+k;}).concat(Object.keys(cn).map(function(k){return 'c:'+k;}));}
function prepCard(b){
  var p=P(b.p),n=need(b),sh=shortOf(b),shk={},cn=compNeed(b),cs=compShort(b),csk={};
  sh.forEach(function(s){shk[s.k]=s.lack;});
  cs.forEach(function(s){csk[s.k]=s.lack;});
  var crows=Object.keys(cn).map(function(k){
    var cp=P(k),have=S.ready[k]||0,st;
    if(b.withdrawn)st='<span class="pill ok">'+svg('check','mi')+' مسحوب</span>';
    else if(csk[k])st='<span class="pill bad">ينقص '+f(csk[k])+'</span>';
    else st='<span class="pill ok">متوفر</span>';
    return rowOpen(b,'c:'+k)+'<div><b>'+esc(cp.name)+'</b><small>وصفة جاهزة من مخزن الإنتاج'+(b.withdrawn?'':' · المتاح '+f(have)+' '+cp.unit)+'</small></div><span class="qv">'+f(cn[k])+' '+esc(cp.unit)+'</span>'+st+'</div>';
  }).join('');
  var rows=Object.keys(n).map(function(k){
    var m=M(k),have=S.stock[k]||0,st;
    if(b.withdrawn)st='<span class="pill ok">'+svg('check','mi')+' مسحوب</span>';
    else if(shk[k])st='<span class="pill bad">ينقص '+f(shk[k])+'</span>';
    else st=TRACK()?'<span class="pill ok">متوفر</span>':'';
    return rowOpen(b,'m:'+k)+'<div><b>'+esc(m.name)+'</b>'+(b.withdrawn||!TRACK()?'':'<small>المتاح '+f(have)+' '+esc(m.unit)+'</small>')+'</div><span class="qv">'+f(n[k])+' '+esc(m.unit)+'</span>'+st+'</div>';
  }).join('');
  var act='';
  if(!b.withdrawn){
    if(sh.length||cs.length){
      act='<div class="note">'+(sh.length?'ينقص '+sh.length+(sh.length>2?' أصناف':' صنف')+' من الخامات في المخزن. ':'')+
        (cs.length?'ينقص في مخزن الإنتاج: '+cs.map(function(x){var cp=P(x.k);return cp.name+' '+f(x.lack)+' '+cp.unit;}).join('، ')+'. اعمل دفعة منه الأول. ':'')+'</div>'+
        (sh.length?'<button class="btn block" data-act="goStock">افتح المخزن</button>':'')+(cs.length?'<button class="btn block" data-act="tab" data-v="fgstock">افتح مخزن الإنتاج</button>':'');
    }else{
      var mk=matKeys(n,cn),mdone=(b.mchecks||[]).filter(function(x){return mk.indexOf(x)>-1;}).length,allMat=mk.length>0&&mdone===mk.length;
      act=(allMat?'':'<div class="meta mhint">اتعلّم على كل خامة عشان الزرار يفتح ('+mdone+'/'+mk.length+')</div>')+
        '<button class="btn block" data-act="withdraw" data-id="'+b.id+'"'+(allMat?'':' disabled')+'>'+(TRACK()?'تم تحضير المقادير':'تم تحضير المقادير')+'</button>';
    }
  }else{
    var ck=b.checks||[],tot=prepItems(p,b.qty).length;
    act='<div class="prog"><span>خطوات التجهيز '+ck.length+'/'+tot+'</span><div class="bar"><i style="width:'+(ck.length/tot*100)+'%"></i></div></div>'+
      prepGroupsHTML(b)+
      '<button class="btn block" data-act="toProd" data-id="'+b.id+'"'+(ck.length<tot?' disabled':'')+'>حوّل للإنتاج</button>';
  }
  var fk='prep-'+b.id,isOpen=FOLD_OPEN[fk]===true;
  return '<details class="card ordfold prepfold" data-fk="'+fk+'"'+(isOpen?' open':'')+' style="--c:var(--prep)">'+
    '<summary class="bh"><div><span class="bid ltr">'+sid(b.id)+'</span><h3 class="bn">'+esc(p.name)+' · '+batchQ(b,p)+'</h3><span class="meta">أُنشئت '+ago(b.created)+(whoOf(b.by,b.byc)?' · عملها: '+esc(whoOf(b.by,b.byc)):'')+'</span>'+(b.o?'<div>'+otag(b)+'</div>':'')+'</div>'+
    '<span class="pill '+(b.withdrawn?'c':'low')+'">'+(b.withdrawn?'قيد التجهيز':'بانتظار السحب')+'</span></summary>'+
    '<div class="ordbody"><div>'+rows+crows+'</div>'+perMealHTML(p)+act+
    '<div class="foot"><span class="meta">'+(hasOven(p)?p.mins+' دقيقة تشغيل':'بدون فرن')+'</span><button class="btn quiet" data-act="cancel" data-id="'+b.id+'">'+(U.confirm===b.id?'اضغط تاني للتأكيد':'إلغاء الدفعة')+'</button></div></div></details>';
}
/* السعة المعتادة للصنف = أكبر دفعة اتعملت له قبل كده (من السجل والدفعات الحالية) */
function batchCapacity(pid){
  var mx=0;
  Object.keys(S.plog||{}).forEach(function(id){var e=S.plog[id];if(e&&e.p===pid&&e.qty>mx)mx=e.qty;});
  S.batches.forEach(function(b){if(b.p===pid&&b.qty>mx)mx=b.qty;});
  return mx;
}
/* اقتراح التجميع: المطلوب الناقص لكل صنف نهائي بالوجبات، ناقص الدفعات الموجودة، يتقسم على أقل عدد دفعات بالسعة المعتادة، والكمية موزعة بالتساوي */
function batchSuggestions(){
  var short={};
  fgShortRows().forEach(function(r){short[r.x.p]=r3((short[r.x.p]||0)+r.x.short);});
  var out=[];
  Object.keys(short).forEach(function(pid){
    var p=P(pid);if(!p||isFill(p))return;
    var meals=r3(short[pid]/yieldOf(pid)),pending=0;
    S.batches.forEach(function(b){if(b.p===pid)pending+=b.qty;});
    var lack=r3(meals-pending);
    if(lack<=0)return;
    var cap=batchCapacity(pid),n=cap>0?Math.ceil(lack/cap-1e-9):1,per=Math.ceil(lack/n*1000)/1000;
    out.push({pid:pid,p:p,meals:lack,cap:cap,n:n,per:per});
  });
  return out;
}
function batchSuggestHTML(){
  var sg=batchSuggestions();if(!sg.length)return '';
  var tot=sg.reduce(function(a,x){return a+x.n;},0);
  var rows=sg.map(function(x){
    var basis=x.cap>0?'السعة المعتادة '+f(x.cap)+' وجبة':'مفيش تاريخ سابق، دفعة واحدة';
    return '<div class="rq"><div><b>'+esc(x.p.name)+'</b><small>يلزم '+f(x.meals)+' وجبة · '+basis+'</small></div><span class="pill c">'+x.n+' × '+f(x.per)+' وجبة</span></div>';
  }).join('');
  return '<section class="card" style="--c:var(--prep)"><div><h3>اقتراح تجميع الدفعات</h3><p class="meta" style="margin:2px 0 0">أقل عدد دفعات يغطي النواقص الحالية، بعد ما نطرح اللي متعمل بالفعل.</p></div>'+rows+
    '<div class="btns"><button class="btn" data-act="batchSuggestApply">أنشئ '+tot+' '+(tot>1?'دفعات':'دفعة')+' مقترحة</button></div></section>';
}
function groupKeyOf(b){var p=P(b.p);return p&&p.group?unesc(p.group).trim():'';}
/* الدفعة جاهزة للسحب: مفيش نقص ومكوناتها كلها اتعلّمت */
function groupReady(b){
  if(!b||b.withdrawn||shortOf(b).length||compShort(b).length)return false;
  var mk=matKeys(need(b),compNeed(b));
  return mk.length>0&&(b.mchecks||[]).filter(function(x){return mk.indexOf(x)>-1;}).length===mk.length;
}
function renderPrepList(list){
  var out='',done={};
  list.forEach(function(b){
    var g=groupKeyOf(b);
    if(!g){out+=prepCard(b);return;}
    if(done[g])return;done[g]=1;
    out+=groupPrepCard(g,list.filter(function(x){return groupKeyOf(x)===g;}));
  });
  return out;
}
/* صف مادة في إجمالي المجموعة: الضغط عليه بيعلّم المادة دي في كل دفعات المجموعة اللي فيها */
function groupMatRow(items,key,name,qty,unit){
  var tg=items.filter(function(b){return !b.withdrawn&&matKeys(need(b),compNeed(b)).indexOf(key)>-1;});
  var on=tg.length>0&&tg.every(function(b){return (b.mchecks||[]).indexOf(key)>-1;});
  return '<div class="rq matrow'+(on?' on':'')+'" data-act="groupMat" data-k="'+key+'" data-ids="'+tg.map(function(b){return b.id;}).join(',')+'" role="checkbox" aria-checked="'+(on?'true':'false')+'" style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line)"><b>'+esc(name)+'</b><span class="qv">'+f(qty)+' '+esc(unit)+'</span></div>';
}
/* كارت واحد للمجموعة: إجمالي المواد، وزرار سحب للكل، والدفعات محفوظة كل واحدة لوحدها */
function groupPrepCard(g,items){
  var tot={},ctot={};
  items.forEach(function(b){
    var n=need(b),cn=compNeed(b);
    Object.keys(n).forEach(function(k){tot[k]=r3((tot[k]||0)+n[k]);});
    Object.keys(cn).forEach(function(k){ctot[k]=r3((ctot[k]||0)+cn[k]);});
  });
  var line=function(name,qty,unit){return '<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line)"><b>'+esc(name)+'</b><span class="qv">'+f(qty)+' '+esc(unit)+'</span></div>';};
  var rows=Object.keys(tot).map(function(k){var m=M(k);return groupMatRow(items,'m:'+k,m.name,tot[k],m.unit);}).join('')+
    Object.keys(ctot).map(function(k){var cp=P(k);return groupMatRow(items,'c:'+k,cp.name,ctot[k],cp.unit);}).join('');
  var ready=items.filter(function(b){return !b.withdrawn;});
  var canAll=ready.length>0&&ready.every(groupReady);
  var btn=ready.length?'<button class="btn block" data-act="groupWithdraw" data-ids="'+ready.map(function(b){return b.id;}).join(',')+'"'+(canAll?'':' disabled')+'>'+(TRACK()?'تم تحضير المقادير للمجموعة كلها':'تم تحضير المقادير للمجموعة كلها')+'</button>':'';
  return '<section class="card" style="--c:var(--prep)"><div class="bh"><div><h3 class="bn">'+esc(g)+'</h3><span class="meta">'+items.length+' أصناف في التحضير ده</span></div><span class="pill c">مجمّع</span></div>'+
    '<div class="grp">إجمالي المواد</div>'+rows+(btn?'<div style="margin:10px 0">'+btn+'</div>':'')+
    '<div class="grp">الأصناف</div><div class="list">'+items.map(prepCard).join('')+'</div></section>';
}
function prepView(){
  var shopTab=U.prepTab==='shop';
  var isShop=function(b){var p=P(b.p);return !!(p&&p.shop);};
  var list=S.batches.filter(function(b){return b.stage==='prep'&&isShop(b)===shopTab;});
  var seg='<div class="seg">'+
    '<button class="'+(shopTab?'':'on')+'" data-act="prepTabSet" data-v="cust">الأوردرات</button>'+
    '<button class="'+(shopTab?'on':'')+'" data-act="prepTabSet" data-v="shop">المحل</button></div>';
  var btn='<div class="btns">'+seg+'<button class="btn ghost sm" data-act="tab" data-v="prod">روح للإنتاج</button><button class="btn ghost sm" data-act="exportBatchMats">تصدير الخامات PDF</button><button class="btn" data-act="newBatch"'+(shopTab?' data-shop="1"':'')+'>'+svg('plus')+(shopTab?'دفعة للمحل':'دفعة جديدة')+'</button></div>';
  var body=list.length?'<div class="list">'+renderPrepList(list)+'</div>':
    '<div class="empty"><b>'+(shopTab?'مفيش دفعات للمحل':'مفيش دفعات في التحضير')+'</b><span>'+(shopTab?'الدفعات اللي للمحل بتظهر هنا.':'ابدأ دفعة جديدة والبرنامج يحسب لك المواد المطلوبة.')+'</span></div>';
  return head('تحضير','حدد الكمية، اسحب المواد، وخلّص خطوات التجهيز',btn)+(shopTab?'':batchSuggestHTML())+body;
}

var SEASONS=[['normal','عادي'],['ramadan','رمضان'],['mawlid','مولد النبي'],['christmas','الكريسماس'],['halloween','الهالوين']];
function seasonOf(p){return p.season||'normal';}
function rawSeason(){return U.season||'normal';}
function curSeason(){var v=rawSeason();return v==='boxes'?'normal':v;}
function inSeason(p){return seasonOf(p)===curSeason();}
function hiddenSeasons(){return pref('seasonsHidden',[]);}
/* أصناف مخفية عن المستخدمين في مخزن الإنتاج: المالك بس يشوفها */
function fgHiddenIds(){return pref('fgHidden',[]);}
function fgUserHidden(p){return !!p&&limited()&&fgHiddenIds().indexOf(p.id)>-1;}
/* الصنف المخفي (بعينة الإخفاء) بيتشال من كل الإجماليات، لكل الحسابات */
function fgIsHidden(p){return !!p&&fgHiddenIds().indexOf(p.id)>-1;}
function seasonHidden(k){return k!=='normal'&&hiddenSeasons().indexOf(k)>-1;}
function visibleSeasons(){return SEASONS.filter(function(x){return !seasonHidden(x[0]);});}
function screenKind(){return U.view==='shopOrders'?'shop':'cust';}
function ordSeason(){
  if(rawSeason()==='boxes'&&U.boxKind===screenKind())return 'boxes';
  return seasonHidden(curSeason())?'normal':curSeason();
}
function seasonSeg(current,act,list){
  return '<div class="seg wrap" style="margin:0 0 12px">'+(list||SEASONS).map(function(x){
    return '<button class="'+(current===x[0]?'on':'')+'" data-act="'+act+'" data-v="'+x[0]+'">'+x[1]+'</button>';
  }).join('')+'</div>';
}
function seasonSegHTML(){return seasonSeg(curSeason(),'setSeason');}
/* ---------- recipe picker: search + dropdown, only the chosen recipe is shown ---------- */
function rList(){return prodsOf(U.view==='shopProducts'?'shop':'cust').filter(inSeason);}
function rShown(list){var q=String(U.rsearch||'').trim().toLowerCase();return q?list.filter(function(p){return unesc(p.name).toLowerCase().indexOf(q)>-1;}):list;}
function rCur(shown){return shown.some(function(p){return p.id===U.rsel;})?U.rsel:'';}
function shortEditTxt(p){
  var t=p._u;
  if(!t||t<1e12)return 'تعديل غير معروف';
  var m=Math.round((Date.now()-t)/60000);
  if(m<60)return 'تعديل منذ '+Math.max(1,m)+' د';
  if(m<1440)return 'تعديل منذ '+Math.floor(m/60)+' س';
  return 'تعديل منذ '+Math.floor(m/1440)+' ي';
}
function rOptions(shown,sel){
  return '<option value="">'+(shown.length?'اختار وصفة...':'مفيش نتيجة')+'</option>'+shown.map(function(p){return '<option value="'+p.id+'"'+(p.id===sel?' selected':'')+'>'+esc(p.name)+' · '+shortEditTxt(p)+(p.ownerOnly?' · مخفية':'')+'</option>';}).join('');
}
function tempTxt(p){return (p.temp!==''&&p.temp!=null)?f(p.temp)+'°م':'';}
function compText(p,q){
  var c=(p.comps||[]).filter(function(x){return !P(x.p).missing;});
  if(!c.length)return '';
  return '<div class="livec" style="--c:var(--prep)">من مخزن الإنتاج: '+c.map(function(x){var cp=P(x.p);return cp.name+' '+f(r3(x.q*(q||1)))+' '+cp.unit;}).join(' · ')+'</div>';
}
/* زرار العين: يخفي الوصفة عن الموظفين (تفضل ظاهرة للمالك بس) */
function ownerEyeHTML(p){
  var hid=!!p.ownerOnly;
  return '<button class="btn ghost sm" data-act="toggleOwnerOnly" data-id="'+p.id+'" aria-pressed="'+(hid?'true':'false')+'" title="'+(hid?'إظهار للموظفين':'إخفاء عن الموظفين')+'">'+
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
    (hid?'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/>':'<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>')+
    '</svg><span>'+(hid?'مخفية':'ظاهرة')+'</span></button>';
}
function recipeCardHTML(p,q){
  var full=stagesText(p,'prep',q);
  var oven=hasOven(p);var meta=(oven?[p.mins+' دقيقة']:['بدون فرن']).concat(oven&&tempTxt(p)?['درجة الحرارة '+tempTxt(p)]:[]).join(' · ');
  return '<article class="card"><div class="bh"><div><h3 class="bn">'+esc(p.name)+'</h3><span class="meta">'+meta+'</span></div><button class="btn ghost sm" data-act="editProd" data-id="'+p.id+'">تعديل</button><button class="btn ghost sm" data-act="copyProd" data-id="'+p.id+'">نسخ</button>'+(limited()?'':ownerEyeHTML(p))+'</div>'+
    (p.ownerOnly&&!limited()?'<span class="pill low">مخفية عن الموظفين</span>':'')+'<div class="meta">'+lastEditTxt(p)+'</div>'+(p.notes?'<div class="meta">'+esc(p.notes)+'</div>':'')+compText(p,q)+(full||'<span class="meta">مفيش مراحل</span>')+'</article>';
}
function lastEditTxt(p){
  var t=p._u;
  if(!t||t<1e12)return 'آخر تعديل: غير معروف';
  var m=Math.round((Date.now()-t)/60000);
  var rel=m<1?'الآن':m<60?'منذ '+m+' دقيقة':m<1440?'منذ '+Math.floor(m/60)+' ساعة':'منذ '+Math.floor(m/1440)+' يوم';
  return 'آخر تعديل: '+rel+' · '+tstr(t);
}
function rCardInner(){
  var shown=rShown(rList()),sel=rCur(shown),p=PRODUCTS.filter(function(x){return x.id===sel;})[0];
  return p?recipeCardHTML(p,U.rqty||1):'<div class="empty"><b>اختار وصفة من القائمة</b><span>اكتب في خانة البحث أو اختار من القائمة، والوصفة بتظهر هنا لوحدها.</span></div>';
}
function rSearchUpdate(){
  var shown=rShown(rList());
  if(!shown.some(function(p){return p.id===U.rsel;}))U.rsel=shown.length===1?shown[0].id:'';
  var sel=document.getElementById('rsel'),card=document.getElementById('rcard');
  if(sel)sel.innerHTML=rOptions(shown,U.rsel);
  if(card)card.innerHTML=rCardInner();
}
function recipePanel(){
  var shown=rShown(rList()),sel=rCur(shown),q=U.rqty||1;
  var qrow='<div class="qrow"><span class="meta">المقادير لـ</span><div class="step"><button data-act="rQty" data-d="-1"'+(q<=1?' disabled':'')+' aria-label="أنقص">−</button><b>'+q+'</b><button data-act="rQty" data-d="1" aria-label="زوّد">+</button></div><span class="meta">وجبة</span>'+
    [1,10,20,50].map(function(n){return '<button class="chip'+(q===n?' on':'')+'" data-act="rSet" data-v="'+n+'">'+n+'</button>';}).join('')+'</div>';
  return seasonSegHTML()+
    '<div class="fld" style="margin-bottom:12px"><input id="rsq" data-rsq="1" type="search" placeholder="ابحث عن وصفة" value="'+esc(U.rsearch||'')+'" autocomplete="off" aria-label="بحث"><select id="rsel" data-rs="1" aria-label="اختار وصفة">'+rOptions(shown,sel)+'</select></div>'+
    qrow+'<div id="rcard" style="margin-top:12px">'+rCardInner()+'</div>';
}
/* ---------- طباعة وصفات محددة ---------- */
function rpState(){return U.rp||(U.rp={kind:'cust',sel:[],q:1,search:''});}
function rpAvail(){
  var s=rpState(),q=String(s.search||'').trim().toLowerCase();
  return prodsOf(s.kind).filter(function(p){return !q||unesc(p.name).toLowerCase().indexOf(q)>-1;});
}
function rpListHTML(){
  var s=rpState(),l=rpAvail();
  if(!l.length)return '<div class="meta">مفيش وصفات</div>';
  return '<div class="chk">'+l.map(function(p){
    var on=s.sel.indexOf(p.id)>-1,se=seasonOf(p);
    var sl=se==='normal'?'':' · '+((SEASONS.filter(function(x){return x[0]===se;})[0]||['',''])[1]);
    return '<button class="chip'+(on?' on':'')+'" data-act="rpToggle" data-p="'+p.id+'"><i>'+svg('check')+'</i>'+esc(unesc(p.name))+'<small class="meta">'+esc(sl)+'</small></button>';
  }).join('')+'</div>';
}
function rpSheetHTML(){
  if(!U.rp||!U.rp.open)return '';
  var s=U.rp,n=s.sel.length;
  return '<button class="back" data-act="rpClose" aria-label="إغلاق"></button><section class="sheet f" style="--c:var(--recipes)" role="dialog" aria-label="طباعة وصفات"><div class="sbody">'+
    '<h3>طباعة وصفات</h3><div class="meta">اختار الوصفات اللي عايز تطبعها، كل وصفة في صفحة منسقة لوحدها</div>'+
    '<div class="fld"><input data-rpq="1" type="search" placeholder="ابحث عن وصفة" value="'+esc(s.search||'')+'" autocomplete="off" aria-label="بحث"></div>'+
    '<div class="qrow"><span class="meta">المقادير لـ</span><input data-rpn="1" type="text" inputmode="decimal" value="'+esc(s.q)+'" aria-label="عدد الوجبات" style="width:70px;height:40px;text-align:center;border:1.5px solid var(--field);border-radius:10px;font:inherit;background:var(--surface);color:var(--ink)"><span class="meta">وجبة</span></div>'+
    '<div class="btns"><button class="btn ghost sm" data-act="rpAll">تحديد الكل</button><button class="btn ghost sm" data-act="rpNone">إلغاء التحديد</button></div>'+
    '<div id="rpList">'+rpListHTML()+'</div></div>'+
    '<div class="sfoot"><button class="btn main" data-act="rpPrint"'+(n?'':' disabled')+'>طباعة '+(n?'('+n+')':'')+'</button><button class="btn ghost" data-act="rpClose">إلغاء</button></div></section>';
}
function recipePrintHTML(list,qty){
  var H=function(x){return esc(unesc(x));};
  var date=tstr(Date.now()).slice(0,10);
  var css='<style>'+
    '#printArea{display:block!important;min-height:0!important;justify-content:flex-start!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    '.rpg{break-after:page;page-break-after:always;font-size:14px;line-height:1.5}'+
    '.rpg:last-child{break-after:auto;page-break-after:auto}'+
    '.rph{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;border-bottom:3px solid #293394;padding-bottom:8px;margin-bottom:10px}'+
    '.rpt{font-family:var(--f-disp);font-size:30px;font-weight:700;color:#1B2370;line-height:1.2}'+
    '.rpc{font-size:12px;color:#555;white-space:nowrap}'+
    '.rpchips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}'+
    '.rpchip{border:1px solid #b9c0d8;border-radius:99px;padding:3px 13px;font-size:13px;font-weight:600;background:#eef0fb;color:#1B2370}'+
    '.rpst{margin:12px 0;border:1px solid #cfd6dd;border-radius:10px;overflow:hidden;break-inside:avoid;page-break-inside:avoid}'+
    '.rpsh{background:#293394;color:#fff;padding:6px 14px;font-weight:700;font-size:15px}'+
    '.rpi{width:100%;border-collapse:collapse}'+
    '.rpi td{padding:6px 14px;border-top:1px solid #e3e7ec}'+
    '.rpi tr:first-child td{border-top:0}'+
    '.rpi tr:nth-child(even) td{background:#f6f7fb}'+
    '.rpi td.q{text-align:end;white-space:nowrap;font-weight:700;width:1%}'+
    '.rps{margin:0;padding:8px 34px 10px 14px;border-top:1px dashed #cfd6dd}'+
    '.rps li{margin:3px 0}'+
    '.rpn{margin-top:10px;padding:8px 12px;border-right:4px solid #B45309;background:#fff7ec;border-radius:6px;font-size:13px}'+
    '.rpf{margin-top:14px;font-size:11px;color:#777;text-align:center}'+
    '</style>';
  return css+list.map(function(p){
    var out=r3(qty*yieldOf(p.id));
    var oven=hasOven(p);var chips=oven?['وقت التشغيل: '+f(p.mins)+' دقيقة']:['بدون فرن'];
    if(oven&&tempTxt(p))chips.push('درجة الحرارة: '+tempTxt(p));
    chips.push('المقادير لـ '+f(qty)+' وجبة');
    chips.push('الناتج: '+f(out)+' '+H(p.unit||'قطعة'));
    var stages=(p.stages||[]).filter(function(g){return g.kind==='prep';}).map(function(g,gi){
      var ings=(g.ings||[]).map(function(i){var m=M(i.m);return m?'<tr><td>'+H(m.name)+'</td><td class="q">'+f(r3((i.dq!=null?i.dq:i.q)*qty))+' '+H(i.du||m.unit)+'</td></tr>':'';}).join('');
      var steps=(g.steps||[]).filter(Boolean).map(function(t){return '<li>'+H(t)+'</li>';}).join('');
      if(!ings&&!steps)return '';
      return '<div class="rpst"><div class="rpsh">'+(gi+1)+'. '+H(g.name||'')+'</div>'+(ings?'<table class="rpi">'+ings+'</table>':'')+(steps?'<ol class="rps">'+steps+'</ol>':'')+'</div>';
    }).join('');
    var comps=(p.comps||[]).filter(function(c){return !P(c.p).missing;});
    var compH=comps.length?'<div class="rpst"><div class="rpsh">من مخزن الإنتاج</div><table class="rpi">'+comps.map(function(c){var cp=P(c.p);return '<tr><td>'+H(cp.name)+'</td><td class="q">'+f(r3(c.q*qty))+' '+H(cp.unit)+'</td></tr>';}).join('')+'</table></div>':'';
    return '<section class="rpg"><div class="rph"><div class="rpt">'+H(p.name)+'</div><div class="rpc">'+esc(p.code||'')+'</div></div>'+
      '<div class="rpchips">'+chips.map(function(c){return '<span class="rpchip">'+c+'</span>';}).join('')+'</div>'+
      (stages||'<div class="meta">مفيش مراحل مسجلة</div>')+compH+
      (p.notes?'<div class="rpn"><b>ملاحظات:</b> '+H(p.notes)+'</div>':'')+
      '<div class="rpf">RMY Pro · '+date+'</div></section>';
  }).join('');
}
document.addEventListener('input',function(e){
  var t=e.target,d=t&&t.dataset;if(!d||!U.rp)return;
  if(d.rpq!==undefined){U.rp.search=t.value;var el=document.getElementById('rpList');if(el)el.innerHTML=rpListHTML();}
  else if(d.rpn!==undefined){var v=num(t.value);U.rp.q=(isFinite(v)&&v>0)?Math.min(999,r3(v)):1;}
});
function recipesView(){
  var kind=U.view==='shopProducts'?'shop':'cust';
  var btn='<div class="btns"><button class="btn" data-act="newProd">'+svg('plus')+'وصفة جديدة</button><button class="btn ghost sm" data-act="recExport" data-k="'+kind+'">تصدير</button><button class="btn ghost sm" data-act="recImport" data-k="'+kind+'">استيراد</button><button class="btn ghost sm" data-act="rpOpen" data-k="'+kind+'">طباعة وصفات</button></div>';
  if(!prodsOf('cust').length)return head('وصفات','اختار وصفة وشوف مراحلها ومقاديرها',btn)+'<div class="empty"><b>مفيش وصفات</b><span>ضيف وصفة من الزرار اللي فوق.</span><button class="btn" data-act="newProd">'+svg('plus')+'وصفة جديدة</button></div>';
  return head('وصفات','اختار وصفة وهتظهر لك بس',btn)+recipePanel();
}
function expPill(m){
  if(!m.exp)return '';
  var d=Math.ceil((new Date(m.exp+'T23:59:59')-Date.now())/86400000);
  if(isNaN(d))return '';
  if(d<0)return '<span class="pill bad">منتهي الصلاحية</span>';
  if(d<=7)return '<span class="pill low">ينتهي خلال '+d+' يوم</span>';
  return '';
}
var RING=2*Math.PI*30;

function flameHTML(lit){return '<svg class="flame'+(lit?' lit':'')+'" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.6 3.4 5 6 5 11.2A5 5 0 0 1 7 13.2c0-3.2 2-4.9 2.6-7.6 1 1.5 1.5 2.7 1.6 4 1.2-1.8 1.4-4.5.8-7.6z"/></svg>';}
function prodCard(b){
  var p=P(b.p),run=!!b.startedAt,fin=timerDone(b),pct=run?elapsed(b)/dur(b):0;
  var tt=hasOven(p)?tempTxt(p):'';
  var info='<div class="meta" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px">'+
    (tt?'<span class="tempchip">'+flameHTML(run&&!fin)+'<span>'+esc(tt)+'</span></span>':'')+
    (whoOf(b.by,b.byc)?'<span>عملها: '+esc(whoOf(b.by,b.byc))+'</span>':'')+'</div>';
  var label=fin?svg('check'):(run?mmss(dur(b)-elapsed(b)):(hasOven(p)?p.mins+' د':'—'));
  var state=fin?'<span class="pill ok">'+(hasOven(p)?'انتهى الوقت':'جاهزة للاعتماد')+'</span>':(run?'<span class="pill c">في الفرن</span>':'<span class="pill">بانتظار البدء</span>');
  var act;
  if(fin)act=canApprove()?approveBox(b,p):'<div class="meta">خلص الوقت · الاعتماد عند المسؤول</div>';
  else if(run)act='<button class="btn ghost sm" data-act="skipTimer" data-id="'+b.id+'">أنهِ المؤقت الآن</button>';
  else {
    var ckp=b.checks||[],totp=prepItems(p,b.qty).length,stepsOk=ckp.length>=totp;
    act='<div class="prog"><span>خطوات التجهيز '+ckp.length+'/'+totp+'</span><div class="bar"><i style="width:'+(ckp.length/totp*100)+'%"></i></div></div>'+
      prepGroupsHTML(b)+
      '<button class="btn block" data-act="startRun" data-id="'+b.id+'"'+(stepsOk?'':' disabled')+'>ابدأ التشغيل · '+p.mins+' دقيقة</button>';
  }
  return '<article class="card"><div class="prow"><div class="ring" data-ring="'+b.id+'" data-fin="'+(fin?1:0)+'">'+
    '<svg viewBox="0 0 76 76"><circle cx="38" cy="38" r="30" fill="none" stroke="var(--line)" stroke-width="7"/><circle class="rp" cx="38" cy="38" r="30" fill="none" stroke="'+(fin?'var(--good)':'var(--c)')+'" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+RING+'" stroke-dashoffset="'+(RING*(1-pct))+'"/></svg><b class="rt">'+label+'</b></div>'+
    '<div class="pinfo"><span class="bid ltr">'+sid(b.id)+'</span><h3 class="bn">'+esc(p.name)+'</h3>'+info+'<div class="meta">'+batchQ(b,p)+'</div>'+(b.o?otag(b):'')+'<div style="margin-top:4px">'+state+'</div></div></div>'+act+'</article>';
}
function prodView(){return prodBoard()+prodLogHTML('batch');}
function prodBoard(){
  var all=S.batches.filter(function(b){return b.stage==='prod';});
  var ready=all.filter(timerDone),running=all.filter(function(b){return b.startedAt&&!timerDone(b);}),queued=all.filter(function(b){return !b.startedAt&&!timerDone(b);});
  var out=head('إنتاج','شغّل الدفعات وتابع المؤقت لحد ما تخلص','<button class="btn ghost sm" data-act="tab" data-v="prep">روح للتحضير</button><button class="btn ghost sm" data-act="testAlarm">جرّب الصوت</button>');
  if(!all.length)return out+'<div class="empty"><b>مفيش حاجة على الخط</b><span>الدفعات اللي تخلص تجهيزها بتظهر هنا.</span><button class="btn ghost" data-act="tab" data-v="prep">روح للتحضير</button></div>';
  function grp(t,a){return a.length?'<div class="grp">'+t+' ('+a.length+')</div><div class="list">'+a.map(prodCard).join('')+'</div>':'';}
  return out+'<div class="list">'+grp('انتهى وقتها',ready)+grp('في الفرن الآن',running)+grp('بانتظار البدء',queued)+'</div>';
}

/* ---------- سجل إنتاج الأصناف: كل صنف معتمد بكود التشغيل واسمه. الشهر بيتقفل مع الأرشفة ---------- */
function plRows(mode){
  var rows=[],seen={};
  archEntries().forEach(function(a){(a.done||[]).forEach(function(d){if(!seen[d.id]){seen[d.id]=1;rows.push({d:d,closed:true});}});});
  (S.done||[]).forEach(function(d){if(!seen[d.id]){seen[d.id]=1;rows.push({d:d,closed:false});}});
  /* إنتاج الحشو: كل تشغيل حشو بيتسجل بكود الصنف المحشو */
  PRODUCTS.forEach(function(p){if(!p.fill||!Array.isArray(p.fillRuns))return;p.fillRuns.forEach(function(r){var at=r.at||0;rows.push({d:{id:null,fill:true,p:p.id,code:p.code||'',name:p.name,unit:p.unit,good:r.out,qty:r.out,at:at,from:r.from||[]},closed:monthKey(at)<monthKey(Date.now())});});});
  if(mode==='fill')return rows.filter(function(r){return r.d.fill;});
  if(mode==='batch')return rows.filter(function(r){return !r.d.fill;});
  return rows;
}
function plInfo(d){var p=P(d.p);return {code:d.fill?(d.code||'—'):(sid(d.id)||'—'),pcode:d.fill?'':(d.code||(p&&p.code)||''),name:d.name||(p&&p.name)||'صنف محذوف',unit:d.unit||(p&&p.unit)||'',qty:d.good!=null?d.good:d.qty};}
/* اسم الشخص من الكود لو متاح، وإلا الاسم المحفوظ، ولو المحفوظ كود بيترجم لاسم */
/* للمالك: الكود + الاسم. لغير المالك: الاسم بس (الكود سرّي) */

function whoOf(n,c){
  if(c==='CHEF MYF'||n==='CHEF MYF')return 'المالك';
  if(c){var u=userByCode(c);if(u&&u.name)return u.name;}
  if(n&&userByCode(n)){var u2=userByCode(n);return u2&&u2.name?u2.name:n;}
  return n||'';
}
/* كود اللي اعتمد: كود المستخدم، والمالك كوده (CHEF MYF)، ولو السجل قديم بيتحول من الاسم للكود */
function codeOf(n,c){
  if(c)return c;
  if(n==='المالك'||n==='CHEF MYF')return 'CHEF MYF';
  var u=usersList().filter(function(x){return x.name===n;})[0];
  return u?u.code:(n||'');
}
function plLine(r){
  var base=plLineBase(r);
  if(r.d.fill||!r.d.id||!(S.plog&&S.plog[r.d.id]))return base;
  return '<details class="bfold"><summary>'+base+'</summary>'+batchOpsHTML(r.d.id)+'</details>';
}
function plLineBase(r){var i=plInfo(r.d);return '<div class="hist"><span><span class="ltr">'+esc(i.code)+'</span> · '+esc(i.name)+'<br><span class="meta">'+esc(monthKey(r.d.at||0)+(r.d.fill?' · حشو · من: '+(r.d.from||[]).map(function(x){var pp=P(x.p);return pp?pp.name:'';}).filter(Boolean).join('، '):' · تشغيل'))+'</span>'+(whoOf(r.d.by,r.d.byc)?'<br><span class="meta">عملها: '+esc(whoOf(r.d.by,r.d.byc))+'</span>':'')+(limited()?(whoOf(r.d.ap,r.d.apc)?'<br><span class="meta">اعتمدها: '+esc(whoOf(r.d.ap,r.d.apc))+'</span>':''):(codeOf(r.d.ap,r.d.apc)?'<br><span class="meta">اعتمدها: <span class="ltr">'+esc(codeOf(r.d.ap,r.d.apc))+'</span></span>':''))+'</span><span class="meta" style="text-align:end">'+f(i.qty)+' '+esc(i.unit)+'<br>'+tstr(r.d.at)+'</span></div>';}
function plSearchHTML(mode){
  var q=String(U.plq||'').toLowerCase().replace(/[\s-]/g,'');
  if(!q)return '';
  var key=function(x){return String(x||'').toLowerCase().replace(/[\s-]/g,'');};
  var hits=plRows(mode).filter(function(r){var i=plInfo(r.d);return key(i.code).indexOf(q)>-1||key(i.pcode).indexOf(q)>-1||key(i.name).indexOf(q)>-1;})
    .sort(function(a,b){return (b.d.at||0)-(a.d.at||0);});
  return '<div class="grp">نتايج البحث ('+hits.length+')</div>'+(hits.length?'<div class="card">'+hits.slice(0,60).map(plLine).join('')+'</div>':'<div class="meta">مفيش نتايج</div>');
}
function prodLogHTML(mode){
  var cur=monthKey(Date.now()),months={};
  plRows(mode).forEach(function(r){var k=monthKey(r.d.at||0);var m=months[k]=months[k]||{open:0,list:[]};m.list.push(r);if(!r.closed)m.open++;});
  var keys=Object.keys(months).sort().reverse();
  var body=!keys.length?'<div class="empty"><b>السجل فاضي</b><span>كل صنف يتعتمد في الإنتاج بيتسجل هنا بكود التشغيل واسمه.</span></div>':keys.map(function(k){
    var m=months[k],list=m.list.slice().sort(function(a,b){return (b.d.at||0)-(a.d.at||0);});
    var locked=m.open===0;
    var isOpen=FOLD_OPEN['plog-'+k]!==undefined?FOLD_OPEN['plog-'+k]===true:k===cur;
    return '<details class="card arch" data-fk="plog-'+k+'" style="margin-top:10px;--c:var(--prod)"'+(isOpen?' open':'')+'><summary class="bh"><div><h3 class="bn">'+k+'</h3><span class="meta">'+list.length+' صنف معتمد</span></div><span class="pill '+(locked?'ok':'low')+'">'+(locked?'مقفول':'مفتوح')+'</span></summary>'+list.map(plLine).join('')+'</details>';
  }).join('');
  return FOLD_CSS+'<div class="grp" style="margin-top:22px">'+(mode==='fill'?'سجل إنتاج الحشو':'سجل إنتاج الدفعات')+'</div>'+
    '<input type="text" data-plq="'+(mode==='fill'?'fill':'batch')+'" value="'+esc(U.plq||'')+'" placeholder="'+(mode==='fill'?'ابحث بكود الحشو أو اسم الصنف':'ابحث بكود التشغيل أو اسم الصنف')+'" aria-label="بحث في سجل الإنتاج" style="width:100%;margin:6px 0 4px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);font:inherit">'+
    '<div id="plqRes">'+plSearchHTML(mode)+'</div>'+body;
}
document.addEventListener('input',function(e){var t=e.target;if(t&&t.dataset&&t.dataset.plq!==undefined){U.plq=t.value;var el=document.getElementById('plqRes');if(el)el.innerHTML=plSearchHTML(t.dataset.plq==='fill'?'fill':'batch');}});

function stockView(){
  if(!TRACK()){
    var catalog=MATERIALS.map(function(m){return '<div class="mrow"><div class="mtop"><div><b>'+esc(m.name)+'</b><small>'+esc(m.cat||'مكوّن')+' · وحدة القياس '+esc(m.unit||'')+'</small></div></div><div class="mfoot"><span class="meta">مكوّن وصفات وتحضيرات · السحب مفتوح</span><span class="acts"><button class="btn ghost sm" data-act="editMat" data-id="'+m.id+'">تعديل</button></span></div></div>';}).join('');
    return head('مكوّنات التحضير','تعريف المكوّنات المستخدمة في الوصفات فقط · بدون أرصدة أو حدود سحب','<button class="btn" data-act="newMat">'+svg('plus')+'مكوّن جديد</button>')+'<div class="card">'+(catalog||'<div class="empty"><b>مفيش مكوّنات</b><span>أضف المكوّنات المستخدمة في الوصفات.</span></div>')+'</div>';
  }
  var low=MATERIALS.filter(isLow).length;
  var resList=MATERIALS.filter(function(m){return reserved(m.id)>0;});
  var list=MATERIALS.filter(function(m){
    if(U.filter==='low')return isLow(m);
    if(U.filter==='res')return reserved(m.id)>0;
    return true;
  });
  var seg='<div class="seg" role="group" aria-label="تصفية">'+[['all','الكل'],['low','ناقص ('+low+')'],['res','محجوز ('+resList.length+')']].map(function(x){
    return '<button class="'+(U.filter===x[0]?'on':'')+'" data-act="filter" data-v="'+x[0]+'">'+x[1]+'</button>';
  }).join('')+'</div>';
  var rows=list.map(function(m){
    var q=S.stock[m.id]||0,res=reserved(m.id),pct=Math.min(1,q/(m.min*3))*100;
    var cls=q<=0?'bad':(q<m.min?'low':'');
    var pill=q<=0?'<span class="pill bad">نافد</span>':(res>q?'<span class="pill bad">لا يكفي الدفعات المنتظرة</span>':(q<m.min?'<span class="pill low">ناقص · الحد '+f(m.min)+'</span>':'<span class="pill ok">كافٍ</span>'));
    var rc=U.recv&&U.recv.id===m.id?'<div class="recv"><input id="recvIn" type="text" inputmode="decimal" placeholder="'+(U.recv.mode==='add'?'الكمية المستلمة':'الكمية الفعلية')+'" aria-label="الكمية"><span class="meta">'+esc(m.unit)+'</span><button class="btn sm" data-act="recvOk">'+(U.recv.mode==='add'?'أضف':'احفظ')+'</button><button class="btn ghost sm" data-act="recvClose">إلغاء</button></div>':'';
    return '<div class="mrow"><div class="mtop"><div><b>'+esc(m.name)+'</b><small>'+esc(m.cat)+' · '+(m.storage||'مخزن جاف')+(res>0?' · محجوز '+f(res):'')+'</small>'+(m.supplier?'<small>المورد: '+esc(m.supplier)+'</small>':'')+(m.exp?'<small>الصلاحية: '+m.exp+'</small>':'')+(m.notes?'<small>'+esc(m.notes)+'</small>':'')+'</div><div class="mq"><b>'+f(q)+'</b> <span>'+esc(m.unit)+'</span></div></div>'+
      '<div class="lvl"><i class="'+cls+'" style="width:'+pct+'%"></i></div>'+
      '<div class="mfoot"><span style="display:flex;gap:6px;flex-wrap:wrap">'+pill+expPill(m)+'</span><span class="acts"><button class="btn ghost sm" data-act="recv" data-id="'+m.id+'" data-m="add">استلام</button><button class="btn ghost sm" data-act="recv" data-id="'+m.id+'" data-m="set">جرد</button><button class="btn ghost sm" data-act="editMat" data-id="'+m.id+'">تعديل</button></span></div>'+rc+'</div>';
  }).join('');
  return head('مخزن الخامات','المواد الخام، الاستلام، والجرد','<button class="btn" data-act="newMat">'+svg('plus')+'صنف جديد</button>')+
    '<div class="sum"><div class="tile"><b>'+MATERIALS.length+'</b><span>صنف</span></div><div class="tile"><b style="color:'+(low?'var(--warn)':'inherit')+'">'+low+'</b><span>ناقص</span></div><div class="tile"><b>'+resList.length+'</b><span>محجوز للتحضير</span></div></div>'+
    '<div style="margin:12px 0">'+seg+'</div>'+
    '<div class="card">'+(rows||(MATERIALS.length?'<div class="meta">مفيش أصناف في الفلتر ده.</div>':'<div class="empty"><b>المخزن فاضي</b><span>ضيف أول صنف بكل تفاصيله: الحد الأدنى، مكان التخزين، المورد، والصلاحية.</span><button class="btn" data-act="newMat">'+svg('plus')+'صنف جديد</button></div>'))+'</div>';
}

function yieldOf(pid){var p=P(pid);return p&&p.yield>0?p.yield:1;}
function pieceQ(qty,p){return f(qty)+' '+(p?p.unit:'');}
function totUnitsTxt(items){var m={},ord=[];items.forEach(function(x){var u=P(x.p).unit||'';if(!(u in m)){m[u]=0;ord.push(u);}m[u]=r3(m[u]+x.qty);});return ord.map(function(u){return f(m[u])+' '+u;}).join(' · ');}
function pc(b){return b.qty*yieldOf(b.p);}
function stkQty(b){return b.stk==null?pc(b)-(b.rej||0):b.stk;}
function approveBox(b,p){
  var total=pc(b),rej=b.rej||0,good=total-rej;
  return '<div class="foot"><div><b style="font-size:14px;white-space:nowrap">مرفوض (هالك)</b></div><input type="text" inputmode="numeric" data-rej="'+b.id+'" value="'+rej+'" aria-label="المرفوض" style="width:110px;flex:none"></div>'+
    '<div class="foot"><div><b style="font-size:14px;white-space:nowrap">يدخل مخزن الإنتاج</b></div><input type="text" inputmode="numeric" data-stk="'+b.id+'" value="'+stkQty(b)+'" aria-label="الكمية اللي تدخل مخزن الإنتاج" style="width:110px;flex:none"></div>'+
    '<div class="foot"><div><b style="font-size:14px;white-space:nowrap">تاريخ الصلاحية</b>'+(p.shelf?'<div class="meta">حسب الصنف: '+esc(unesc(p.shelf))+'</div>':'<div class="meta">الصنف مالوش مدة صلاحية، اكتب التاريخ يدوي</div>')+'</div><input type="date" data-exp="'+b.id+'" value="'+esc(b.exp!=null?b.exp:defExp(p))+'" aria-label="تاريخ الصلاحية" style="width:150px;flex:none"></div>'+'<button class="btn block" data-act="approve" data-id="'+b.id+'">اعتمد '+f(good)+' '+esc(p.unit)+' · '+f(stkQty(b))+' للمخزن</button>';
}
/* ---------- finished stock (مخزن الإنتاج) ---------- */
function ordShort(o){
  return o.items.map(function(it){
    var fs=(o.isBox&&!o.deliveredAt)?Math.min(it.qty,S.ready[it.p]||0):(it.fs||0),have=fs+(it.got||0);
    /* الدفعات الوسيطة لا تغطي الأوردر؛ التغطية من المنتج النهائي الخارج من حشو فقط */
    return {p:it.p,qty:it.qty,fs:fs,have:have,pend:0,unw:0,short:Math.max(0,r3(it.qty-have))};
  });
}
function ordComplete(o){return ordShort(o).every(function(x){return x.have>=x.qty;});}
function ordRemain(o){
  return ordShort(o).filter(function(x){return x.qty-x.have>0;}).map(function(x){return {p:x.p,qty:x.qty-x.have};});
}
function fgReserved(pid){
  var n=0;
  S.orders.forEach(function(o){
    if(o.deliveredAt)return;
    (o.items||[]).forEach(function(it){if(it.p===pid)n+=(it.fs||0)+(it.got||0);});
  });
  return r3(n);
}
function fgShortRows(){
  var out=[];
  S.orders.forEach(function(o){
    if(o.deliveredAt)return;
    ordShort(o).forEach(function(x){if(x.short>0&&!fgUserHidden(P(x.p)))out.push({o:o,x:x});});
  });
  return out;
}
function fgShortCount(){return fgShortRows().length;}
/* النواقص بتتجمع على الصنف: كل صنف في كارت واحد، والأوردرات اللي فيه بتتذكر تحته */
function shortByProduct(rows){
  var g={},ord=[];
  rows.forEach(function(r){
    var k=r.x.p;
    if(!g[k]){g[k]={p:k,qty:0,have:0,short:0,pend:0,ords:[]};ord.push(k);}
    var a=g[k];a.qty+=r.x.qty||0;a.have+=r.x.have||0;a.short+=r.x.short||0;a.pend+=r.x.pend||0;
    if(a.ords.indexOf(r.o.id)<0)a.ords.push(r.o.id);
  });
  return ord.map(function(k){return g[k];});
}
/* فلتر المواسم لمخزن الإنتاج، وهو مستقل عن موسم الأوردرات */
function fgSeasonOK(p){if(fgUserHidden(p))return false;var v=U.fgSeason||'all';return v==='all'||seasonOf(p)===v;}
function fgSeasonRow(){
  var cur=U.fgSeason||'all';
  return '<div class="seg" style="margin-top:6px" role="group" aria-label="المواسم">'+
    [['all','كل المواسم']].concat(visibleSeasons()).map(function(x){return '<button class="'+(cur===x[0]?'on':'')+'" data-act="fgSeason" data-v="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>';
}

/* which production batches (meals) the stock of a product came from, and how many pieces are left from each (oldest consumed first) */
function fgLots(pid){
  var pp=PRODUCTS.filter(function(x){return x.id===pid;})[0];
  if(pp&&isFill(pp)){var rr=S.ready[pid]||0;return rr>0?[{id:pp.code||'',q:rr}]:[];}
  var R=S.ready[pid]||0,T=0;
  var L=S.done.filter(function(d){return d.p===pid&&!d.zeroed;}).sort(function(a,b){return (a.at||0)-(b.at||0);}).map(function(d){
    var q=d.toStk!=null?d.toStk:(d.o?0:(d.stk!=null?d.stk:d.good));
    return {id:d.id,q:q||0,exp:d.exp||''};
  }).filter(function(l){return l.q>0;});
  L.forEach(function(l){T=r3(T+l.q);});
  var cons=Math.max(0,r3(T-R));
  L.forEach(function(l){var t=Math.min(l.q,cons);l.q=r3(l.q-t);cons=r3(cons-t);});
  var out=L.filter(function(l){return l.q>0;});
  var extra=r3(R-T);
  if(extra>0)out.unshift({id:'',q:extra});
  return out;
}
/* بادج الصلاحية للدفعة: منتهية، أو بتنتهي النهارده، أو خلال يومين. لو بعيدة بيكتب التاريخ بس */
function lotExpPill(exp){
  var d=expDays(exp);if(d==null)return '';
  if(d<0)return '<span class="pill bad">منتهية الصلاحية</span> ';
  if(d===0)return '<span class="pill low">تنتهي النهارده</span> ';
  if(d<=2)return '<span class="pill low">تنتهي خلال '+d+' يوم</span> ';
  return '<span class="meta">تنتهي '+esc(exp)+'</span> ';
}
/* الكمية المنتهية والكمية اللي قربت تنتهي لصنف معين */
function expiryTotals(pid){
  var out={expired:0,soon:0};
  var pp=P(pid);
  var lots=(pp&&isFill(pp))?fillRunLots(pp).filter(function(l){return l.tracked;}):fgLots(pid);
  lots.forEach(function(l){var d=expDays(l.exp);if(d==null)return;if(d<0)out.expired=r3(out.expired+l.q);else if(d<=2)out.soon=r3(out.soon+l.q);});
  return out;
}
function expiryWarnHTML(p){
  var t=expiryTotals(p.id),o='';
  if(t.expired>0)o+='<div class="meta"><span class="pill bad">منتهي الصلاحية: '+f(t.expired)+' '+esc(p.unit)+'</span></div>';
  if(t.soon>0)o+='<div class="meta"><span class="pill low">قرب ينتهي: '+f(t.soon)+' '+esc(p.unit)+'</span></div>';
  return o;
}
/* عدد الأصناف اللي فيها دفعات منتهية أو قربت تنتهي (للتنبيه في تبويب مخزن الإنتاج) */
function expiryCountNow(){
  var n=0;PRODUCTS.forEach(function(p){if(p.archived)return;var t=expiryTotals(p.id);if(t.expired>0||t.soon>0)n++;});
  return n;
}
/* ===== تتبع الصلاحية: كل مخزون الإنتاج، مقسم حسب المكان وحالة الصلاحية ===== */
var TRK_ORDER={expired:0,soon:1,nodate:2,untracked:3,check:4,ok:5};
var TRK_LABEL={expired:'منتهية',soon:'قربت تنتهي',nodate:'محتاجة تاريخ',untracked:'مش متتبعة بدفعة',check:'محتاجة تأكيد',ok:'متأكدة'};
var TRK_COLOR={expired:'#dc2626',soon:'#d97706',nodate:'#64748b',untracked:'#8b5cf6',check:'#4f5dff',ok:'#16a34a'};
var TRK_PILL={expired:'bad',soon:'low',nodate:'',untracked:'',check:'c',ok:'ok'};
/* كل كمية موجودة في مخزن الإنتاج، ولكل واحدة حالتها.
   - دفعة معتمدة ليها سجل: بتتتبع بتاريخ الصلاحية (منتهية / قربت / محتاجة تاريخ / محتاجة تأكيد / متأكدة)
   - رصيد قديم من غير دفعة، أو حشو: مش متتبعة بالدفعة */
/* تشغيلات الحشو: كل تشغيلة ليها تاريخ صلاحية، والكمية المتبقية بتتوزع زي الدفعات (الأقدم بيتسحب الأول) */
function fillRunLots(p){
  var runs=Array.isArray(p.fillRuns)?p.fillRuns:[],R=S.ready[p.id]||0,T=0,out=[];
  runs.forEach(function(r){T=r3(T+(Number(r.out)||0));});
  var cons=Math.max(0,r3(T-R));
  runs.forEach(function(r,i){
    var o=Number(r.out)||0,t=Math.min(o,cons);cons=r3(cons-t);var q=r3(o-t);
    if(q>0)out.push({i:i,id:'fp:'+p.id+':'+i,q:q,exp:r.exp||'',tracked:r.exp!==undefined,expOk:r.expOk||0,at:r.at||0});
  });
  var extra=r3(R-T);
  if(extra>0)out.push({i:-1,id:'',q:extra,exp:'',tracked:false,expOk:0,at:0});
  return out;
}
function fillRunRows(p,rows){
  fillRunLots(p).forEach(function(l){
    var tracked=l.i>=0&&l.tracked,days=null,st='untracked';
    if(tracked){days=expDays(l.exp);st=days==null?'nodate':days<0?'expired':days<=2?'soon':(l.expOk?'ok':'check');}
    rows.push({p:p,id:tracked?l.id:'',q:l.q,exp:tracked?l.exp:'',days:days,at:l.at,st:st,store:fgStoreOf(p),fill:true});
  });
}
function fillRunOf(id){
  var s=String(id||'');if(s.indexOf('fp:')!==0)return null;
  var a=s.split(':'),p=P(a[1]),run=p&&Array.isArray(p.fillRuns)?p.fillRuns[+a[2]]:null;
  return run?{p:p,run:run}:null;
}
function trkRows(){
  var rows=[];
  PRODUCTS.forEach(function(p){
    var fill=isFill(p);
    if(fill){fillRunRows(p,rows);return;}
    fgLots(p.id).forEach(function(l){
      if(!(l.q>0))return;
      var d=(!fill&&l.id)?S.done.filter(function(x){return x.id===l.id&&x.p===p.id;})[0]:null;
      var st='untracked',days=null;
      if(d){
        days=expDays(l.exp);
        st=days==null?'nodate':days<0?'expired':days<=2?'soon':(d.expOk?'ok':'check');
      }
      if(p.trkOff&&st==='untracked')return;
      rows.push({p:p,id:d?l.id:'',q:l.q,exp:(d&&l.exp)||'',days:days,at:(d&&d.at)||0,st:st,store:fgStoreOf(p),fill:fill});
    });
  });
  rows.sort(function(a,b){
    return (TRK_ORDER[a.st]-TRK_ORDER[b.st])||((a.days==null?1e9:a.days)-(b.days==null?1e9:b.days));
  });
  return rows;
}
/* المشكلة = أي حاجة مش متأكدة، ما عدا الحشو اللي مش متتبع أصلاً */
function trkIsProblem(r){return r.st!=='ok'&&!(r.fill&&r.st==='untracked');}
function trkCounts(rows){var c={expired:0,soon:0,nodate:0,untracked:0,check:0,ok:0};rows.forEach(function(r){c[r.st]++;});return c;}
function trkAttn(){return trkRows().filter(trkIsProblem).length;}
function trkCardHTML(r){
  var p=r.p,ok=r.st==='ok',tracked=!!r.id;
  var label=r.st==='soon'?(r.days===0?'تنتهي النهارده':'تنتهي خلال '+r.days+' يوم'):TRK_LABEL[r.st];
  var head1=(tracked&&!r.fill)?'<span class="bid ltr">'+esc(sid(r.id))+'</span>':'<span class="meta">'+(r.fill?'حشو':'رصيد قديم')+'</span>';
  var meta=f(r.q)+' '+esc(p.unit)+' · المكان: '+esc(storeLbl(r.store))+(tracked&&r.at?' · اتعملت '+ago(r.at):'')+(p.shelf?' · مدة الصلاحية: '+esc(unesc(p.shelf)):'');
  var ctl,act;
  if(tracked){
    ctl='<label class="trk-lbl">تاريخ الصلاحية</label><div class="trk-row2"><input type="date" class="trk-date" data-tdate="'+esc(r.id)+'" value="'+esc(r.exp)+'" aria-label="تاريخ الصلاحية">'+
      (ok?'<span class="trk-done">✓ متأكدة</span>':'<button class="btn sm" data-act="trkOk" data-id="'+esc(r.id)+'" data-p="'+esc(p.id)+'">تأكيد التاريخ</button>')+'</div>';
  } else if(r.fill){
    ctl='<div class="trk-note">الحشو ما بيتتبعش بتاريخ صلاحية، راجعه من تبويب تحضير الحشو لو محتاج</div>';
  } else {
    ctl='<div class="trk-note">الرصيد ده قبل تتبع الدفعات، مش معاه تاريخ. لو مش متأكد منه صفّره وسيب المخزن يتعبى بدفعات جديدة</div>'+
      '<div class="trk-row2"><button class="btn ghost sm" data-act="lotZero" data-p="'+esc(p.id)+'" data-id="">صفّر الرصيد القديم</button><button class="btn ghost sm" data-act="trkOff" data-p="'+esc(p.id)+'">إخفاء من التتبع</button></div>';
  }
  return '<article class="trk-card trk-s-'+r.st+'">'+
    '<div class="trk-info"><div class="trk-top">'+head1+'<span class="pill '+TRK_PILL[r.st]+'">'+label+'</span></div>'+
    '<h4 class="trk-name">'+esc(p.name)+'</h4><div class="trk-meta">'+meta+'</div></div>'+
    '<div class="trk-ctl">'+ctl+'</div></article>';
}
function trackingView(){
  var all=trkRows(),L=U.trkLoc||'all',F=U.trkF||'attn';
  if(['attn','expired','soon','nodc','untracked'].indexOf(F)<0)F='attn';
  var locs=['all'].concat(FG_STORES);
  var inLoc=function(r){return L==='all'||r.store===L;};
  var rows=all.filter(inLoc),c=trkCounts(rows);
  var shown=rows.filter(function(r){
    if(F==='attn')return trkIsProblem(r);
    if(F==='nodc')return r.st==='nodate'||r.st==='check';
    return r.st===F;
  });
  var tile=function(k,n,l,fv){return '<div data-act="trkFilter" data-v="'+fv+'" class="trk-tile'+(F===fv?' on':'')+'" style="--tc:'+TRK_COLOR[k]+'"><b>'+n+'</b><small>'+l+'</small></div>';};
  var css='<style>'+
    '.trk-tiles div{border-top:3px solid var(--tc);}'+
    '.trk-tiles b{color:var(--tc);}'+
    '.trk-tile{cursor:pointer;transition:box-shadow .15s}'+
    '.trk-tile.on{box-shadow:inset 0 0 0 2px var(--tc)}'+
    '.trk-seg{display:flex;overflow-x:auto;max-width:100%;scrollbar-width:none;margin:12px 0 4px}'+
    '.trk-seg::-webkit-scrollbar{display:none}'+
    '.trk-seg button{white-space:nowrap}'+
    '.trk-grp{display:flex;align-items:center;gap:8px;margin:18px 0 2px;font-weight:800;font-size:14px}'+
    '.trk-dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto}'+
    '.trk-card{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;background:var(--surface);border:1px solid var(--line);border-inline-start:4px solid var(--sc,var(--line));border-radius:14px;padding:12px 14px;margin:8px 0;box-shadow:0 1px 2px rgba(15,23,42,.04)}'+
    '.trk-s-expired{--sc:#dc2626}.trk-s-soon{--sc:#d97706}.trk-s-nodate{--sc:#64748b}.trk-s-untracked{--sc:#8b5cf6}.trk-s-check{--sc:#4f5dff}.trk-s-ok{--sc:#16a34a}'+
    '@media (min-width:640px){.trk-card{grid-template-columns:minmax(0,1fr) minmax(240px,340px);align-items:center}}'+
    '.trk-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}'+
    '.trk-name{margin:6px 0 2px;font-size:16px;font-weight:800;color:var(--ink)}'+
    '.trk-meta{font-size:12.5px;color:var(--muted)}'+
    '.trk-lbl{display:block;font-size:12px;color:var(--muted);font-weight:700;margin-bottom:4px}'+
    '.trk-row2{display:flex;gap:8px;align-items:center;margin-top:6px}'+
    '.trk-date{flex:1;min-width:0;height:40px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:0 10px;font:inherit;box-sizing:border-box}'+
    '.trk-done{color:#16a34a;font-weight:800;font-size:13px;white-space:nowrap}'+
    '.trk-note{font-size:12.5px;color:var(--muted);line-height:1.6}'+
    '</style>';
  var locSeg='<div class="seg trk-seg" role="group" aria-label="مكان التخزين">'+locs.map(function(k){
    var n=all.filter(function(r){return (k==='all'||r.store===k)&&trkIsProblem(r);}).length;
    var name=k==='all'?'كل الأماكن':storeLbl(k);
    return '<button class="'+(L===k?'on':'')+'" data-act="trkLoc" data-v="'+esc(k)+'">'+name+(n?' · '+n+' مشكلة':'')+'</button>';
  }).join('')+'</div>';
  /* الفلاتر: الحالات التانية (بدون تاريخ، تأكيد، بدون دفعة) ظاهرة جوه "يحتاج متابعة" كأقسام، فمالهاش تبويب لوحدها */
  var fl=[['attn','يحتاج متابعة'],['expired','منتهية'],['soon','قربت'],['all','الكل']];
  var body='';
  if(!shown.length){
    body='<div class="empty"><b>'+(F==='attn'?'كله تمام':'مفيش أصناف')+'</b><span>'+(F==='attn'?'مفيش مشاكل في الصلاحية في المكان ده دلوقتي.':'مفيش أصناف في الفلتر ده.')+'</span></div>';
  } else {
    var order=F==='attn'?['expired','soon','nodate','check','untracked']:F==='nodc'?['nodate','check']:[F];
    order.forEach(function(st){
      var g=shown.filter(function(r){return r.st===st;});
      if(!g.length)return;
      body+='<div class="trk-grp"><span class="trk-dot" style="background:'+TRK_COLOR[st]+'"></span>'+TRK_LABEL[st]+' ('+g.length+')</div>'+g.map(trkCardHTML).join('');
    });
  }
  var btns='<div class="btns"><button class="btn ghost sm" data-act="tab" data-v="fgstock">مخزن الإنتاج</button><button class="btn ghost sm" data-act="tab" data-v="waste">تسجيل هالك</button></div>';
  return css+head('تتبع الصلاحية','كل مخزون الإنتاج، مقسم حسب المكان وحالة الصلاحية',btns)+locSeg+
    '<div class="pstats trk-tiles">'+tile('expired',c.expired,'منتهية','expired')+tile('soon',c.soon,'قربت تنتهي','soon')+tile('nodate',c.nodate+c.check,'بدون تاريخ / تأكيد','nodc')+tile('untracked',c.untracked,'بدون دفعة','untracked')+'</div>'+
    body;
}

function lotsHTML(p){
  if(isFill(p)){
    var cs=p.srcCodes||[];
    if(Array.isArray(p.fillRuns)&&p.fillRuns.length){
      var seenC={};cs=[];
      p.fillRuns.forEach(function(r){(r.from||[]).forEach(function(x){var q=P(x.p);var c=q&&q.code;if(c&&!seenC[c]){seenC[c]=1;cs.push(c);}});});
    }
    return '<div class="sgl">كود الصنف: <span class="ltr">'+esc(sid(p.code||'-'))+'</span></div>'+
      '<div class="sgl">أكواد الخامات المسحوبة</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+
      (cs.length?cs.map(function(c){return '<span class="pill ltr">'+esc(sid(c))+'</span>';}).join(''):'<span class="meta">مفيش أكواد</span>')+'</div>';
  }
  var L=fgLots(p.id);
  if(!L.length)return '';
  return '<div class="sgl">الدفعات في المخزن</div>'+L.map(function(l){
    var ck='lot:'+p.id+':'+l.id;
    return '<div class="meta" style="display:flex;justify-content:space-between;align-items:center;gap:6px"><span class="ltr">'+(l.id?sid(l.id):(isFill(p)?'المتاح':'رصيد سابق'))+'</span><span>'+lotExpPill(l.exp)+f(l.q)+' '+esc(p.unit)+
      (limited()?'':' <button class="btn ghost sm" data-act="lotZero" data-p="'+esc(p.id)+'" data-id="'+esc(l.id)+'">'+(U.confirm===ck?'اضغط تاني للتأكيد':'صفّر الدفعة')+'</button>')+'</span></div>';
  }).join('');
}
var EYE_ON_P='<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
var EYE_OFF_P='<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
function fgEyeHTML(p){
  var hid=fgHiddenIds().indexOf(p.id)>-1;
  return '<button class="fgeye" data-act="toggleFgHide" data-p="'+esc(p.id)+'" aria-pressed="'+hid+'" aria-label="'+(hid?'إظهار للمستخدمين':'إخفاء عن المستخدمين')+'" title="'+(hid?'مخفي عن المستخدمين · اضغط للإظهار':'ظاهر للمستخدمين · اضغط للإخفاء')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(hid?EYE_OFF_P:EYE_ON_P)+'</svg></button>';
}
function fgCardHTML(p,q,res){
  var tot=q+res,pct=tot>0?Math.round(q/tot*100):0;
  var hidOwner=!limited()&&fgHiddenIds().indexOf(p.id)>-1;
  var st=q>0?'<span class="pill ok">متاح</span>':(res>0?'<span class="pill low">محجوز كله</span>':'<span class="pill bad">نافد</span>');
  var on=(U.fgSel||[]).indexOf(p.id)>-1;
  return '<div class="fgc'+(on?' sel':'')+(hidOwner?' hid':'')+'"'+(limited()?'':' data-act="fgSel" data-p="'+p.id+'" role="button" aria-pressed="'+on+'"')+'><div class="mtop"><b>'+esc(p.name)+'</b><span class="fgtop">'+fgStoreBadge(p)+st+(limited()?'':fgEyeHTML(p))+'</span></div>'+
    '<div class="fgn">'+f(q)+' <span class="meta">'+esc(p.unit)+'</span></div>'+
    '<div class="fgbar"><i class="f" style="width:'+pct+'%"></i><i class="r" style="width:'+(tot>0?100-pct:0)+'%"></i></div>'+
    '<div class="meta">'+(res>0?'محجوز للأوردرات '+f(res):'مفيش حجز')+'</div>'+expiryWarnHTML(p)+lotsHTML(p)+
    '<button class="btn ghost sm lbl-open" data-act="lblOpen" data-p="'+esc(p.id)+'">🖨️ طباعة الملصق</button></div>';
}
function fgVisIds(F){
  if(F==='short')return fgShortRows().map(function(r){return r.x.p;}).filter(function(v,i,a){return a.indexOf(v)===i;});
  if(F==='fillcust'||F==='fillshop')return PRODUCTS.filter(function(p){return isFill(p)&&p.fill===F.slice(4)&&fgSeasonOK(p);}).map(function(p){return p.id;});
  return PRODUCTS.filter(function(p){return !p.archived&&fgSeasonOK(p);}).map(function(p){return p.id;});
}
function fgZeroBar(){
  var F=U.fgf||'all',vis=fgVisIds(F),sel=U.fgSel||[],n=sel.length;
  var allIn=vis.length>0&&vis.every(function(id){return sel.indexOf(id)>-1;});
  var conf=U.confirm==='fgzero',conf2=U.confirm==='fgdel';
  return '<div class="fgzbar"><span class="meta">محدد '+n+' صنف</span><span class="acts">'+
    (n&&!limited()?'<button class="btn sm" data-act="lblOpenSel">🖨️ طباعة المحدد ('+n+')</button>':'')+
    (vis.length&&!limited()?'<button class="btn ghost sm" data-act="fgSelAll">'+(allIn?'إلغاء تحديد الكل':'حدّد الكل')+'</button>':'')+
    (n&&!limited()?'<button class="btn ghost sm" data-act="fgClear">إلغاء التحديد</button><button class="btn '+(conf?'':'quiet ')+'sm" data-act="fgZero">'+(conf?'اضغط تاني للتأكيد':'صفّر المخزون')+'</button><button class="btn '+(conf2?'':'quiet ')+'sm" data-act="fgDel" style="color:var(--bad)">'+(conf2?'اضغط تاني للتأكيد':'حذف الصنف')+'</button>':'')+
    '</span></div>';
}
function allocReady(pid){
  var avail=S.ready[pid]||0;
  if(avail<=0)return;
  S.orders.slice().sort(function(a,b){return a.created-b.created;}).forEach(function(o){
    if(o.deliveredAt||avail<=0)return;
    (o.items||[]).forEach(function(it){
      if(it.p!==pid||avail<=0)return;
      var pend=0;orderBatches(o).forEach(function(x){if(x.p===pid)pend+=pc(x);});
      var short=r3(it.qty-((it.fs||0)+(it.got||0))-pend);
      if(short<=0)return;
      var give=r3(Math.min(short,avail));
      it.got=r3((it.got||0)+give);
      avail=r3(avail-give);
    });
  });
  S.ready[pid]=avail;
}
/* كود الحشو: أعلى رقم موجود في الأصناف المحشوة أو العداد، ومفيش تكرار */
function nextFillNo(){
  var mx=S.fseq||0;
  PRODUCTS.forEach(function(p){var m=/^F-(\d+)$/.exec(String(p.code||''));if(m&&+m[1]>mx)mx=+m[1];});
  return mx+1;
}
function mergedCode(){S.fseq=nextFillNo();return 'F-'+String(S.fseq).padStart(3,'0');}




function groupFillCards(fl){
  var of={},order=[],openMap=U.fGrpOpen||{};
  fl.forEach(function(p){var g=p.grp||'';if(!of[g]){of[g]=[];order.push(g);}of[g].push(p);});
  return order.map(function(g){
    var list=of[g],isOpen=!!openMap[g];
    var lbl=g||'بدون مجموعة';
    return '<button class="btn ghost sm" data-act="fgGrpOpen" data-g="'+esc(g)+'" aria-expanded="'+(isOpen?'true':'false')+'" style="width:100%;justify-content:space-between;margin-top:8px">'+
      '<span>'+(isOpen?'▾ ':'▸ ')+esc(lbl)+' ('+list.length+')</span></button>'+
      (isOpen?'<div class="fgcards">'+list.map(function(p){
        return fgCardHTML(p,S.ready[p.id]||0,fgReserved(p.id)).replace(/<\/div>$/,'<button class="btn ghost sm" data-act="fillEdit" data-id="'+p.id+'" style="margin-top:8px;width:100%">تعديل</button></div>');
      }).join('')+'</div>':'');
  }).join('');
}
function groupNames(){
  var out=[];PRODUCTS.forEach(function(p){if(isFill(p)&&p.grp&&out.indexOf(p.grp)<0)out.push(p.grp);});return out;
}
/* آخر تشغيل للصنف المحشو: الخامات وكمياتها والناتج اللي بيتخصم ويتضاف تلقائي */
function fillLastRun(ex){
  if(ex&&ex.runFrom&&ex.runFrom.length)return {from:ex.runFrom.map(function(x){return {p:x.p,q:x.q};}),out:ex.runOut||1};
  if(!ex||!Array.isArray(ex.fillRuns)||!ex.fillRuns.length)return null;
  var r=ex.fillRuns[ex.fillRuns.length-1];
  var from=(r.from||[]).filter(function(x){return P(x.p)&&Number(x.q)>0;}).map(function(x){return {p:x.p,q:Number(x.q)};});
  if(!from.length)return null;
  return {out:Number(r.out)||0,from:from};
}
/* لما تغيّر الكمية الناتجة، الخامات اللي في آخر تشغيل بتتعدّل بنفس النسبة */
function fillRescale(F){
  var exR=PRODUCTS.filter(function(x){return isFill(x)&&!x.archived&&String(x.name||'').trim()===String(F.name||'').trim();})[0];
  var lrR=fillLastRun(exR);
  if(!lrR||!(num(F.out)>0)||!(lrR.out>0))return;
  var kR=num(F.out)/lrR.out;
  F.q=F.q||{};
  lrR.from.forEach(function(x){if((F.sel||[]).indexOf(x.p)>-1)F.q[x.p]=r3(x.q*kR);});
}
function fillDupName(name){
  var n=String(name||'').trim();
  return !!n&&PRODUCTS.some(function(x){return isFill(x)&&String(x.name||'').trim()===n;});
}
/* تبويب الإضافة: لو الصنف موجود قبل كده بيظهر تنبيه بس، ومفيش إضافة تاني */
function fillSuggest(F){
  if(!fillDupName(F&&F.name))return '';
  return '<div class="card" style="--c:var(--bad);margin:-2px 0 10px;padding:10px 12px"><b style="color:var(--bad)">الصنف ده موجود قبل كده</b><div class="meta" style="margin-top:4px">مينفعش تضيفه تاني. لو عايز تزوّد عليه، شغّله من تبويب حشو.</div></div>';
}
function prepReqIds(){
  var seen=[];fgShortRows().forEach(function(r){if(seen.indexOf(r.x.p)<0)seen.push(r.x.p);});return seen;
}
/* التحضيرات الناقصة لكل مكوّن وسيط: المطلوب - المتاح - اللي في دفعات شغالة بالفعل */
function prepLackTotals(){
  var short={},rows=fgShortRows(),ids=[];
  rows.forEach(function(r){short[r.x.p]=r3((short[r.x.p]||0)+r.x.short);if(ids.indexOf(r.x.p)<0)ids.push(r.x.p);});
  var tot={};
  ids.forEach(function(pid){
    var p=P(pid);if(!p)return;var sh=short[pid],parts;
    if(isFill(p)){parts=fillNeedParts(p,sh);}
    else{var meals=sh/yieldOf(pid);parts=compsOf(pid).filter(function(c){return P(c.p);}).map(function(c){return {p:c.p,q:r3(c.q*meals)};});}
    parts.forEach(function(x){if(!P(x.p))return;tot[x.p]=r3((tot[x.p]||0)+x.q);});
  });
  var out={};
  Object.keys(tot).forEach(function(k){
    var pending=0;S.batches.forEach(function(b){if(b.p===k)pending+=pc(b);});
    var lack=r3(tot[k]-(S.ready[k]||0)-pending);
    if(lack>0)out[k]=lack;
  });
  return out;
}
function prepBatchBtn(){
  var n=Object.keys(prepLackTotals()).length;
  return n?'<div class="btns" style="margin-bottom:10px"><button class="btn" data-act="prepBatches">'+svg('plus')+'اعمل دفعات للتحضيرات المطلوبة ('+n+')</button></div>':'';
}
function fillNeedParts(p,shortQty){
  var totals={},outTotal=0,legacy=false;
  function add(arr){(arr||[]).forEach(function(x){if(!x||!x.p)return;totals[x.p]=r3((totals[x.p]||0)+(x.q||x.t||0));});}
  if(Array.isArray(p.fillRuns)&&p.fillRuns.length){
    add(p.legacyFrom||[]);outTotal+=Number(p.legacyOutEstimate)||0;legacy=!!(p.legacyFrom&&p.legacyFrom.length);
    p.fillRuns.forEach(function(run){outTotal+=Number(run.out)||0;add(run.from||[]);});
  }else{
    add(p.from||[]);outTotal=Number(p.fromTotal)||0;legacy=true;
  }
  if(outTotal<=0)outTotal=Number(p.fromTotal)||1;
  return Object.keys(totals).map(function(k){return {p:k,q:r3(totals[k]*shortQty/outTotal),legacy:legacy};});
}
/* الأصناف الناقصة اللي مفيش ليها دفعة شغالة: بتتعرض في جدول، وزرار يعمل الدفعة */

/* الحشو اللي بتكتبه في تحضير حشو: الخامات اللي ناقصة في المخزن بتتعرض هنا */
function fillDraftLacks(){
  var F=U.fill;
  if(!F||!String(F.name||'').trim()||!(F.sel||[]).length)return [];
  return F.sel.map(function(pid){
    var p=P(pid),need=num(F.q&&F.q[pid]);
    if(!p||!(need>0))return null;
    var have=S.ready[pid]||0,lack=r3(need-have);
    return lack>0?{name:String(F.name).trim(),ing:p,need:need,have:have,lack:lack}:null;
  }).filter(Boolean);
}
function prepMissingHTML(){
  var list=fillDraftLacks();
  if(!list.length)return '';
  return '<div class="grp">حشو ملوش تحضير ('+list.length+')</div>'+
    '<div class="list">'+list.map(function(x){
      return '<div class="rq"><div><b>'+esc(x.name)+'</b>'+
        '<small>ناقص '+esc(x.ing.name)+': '+f(x.lack)+' '+esc(x.ing.unit||'')+' · المتاح '+f(x.have)+' · مطلوب '+f(x.need)+'</small></div>'+
        '<span class="pill bad">ناقص</span></div>';
    }).join('')+'</div>';
}
/* الإجمالي المطلوب لكل تحضير عبر كل الأصناف النهائية (مجمّع) */
function prepTotalsHTML(){
  var short={},rows=fgShortRows();
  rows.forEach(function(r){short[r.x.p]=r3((short[r.x.p]||0)+r.x.short);});
  var tot={};
  Object.keys(short).forEach(function(pid){
    var p=P(pid);if(!p)return;var sh=short[pid],parts;
    if(isFill(p))parts=fillNeedParts(p,sh);
    else{var meals=sh/yieldOf(pid);parts=compsOf(pid).filter(function(c){return P(c.p);}).map(function(c){return {p:c.p,q:r3(c.q*meals)};});}
    parts.forEach(function(x){if(P(x.p))tot[x.p]=r3((tot[x.p]||0)+x.q);});
  });
  var keys=Object.keys(tot);
  if(!keys.length)return '';
  return '<div class="grp">الإجمالي المطلوب لكل تحضير (مجمّع)</div><div class="list">'+keys.map(function(k){
    var cp=P(k),have=S.ready[k]||0,pend=0;
    S.batches.forEach(function(b){if(b.p===k)pend+=pc(b);});
    var lack=Math.max(0,r3(tot[k]-have-pend)),bt=lack>0?Math.ceil(r3(lack/yieldOf(k))):0;
    return '<div class="rq"><div><b>'+esc(cp.name)+'</b><small>مطلوب '+f(tot[k])+' '+esc(cp.unit||'')+' · متاح '+f(have)+(pend?' · في دفعات '+f(pend):'')+'</small></div>'+
      '<span class="pill '+(lack>0?'low':'ok')+'">'+(lack>0?'يلزم '+f(lack)+' ('+bt+' دفعة)':'المتاح يكفي')+'</span></div>';
  }).join('')+'</div>';
}
function prepReqView(){
  var short={},rows=fgShortRows(),ids=[];
  rows.forEach(function(r){short[r.x.p]=r3((short[r.x.p]||0)+r.x.short);if(ids.indexOf(r.x.p)<0)ids.push(r.x.p);});
  if(!ids.length)return head('تحضيرات مطلوبة','المكونات الوسيطة اللازمة لإعادة إنتاج النواقص النهائية','')+'<div class="empty"><b>مفيش تحضيرات مطلوبة</b><span>لا توجد نواقص في المنتجات النهائية المسجلة بالأوردرات.</span></div>';
  var legacyAny=false;
  var cards=ids.map(function(pid){
    var p=P(pid);if(!p)return '';
    var sh=short[pid],parts=[];
    if(isFill(p)){
      parts=fillNeedParts(p,sh);
      if(parts.some(function(x){return x.legacy;}))legacyAny=true;
    }else{
      var meals=sh/yieldOf(pid);
      parts=compsOf(pid).filter(function(c){return P(c.p);}).map(function(c){return {p:c.p,q:r3(c.q*meals),legacy:false};});
    }
    var detail=parts.map(function(x){
      var cp=P(x.p);if(!cp)return '';
      var have=S.ready[x.p]||0,lack=Math.max(0,r3(x.q-have));
      return '<div class="rq"><div><b>'+esc(cp.name)+'</b><small>مطلوب '+f(x.q)+' '+esc(cp.unit||'')+' · متاح في مخزن الإنتاج '+f(have)+' '+esc(cp.unit||'')+'</small></div><span class="pill '+(lack>0?'low':'ok')+'">'+(lack>0?'يلزم تجهيز '+f(lack):'المتاح يكفي')+'</span></div>';
    }).join('');
    return '<article class="card" style="--c:var(--prepreq)"><div class="bh"><div><h3 class="bn">'+esc(p.name)+'</h3><small class="meta">نقص نهائي '+f(sh)+' '+esc(p.unit||'')+'</small></div></div>'+(detail?'<div class="grp">المكونات الوسيطة المطلوبة لإعادة إنتاجه</div>'+detail:'<div class="meta">لا توجد مكونات وسيطة مسجلة لهذا الصنف.</div>')+'</article>';
  }).join('');
  return head('تحضيرات مطلوبة','المكونات الوسيطة اللازمة لإعادة إنتاج النواقص النهائية','')+
    prepBatchBtn()+prepTotalsHTML()+prepMissingHTML()+
    '<details data-fk="prepDetail"'+(FOLD_OPEN['prepDetail']===true?' open':'')+' style="margin-bottom:10px"><summary class="grp" style="cursor:pointer">تفصيل النواقص حسب الصنف النهائي ('+ids.length+')</summary><div class="list">'+cards+'</div></details>'+
    (legacyAny?'<div class="note">تنبيه: بعض سجلات حشو القديمة لا تحتوي على كمية الناتج لكل تشغيله؛ احتياج مكوناتها محسوب تقديريًا من البيانات القديمة. التشغيلات الجديدة تُسجل بناتجها الفعلي لحساب أدق.</div>':'');
}
/* تبويب "حشو": تشغيل صنف محشو موجود. الاسم بيختار، والمجموعة والكمية الناتجة والخامات بتتملى تلقائي من آخر تشغيل */
function runPend(pid){var t=0;S.batches.forEach(function(b){if(b.p===pid)t+=pc(b);});return t;}
function runNetLack(R,pid){return r3((num(R.q[pid])||0)-(S.ready[pid]||0)-runPend(pid));}
function runSuggest(R){
  var q=String((R&&R.name)||'').trim();
  if(!q)return '';
  var pk=R.pid?P(R.pid):null;
  if(pk&&String(pk.name||'').trim()===q)return '';
  var m=PRODUCTS.filter(function(p){return isFill(p)&&!p.archived&&String(p.name||'').trim().indexOf(q)===0;}).slice(0,8);
  if(!m.length)return '<div class="meta" style="margin-top:6px">مفيش صنف محشو بالاسم ده. الأصناف الجديدة اعملها من تبويب إضافة أصناف جديدة.</div>';
  return '<div class="fdrop">'+m.map(function(p){return '<button data-act="runPick" data-id="'+p.id+'">'+esc(p.name)+(p.grp?' <small>· '+esc(p.grp)+'</small>':'')+'</button>';}).join('')+'</div>';
}
/* وزن الوحدة بالجرام: للأصناف اللي وحدتها قطعة (صاج/كاس/...) = إجمالي وزن الوصفة ÷ عدد القطع اللي بتطلعها */
function gramsPerRun(p,depth){
  var t=0;
  (p.stages||[]).forEach(function(g){(g.ings||[]).forEach(function(i){var m=M(i.m);var u=m?unitGrams(m.unit):null;if(u)t+=(i.q||0)*u;});});
  (p.comps||[]).forEach(function(c){var sp=P(c.p);if(sp&&depth<6){var gp=gramsPerUnit(sp,depth+1);if(gp)t+=(c.q||0)*gp;}});
  return t;
}
function gramsPerUnit(p,depth){
  depth=depth||0;if(!p)return null;
  if(!isPieceU(p.unit))return unitGrams(p.unit)||null;
  var r=gramsPerRun(p,depth);return r>0?r/yieldOf(p.id):null;
}

function gramsPerUnitTxt(sp){
  if(!sp||!isPieceU(sp.unit))return '';
  var g=gramsPerUnit(sp);return g?' · '+esc(sp.unit)+' الواحدة ≈ '+f(r3(g))+' جرام':'';
}
function gCalc(sp,qty){
  var g=gramsPerUnit(sp);if(!g||!isPieceU(sp.unit))return '';
  var n=function(x){return Number(x).toLocaleString('en-US',{maximumFractionDigits:3});};
  return '<br><b>الحساب: '+n(qty)+' '+esc(sp.unit)+' × '+n(r3(g))+' جرام = '+n(r3(qty*g))+' جرام</b>';
}
function gPillTxt(sp,qty){
  var g=gramsPerUnit(sp);if(!g||!isPieceU(sp.unit))return '';
  return ' = '+Number(r3(qty*g)).toLocaleString('en-US',{maximumFractionDigits:2})+' جرام';
}
function runBodyHTML(R){
  var p=R&&R.pid?P(R.pid):null;
  if(!p)return '<div class="meta" style="margin-top:8px">اكتب اسم الصنف واختاره من الاقتراحات عشان المجموعة والخامات تظهر تلقائي.</div>';
  if(!(R.sel||[]).length)return '<div class="meta" style="margin-top:8px">الصنف ده ملوش تشغيل قبل كده، فمفيش خامات تتحسب تلقائي.</div>';
  var needStock=false,redN=0;
  var rows=R.sel.map(function(pid){
    var sp=P(pid);if(!sp)return '';
    var need=num(R.q[pid])||0,have=S.ready[pid]||0,pend=runPend(pid),net=runNetLack(R,pid);
    if(need>have+1e-9)needStock=true;
    var bad=net>0;if(bad)redN++;
    var st=bad?'<span class="pill bad">ناقص تحضير '+f(net)+' '+esc(sp.unit||'')+gPillTxt(sp,net)+'</span>':(need>have+1e-9?'<span class="pill low">في التحضير</span>':'<span class="pill ok">متاح</span>');
    var style=bad?' style="border:1.5px solid var(--bad);background:color-mix(in srgb,var(--bad) 10%,var(--surface))"':'';
    if(bad)return '<div class="rq"'+style+'><div><b>'+esc(sp.name)+'</b><small style="color:var(--bad);font-weight:700">ناقص تحضير '+f(net)+' '+esc(sp.unit||'')+gPillTxt(sp,net)+'</small></div></div>';
    return '<div class="rq"'+style+'><div><b>'+esc(sp.name)+'</b><small>مطلوب '+Number(need).toLocaleString('en-US',{maximumFractionDigits:3})+' '+esc(sp.unit||'')+gCalc(sp,need)+'<br>'+(gramsPerUnitTxt(sp).replace(/^ · /,''))+' · متاح '+f(have)+(pend?' · في التحضير '+f(pend):'')+'</small></div>'+st+'</div>';
  }).join('');
  var btns='<div class="btns" style="margin-top:12px">'+
    (redN?'<button class="btn" data-act="runMakeBatches">إنشاء دفعة بالنواقص ('+redN+')</button>':'')+
    '<button class="btn" data-act="runDo"'+(needStock?' disabled':'')+'>نفّذ الحشو</button></div>';
  return '<div class="meta" style="margin-top:10px">المجموعة: <b>'+esc(p.grp||'-')+'</b> · الكود <span class="ltr">'+esc(p.code||'-')+'</span></div>'+
    '<div class="meta" style="margin-top:8px">الخامات اللي هتتسحب من مخزن الإنتاج (تلقائي):</div><div class="list" style="margin-top:6px">'+rows+'</div>'+btns;
}
function runFillHTML(){
  var R=U.run||(U.run={name:'',pid:null,grp:'',q:{},out:'',sel:[]});
  return '<section class="card fillform" style="--c:var(--filling)"><h3>حشو صنف موجود</h3>'+
    '<div class="fld"><label>اسم الصنف</label><input type="text" data-rn="1" value="'+esc(R.name||'')+'" placeholder="اكتب اسم الصنف المحشو"></div>'+
    '<div id="runSug">'+runSuggest(R)+'</div>'+
    '<div class="fld" style="margin-top:6px"><label>الكمية الناتجة</label><input type="text" inputmode="decimal" data-ro="1" value="'+esc(R.out||'')+'" placeholder="مثلاً 3"></div>'+
    '<div id="runBody">'+runBodyHTML(R)+'</div></section>';
}
function fillingView(){
  var F=U.fill||(U.fill={name:'',kind:'cust',q:{},out:'',unit:'قطعة',sel:[]});
  var src=PRODUCTS.filter(function(p){return !isFill(p)&&!p.archived&&(S.ready[p.id]||0)>0;});
  var sel=F.sel||[];
  var pick='<div class="pgrid">'+src.map(function(p){
    var on=sel.indexOf(p.id)>-1;
    var info='<small>كود '+esc(p.code||'-')+' · المتاح '+f(S.ready[p.id]||0)+' '+esc(p.unit)+'</small>';
    if(!on)return '<button class="pk" data-act="fillSel" data-p="'+p.id+'">'+esc(p.name)+info+'</button>';
    return '<div class="pk on" style="--c:var(--filling);cursor:default">'+
      '<div class="opk-h"><b>'+esc(p.name)+'</b><button class="ox" data-act="fillSel" data-p="'+p.id+'" aria-label="شيل الصنف">×</button></div>'+
      info+
      '<div class="opk-q"><input type="text" inputmode="decimal" data-fq="'+p.id+'" value="'+(F.q[p.id]||'')+'" placeholder="الكمية المسحوبة" aria-label="الكمية المسحوبة"><span>'+esc(p.unit)+'</span></div>'+
      '</div>';
  }).join('')+'</div>';
  if(!src.length)pick='<div class="empty"><b>مفيش خامات متاحة في مخزن الإنتاج</b></div>';
  var units=['قطعة','كادر','تورته','بولة','كاس','سفنديش كبير','سفنديش صغير','سفنديش وسط','فورمة كبيرة','فورمة صغيرة','فخارة'];
  var unitBtns='<div class="btns">'+units.map(function(u){return '<button class="btn '+((F.unit||'قطعة')===u?'':'ghost ')+'sm" data-act="fillUnit" data-v="'+u+'">'+u+'</button>';}).join('')+'</div>';
  var kindBtns='<div class="btns">'+[['cust','أوردرات'],['shop','أوردرات المحل']].map(function(x){
    return '<button class="btn '+(F.kind===x[0]?'':'ghost ')+'sm" data-act="fillKind" data-v="'+x[0]+'">'+x[1]+'</button>';
  }).join('')+'</div>';
  var seasonBtns='<div class="btns">'+visibleSeasons().map(function(x){return '<button class="btn '+((F.season||'normal')===x[0]?'':'ghost ')+'sm" data-act="fillSeason" data-v="'+x[0]+'">'+x[1]+'</button>';}).join('')+'</div>';
  var nextCode='F-'+String(nextFillNo()).padStart(3,'0');
  var mine=PRODUCTS.filter(function(p){return isFill(p)&&!p.archived;});
  var cards=mine.length?groupFillCards(mine):'<div class="empty"><b>مفيش أصناف محشوة لسه</b></div>';
  var form='<section class="card fillform" style="--c:var(--filling)"><h3>صنف جديد</h3>'+
    '<div class="fld"><label>اسم الصنف</label><input type="text" data-fn="1" value="'+esc(F.name)+'" placeholder="اسم الصنف الجديد"></div>'+
    '<div id="fillSug">'+fillSuggest(F)+'</div>'+
    '<div class="fld"><label>المجموعة (اختياري)</label><input type="text" data-fg="1" list="fgList" autocomplete="off" value="'+esc(F.grp||'')+'" placeholder="اكتب أو اختار من القائمة"><datalist id="fgList">'+groupNames().map(function(g){return '<option value="'+esc(g)+'">';}).join('')+'</datalist></div>'+
    '<div class="meta">1. اختار الخامات اللي هتتسحب من مخزن الإنتاج واكتب الكمية المسحوبة من كل واحد</div>'+pick+
    '<div class="meta" style="margin-top:12px">2. الكمية الناتجة من الصنف الجديد ووحدته</div>'+
    '<div class="fld"><label>الكمية الناتجة</label><input type="text" inputmode="decimal" data-fo="1" value="'+(F.out||'')+'" placeholder="مثلاً 3"></div>'+
    '<div class="meta" style="margin-top:8px">وحدة الصنف الجديد</div>'+unitBtns+'<div class="meta" style="margin-top:12px">3. يتحط في</div>'+kindBtns+'<div class="meta" style="margin-top:8px">الموسم</div>'+seasonBtns+
    '<div class="meta" style="margin-top:8px">الكود الجديد: <b>'+nextCode+'</b> · بيتسجل في مخزن الإنتاج بنفس المسارات القديمة</div>'+
    '<div class="btns"><button class="btn" id="fillMakeBtn" data-act="fillMake"'+(fillDupName(F.name)?' disabled':'')+'>اعمل الصنف</button></div></section>';
  var opts=[['short','نواقص الأوردرات','اضغط على الصنف عشان تبدأ إنتاجه']];
  if(!tabHidden('fillrun'))opts.push(['run','تسجيل إنتاج جديد','شغّل صنف محشو موجود من مخزن الإنتاج']);
  var ft=(U.fillTab&&opts.some(function(x){return x[0]===U.fillTab;}))?U.fillTab:'short';
  var tiles='<div class="fgcards" style="margin-bottom:12px">'+opts.map(function(x){
      var on=ft===x[0];
      return '<div class="fgc'+(on?' sel':'')+'" style="--c:var(--filling)" role="button" aria-pressed="'+on+'" data-act="fillTab" data-v="'+x[0]+'"><b style="font-size:16px">'+x[1]+'</b><span class="meta">'+x[2]+'</span></div>';
    }).join('')+'</div>';
  if(ft==='run')return head('تحضير حشو','تشغيل صنف محشو موجود من خامات مخزن الإنتاج','')+tiles+runFillHTML()+prodLogHTML('fill');
  var nShort=shortByProduct(fgShortRows()).length;
  var body=fillShortHTML();
  return head('تحضير حشو',ft==='short'?'نواقص الأوردرات من مخزن الإنتاج':'إضافة صنف محشو جديد بكود جديد من خامات مخزن الإنتاج','')+tiles.replace('نواقص الأوردرات</b>','نواقص الأوردرات ('+nShort+')</b>')+body;
}
/* نواقص الأوردرات (نفس اللي كانت في مخزن الإنتاج): الضغط على الصنف بيملّي الفورم */
function fillShortHTML(){
  var g=shortByProduct(fgShortRows());
  if(!g.length)return '<div class="empty"><b>مفيش نواقص لأوردراتك</b><span>كل الأوردرات متغطية من مخزن الإنتاج.</span></div>';
  return '<div class="list">'+g.map(function(a){var p=P(a.p)||{name:'صنف محذوف',unit:''};
    return '<article class="card" role="button" data-act="fillFromShort" data-p="'+a.p+'" style="--c:var(--orders);cursor:pointer"><div class="mtop"><div><b>'+esc(p.name)+'</b>'+
      '<small>في '+a.ords.length+' '+(a.ords.length>1?'أوردرات':'أوردر')+' · مطلوب '+f(a.qty)+' · متاح '+f(a.have)+(a.pend?' · في التحضير '+f(a.pend):'')+'</small></div>'+
      '<div class="mq"><b>'+f(a.short)+'</b> <span>'+esc(p.unit)+'</span></div></div></article>';}).join('')+'</div>';
}
function wasteCardHTML(p){
  var stk=S.ready[p.id]||0,open=U.wasteOpen===p.id;
  var st=stk>0?'<span class="pill ok">متاح</span>':'<span class="pill bad">نافد</span>';
  return '<div class="fgc'+(open?' sel':'')+'" aria-pressed="'+open+'">'+
    '<div data-act="wasteToggle" data-p="'+p.id+'" role="button" style="cursor:pointer">'+
      '<div class="mtop"><b>'+esc(p.name)+'</b>'+st+'</div>'+
      '<div class="fgn">'+f(stk)+' <span class="meta">'+esc(p.unit||'قطعة')+'</span></div>'+
    '</div>'+
    (open?'<div class="btns" style="margin-top:8px">'+
      '<input type="number" min="0" step="any" inputmode="decimal" data-wq="'+p.id+'" placeholder="كمية الهالك" style="flex:1;min-width:0;padding:10px;border:1.5px solid var(--line);border-radius:12px;font:inherit">'+
      '<button class="btn sm" data-act="wasteAdd" data-p="'+p.id+'" style="background:var(--waste)">خصم</button></div>':'')+
  '</div>';
}
/* علب جاهزة: قوالب بأصناف معينة، وطلب علبة منها بيتسجل زي الأوردر. الخصم من مخزن الإنتاج بيحصل وقت التسليم بس */
function migrateBoxOrders(){
  (S.orders||[]).forEach(function(o){
    if(!o.isBox||o.deliveredAt)return;
    o.isBox=false;o.kind=o.kind==='shop'?'shop':'cust';o.season='normal';
    (o.items||[]).forEach(function(it){var fs=Math.min(it.qty,S.ready[it.p]||0);if(fs>0)S.ready[it.p]=r3((S.ready[it.p]||0)-fs);it.fs=fs;it.got=it.got||0;});
  });
}



function boxSeasonHTML(){
  var tplAll=S.boxTpl||[];
  var SK=screenKind();
  var tplList=tplAll.filter(function(t){return (t.kind||'cust')===SK;});
  var tplHTML=tplList.length?tplList.map(function(t){
    var sel=!!(U.tplSel||{})[t.id];
    var cnt=(U.tplCnt||{})[t.id]||1;
    var open=FOLD_OPEN['tpl-'+t.id]===true?' open':'';
    return '<div class="card tplcard'+(sel?' on':'')+'" style="--c:var(--orders)">'+
      '<button class="tplname" data-act="tplSel" data-id="'+t.id+'" aria-pressed="'+(sel?'true':'false')+'"><span class="tplck'+(sel?' on':'')+'" aria-hidden="true">'+(sel?'✓':'')+'</span><b>'+esc(t.name)+'</b></button>'+
      '<details class="tpldet" data-fk="tpl-'+t.id+'"'+open+' style="margin-top:4px"><summary class="btn ghost sm" style="cursor:pointer;list-style:none;display:inline-flex;justify-content:center">عرض التفاصيل</summary><small style="display:block;margin-top:8px">'+t.items.map(function(i){return esc(i.name)+' '+f(i.q)+' '+esc(i.unit||'');}).join(' · ')+'</small></details>'+
      '<div class="tplfoot"><input type="number" min="1" step="1" inputmode="numeric" value="'+cnt+'" data-bcount="'+t.id+'" aria-label="عدد العلب"><small>علبة</small></div>'+
      '</div>';
  }).join(''):'<div class="meta">مفيش قوالب علب لسه · اعملها من الإعدادات ← قالب علبة جديد</div>';
  var selTpl=Object.keys(U.tplSel||{}).filter(function(k){return U.tplSel[k];});
  var selBoxes=0;selTpl.forEach(function(id){selBoxes+=(U.tplCnt||{})[id]||1;});
  var barHTML=tplList.length?'<div class="tplbar" id="tplBar"><div class="tplbar-i"><b data-bar-t>'+selBoxes+' علبة</b><small data-bar-s>'+(selTpl.length?selTpl.length+' نوع محدد':'اختار العلب اللي محتاجها')+'</small></div><button class="btn main" data-act="boxOrderSel"'+(selTpl.length?'':' disabled')+'>اطلب كأوردر</button></div>':'';
  return '<div class="grp">علب محفوظة ('+tplList.length+')</div>'+(tplList.length?'<div class="tplgrid">'+tplHTML+'</div>':tplHTML)+barHTML;
}
function boxTplFormHTML(){
  var T=U.tpl||(U.tpl={name:'',items:[]});
  var K=U.tplKind||'cust';
  var fillP=PRODUCTS.filter(function(p){return isFill(p)&&!p.archived&&(p.fill||'cust')===K;});
  var gk=[];fillP.forEach(function(p){var k=p.grp||'__none';if(gk.indexOf(k)<0)gk.push(k);});
  var pick=fillP.length?gk.map(function(k){
    var list=fillP.filter(function(p){return (p.grp||'__none')===k;});
    return '<div class="grp" style="margin-top:12px">'+(k==='__none'?'بدون مجموعة':esc(k))+' ('+list.length+')</div><div class="pkgrid">'+list.map(function(p){
      var q=(U.tplQ||{})[p.id]||'';
      return '<div class="pk on" style="--c:var(--orders);cursor:default"><div class="opk-h"><b>'+esc(p.name)+'</b></div><small>المتاح: '+f(S.ready[p.id]||0)+' '+esc(p.unit)+'</small><div class="opk-q"><input type="text" inputmode="'+qIM(p)+'" data-tq="'+p.id+'" value="'+esc(String(q))+'" placeholder="0" aria-label="الكمية"><span>'+esc(p.unit)+'</span></div></div>';
    }).join('')+'</div>';
  }).join(''):'<div class="meta">مفيش أصناف حشو. اعملها من تبويب تحضير حشو</div>';
  var draft=T.items.length?T.items.map(function(i){return '<div class="hist"><span><b>'+esc(i.name)+'</b></span><span>'+f(i.q)+' '+esc(i.unit||'')+' <button class="btn ghost sm" data-act="tplRemove" data-p="'+i.p+'">×</button></span></div>';}).join(''):'<div class="meta">ضيف أصناف للعلبة من فوق</div>';
  var all=S.boxTpl||[];
  var savedH=all.length?'<div class="grp">علب محفوظة ('+all.length+')</div>'+all.map(function(t){return '<div class="card" style="--c:var(--orders)"><div class="mtop"><div><b>'+esc(t.name)+'</b><small>'+(t.kind==='shop'?'أوردرات المحل':'أوردرات العملاء')+' · '+t.items.map(function(i){return esc(i.name)+' '+f(i.q)+' '+esc(i.unit||'');}).join(' · ')+'</small></div></div><div class="btns" style="margin-top:8px"><button class="btn ghost sm" data-act="tplDel" data-id="'+t.id+'">حذف القالب</button></div></div>';}).join(''):'<div class="meta">مفيش قوالب علب لسه</div>';
  var formH='<div class="card" style="--c:var(--orders)"><h3 class="bn">قالب علبة جديد</h3><span class="meta">اختار الأصناف واحفظ القالب</span>'+
    '<div class="fld"><label>نوع القالب</label><select data-tkind style="width:100%;height:44px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--ink);padding:0 8px;font:inherit"><option value="cust"'+(K==='cust'?' selected':'')+'>أوردرات العملاء</option><option value="shop"'+(K==='shop'?' selected':'')+'>أوردرات المحل</option></select></div>'+
    '<div class="fld"><label>اسم القالب</label><input data-tname value="'+esc(T.name||'')+'" placeholder="مثال: علبة 6 قطع"></div>'+
    '<div>'+pick+'</div><div class="btns" style="margin-top:10px"><button class="btn main" data-act="tplAddAll">أضف كل الأصناف للقالب</button></div><div class="grp" style="margin-top:12px">أصناف القالب</div><div class="list">'+draft+'</div>'+
    '<button class="btn block" data-act="tplSave" style="margin-top:10px"'+((T.items.length&&T.name&&T.name.trim())?'':' disabled')+'>احفظ القالب</button></div>';
  return savedH+'<div style="margin-top:14px">'+formH+'</div>';
}
document.addEventListener('change',function(e){var t=e.target;if(t&&t.dataset&&t.dataset.lblpaper!==undefined){if(U.lbl){U.lbl.paper=t.value;render();}}});
document.addEventListener('change',function(e){var t=e.target;if(t&&t.dataset&&t.dataset.permsec!==undefined){U.permSec=t.value;render();}});
document.addEventListener('change',function(e){var t=e.target;if(t&&t.dataset&&t.dataset.bcount!==undefined){var v=parseInt(t.value,10);U.tplCnt=U.tplCnt||{};U.tplCnt[t.dataset.bcount]=v>0?v:1;tplBarPaint();}});
function tplBarPaint(){var b=document.getElementById('tplBar');if(!b)return;var ids=Object.keys(U.tplSel||{}).filter(function(k){return U.tplSel[k];});var boxes=0;ids.forEach(function(id){var inp=document.querySelector('[data-bcount="'+id+'"]');var n=parseInt(inp&&inp.value,10);boxes+=(n>0?n:1);});var tt=b.querySelector('[data-bar-t]'),ss=b.querySelector('[data-bar-s]'),bt=b.querySelector('button');if(tt)tt.textContent=boxes+' علبة';if(ss)ss.textContent=ids.length?ids.length+' نوع محدد':'اختار العلب اللي محتاجها';if(bt)bt.disabled=!ids.length;}
document.addEventListener('change',function(e){var t=e.target;if(t&&t.dataset&&t.dataset.tkind!==undefined){U.tplKind=t.value;render();}});
document.addEventListener('input',function(e){var t=e.target;if(t&&t.dataset&&t.dataset.tq!==undefined){U.tplQ=U.tplQ||{};U.tplQ[t.dataset.tq]=t.value;}if(t&&t.dataset&&t.dataset.tname!==undefined&&U.tpl)U.tpl.name=t.value;if(t&&t.dataset&&t.dataset.onote!==undefined&&U.osheet)U.osheet.note=t.value;});
function wasteView(){
  var F=U.wf||'all',nowKey=ymKey(Date.now()),openG=U.wGrpOpen||{};
  var logAll=S.waste||[];
  var thisM=logAll.filter(function(w){return ymKey(w.at)===nowKey;});
  var thisP={};thisM.forEach(function(w){thisP[w.p]=1;});
  var inStock=0;PRODUCTS.forEach(function(p){inStock+=(S.ready[p.id]||0);});
  var seg='<div class="seg" role="group" aria-label="تصفية">'+[['all','الكل'],['zero','نافد'],['fill','حشو'],['main','دفعات']].map(function(x){
    return '<button class="'+(F===x[0]?'on':'')+'" data-act="wasteFilter" data-v="'+x[0]+'">'+x[1]+'</button>';
  }).join('')+'</div>';
  var sum='<div class="sum"><div class="tile"><b>'+PRODUCTS.length+'</b><span>صنف</span></div>'+
    '<div class="tile"><b>'+f(inStock)+'</b><span>في المخزن</span></div>'+
    '<div class="tile"><b>'+thisM.length+'</b><span>عملية هالك الشهر</span></div>'+
    '<div class="tile"><b>'+Object.keys(thisP).length+'</b><span>صنف اتهلك الشهر</span></div></div>';
  var vis=PRODUCTS.filter(function(p){
    if(p.archived)return false;
    if(F==='zero')return (S.ready[p.id]||0)===0;
    if(F==='fill')return isFill(p);
    if(F==='main')return !isFill(p);
    return true;
  });
  var of={},order=[];
  vis.forEach(function(p){var g=p.grp||'';if(!of[g]){of[g]=[];order.push(g);}of[g].push(p);});
  order.sort(function(x,y){return String(x).localeCompare(String(y),'ar');});
  var body=!vis.length?'<div class="empty"><b>مفيش أصناف هنا</b><span>الأصناف اللي تتضاف لمخزن الإنتاج هتظهر هنا تلقائي.</span></div>':
    order.map(function(g){
      var list=of[g],isOpen=!!openG[g],lbl=g||'بدون مجموعة';
      return '<button class="btn ghost sm" data-act="wasteGrpOpen" data-g="'+esc(g)+'" aria-expanded="'+(isOpen?'true':'false')+'" style="width:100%;justify-content:space-between;margin-top:8px"><span>'+(isOpen?'▾ ':'▸ ')+esc(lbl)+' ('+list.length+')</span></button>'+
        (isOpen?'<div class="fgcards">'+list.map(wasteCardHTML).join('')+'</div>':'');
    }).join('');
  // monthly log (locks with the month)
  var groups={},gorder=[];
  logAll.forEach(function(w){var k=ymKey(w.at);if(!groups[k]){groups[k]=[];gorder.push(k);}groups[k].push(w);});
  gorder.sort().reverse();
  var logHTML=gorder.map(function(k){
    var arr=groups[k].slice().reverse(),cur=k===nowKey,key='waste-'+k;
    var isOpen=FOLD_OPEN[key]!==undefined?FOLD_OPEN[key]===true:cur;
    var label=new Date(arr[0].at).toLocaleString('ar-EG',{month:'long',year:'numeric'});
    var rows=arr.map(function(w){
      var t=new Date(w.at).toLocaleString('ar-EG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:true});
      return '<div class="card" style="--c:var(--waste)"><div class="mtop"><div><b>'+esc(w.name||'')+'</b><small>'+t+'</small></div><span class="pill low">- '+f(w.qty)+'</span></div></div>';
    }).join('');
    return '<details class="card ordfold" data-fk="'+key+'" style="--c:var(--waste)"'+(isOpen?' open':'')+'>'+
      '<summary class="mtop"><div><b>'+esc(label)+'</b><small>'+arr.length+' عملية</small></div>'+
      '<span class="pill '+(cur?'ok':'')+'">'+(cur?'الشهر الحالي':'مقفول')+'</span></summary>'+
      '<div class="ordbody">'+rows+'</div></details>';
  }).join('');
  return head('هالك','اختار الخامة واكتب الكمية التالفة، وتتخصم من المخزن وتتسجل في السجل','')+sum+
    '<div style="margin:12px 0">'+seg+'</div>'+body+
    '<div class="grp" style="margin-top:18px">سجل الهالك</div>'+
    '<div class="list">'+(logHTML||'<div class="meta">مفيش هالك متسجل لسه</div>')+'</div>';
}
/* محرر الصنف المحشو: الاسم + الناتج في الدفعة + الخامات وكمية كل خامة لكل دفعة */
function feSync(){
  var E=U.fedit;if(!E)return;
  var nm=document.getElementById('feName'),yl=document.getElementById('feYield'),gr=document.getElementById('feGrp');
  if(nm)E.name=nm.value;
  if(yl)E.yield=yl.value;
  if(gr)E.grp=gr.value;
  var shEl=document.getElementById('feShelf');if(shEl)E.shelf=shEl.value;
  var stEl=document.getElementById('feStore');if(stEl)E.store=stEl.value;
  (E.rows||[]).forEach(function(r){var el=document.getElementById('feq'+r.p);if(el)r.q=el.value;});
}
function feDupCheck(){
  var E=U.fedit;if(!E)return;
  var el=document.getElementById('feName');
  var n=String((el&&el.value)||'').trim();
  var dup=!!n&&PRODUCTS.some(function(x){return isFill(x)&&!x.archived&&String(x.name||'').trim()===n&&String(x.id)!==String(E.id);});
  var w=document.getElementById('feWarn'),b=document.getElementById('feSaveBtn');
  if(w)w.style.display=dup?'block':'none';
  if(b)b.disabled=dup;
}
document.addEventListener('input',function(e){if(e.target&&e.target.id==='feName')feDupCheck();},true);
function feHTML(){
  var E=U.fedit,isNew=E.id==='new',rows=E.rows||[];
  var grpNow=(E.grp||'');
  var nameNow=String(E.name||'').trim();
  var dupNow=!!nameNow&&PRODUCTS.some(function(x){return isFill(x)&&!x.archived&&String(x.name||'').trim()===nameNow&&String(x.id)!==String(E.id);});
  var grpOpts=groupNames().map(function(g){return '<option value="'+esc(g)+'">';}).join('');
  var css='<style id="feCss">'+
    '.fe{display:flex;flex-direction:column;gap:16px;padding-bottom:86px}'+
    '.fe-head{display:flex;flex-direction:column;gap:2px}'+
    '.fe-head b{font-size:18px}'+
    '.fe-sec{border:1px solid var(--line,#e4e6f2);border-radius:16px;padding:16px;background:var(--card,#fff)}'+
    '.fe-sh{display:flex;align-items:center;gap:10px;margin-bottom:12px}'+
    '.fe-n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--navy,#2d3591);color:#fff;font-weight:800;font-size:13px;flex:none}'+
    '.fe-sh h4{margin:0;font-size:15px}'+
    '.fe-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 12px}'+
    '.fe-f{display:flex;flex-direction:column;gap:6px}'+
    '.fe-f span{font-size:13px;color:var(--muted,#6b7090);font-weight:700}'+
    '.fe-f input,.fe-f select,.fe-q{border:1px solid var(--line,#e4e6f2);border-radius:12px;padding:0 12px;min-height:46px;font:inherit;font-size:15px;background:var(--surface-2,#f7f8fc);color:var(--ink,#1b1f3b);min-width:0;width:100%;box-sizing:border-box}'+
    '.fe-f select{appearance:none;-webkit-appearance:none;padding-inline-end:34px;background-image:url(data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%228%22%20viewBox=%220%200%2012%208%22%3E%3Cpath%20d=%22M1%201l5%205%205-5%22%20fill=%22none%22%20stroke=%22%236b7090%22%20stroke-width=%221.8%22%20stroke-linecap=%22round%22/%3E%3C/svg%3E);background-repeat:no-repeat;background-position:left 12px center;cursor:pointer}'+
    '.fe-f small{font-size:12px;color:var(--muted,#6b7090)}'+
    '.fe-f input:focus,.fe-f select:focus,.fe-q:focus,.fe-add select:focus{outline:2px solid var(--navy,#2d3591);outline-offset:1px}'+
    '.fe-grp{font-size:12px;color:var(--muted,#6b7090);font-weight:700;margin:12px 0 6px}'+
    '.fe-chips{display:flex;flex-wrap:wrap;gap:8px}'+
    '.fe-chip{border:1px solid var(--line,#e4e6f2);background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:14px;cursor:pointer;color:var(--ink,#1b1f3b)}'+
    '.fe-chip.on{background:var(--navy,#2d3591);border-color:var(--navy,#2d3591);color:#fff}'+
    '.fe-table{margin-top:14px;border:1px solid var(--line,#e4e6f2);border-radius:12px;overflow:hidden}'+
    '.fe-row{display:grid;grid-template-columns:minmax(0,1fr) 104px 64px 40px;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid var(--line,#e4e6f2)}'+
    '.fe-row.h span:nth-child(2),.fe-row.h span:nth-child(3){text-align:center}'+
    '.fe-row .fe-q{text-align:center;min-height:40px}'+
    '.fe-row.h{border-top:0;background:var(--surface-2,#f7f8fc);font-size:12px;color:var(--muted,#6b7090);font-weight:700}'+
    '.fe-name{font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.fe-u{font-size:13px;color:var(--muted,#6b7090)}'+
    '.fe-x{width:34px;height:34px;border-radius:50%;border:1px solid var(--line,#e4e6f2);background:#fff;cursor:pointer;font-size:16px;color:#a31450}'+
    '.fe-empty{padding:14px;text-align:center;color:var(--muted,#6b7090);font-size:14px}'+
    '.fe-add{display:flex;gap:8px;align-items:center;margin-bottom:12px}'+
    '.fe-add select{flex:1;min-width:0;min-height:46px;border:1px solid var(--line,#e4e6f2);border-radius:12px;padding:0 12px;font:inherit;font-size:15px;background-color:var(--surface-2,#f7f8fc);color:var(--ink,#1b1f3b);appearance:none;-webkit-appearance:none;padding-inline-end:34px;background-image:url(data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%228%22%20viewBox=%220%200%2012%208%22%3E%3Cpath%20d=%22M1%201l5%205%205-5%22%20fill=%22none%22%20stroke=%22%236b7090%22%20stroke-width=%221.8%22%20stroke-linecap=%22round%22/%3E%3C/svg%3E);background-repeat:no-repeat;background-position:left 12px center}'+
    '.fe-add .btn{min-height:46px;padding-inline:18px;white-space:nowrap}'+
    '.fe-full{grid-column:1/-1}'+
    '.fe-warn{display:'+(dupNow?'block':'none')+';background:#fde3ec;color:#a31450;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:700}'+
    '.fe-foot{position:sticky;bottom:0;display:flex;gap:10px;justify-content:flex-end;padding:12px 0;background:var(--bg,#f4f5fb);border-top:1px solid var(--line,#e4e6f2)}'+
    '.fe-foot .btn{min-width:120px}'+
    '@media (max-width:360px){.fe-grid{grid-template-columns:1fr}}'+
    '@media (max-width:420px){.fe-row{grid-template-columns:minmax(0,1fr) 84px 52px 36px;gap:6px;padding:10px 8px}}'+
    '</style>';

  var groups={},order=[];
  PRODUCTS.filter(function(p){return !isFill(p)&&!p.archived&&!rows.some(function(r){return String(r.p)===String(p.id);});}).forEach(function(p){
    var g=p.grp||'بدون مجموعة';
    if(!groups[g]){groups[g]=[];order.push(g);}
    groups[g].push(p);
  });
  order.sort(function(a,b){return String(a).localeCompare(String(b),'ar');});
  var opts='<option value="">اختار خامة لإضافتها</option>'+order.map(function(g){
    return '<optgroup label="'+esc(g)+'">'+groups[g].sort(function(a,b){return String(a.name).localeCompare(String(b.name),'ar');}).map(function(p){
      return '<option value="'+p.id+'">'+esc(p.name)+'</option>';
    }).join('')+'</optgroup>';
  }).join('');
  var addBox=order.length?'<div class="fe-add"><select id="feAddSel">'+opts+'</select><button class="btn main sm" data-act="feAdd">+ أضف</button></div>':
    '<div class="fe-empty">كل الخامات اللي في المخزن الأساسي اتضافت</div>';

  var table=rows.length?rows.map(function(r){
    var sp=P(r.p)||{};
    return '<div class="fe-row"><span class="fe-name" title="'+esc(sp.name||'')+'">'+esc(sp.name||'')+'</span>'+
      '<input class="fe-q" id="feq'+r.p+'" inputmode="decimal" value="'+esc(r.q==null?'':String(r.q))+'" placeholder="0">'+
      '<span class="fe-u">'+esc(sp.unit||'')+'</span>'+
      '<button class="fe-x" data-act="feRemove" data-p="'+r.p+'" aria-label="شيل">×</button></div>';
  }).join(''):'<div class="fe-empty">مفيش خامات لسه. اختار خامة من فوق واضغط "أضف".</div>';

  return css+'<div class="fe">'+
    '<div class="fe-head"><b>'+(isNew?'صنف محشو جديد':'تعديل: '+esc(E.name||''))+'</b>'+
      '<small class="meta">'+(isNew?'اكتب البيانات واختار الخامات، وبعدين احفظ':'عدّل البيانات أو الخامات، وبعدين احفظ')+'</small></div>'+

    '<section class="fe-sec"><div class="fe-sh"><span class="fe-n">١</span><h4>بيانات الصنف</h4></div>'+
      '<div class="fe-grid">'+
        '<label class="fe-f fe-full"><span>اسم الصنف</span><input id="feName" value="'+esc(E.name||'')+'" placeholder="مثلاً: كريم بروليه" autocomplete="off"></label>'+
        '<label class="fe-f"><span>مكان التخزين</span><select id="feStore">'+FG_STORES.map(function(s){return '<option value="'+s+'"'+(s===(E.store||'عادي')?' selected':'')+'>'+storeLbl(s)+'</option>';}).join('')+'</select></label>'+
        '<div class="fe-f"><span>الصلاحية</span>'+shelfChipsHTML(E.store||'عادي',shelfNorm(E,'store'),'fedit')+'<small>بتتطبع على الملصق</small></div>'+
        '<label class="fe-f"><span>الناتج في الدفعة</span><input id="feYield" inputmode="decimal" value="'+esc(E.yield==null?'':String(E.yield))+'" placeholder="مثال: 20"><small>كام صنف بيطلع من الدفعة الواحدة</small></label>'+
        '<label class="fe-f"><span>المجموعة</span><input id="feGrp" list="feGrpList" value="'+esc(grpNow)+'" placeholder="اكتب أو اختار"><datalist id="feGrpList">'+grpOpts+'</datalist></label>'+
      '</div>'+
      '<div id="feWarn" class="fe-warn">الصنف ده موجود قبل كده، مينفعش يتكرر</div></section>'+

    '<section class="fe-sec"><div class="fe-sh"><span class="fe-n">٢</span><h4>الخامات اللي بتتسحب من المخزن الأساسي</h4></div>'+
      addBox+
      '<div class="fe-table"><div class="fe-row h"><span>الخامة</span><span>كمية الدفعة</span><span>الوحدة</span><span></span></div>'+table+'</div>'+
    '</section>'+

    '<div class="fe-foot"><button class="btn quiet" data-act="feCancel">إلغاء</button><button id="feSaveBtn" class="btn main" data-act="feSave"'+(dupNow?' disabled':'')+'>حفظ الصنف</button></div>'+
  '</div>';
}
function fgStockView(){
  var rows=fgShortRows(),raw=[],nS=shortByProduct(rows.filter(function(r){return !fgIsHidden(P(r.x.p));})).length,F=U.fgf||'all';
  var inStock=0,resAll=0;
  PRODUCTS.forEach(function(p){if(fgIsHidden(p))return;inStock+=(S.ready[p.id]||0);resAll+=fgReserved(p.id);});
  var seg='<div class="seg" role="group" aria-label="تصفية">'+[['all','مخزن التحضيرات'],['fillcust','أوردرات'],['fillshop','أوردرات المحل']].map(function(x){
    return '<button class="'+(F===x[0]?'on':'')+'" data-act="fgFilter" data-v="'+x[0]+'">'+x[1]+'</button>';
  }).join('')+'</div>'+fgSeasonRow();
  var sum='<div class="sum"><div class="tile"><b>'+PRODUCTS.filter(function(p){return !fgIsHidden(p);}).length+'</b><span>صنف</span></div>'+
    '<div class="tile"><b>'+f(inStock)+'</b><span>في المخزن</span></div>'+
    '<div class="tile"><b>'+f(resAll)+'</b><span>محجوز للأوردرات</span></div>'+
    '<div class="tile"><b style="color:'+(nS?'var(--warn)':'inherit')+'">'+nS+'</b><span>ناقص</span></div></div>';
  var body;
  var mainP=PRODUCTS.filter(function(p){return !isFill(p)&&!p.archived&&fgSeasonOK(p);});
  if(F==='short') body='<div class="empty"><b>النواقص اتنقلت لتبويب تحضير حشو</b></div>';
  else if(F==='fillcust'||F==='fillshop'){
    var fl=PRODUCTS.filter(function(p){return isFill(p)&&!p.archived&&p.fill===F.slice(4)&&fgSeasonOK(p);});
    var tb='<div class="btns" style="margin-bottom:8px"><button class="btn main sm" data-act="fillEdit" data-id="new">+ صنف جديد</button></div>';
    body=U.fedit?feHTML():tb+(fl.length?groupFillCards(fl):'<div class="empty"><b>مفيش أصناف هنا</b><span>اضغط "صنف جديد" عشان تضيف.</span></div>');
  }
  else if(!mainP.length) body='<div class="empty"><b>مفيش منتجات</b><span>ضيف وصفات الأول عشان تظهر هنا.</span></div>';
  else body=(nS?'<div class="meta" style="margin-bottom:8px">فيه '+nS+' صنف ناقص لأوردراتك، اتنقلوا لتبويب تحضير حشو</div>':'')+'<div class="grp" style="margin-top:12px">الأصناف في المخزن</div><div class="fgcards">'+mainP.map(function(p){return fgCardHTML(p,S.ready[p.id]||0,fgReserved(p.id));}).join('')+'</div>'+archSection();
  var zb=fgZeroBar();
  return head('مخزن الإنتاج','الجاهز بعد الاعتماد، والمحجوز للأوردرات، والنواقص اللي محتاجة دفعة','')+sum+'<div style="margin:12px 0">'+seg+'</div>'+zb+body;
}

var SEASON_ICO={normal:'🍞',ramadan:'🌙',mawlid:'🕌',christmas:'🎄',halloween:'🎃',boxes:'📦'};
/* اختيار الموسم: صف أفقي من البلاطات الكبيرة زي شاشة الألعاب */
var SEASON_CLR={normal:['#0E8A8C','#0B3B3D'],ramadan:['#6D28D9','#1E1B4B'],mawlid:['#B45309','#5C2A0A'],christmas:['#15803D','#7F1D1D'],halloween:['#EA580C','#1C1917'],boxes:['#475569','#1E293B']};
function seasonCardsHTML(act){
  var first=SEASONS[0];
  return '<div class="scards" data-carousel="1">'+SEASONS.map(function(x,i){var c=SEASON_CLR[x[0]]||['#475569','#1E293B'];return '<div class="scard'+(i?'':' on')+'" data-k="'+x[0]+'"><span class="sname">'+esc(x[1])+'</span></div>';}).join('')+'</div>'+
  '<div class="sbig">'+esc(first[1])+'</div><div class="sdots">'+SEASONS.map(function(x,i){return '<i'+(i?'':' class="on"')+' data-dot="'+x[0]+'"></i>';}).join('')+'</div>'+
  '<button class="btn block" data-act="'+act+'" data-v="'+first[0]+'" data-pick="1">اختار '+esc(first[1])+'</button>';
}
/* الشريحة اللي في النص بتتعلّم وتتوهّج، وزرار الاختيار بيتحدّث معاها */
function scardsFocus(box){
  var br=box.getBoundingClientRect(),mid=br.left+br.width/2,best=null,bd=Infinity;
  [].forEach.call(box.querySelectorAll('.scard'),function(c){var r=c.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-mid);if(d<bd){bd=d;best=c;}});
  if(!best)return;
  [].forEach.call(box.querySelectorAll('.scard'),function(c){c.classList.toggle('on',c===best);});
  var wrap=box.parentNode;if(!wrap)return;
  var k=best.getAttribute('data-k'),nm=best.querySelector('.sname'),name=nm?nm.textContent:'';
  var btn=wrap.querySelector('[data-pick]');if(btn){btn.setAttribute('data-v',k);btn.textContent='اختار '+name;}
  var big=wrap.querySelector('.sbig');if(big)big.textContent=name;
  [].forEach.call(wrap.querySelectorAll('[data-dot]'),function(d){d.classList.toggle('on',d.getAttribute('data-dot')===k);});
}
document.addEventListener('scroll',function(e){var t=e.target;if(t&&t.classList&&t.classList.contains('scards'))scardsFocus(t);},true);
/* سحب بالماوس (الموبايل بيتسحب بالصباع أصلاً) */
var SC_DRAG=null;
document.addEventListener('pointerdown',function(e){var box=e.target.closest&&e.target.closest('.scards');if(!box||e.pointerType!=='mouse')return;SC_DRAG={box:box,x:e.clientX,sl:box.scrollLeft,moved:false};},true);
document.addEventListener('pointermove',function(e){if(!SC_DRAG)return;var dx=e.clientX-SC_DRAG.x;if(!SC_DRAG.moved&&Math.abs(dx)>4){SC_DRAG.moved=true;SC_DRAG.box.classList.add('dragging');}if(SC_DRAG.moved)SC_DRAG.box.scrollLeft=SC_DRAG.sl-dx;},true);
document.addEventListener('pointerup',function(){if(!SC_DRAG)return;var b=SC_DRAG.box;b.classList.remove('dragging');SC_DRAG=null;},true);
function sheetHTML(){
  if(!U.sheet)return '';
  var s=U.sheet,n={},sh=[];
  s.sel.forEach(function(id){var nd=need({p:id,qty:s.q[id]||1});for(var k in nd)n[k]=r3((n[k]||0)+nd[k]);});
  if(TRACK())for(var k in n){var have=S.stock[k]||0;if(have+1e-9<n[k])sh.push({k:k,lack:n[k]-have});}
  var rows=matRows(n,null),cn={};
  s.sel.forEach(function(id){var c=compNeed({p:id,qty:s.q[id]||1});for(var k in c)cn[k]=r3((cn[k]||0)+c[k]);});
  var cshort=Object.keys(cn).filter(function(k){return (S.ready[k]||0)+1e-9<cn[k];});
  rows+=Object.keys(cn).map(function(k){
    var cp=P(k),have=S.ready[k]||0;
    return '<div class="rq"><div><b>'+esc(cp.name)+'</b><small>من مخزن الإنتاج · المتاح '+f(have)+' '+esc(cp.unit)+'</small></div><span class="qv">'+f(cn[k])+' '+esc(cp.unit)+'</span>'+(have+1e-9<cn[k]?'<span class="pill bad">ينقص '+f(r3(cn[k]-have))+'</span>':'<span class="pill ok">متوفر</span>')+'</div>';
  }).join('');
  
  /* الأصناف بتظهر بعد ما تختار الموسم بس */
  var seasonList=s.season?PRODUCTS.filter(function(x){return !isFill(x)&&!x.archived&&!!x.shop===!!s.shop&&!fgUserHidden(x)&&seasonOf(x)===s.season;}):[];
  var seasonName=(SEASONS.filter(function(x){return x[0]===s.season;})[0]||[])[1]||'';
  return '<button class="back" data-act="sheetClose" aria-label="إغلاق"></button><section class="sheet" style="--c:var(--prep)" role="dialog" aria-label="دفعة جديدة">'+
    '<h3>دفعة جديدة</h3>'+
    (!s.season?
      '<div class="meta">اختار الموسم الأول</div>'+seasonCardsHTML('sheetSeason')
    :
      '<div class="meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">الموسم: <b>'+esc(seasonName)+'</b><button class="btn ghost sm" data-act="sheetSeason" data-v="">غيّر الموسم</button></div>'+
      '<div class="meta">اختار صنف أو أكتر، وتحدد كمية كل صنف</div>'+
      (seasonList.length?'<div class="pgrid">'+seasonList.map(function(x){return pkTileHTML(x,s);}).join('')+'</div>':'<div class="empty"><b>مفيش أصناف في الموسم ده</b><span>ضيف أصناف للموسم ده من الأصناف الأول.</span></div>'))+
    ''+
    (rows?'<div><div class="meta" style="margin-bottom:6px">المواد المطلوبة</div>'+rows+'</div>':'')+
    (sh.length||cshort.length?'<div class="note">في نقص في '+(sh.length+cshort.length)+((sh.length+cshort.length)>2?' أصناف':' صنف')+(cshort.length?' (منها وصفات من مخزن الإنتاج)':'')+'. تقدر تنشئ الدفعة وتكمّل النقص قبل السحب.</div>':'')+
    '<button class="btn block" data-act="sheetCreate"'+(s.sel.length?'':' disabled')+'>'+(s.sel.length>1?'أنشئ '+s.sel.length+' دفعات':'أنشئ الدفعة')+'</button></section>';
}
function opts(a,sel){return a.map(function(x){return '<option'+(x===sel?' selected':'')+'>'+esc(x)+'</option>';}).join('');}
/* وحدات الخامة: الوحدة الأساسية + وحدات إضافية (alts: 1 وحدة = f من الوحدة الأساسية) */
function ingUnitOpts(r){
  var m=r.m?M(r.m):null;
  var base=(m&&m.unit)?m.unit:'';
  var known=[];
  if(base)known.push(base);
  ((m&&m.alts)||[]).forEach(function(a){if(known.indexOf(a.u)<0)known.push(a.u);});
  UNITS_M.concat(PROD_UNITS,['كجم','لتر','مل','ملعقة صغيرة','ملعقة كبيرة','كوب','علبة','كيس']).forEach(function(u){if(known.indexOf(u)<0)known.push(u);});
  return opts(known,r.u||base||'جرام');
}
function altsHTML(){
  var F=U.form,al=F.alts||[],base=F.unit||'جرام';
  var rows=al.map(function(a,i){
    return '<div class="iline"><span class="meta">1</span><select data-af="'+i+'" data-afk="u" aria-label="الوحدة الإضافية">'+opts(UNITS_M.filter(function(u){return u!==base;}),a.u)+'</select><span class="meta">=</span><input data-af="'+i+'" data-afk="f" inputmode="decimal" placeholder="كام '+esc(base)+'" value="'+esc(a.f)+'" aria-label="عدد الوحدة الأساسية"><span class="meta">'+esc(base)+'</span><button class="xbtn" data-act="altDel" data-i="'+i+'" aria-label="احذف الوحدة">×</button></div>';
  }).join('');
  return '<span class="sec-l">وحدات إضافية للخامة</span><div class="stack">'+rows+'</div><button class="btn ghost sm" style="align-self:flex-start" data-act="altAdd">'+svg('plus')+'وحدة</button>';
}
function fld(key,label,o){
  o=o||{};
  return '<div class="fld"><label for="f_'+key+'">'+label+'</label><input id="f_'+key+'" data-f="'+key+'" type="'+(o.type||'text')+'"'+(o.im?' inputmode="'+o.im+'"':'')+(o.ph?' placeholder="'+o.ph+'"':'')+(o.list?' list="'+o.list+'"':'')+' value="'+esc(U.form[key])+'" autocomplete="off">'+(o.hint?'<small>'+o.hint+'</small>':'')+'</div>';
}
function sel(key,label,arr){return '<div class="fld"><label for="f_'+key+'">'+label+'</label><select id="f_'+key+'" data-f="'+key+'">'+opts(arr,U.form[key])+'</select></div>';}
function area(){return '<div class="fld"><label for="f_notes">ملاحظات</label><textarea id="f_notes" data-f="notes" rows="3">'+esc(U.form.notes)+'</textarea></div>';}
function catList(arr){var c={};arr.forEach(function(x){c[unesc(x.cat)]=1;});return '<datalist id="catl">'+Object.keys(c).map(function(k){return '<option value="'+esc(k)+'">';}).join('')+'</datalist>';}
function matFormHTML(){
  var F=U.form,edit=!!F.edit;
  return '<h3>'+(edit?'تعديل خامة':'خامة جديدة')+'</h3>'+
    fld('name','اسم الصنف',{ph:'مثال: دقيق فاخر'})+
    '<div class="frow">'+fld('cat','التصنيف',{list:'catl',ph:'دقيق، سكر، ألبان...'})+sel('unit','وحدة القياس',UNITS_M)+'</div>'+catList(MATERIALS)+
    (TRACK()?(fld('min','حد إعادة الطلب',{im:'decimal',hint:'أقل من كده الصنف يتعلّم ناقص'})+(edit?'':fld('qty','الكمية الحالية في المخزن',{im:'decimal'}))+'<div class="frow">'+sel('storage','مكان التخزين',STORES)+fld('exp','تاريخ الصلاحية',{type:'date'})+'</div>'+fld('supplier','المورد',{ph:'اسم المورد أو رقمه'})):'')+altsHTML()+area();
}
function stageForm(g,gi,n,cnt){
  var ings=g.ings.map(function(r,ii){
    var at='data-gi="'+gi+'" data-ii="'+ii+'"';
    return '<div class="iline"><input '+at+' data-fd="n" placeholder="المكوّن" value="'+esc(r.n)+'" aria-label="المكوّن" autocomplete="off"><input '+at+' data-fd="q" inputmode="decimal" placeholder="الكمية" value="'+esc(r.q)+'" aria-label="الكمية للوحدة"><select '+at+' data-fd="u" aria-label="الوحدة">'+ingUnitOpts(r)+'</select><button class="xbtn" data-act="ingDel" data-gi="'+gi+'" data-ii="'+ii+'" aria-label="احذف المكوّن">×</button></div><div class="msug" data-msug="'+gi+'-'+ii+'"></div>';
  }).join('');
  var steps=g.steps.map(function(t,ti){
    return '<div class="sline"><input data-gi="'+gi+'" data-ti="'+ti+'" value="'+esc(t)+'" placeholder="خطوة '+(ti+1)+'" aria-label="خطوة '+(ti+1)+'"><button class="xbtn" data-act="stepDel" data-gi="'+gi+'" data-ti="'+ti+'" aria-label="احذف الخطوة">×</button></div>';
  }).join('');
  return '<div class="sgf"><span class="sec-l">'+'مرحلة تحضير'+' '+(n+1)+'</span><div class="sgt">'+('<span class="meta">بتتسمّى تلقائي: مرحلة '+(n+1)+'</span>')+
    '<button class="xbtn" style="color:var(--ink)" data-act="stMove" data-gi="'+gi+'" data-d="-1"'+(n<=0?' disabled':'')+' aria-label="للأعلى">↑</button><button class="xbtn" style="color:var(--ink)" data-act="stMove" data-gi="'+gi+'" data-d="1"'+(n>=cnt-1?' disabled':'')+' aria-label="للأسفل">↓</button><button class="xbtn" data-act="stDel" data-gi="'+gi+'" aria-label="احذف المرحلة">×</button></div>'+
    '<span class="sec-l">المكوّنات</span><div class="stack">'+ings+'</div><button class="btn ghost sm" style="align-self:flex-start" data-act="ingAdd" data-gi="'+gi+'">'+svg('plus')+'مكوّن</button>'+
    '<span class="sec-l">الخطوات</span><div class="stack">'+steps+'</div><button class="btn ghost sm" style="align-self:flex-start" data-act="stepAdd" data-gi="'+gi+'">'+svg('plus')+'خطوة</button></div>';
}
function compsFormHTML(F){
  var st='height:44px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--ink);padding:0 8px;font-size:15px;min-width:0;width:100%';
  var rows=(F.comps||[]).map(function(c,i){
    return '<div class="sline" style="grid-template-columns:minmax(0,1fr) 76px 36px"><select data-ci="'+i+'" data-cf="p" style="'+st+'" aria-label="الوصفة الفرعية"><option value="">اختار وصفة...</option>'+
      PRODUCTS.filter(function(x){return x.id!==F.edit&&!x.archived;}).map(function(x){return '<option value="'+x.id+'"'+(c.p===x.id?' selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select>'+
      '<input data-ci="'+i+'" data-cf="q" inputmode="decimal" placeholder="الكمية" value="'+esc(c.q)+'" aria-label="الكمية للوجبة الواحدة"><button class="xbtn" data-act="compDel" data-i="'+i+'" aria-label="احذف">×</button></div>';
  }).join('');
  return '<div class="fld"><span class="sec-l">وصفات فرعية من مخزن الإنتاج ('+(F.comps||[]).length+')</span><div class="meta">وصفات جاهزة بتتسحب من مخزن الإنتاج، زي كيك الفراولة جوه كيك الراسبيري. اكتب الكمية اللي الوجبة الواحدة بتاخدها بوحدة الصنف (قطع أو جرام أو كجم).</div><div class="stack">'+rows+'</div><button class="btn ghost sm" style="align-self:flex-start" data-act="compAdd">'+svg('plus')+'وصفة فرعية</button></div>';
}
function prodFormHTML(){
  var F=U.form,edit=!!F.edit;
  function sect(kind,title,add){
    var idx=[];F.stages.forEach(function(g,gi){if(g.kind===kind)idx.push(gi);});
    return '<div class="fld"><span class="sec-l">'+title+' ('+idx.length+')</span><div class="stack">'+idx.map(function(gi,n){return stageForm(F.stages[gi],gi,n,idx.length);}).join('')+'</div><button class="btn ghost sm" style="align-self:flex-start" data-act="stAdd" data-k="'+kind+'">'+svg('plus')+add+'</button></div>';
  }
  var sn={'وزن الصنف':1,'حمام بخار':1,'ضرب في المكنة':1,'خلط':1,'تسوية':1,'تبريد':1,'تقديم':1};
  PRODUCTS.forEach(function(p){(p.stages||[]).forEach(function(g){sn[unesc(g.name)]=1;});});
  return '<h3>'+(edit?'تعديل وصفة':'وصفة جديدة')+'</h3>'+
    seasonSeg(F.season||'normal','prodSeason')+'<div class="seg" style="align-self:flex-start"><button class="'+(F.shop?'':'on')+'" data-act="prodKind" data-v="reg">وصفة عادية</button><button class="'+(F.shop?'on':'')+'" data-act="prodKind" data-v="shop">وصفة المحل</button></div>'+
    
fld('name','اسم المنتج',{ph:'مثال: تورتة فراولة'})+
    fld('group','مجموعة التحضير (اختياري)',{ph:'مثال: ام علي',hint:'الأصناف اللي ليها نفس المجموعة بتتجمع في شاشة التحضير'})+
    '<div class="frow">'+'<div class="fld"><label for="f_fgStore">مكان التخزين في مخزن الإنتاج</label><select id="f_fgStore" data-f="fgStore">'+FG_STORES.map(function(x){return '<option value="'+x+'"'+(x===(U.form.fgStore||FG_STORES[0])?' selected':'')+'>'+storeLbl(x)+'</option>';}).join('')+'</select></div>'+'<div class="fld"><label>الصلاحية</label>'+shelfChipsHTML(U.form.fgStore||FG_STORES[0],shelfNorm(U.form,'fgStore'),'form')+'<small>بتتطبع على ملصق الصنف</small></div>'+'</div>'+
    '<div class="frow">'+fld('mins','وقت التشغيل (دقيقة) · اختياري',{im:'numeric',hint:'سيبه فاضي لو الصنف مش بيدخل فرن، ويتعتمد على طول'})+fld('temp','درجة الحرارة (°م)',{im:'numeric',hint:'اختياري، بتظهر في الإنتاج'})+'</div>'+
    '<div class="frow">'+sel('unit','وحدة الإنتاج',PROD_UNITS)+fld('yield',isPiece(F)?'عدد القطع اللي الوصفة بتطلعها (لكل وحدة)':'الوزن اللي الوصفة بتطلعه لكل وجبة ('+F.unit+')',{im:qIM(F),hint:isPiece(F)?'':'مثال: لو الوجبة بتطلع 1200 جرام اكتب 1200'})+'</div>'+
    '<datalist id="matl">'+(function(d){return MATERIALS.map(function(m){return '<option value="'+esc(matOptLabel(m,d))+'">';}).join('');})(matDupNames())+'</datalist>'+
    '<datalist id="stagel">'+Object.keys(sn).map(function(k){return '<option value="'+esc(k)+'">';}).join('')+'</datalist>'+
    '<div class="meta">كل مرحلة ليها مكوّناتها وخطواتها، والترتيب اللي تحدده هو اللي يظهر. اكتب أي مكوّن جديد وهيتضاف تلقائي.</div>'+
    sect('prep','مراحل التحضير','مرحلة تحضير')+compsFormHTML(F)+area();
}
function formHTML(){
  if(!U.form)return '';
  var F=U.form,k=F.kind,edit=!!F.edit;
  return '<button class="back" data-act="formClose" aria-label="إغلاق"></button><section class="sheet f" style="--c:var(--'+'recipes'+')" role="dialog" aria-label="نموذج"><div class="sbody">'+(k==='mat'?matFormHTML():prodFormHTML())+'</div><div class="sfoot"><button class="btn main" data-act="formSave">'+(edit?'احفظ التعديلات':(k==='mat'?'أضف الخامة':'أضف الوصفة'))+'</button>'+(edit?'<button class="btn ghost" data-act="formDelete">'+(U.confirm==='del'?'اضغط تاني':((P(edit)||{}).archived?'حذف نهائي':'حذف'))+'</button>':'')+'<button class="btn ghost" data-act="formClose">إلغاء</button></div></section>';
}
/* حذف نهائي للصنف المؤرشف: بيتشال من كل القوايم، والسجلات القديمة بتفضل بالاسم والكود */
function permDelete(p){
  if((S.ready[p.id]||0)>0){toast('صفّر مخزون الصنف الأول');render();return false;}
  if(S.batches.some(function(b){return b.p===p.id;})||(S.orders||[]).some(function(o){return !o.deliveredAt&&(o.items||[]).some(function(it){return it.p===p.id;});})){toast('فيه دفعات أو أوردرات مفتوحة على الصنف ده، خلّصها الأول');render();return false;}
  if(PRODUCTS.some(function(x){return x!==p&&(x.comps||[]).some(function(c){return c.p===p.id;});})){toast('الصنف ده داخل كوصفة فرعية، شيله منها الأول');render();return false;}
  p.gone=true;p.archived=true;p.stages=[];p.comps=[];p.recipe={};
  delete S.ready[p.id];
  bind(S);U.form=null;toast('اتحذف الصنف نهائياً، السجلات القديمة فضلت محفوظة');
  return true;
}
function archSection(){
  var a=PRODUCTS.filter(function(p){return p.archived&&!p.gone;});
  if(!a.length)return '';
  return '<div class="grp" style="margin-top:18px">الأصناف المؤرشفة ('+a.length+')</div>'+a.map(function(p){
    return '<div class="hist" style="align-items:center"><span><b>'+esc(p.name)+'</b><br><span class="meta">'+esc(p.code||'')+'</span></span>'+(limited()?'':'<button class="btn ghost sm" data-act="archDel" data-p="'+p.id+'">'+(U.confirm==='arch'+p.id?'اضغط تاني للتأكيد':'حذف نهائي')+'</button>')+'</div>';
  }).join('');
}
function saveMat(F){
  var name=F.name.trim();
  if(!name){toast('اكتب اسم الصنف');return false;}
  var min=F.min===''?0:num(F.min);if(!isFinite(min)||min<0){toast('حد إعادة الطلب غير صحيح');return false;}
  var qty=F.qty===''?0:num(F.qty);if(!isFinite(qty)||qty<0){toast('الكمية غير صحيحة');return false;}
  var alts=[],altBad=null;(F.alts||[]).forEach(function(a){if(!a.u||a.u===F.unit)return;var af=num(a.f);if(!isFinite(af)||af<=0){altBad=altBad||'اكتب كام '+F.unit+' في '+a.u+' الواحدة';return;}alts.push({u:a.u,f:r3(af)});});
  if(altBad){toast(altBad);return false;}
  var dup=MATERIALS.some(function(m){return m.id!==F.edit&&(m.unit||'')===(F.unit||'')&&unesc(m.name).trim().toLowerCase()===name.toLowerCase();});
  if(dup){toast('الاسم ده موجود قبل كده');return false;}
  var o={name:esc(name),cat:esc((F.cat||'').trim()||'عام'),unit:F.unit,min:min,storage:F.storage,exp:F.exp||'',supplier:esc((F.supplier||'').trim()),notes:esc((F.notes||'').trim()),alts:alts};
  if(F.edit&&F.origUnit!==undefined&&F.unit!==F.origUnit){
    /* تغيير الوحدة بيعمل نسخة جديدة بالوحدة الجديدة، والخامة الأصلية تفضل زي ما هي عشان الوصفات القديمة ما تتكسرش */
    o.id='m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    S.materials.push(o);S.stock[o.id]=0;
    toast('اتعملت نسخة من '+name+' بالوحدة '+F.unit+' (الأصلية فضلت زي ما هي)');
  }
  else if(F.edit){Object.assign(M(F.edit),o);toast('تم حفظ التعديلات');}
  else{o.id='m'+Date.now().toString(36);S.materials.push(o);S.stock[o.id]=r3(qty);toast('تمت إضافة '+name);}
  U.form=null;

}
/* مكان التخزين لكل صنف في مخزن الإنتاج: عادي / ثلاجة / فريزر */
var FG_STORES=['عادي','ثلاجة','فريزر'];
/* الاسم اللي بيظهر للمستخدم: "عادي" معناها خارج التلاجة (الاسم المخزّن ما اتغيرش عشان البيانات القديمة) */
function storeLbl(x){return x==='عادي'?'خارج التلاجة':x;}
/* مدة الصلاحية حسب مكان التخزين: المكان بيحدد الاختيارات، ولو فيه خيار واحد بيتطبق لوحده */
var SHELF_PRESETS={'فريزر':['شهر'],'ثلاجة':['أسبوع','3 أيام','يوم واحد'],'عادي':['يوم واحد','3 أيام','أسبوع','شهر']};
function shelfSelHTML(id,store,cur,attrs){
  var opts=SHELF_PRESETS[store]||[];
  var body=opts.length?'':'<option value="">—</option>';
  return '<select id="'+id+'"'+(attrs||'')+'>'+body+
    opts.map(function(x){return '<option'+(x===cur?' selected':'')+'>'+x+'</option>';}).join('')+'</select>';
}
function shelfChipsHTML(store,cur,target){
  var opts=SHELF_PRESETS[store]||[];
  if(!opts.length)return '<span class="meta">مفيش مدة للمكان ده</span>';
  return '<div class="seg" style="flex-wrap:wrap">'+opts.map(function(x){
    return '<button type="button" class="'+(x===cur?'on':'')+'" data-act="shelfPick" data-t="'+target+'" data-v="'+esc(x)+'">'+esc(x)+'</button>';
  }).join('')+'</div>';
}
/* مكان فيه مدة واحدة: بتتطبق لوحدها. مكان فيه أكتر من مدة: الافتراضي أول اختيار (أسبوع للتلاجة) إلا لو المستخدم اختار حاجة من القايمة */
function shelfForStore(store,cur){
  var pr=SHELF_PRESETS[store]||[];
  if(!pr.length)return '';
  if(pr.length===1)return pr[0];
  return pr.indexOf(cur)>-1?cur:pr[0];
}
/* تثبيت القيمة في الكائن قبل ما الفورم يترسم، عشان الاختيار اللي بيظهر هو اللي بيتحفظ */
function shelfNorm(o,storeField){
  var st=o[storeField]||FG_STORES[0];
  o.shelf=shelfForStore(st,o.shelf);
  return o.shelf;
}
function fgStoreOf(p){return p&&FG_STORES.indexOf(p.fgStore)>-1?p.fgStore:'عادي';}
function fgStoreBadge(p){return '<span class="fgst fgst-'+({'ثلاجة':'fridge','فريزر':'freezer'}[fgStoreOf(p)]||'dry')+'">'+esc(fgStoreOf(p))+'</span>';}

/* ---------- ملصق الصنف للطابعة الحرارية ---------- */
/* مقاس الاستيكر بالمليمتر: غيّره لو الاستيكر عندك مقاس تاني (مثلاً 40 × 30 أو 58 × 40) */
var LBL_W_MM=50, LBL_H_MM=30; /* التصميم الأساسي للملصق، والباقي بيتكبر أو يتصغر تلقائي حسب الورق */
var LBL_DPMM=7.68; /* كثافة الطباعة الحرارية: 384 نقطة لعرض 50 مم */
/* مقاسات الورق: الاستيكرات (roll) بتتطبع بالطابعة الحرارية أو المتصفح، والـ A تتطبع من المتصفح بس */
var LBL_PAPERS=[
  {k:'50x30',n:'50 × 30 مم (افتراضي)',w:50,h:30},
  {k:'40x30',n:'40 × 30 مم',w:40,h:30},
  {k:'40x25',n:'40 × 25 مم',w:40,h:25}];
function lblPaperOf(L){var k=(L&&L.paper)||'50x30';for(var i=0;i<LBL_PAPERS.length;i++)if(LBL_PAPERS[i].k===k)return LBL_PAPERS[i];return LBL_PAPERS[0];}
function lblScale(pp){return Math.min(pp.w/LBL_W_MM,pp.h/LBL_H_MM);}
/* يحط الملصق في صفحة الورق المختارة: مكبّر أو مصغّر وفي النص */
function lblPageWrap(inner,pp){
  var s=lblScale(pp),ox=(pp.w-LBL_W_MM*s)/2,oy=(pp.h-LBL_H_MM*s)/2;
  return '<div class="lblpg" style="width:'+pp.w+'mm;height:'+pp.h+'mm;position:relative;overflow:hidden"><div style="position:absolute;left:'+ox.toFixed(2)+'mm;top:'+oy.toFixed(2)+'mm;transform:scale('+s.toFixed(4)+');transform-origin:0 0">'+inner+'</div></div>';
}
/* قالب الملصق: اللوجو الصغير على الشمال فوق (مربع أزرق RMY) */
var LBL_LOGO_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="85 213 339 86" width="339" height="86"><g fill="#2B3595" fill-rule="evenodd"><path d="M87 215 H150 Q185 215 185 245 Q185 268 165 275 L185 297 H160 L140 277 H108 V297 H87 Z M108 236 V256 H150 Q163 256 163 246 Q163 236 150 236 Z"/><path d="M195 215 H222 L250 262 L278 215 H305 V297 H283 V248 L258 288 H242 L217 248 V297 H195 Z"/><path d="M308 215 H333 L364 254 L395 215 H422 L380 270 V297 H355 V270 Z"/></g></svg>';
function lblLogoSVG(){return LBL_LOGO_SVG.replace('<svg ','<svg class="lbl-logo" aria-hidden="true" ');}
var LBL_IMG=new Image();
LBL_IMG.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(LBL_LOGO_SVG);
function fgProdDate(p){
  var ts=0;
  if(isFill(p)&&Array.isArray(p.fillRuns)){p.fillRuns.forEach(function(r){if((r.at||0)>ts)ts=r.at;});}
  else{S.done.forEach(function(d){if(d.p===p.id&&(d.at||0)>ts)ts=d.at;});}
  return ts?new Date(ts).toLocaleDateString('en-GB'):'';
}
/* ---------- نافذة طباعة الملصقات: معاينة + طريقة الطباعة + عدد النسخ ---------- */
function lblCss(){
  return '.lbl{width:'+LBL_W_MM+'mm;height:'+LBL_H_MM+'mm;box-sizing:border-box;padding:.8mm 1.4mm;display:flex;flex-direction:column;justify-content:flex-start;overflow:hidden;font-family:Tahoma,Arial,sans-serif;color:#000;background:#fff}'+
    '.lbl-top{display:flex;align-items:center;gap:1mm;border-bottom:1px solid #000;padding-bottom:.4mm;margin-bottom:.5mm}'+
    '.lbl-logo{display:block;width:13mm;height:auto;flex:0 0 auto}'+
    '.lbl-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:flex-start}'+
    '.lbl-name{flex:1 1 auto;min-width:0;font-size:9pt;font-weight:700;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '.lbl-row{display:flex;justify-content:space-between;align-items:baseline;font-size:7.5pt;line-height:1.15;gap:2mm;white-space:nowrap}'+
    '.lbl-row span{color:#333}'+
    '.lbl-codes{margin-top:.4mm;padding-top:.3mm;border-top:1px dashed #000;font-size:7pt;line-height:1.15}'+
    '.lbl-codes span{color:#333;font-weight:700}'+
    '.lbl-codes b{display:block;font-weight:700;direction:ltr;text-align:right;word-break:break-all;max-height:6mm;overflow:hidden}';
}
function lblItems(){var L=U.lbl;return L&&L.ids?L.ids.map(function(id){return P(id);}).filter(Boolean):[];}
function lblSheetHTML(){
  var L=U.lbl;if(!L)return '';
  var list=lblItems();if(!list.length)return '';
  var idx=Math.min(L.i||0,list.length-1),cur=list[idx],copies=L.copies||1,total=list.length*copies;
  var method=L.method||'bt',pp=lblPaperOf(L);
  var scale=300/(LBL_W_MM*96/25.4);
  var preview='<style>'+lblCss()+'</style><div class="lblprev"><div class="lblprev-in" style="transform:scale('+scale.toFixed(3)+')">'+fgLabelHTML(cur)+'</div></div>';
  var chips=list.length>1?'<div class="lblchips">'+list.map(function(p,i){return '<button class="'+(i===idx?'on':'')+'" data-act="lblPick" data-i="'+i+'">'+esc(unesc(p.name))+'</button>';}).join('')+'</div>':'';
  var mSeg=[['bt','🔵 بلوتوث'],['raw','📲 RawBT'],['web','🖨️ المتصفح']].map(function(x){
    return '<button class="'+(method===x[0]?'on':'')+'" data-act="lblMethod" data-v="'+x[0]+'">'+x[1]+'</button>';}).join('');
  return '<button class="back" data-act="lblClose" aria-label="إغلاق"></button>'+
    '<section class="sheet f" style="--c:var(--stock)" role="dialog" aria-label="طباعة الملصقات"><div class="sbody">'+
      '<h3>طباعة الملصقات</h3>'+
      '<div class="meta">'+(list.length>1?list.length+' صنف':'صنف واحد')+' · راجع المعاينة قبل الطباعة</div>'+
      '<div class="sec-l" style="margin-top:12px">المعاينة</div>'+preview+chips+
      '<div class="sec-l" style="margin-top:14px">مقاس الاستيكر (الطابعة الحرارية)</div><select class="permSecSel" data-lblpaper="1">'+LBL_PAPERS.map(function(q){return '<option value="'+q.k+'"'+(pp.k===q.k?' selected':'')+'>'+q.n+'</option>';}).join('')+'</select>'+
      '<div class="sec-l" style="margin-top:14px">طريقة الطباعة</div>'+
      '<div class="meta" style="font-size:12px;margin-bottom:6px">'+(printerInfo().id?'🔵 الطابعة: <b>'+esc(unesc(printerInfo().name||'طابعة'))+'</b>':'مفيش طابعة بلوتوث مربوطة، اربطها من الإعدادات')+'</div>'+
      '<div class="seg lblseg" role="group" aria-label="طريقة الطباعة">'+mSeg+'</div>'+
      '<div class="sec-l" style="margin-top:14px">عدد النسخ لكل صنف</div>'+
      '<div class="lblcopies"><button data-act="lblCopies" data-d="-1"'+(copies<=1?' disabled':'')+' aria-label="أنقص">−</button><b>'+copies+'</b><button data-act="lblCopies" data-d="1"'+(copies>=20?' disabled':'')+' aria-label="زوّد">+</button></div>'+
    '</div><div class="sfoot"><button class="btn main" data-act="lblPrint">🖨️ طباعة '+total+' ملصق</button><button class="btn ghost" data-act="lblClose">إغلاق</button></div></section>'+
    '<style>'+
    '.lblprev{width:300px;height:180px;margin:6px auto 4px;overflow:hidden;direction:ltr;border:1px solid var(--line);border-radius:12px;background:#fff;position:relative;box-shadow:0 2px 10px rgba(0,0,0,.06)}'+
    '.lblprev-in{position:absolute;left:0;top:0;direction:rtl;transform-origin:0 0;width:'+(LBL_W_MM*96/25.4).toFixed(1)+'px}'+
    '.lblchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.lblchips button{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.lblchips button.on{background:var(--stock,#2d3591);border-color:transparent;color:#fff}'+
    '.lblseg{display:flex;width:100%}.lblseg button{flex:1}'+
    '.lblcopies{display:inline-flex;align-items:center;gap:14px;border:1px solid var(--line);border-radius:999px;padding:4px;background:var(--surface)}'+
    '.lblcopies button{width:40px;height:40px;border-radius:50%;border:0;background:var(--surface-2,#f3f4f8);color:var(--ink);font:inherit;font-size:20px;cursor:pointer}.lblcopies button:disabled{opacity:.4}.lblcopies b{min-width:28px;text-align:center;font-size:18px}'+
    '.lbl-open{width:100%;margin-top:8px}'+
    '</style>';
}
/* أكواد الخامات المسحوبة للصنف (نفس اللي بتظهر في الكارت) */
function fgSrcCodes(p){
  if(!isFill(p))return [];
  var cs=(p.srcCodes||[]).slice();
  if(Array.isArray(p.fillRuns)&&p.fillRuns.length){
    var seen={};cs=[];
    p.fillRuns.forEach(function(r){(r.from||[]).forEach(function(x){var q=P(x.p);var c=q&&q.code;if(c&&!seen[c]){seen[c]=1;cs.push(c);}});});
  }
  return cs;
}
function fgLabelHTML(p){
  var name=unesc(p.name||''),code=String(p.code||'-'),store=fgStoreOf(p),date=fgProdDate(p),cs=fgSrcCodes(p);
  var codes=cs.length?'<div class="lbl-codes"><span>الخامات المسحوبة</span><b>'+cs.map(function(c){return esc(sid(c));}).join(' · ')+'</b></div>':'';
  return '<div class="lbl"><div class="lbl-body">'+
    '<div class="lbl-top"><div class="lbl-name">'+esc(name)+'</div>'+lblLogoSVG()+'</div>'+
    '<div class="lbl-row"><span>الكود</span><b dir="ltr">'+esc(code)+'</b></div>'+
    '<div class="lbl-row"><span>التخزين</span><b>'+esc(store)+'</b></div>'+
    '<div class="lbl-row"><span>الصلاحية</span><b>'+esc(unesc(p.shelf||'')||'-')+'</b></div>'+
    '<div class="lbl-row"><span>تاريخ الإنتاج</span><b dir="ltr">'+esc(date||'-')+'</b></div>'+
    codes+
  '</div></div>';
}
/* الطباعة في إطار مخفي بمقاس الاستيكر بالظبط (من غير CSS الصفحة عشان ميتأثرش) */
function doPrintLabel(html,pp){
  pp=pp||lblPaperOf();
  var f=document.createElement('iframe');
  f.setAttribute('aria-hidden','true');
  f.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
  document.body.appendChild(f);
  var d=f.contentWindow.document;
  d.open();
  d.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>'+
    '@page{size:'+pp.w+'mm '+pp.h+'mm;margin:0}'+'.lblpg{page-break-after:always}.lblpg:last-child{page-break-after:auto}'+
    'html,body{margin:0;padding:0;background:#fff;color:#000}'+
    lblCss()+
    '</style></head><body>'+html+'</body></html>');
  d.close();
  setTimeout(function(){
    try{f.contentWindow.focus();f.contentWindow.print();}catch(e){toast('الطباعة مش متاحة هنا، افتح الصفحة من المتصفح');}
    setTimeout(function(){f.remove();},3000);
  },500);
}

/* ---------- طباعة مباشرة على الطابعة الحرارية (بلوتوث) ---------- */
/* الطباعة بترسم الملصق صورة (عشان العربي يطلع صح على أي طابعة) وتبعتها بأوامر ESC/POS */
var LBL_DOTS_W=384;  /* عرض الورق 58 مم = 384 نقطة */
var LBL_DOTS_H=240;  /* ارتفاع الملصق 30 مم بكثافة 203 DPI */
var BT_SERVICES=['000018f0-0000-1000-8000-00805f9b34fb','0000ff00-0000-1000-8000-00805f9b34fb','0000ffe0-0000-1000-8000-00805f9b34fb','0000fee7-0000-1000-8000-00805f9b34fb','49535343-fe7d-4ae5-8fa9-9fafd205e455','e7810a71-73ae-499d-8c15-faa9aef0c3f2'];
function fgLabelCanvas(p,withLogo,pp){
  pp=pp||lblPaperOf();
  var W=Math.round(pp.w*LBL_DPMM),H=Math.round(pp.h*LBL_DPMM),s=lblScale(pp);
  function sc(n){return Math.round(n*s);}
  var c=document.createElement('canvas');c.width=W;c.height=H;
  var x=c.getContext('2d'),pad=sc(8),TW=W-2*pad,RX=W-pad,LX=pad;
  x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';x.textBaseline='top';
  function F(n,b){return (b?'bold ':'')+sc(n)+'px Tahoma, Arial, sans-serif';}
  function fit(t,max){if(x.measureText(t).width<=max)return t;while(t.length>1&&x.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…';}
  var y=sc(6),LW=sc(104),LH=Math.round(sc(104)*86/339);
  var name=unesc(p.name||'');
  /* اللوجو الصغير فوق على الشمال، والاسم جنبه على اليمين */
  var hasLogo=withLogo&&LBL_IMG.complete&&LBL_IMG.naturalWidth>0;
  if(hasLogo)x.drawImage(LBL_IMG,LX,y,LW,LH);
  x.font=F(26,1);x.textAlign='right';
  x.fillText(fit(name,TW-(hasLogo?LW+sc(4):0)),RX,y+sc(3));
  y+=Math.max(LH,sc(30))+sc(2);
  x.fillRect(LX,y,TW,Math.max(1,sc(2)));y+=sc(5);
  var rows=[['الكود',String(p.code||'-')],['التخزين',fgStoreOf(p)],['الصلاحية',unesc(p.shelf||'')||'-'],['تاريخ الإنتاج',fgProdDate(p)||'-']];
  rows.forEach(function(r){
    x.font=F(18);x.textAlign='right';x.fillText(r[0],RX,y);
    var lw=x.measureText(r[0]).width;
    x.textAlign='left';x.font=F(18,1);x.fillText(fit(r[1],TW-lw-sc(10)),LX,y);
    y+=sc(21);
  });
  var cs=fgSrcCodes(p);
  if(cs.length){
    y+=sc(2);x.fillRect(LX,y,TW,1);y+=sc(4);
    x.font=F(17,1);x.textAlign='right';x.fillText('الخامات المسحوبة',RX,y);y+=sc(18);
    var txt=cs.map(function(c){return sid(c);}).join(' · ');
    x.font=F(17,1);x.textAlign='right';
    var lines=[],cur='';
    txt.split(' ').forEach(function(w){var t=cur?cur+' '+w:w;if(x.measureText(t).width<=TW)cur=t;else{lines.push(cur);cur=w;}});
    if(cur)lines.push(cur);
    lines.slice(0,2).forEach(function(l,i,arr){
      var t=(i===arr.length-1&&lines.length>2)?fit(l,TW):l;
      x.fillText(t,RX,y);y+=sc(18);
    });
  }
  return x.getImageData(0,0,W,H);
}
/* أوامر ESC/POS: تهيئة + صورة raster (GS v 0) + تغذية ورق */
function fgLabelEscpos(p,pp){
  pp=pp||lblPaperOf();
  var img;try{img=fgLabelCanvas(p,true,pp);}catch(e){img=fgLabelCanvas(p,false,pp);}
  var W=img.width,H=img.height,rb=Math.ceil(W/8),d=img.data;
  var out=[0x1B,0x40,0x1D,0x76,0x30,0x00,rb&255,rb>>8,H&255,H>>8];
  for(var y=0;y<H;y++){
    for(var bx=0;bx<rb;bx++){
      var v=0;
      for(var b=0;b<8;b++){
        var x=bx*8+b,bit=0;
        if(x<W){var i=(y*W+x)*4;if(d[i]*0.3+d[i+1]*0.59+d[i+2]*0.11<128)bit=1;}
        v=(v<<1)|bit;
      }
      out.push(v);
    }
  }
  out.push(0x1B,0x64,0x04);
  return new Uint8Array(out);
}
function bytesToB64(u8){var s='';for(var i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return btoa(s);}
/* RawBT: تطبيق أندرويد بيطبع على الطابعات البلوتوث الكلاسيكية (أغلب الطابعات الرخيصة) */
function printBytesRaw(bytes){
  window.location.href='rawbt:base64,'+bytesToB64(bytes);
  toast('لو ماحصلش طباعة، ثبّت تطبيق RawBT وزوّد الطابعة في البلوتوث');
}
/* Web Bluetooth: للطابعات اللي بتشتغل BLE بس، ومتدعمة في Chrome على أندرويد */
function btFindWritable(server){
  return server.getPrimaryServices().then(function(services){
    var found=null;
    return services.reduce(function(chain,svc){
      return chain.then(function(){
        if(found)return;
        return svc.getCharacteristics().then(function(chars){
          chars.forEach(function(ch){if(!found&&(ch.properties.write||ch.properties.writeWithoutResponse))found=ch;});
        });
      });
    },Promise.resolve()).then(function(){if(!found)throw new Error('no-writable');return found;});
  });
}
function btWriteAll(ch,bytes){
  var CH=180,i=0;
  function next(){
    if(i>=bytes.length)return Promise.resolve();
    var part=bytes.slice(i,i+CH);i+=CH;
    var pr=ch.properties.writeWithoutResponse?ch.writeValueWithoutResponse(part):ch.writeValue(part);
    return pr.then(function(){return new Promise(function(r){setTimeout(r,25);});}).then(next);
  }
  return next();
}
function printWithDevice(dev,bytes){
  return dev.gatt.connect().then(function(server){
    return btFindWritable(server).then(function(ch){
      return btWriteAll(ch,bytes).then(function(){dev.gatt.disconnect();});
    });
  }).then(function(){toast('اتبعت الملصقات للطابعة');})
    .catch(function(){toast('الطابعة مش بتستجيب، اتأكد إنها شغالة ومتربطة');});
}
function printBytesBT(bytes){
  if(!navigator.bluetooth){toast('المتصفح ده مش بيدعم البلوتوث، استخدم RawBT');return;}
  var saved=printerInfo().id;
  if(saved&&navigator.bluetooth.getDevices){
    /* الطابعة اتربطت قبل كده: بنلاقيها من غير picker */
    navigator.bluetooth.getDevices().then(function(list){
      var dev=list.filter(function(d){return d.id===saved;})[0];
      if(dev)return printWithDevice(dev,bytes);
      toast('الطابعة محتاجة ربط تاني من الإعدادات');
    }).catch(function(){toast('تعذّر الوصول للطابعة، اربطها من الإعدادات');});
    return;
  }
  /* أول مرة: لازم picker من ضغطة المستخدم */
  navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:BT_SERVICES})
    .then(function(dev){
      S.printer=Object.assign({},printerInfo(),{id:dev.id,name:dev.name||'طابعة'});
      save();
      return printWithDevice(dev,bytes);
    })
    .catch(function(e){if(e&&e.name!=='NotFoundError')toast('الطابعة دي مش BLE، جرب RawBT');});
}
function saveProd(F){
  var name=F.name.trim();
  if(!name){toast('اكتب اسم المنتج');return false;}
  var mins=0;if(String(F.mins==null?'':F.mins).trim()!==''){mins=num(F.mins);if(!isFinite(mins)||mins<0){toast('وقت التشغيل لازم يكون رقم صحيح');return false;}}
  var tp='';if(String(F.temp==null?'':F.temp).trim()!==''){tp=num(F.temp);if(!isFinite(tp)||tp<0||tp>1000){toast('درجة الحرارة غير صحيحة');return false;}}
  var yl=num(F.yield||'1');if(!isFinite(yl)||yl<=0){toast('اكتب الكمية اللي الوصفة بتطلعها لكل وجبة');return false;}
  var stages=[],bad=null,pn=0;
  F.stages.forEach(function(g){
    var gname=g.name.trim(),ings=[],seen={};
    g.ings.forEach(function(r){
      var n=(r.n||'').trim(),qs=String(r.q).trim();
      if(!n&&!qs)return;
      if(!n){bad=bad||'اكتب اسم المكوّن';return;}
      var q=num(qs);
      if(!isFinite(q)||q<=0){bad=bad||'كمية '+n+' لازم تكون أكبر من صفر';return;}
      var key=norm(n);
      if(seen[key]){bad=bad||n+' متكرر في نفس المرحلة';return;}
      seen[key]=1;
      var mm=findMat(n),fac=1;
      if(mm&&r.u&&r.u!==mm.unit){
        var al2=(mm.alts||[]).filter(function(a){return a.u===r.u;})[0];
        if(al2){fac=al2.f;}
        /* البيضة مابتتحولش من وزن لعدد أو العكس تلقائياً (البيضة = 50 جرام تقدير)، لو الكمية وصلت بالجرام تتسجل كخامة بالجرام */
        else if(unitGrams(r.u)&&unitGrams(mm.unit)&&r.u!=='بيضة'&&mm.unit!=='بيضة'){fac=r3(unitGrams(r.u)/unitGrams(mm.unit));mm.alts=(mm.alts||[]).concat([{u:r.u,f:fac}]);}
        else{
          /* مفيش تحويل معروف: بنعمل نسخة من الخامة بالوحدة الجديدة (أو بنستخدم نسخة موجودة) */
          var cp=MATERIALS.filter(function(x){return norm(unesc(x.name))===norm(unesc(mm.name))&&x.unit===r.u;})[0];
          if(!cp){cp={id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:mm.name,cat:mm.cat,unit:r.u,min:0,storage:mm.storage||'مخزن جاف',exp:'',supplier:'',notes:'',alts:[]};S.materials.push(cp);S.stock[cp.id]=0;}
          mm=cp;fac=1;
        }
      }
      ings.push({key:key,n:n,u:r.u,q:r3(q*fac),dq:q,du:r.u,m:mm?mm.id:null,mid:mm?mm.id:null});
    });
    var steps=g.steps.map(function(t){return t.trim();}).filter(Boolean);
    if(g.kind==='prep'){if(!ings.length&&!steps.length)return;gname='مرحلة '+(++pn);}
    else if(!gname&&!ings.length&&!steps.length)return;
    if(!gname){bad=bad||'اكتب اسم المرحلة';return;}
    stages.push({kind:g.kind,name:gname,ings:ings,steps:steps});
  });
  var comps=[],cseen={};
  (F.comps||[]).forEach(function(c){
    if(!c.p&&String(c.q).trim()==='')return;
    if(!c.p){bad=bad||'اختار الوصفة الفرعية';return;}
    var q=num(c.q);
    if(!isFinite(q)||q<=0){bad=bad||'كمية الوصفة الفرعية لازم تكون أكبر من صفر';return;}
    if(c.p===F.edit){bad=bad||'الوصفة ما ينفعش تدخل في نفسها';return;}
    if(cseen[c.p]){bad=bad||'وصفة فرعية متكررة';return;}
    cseen[c.p]=1;comps.push({p:c.p,q:q});
  });
  if(F.edit&&comps.length){
    var reach=function(from,seen){if(from===F.edit)return true;if(seen[from])return false;seen[from]=1;return compsOf(from).some(function(c){return reach(c.p,seen);});};
    if(comps.some(function(c){return reach(c.p,{});}))bad=bad||'الوصفة الفرعية دي بتعتمد على الوصفة دي (دايرة)';
  }
  if(bad){toast(bad);return false;}
  /* الأصناف المؤرشفة أو المحذوفة نهائياً مش بتتحسب في تكرار الاسم */
  var dup=PRODUCTS.some(function(p){return p.id!==F.edit&&!p.archived&&!p.gone&&unesc(p.name).trim().toLowerCase()===name.toLowerCase();});
  if(dup){toast('الاسم ده موجود قبل كده');return false;}
  stages=stages.filter(function(g){return g.kind==='prep';});
  stages.forEach(function(g){
    g.name=esc(g.name);g.steps=g.steps.map(esc);
    g.ings=g.ings.map(function(i){
      var m=i.mid?M(i.mid):findMat(i.n);
      if(!m){
        m={id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:esc(i.n),cat:'عام',unit:i.u,min:0,storage:'مخزن جاف',exp:'',supplier:'',notes:''};
        S.materials.push(m);S.stock[m.id]=0;
      }
      return {m:m.id,q:i.q,dq:i.dq,du:i.du};
    });
  });
  var nu=PROD_UNITS.indexOf(F.unit)>-1?F.unit:'قطعة';
  var conv=null;
  if(F.edit){var pe=P(F.edit),ou=pe.unit||'قطعة';if(ou!==nu){var kk=convK(ou,nu);conv={k:kk,yield:r3((pe.yield||1)*kk)};}}
  var o={name:esc(name),cat:'عام',unit:nu,mins:mins,temp:tp,yield:conv?conv.yield:yl,stages:stages,notes:esc((F.notes||'').trim()),shop:!!F.shop,season:F.season||'normal',group:esc((F.group||'').trim()),comps:comps,noOrder:!!F.noOrder,fgStore:FG_STORES.indexOf(F.fgStore)>-1?F.fgStore:'عادي',shelf:esc((F.shelf||'').trim())};
  if(F.edit){var cur=P(F.edit);if(conv)convertUnitData(F.edit,conv.k,nu);Object.assign(cur,o);syncProd(cur);if(conv)save();toast('تم حفظ التعديلات');}
  else{o.id='p'+Date.now().toString(36);o.code='P-'+String(nextProdNo()).padStart(3,'0');syncProd(o);S.products.push(o);U.rsel=o.id;toast('تمت إضافة '+name+' بكود '+o.code);}
  U.form=null;

}
/* مواعيد العمل للمستخدمين: بتتحدد من الإعدادات، ولو مفيش مواعيد التطبيق بيفتح طول الوقت */
var DAY_NAMES=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function hrMins(s){var m=/^(\d{1,2}):(\d{2})$/.exec(String(s||''));return m?Number(m[1])*60+Number(m[2]):0;}
/* الوقت الموثوق: بييجي من ساعة السيرفر (هيدر Date من نفس الموقع)، مش من ساعة الموبايل. الساعة بتتحسب بتوقيت القاهرة ثابت */
var TIME_KEY='khat-srvtime',TZ_CAIRO='Africa/Cairo';
var timeAnchor=null;
function timeStore(a){try{localStorage.setItem(TIME_KEY,JSON.stringify(a));}catch(e){}}
function timeLoad(){try{return JSON.parse(localStorage.getItem(TIME_KEY)||'null');}catch(e){return null;}}
function syncTime(){
  var t0=Date.now();
  return fetch('./',{method:'HEAD',cache:'no-store'}).then(function(r){
    var h=r.headers.get('date'),ms=h?Date.parse(h):NaN;
    if(!isFinite(ms))return;
    var mid=(t0+Date.now())/2;
    var s=ms+500+(Date.now()-mid);
    timeAnchor={s:s,p:performance.now()};
    timeStore({s:s,l:Date.now()});
  }).catch(function(){});
}
function trustedNow(){
  if(timeAnchor)return timeAnchor.s+(performance.now()-timeAnchor.p);
  var st=timeLoad();
  if(!st)return null;
  var local=Date.now();
  if(local<st.l-60000)return null;
  return st.s+(local-st.l);
}
function cairoParts(ms){
  var p={};
  new Intl.DateTimeFormat('en-US',{timeZone:TZ_CAIRO,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
    .formatToParts(new Date(ms)).forEach(function(x){p[x.type]=x.value;});
  var dows={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return {dow:dows[p.weekday],mins:Number(p.hour)*60+Number(p.minute)};
}
function cairoDateKey(ms){
  return new Intl.DateTimeFormat('en-CA',{timeZone:TZ_CAIRO,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms));
}
/* إجازة المستخدم: بتتحدد بيوم بعينه (تاريخ القاهرة)، وبتخلص لوحدها بعد اليوم ده. true = في إجازة، false = لأ، null = مش عارفين الوقت */
function onLeaveToday(){
  var u=sessionCode()?userByCode(sessionCode()):null;
  if(!u||(!u.leave&&!u.leaveFrom&&weekOffOf(u)===null&&!weekMoveOf(u)))return false;
  var ms=trustedNow();
  if(ms===null)return null;
  return userLeaveActive(u,cairoDateKey(ms));
}
/* true = مفتوح، false = برا المواعيد، null = مش عارفين الوقت (مفيش إنترنت) */
/* مواعيد العمل بتتطبق على المستخدم إلا لو المالك استثناه من الجدول */
function userHoursApply(){var u=sessionCode()?userByCode(sessionCode()):null;return !(u&&u.noHours);}
function workOpenNow(){
  if(!userHoursApply())return true;
  var h=pref('hours',null);
  if(!h||!Array.isArray(h))return true;
  var ms=trustedNow();
  if(ms===null)return null;
  var c=cairoParts(ms),now=c.mins,dow=c.dow;
  var today=h[dow],yest=h[(dow+6)%7],ok=false;
  if(today&&today.on){
    var a=hrMins(today.from),b=hrMins(today.to);
    if(a===b)ok=true;
    else if(b>a)ok=ok||(now>=a&&now<b);
    else ok=ok||(now>=a);
  }
  if(yest&&yest.on){var a2=hrMins(yest.from),b2=hrMins(yest.to);if(b2<a2&&now<b2)ok=true;}
  return ok;
}
/* مواعيد الشغل الفعلية بغض النظر عن استثناء الحساب (عشان نعرف الحسابات المستثناة هل بره المواعيد ولا لأ) */
function hoursOpenRaw(){
  var h=pref('hours',null);
  if(!h||!Array.isArray(h))return true;
  var ms=trustedNow();if(ms===null)return null;
  var c=cairoParts(ms),now=c.mins,dow=c.dow;
  var today=h[dow],yest=h[(dow+6)%7],ok=false;
  if(today&&today.on){var a=hrMins(today.from),b=hrMins(today.to);if(a===b)ok=true;else if(b>a)ok=now>=a&&now<b;else ok=now>=a;}
  if(yest&&yest.on){var a2=hrMins(yest.from),b2=hrMins(yest.to);if(b2<a2&&now<b2)ok=true;}
  return ok;
}
/* معاد الفتح الجاي من جدول المواعيد */
function nextOpenLabel(){
  var h=pref('hours',null);if(!h||!Array.isArray(h))return '';
  var ms=trustedNow();if(ms===null)return '';
  var c=cairoParts(ms);
  for(var k=0;k<7;k++){
    var d=(c.dow+k)%7,x=h[d];
    if(x&&x.on){
      if(k===0){if(hrMins(x.from)>c.mins)return 'النهارده '+x.from;}
      else return (k===1?'بكرة':DAY_NAMES[d])+' '+x.from;
    }
  }
  return '';
}
/* آخر وقت كان التطبيق فيه مفتوح للمستخدمين: أي أوردر بيتسجل بعده بيظهر في شاشة الراحة لحد ما التطبيق يفتح تاني */
function markOpenSeen(){var n=trustedNow();if(n!==null){try{localStorage.setItem('khat-open-seen',String(n));}catch(e){}}}
/* لو الجهاز ما اتفتحش وقت الشغل قبل كده، أول مرة يتقفل بنحفظ وقت الفتح دلوقتي عشان الطلبات اللي تيجي بعده تظهر */
function ensureOpenSeen(){
  var has=false;try{has=!!localStorage.getItem('khat-open-seen');}catch(e){}
  if(!has)markOpenSeen();
}
function missedOrders(){
  var since=0;try{since=Number(localStorage.getItem('khat-open-seen'))||0;}catch(e){}
  if(!since)return [];
  return (S.orders||[]).filter(function(o){return !o.isBox&&(o.created||0)>=since;}).sort(function(a,b){return b.created-a.created;});
}
/* الدفعات اللي اتعملت وقت الراحة (ومتسحبتش) */
function missedBatches(){
  var since=0;try{since=Number(localStorage.getItem('khat-open-seen'))||0;}catch(e){}
  if(!since)return [];
  return (S.batches||[]).filter(function(b){return !b.withdrawn&&(b.created||0)>=since;}).sort(function(a,b){return b.created-a.created;});
}
function restHTML(unknown,leave){
  var list=unknown?[]:missedOrders();
  var bl=unknown?[]:missedBatches();
  var bItems=bl.map(function(b){
    var pr=P(b.p);
    return '<div class="hist" style="text-align:right"><span><span class="ltr">'+esc(sid(b.id))+'</span> · '+esc(pr?unesc(pr.name):String(b.p))+'<br><span class="meta">الكمية: '+esc(String(b.qty))+'</span></span></div>';
  }).join('');
  var items=list.map(function(o){
    return '<div class="hist" style="text-align:right"><span><span class="ltr">'+esc(sid(o.id))+'</span> · '+esc(custName(o))+'<br><span class="meta">'+esc(itemsText(o))+(o.due?' · معاد التسليم: '+esc(dueStr(o.due)):'')+'</span></span></div>';
  }).join('');
  return '<section class="login" style="text-align:center;padding:40px 16px"><div style="margin-bottom:12px"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M7 2v3M11 2v3M15 2v3"/></svg></div>'+
    '<h2 style="margin-bottom:8px">'+(unknown?'محتاج إنترنت':(leave?'إجازة النهاردة':'وقت الراحة'))+'</h2><p class="meta" style="margin-bottom:12px">'+(unknown?'عشان نتأكد من الوقت الصح، اتصل بالإنترنت وحاول تاني.':(leave?'التطبيق مش متاح النهاردة. هيفتح تاني بعد الإجازة.':'التطبيق مش متاح دلوقتي. هيفتح في ميعاد الشغل.'))+'</p>'+
    (unknown?'':
      (list.length?'<div style="text-align:right;margin-top:16px"><h3 style="margin-bottom:8px">طلبات جت وقت الراحة ('+list.length+')</h3>'+items+'</div>':'')+
      (bl.length?'<div style="text-align:right;margin-top:16px"><h3 style="margin-bottom:8px">دفعات اتعملت وقت الراحة ('+bl.length+')</h3>'+bItems+'</div>':'')+
      (list.length||bl.length?'':'<p class="meta" style="margin-top:12px">مفيش طلبات ولا دفعات جديدة وقت الراحة.</p>'))+'</section>';
}
function hoursCardHTML(){
  var ul=usersList();
  var uRows=ul.map(function(u){var on=!u.noHours;return '<tr><td><b>'+esc(u.name)+'</b></td><td>'+(limited()?'':'<span class="ucode ltr">'+esc(u.code)+'</span>')+'</td><td><button class="tg'+(on?' on':'')+'" data-act="userHoursToggle" data-id="'+u.id+'">'+(on?'يتطبق':'لأ')+'</button></td></tr>';}).join('');
  var uTable=ul.length?'<div class="grp" style="margin-top:14px">مين تتطبق عليه مواعيد العمل</div><div style="overflow-x:auto"><table class="ttab"><thead><tr><th>المستخدم</th>'+(limited()?'':'<th>الكود</th>')+'<th>مواعيد العمل</th></tr></thead><tbody>'+uRows+'</tbody></table></div>':'<div class="meta" style="margin-top:12px">مفيش مستخدمين لسه.</div>';
  var h=pref('hours',null)||DAY_NAMES.map(function(){return {on:false,from:'09:00',to:'18:00'};});
  var rows=DAY_NAMES.map(function(n,i){
    var x=h[i]||{on:false,from:'09:00',to:'18:00'};
    return '<tr><td>'+n+'</td><td><button class="tg'+(x.on?' on':'')+'" data-act="hrToggle" data-d="'+i+'">'+(x.on?'مفتوح':'إجازة')+'</button></td>'+
      '<td>'+(x.on?'<input type="time" data-hr="from" data-d="'+i+'" value="'+esc(x.from)+'" aria-label="من"> - <input type="time" data-hr="to" data-d="'+i+'" value="'+esc(x.to)+'" aria-label="إلى">':'<span class="meta">—</span>')+'</td></tr>';
  }).join('');
  return '<section class="card" style="--c:var(--settings)"><h3>مواعيد العمل للمستخدمين</h3><p class="meta" style="margin:0">المواعيد دي بتتطبق على المستخدمين اللي علامتهم "يتطبق" بس. المستخدم اللي "لأ" يقدر يفتح التطبيق في أي وقت. المالك دايمًا يقدر يفتح. لو مفيش مواعيد متظبطة، التطبيق مفتوح طول الوقت.</p>'+
    '<div style="overflow-x:auto"><table class="ttab"><thead><tr><th>اليوم</th><th>الحالة</th><th>المواعيد</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+uTable+'</section>';
}
var SET_IC={
  printer:'<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  boxtpl:'<path d="M4 9h16v11H4z"/><path d="M3 5h18v4H3zM12 5v15"/>',
  hours:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.3-5 6.5-5s5.7 1.8 6.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 15c2.4.2 4.3 1.8 5 4.5"/>',
  tabs:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M9 9v11"/>',
  seasons:'<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
  security:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  prodlog:'<path d="M12 3c.6 3.2 4.6 5.2 4.6 9.6A4.6 4.6 0 0 1 12 17.2a4.6 4.6 0 0 1-4.6-4.6c0-1.9.9-3.1 2-4.1.1 1.6.9 2.5 1.9 2.8C11.1 8.6 10.9 5.6 12 3z"/><path d="M7 21h10"/>',
  months:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  backup:'<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>',
  gd:'<path d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 9.5 4 4 0 0 1 17 18H7z"/>',
  updates:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  install:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>'
};
/* ===== تبويب التحديثات ===== */
/* التحديثات بتتكتب هنا يدوي. كل تحديث له id ثابت، وممنوع تغيّره بعد ما يتنشر */
/* التحديثات المنشورة بتتخزن في بيانات التطبيق (بتتزامن مع درايف) وبيكتبها المالك من تبويب التحديثات */
function updList(){var l=pref('appUpdates',[]);return Array.isArray(l)?l:[];}
/* إصدار الكود اللي شغال دلوقتي. لازم يتغيّر في الكود مع كل نشر جديد على GitHub Pages */
var APP_VERSION='2.0';
function verCmp(a,b){
  var pa=String(a||'0').split('.').map(Number),pb=String(b||'0').split('.').map(Number);
  for(var i=0;i<3;i++){var x=pa[i]||0,y=pb[i]||0;if(x!==y)return x<y?-1:1;}
  return 0;
}
function updLatestVer(){return updList().reduce(function(m,u){return verCmp(u.ver,m)>0?String(u.ver):m;},'0');}
function updFind(id){return updList().filter(function(x){return x.id===id;})[0]||null;}
/* التحديثات اللي كل حساب نفّذها: كل حساب ليه إعداد خاص بيه في البيانات (بيتزامن مع درايف).
   مش بنكتبها جوه بيانات المستخدم نفسه، لأن المستخدم بيتم استرجاع بياناته من آخر نسخة عند كل مزامنة */
function updKey(){return 'updDone:'+(sessionCode()||'owner');}
function updDoneList(){var l=pref(updKey(),[]);return Array.isArray(l)?l:[];}

/* كل الحسابات (المالك + كل المستخدمين) وحالة كل تحديث عندهم */
function updAccounts(){return [{key:'owner',name:'المالك'}].concat(usersList().map(function(u){return {key:u.code,name:u.name||u.code};}));}
function updStatus(id){
  var p=S.prefs||{},done=[],pend=[];
  updAccounts().forEach(function(a){
    var l=p['updDone:'+a.key];
    (Array.isArray(l)&&l.indexOf(id)>-1?done:pend).push(a.name);
  });
  return {done:done,pend:pend};
}
function updFmtDur(sec){
  if(!sec)return '—';
  return (sec>=60&&sec%60===0)?(sec/60)+' دقيقة':sec+' ثانية';
}
function updPanelCss(){
  if(document.getElementById('updPanelCss'))return;
  var st=document.createElement('style');st.id='updPanelCss';
  st.textContent='.updp{display:flex;flex-direction:column;gap:14px;margin-top:10px}'+
    '.updp-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}'+
    '@media (min-width:640px){.updp-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}'+
    '.updp-k{border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--surface)}'+
    '.updp-k small{display:block;font-size:12px;color:var(--muted);font-weight:600}'+
    '.updp-k b{display:block;margin-top:4px;font-family:var(--f-disp);font-size:20px;font-variant-numeric:tabular-nums}'+
    '.updp-banner{border-radius:14px;padding:12px 14px;font-size:14px;font-weight:700}'+
    '.updp-banner.ok{background:color-mix(in srgb,#16a34a 12%,transparent);color:#15803d}'+
    '.updp-banner.new{background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn)}'+
    '.updp-item{border:1px solid var(--line);border-radius:16px;padding:14px;background:var(--surface);display:flex;flex-direction:column;gap:10px}'+
    '.updp-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap}'+
    '.updp-t{font-weight:800;font-size:15px}'+
    '.updp-meta{font-size:12px;color:var(--muted);margin-top:2px}'+
    '.updp-chip{padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:color-mix(in srgb,var(--settings) 12%,transparent);color:var(--settings)}'+
    '.updp-bar{height:8px;border-radius:999px;background:var(--line);overflow:hidden}'+
    '.updp-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#4F5DFF,#16a34a);transition:width .4s}'+
    '.updp-lbl{font-size:12px;font-weight:700;color:var(--muted)}'+
    '.updp-names{display:flex;flex-wrap:wrap;gap:6px;font-size:12px}'+
    '.updp-names span{padding:4px 9px;border-radius:999px;border:1px solid var(--line);color:var(--ink-2)}'+
    '.updp-names .ok{color:#15803d;border-color:color-mix(in srgb,#16a34a 40%,var(--line))}'+
    '.updp-names .no{color:var(--warn)}'+
    '.updp-item{display:block}'+
    '.updp-item>summary{list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none}'+
    '.updp-item>summary::-webkit-details-marker{display:none}'+
    '.updp-item>summary:focus-visible{outline:2px solid var(--settings);outline-offset:4px;border-radius:10px}'+
    '.updp-sum-r{display:inline-flex;align-items:center;gap:8px;flex:none}'+
    '.updp-caret{width:8px;height:8px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);transition:transform .2s;margin:0 4px 3px 2px}'+
    '.updp-item[open] .updp-caret{transform:rotate(-135deg);margin-top:3px;margin-bottom:0}'+
    '.updp-body{display:flex;flex-direction:column;gap:10px;margin-top:10px}';
  document.head.appendChild(st);
}
function updatesCardHTML(){
  updPanelCss();
  var owner=!sessionCode(),list=updList(),latest=updLatestVer(),acc=updAccounts(),pendNow=updPendingList();
  var newest=list[0]||null;
  var newSt=newest?updStatus(newest.id):{done:[],pend:[]};
  var k=function(l,v){return '<div class="updp-k"><small>'+esc(l)+'</small><b>'+esc(String(v))+'</b></div>';};
  var banner=!list.length?'<div class="updp-banner ok">مفيش تحديثات منشورة حالياً</div>':
    (pendNow.length?'<div class="updp-banner new">فيه '+pendNow.length+' تحديث متاح على الجهاز ده</div>':'<div class="updp-banner ok">الجهاز ده على آخر إصدار</div>');
  var kpis='<div class="updp-kpis">'+k('الإصدار الشغال',APP_VERSION)+k('آخر إصدار منشور',latest==='0'?'—':latest)+
    k('عدد الحسابات',acc.length)+k(owner?'لسه ماحدّثوش':'تحديثات عليك',owner?newSt.pend.length:pendNow.length)+'</div>';
  var inp='width:100%;border:1.5px solid var(--field);border-radius:10px;padding:8px 10px;font:inherit;background:var(--surface);color:var(--ink);box-sizing:border-box';
  var form=owner?'<div style="padding:12px;border:1px solid var(--line);border-radius:14px">'+
    '<b style="display:block;margin-bottom:8px">نشر تحديث جديد</b>'+
    '<div class="fld"><label for="updVer">رقم الإصدار (بيتجاب من GitHub تلقائي)</label><input id="updVer" type="text" placeholder="مثال: 1.1.1" style="'+inp+'"></div>'+
    '<div class="fld"><label for="updTitle">عنوان التحديث</label><input id="updTitle" type="text" placeholder="مثال: تحسينات الفواتير" style="'+inp+'"></div>'+
    '<div class="fld"><label for="updDur">مدة التحديث المتوقعة</label><div style="display:flex;gap:8px"><input id="updDur" type="number" min="1" max="7200" value="30" placeholder="مثلاً 30" style="'+inp+';flex:1"><select id="updDurU" style="'+inp+';width:auto;flex:0 0 110px"><option value="s" selected>ثانية</option><option value="m">دقيقة</option></select></div></div>'+
    '<div class="fld"><label for="updPrev">الإصدار اللي على الأجهزة قبل التحديث</label><input id="updPrev" type="text" value="'+esc(APP_VERSION)+'" placeholder="مثال: 2.0" style="'+inp+'"></div>'+
    '<button class="btn block" data-act="updAdd">نشر التحديث</button></div>':'';
  var rows=list.map(function(up){
    var st=updStatus(up.id),total=acc.length,dn=st.done.length,pct=total?Math.round(dn/total*100):0;
    var mine=pendNow.some(function(x){return x.id===up.id;});
    var items='<ul style="margin:0;padding-right:18px;font-size:13px;line-height:1.7">'+(up.items||[]).map(function(i){return '<li>'+esc(i)+'</li>';}).join('')+'</ul>';
    var detail=owner?'<div class="updp-bar"><i style="width:'+pct+'%"></i></div>'+
      '<div class="updp-meta">اتحدّث '+dn+' من '+total+' حساب</div>'+
      '<div class="updp-lbl">اتحدّث</div><div class="updp-names">'+(st.done.map(function(n){return '<span class="ok">'+esc(n)+'</span>';}).join('')||'<span>محدش لسه</span>')+'</div>'+
      '<div class="updp-lbl">لسه</div><div class="updp-names">'+(st.pend.map(function(n){return '<span class="no">'+esc(n)+'</span>';}).join('')||'<span>الكل اتحدّث</span>')+'</div>':'';
    var act=owner?((mine?'<button class="btn sm" data-act="updStart" data-id="'+esc(up.id)+'">تحديث</button> ':'')+'<button class="btn ghost sm" data-act="updDel" data-id="'+esc(up.id)+'">حذف</button>'):
      (mine?'<button class="btn sm" data-act="updStart" data-id="'+esc(up.id)+'">تحديث</button>':'<span class="upill">تم التحديث ✓</span>');
    return '<details class="updp-item" data-uid="'+esc(up.id)+'"><summary class="updp-top"><div><div class="updp-t">'+esc(up.title)+'</div>'+
      '<div class="updp-meta">'+esc(up.date)+' · المدة '+esc(updFmtDur(up.dur))+'</div></div>'+
      '<span class="updp-sum-r"><span class="updp-chip">الإصدار '+esc(up.ver)+'</span><span class="updp-caret" aria-hidden="true"></span></span></summary>'+
      '<div class="updp-body">'+items+detail+
      '<div style="display:flex;justify-content:flex-end">'+act+'</div></div></details>';
  }).join('');
  if(!list.length)rows='<div class="meta">مفيش تحديثات منشورة حالياً</div>';
  var desc=owner?'انشر التحديث وتابع مين اتحدّث ومين لسه، من غير ما تخرج من الشاشة دي.':'التحديثات الجديدة للتطبيق بتظهر هنا، ولما تضغط تحديث التطبيق بيتحدّث على حسابك.';
  return '<section class="card" style="--c:var(--settings)"><h3>إدارة التحديثات</h3><p class="meta" style="margin:0">'+desc+'</p>'+
    '<div class="updp">'+banner+kpis+form+rows+'</div></section>';
}
/* الإشعار اللي بيظهر للمستخدم أول ما يفتح التطبيق: التحديثات اللي لسه ماتنفذتش على الحساب */
/* أي إصدار الجهاز شغّاله فعلاً بيتسجل على الحساب تلقائي (مرة واحدة) */
function updAutoRecord(){
  var have=updDoneList(),add=[];
  /* التحقق بعد التحديث: لو المحاولة الأخيرة لسه الإصدار الشغال أقل منها، يبقى التحديث ما اتثبتش */
  var tryId='',tryU=null;
  try{tryId=sessionStorage.getItem('khat-upd-try')||'';}catch(e){}
  if(tryId){
    tryU=updFind(tryId);
    if(tryU&&verCmp(tryU.ver,APP_VERSION)>0)toast('التحديث ما اتثبتش، اضغط تحديث تاني');
    try{sessionStorage.removeItem('khat-upd-try');}catch(e){}
  }
  /* الإصدارات الأقدم من اللي شغال بتتسجل تلقائي. الإصدار نفسه بيتسجل بس لما المستخدم يثبّته فعلاً */
  updList().forEach(function(u){if(verCmp(u.ver,APP_VERSION)<0&&have.indexOf(u.id)<0)add.push(u.id);});
  if(tryU&&verCmp(tryU.ver,APP_VERSION)<=0&&have.indexOf(tryU.id)<0&&add.indexOf(tryU.id)<0)add.push(tryU.id);
  var justDone=updList().filter(function(u){return add.indexOf(u.id)>-1&&verCmp(u.ver,APP_VERSION)===0;});
  if(add.length)setPref(updKey(),have.concat(add));
  if(justDone.length)updSuccessShow(justDone[0]);
}
/* رسالة "تم التحديث بنجاح" بتظهر مرة واحدة لكل تحديث، أول ما الجهاز يفتح على الإصدار الجديد */
function updSuccessShow(up){
  if(document.getElementById('updDone'))return;
  updCss();
  var ov=document.createElement('div');
  ov.id='updDone';ov.className='updov';ov.setAttribute('role','alertdialog');ov.setAttribute('aria-modal','true');
  ov.innerHTML='<div class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>'+'<div class="updframe"><div class="updcard">'+'<div class="updrow" style="justify-content:center"><span class="updtag">UPDATE COMPLETE</span></div>'+'<h3>تم التحديث بنجاح</h3>'+'<p class="updov-msg">الإصدار <span style="color:#F6E7B0">'+esc(up.ver)+'</span> اتثبّت على جهازك.</p>'+'<div class="updov-list" style="text-align:center"><b>'+esc(up.title)+'</b></div>'+'<p class="updov-msg" style="font-size:13px">التحسينات الجديدة شغالة دلوقتي، ومفيش أي خطوة تانية مطلوبة منك.</p>'+'<button class="updov-btn" data-act="updSeen">تمام</button>'+'<div class="updfoot">DATA IS SAFE · SYNCED TO DRIVE</div></div></div>';
    document.body.appendChild(ov);
}
function updPendingList(){
  var done=updDoneList();
  return updList().filter(function(u){
    var c=verCmp(u.ver,APP_VERSION);
    return c>0||(c===0&&done.indexOf(u.id)<0&&!updLocalHas('done',u.id));
  });
}
var UPD={pct:0};
function updCss(){
  if(document.getElementById('updCss'))return;
  var st=document.createElement('style');st.id='updCss';
  st.textContent='.updov{position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;box-sizing:border-box;text-align:center;background:radial-gradient(120% 60% at 50% 0%,#121a4a 0%,#070a1f 55%,#03040c 100%);color:#fff;overflow:hidden}'+
    '.updov>*{position:relative;z-index:1}'+
    '.updov::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(143,160,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(143,160,255,.07) 1px,transparent 1px);background-size:26px 26px;animation:updGrid 14s linear infinite}'+
    '@keyframes updGrid{to{background-position:0 260px,260px 0}}'+
    '.updframe{width:100%;max-width:342px;clip-path:polygon(28px 0,100% 0,100% calc(100% - 28px),calc(100% - 28px) 100%,0 100%,0 28px);background:linear-gradient(160deg,#8FA0FF 0%,#2b3596 40%,#F6E7B0 100%);padding:1px}'+
    '.updcard{width:100%;clip-path:polygon(27px 0,100% 0,100% calc(100% - 27px),calc(100% - 27px) 100%,0 100%,0 27px);background:linear-gradient(170deg,#161f5c 0%,#0a0f2e 70%,#070a1f 100%);padding:22px 20px 18px;display:flex;flex-direction:column;gap:16px;text-align:right}'+
    '.updcard .updov-list{max-width:none;max-height:none;font-size:13px;color:#c9d1ff}'+
    '.updcard .updov-bar{width:100%}'+
    '.updcard .updov-msg{max-width:none;text-align:right}'+
    '.updcard #updAct{width:100%;display:flex;flex-direction:column;align-items:center}'+
    '.updcard #updAct .updov-btn{width:100%}'+
    '.updcard .updov-pct{text-align:left;font-family:"JetBrains Mono",monospace;font-size:44px;font-weight:700}'+
    '.updrow{display:flex;justify-content:space-between;align-items:center;gap:10px}'+
    '.updtag{font-size:11px;letter-spacing:2px;color:#F6E7B0;border:1px solid rgba(246,231,176,.6);padding:4px 8px;white-space:nowrap;font-family:"JetBrains Mono",monospace}'+
    '.updkick{font-size:10px;letter-spacing:3px;color:#8FA0FF;font-family:"JetBrains Mono",monospace;text-transform:uppercase}'+
    '.updvbox{border:1px solid rgba(143,160,255,.35);background:rgba(255,255,255,.03);padding:12px 14px;display:flex;justify-content:space-between;align-items:flex-end}'+
    '.updl{display:block;font-size:10px;letter-spacing:2px;color:#8FA0FF;margin-bottom:4px;font-family:"JetBrains Mono",monospace}'+
    '.updvv{display:block;font-size:22px;font-weight:700;font-family:"JetBrains Mono",monospace;color:#7d89c4}'+
    '.upda{font-size:20px;color:#F6E7B0;padding-bottom:4px}'+
    '.updfoot{font-size:10px;letter-spacing:2px;color:#9aa6d8;text-align:center;font-family:"JetBrains Mono",monospace}'+
    '.updov .check{width:72px;height:72px;margin:0 auto;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,rgba(246,231,176,.25),transparent 70%);border:1px solid #F6E7B0}'+
    '.updov .check svg{width:34px;height:34px;stroke:#F6E7B0;fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:40;stroke-dashoffset:40;animation:updDraw .7s .2s ease forwards}'+
    '@keyframes updDraw{to{stroke-dashoffset:0}}'+
    '.updov h3{margin:0;font-size:20px;font-weight:800;color:#fff}'+
    '.updov-pct{font-weight:800;color:#fff;font-size:18px;font-variant-numeric:tabular-nums}'+
    '.updov-msg{margin:0;color:#dfe4ff;font-size:14px;line-height:1.6;max-width:300px}'+
    '.updov-bar{width:170px;height:3px;border-radius:3px;background:rgb(255 255 255 / .14);overflow:hidden}'+
    '.updov-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4F5DFF,#fff);transition:width .15s linear}'+
    '.updov-bar i.sweep{width:40%;transition:none;animation:updSweep 1.1s ease-in-out infinite}'+
    '@keyframes updSweep{from{transform:translateX(-120%)}to{transform:translateX(320%)}}'+
    '.updov-btn{min-width:230px;height:52px;padding:0 28px;border:0;background:linear-gradient(120deg,#F6E7B0 0%,#E6B964 100%);color:#070a1f;font:inherit;font-weight:800;font-size:17px;cursor:pointer;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}'+
    '.updov-x{position:absolute;top:12px;inset-inline-end:14px;background:none;border:0;color:#dfe4ff;font-size:28px;line-height:1;cursor:pointer;padding:4px 8px}'+
    '.updov-ghost{background:none;border:0;color:#dfe4ff;font:inherit;font-weight:700;cursor:pointer;padding:6px}'+
    '.updov-list{width:100%;max-width:320px;max-height:34vh;overflow:auto;text-align:right;font-size:13px;color:#dfe4ff;line-height:1.7}'+
    '.updov-list b{color:#fff;font-size:15px}'+
    '.updov-list ul{margin:4px 0 12px;padding-right:18px}';
  document.head.appendChild(st);
}
/* نفس لوجو شاشة التحميل: الحروف بتتملي من تحت بموجة السائل حسب النسبة */
function updLogo(pct){
  var ghost=LD_LETTERS.map(function(d){return '<path d="'+d+'" fill="#4F5DFF" fill-opacity=".22" fill-rule="evenodd"/>';}).join('');
  var lit=LD_LETTERS.map(function(d){return '<path d="'+d+'" fill="url(#updwg)" fill-rule="evenodd" clip-path="url(#updwc)"/>';}).join('');
  return '<svg viewBox="0 0 1560 420" style="width:min(300px,80vw);height:auto;overflow:visible" aria-hidden="true"><defs>'+
    '<linearGradient id="updwg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4F5DFF"/><stop offset="1" stop-color="#8FA0FF"/></linearGradient>'+
    '<clipPath id="updwc"><path id="updwave" d="'+ldWaveD(pct,performance.now()/1000)+'"/></clipPath></defs>'+ghost+lit+'</svg>';
}
function updLoop(){
  var w=document.getElementById('updwave');
  if(!w)return;
  w.setAttribute('d',ldWaveD(Math.max(0,Math.min(100,UPD.pct)),performance.now()/1000));
  requestAnimationFrame(updLoop);
}
function updPendingItems(list){
  return list.map(function(up){
    return '<b>'+esc(up.title)+'</b> <span style="font-size:12px;color:#9aa6e8">الإصدار '+esc(up.ver)+'</span>'+
      '<ul>'+(up.items||[]).map(function(i){return '<li>'+esc(i)+'</li>';}).join('')+'</ul>';
  }).join('');
}
/* مهلة 5 دقايق بعد ما التحديث يظهر: في الفترة دي بيظهر شريط فوق بس، وبعدها الشاشة الإجبارية */
var UPD_GRACE=5*60*1000;
/* المهلة بتبدأ من أول مرة يظهر فيها التحديث في الجلسة دي (فتحة التطبيق)، مش من آخر مرة اتفتح فيها */
window.UPD_GRACE_T=window.UPD_GRACE_T||{};

function updTopCss(){
  if(document.getElementById('updTopCss'))return;
  var st=document.createElement('style');st.id='updTopCss';
  st.textContent='.updtop{position:fixed;top:0;left:0;right:0;z-index:350;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 10px;background:linear-gradient(90deg,#121a4a,#070a1f);border-bottom:1px solid rgba(246,231,176,.35);color:#fff;font-size:14px;font-weight:700;box-shadow:0 8px 20px -10px #000}'+
    '.updtop-t{min-width:0;line-height:1.5}'+
    '.updtop-btn{flex:none;border:0;padding:7px 14px;background:#F6E7B0;color:#070a1f;font:inherit;font-weight:800;cursor:pointer;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}';
  document.head.appendChild(st);
}
function updLocalKey(kind,id){return 'khat-upd-'+kind+':'+(sessionCode()||'owner')+':'+id;}
function updLocalSet(kind,id){try{localStorage.setItem(updLocalKey(kind,id),'1');}catch(e){}}
function updLocalHas(kind,id){try{return localStorage.getItem(updLocalKey(kind,id))==='1';}catch(e){return false;}}
function updSeenKey(){return 'updSeen:'+(sessionCode()||'owner');}
function updSeenList(){var l=pref(updSeenKey(),[]);return Array.isArray(l)?l:[];}
function updMarkSeen(id){updLocalSet('seen',id);var l=updSeenList().slice();if(l.indexOf(id)<0){l.push(id);setPref(updSeenKey(),l);}}
/* الشريط اللي فوق: مش إجباري، بيتعرض مرة واحدة لكل تحديث، ويتقفل بـ × */
function updTopBar(up){
  if(document.getElementById('updOv'))return;
  updTopCss();
  var bar=document.getElementById('updTop');
  if(!bar){
    bar=document.createElement('div');bar.id='updTop';bar.className='updtop';bar.setAttribute('role','status');
    bar.innerHTML='<span class="updtop-t"></span><span style="display:flex;gap:8px;align-items:center;flex:none">'+
      '<button class="updtop-btn" data-act="updGo">تحديث الآن</button>'+
      '<button class="updtop-btn" data-act="updSeenTop" aria-label="إغلاق" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5)">×</button></span>';
    document.body.appendChild(bar);
  }
  bar.querySelector('.updtop-t').textContent='فيه تحديث جديد (الإصدار '+esc(up.ver)+')';
  bar.querySelector('[data-act="updGo"]').setAttribute('data-id',up.id);
  bar.querySelector('[data-act="updSeenTop"]').setAttribute('data-id',up.id);
}
/* الإشعار اللي بيظهر أول ما يفتح التطبيق */
function updPrompt(){
  var pend=updPendingList();
  if(!pend.length||document.getElementById('updPrompt')||document.getElementById('updOv'))return;
  updCss();
  var ov=document.createElement('div');
  ov.id='updPrompt';ov.className='updov';ov.setAttribute('role','alertdialog');ov.setAttribute('aria-modal','true');
  var tried='';try{tried=sessionStorage.getItem('khat-upd-try')||'';}catch(e){}
  var stale=!!tried&&pend.some(function(u){return u.id===tried;});
  var msgHTML=stale?'<p class="updov-msg">النسخة الجديدة لسه مش متاحة على السيرفر، استنى دقيقة واضغط تاني</p>':'<p class="updov-msg">فيه تحديث إجباري، مش هتقدر تكمل الشغل قبل ما تحدّثه</p>';
  ov.innerHTML=updLogo(100)+'<div class="updframe"><div class="updcard">'+'<div class="updrow"><span class="updtag">NEW ◆</span><span class="updkick">SYSTEM UPDATE REQUIRED</span></div>'+'<h3>لازم تحدّث التطبيق</h3>'+msgHTML+'<div class="updvbox"><div style="text-align:left"><span class="updl">LATEST</span><b class="updvv" style="color:#F6E7B0">'+esc(pend[0].ver)+'</b></div><span class="upda">←</span>'+'<div><span class="updl">CURRENT</span><b class="updvv">'+esc(updPrevVer(pend[0]))+'</b></div></div>'+'<div class="updov-list">'+updPendingItems(pend)+'</div>'+'<button class="updov-btn" data-act="updGo" data-id="'+esc(pend[0].id)+'">تحديث الآن</button>'+'<div class="updfoot">DATA IS SAFE · SYNCED TO DRIVE</div></div></div>';
  document.body.appendChild(ov);
}
/* التحديث الإجباري: لو فيه تحديث ماتنفذش على الحساب، الشاشة دايماً بتقفل عليه (حتى لو اتنشر وإنت فاتح التطبيق) */
if(!window.UPD_WATCH){window.UPD_WATCH=setInterval(function(){
  if(authed()&&(!GD.on||GD.seeded))updAutoRecord();
  var vin=document.getElementById('updVer');
  if(vin&&!vin.dataset.auto){vin.dataset.auto='1';updLiveVer().then(function(v){var el=document.getElementById('updVer');if(v&&el)el.value=v;});}
  if(!authed()||document.getElementById('updOv'))return;
  if(window.UPD_COLD===undefined){
    /* أول فتحة للتطبيق في الجلسة دي = فتحة باردة (كان مقفول). أي ريلود بعد كده مش باردة */
    var warmBefore=false;try{warmBefore=sessionStorage.getItem('khat-warm')==='1';}catch(e){}
    window.UPD_COLD=!warmBefore;
    try{sessionStorage.setItem('khat-warm','1');}catch(e){}
  }
  if(!window.UPD_AUTH_T)window.UPD_AUTH_T=Date.now();/* وقت أول ما الدخول بيتحسب في الصفحة دي */
  var pendNow=updPendingList();
  if(!pendNow.length){var tb=document.getElementById('updTop');if(tb)tb.remove();return;}
  if(!window.UPD_BUSY){
    /* ما نعرضش أي تنبيه إلا لما الإصدار الجديد يكون موجود فعلاً على GitHub */
    window.UPD_BUSY=true;
    updLiveVer().then(function(v){
      window.UPD_BUSY=false;
      if(!v||verCmp(v,updLatestVer())<0)return;
      var up=pendNow[0];
      if(window.UPD_COLD){
        /* فتحة باردة: شاشة إجبارية على طول، ومفيش زرار إغلاق */
        var t1=document.getElementById('updTop');if(t1)t1.remove();
        if(!document.getElementById('updPrompt'))updPrompt();
        return;
      }
      /* فتحة عادية: يتعرض مرة واحدة بس */
      if(updSeenList().indexOf(up.id)>-1||updLocalHas('seen',up.id))return;
      updTopBar(up);
    });
  }
},2000);}
/* تحميل الصفحة من GitHub بنسبة فعلية، وبيرجّع النص كامل عشان نقرا منه الإصدار */
var UPD_SIZE=600000;
function downloadLive(onProg){
  return fetch('index.html?t='+Date.now(),{cache:'no-store'}).then(function(res){
    if(!res.ok)throw new Error('http '+res.status);
    /* الحجم الحقيقي من السيرفر لو الملف مش مضغوط؛ لو مضغوط بنستخدم تقدير */
    var enc=(res.headers.get('content-encoding')||'').toLowerCase();
    var len=parseInt(res.headers.get('content-length')||'',10);
    var total=((!enc||enc==='identity')&&len>0)?len:UPD_SIZE;
    if(!res.body||!window.ReadableStream){onProg(100);return res.text();}
    var reader=res.body.getReader(),chunks=[],got=0;
    var pump=function(){return reader.read().then(function(r){
      if(r.done)return;
      chunks.push(r.value);got+=r.value.length;
      onProg(Math.min(99,got/total*100));
      return pump();
    });};
    return pump().then(function(){onProg(100);return new Blob(chunks).text();});
  });
}
/* الإصدار اللي شغال على GitHub دلوقتي (بيتقري من الملف نفسه، ومتخزن 30 ثانية) */
function updLiveVer(){
  var c=window.UPD_LIVE;
  if(c&&Date.now()-c.t<30000)return Promise.resolve(c.v);
  /* HEAD الأول: لو الملف ماتغيرش (نفس الـ ETag) بنرجّع الإصدار المحفوظ من غير تحميل */
  return fetch('index.html?t='+Date.now(),{method:'HEAD',cache:'no-store'}).then(function(r){
    var tag=r.ok?(r.headers.get('etag')||r.headers.get('last-modified')||''):'';
    if(tag&&c&&c.tag===tag){window.UPD_LIVE={v:c.v,t:Date.now(),tag:tag};return c.v;}
    return downloadLive(function(){}).then(function(txt){
      var m=/var APP_VERSION='([\d.]+)'/.exec(txt);
      var v=m?m[1]:'';
      window.UPD_LIVE={v:v,t:Date.now(),tag:tag};
      return v;
    });
  }).catch(function(){return '';});
}
/* التحديث: بننزّل الكود من GitHub بنسبة حقيقية، ولو الإصدار اللي نزل لسه قديم بنعيد المحاولة لوحدنا */
function updStart(id){
  var up=updFind(id);
  if(!up||document.getElementById('updOv'))return;
  try{localStorage.setItem('khat-upd-from:'+id,APP_VERSION);}catch(e){}
  updCss();
  var tb0=document.getElementById('updTop');if(tb0)tb0.remove();
  var $=function(x){return document.getElementById(x);};
  var ov=document.createElement('div');
  ov.id='updOv';ov.className='updov';ov.setAttribute('role','alertdialog');ov.setAttribute('aria-modal','true');
  ov.innerHTML=updLogo(0)+'<div class="updframe"><div class="updcard">'+'<div class="updrow"><span class="updtag">INSTALLING</span><span class="updkick">'+esc(up.ver)+'</span></div>'+'<div class="updov-pct" id="updPct">0%</div>'+'<h3 id="updT">جاري تحميل التحديث</h3>'+'<div class="updov-bar"><i id="updBar"></i></div>'+'<p class="updov-msg" id="updS">الإصدار '+esc(up.ver)+'</p><p class="updov-msg" id="updEta"></p><div id="updAct"></div>'+'<div class="updfoot">متقفلش التطبيق لحد ما التثبيت يخلص</div></div></div>';
    document.body.appendChild(ov);
  UPD.pct=0;updLoop();
  var dur=up.dur||30,t0=Date.now();
  var fmt=function(x){return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');};
  var etaWait=false;/* الوقت المتوقع بيظهر بس وإحنا مستنيين النسخة الجديدة تتنشر، ويختفي وقت التحميل والتثبيت */
  var eta=function(){
    var el=$('updEta');
    if(!el){clearInterval(etaT);return;}
    if(!etaWait){el.textContent='';return;}
    var left=Math.max(0,dur-Math.floor((Date.now()-t0)/1000));
    el.textContent=left>0?'الوقت المتوقع للتحديث: '+fmt(left):'أوشك على الانتهاء...';
  };
  var etaT=setInterval(eta,1000);eta();
  var setPct=function(p){
    p=Math.max(0,Math.min(100,p));UPD.pct=p;
    if($('updBar')){$('updBar').className='';$('updBar').style.width=p+'%';}
    if($('updPct'))$('updPct').textContent=Math.round(p)+'%';
  };
  var setMsg=function(t,s){if($('updT'))$('updT').textContent=t;if($('updS'))$('updS').textContent=s;};
  var install=function(){
    etaWait=false;eta();
    setMsg('جاري تثبيت التحديث','متقفلش الصفحة لحد ما التثبيت يخلص');
    setPct(100);
    var bar=$('updBar');bar.style.width='';bar.className='sweep';
    setTimeout(function(){
      if(!$('updOv'))return;
      bar.className='';bar.style.width='100%';
      UPD.pct=100;
      ov.innerHTML=updInstallDoneHTML(up,id);
    },1500);
  };
  var attempt=function(){
    if(!$('updOv'))return;
    etaWait=false;eta();
    setPct(0);setMsg('جاري تحميل التحديث','الإصدار '+up.ver);
    downloadLive(setPct).then(function(txt){
      if(!$('updOv'))return;
      var m=/var APP_VERSION='([\d.]+)'/.exec(txt);
      var live=m?m[1]:'';
      if(!live||verCmp(live,up.ver)<0){
        setPct(0);
        setMsg('برجاء الانتظار','برجاء عدم الخروج من واجهة التطبيق لضمان التحديث بشكل صحيح');
        etaWait=true;eta();
        setTimeout(attempt,15000);
        return;
      }
      install();
    }).catch(function(){
      if(!$('updOv'))return;
      setPct(0);
      setMsg('تعذّر بدء التحميل','برجاء الانتظار داخل شاشة التطبيق لحين الانتهاء');
      etaWait=true;eta();
      setTimeout(attempt,10000);
    });
  };
  attempt();
}
/* الإصدار السابق: الإصدار اللي الجهاز كان شغال عليه قبل ما يبدأ التحديث، ولو مش متسجل بناخد أقرب إصدار أقدم منشور */
function updPrevVer(up){
  if(up.prev&&/^\d+(\.\d+){0,2}$/.test(String(up.prev)))return String(up.prev);
  var f='';try{f=localStorage.getItem('khat-upd-from:'+up.id)||'';}catch(e){}
  if(f&&verCmp(f,up.ver)!==0)return f;
  var older=updList().filter(function(u){return verCmp(u.ver,up.ver)<0;}).sort(function(a,b){return verCmp(b.ver,a.ver);});
  return older.length?String(older[0].ver):(f||up.ver);
}
/* كارت نجاح التثبيت: بيظهر داخل شاشة التحديث بعد ما التثبيت يخلص، وزرار تمام بيعيد تشغيل التطبيق */
function updInstallDoneHTML(up,id){
  return '<div class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>'+
    '<div class="updframe"><div class="updcard">'+
    '<div class="updrow" style="justify-content:center"><span class="updtag">UPDATE COMPLETE</span></div>'+
    '<h3>تم تثبيت التحديث بنجاح</h3>'+
    '<p class="updov-msg">الإصدار <span style="color:#F6E7B0">'+esc(up.ver)+'</span> اتثبّت على جهازك.</p>'+
    '<div class="updvbox"><div style="text-align:left"><span class="updl">NOW</span><b class="updvv" style="color:#F6E7B0">'+esc(up.ver)+'</b></div><span class="upda">←</span>'+
    '<div><span class="updl">PREVIOUS</span><b class="updvv">'+esc(updPrevVer(up))+'</b></div></div>'+
    '<div class="updov-list" style="text-align:center"><b>'+esc(up.title)+'</b></div>'+
    '<p class="updov-msg" style="font-size:13px">التحسينات الجديدة هتشتغل بعد إعادة تشغيل التطبيق.</p>'+
    '<div id="updAct"><button class="updov-btn" data-act="updFinish" data-id="'+esc(id)+'">تمام</button></div>'+
    '<div class="updfoot">DATA IS SAFE · SYNCED TO DRIVE</div></div></div>';
}
/* ضغطة تم: بنعلّم إن المحاولة اتعملت، وبعدين بنعمل تحديث حقيقي للصفحة (مسح الكاش وتحميل الكود من GitHub).
   التسجيل على الحساب بيحصل تلقائي بعد ما الكود الجديد يشتغل فعلاً */
function updFinish(id){
  try{sessionStorage.setItem('khat-upd-try',id);}catch(e){}
  updLocalSet('done',id);
  var a=document.getElementById('updAct');
  if(a)a.innerHTML='<p class="updov-msg">جاري إعادة تشغيل التطبيق...</p>';
  setTimeout(deepRefresh,600);
}
/* أي جدول داخل تبويب الإعدادات بيتقفل ويتفتح */
function foldTables(html,pfx){
  var src=String(html),n=0;
  return src.replace(/<table[\s\S]*?<\/table>/g,function(t,off){
    n++;
    var before=src.slice(0,off),k=before.lastIndexOf('<h3');
    var m=k>=0?/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(before.slice(k)):null;
    var title=m?m[1].replace(/<[^>]+>/g,'').trim():'جدول '+n;
    var fk=pfx+'-'+n;
    return (n===1?FOLD_CSS:'')+'<details class="tblfold" data-fk="'+fk+'"'+(FOLD_OPEN[fk]===false?'':' open')+'><summary class="tblfold-sum">'+esc(title)+'</summary>'+t+'</details>';
  });
}
function settingsView(){
  var head0=head('إعدادات','النسخ الاحتياطي والتصدير وقفل الشهور','');
  var pairs=[
    [hoursCardHTML(),'hours'],[usersCardHTML(),'users'],[permsCardHTML(),'perms'],[seasonsCardHTML(),'seasons'],[boxTplFormHTML(),'boxtpl'],
    [securityCardHTML(),'security'],[printerCardHTML(),'printer'],[monthsHTML(),'months'],
    [gdCardHTML()+backupCardHTML(),'gd'],[updatesCardHTML(),'updates'],[installHTML(),'install']
  ].filter(function(x){return x[0]&&String(x[0]).trim();});
  var secs=pairs.map(function(x){return x[0];});
  var fine=footFine();
  var title=function(h){var m=/<h3>([\s\S]*?)<\/h3>/.exec(h);return m?m[1]:'';};
  var idx=U.sTab;
  if(idx!=null&&secs[idx]){
    return head0+'<button class="btn ghost sm" data-act="sTab" data-k="">رجوع للتبويبات</button><div style="margin-top:10px">'+foldTables(secs[idx],'sTbl'+idx)+'</div>'+fine;
  }
  var tiles=pairs.map(function(x,i){
    return '<button class="stile" data-act="sTab" data-k="'+i+'"><span class="sic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(SET_IC[x[1]]||SET_IC.users)+'</svg></span><span class="stl">'+(x[1]==='boxtpl'?'إضافة علبة جاهزة':(title(x[0])||('تبويب '+(i+1))))+'</span></button>';
  }).join('');
  return head0+'<div class="sgrid">'+tiles+'</div>'+fine;
}



function footFine(){
  return '<div class="fine"><span>الحفظ تلقائي على جوجل درايف · نسخة '+APP_BUILD+' · المجموعات والتعبئة الجديدة</span><button class="btn ghost sm" data-act="logout">تسجيل خروج</button></div>';
}

/* ===== تحديث النظام: زرار تحديث عميق في الهيدر + ورقة إجبارية قبل الدخول لو فيه نسخة أحدث ===== */
var APP_BUILD='20261125-1330';
/* بعد أي تحديث: لو النسخة اتغيرت، نبلّغ المستخدم إن الأيقونة على الشاشة الرئيسية ممكن تفضل قديمة لحد ما يعيد إضافة التطبيق */
(function(){
  var KEY='khat-build-seen';
  window.addEventListener('load',function(){
    setTimeout(function(){
      try{
        var prev=localStorage.getItem(KEY);
        if(prev===null){localStorage.setItem(KEY,APP_BUILD);return;}
        if(prev!==APP_BUILD){
          toast('التطبيق اتحدّث. لو الأيقونة على الشاشة الرئيسية لسه قديمة، امسح الاختصار وضيفه تاني');
          localStorage.setItem(KEY,APP_BUILD);
        }
      }catch(e){}
    },2500);
  });
})();
function deepRefresh(){
  var go=function(){location.replace(location.pathname+'?v='+Date.now()+(location.hash||''));};
  try{
    var sw=('serviceWorker' in navigator)?navigator.serviceWorker.getRegistrations():Promise.resolve([]);
    sw.then(function(regs){return Promise.all(regs.map(function(r){return r.unregister();}));})
      .then(function(){return window.caches?caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));}):null;})
      .then(go,go);
  }catch(e){go();}
}
/* فحص التحديث: HEAD بس (بدون تحميل الملف كله)، ومقارنة الـ ETag بالقيمة اللي اتسجلت قبل كده */
function updCheck(){
  /* متوقف: الإصدار الجديد بيتعرض للحسابات بس بعد نشره من تبويب التحديثات، مش أول ما الملف يترفع على GitHub */
  return;
  fetch('index.html',{method:'HEAD',cache:'no-store'}).then(function(r){
    if(!r.ok)return;
    var v=r.headers.get('etag')||r.headers.get('last-modified');
    if(!v)return;
    var old=null;try{old=localStorage.getItem('khat-build');}catch(e){}
    if(!old){try{localStorage.setItem('khat-build',v);}catch(e){}return;}
    if(old!==v){try{localStorage.setItem('khat-build',v);}catch(e){}window.UPD_NEEDED=true;render();}
  }).catch(function(){});
}
function updOverlay(){
  if(!window.UPD_NEEDED)return '';
  setTimeout(function(){updLiveVer().then(function(v){var el=document.getElementById('updLatest');if(el&&v)el.textContent=v;});},0);
  return '<div class="updsys" role="alertdialog" aria-modal="true" aria-label="تحديث التطبيق"><style>'+
    '.updsys{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:20px;background:rgb(3 5 15 / .92);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:Cairo,system-ui,sans-serif;color:#E8ECFF}'+
    '.updsys::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(120,140,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(120,140,255,.06) 1px,transparent 1px);background-size:34px 34px}'+
    '.updsys .updcard{position:relative;width:min(92vw,350px);box-sizing:border-box;padding:1px;background:linear-gradient(135deg,#8FA2FF 0%,#4F5DFF 35%,rgba(246,231,176,.7) 70%,#4F5DFF 100%);clip-path:polygon(28px 0,100% 0,100% calc(100% - 28px),calc(100% - 28px) 100%,0 100%,0 28px)}'+
    '.updsys .updin{padding:24px 22px 20px;background:linear-gradient(170deg,rgba(18,24,64,.97),rgba(7,10,32,.99));clip-path:polygon(27px 0,100% 0,100% calc(100% - 27px),calc(100% - 27px) 100%,0 100%,0 27px);display:flex;flex-direction:column;gap:12px;text-align:center}'+
    '.updsys .upk{font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:1.6px;color:rgba(160,176,255,.8);text-transform:uppercase}'+
    '.updsys .uprow{display:flex;align-items:center;justify-content:space-between}'+
    '.updsys .upnew{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:1.4px;color:#F6E7B0;border:1px solid rgba(246,231,176,.5);padding:4px 8px}'+
    '.updsys h3{margin:14px 0 0;font-size:24px;font-weight:800;color:#fff}'+
    '.updsys p{margin:0;font-size:14px;line-height:1.7;color:rgba(232,236,255,.7)}'+
    '.updsys .upcmp{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:14px;border:1px solid rgba(160,176,255,.2);background:rgba(79,93,255,.07);text-align:start}'+
    '.updsys .upv{margin-top:6px;font-family:"JetBrains Mono",monospace;font-size:20px;font-weight:700;color:#E8ECFF}'+
    '.updsys .upv.new{color:#F6E7B0}'+
    '.updsys .uparr{color:#F6E7B0;font-size:18px}'+
    '.updsys .upbar{height:6px;background:rgba(160,176,255,.16);clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)}'+
    '.updsys .btn.upbtn{height:54px;min-height:54px;border:0;border-radius:0;font-size:16px;font-weight:800;background:linear-gradient(120deg,#F6E7B0 0%,#E2B25A 100%)!important;color:#070A20!important;box-shadow:none!important;margin-top:4px;clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)}'+
    '.updsys .upfoot{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:1.2px;color:rgba(232,236,255,.45)}'+
    '</style><div class="updcard"><div class="updin">'+
    '<div class="uprow"><span class="upk">SYSTEM UPDATE</span><span class="upnew"><i style="width:6px;height:6px;background:#F6E7B0;display:inline-block;transform:rotate(45deg);margin-inline-end:6px"></i>NEW</span></div>'+
    '<h3>فيه تحديث جديد للتطبيق</h3>'+
    '<p>لازم تحدّث عشان تكمل بأحدث التحسينات والإصلاحات.</p>'+
    '<div class="upcmp"><div style="text-align:start"><div class="upk">CURRENT</div><div class="upv" dir="ltr">'+esc(APP_VERSION)+'</div></div>'+
    '<span class="uparr" aria-hidden="true">→</span>'+
    '<div style="text-align:end"><div class="upk">LATEST</div><div class="upv new" id="updLatest" dir="ltr">'+esc((window.UPD_LIVE&&UPD_LIVE.v)||'…')+'</div></div></div>'+
    '<div><div class="upbar" aria-hidden="true"></div><div class="upfoot" style="margin-top:8px;text-align:end">READY · 0%</div></div>'+
    '<button class="btn upbtn" data-act="deepRefresh">تحديث الآن</button>'+
    '<p class="upfoot">DATA IS SAFE · SYNCED TO DRIVE</p>'+
    '</div></div></div>';
}
function deepBtn(){return '<button class="btn ghost sm themebtn" data-act="deepRefresh" aria-label="تحديث عميق للصفحة" title="تحديث عميق للصفحة"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></button>';}
/* زرار الدخول + زرار البصمة جنبه (بيظهر بس لو البصمة متفعلة على الجهاز ده) */
function loginBtnsHTML(){
  var bio=bioSupported()&&!!localStorage.getItem(BIO_KEY);
  var fp='<button class="bioFp" data-act="bioGo" aria-label="الدخول بالبصمة" title="الدخول بالبصمة"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg><span>الدخول بالبصمة</span></button>';
  var lbtn=U.lbusy?'<button class="btn block" data-act="login" disabled>جاري الدخول...</button>':'<button class="btn block" data-act="login">دخول</button>';
  return '<style>.bioRow{display:flex;gap:10px;align-items:center;width:100%}.bioRow .bioFp{flex:1 1 auto;width:100%;max-width:none;height:56px}'+
    '.bioFp{flex:0 0 auto;width:100%;height:56px;border:0;border-radius:0;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;color:#070A20;font:800 16px/1 Cairo,system-ui,sans-serif;background:linear-gradient(120deg,#F6E7B0 0%,#E2B25A 100%);clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);transition:transform .15s ease}.bioFp:active{transform:scale(.96)}.bioFp:focus-visible{outline:2px solid #fff;outline-offset:3px}</style>'+
    '<div class="bioRow">'+fp+'</div>';
}
/* لوحة أرقام مخصصة لشاشة الدخول بس: بتكتب في خانة الرقم السري، والزرار اللي تحتها بيبدّل بينها وبين كيبورد الجهاز */
/* نقط بتوضح عدد الأرقام اللي اتكتبت: 4 على الأقل، ولو الباسورد أطول بتزيد */
/* تحق أمان بعد الرقم السري الصح: 3 خطوات بنفس شكل تحقق الاسترجاع، وبعدها يفتح التطبيق */
function lvRun(fn){
  var bio=!!window.LV_BIO;window.LV_BIO=false;
  var l1=bio?'البصمة':'الرقم السري',d1=bio?'تم التحقق':'تم';
  var ov=document.createElement('div');ov.id='lvOv';
  var CHK='<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  ov.innerHTML='<style>'+
    '#lvOv{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(120% 70% at 50% 20%,rgba(29,44,134,.55),rgba(3,4,15,.94));backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:lvIn .3s ease both;font-family:Cairo,system-ui,sans-serif;color:#E8ECFF;direction:rtl;overflow:hidden}'+
    '#lvOv::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(143,160,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(143,160,255,.06) 1px,transparent 1px);background-size:30px 30px;animation:lvGrid 14s linear infinite}'+
    '.lv-frame{position:relative;width:min(92vw,350px);padding:1px;background:linear-gradient(160deg,#8FA0FF 0%,#2b3596 40%,#F6E7B0 100%);clip-path:polygon(28px 0,100% 0,100% calc(100% - 28px),calc(100% - 28px) 100%,0 100%,0 28px);animation:lvUp .45s cubic-bezier(.2,.8,.2,1) both}'+
    '.lv-card{padding:22px 22px 20px;background:linear-gradient(170deg,#161f5c 0%,#0a0f2e 70%,#070a1f 100%);clip-path:polygon(27px 0,100% 0,100% calc(100% - 27px),calc(100% - 27px) 100%,0 100%,0 27px);display:flex;flex-direction:column;gap:14px}'+
    '.lv-top{display:flex;justify-content:space-between;align-items:center}'+
    '.lv-tag{font-family:var(--mono,monospace);font-size:10px;letter-spacing:2px;color:#F6E7B0;border:1px solid rgba(246,231,176,.6);padding:4px 8px}'+
    '.lv-kick{font-family:var(--mono,monospace);font-size:10px;letter-spacing:2.5px;color:#8FA0FF}'+
    '.lv-h{font-size:26px;font-weight:800;color:#fff;line-height:1.3;text-shadow:0 0 18px rgba(143,160,255,.5)}'+
    '.lv-sub{font-size:14px;line-height:1.6;color:#b9c2f0;margin-top:4px}'+
    '.lv-list{display:flex;flex-direction:column;margin-top:4px}'+
    '.lv-step{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid rgba(143,160,255,.18);opacity:.4;transition:opacity .35s ease}'+
    '.lv-step:first-child{border-top:0}'+
    '.lv-step.spin,.lv-step.done{opacity:1}'+
    '.lv-body{flex:1;min-width:0;text-align:right}'+
    '.lv-body em{display:block;font-style:normal;font-family:var(--mono,monospace);font-size:10px;letter-spacing:2px;color:#8FA0FF}'+
    '.lv-body b{display:block;font-size:17px;font-weight:800;color:#fff;margin-top:2px}'+
    '.lv-body small{display:block;font-size:12px;color:#9aa6d8;margin-top:2px}'+
    '.lv-step.done .lv-body small{color:#F6E7B0}'+
    '.lv-ico{position:relative;flex:0 0 38px;height:38px;display:grid;place-items:center;border:1px solid rgba(143,160,255,.4);clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);transition:border-color .3s,background .3s,box-shadow .3s}'+
    '.lv-ico svg{width:18px;height:18px;stroke:#F6E7B0;fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;display:none}'+
    '.lv-step.spin .lv-ico::after{content:"";position:absolute;inset:8px;border:2px solid rgba(143,160,255,.25);border-top-color:#8FA0FF;border-radius:50%;animation:lvSpin .8s linear infinite}'+
    '.lv-step.done .lv-ico{border-color:#F6E7B0;background:rgba(246,231,176,.12);box-shadow:0 0 14px rgba(246,231,176,.35)}'+
    '.lv-step.done .lv-ico svg{display:block;animation:lvPop .4s ease both}'+
    '.lv-track{height:4px;background:rgba(143,160,255,.15);position:relative;overflow:hidden}'+
    '.lv-fill{position:absolute;inset:0 auto 0 0;width:0;background:linear-gradient(90deg,#4F5DFF,#F6E7B0);box-shadow:0 0 10px rgba(246,231,176,.6);transition:width .5s ease}'+
    '.lv-meta{display:flex;justify-content:space-between;font-family:var(--mono,monospace);font-size:10px;letter-spacing:2px;color:#8FA0FF;margin-top:8px}'+
    '.lv-foot{font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:2px;color:rgba(154,166,216,.7);text-align:center}'+
    '@keyframes lvSpin{to{transform:rotate(360deg)}}'+
    '@keyframes lvIn{from{opacity:0}to{opacity:1}}'+
    '@keyframes lvUp{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}'+
    '@keyframes lvPop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}'+
    '@keyframes lvGrid{to{background-position:0 240px,240px 0}}'+
    '@media (prefers-reduced-motion:reduce){#lvOv,#lvOv::before,.lv-frame,.lv-step.spin .lv-ico::after{animation:none}}'+
    '</style>'+
    '<div class="lv-frame"><div class="lv-card">'+
    '<div class="lv-top"><span class="lv-tag">SECURITY CHECK</span><span class="lv-kick">3 STEPS</span></div>'+
    '<div><div class="lv-h">تحقق أمان</div><div class="lv-sub">بنتأكد إن الدخول ده منك</div></div>'+
    '<div class="lv-list">'+
    '<div class="lv-step spin" id="lvS1"><span class="lv-ico">'+CHK+'</span><div class="lv-body"><em>01 · '+(bio?'BIOMETRIC':'PIN')+'</em><b>'+l1+'</b><small>جاري التحقق...</small></div></div>'+
    '<div class="lv-step" id="lvS2"><span class="lv-ico">'+CHK+'</span><div class="lv-body"><em>02 · DEVICE</em><b>الجهاز</b><small>في الانتظار</small></div></div>'+
    '<div class="lv-step" id="lvS3"><span class="lv-ico">'+CHK+'</span><div class="lv-body"><em>03 · SESSION</em><b>الجلسة</b><small>في الانتظار</small></div></div>'+
    '</div>'+
    '<div><div class="lv-track"><i class="lv-fill" id="lvBar"></i></div><div class="lv-meta"><span>VERIFYING</span><span id="lvCnt">0/3</span></div></div>'+
    '<div class="lv-foot">SECURE SESSION · RMY PRO</div>'+
    '</div></div>';
  document.body.appendChild(ov);
  var set=function(id,st,sub){var el=document.getElementById(id);if(!el)return;el.className='lv-step '+st;if(sub)el.querySelector('small').textContent=sub;};
  var bar=function(p,c){var b=document.getElementById('lvBar');if(b)b.style.width=p+'%';var n=document.getElementById('lvCnt');if(n)n.textContent=c+'/3';};
  setTimeout(function(){set('lvS1','done',d1);set('lvS2','spin','جاري التحقق...');bar(33,1);},500);
  setTimeout(function(){set('lvS2','done','تم');set('lvS3','spin','جاري التأمين...');bar(66,2);},1100);
  setTimeout(function(){set('lvS3','done','تم');bar(100,3);},1700);
  setTimeout(function(){ov.remove();fn();},2200);
}
function pinDotsInner(n){var c=Math.min(8,Math.max(4,n)),h='';for(var i=0;i<c;i++)h+='<span class="pd'+(i<n?' on':'')+'"></span>';return h;}
function padHTML(){
  var css='<style>.lpad{width:100%;max-width:360px;margin:28px auto 0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.lpad button{height:58px;border-radius:999px;border:1px solid rgb(255 255 255 / .18);background:rgb(255 255 255 / .08);color:#fff;font:700 22px/1 var(--mono,monospace),system-ui,sans-serif;cursor:pointer;transition:transform .12s ease,background .2s ease;-webkit-tap-highlight-color:transparent}.lpad button[aria-label="مسح"]{font-size:20px}.lpad button:active{transform:scale(.94);background:rgb(255 255 255 / .2)}.lpad .lp-sm{font-size:15px}.pdots{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:16px;pointer-events:none}.pd{width:14px;height:14px;border-radius:50%;border:2px solid rgb(255 255 255 / .45);transition:background .15s,transform .15s,box-shadow .15s}.pd.on{background:#fff;border-color:#fff;transform:scale(1.1);box-shadow:0 0 10px rgb(255 255 255 / .7)}</style>';
  if(U.lpadNative)return css+'<div class="lpad" style="grid-template-columns:1fr"><button type="button" class="lp-sm" data-act="padMode">لوحة الأرقام</button></div>';
  var k=function(n){return '<button type="button" data-act="padKey" data-k="'+n+'">'+n+'</button>';};
  return css+'<div class="lpad" dir="ltr">'+k(1)+k(2)+k(3)+k(4)+k(5)+k(6)+k(7)+k(8)+k(9)+
    '<span></span>'+k(0)+
    '<button type="button" data-act="padKey" data-k="del" aria-label="مسح">&#9003;</button></div>';
}
/* كيبورد الكمبيوتر: الأرقام والـ Backspace بيشتغلوا في اللوحة وهي شغالة */
document.addEventListener('keydown',function(e){
  var el=document.getElementById('lpin');
  if(!el||!el.readOnly||U.lpadNative)return;
  if(!/^[0-9]$/.test(e.key)&&e.key!=='Backspace')return;
  e.preventDefault();
  ACT.padKey({k:e.key==='Backspace'?'del':e.key});
});
function loginHTML(){
  if(U.reset)return resetHTML();
  var err=U.loginErr?'<div class="note">'+U.loginErr+'</div>':'';
  var logo='<div class="fx-login-wm"><svg viewBox="40 50 1540 320" role="img" aria-label="RMY" style="display:block;width:150px;height:auto"><g fill="#FFFFFF"><path d="M120 70 H475 C535 70 570 105 570 155 C570 205 535 235 475 235 H250 L165 350 H65 L200 180 H465 C480 180 490 170 490 155 C490 140 480 130 465 130 H120 Z"/><path d="M250 252 H420 L590 350 H420 Z"/><path d="M610 70 H700 L820 190 L940 70 H1030 V350 H940 V165 L820 285 L700 165 V350 H610 Z"/><path d="M1050 70 H1160 L1270 165 L1380 70 H1490 L1320 250 V350 H1220 V250 Z"/></g></svg></div><div class="fx-login-sub">SECURE ACCESS · v2.050</div>';
  /* الربط بدرايف بقى شرط للدخول (بوابة في render)، فهنا بس نعرض حالة التحميل لو البيانات لسه بتتجاب */
  if(!S.auth){
    var msg=(GD.on&&!GD.ok)?'استنى لحد ما البيانات تتحمّل':'مافيش بيانات على الجهاز حالياً';
    var gbtn='<button class="gbtn" data-act="gdConnect" aria-label="ربط جوجل درايف" title="ربط جوجل درايف">'+'<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'+'</button>';
    return '<main class="login" dir="rtl" lang="ar"><div class="lcard">'+logo+'<p class="meta">'+msg+'</p>'+(GD.on?'':gbtn)+'</div></main>';
  }
  return '<main class="login" dir="rtl" lang="ar"><div class="lcard">'+logo+'<p class="meta">سجّل دخولك عشان تكمل</p>'+err+
    '<div class="fld"><label for="lpin" style="display:block;text-align:center;font-size:11px!important;letter-spacing:1.6px;color:rgba(232,236,255,.55)!important">ENTER PIN</label><div style="position:relative;height:14px;margin-top:20px"><input id="lpin" type="text" '+(U.lpadNative?'inputmode="text"':'readonly inputmode="none"')+' autocomplete="off" value="'+esc(U.lpinVal||'')+'" style="opacity:0;caret-color:transparent;display:block;width:100%;height:14px;padding:0;border:0" autofocus><div class="pdots" id="pdots">'+pinDotsInner((U.lpinVal||'').length)+'</div></div></div>'+
    padHTML()+
    loginBtnsHTML()+
    '<button class="btn ghost sm block" data-act="resetOpen" style="height:46px;min-height:46px;font-size:14px;font-weight:600;margin-top:10px">نسيت كلمة السر؟</button><div class="fx-login-foot">ENCRYPTED · SYNCED TO DRIVE</div></div></main>'+(U.cardOffPop?cardOffPopupHTML('data-act="cardOffClose"'):'');
}
/* صفحة إعادة تعيين الـ PIN: بتتأكد من الكود وآخر ٤ أرقام من الواتساب، ولو صح بيتغير الـ PIN فوراً */
function waDigits(s){return String(s||'').replace(/[٠-٩]/g,function(c){return String(c.charCodeAt(0)-1632);}).replace(/\D/g,'');}
function findUserByCode(c){var k=String(c||'').trim().toLowerCase();if(!k)return null;return usersList().filter(function(x){return String(x.code).toLowerCase()===k;})[0]||null;}
/* خانة آخر ٤ أرقام: زي الـ placeholder (01xxxxxxxxx)، والـ x الأخيرة بتتبدل بالأرقام اللي بتكتبها */
/* آخر ٤ أرقام: أربع خانات صغيرة، الكتابة بتنتقل لوحدها للخانة اللي بعدها، والكرسور بيظهر جواهم بس */
function lastDigits(){return Array.prototype.map.call(document.querySelectorAll('.rslot'),function(i){return waDigits(i.value).slice(0,1);}).join('');}
function paintBox(st){
  var c=st==='ok'?'#22c55e':st==='bad'?'#ef4444':'rgba(160,176,255,.28)';
  document.querySelectorAll('.rslot').forEach(function(i){i.style.setProperty('border-color',c,'important');});
}
function slotsField(st,val,u){
  var typed=waDigits(val),c=st==='ok'?'#22c55e':st==='bad'?'#ef4444':'rgba(160,176,255,.28)';
  var slotStyle='width:100%!important;height:46px!important;padding:0!important;margin:0!important;box-sizing:border-box!important;border:1px solid '+c+'!important;border-radius:0!important;background:rgba(255,255,255,.04)!important;color:#E8ECFF!important;text-align:center!important;font-family:"JetBrains Mono",monospace!important;font-size:18px!important;letter-spacing:0!important;box-shadow:none!important;outline:none!important;min-width:0!important;caret-color:#fff;';
  var slots='';
  for(var i=0;i<4;i++){slots+='<input class="rslot" data-i="'+i+'" data-v="'+(typed.charAt(i)||'')+'" value="'+(typed.charAt(i)||'')+'" inputmode="numeric" autocomplete="off" placeholder="·" aria-label="رقم '+(i+1)+' من آخر ٤" style="'+slotStyle+'">';}
  return '<div class="fld"><label>WHATSAPP · آخر ٤ أرقام</label>'+
    '<div id="rLastBox" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;direction:ltr">'+slots+'</div></div>';
}
function syncSlots(){}
function slotInput(e){
  var t=e.target;if(!t||!t.classList||!t.classList.contains('rslot'))return;
  var slots=document.querySelectorAll('.rslot'),i=Number(t.dataset.i),d=waDigits(t.value);
  if(d.length===2&&d.charAt(0)===(t.dataset.v||''))d=d.charAt(1);
  if(d.length>1){
    for(var j=0;j<d.length&&i+j<4;j++){slots[i+j].value=d.charAt(j);slots[i+j].dataset.v=d.charAt(j);}
    slots[Math.min(i+d.length,3)].focus();
  }else{
    t.value=d;t.dataset.v=d;
    if(d&&i<3)slots[i+1].focus();
  }
  resetLiveCheck();
}
function slotKey(e){
  var t=e.target;if(!t||!t.classList||!t.classList.contains('rslot'))return;
  if(e.key==='Backspace'&&!t.value&&Number(t.dataset.i)>0){
    var prev=document.querySelectorAll('.rslot')[Number(t.dataset.i)-1];
    prev.value='';prev.dataset.v='';prev.focus();e.preventDefault();resetLiveCheck();
  }
}
document.addEventListener('input',slotInput);
document.addEventListener('keydown',slotKey);
function firstEmptySlot(){var sl=document.querySelectorAll('.rslot');for(var i=0;i<sl.length;i++){if(!sl[i].value)return sl[i];}return null;}
document.addEventListener('focusin',function(e){
  var t=e.target;if(!t||!t.classList||!t.classList.contains('rslot'))return;
  var f=firstEmptySlot();if(f&&f!==t&&Number(t.dataset.i)>Number(f.dataset.i))f.focus();
});
document.addEventListener('click',function(e){
  var box=e.target&&e.target.closest?e.target.closest('#rLastBox'):null;
  if(box&&!(e.target.classList&&e.target.classList.contains('rslot'))){var f=firstEmptySlot();if(f)f.focus();}
});
window.addEventListener('resize',function(){syncSlots();});
/* أول ما الكود وآخر ٤ أرقام يتطابقوا، خانتهم بتختفي والـ PIN الجديد وزرار التغيير بيظهروا مكانهم */
function rCheckId(){
  var idSec=document.getElementById('rIdSec'),pinSec=document.getElementById('rPinSec');
  if(!idSec||!pinSec||U.rVerified)return;
  var code=((document.getElementById('rCode')||{}).value||'').trim();
  var u=code?findUserByCode(code):null;
  var last=lastDigits();
  var waD=u?waDigits(u.wa):'';
  if(!u||u.cardActive===false||!waD||last.length<4){paintBox('');return;}
  if(waD.slice(-4)!==last){paintBox('bad');return;}
  paintBox('ok');
  U.rVerified={code:u.code,last:last};
  rvRun(u);
}
/* نافذة التحقق: خطوات بتتعمل واحدة ورا التانية، وبعدها الانتقال لخانات الـ PIN الجديد */
function rvCss(){
  if(document.getElementById('rvCss'))return;
  var st=document.createElement('style');st.id='rvCss';
  st.textContent=
    '@keyframes rvFade{from{opacity:0}to{opacity:1}}'+
    '@keyframes rvPop{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}'+
    '@keyframes rvSpin{to{transform:rotate(360deg)}}'+
    '@keyframes rvTick{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}'+
    '@keyframes rvOut{to{opacity:0;transform:translateY(-10px)}}'+
    '#rvModal{position:fixed;inset:0;z-index:300;background:rgba(5,7,26,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;animation:rvFade .25s ease both}'+
    '#rvModal .rv-card{background:#fff;color:#111;border-radius:20px;padding:24px;max-width:340px;width:100%;direction:rtl;box-shadow:0 30px 60px -20px rgba(0,0,0,.5);animation:rvPop .35s cubic-bezier(.2,.8,.2,1) both;font-family:inherit}'+
    '.rv-step{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #eef0f6;opacity:.35;transition:opacity .3s}'+
    '.rv-step.spin,.rv-step.done{opacity:1}'+
    '.rv-ico{width:28px;height:28px;border-radius:50%;border:2px solid #cfd3e6;display:grid;place-items:center;flex:none;font-size:14px;font-weight:800;color:#fff}'+
    '.rv-step.spin .rv-ico{border-color:#2B3595;border-top-color:transparent;animation:rvSpin .8s linear infinite}'+
    '.rv-step.done .rv-ico{background:#22c55e;border-color:#22c55e;animation:rvTick .35s ease both}'+
    '.rv-step.done .rv-ico::before{content:"✓"}'+
    '.rv-t{min-width:0}.rv-t b{display:block;font-size:15px}.rv-t small{color:#6b7090;font-size:12px}'+
    '.rv-bar{height:4px;background:#eef0f6;border-radius:99px;overflow:hidden;margin-top:16px}'+
    '.rv-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2B3595,#c0185c);transition:width .5s ease}'+
    '#rPinSec.rv-in{animation:rvPop .5s cubic-bezier(.2,.8,.2,1) both}'+
    '#rIdSec.rv-out{animation:rvOut .3s ease both}';
  document.head.appendChild(st);
}
function rvRun(u){
  rvCss();
  var m=document.createElement('div');m.id='rvModal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
  m.innerHTML='<div class="rv-card">'+
    '<div style="font-size:34px;text-align:center;line-height:1">🔐</div>'+
    '<h3 style="text-align:center;margin:10px 0 4px;font-size:18px">التحقق من الحساب</h3>'+
    '<p style="text-align:center;margin:0 0 6px;color:#6b7090;font-size:13px">بنتأكد من بياناتك عشان نأمّن الحساب</p>'+
    '<div class="rv-step spin" id="rvS1"><span class="rv-ico"></span><div class="rv-t"><b>الكود</b><small>جاري التحقق...</small></div></div>'+
    '<div class="rv-step" id="rvS2"><span class="rv-ico"></span><div class="rv-t"><b>رقم الواتساب</b><small>في الانتظار</small></div></div>'+
    '<div class="rv-step" id="rvS3"><span class="rv-ico"></span><div class="rv-t"><b>تأمين الحساب</b><small>في الانتظار</small></div></div>'+
    '<div class="rv-bar"><i id="rvBar"></i></div></div>';
  document.body.appendChild(m);
  var set=function(id,state,sub){var el=document.getElementById(id);if(!el)return;el.className='rv-step '+state;if(sub)el.querySelector('small').textContent=sub;};
  var bar=function(pc){var b=document.getElementById('rvBar');if(b)b.style.width=pc+'%';};
  bar(10);
  setTimeout(function(){set('rvS1','done','الكود صح: '+(u.name||''));set('rvS2','spin');bar(40);},600);
  setTimeout(function(){set('rvS2','done','آخر ٤ أرقام مطابقة');set('rvS3','spin');bar(75);},1250);
  setTimeout(function(){set('rvS3','done','الحساب اتأكد');bar(100);},1900);
  setTimeout(function(){var mm=document.getElementById('rvModal');if(mm){mm.style.transition='opacity .3s';mm.style.opacity='0';}},2500);
  setTimeout(function(){
    var mm=document.getElementById('rvModal');if(mm)mm.remove();
    var idSec=document.getElementById('rIdSec'),pinSec=document.getElementById('rPinSec');
    if(idSec)idSec.classList.add('rv-out');
    setTimeout(function(){
      if(idSec){idSec.style.display='none';idSec.classList.remove('rv-out');}
      if(pinSec){pinSec.style.display='flex';pinSec.classList.add('rv-in');}var pb=document.getElementById('rPinBtn');if(pb)pb.style.display='block';
      var pw=document.getElementById('rPw');if(pw)pw.focus();
    },300);
  },2850);
}
document.addEventListener('input',function(e){
  var t=e.target;
  if(t&&(t.id==='rCode'||(t.classList&&t.classList.contains('rslot'))))rCheckId();
});
function rField(id,label,attrs,st,val,withMask,mask){
  var c=st==='ok'?'#22c55e':st==='bad'?'#ef4444':'';
  var ic=c?'<span id="'+id+'Ic" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);font-weight:700;color:'+c+'">'+(st==='ok'?'✓':'✕')+'</span>':'';
  var sty=(withMask?'direction:ltr;text-align:left;padding-inline-start:16px;padding-inline-end:112px;':'')+(c?'border-color:'+c+';'+(withMask?'':'padding-inline-start:38px'):'');
  var pre=withMask?'<span id="rMask" class="ltr" style="position:absolute;inset-inline-end:16px;top:50%;transform:translateY(-50%);font:inherit;letter-spacing:1px;pointer-events:none;display:'+(mask?'inline':'none')+'">'+esc(mask||'')+'</span>':'';
  return '<div class="fld"><label for="'+id+'">'+label+'</label><div style="position:relative">'+'<input id="'+id+'" '+attrs+' value="'+esc(val||'')+'"'+(sty?' style="'+sty+'"':'')+'>'+pre+ic+'</div></div>';
}
function resetHTML(){
  if(U.resetDone){
    return '<main class="login" dir="rtl" lang="ar"><div class="lcard">'+
      '<h2>تم تغيير الـ PIN</h2>'+
      '<p class="meta">تم تغيير الـ PIN بتاعك بنجاح، ادخل بيه دلوقتي.</p>'+
      '<button class="btn ghost sm block" data-act="resetBack">رجوع لتسجيل الدخول</button></div></main>';
  }
  var m=U.rMark||{},v=U.rv||{};
  var vd=!!U.rVerified;
  var err='<div id="rErr" class="note" style="display:none;margin-bottom:10px"></div>';
  setTimeout(syncSlots,0);
  var pinAttrs='type="password" inputmode="numeric" maxlength="6" pattern="[0-9]*" autocomplete="new-password"';
  return '<main class="login rst" dir="rtl" lang="ar"><style>'+
    '.login{position:relative;overflow:hidden}.login::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(120,140,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(120,140,255,.07) 1px,transparent 1px);background-size:34px 34px;-webkit-mask-image:radial-gradient(80% 55% at 50% 20%,#000 30%,transparent 100%);mask-image:radial-gradient(80% 55% at 50% 20%,#000 30%,transparent 100%)}'+
    '.login.rst{position:fixed!important;inset:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;display:block!important;height:auto!important;min-height:100vh;min-height:100dvh;justify-content:flex-start!important;padding:calc(env(safe-area-inset-top,0px) + 52px) 22px calc(env(safe-area-inset-bottom,0px) + 22px)!important;box-sizing:border-box;background:radial-gradient(120% 60% at 50% 0%,#121a4a 0%,#070a1f 55%,#03040c 100%)!important;z-index:300}'+
    '.login.rst .lcard>*{position:relative;z-index:1}'+
    '.login.rst .lcard{background:none!important;border:0!important;clip-path:none!important;padding:0!important;max-width:none!important;width:100%!important;gap:18px!important;justify-content:flex-start!important;align-items:stretch!important;text-align:start!important;z-index:1}'+
    '.login.rst .lcard h2{font-size:24px;margin:0;color:#fff}'+
    '.login.rst .lcard .meta{font-size:13px!important;margin:8px 0 0!important;line-height:1.6;text-align:start!important}'+
    '.rfrm{position:relative;padding:18px;border:1px solid rgba(160,176,255,.22);background:linear-gradient(170deg,rgba(18,24,64,.92),rgba(7,10,32,.96));clip-path:polygon(22px 0,100% 0,100% calc(100% - 22px),calc(100% - 22px) 100%,0 100%,0 22px);display:flex;flex-direction:column;gap:16px}'+
    '#rIdSec,#rPinSec{display:flex;flex-direction:column;gap:16px}'+
    '.login.rst .fld{gap:6px;width:100%;box-sizing:border-box;align-self:stretch;margin:0}'+
    '.login.rst .fld label{font-family:Tajawal,sans-serif!important;font-size:14px!important;font-weight:700;margin:0;letter-spacing:.3px;color:#9fb0ff!important}'+
    '.login.rst .fld input{height:46px!important;width:100%!important;box-sizing:border-box!important;margin:0!important;border-radius:0!important;font-size:16px}'+
    '.login.rst .fx-rtop{display:flex;justify-content:space-between;align-items:center;width:100%}'+
    '.login.rst .fx-back{font-family:Tajawal,sans-serif;font-size:16px;font-weight:700;color:#E8ECFF;background:transparent;border:1px solid rgba(160,176,255,.45);padding:8px 18px;cursor:pointer;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}'+
    '.login.rst .fx-rtop>span{font-family:"JetBrains Mono",monospace;font-size:12px;letter-spacing:2.5px;color:#8FA0FF}'+
    '.login.rst .btn.ghost,.login .btn.ghost{background:transparent!important;border:1px solid rgba(160,176,255,.3)!important;color:#E8ECFF!important;clip-path:none!important}'+
    '.login.rst .btn{min-height:46px!important;height:46px!important;padding-top:0!important;padding-bottom:0!important;line-height:normal!important;font-size:16px!important;border-radius:0!important}'+
    '.login.rst .btn.block{height:56px!important;min-height:56px!important;font-size:17px!important;font-weight:800}'+
    '.login.rst .btn.ghost.block{color:#E8ECFF!important;font-size:16px!important}'+
    '.login.rst .btn+.btn{margin-top:10px!important}'+
    '.login.rst .lcard .note{font-size:12px;padding:6px 10px!important;margin:0!important}'+
    '.rslot::placeholder{color:rgba(232,236,255,.4);opacity:1}'+
    '</style><div class="lcard"><div class="fx-rtop"><button class="fx-back" data-act="resetBack" aria-label="رجوع">رجوع</button><span>RESET // PIN</span></div>'+
    '<div><h2>إعادة تعيين الـ PIN</h2>'+
    '<p class="meta">اكتب الكود بتاعك، وآخر ٤ أرقام من رقم الواتساب المسجل عندنا، والـ PIN الجديد.</p></div>'+
    err+
    '<div class="rfrm">'+
    '<div id="rIdSec" style="display:'+(vd?'none':'flex')+'">'+
    rField('rCode','CODE · الكود بتاعك','autocomplete="off" placeholder="RMY-0000"',m.code,v.code,false,'')+
    slotsField(m.last,v.last,findUserByCode(v.code))+
    '</div>'+
    '<div id="rPinSec" style="display:'+(vd?'flex':'none')+'">'+
    rField('rPw','NEW PIN · الـ PIN الجديد',pinAttrs,m.pw,v.pw,false,'')+
    rField('rPw2','CONFIRM · تأكيد الـ PIN',pinAttrs,m.pw2,v.pw2,false,'')+
    '</div></div>'+
    '<div id="rPinBtn" style="display:'+(vd?'block':'none')+'"><button class="btn block" data-act="resetSend">تغيير الـ PIN</button></div>'+
    '<button class="btn ghost sm block" data-act="resetBack" style="margin-top:0">رجوع لتسجيل الدخول</button>'+
    '<p style="margin:6px 0 0;text-align:center;text-align-last:center;font-family:Tajawal,sans-serif;font-size:14px;line-height:1.6;color:rgba(232,236,255,.72)">الطلب بيتراجع من المسئول لو الكود مش صح</p></div></main>';
}
/* ---------- FX: حركة الدخول، عدّاد الأرقام، إضاءة المؤشر ---------- */
var FX=(function(){
  var lastKey=null,t0=0,tm=0,sl=0,inited=false;
  var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function latin(s){return s.replace(/[٠-٩]/g,function(c){return String(c.charCodeAt(0)-1632);});}
  function countUp(el){
    var raw=el.textContent.trim(),clean=latin(raw).replace(/[,٬\s]/g,'');
    if(!/^\d{1,6}$/.test(clean))return;
    var to=+clean;if(to<2)return;
    var start=performance.now(),dur=Math.min(900,350+to*6);
    (function step(now){
      var k=Math.min(1,(now-start)/dur),e=1-Math.pow(1-k,3);
      el.textContent=k<1?f(Math.round(to*e)):raw;
      if(k<1&&el.isConnected)requestAnimationFrame(step);
    })(start);
  }
  function init(){
    inited=true;
    var app=document.getElementById('app');
    if(rm||!window.matchMedia||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
    app.addEventListener('pointermove',function(e){
      var el=e.target.closest&&e.target.closest('.card,.tab,.tile,.rd');if(!el)return;
      var r=el.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
      el.style.setProperty('--mx',x+'px');el.style.setProperty('--my',y+'px');
      if(el.classList.contains('tab')&&el.closest('.hgrid')){
        el.style.setProperty('--ry',((x/r.width-.5)*10).toFixed(1));
        el.style.setProperty('--rx',((.5-y/r.height)*8).toFixed(1));
      }
    },{passive:true});
    app.addEventListener('pointerout',function(e){
      var el=e.target.closest&&e.target.closest('.hgrid .tab');
      if(el){el.style.setProperty('--rx',0);el.style.setProperty('--ry',0);}
    });
  }
  /* بعد كل render: o.key = الشاشة الحالية، o.hadSheet = كان فيه نافذة مفتوحة قبل الرسم */
  function after(o){
    var app=document.getElementById('app');if(!app)return;
    if(!inited)init();
    var now=performance.now(),changed=o.key!==lastKey;
    if(changed){
      lastKey=o.key;t0=now;
      /* الرجوع للرئيسية بينزلق من اليمين، أي شاشة تانية بتنزلق من الشمال */
      var dirCls=o.key==='home'?'slide-back':'slide-fwd';
      app.classList.remove('slide-fwd','slide-back');void app.offsetWidth;app.classList.add(dirCls);
      clearTimeout(sl);sl=setTimeout(function(){app.classList.remove('slide-fwd','slide-back');},460);
      app.classList.add('enter');
      clearTimeout(tm);tm=setTimeout(function(){app.classList.remove('enter');app.style.removeProperty('--el');},1600);
    }
    if(app.classList.contains('enter')&&!rm){
      var i=0;
      [].forEach.call(app.querySelectorAll('.hgrid .tab,.view>*:not(.list),.view .list>*'),function(el){el.style.setProperty('--i',Math.min(i++,12));});
      app.style.setProperty('--el',Math.round(now-t0)+'ms');
      if(changed)[].forEach.call(app.querySelectorAll('.today b,.hgrid .cnt'),countUp);
    }
    if(!o.hadSheet){
      var s=app.querySelector('.sheet'),b=app.querySelector('.back');
      if(s)s.classList.add('pop');if(b)b.classList.add('pop');
    }
  }
  return {after:after};
})();

/* قفل فتح التطبيق بالبصمة أو الوجه على الجهاز ده (WebAuthn). بيشتغل من رابط https أو من المتصفح */
var BIO_KEY='rmy-bio-cred';
function bioSupported(){return !!(window.PublicKeyCredential&&navigator.credentials&&window.isSecureContext);}
/* القفل بيتطلب مرة واحدة لكل فتح للتطبيق: التحديث بتاع الصفحة مش بيقفله تاني (الحالة في sessionStorage) */
function bioSessionSet(){try{sessionStorage.setItem('khat-bio-ok','1');}catch(e){}}
function bioSessionOk(){try{return sessionStorage.getItem('khat-bio-ok')==='1';}catch(e){return false;}}
function bioLocked(){return !!localStorage.getItem(BIO_KEY)&&!bioSessionOk()&&!U.bioSkip;}
function bioEnable(){
  return navigator.credentials.create({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    rp:{name:'RMY Pro'},
    user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'rmy-user',displayName:'RMY Pro'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},
    timeout:60000}}).then(function(cred){
      localStorage.setItem(BIO_KEY,btoa(String.fromCharCode.apply(null,new Uint8Array(cred.rawId))));
    });
}
function bioUnlock(){
  var id=localStorage.getItem(BIO_KEY);if(!id)return Promise.resolve();
  var raw=Uint8Array.from(atob(id),function(c){return c.charCodeAt(0);});
  return navigator.credentials.get({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials:[{type:'public-key',id:raw}],
    userVerification:'required',timeout:60000}});
}


function bioPromptHTML(){
  return '<section class="login" style="text-align:center;padding:40px 16px"><h2 style="margin-bottom:8px">فتح أسرع بالبصمة</h2>'+
    '<p class="meta" style="margin-bottom:24px">فعّل البصمة أو الوجه، وبعدها التطبيق هيطلبها أول ما تفتحه بدل الـ PIN.</p>'+
    '<div class="btns" style="justify-content:center;flex-direction:column;gap:10px">'+
    '<button class="btn" data-act="bioEnableAct">فعّل البصمة أو الوجه</button>'+
    '<button class="btn ghost sm" data-act="bioLater">لاحقاً</button></div></section>';
}
/* شاشة التحميل: بتظهر لحد ما أول مزامنة من درايف تخلص، ولو فشلت بتعرض السبب وزرار المحاولة */
function gdStage(t,pct){
  GD.stage=t;if(pct!=null)GD.pct=Math.max(GD.pct||0,Math.min(100,pct));
  var el=document.getElementById('ldMsg');if(el)el.textContent=t;
  ldSmoothStart();
}
/* شاشة التحميل: موجة السائل داخل حروف الشعار، والنسبة بتتحكم في مستوى الموجة */
var LD_LETTERS=["M65 70 H475 C535 70 570 105 570 155 C570 205 535 235 475 235 H250 L165 350 H65 L200 180 H465 C480 180 490 170 490 155 C490 140 480 130 465 130 H120 Z","M250 252 H420 L590 350 H420 Z","M610 70 H700 L820 190 L940 70 H1030 V350 H940 V165 L820 285 L700 165 V350 H610 Z","M1050 70 H1160 L1270 165 L1380 70 H1490 L1320 250 V350 H1220 V250 Z"];
var LD_RUN=false;
function ldWaveD(p,t){
  if(p>=100)return 'M0 0 H1600 V600 H0 Z';
  var top=352-(p/100)*290, amp=14*(1-p/100)+3, d='M40 360 L40 '+top.toFixed(2)+' ';
  for(var x=40;x<=1520;x+=28){
    var y=top+amp*Math.sin(x*0.017+t*4)+amp*0.5*Math.sin(x*0.031-t*2.6);
    d+='L'+x+' '+y.toFixed(2)+' ';
  }
  return d+'L1520 360 Z';
}
function ldFrame(){
  var w=document.getElementById('ldWave');
  if(!w){LD_RUN=false;return;}
  w.setAttribute('d',ldWaveD(Math.max(0,Math.min(100,GD.pct||0)),performance.now()/1000));
  requestAnimationFrame(ldFrame);
}
function ldStart(){if(!LD_RUN){LD_RUN=true;requestAnimationFrame(ldFrame);}}
/* الحلقة الذهبية حوالين الشعار: طولها وطرفها المضيء بيتحكموا بنسبة التحميل نفسها */
/* الحركة الناعمة: القيمة المعروضة بتقرب من نسبة التحميل فريم بفريم، والشريط والحلقة بيتحدّثوا معاها */
var LD_SM={on:false,shown:0};
function ldSmoothTick(){
  var bf=document.getElementById('ldBarFill');
  if(!bf){LD_SM.on=false;return;}
  var tgt=Math.max(0,Math.min(100,GD.pct||0));
  LD_SM.shown+=(tgt-LD_SM.shown)*0.1;
  var settled=Math.abs(tgt-LD_SM.shown)<0.02;
  if(settled)LD_SM.shown=tgt;
  var v=LD_SM.shown,r=Math.round(v)+'%';
  bf.style.width=v.toFixed(2)+'%';
  var p=document.getElementById('ldPct');if(p)p.textContent=r;
  var pl=document.getElementById('ldPctLbl');if(pl)pl.textContent=r;
  ldRingSet(v);
  if(settled){LD_SM.on=false;return;}
  requestAnimationFrame(ldSmoothTick);
}
function ldSmoothStart(){
  if(LD_SM.on)return;
  LD_SM.on=true;
  requestAnimationFrame(ldSmoothTick);
}
function ldRingHTML(p){
  var R=85,C=2*Math.PI*R;p=Math.max(0,Math.min(100,p));
  var t=2*Math.PI*p/100,dx=100+R*Math.cos(t),dy=100+R*Math.sin(t);
  return '<svg aria-hidden="true" viewBox="0 0 200 200" style="position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible">'+
    '<defs><linearGradient id="ldRg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6E7B0"/><stop offset="1" stop-color="#E6B964"/></linearGradient></defs>'+
    '<circle cx="100" cy="100" r="'+R+'" fill="none" stroke="rgba(246,231,176,.14)" stroke-width="3"/>'+
    '<circle id="ldArc" cx="100" cy="100" r="'+R+'" fill="none" stroke="url(#ldRg)" stroke-width="3" stroke-linecap="round" stroke-dasharray="'+C.toFixed(2)+'" stroke-dashoffset="'+(C*(1-p/100)).toFixed(2)+'" style="filter:drop-shadow(0 0 6px rgba(246,231,176,.7))"/>'+
    '<circle id="ldDot" cx="'+dx.toFixed(2)+'" cy="'+dy.toFixed(2)+'" r="4" fill="#F6E7B0" style="display:'+(p<=0.5?'none':'block')+';filter:drop-shadow(0 0 6px #F6E7B0)"/>'+
    '</svg>';
}
function ldRingSet(p){
  var R=85,C=2*Math.PI*R;p=Math.max(0,Math.min(100,p));
  var a=document.getElementById('ldArc'),d=document.getElementById('ldDot');
  if(a)a.setAttribute('stroke-dashoffset',(C*(1-p/100)).toFixed(2));
  if(d){var t=2*Math.PI*p/100;d.setAttribute('cx',(100+R*Math.cos(t)).toFixed(2));d.setAttribute('cy',(100+R*Math.sin(t)).toFixed(2));d.style.display=p<=0.5?'none':'block';}
}
function loaderHTML(dark){
  var failed=!!GD.err&&!GD.busy;
  var msg=failed?String(GD.err):(GD.needTap?'محتاج تأكيد من جوجل':(GD.stage||'جاري تحميل البيانات من جوجل درايف…'));
  var pct=Math.round(GD.pct||0);
  var showMsg=failed||GD.needTap;
  return '<div dir="rtl" style="position:fixed;inset:0;width:100%;height:100%;box-sizing:border-box;padding:0 28px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(90% 55% at 50% 42%,rgba(79,93,255,.42) 0%,rgba(79,93,255,0) 70%),#0c1233;color:#E8ECFF;font-family:Cairo,system-ui,sans-serif;overflow:hidden">'+
    '<div aria-hidden="true" style="position:absolute;inset:0;background-image:linear-gradient(rgba(120,140,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(120,140,255,.07) 1px,transparent 1px);background-size:34px 34px;-webkit-mask-image:radial-gradient(70% 50% at 50% 45%,#000 30%,transparent 100%);mask-image:radial-gradient(70% 50% at 50% 45%,#000 30%,transparent 100%)"></div>'+
    '<div style="position:relative;width:200px;height:200px;display:grid;place-items:center">'+
      '<div aria-hidden="true" style="position:absolute;inset:0;border-radius:50%;border:1px dashed rgba(160,176,255,.35)"></div>'+
      ldRingHTML(GD.pct||0)+
      '<div aria-hidden="true" style="position:absolute;inset:34px;border-radius:50%;background:radial-gradient(circle,rgba(79,93,255,.55),rgba(79,93,255,0) 70%)"></div>'+
      '<svg viewBox="150 135 415 500" role="img" aria-label="RM" style="position:relative;width:96px;height:auto;filter:drop-shadow(0 0 14px rgba(120,140,255,.7))"><defs><linearGradient id="ldgM" x1="0" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#EAF0FF"/></linearGradient></defs><g fill="url(#ldgM)" fill-rule="evenodd"><path d="M378 144 L354 154 335 162 314 171 298 178 275 189 255 196 192 223 182 229 338 301 355 316 362 327 371 346 377 365 380 388 382 422 380 427 379 439 373 455 365 466 356 475 341 484 326 487 329 503 344 540 350 556 362 586 368 602 380 627 413 615 415 389 421 390 427 414 431 436 437 461 443 483 449 508 455 532 460 547 467 579 474 592 486 586 509 577 516 528 522 493 524 478 530 449 533 427 536 402 542 375 545 345 549 330 553 331 554 349 554 559 573 551 581 548 582 253 581 229 563 222 548 216 537 211 509 199 497 194 481 187 465 180 453 175 428 163 419 160 387 145Z M293 212 L305 207 319 208 330 218 345 224 368 235 389 242 400 247 419 256 436 263 451 268 469 283 473 294 479 348 485 376 485 275 476 264 429 244 411 235 387 223 365 214 351 211 337 201 338 195 356 187 369 191 381 202 398 208 447 230 465 238 482 247 497 253 508 270 505 369 500 421 497 458 496 495 492 505 488 503 482 474 479 458 470 412 467 397 455 335 452 319 450 307 444 293 436 286 404 273 391 267 361 253 341 244 320 235 301 232 289 223 290 216Z"/><path d="M217 321 L216 396 239 407 267 418 289 422 304 418 312 405 312 385 305 367 293 354 284 349 267 342 230 325Z"/><path d="M217 457 L216 560 239 571 267 581 291 592 299 595 287 560 279 542 267 511 254 474 243 468 235 463Z"/></g></svg>'+
    '</div>'+
    '<div style="margin-top:34px;text-align:center"><div style="font-size:22px;font-weight:800">جاري تحميل البيانات</div><div style="margin-top:8px;font-family:var(--mono,monospace);font-size:11px;letter-spacing:1.8px;color:rgba(160,176,255,.85)">SYNCING WITH DRIVE</div></div>'+
    '<div style="margin-top:30px;width:100%;max-width:280px">'+
      '<div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" aria-label="نسبة التحميل" style="height:6px;background:rgba(160,176,255,.16);position:relative;clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)"><span id="ldBarFill" style="position:absolute;left:0;top:0;bottom:0;width:'+pct+'%;background:linear-gradient(90deg,#4F5DFF,#F6E7B0);box-shadow:0 0 14px rgba(246,231,176,.6)"></span></div>'+
      '<div style="margin-top:10px;display:flex;justify-content:space-between;font-family:var(--mono,monospace);font-size:11px;letter-spacing:1.4px;color:rgba(232,236,255,.6)"><span>LOADING</span><span id="ldPctLbl">'+pct+'%</span></div>'+
    '</div>'+
    '<span id="ldPct" style="display:none">'+pct+'%</span>'+
    '<div id="ldMsg" style="margin-top:14px;color:#dfe4ff;font-size:12px;max-width:300px;opacity:.75;text-align:center;display:'+(showMsg?'block':'none')+'">'+esc(msg)+'</div>'+
    (showMsg?'<button class="btn" data-act="loaderRetry" style="margin-top:12px">حاول تاني</button>':'')+
    '<div style="position:absolute;bottom:34px;left:0;right:0;text-align:center;font-family:var(--mono,monospace);font-size:10px;letter-spacing:2px;color:rgba(232,236,255,.4)">RMY PRO · v'+APP_VERSION+'</div>'+
  '</div>';
}
/* رسالة "مفيش إنترنت": بتظهر بس لما الاتصال يقع فعلاً وإنت جوه التطبيق (مش لما ترجع للشاشة) */
function netBanner(show){
  var b=document.getElementById('netBanner');
  if(!show){if(b)b.remove();return;}
  if(b)return;
  b=document.createElement('div');b.id='netBanner';b.setAttribute('role','alert');
  b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:320;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;background:#b42318;color:#fff;font-weight:700;font-size:15px;direction:rtl;box-shadow:0 6px 20px rgba(0,0,0,.35)';
  b.innerHTML='<span>مفيش إنترنت، حاول الاتصال مرة أخرى</span><button id="netRetry" style="border:0;border-radius:999px;padding:8px 14px;background:#fff;color:#b42318;font-weight:700;cursor:pointer">حاول تاني</button>';
  document.body.appendChild(b);
  document.getElementById('netRetry').onclick=function(){
    if(navigator.onLine){netBanner(false);try{render();}catch(e){}}
  };
}
window.addEventListener('offline',function(){netBanner(true);});
window.addEventListener('online',function(){netBanner(false);});
if(navigator.onLine===false)netBanner(true);
/* ما نعيدش رسم الشاشة وإنت بتكتب في خانة، عشان البيانات اللي كتبتها ماتختفيش. الرسم بيتأجل لحد ما تخلص */
window.LAST_INPUT=0;window.RENDER_PENDING=false;
document.addEventListener('input',function(e){if(!e.target||e.target.tagName!=='SELECT')window.LAST_INPUT=Date.now();},true);
function typingBusy(){
  var a=document.activeElement;
  var editing=!!a&&/^(INPUT|TEXTAREA)$/.test(a.tagName)&&!!a.closest&&!!a.closest('#app');
  return editing||(Date.now()-window.LAST_INPUT<1200);
}
function flushPendingRender(){
  if(!window.RENDER_PENDING)return;
  if(typingBusy()){setTimeout(flushPendingRender,600);return;}
  window.RENDER_PENDING=false;
  render();
}
document.addEventListener('focusout',function(){setTimeout(flushPendingRender,400);},true);
/* بوابة الربط: مفيش دخول للتطبيق من غير ربط جوجل درايف، لأن البيانات كلها بتتحفظ عليه */
function linkGateRender(){
  gdLoadGis();
  var app=document.getElementById('app');if(!app)return;
  if(app.querySelector('.wl3d-host'))return;
  app.innerHTML=welcomeHTML();
  mountWelcome3D(app.querySelector('.wl3d-host'));
}
/* صفحة الترحيب قبل الربط: خلفية متحركة ودوائر وجزيئات، وزرار "ابدأ" بيعمل نفس ربط جوجل درايف */
function welcomeHTML(){
  return '<div class="wl3d-host" style="position:fixed;inset:0;z-index:60"></div>';
}
/* ===== شاشة الترحيب (3D) ===== */
var WL3D_CSS="\n  :host{\n    --ink:#ffffff;\n    --ink-2:rgba(255,255,255,.86);\n    --ink-3:rgba(255,255,255,.55);\n    --gold:#f3d28b;\n    --gold-2:#e0a94f;\n    --glass-line:rgba(255,255,255,.28);\n  }\n  *{box-sizing:border-box}\n  html,body{height:100%;margin:0}\n  body{\n    font-family:Cairo,Tajawal,\"IBM Plex Sans Arabic\",system-ui,sans-serif;\n    color:var(--ink);\n    background:#0b1035;\n    min-height:100vh;\n    overflow:hidden;\n    -webkit-font-smoothing:antialiased;\n  }\n\n  /* ---------- background stage ---------- */\n  .stage{\n    position:fixed;inset:0;z-index:0;overflow:hidden;\n    background:radial-gradient(60% 50% at 50% 35%,#16205a 0%,#0b1035 70%);\n  }\n  #scene{\n    position:absolute;inset:0;width:100%;height:100%;display:block;\n    -webkit-mask-image:linear-gradient(180deg,#000 68%,transparent 100%);\n            mask-image:linear-gradient(180deg,#000 68%,transparent 100%);\n  }\n  .stage video{\n    position:absolute;inset:0;width:100%;height:100%;\n    object-fit:cover;display:none;\n  }\n  .has-video .stage video{display:block}\n  .has-video #scene,.no-3d #scene{display:none}\n\n  /* readability overlay */\n  .shade{\n    position:absolute;inset:0;pointer-events:none;z-index:1;\n    background:\n      linear-gradient(180deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 28%,rgba(11,16,53,.35) 50%,rgba(9,14,43,.93) 100%),\n      radial-gradient(80% 60% at 50% 40%,transparent 45%,rgba(0,0,0,.5) 100%);\n  }\n\n  /* ---------- foreground ---------- */\n  .wrap{\n    position:relative;z-index:2;\n    min-height:100vh;\n    display:flex;flex-direction:column;\n    padding:26px 24px 30px;\n    max-width:960px;margin:0 auto;\n  }\n  header{\n    display:flex;align-items:center;justify-content:space-between;\n    font-family:monospace;font-size:12px;letter-spacing:2.4px;color:var(--ink-3);\n    animation:up .9s ease both;\n  }\n  .brand{display:flex;align-items:center;gap:10px;color:var(--ink-2)}\n  .mono{\n    width:32px;height:32px;border-radius:10px;\n    display:grid;place-items:center;\n    background:linear-gradient(135deg,var(--gold),var(--gold-2));\n    color:#1a120b;font-weight:800;font-size:14px;letter-spacing:0;\n    font-family:Cairo,sans-serif;\n    box-shadow:0 6px 18px rgba(224,169,79,.35);\n  }\n\n  main{\n    flex:1;transform:translateY(clamp(0px,5vh,48px));\n    display:flex;flex-direction:column;justify-content:flex-end;align-items:center;\n    text-align:center;\n    padding-bottom:20px;\n  }\n  .eyebrow{\n    font-family:monospace;font-size:12px;letter-spacing:3px;color:var(--gold);\n    margin-bottom:12px;\n    animation:up .9s .1s ease both;\n  }\n  h1{\n    margin:0 0 14px;\n    font-size:52px;line-height:1.2;font-weight:800;\n    text-shadow:0 4px 30px rgba(0,0,0,.45);\n    animation:up .9s .2s ease both;\n  }\n  .lead{\n    margin:0 auto 32px;max-width:560px;\n    font-size:17px;line-height:1.9;color:var(--ink-2);\n    text-shadow:0 2px 16px rgba(0,0,0,.5);\n    animation:up .9s .3s ease both;\n  }\n\n  .btn{\n    position:relative;overflow:hidden;\n    min-width:260px;height:58px;padding:0 40px;\n    border-radius:18px;border:1px solid var(--glass-line);\n    background:linear-gradient(135deg,var(--gold),var(--gold-2));\n    color:#1a120b;\n    font:inherit;font-size:19px;font-weight:800;cursor:pointer;\n    display:inline-flex;align-items:center;justify-content:center;gap:12px;\n    box-shadow:0 16px 40px rgba(224,169,79,.35),inset 0 1px 0 rgba(255,255,255,.4);\n    transition:transform .15s ease,box-shadow .25s ease,filter .25s ease;\n    animation:up .9s .4s ease both;\n  }\n  .btn::after{\n    content:\"\";position:absolute;top:0;bottom:0;width:40%;right:-60%;\n    background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);\n    animation:shine 3.8s ease-in-out infinite;\n  }\n  .btn svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}\n  .btn:hover{filter:brightness(1.05);box-shadow:0 20px 48px rgba(224,169,79,.5),inset 0 1px 0 rgba(255,255,255,.4)}\n  .btn:active{transform:scale(.98)}\n  .btn:focus-visible{outline:2px solid #fff;outline-offset:4px}\n\n  .assure{\n    margin-top:18px;\n    display:flex;align-items:center;gap:8px;\n    font-size:13px;color:var(--ink-3);\n    animation:up .9s .5s ease both;\n  }\n  .assure svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\n\n  footer{\n    margin-top:26px;\n    display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;\n    font-family:monospace;font-size:11px;letter-spacing:1.4px;color:var(--ink-3);\n    animation:up .9s .6s ease both;\n  }\n\n  @keyframes up{\n    from{opacity:0;transform:translateY(16px)}\n    to{opacity:1;transform:none}\n  }\n  @keyframes shine{0%{right:-60%}60%,100%{right:120%}}\n\n  @media (max-width:720px){\n    h1{font-size:36px}\n    .lead{font-size:15px}\n    .btn{width:100%;min-width:0}\n    main{padding-bottom:6px}\n  }\n\n  @media (prefers-reduced-motion:reduce){\n    *,*::before,*::after{animation:none!important;transition:none!important}\n  }\n\n:host{display:block;position:fixed;inset:0;color:#fff}\nh1{color:#fff}\n";
var WL3D_HTML="<div class=\"stage\" aria-hidden=\"true\"><canvas id=\"scene\"></canvas></div>\n<div class=\"shade\" aria-hidden=\"true\"></div>\n<div class=\"wrap\">\n  <header>\n    <div class=\"brand\"><span class=\"mono\">R</span><span>RMY · PRODUCTION SUITE</span></div>\n    <span>v2.062</span>\n  </header>\n  <main>\n    <h1>أهلاً بيك في خط الإنتاج</h1>\n    <p class=\"lead\">منصة واحدة لإدارة الأوردرات والتحضير والمخزون والإنتاج، وكل تعديل بيتحفظ تلقائياً على حساب Google Drive بتاعك.</p>\n    <button class=\"btn\" type=\"button\" data-act=\"gdConnect\">\n      <span>ابدأ</span>\n      <svg viewBox=\"0 0 24 24\"><path d=\"M5 12h14M13 6l6 6-6 6\"/></svg>\n    </button>\n    <div class=\"assure\">\n      <svg viewBox=\"0 0 24 24\"><rect x=\"4\" y=\"11\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 8 0v4\"/></svg>\n      <span>اتصال آمن عن طريق حساب جوجل بتاعك</span>\n    </div>\n  </main>\n</div>";
/* الشاشة بتتركب جوه Shadow DOM عشان ستايلها ما يتعارضش مع التطبيق */
function mountWelcome3D(host){
  var root=host.attachShadow({mode:'open'});
  root.innerHTML='<style>'+WL3D_CSS+'</style>'+WL3D_HTML;
  var btn=root.querySelector('.btn');
  if(btn)btn.addEventListener('click',function(){ACT.gdConnect();});
  startWelcome3D(root);
}
function startWelcome3D(root){

  var THREE = window.THREE;
  if (!THREE) return;

  var canvas = root.getElementById('scene');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var renderer;
  try { renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true, alpha: true}); }
  catch (e) { return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1035, 12, 28);

  var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  var TARGET = new THREE.Vector3(0.4, 1.7, 0);

  /* ---------- helpers ---------- */
  function std(color, rough, o){
    return new THREE.MeshStandardMaterial(Object.assign({color: color, roughness: rough, metalness: 0}, o || {}));
  }
  function phys(color, rough, cc, o){
    return new THREE.MeshPhysicalMaterial(Object.assign({color: color, roughness: rough, clearcoat: cc || 0, clearcoatRoughness: 0.15}, o || {}));
  }
  function sh(m){ m.castShadow = true; m.receiveShadow = true; return m; }
  function mesh(geo, mat, x, y, z){
    var m = sh(new THREE.Mesh(geo, mat));
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function canvasTex(draw, w, h){
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* ---------- room ---------- */
  var tiles = canvasTex(function(g, w, h){
    g.fillStyle = '#1a2360'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,176,255,0.12)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h / 2); g.stroke();
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(0, h); g.stroke();
  }, 256, 256);
  tiles.repeat.set(14, 6);

  var backWall = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), std(0xffffff, 0.95, {map: tiles}));
  backWall.position.set(0, 4, -2.6);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // counter: cabinet + marble top (front edge at z ≈ 1.1, back edge at z ≈ -0.9)
  scene.add(mesh(new THREE.BoxGeometry(14, 2.6, 2.0), std(0x1c2456, 0.6), 0, -1.42, 0.1));
  scene.add(mesh(new THREE.BoxGeometry(14, 0.12, 2.1), phys(0xf0e9ec, 0.22, 0.6), 0, -0.06, 0.1));

  // back shelf with jars
  scene.add(mesh(new THREE.BoxGeometry(3.6, 0.1, 0.6), std(0x2a3570, 0.5), 2.2, 3.1, -2.8));
  var jarColors = [0xf49ab4, 0xf3d28b, 0xa7e3d6, 0xc9a6ff];
  for (var j = 0; j < jarColors.length; j++){
    scene.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 32),
      phys(jarColors[j], 0.1, 0.5, {transparent: true, opacity: 0.7}),
      0.8 + j * 0.9, 3.4, -2.8));
  }

  /* ---------- rolling trolley with baking trays (behind the counter) ---------- */
  var trolley = new THREE.Group();
  trolley.position.set(-2.0, 0, -1.8);
  scene.add(trolley);

  var chrome = std(0xc3c9d2, 0.3, {metalness: 0.9});
  var tray   = phys(0xd9dfe7, 0.3, 0.4, {metalness: 0.7});
  var trayRim= std(0x9aa3ae, 0.4, {metalness: 0.8});

  var TW = 1.5, TD = 0.95;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(c){
    trolley.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.6, 12), chrome, c[0] * TW / 2, 1.2, c[1] * TD / 2));
    // caster wheel
    var wheel = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 20), std(0x222222, 0.6), c[0] * TW / 2, -2.6, c[1] * TD / 2);
    wheel.rotation.z = Math.PI / 2;
    trolley.add(wheel);
  });

  var shelfYs = [0.25, 1.15, 2.05, 2.95];
  shelfYs.forEach(function(y, idx){
    // wire shelf
    trolley.add(mesh(new THREE.BoxGeometry(TW, 0.04, TD), chrome, 0, y, 0));
    // baking trays on each shelf, slightly offset so they look stacked, not identical
    var count = idx === 3 ? 1 : 2;
    for (var t = 0; t < count; t++){
      var tx = count === 1 ? 0 : (t === 0 ? -0.12 : 0.1);
      var tz = (idx % 2 ? 0.05 : -0.04) * (t ? -1 : 1);
      var trayMesh = mesh(new THREE.BoxGeometry(TW - 0.3, 0.035, TD - 0.22), tray, tx, y + 0.05, tz);
      trolley.add(trayMesh);
      // raised rim on the front edge of the tray
      trolley.add(mesh(new THREE.BoxGeometry(TW - 0.3, 0.07, 0.025), trayRim, tx, y + 0.08, tz + (TD - 0.22) / 2));
    }
  });

  // one tray leaning against the trolley side
  var leaning = mesh(new THREE.BoxGeometry(TW - 0.3, 0.035, TD - 0.22), tray, 0.9, 1.2, -0.6);
  leaning.rotation.set(0, 0, -0.9);
  trolley.add(leaning);

  /* ---------- lights ---------- */
  scene.add(new THREE.AmbientLight(0x2a3570, 0.7));

  var key = new THREE.DirectionalLight(0xffe0b5, 1.1);
  key.position.set(-3, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;   key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 1;  key.shadow.camera.far = 25;
  key.shadow.bias = -0.0008;
  key.target.position.set(0, 1, 0);
  scene.add(key); scene.add(key.target);

  var rim = new THREE.PointLight(0x8fa0ff, 1.2, 16, 2);
  rim.position.set(-5, 3, 2);
  scene.add(rim);

  var lampL = new THREE.PointLight(0xffd29a, 6, 14, 2); lampL.position.set(-0.3, 4.2, -0.1);
  var lampR = new THREE.PointLight(0xffd29a, 6, 14, 2); lampR.position.set(1.9, 4.2, -0.1);
  scene.add(lampL); scene.add(lampR);

  function pendant(x){
    var g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.9, 8), std(0x2c3670, 0.5), x, 5.85, -0.1));
    g.add(mesh(new THREE.ConeGeometry(0.5, 0.42, 40, 1, true), std(0x222b5e, 0.5, {side: THREE.DoubleSide}), x, 4.7, -0.1));
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 20),
      new THREE.MeshStandardMaterial({color: 0xfff1c9, emissive: 0xffd28a, emissiveIntensity: 1.6}));
    bulb.position.set(x, 4.4, -0.1);
    g.add(bulb);
    scene.add(g);
  }
  pendant(-0.3);
  pendant(1.9);

  /* ---------- bowl, cream and whisk ---------- */
  var bowlPos = new THREE.Vector3(-0.3, 0, -0.1);
  var bowlMat = phys(0xf3b9c6, 0.25, 0.8, {side: THREE.DoubleSide});
  var bowlProfile = [
    new THREE.Vector2(0.001, 0.02), new THREE.Vector2(0.4, 0.04),
    new THREE.Vector2(0.7, 0.3),    new THREE.Vector2(0.88, 0.7),
    new THREE.Vector2(0.94, 1.0)
  ];
  var bowl = sh(new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 64), bowlMat));
  bowl.position.copy(bowlPos);
  scene.add(bowl);

  var creamBase = new THREE.Mesh(new THREE.CircleGeometry(0.8, 48), std(0xfffaf5, 0.9));
  creamBase.rotation.x = -Math.PI / 2;
  creamBase.position.set(bowlPos.x, 0.78, bowlPos.z);
  scene.add(creamBase);

  var creamMat = phys(0xffffff, 0.6, 0.1);
  var peaks = [];
  for (var i = 0; i < 14; i++){
    var a = (i / 14) * Math.PI * 2;
    var r = 0.42 + (i % 2) * 0.16;
    var pk = sh(new THREE.Mesh(new THREE.SphereGeometry(0.13 + (i % 3) * 0.02, 20, 16), creamMat));
    pk.position.set(bowlPos.x + Math.cos(a) * r, 0.86, bowlPos.z + Math.sin(a) * r);
    pk.userData.phase = i * 0.7;
    scene.add(pk);
    peaks.push(pk);
  }

  // whisk: wire loops around a vertical axis, spinning in the cream
  var whisk = new THREE.Group();
  whisk.position.set(bowlPos.x, 0.95, bowlPos.z);
  scene.add(whisk);
  var wireMat = std(0xd6dce3, 0.2, {metalness: 0.9});
  for (var w = 0; w < 3; w++){
    var wireLoop = sh(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 8, 48), wireMat));
    wireLoop.scale.set(1, 1.7, 1);
    wireLoop.rotation.y = w * Math.PI / 3;
    whisk.add(wireLoop);
  }
  whisk.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 16), std(0xe8c9a0, 0.5), 0, 0.42, 0));

  /* ---------- cupcakes and sweets on the counter ---------- */
  var frostPts = [[0.001,0],[0.2,0],[0.27,0.1],[0.3,0.2],[0.26,0.3],[0.17,0.4],[0.01,0.46]]
    .map(function(p){ return new THREE.Vector2(p[0], p[1]); });

  function cupcake(x, z, liner, frost, cherry){
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.3, 40), std(liner, 0.7), 0, 0.15, 0));
    g.add(mesh(new THREE.LatheGeometry(frostPts, 48), phys(frost, 0.45, 0.3), 0, 0.28, 0));
    g.add(mesh(new THREE.SphereGeometry(0.06, 24, 20), phys(cherry, 0.2, 0.8), 0, 0.76, 0));
    scene.add(g);
  }
  cupcake(1.0, 0.5, 0xf49ab4, 0xfff4f8, 0xe0304e);
  cupcake(1.6, -0.1, 0xc9a6ff, 0xf4eaff, 0xf3d28b);
  cupcake(2.3, 0.5, 0xa7e3d6, 0xe6fff8, 0xe0304e);

  // sweets tray on the right
  scene.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 48), std(0xc9ced6, 0.3, {metalness: 0.8}), 3.2, 0.02, 0.2));
  var gold = phys(0xe8b76a, 0.3, 0.6);
  [[-0.25, 0.1], [0.05, 0.25], [0.25, 0.05]].forEach(function(p){
    scene.add(mesh(new THREE.SphereGeometry(0.1, 24, 20), gold, 3.2 + p[0], 0.12, 0.2 + p[1]));
  });
  scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 32), phys(0xa7e3d6, 0.3, 0.5), 3.4, 0.1, -0.2));
  scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 32), phys(0xf49ab4, 0.3, 0.5), 3.1, 0.1, -0.25));

  /* ---------- floating flour / sugar sparkles ---------- */
  var n = 90, pos = new Float32Array(n * 3);
  for (var k = 0; k < n; k++){
    pos[k * 3]     = -4 + Math.random() * 8;
    pos[k * 3 + 1] = 0.5 + Math.random() * 5;
    pos[k * 3 + 2] = -1 + Math.random() * 3;
  }
  var spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({
    color: 0xfff1c2, size: 0.07, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(sparks);

  /* ---------- camera, resize, animation ---------- */
  var mx = 0, camX = 0;
  function onMove(e){ mx = (e.clientX / window.innerWidth - 0.5) * 2; }
  window.addEventListener('pointermove', onMove);

  function resize(){
    var wd = window.innerWidth, ht = window.innerHeight;
    renderer.setSize(wd, ht, false);
    camera.aspect = wd / ht;
    camera.userData.dist = Math.max(10, 10.5 / camera.aspect);
    camera.updateProjectionMatrix();
    if (reduce) render(0);
  }
  window.addEventListener('resize', resize);

  function render(t){
    var s = t * 0.001;

    // whisk spins and wobbles in the cream
    whisk.rotation.y = s * 6;
    whisk.rotation.z = Math.sin(s * 3) * 0.12;

    // cream peaks pulse as they are whipped
    for (var p = 0; p < peaks.length; p++){
      var sc = 1 + 0.12 * Math.sin(s * 2 + peaks[p].userData.phase);
      peaks[p].scale.set(1, sc, 1);
    }

    // pendant lamps flicker
    lampL.intensity = 6 + Math.sin(s * 1.3) * 0.3;
    lampR.intensity = 6 + Math.sin(s * 1.1 + 1) * 0.3;

    // sparkles drift
    sparks.rotation.y = s * 0.03;

    // camera parallax
    camX += (mx * 0.35 - camX) * 0.04;
    var d = camera.userData.dist || 10;
    camera.position.set(TARGET.x + camX, 2.4, d);
    camera.lookAt(TARGET);

    renderer.render(scene, camera);
  }

  function loop(t){
    if(!root.host || !root.host.isConnected){
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      return;
    }
    render(t);
    requestAnimationFrame(loop);
  }

  resize();
  if (reduce) { render(0); }
  else { requestAnimationFrame(loop); }
}

function render(){
  U.remoteNote=0;
  if(typingBusy()&&document.querySelector('#app main, #app .sheet')){
    window.RENDER_PENDING=true;setTimeout(flushPendingRender,600);return;
  }
  if(U.view&&!routeAllowed(U.view))U.view='home';
  /* صفحة إعادة تعيين الـ PIN مفتوحة: مانعيدش رسمها في الخلفية (المزامنة وغيرها) عشان البيانات اللي اتكتبت ماتتمسحش */
  if(!authed()&&U.reset&&!U.resetDone&&document.getElementById('rCode'))return;
  if(!GD.on){linkGateRender();return;}
  if(GD.on&&!GD.seeded){var lh=document.getElementById('ldHost');if(lh){lh.innerHTML=loaderHTML(true);document.getElementById('app').innerHTML='';}else{document.getElementById('app').innerHTML=loaderHTML();}ldStart();return;}
  applyTheme();
  if(U.view!=='filling')U.fillTab=null;
  kickDeletedUser();
  kickStoppedUser();
  var hadSheet=!!document.querySelector('#app .sheet');
  if(bioLocked()){document.getElementById('app').innerHTML=loginHTML()+updOverlay();FX.after({key:'login',hadSheet:false});return;}
  if(!authed()&&!U.updChecked){U.updChecked=true;updCheck();}
  if(!authed()){document.getElementById('app').innerHTML=loginHTML()+updOverlay()+(bioSupported()&&!localStorage.getItem(BIO_KEY)?'<div style="text-align:center;margin-top:12px"><button class="btn ghost sm" data-act="bioEnableAct">فعّل فتح التطبيق بالبصمة على الجهاز ده</button></div>':'');FX.after({key:'login',hadSheet:false});return;}
  if(U.bioPrompt){document.getElementById('app').innerHTML=bioPromptHTML();return;}
  if(limited()){
    var lv=onLeaveToday();
    if(lv!==false){if(lv===true)ensureOpenSeen();document.getElementById('app').innerHTML=restHTML(lv!==true,lv===true);U.restShown=true;return;}
    var open=workOpenNow();if(open===true)markOpenSeen();if(open===false)ensureOpenSeen();
    if(open!==true){document.getElementById('app').innerHTML=restHTML(open===null);U.restShown=true;return;}
  }
  U.restShown=false;
  if(U.view==='verify'){var fa=document.getElementById('app');fa.classList.remove('has-bbar');if(!fa.querySelector('iframe[data-verify]'))fa.innerHTML=verifyView();return;}
  var app=document.getElementById('app');
  var scrollers=document.querySelectorAll('.sheet,.sbody,main.view');var scSaved=Array.prototype.map.call(scrollers,function(e){return e.scrollTop;});
  var sb=document.querySelector('.sbody'),sc=sb?sb.scrollTop:0;
  var tbEl=document.querySelector('[aria-label="أقسام الأصناف"]'),tsc=tbEl?tbEl.scrollLeft:0;
  if((U.view!=='settings'||limited())&&tabHidden(U.view))U.view='home';
  var v={home:function(){return '';},reserved:reservedView,calendar:calendarView,orders:function(){return ordersView('cust');},shopOrders:function(){return ordersView('shop');},shopProducts:shopProductsHTML,recipes:recipesView,settings:settingsGate,verify:verifyView,prep:prepView,prod:prodView,stock:stockView,fgstock:fgStockView,tracking:trackingView,filling:fillingView,prepreq:prepReqView,waste:wasteView,boxcomp:boxCompView}[U.view]();
  app.classList.add('has-bbar');
  app.innerHTML=alarmHTML()+notifBannerHTML()+topHTML()+'<div id="offBanner">'+offNote()+'</div>'+(U.view==='home'?homeHTML():backHTML()+viewNoteHTML())+(S.demo?demoHTML():'')+'<main class="view" style="--c:var(--'+(U.view==='shopOrders'?'orders':U.view==='shopProducts'?'recipes':U.view==='fgstock'||U.view==='tracking'?'stock':U.view)+')">'+v+'</main>'+footHTML()+sheetHTML()+ordSheetHTML()+formHTML()+rpSheetHTML()+syncScreenHTML()+lblSheetHTML()+(U.view==='calendar'?calDayHTML():'');
applyActGuards();
focusSearchKeep();
  var nb=document.querySelector('.sbody');if(nb)nb.scrollTop=sc;
  hdrGlass();
  Array.prototype.forEach.call(document.querySelectorAll('.sheet,.sbody,main.view'),function(e,i){if(scSaved[i]!==undefined)e.scrollTop=scSaved[i];});
  var nt=document.querySelector('[aria-label="أقسام الأصناف"]');if(nt)nt.scrollLeft=tsc;
  if(U.focus){var fe=document.querySelector(U.focus);if(fe)fe.focus();U.focus=null;}
  var r=document.getElementById('recvIn');if(r)r.focus();
  FX.after({key:U.view,hadSheet:hadSheet});
  if(ringing())startAlarmLoop();else stopAlarmLoop();
}

/* ---------- recipe stages ---------- */
function norm(x){return String(x).trim().toLowerCase();}
/* الخامة ممكن تتكرر بوحدات مختلفة: الاسم المكرر بيتعرض مع الوحدة (اسم · وحدة) */
function matLabel(m){return unesc(m.name)+' · '+(m.unit||'');}
function matDupNames(){var c={};MATERIALS.forEach(function(m){var k=norm(unesc(m.name));c[k]=(c[k]||0)+1;});return c;}
function matOptLabel(m,dups){return dups[norm(unesc(m.name))]>1?matLabel(m):unesc(m.name);}
function findMat(name){
  var n=norm(name);
  var hit=MATERIALS.filter(function(m){return norm(matLabel(m))===n;})[0];
  if(hit)return hit;
  return MATERIALS.filter(function(m){return norm(unesc(m.name))===n;})[0];
}
function stageIngText(g,qty){
  return (g.ings||[]).map(function(i){var m=M(i.m);return m?m.name+' '+f(r3((i.dq!=null?i.dq:i.q)*qty))+' '+(i.du||m.unit):'';}).filter(Boolean).join(' · ');
}
function stageItems(p,kind,qty){
  var out=[];
  (p.stages||[]).forEach(function(g,gi){
    if(g.kind!==kind)return;
    var st=(g.steps||[]).filter(Boolean);if(!st.length)st=[g.name];
    var sub=qty?stageIngText(g,qty):'';
    st.forEach(function(t){out.push({k:kind+gi,g:g.name,sub:sub,t:t});});
  });
  return out;
}
function prepItems(p,qty){
  var a=stageItems(p,'prep',qty);
  return a.length?a:[{k:'p-1',g:'',sub:'',t:'تجهيز المواد'}];
}
function syncProd(p){
  var rec={};
  (p.stages||[]).forEach(function(g){(g.ings||[]).forEach(function(i){if(!i.m&&i.mid)i.m=i.mid;rec[i.m]=r3((rec[i.m]||0)+i.q);});});
  p.recipe=rec;
  p.prep=prepItems(p,0).map(function(x){return x.t;});
}
function migrateProducts(list){
  list.forEach(function(p){
    if(!p.stages){
      p.stages=[{kind:'prep',name:'التحضير',ings:Object.keys(p.recipe||{}).map(function(k){return {m:k,q:p.recipe[k]};}),steps:(p.prep||[]).slice()}];
    }
    syncProd(p);
  });
}
function chipGroups(items,ck,act,id){
  var gs=[];
  items.forEach(function(x,i){
    var l=gs[gs.length-1];
    if(!l||l.k!==x.k){l={k:x.k,g:x.g,sub:x.sub,it:[]};gs.push(l);}
    l.it.push({t:x.t,i:i});
  });
  return gs.map(function(gp){
    return (gp.g?'<div class="sgh">'+gp.g+'</div>':'')+(gp.sub?'<div class="meta">'+gp.sub+'</div>':'')+
      '<div class="chk">'+gp.it.map(function(c){
        return '<button class="chip'+(ck.indexOf(c.i)>-1?' on':'')+'" data-act="'+act+'" data-id="'+id+'" data-i="'+c.i+'"><i>'+svg('check')+'</i>'+esc(c.t)+'</button>';
      }).join('')+'</div>';
  }).join('');
}
function prepGroupsHTML(b){return chipGroups(prepItems(P(b.p),b.qty),b.checks||[],'toggleCheck',b.id);}
function stagesText(p,kind,qty){
  return (p.stages||[]).filter(function(g){return g.kind===kind;}).map(function(g,i){
    var ing=stageIngText(g,qty),st=(g.steps||[]).map(function(t,j){return (j+1)+'. '+t;}).join('<br>');
    return '<div class="sgb" style="margin-top:6px"><div class="sgh">'+(/^مرحلة \d+$/.test(unesc(g.name))?g.name:(i+1)+') '+g.name)+'</div>'+(ing?'<div class="meta">'+ing+'</div>':'')+(st?'<div class="meta">'+st+'</div>':'')+'</div>';
  }).join('');
}

/* ---------- printing ---------- */
/* التحضيرات (أصناف التحضير أو اللي متعلّمة مخفية من الأوردرات) مش بتظهر في الفواتير والتقارير */
function invoiceHidden(p){return !!p&&(!!p.noOrder||/^\s*تحضير/.test(unesc(p.name||'')));}
/* إجمالي الأوردر: كل الأصناف المتشابهة (من كل التعبئات) في سطر واحد */
function orderTotalsRows(o){
  var g={},ord=[];
  (o.items||[]).forEach(function(it){
    var k=it.p;
    if(!g[k]){var p=P(it.p)||{name:'صنف محذوف',unit:''};g[k]={name:unesc(p.name),unit:p.unit||'',q:0};ord.push(k);}
    g[k].q=r3(g[k].q+(Number(it.qty)||0));
  });
  return ord.map(function(k){return '<tr><td>'+esc(g[k].name)+'</td><td class="n">'+f(g[k].q)+' '+esc(g[k].unit)+'</td></tr>';}).join('');
}
function printOrderHTML(o){
  var h='<h1>طلبية '+o.id+'</h1><div class="pm">'+(o.cust?o.cust+' · ':'')+tstr(o.created)+(o.due?' · معاد التسليم: '+dueStr(o.due):'')+'</div>'+(o.note?'<div class="pm"><b>ملاحظة:</b> '+o.note+'</div>':'');
  h+='<h2>إجمالي الأوردر</h2><table class="pt"><thead><tr><th>الصنف</th><th>إجمالي الكمية</th></tr></thead><tbody>'+orderTotalsRows(o)+'</tbody></table>';
  h+='<h2>التعبئات</h2><table class="pt"><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th></tr></thead><tbody>'+itemRowsHTML(o,true)+'</tbody></table>';
  return h;
}
function printReport(title,html){
  var w=window.open('','_blank');
  if(!w){toast('المتصفح منع فتح نافذة الطباعة');return;}
  w.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>'+title+'</title><style>@page{size:A4;margin:12mm}body{font-family:Tahoma,Arial,sans-serif;font-size:12.5px;color:#000;background:#fff;margin:0;line-height:1.6}h1{font-size:22px;margin:0 0 2px}h2{font-size:16px;margin:16px 0 6px;border-bottom:2px solid #000;padding-bottom:3px}.pm{color:#444;margin-bottom:8px}table{width:100%;border-collapse:collapse;margin:4px 0}th,td{border:1px solid #888;padding:4px 8px;text-align:start}th{background:#eee}td.n{font-weight:700;white-space:nowrap;width:1%}.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}</style></head><body>'+html+'</body></html>');
  w.document.close();
  setTimeout(function(){try{w.focus();w.print();}catch(e){}},400);
}
/* الطباعة في إطار مخفي بنفس تنسيق الصفحة، عشان التصدير ميطلعش فاضي */
function doPrint(html){
  var f=document.createElement('iframe');
  f.setAttribute('aria-hidden','true');
  f.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
  document.body.appendChild(f);
  var css='';Array.prototype.forEach.call(document.styleSheets,function(s){try{Array.prototype.forEach.call(s.cssRules,function(r){css+=r.cssText+'\n';});}catch(e){}});
  var d=f.contentWindow.document;
  d.open();
  d.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>'+css+
    '\nhtml,body{height:auto!important;overflow:visible!important;background:#fff!important;color:#000!important}'+
    '#printArea{display:flex!important;flex-direction:column;justify-content:center;min-height:262mm}'+
    '@page{size:A4;margin:10mm}'+
    '#printArea{font-size:14px;line-height:1.45;min-height:262mm;display:flex;flex-direction:column;justify-content:center}'+
    '#printArea>*{width:100%}'+
    '#printArea h1{font-size:20px;margin:0 0 4px}'+
    '#printArea h2{font-size:15px;margin:14px 0 6px;break-after:avoid;page-break-after:avoid}'+
    '#printArea h3{font-size:11.5px;margin:6px 0 3px;break-after:avoid;page-break-after:avoid}'+
    '#printArea .pm{font-size:10.5px;margin-bottom:4px}'+
    '#printArea table.pt{font-size:14px;width:100%;border-collapse:collapse;margin:6px 0 16px;page-break-inside:auto}'+
    '#printArea .pt th,#printArea .pt td{padding:7px 9px;border:1px solid #999;line-height:1.35}'+
    '#printArea .pt thead{display:table-header-group}'+
    '#printArea table.mt{table-layout:fixed}'+
    '#printArea table.pt{width:72%!important;font-size:13px;margin:6px auto 16px!important}'+
    '#printArea table.pt:not(.mt) td:not(:first-child){white-space:nowrap}'+
    '#printArea .ck{text-align:center;width:10%}'+
    '#printArea .n{text-align:center}'+
    '#printArea .pt tr,#printArea .pg{break-inside:avoid;page-break-inside:avoid}'+
    '</style></head><body><div id="printArea" dir="rtl" lang="ar">'+html+'</div></body></html>');
  d.close();
  setTimeout(function(){
    try{f.contentWindow.focus();f.contentWindow.print();}catch(e){toast('الطباعة مش متاحة هنا، افتح الصفحة من المتصفح');}
    setTimeout(function(){f.remove();},3000);
  },500);
}
window.addEventListener('afterprint',function(){var pa=document.getElementById('printArea');if(pa)pa.innerHTML='';});

/* ---------- alarm: loud sound + vibration until stopped ---------- */
var AC=null,alarmTimer=null,WL=null;
function unlockAudio(){
  try{
    if(!AC){var C=window.AudioContext||window.webkitAudioContext;if(C)AC=new C();}
    if(AC&&AC.state==='suspended')AC.resume();
  }catch(e){}
}
document.addEventListener('pointerdown',unlockAudio,{passive:true});
function beep(){
  if(!AC)return;
  try{
    if(AC.state==='suspended')AC.resume();
    var t=AC.currentTime;
    [[0,880],[.3,1175],[.6,880]].forEach(function(x){
      var o=AC.createOscillator(),g=AC.createGain();
      o.type='square';o.frequency.value=x[1];
      g.gain.setValueAtTime(.0001,t+x[0]);
      g.gain.exponentialRampToValueAtTime(1,t+x[0]+.02);
      g.gain.exponentialRampToValueAtTime(.0001,t+x[0]+.26);
      o.connect(g);g.connect(AC.destination);o.start(t+x[0]);o.stop(t+x[0]+.28);
    });
  }catch(e){}
}
/* المتصفح بيمنع الاهتزاز قبل أي لمسة من المستخدم، فبنتجاهله لحد ما يحصل تفاعل */
function canVibrate(){return !!(navigator.vibrate&&navigator.userActivation&&navigator.userActivation.hasBeenActive);}
function buzz(){try{if(canVibrate())navigator.vibrate([500,150,500,150,500]);}catch(e){}}
function ringing(){return S.batches.some(function(b){return b.ringing;});}
function alarmTick(){if(!ringing()){stopAlarmLoop();return;}beep();buzz();}
function startAlarmLoop(){if(alarmTimer)return;alarmTick();alarmTimer=Date.now();}
function alarmDue(){if(alarmTimer&&Date.now()-alarmTimer>=1800){alarmTimer=Date.now();alarmTick();}}
function stopAlarmLoop(){
  var wasOn=!!alarmTimer;
  alarmTimer=null;
  /* بنوقف الاهتزاز بس لو كان شغال فعلاً، عشان الدالة دي بتتنادى مع كل رسم للشاشة */
  try{if(wasOn&&canVibrate())navigator.vibrate(0);}catch(e){}
  try{if(AC&&AC.state==='running')AC.suspend();}catch(e){}
}
function wakeSync(){
  var need=ringing()||S.batches.some(function(b){return b.stage==='prod'&&b.startedAt&&!b.notified;});
  try{
    if(need&&!WL&&navigator.wakeLock&&!document.hidden){
      navigator.wakeLock.request('screen').then(function(l){WL=l;l.addEventListener('release',function(){WL=null;});}).catch(function(){});
    }else if(!need&&WL){WL.release();WL=null;}
  }catch(e){}
}
/* system notification: loud + vibrating, shown even when the screen is off or the app is in the background */
var NOTIF_VIB=[800,200,800,200,800,200,800,200,800];

/* small white status-bar icon (Android shows only its shape, in white) */
var NOTIF_BADGE='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAABmJLR0QA/wD/AP+gvaeTAAAHhUlEQVR4nO2ca6weRRnH/08v0EJRikWLtRYhWoRIbbkERGyLNkSj0SgWxIYP3lHxEiIqiRf8oBQSozFRP9Qopl5iMRgbFUmNaAsIJdAiRU+hYKFKpQcpvUhte87PD2deMw6zu/PuOefd92zn9+V9d/d5nt19/juzszOzK2UymUwmk8lkMplMJpPJZDKZTCaTyWQymUwmBnB008dwxAFMB94H3MsIm4AVwJSmj63VAKcANwJPE+cx4OPAsU0fa2sADFgGrAWGChIfsh/4AXBa08c/YQGOAT4CPJSY9BhDwBrgnKbPZ8IAzAS+CAyOIvEx7gYuB6Y2fY59CXA28A1gT0kS9wPfBhYDnwN21hBiB3AtMKvpc24c4HjgamAgMXkXBf6nAttqiADwHPB94KzmMtAQwBnAd4B9FVfq94CbPbuHgXODWNOAdwG3AIdrinEHcFmrqydgEvB2YB0wXJGQH/pteuA8YJfbdhi4x1VXC4J9nAJ8E9hbU4gdwDXAixpJ0ngATAGuAh7tIhHXReLMAD4IbA5s7wQuBSZ5tscDn3UJrcNzwI+ApYD1PGljibt6N9ZIwirgTcDLgngGvA24K7DfEhFiqntCvq+mEAC/ayRxYw1wEXBrQvUT4yHgSmBGEPM1wFeArWVCONulwPoa+97W82SNJ8ACYDVwqEYyngFWAnOCmAa8NUjwgKv6XhDYvgW4rYun6p09T1IvAOa5G2ZZS6iIg8BNwBmRuBcCv/BaRHuAb4XdEsD5iRfBMz1NTK8BTgC+APyzhhDDwC+BCyJx57q4D3i2vwVO9myuT9jHv3qelCZwXcxXAo/UEAJgA/DOWJe0az0ddHabgWPc+hMT4j7dSEKaApgMLK/ZcsI1Pa8D5gZxl7h7CMB8t252QrzBxpLRNKNsOR0GbgiapTcGAsxLiLOr0ST0A6NsOV3hxVkWCDA/wf+p8T6/SQk2jWJmm81shaTFkrqtkz/m/X8i2DZtDA5v1PS9AB3M7E5JF0j6WxduZwHT3f8dwbYUAehiX7XoqQDAOcDFwFF1/M1sQNJ7JQ0nukyWdLrz3SfJb9enzKholwCSzpd0q6THgS8DM7sN4ErCT7pwea333y8FsRKwW9IWb7l1Akx2vy+R9CVJ290T8dwKv5Dru0hOkQCxErBO0q+85dYK0OE4SZ+QtA34GbA4JYiZPehKUgqLvP/+jThWAu6QtNdbbr0AHaZKerek213b/4UJsdYk7nMB0NnvJm/99IjtE5IOecutEyBl9trFkn6TMMFqraShhHjHSnql+3+3tz5WBT2ZEG9M6UcB5G7WHy0zMLPBSNOyiE419GdJ/3b/Z0TsQgFaVwKKqqAYH0gYEnwsMdZCjYh2yMw694HZgc2+yMPaES3AqyS9vMJme7C8U1Ks/2ZhZF0owEYzOxysa50Af/GqgBSqji/smlgn6YaI3cJIaQoFuCvi1y4BzGy1pFdI+pqkZyvMhyUdqLDZEywPSbo9YneCpJODdScFy/dF/NolgEZEeMrMrnVX4HJ31cZOdJWZVbVKdgfLw5LujwgjSeEsuLAEhNWZeiFAYy81mNkB15Zf47qIXyfpTEmzJK2X9NOEMGF1NmxmQ8AmSW8Iti2SdLPclBW3H5+YAONOX7xV4jrZBmq4nhssdzrpHigQoMMsSf49Yb+k2OhX+6qgMWZOsNx5MLs/Yuu3hE4Mtj1qZrFkZwGKcE/KFwarOwJsiLi82Ov0CwUomoCVBSjhssjTLBqp0ra6Z4KQTikI6/8tEVu1TgDgw25m2vtHMx0ceKnrkg7xB2r+GNneuQ+EnX0bi3ZV8xCT6XUJOErSMkmrJG0C3txtADeIszZyFSvonFsX2d4ZGwg74o4YAfxW1+mSfp06BqCR5L/RPbEuKjDxS8Btke0dP1+AJ83sH0W7TD22uvRagNj+3lPmABwHfBX4vbuq55eY/08AM9seubnOBWYHAjySfPTjQD8IsLxikP4/kq6WtCQhfjhYvz5ic3ZwDygToHUlINYbOtMNwkQxs4OSNifGDwdoYjfiSyVd4i0XtYDURgGK9nd5hd9NifHDEhATYIXrEOzwYEm81glQNB7wjoopKqtdd0EV/1cCzGybpMcrfI4oAYr2N62sFJjZs4mdc7GE/aHEfreZ/b3LeGNKvwggSR+q8P1uQvzYIH3Z9JWtFfFaJ0DZkOSZ4YvYPmZ2bzCtJEZsyuLakoGdRpug6rMSIEmfqthedTN+ngBmtlfSPQX2DxesH5S0MmgtTXzcZwXKvoRyyPXzFPnPAg6U+F9T4LeywH5FxHYe0LOp670eE/65G5v9TMGcnilumLLIf1DSLSW7KJqo9aeC9c8rAWa23Y3WtRv3/YjXu8m5u7yrsihZHb8lJSXg0wU+J0VeddqQOAWy/QBHA1cAf3XJObXE1ko+cfPJEr8fuw95fB149bidzETGvSV5CbC0wu7zBQJcVeIzO3+oaYwA5njv/vqUziftRybkkKR7eo29JZP66lJmtACneR/dGHAf+wsnW2XGEzfGfF7Tx5HJZDKZTCaTyWQymUwmk8lkMplMJpPpY/4L7N81fKe/2TkAAAAASUVORK5CYII=';
function showSysNotif(title,body,tag,trigger,view){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  var opt={body:body,tag:tag,renotify:true,requireInteraction:true,vibrate:NOTIF_VIB,silent:false,icon:(document.querySelector('link[rel="apple-touch-icon"]')||{}).href||undefined,badge:NOTIF_BADGE,data:{view:view||'home'},lang:'ar',dir:'rtl'};
  if(trigger&&window.TimestampTrigger)opt.showTrigger=new TimestampTrigger(trigger);
  var fallback=function(){if(trigger)return;try{var n=new Notification(title,opt);n.onclick=function(){try{window.focus();}catch(e){}openView(view||'home');n.close();};}catch(e){}};
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration){
      navigator.serviceWorker.getRegistration().then(function(reg){
        if(reg&&reg.showNotification)reg.showNotification(title,opt).catch(fallback);else fallback();
      }).catch(fallback);
    }else fallback();
  }catch(e){fallback();}
}
function openView(v){
  if(!v)return;
  if(U.view==='settings'&&v!=='settings')lockSettings();
  U.view=v;try{location.hash=v;}catch(e){}
  if(authed()){render();window.scrollTo(0,0);}
}
/* tapping a notification: the service worker focuses the app and sends the section to open */
try{if(navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',function(e){var d=e.data||{};if(d.type==='open-view')openView(d.view);});}catch(e){}
function notifyNew(title,body,tag,view){showSysNotif(title,body,tag,null,view);}
/* records that exist in the merged state but not in the local one = created on another synced device */
function newRemote(a,b){
  var out=[];
  ['orders','batches'].forEach(function(c){
    var have={};(a[c]||[]).forEach(function(r){if(r&&r.id!=null)have[String(r.id)]=1;});
    (b[c]||[]).forEach(function(r){
      if(r&&r.id!=null&&!have[String(r.id)]&&!(b.tomb&&b.tomb[c]&&b.tomb[c][r.id]))out.push({c:c,r:r});
    });
  });
  return out;
}
function notifyRemote(list){
  if(!list.length)return;
  if(list.length>3){
    var no=list.filter(function(x){return x.c==='orders';}).length,nb=list.length-no;
    var parts=[];if(no)parts.push(no+' أوردر');if(nb)parts.push(nb+' دفعة');
    showSysNotif('وصل من جهاز تاني',parts.join(' و ')+' جداد','rnew-'+Date.now(),null,no?'orders':'prep');
    return;
  }
  list.forEach(function(x){
    if(x.c==='orders'){
      var o=x.r;
      showSysNotif('أوردر جديد من جهاز تاني',(unesc(o.cust||'')||'بدون اسم')+' · '+o.id+(o.due?' · ميعاد: '+o.due:''),'rorder-'+o.id,null,'orders');
    }else{
      var b=x.r,p=P(b.p);
      showSysNotif('دفعة جديدة من جهاز تاني',(p?p.name:'')+' × '+(b.qty||'')+' · '+sid(b.id),'rbatch-'+b.id,null,'prep');
    }
  });
}
function notifyDone(b){var p=P(b.p);showSysNotif('خلص الوقت',(p?p.name:'')+' · '+sid(b.id),'done-'+b.id,null,'prod');}
/* pre-schedule at start time too: browsers that support notification triggers fire it even if the page is closed */
function scheduleNotif(b){
  if(!('Notification' in window)||Notification.permission!=='granted'||!window.TimestampTrigger)return;
  var p=P(b.p);showSysNotif('خلص الوقت',(p?p.name:'')+' · '+sid(b.id),'done-'+b.id,b.startedAt+dur(b),'prod');
}
function notifBannerHTML(){
  if(!('Notification' in window)||Notification.permission!=='default'||U.notifLater)return '';
  return '<div class="demo"><span>فعّل الإشعارات عشان يوصلك تنبيه الدفعة حتى لو الشاشة مقفولة.</span><span style="display:flex;gap:6px"><button class="btn ghost sm" data-act="notifLater">لاحقاً</button><button class="btn sm" data-act="notifAsk">سماح</button></span></div>';
}
function alarmHTML(){
  var rs=S.batches.filter(function(b){return b.ringing;});
  if(!rs.length)return '';
  return '<div class="alarm" role="alert"><div><b>خلص الوقت</b><div>'+rs.map(function(b){var p=P(b.p);return esc(p?p.name:'')+' · '+sid(b.id);}).join(' | ')+'</div></div><button data-act="stopAlarm">إيقاف</button></div>';
}

/* ---------- orders ---------- */
function orderBatches(o){return S.batches.filter(function(b){return b.o===o.id;});}
function orderNeed(items){
  var o={};
  items.forEach(function(it){var p=P(it.p);if(!p)return;for(var k in p.recipe)o[k]=r3((o[k]||0)+p.recipe[k]*it.qty/yieldOf(it.p));});
  return o;
}
/* نجمع الأصناف المتكررة في الأوردر (مثلاً لو الأوردر فيه علبتين بنفس الأصناف) في سطر واحد لكل صنف */
function aggItems(o){
  var m={},out=[];
  (o.items||[]).forEach(function(it){
    if(!m[it.p]){m[it.p]={p:it.p,qty:0};out.push(m[it.p]);}
    m[it.p].qty=r3(m[it.p].qty+(Number(it.qty)||0));
  });
  return out;
}
function itemsText(o){
  return aggItems(o).map(function(it){var p=P(it.p);return p?p.name+' ×'+f(it.qty):'';}).filter(Boolean).join(' · ');
}
/* عرض الأصناف كقايمة واضحة: اسم الصنف على اليمين والكمية على الشمال */
function itemsListHTML(o){
  var rows=aggItems(o).map(function(it){var p=P(it.p);if(!p)return '';
    return '<div class="oil-r"><span>'+esc(p.name)+'</span><b>'+pieceQ(it.qty,p)+'</b></div>';}).join('');
  return '<style>.oil-r{display:flex;justify-content:space-between;gap:10px;padding:5px 10px;border-radius:10px;background:var(--surface,#f6f7fb);border:1px solid var(--line,#e4e6f2);margin-top:4px}.oil-r b{white-space:nowrap}</style><div style="display:grid;gap:2px;margin:6px 0">'+rows+'</div>';
}
function batchQ(b,p){
  if(!b.o)return mealQ(b.qty,p);
  var o=S.orders.filter(function(x){return x.id===b.o;})[0];
  var it=o&&(o.items||[]).filter(function(i){return i.p===b.p;})[0];
  if(!it)return mealQ(b.qty,p);
  var have=(it.fs||0)+(it.got||0),others=0;
  orderBatches(o).forEach(function(x){if(x!==b&&x.p===b.p)others+=pc(x);});
  var left=Math.max(0,r3(it.qty-have-others));
  return 'العجز '+f(Math.min(left,pc(b)))+' '+p.unit;
}
function otag(b){
  var o=S.orders.filter(function(x){return x.id===b.o;})[0];
  return '<span class="pill otag" style="--p:var(--orders)">طلبية '+b.o+(o&&o.cust?' · '+o.cust:'')+'</span>';
}
function matRows(tot,rem){
  var track=TRACK();
  return Object.keys(tot).map(function(k){
    var m=M(k);if(!m)return '';
    var st='',small='';
    if(track){
      var have=S.stock[k]||0,r=rem?(rem[k]||0):tot[k];
      small='<small>المتاح '+f(have)+' '+esc(m.unit)+'</small>';
      if(rem&&!(r>0))st='<span class="pill ok">'+svg('check','mi')+' مسحوب</span>';
      else if(have+1e-9<r)st='<span class="pill bad">ينقص '+f(r-have)+'</span>';
      else st='<span class="pill ok">متوفر</span>';
    }
    return '<div class="rq"'+(track?'':' style="grid-template-columns:minmax(0,1fr) auto"')+'><div><b>'+esc(m.name)+'</b>'+small+'</div><span class="qv">'+f(tot[k])+' '+esc(m.unit)+'</span>'+st+'</div>';
  }).join('');
}
function orderCard(o){
  var bs=orderBatches(o),open=U.oexp===o.id,rows=ordShort(o),total=rows.length;
  var doneN=rows.filter(function(x){return x.have>=x.qty;}).length;
  var cnt={prep:0,prod:0};bs.forEach(function(b){cnt[b.stage]++;});
  var tot=orderNeed(ordRemain(o));
  var rem=orderNeed(rows.filter(function(x){return x.short+x.unw>0;}).map(function(x){return {p:x.p,qty:x.short+x.unw};}));
  var lack=TRACK()?Object.keys(rem).filter(function(k){return (S.stock[k]||0)+1e-9<rem[k];}).length:0;
  var nShort=rows.filter(function(x){return x.short>0;}).length;
  var hd='<div class="bh"><div><span class="bid ltr">'+sid(o.id)+'</span><h3 class="bn">'+custName(o)+'</h3></div><span class="pill c">'+ago(o.created)+'</span></div>';
  var detail='<div>'+itemsListHTML(o)+'<div class="meta">'+tstr(o.created)+(o.due?' · معاد التسليم <b>'+dueStr(o.due)+'</b>':'')+'</div>'+(o.note?'<div class="meta" style="color:var(--ink)">ملاحظة: '+o.note+'</div>':'')+'</div>'+
    '<div class="prog"><span>خلص '+doneN+'/'+total+'</span><div class="bar"><i style="width:'+(total?doneN/total*100:0)+'%"></i></div></div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="pill">تحضير '+cnt.prep+'</span><span class="pill">إنتاج '+cnt.prod+'</span>'+
    (nShort?'<span class="pill bad">ناقص '+nShort+(nShort>1?' أصناف':' صنف')+'</span>':'')+
    (lack?'<span class="pill bad">خامات ناقصة '+lack+'</span>':'')+'</div>'+
    '<div class="btns"><button class="btn ghost sm" data-act="printOrder" data-id="'+o.id+'">طباعة الطلبية</button></div>';
  var body='';
  if(open){
    var agg={},aord=[];
    rows.forEach(function(x){
      if(!agg[x.p]){agg[x.p]={p:x.p,qty:0,fs:0,have:0,short:0,unw:0,pend:false};aord.push(x.p);}
      var a=agg[x.p];a.qty+=x.qty;a.fs+=x.fs||0;a.have+=x.have;a.short+=x.short;a.unw+=(x.unw||0);a.pend=a.pend||!!x.pend;
    });
    var prep=aord.map(function(k){
      var x=agg[k];var p=P(x.p);if(!p)return '';
      var st,left=x.qty-x.have,from=x.fs>0?'من المخزن '+f(x.fs)+' · ':'';
      if(left<=0) st=from+'خلص';
      else if(x.pend){
        var b=bs.filter(function(y){return y.p===x.p;})[0];
        st=from+(b.stage!=='prep'?'عدّى التحضير':(b.withdrawn?'قيد التجهيز '+(b.checks||[]).length+'/'+p.prep.length:'بانتظار سحب المواد'));
        if(x.short>0)st+=' · ناقص '+f(x.short)+' (في النواقص)';
      } else st=from+'ناقص '+f(x.short)+' · محتاج دفعة من النواقص';
      return '<div class="mrow"><div class="mtop"><div><b>'+esc(p.name)+'</b><small>'+st+'</small></div><div class="mq"><b>'+f(x.qty)+'</b> <span>'+esc(p.unit)+'</span></div></div>'+(left>0?stagesText(p,'prep',r3(left/yieldOf(p.id))):'')+'</div>';
    }).join('');
    body='<div class="grp">التحضير المطلوب</div><div>'+prep+'</div>'+
      '<div class="grp">الخامات المطلوبة للطلبية</div><div>'+matRows(tot,rem)+'</div>'+
            '<div class="foot"><button class="btn ghost sm" data-act="tab" data-v="fgstock">مخزن الإنتاج والنواقص</button><button class="btn quiet" data-act="oCancel" data-id="'+o.id+'">'+(U.confirm==='o'+o.id?'اضغط تاني للتأكيد':'إلغاء الطلبية')+'</button></div>';
  }
  return '<article class="card" style="--c:var(--orders)">'+hd+(open?detail+body:'')+'<button class="btn ghost sm block" data-act="oToggle" data-id="'+o.id+'" aria-expanded="'+(open?'true':'false')+'">'+(open?'إخفاء التفاصيل':'عرض التفاصيل')+'</button><button class="btn ghost sm block" data-act="oEdit" data-id="'+o.id+'">تعديل الطلبية</button></article>';
}
function dueStr(s){return fmt12str(String(s||'').replace('T',' '));}
function okind(o){return o.kind||'cust';}
function custName(o){return o.cust||'أوردر بدون اسم';}

function lockKey(kind,k){return kind+'|'+k;}
function todayKey(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
/* أوردر تاريخ تسليمه بعد يوم القفل بيفضل زي ما هو */
function closeKeep(o){return !!(o.due&&String(o.due).slice(0,10)>todayKey());}
function isLocked(o){
  if(o.keepAfterLock)return false;
  var k=monthKey(o.created),t=S.locks&&S.locks[lockKey(okind(o),k)];
  if(!t)return false;
  if(typeof t==='number')return (o.created||0)<=t;
  /* قفل قديم (بدون وقت): نعتمد على وقت آخر أرشيف للشهر */
  var at=0;archEntries(k).forEach(function(a){if((a.at||0)>at)at=a.at||0;});
  return at?(o.created||0)<=at:true;
}
function isFill(p){return !!(p&&p.fill);}
function prodsOf(kind){return PRODUCTS.filter(function(p){return !isFill(p)&&!p.archived&&(kind==='shop'?!!p.shop:!p.shop)&&(!limited()||!p.ownerOnly);});}
function ordProdsOf(kind){return PRODUCTS.filter(function(p){return isFill(p)&&!p.archived&&p.fill===kind;});}
function ordersOf(kind){return S.orders.filter(function(o){return okind(o)===kind&&(o.season||'normal')===ordSeason();});}
function openCount(kind){return ordersOf(kind).filter(function(o){return !o.deliveredAt;}).length;}
function grpTitle(t,n){return '<div class="grp">'+t+' ('+n+')</div>';}
function mealQ(qty,p){return f(qty)+' وجبة'+(p&&(p.yield!==1||!isPiece(p))?' · '+f(r3(qty*p.yield))+' '+p.unit:'');}
/* الناتج المتوقع للدفعة حسب عدد الوجبات */
function batchOutTxt(x,q){
  var out=r3((Number(q)||0)*yieldOf(x.id));
  return 'بتطلع '+f(out)+' '+esc(x.unit||'قطعة');
}
/* بطاقة الصنف في الدفعة: لو متختار بتعرض الكمية جوه نفس المربع */
function pkTileHTML(x,s){
  /* العين للمالك بس: الصنف المقفول بيختفي عن المستخدمين */
  var eye=limited()?'':fgEyeHTML(x),hid=!limited()&&fgHiddenIds().indexOf(x.id)>-1,cl=hid?' hid':'';
  if(s.sel.indexOf(x.id)<0)return '<div class="pk'+cl+'" role="button" tabindex="0" data-act="sheetProd" data-p="'+x.id+'">'+eye+esc(x.name)+'<small>'+(hasOven(x)?x.mins+' دقيقة تشغيل':'بدون فرن')+'</small></div>';
  var q=s.q[x.id]||1;
  return '<div class="pk on'+cl+'" style="cursor:default">'+eye+
    '<div class="opk-h"><b>'+esc(x.name)+'</b><button class="ox" data-act="sheetProd" data-p="'+x.id+'" aria-label="شيل الصنف">×</button></div>'+
    '<small>'+(hasOven(x)?x.mins+' دقيقة تشغيل':'بدون فرن')+'</small>'+
    '<small class="pkout" data-out="'+x.id+'" style="color:var(--ink);font-weight:600">'+batchOutTxt(x,q)+'</small>'+
    '<div class="opk-q"><button data-act="sheetQty" data-p="'+x.id+'" data-d="-1"'+(q<=0.25?' disabled':'')+' aria-label="أنقص">−</button>'+
    '<input type="text" inputmode="decimal" data-sq="'+x.id+'" value="'+q+'" aria-label="الكمية">'+
    '<button data-act="sheetQty" data-p="'+x.id+'" data-d="1" aria-label="زوّد">+</button></div></div>';
}
function batchMatsHTML(list){
  var byP={},order=[];
  list.forEach(function(b){
    if(!byP[b.p]){byP[b.p]={p:b.p,meals:0,pcs:0,mats:{},batches:[]};order.push(b.p);}
    var g=byP[b.p];g.meals=r3(g.meals+b.qty);g.pcs=r3(g.pcs+pc(b));g.batches.push(b);
    var t=need(b);for(var k in t)g.mats[k]=r3((g.mats[k]||0)+t[k]);
  });
  var tot={};
  order.forEach(function(pid){var g=byP[pid];for(var k in g.mats)tot[k]=r3((tot[k]||0)+g.mats[k]);});
  function matTable(mats){
    var rows=Object.keys(mats).map(function(k){var m=M(k);return m?'<tr><td class="ck">☐</td><td>'+esc(m.name)+'</td><td class="n">'+f(mats[k])+' '+esc(m.unit)+'</td></tr>':'';}).join('');
    return '<table class="pt mt"><colgroup><col style="width:10%"><col style="width:58%"><col style="width:32%"></colgroup><thead><tr><th class="ck">✓</th><th>الخامة</th><th class="n">الكمية</th></tr></thead><tbody>'+(rows||'<tr><td colspan="3">مفيش خامات</td></tr>')+'</tbody></table>';
  }
  var perProduct=order.map(function(pid){
    var g=byP[pid],p=P(pid);
    return '<div class="pg"><h2>'+(p?p.name:'صنف محذوف')+' · '+mealQ(g.meals,p)+' · '+g.batches.length+' دفعة</h2>'+matTable(g.mats)+'</div>';
  }).join('');
  var bs=list.map(function(b){var p=P(b.p);return '<tr><td>'+sid(b.id)+'</td><td>'+(p?p.name:'')+'</td><td class="n">'+mealQ(b.qty,p)+'</td></tr>';}).join('');
  return '<h1>الخامات المطلوبة للدفعات</h1><div class="pm">دفعات بانتظار السحب · '+list.length+' دفعة · طُبع '+tstr(Date.now())+'</div>'+
    perProduct+
    '<h2>الإجمالي</h2>'+matTable(tot)+
    '<h2>الدفعات</h2><table class="pt"><thead><tr><th>الرقم</th><th>المنتج</th><th>الكمية</th></tr></thead><tbody>'+bs+'</tbody></table>';
}
function printAllHTML(list){
  var sorted=list.slice().sort(function(a,b){return String(a.due||'9999').localeCompare(String(b.due||'9999'))||a.created-b.created;});
  var h='<h1>الأوردرات المطلوبة</h1><div class="pm">عدد الأوردرات: '+sorted.length+' · طُبع '+tstr(Date.now())+'</div>';
  sorted.forEach(function(o){
    h+='<div class="pg"><h2>'+custName(o)+' — '+sid(o.id)+'</h2><div class="pm">تسجيل: '+tstr(o.created)+(o.due?' · معاد التسليم: '+dueStr(o.due):'')+'</div>'+
      '<table class="pt"><thead><tr><th>الصنف</th><th>الكمية</th></tr></thead><tbody>'+itemRowsHTML(o,false)+'</tbody></table></div>';
  });
  var prodTot={};
  sorted.forEach(function(o){o.items.forEach(function(it){if(invoiceHidden(P(it.p)))return;prodTot[it.p]=(prodTot[it.p]||0)+it.qty;});});
  h+='<h2>إجمالي الأصناف</h2><table class="pt"><tbody>'+Object.keys(prodTot).map(function(k){var p=P(k);return p?'<tr><td>'+esc(p.name)+'</td><td class="n">'+pieceQ(prodTot[k],p)+'</td></tr>':'';}).join('')+'</tbody></table>';
  return h;
}
function monthReportHTML(k,kind){
  var title=kind==='shop'?'أوردرات المحل':'الأوردرات';
  var list=monthOrders(kind,k);
  var done=list.filter(function(o){return !!o.deliveredAt;}).length;
  var open=list.length-done;
  var prodTot={},prodCnt={};
  list.forEach(function(o){aggItems(o).forEach(function(it){var pr=P(it.p);if(!pr||invoiceHidden(pr))return;prodTot[it.p]=r3((prodTot[it.p]||0)+it.qty);prodCnt[it.p]=(prodCnt[it.p]||0)+1;});});
  var prods=Object.keys(prodTot).map(function(p){return {pr:P(p),q:prodTot[p],n:prodCnt[p]};}).filter(function(x){return x.pr;}).sort(function(a,b){return b.q-a.q;});
  var css='<style>'+
    '.mr{color:#111;font-size:12.5px}'+
    '.mr-hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:12px}'+
    '.mr-hd h1{font-size:22px;margin:0}.mr-hd .sub{color:#555;font-size:12px;text-align:left}'+
    '.mr-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px}'+
    '.mr-kpi div{border:1px solid #ddd;border-radius:8px;padding:8px;text-align:center}'+
    '.mr-kpi b{display:block;font-size:18px}.mr-kpi small{color:#555}'+
    '.mr h2{font-size:15px;margin:16px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}'+
    '.mr table{width:100%;border-collapse:collapse;font-size:12px}'+
    '.mr th{background:#111;color:#fff;padding:6px;text-align:right;font-weight:600}'+
    '.mr td{padding:6px;border-bottom:1px solid #ddd;vertical-align:top}'+
    '.mr tr:nth-child(even) td{background:#f7f7f7}'+
    '.mr .n{text-align:center;white-space:nowrap}'+
    '.mr .ok{color:#0a6b2a;font-weight:700}.mr .no{color:#b00020;font-weight:700}'+
    '.mr .it{padding:1px 0}.mr .it b{white-space:nowrap}'+
    '.mr .ft{margin-top:16px;display:flex;justify-content:space-between;color:#555;font-size:11px;border-top:1px solid #ccc;padding-top:6px}'+
    '</style>';
  var h=css+'<div class="mr">';
  h+='<div class="mr-hd"><div><h1>تقرير '+title+'</h1><div class="sub">شهر '+k+'</div></div><div class="sub">طُبع: '+tstr(Date.now())+'</div></div>';
  h+='<div class="mr-kpi"><div><b>'+list.length+'</b><small>إجمالي الأوردرات</small></div>'+
     '<div><b>'+done+'</b><small>تم تسليمها</small></div>'+
     '<div><b>'+open+'</b><small>لسه مش متسلّمة</small></div>'+
     '<div><b>'+prods.length+'</b><small>أصناف مختلفة</small></div></div>';
  h+='<h2>تفاصيل الأوردرات</h2><table><thead><tr><th class="n">#</th><th>الرقم</th><th>'+(kind==='shop'?'المحل':'العميل')+'</th><th>الأصناف</th><th>التسجيل</th><th>معاد التسليم</th><th>الحالة</th></tr></thead><tbody>'+
    (list.length?list.map(function(o,i){
      var its=aggItems(o).map(function(it){var pr=P(it.p);return pr?'<div class="it">'+pr.name+' · <b>'+pieceQ(it.qty,pr)+'</b></div>':'';}).join('');
      var st=o.deliveredAt?'<span class="ok">تم التسليم</span><br><small>'+tstr(o.deliveredAt)+'</small>':'<span class="no">لسه</span>';
      return '<tr><td class="n">'+(i+1)+'</td><td class="ltr">'+sid(o.id)+'</td><td>'+custName(o)+'</td><td>'+its+'</td><td>'+tstr(o.created)+'</td><td>'+(o.due?dueStr(o.due):'—')+'</td><td>'+st+'</td></tr>';
    }).join(''):'<tr><td colspan="7" class="n">مفيش أوردرات في الشهر ده</td></tr>')+'</tbody></table>';
  h+='<h2>إجمالي الأصناف</h2><table><thead><tr><th class="n">#</th><th>الصنف</th><th class="n">إجمالي الكمية</th><th class="n">عدد الأوردرات</th></tr></thead><tbody>'+
    (prods.length?prods.map(function(x,i){return '<tr><td class="n">'+(i+1)+'</td><td>'+x.pr.name+'</td><td class="n"><b>'+pieceQ(x.q,x.pr)+'</b></td><td class="n">'+x.n+'</td></tr>';}).join(''):'<tr><td colspan="4" class="n">مفيش أصناف</td></tr>')+'</tbody></table>';
  h+='<div class="ft"><span>'+title+' · شهر '+k+'</span><span>صفحة التقرير</span></div></div>';
  return h;
}
function archEntries(k){return Object.keys(S.archive||{}).map(function(x){return S.archive[x];}).filter(function(a){return a&&(!k||a.month===k);});}
function closedMonth(k,kind){return !!(S.locks&&S.locks[lockKey(kind,k)]);}
function monthOrders(kind,k){
  var list=[];archEntries(k).forEach(function(a){(a.orders||[]).forEach(function(o){if(okind(o)===kind)list.push(o);});});
  return list.concat(ordersOf(kind).filter(function(o){return monthKey(o.created)===k;})).sort(function(a,b){return a.created-b.created;});
}
function monthsHTML(){
  var late=S.orders.filter(function(o){return !o.deliveredAt&&!closeKeep(o);}).length;
  var keepN=S.orders.filter(closeKeep).length;
  var toArch=S.orders.length-keepN;
  var runB=S.batches.length, rawN=Object.keys(S.stock||{}).length;
  var months={};
  function slot(k){return months[k]=months[k]||{cust:0,shop:0,live:0,und:0};}
  S.orders.forEach(function(o){var m=slot(monthKey(o.created));m[okind(o)]++;m.live++;if(!o.deliveredAt)m.und++;});
  archEntries().forEach(function(a){if(!a.month)return;var m=slot(a.month);(a.orders||[]).forEach(function(o){m[okind(o)]++;});});
  Object.keys(S.locks||{}).forEach(function(lk){var k=lk.split('|')[1];if(k)slot(k);});
  var keys=Object.keys(months).sort().reverse();
  var ok1=late===0,ok2=runB===0,canClose=ok1&&ok2;
  var checks=[
    [ok1,ok1?'كل الأوردرات اللي معادها النهارده أو قبله اتسلّمت':late+' أوردر معادها النهارده أو قبله لسه مش متسلّم'],
    [ok2,ok2?'مفيش دفعات شغالة في التحضير أو الإنتاج':runB+' دفعة لسه شغالة في التحضير أو الإنتاج']
  ];
  var checksH=checks.map(function(c){return '<div class="hist"><span>'+(c[0]?'✅':'⛔')+' '+c[1]+'</span><span class="pill '+(c[0]?'ok':'low')+'">'+(c[0]?'تمام':'مطلوب')+'</span></div>';}).join('');
  var tiles='<div class="pstats" style="grid-template-columns:repeat(4,1fr)">'+
    '<div><b>'+toArch+'</b><small>أوردر هيتأرشف</small></div>'+
    '<div><b>'+keepN+'</b><small>أوردر بعد النهارده</small></div>'+
    '<div><b>'+runB+'</b><small>دفعات شغالة</small></div>'+
    '<div><b>'+rawN+'</b><small>خامات هتتصفّر</small></div></div>';
  var rows=keys.map(function(k){
    var m=months[k],lk=closedMonth(k,'cust')||closedMonth(k,'shop');
    var conf=U.confirm==='lock:'+lockKey('cust',k),delConf=U.confirm==='delarch:'+lockKey('cust',k);
    var pdfs=lk?'<button class="btn sm" data-act="monthPdf" data-kind="cust" data-k="'+k+'">PDF الأوردرات</button>'+(m.shop?'<button class="btn sm" data-act="monthPdf" data-kind="shop" data-k="'+k+'">PDF المحل</button>':''):'';
    var del=(lk&&!limited())?'<button class="btn ghost sm" data-act="monthDelArchive" data-kind="cust" data-k="'+k+'" style="color:var(--bad)">'+(delConf?'اضغط تاني للتأكيد':'حذف من الأرشيف')+'</button>':'';
    var lockB=(!lk||m.live)?'<button class="btn ghost sm" data-act="lockMonth" data-kind="cust" data-k="'+k+'"'+(canClose?'':' disabled')+'>'+(conf?'اضغط تاني للتأكيد':'اقفل الشهر')+'</button>':'';
    return '<div class="hist" style="align-items:center;flex-wrap:wrap;gap:8px"><span><b>'+k+'</b> <span class="meta">· '+m.cust+' أوردر عادي'+(m.shop?' · '+m.shop+' أوردر محل':'')+(m.und?' · لسه '+m.und+' مش متسلّم':'')+'</span></span><span class="acts" style="display:flex;gap:6px;flex-wrap:wrap">'+(lk?'<span class="pill ok">مقفول</span>':'')+pdfs+del+lockB+'</span></div>';
  }).join('');
  var status=canClose?'<span class="pill ok">جاهز للقفل</span>':'<span class="pill low">مش جاهز</span>';
  return '<section class="card dat" style="--c:var(--orders)"><div class="row"><h3>لوحة تقفيل الشهر</h3>'+status+'</div>'+
    '<p class="meta" style="margin:0">القفل بيأرشف البيانات السابقة ويصفّرها، والأوردرات اللي معادها بعد النهارده بتفضل زي ما هي.</p>'+
    tiles+
    '<div class="grp" style="margin-top:12px">قبل القفل</div>'+checksH+
    '<div class="grp" style="margin-top:12px">الشهور ('+keys.length+')</div>'+(keys.length?rows:'<div class="meta">مفيش شهور لسه</div>')+
    '</section>';
}
function allOk(o){return (o.items||[]).every(function(it){return !!it.ok;});}
function readyCard(o){
  var open=U.oexp===o.id;
  var head='<div class="bh"><div><span class="bid ltr">'+sid(o.id)+'</span><h3 class="bn">'+custName(o)+'</h3></div><span class="pill ok">جاهزة</span></div>';
  var detail='<div>'+itemsListHTML(o)+'<div class="meta">'+tstr(o.created)+(o.due?' · معاد التسليم <b>'+dueStr(o.due)+'</b>':'')+'</div>'+(o.note?'<div class="meta" style="color:var(--ink)">ملاحظة: '+o.note+'</div>':'')+'</div>'+
    '<div class="btns"><button class="btn ghost sm" data-act="printOrder" data-id="'+o.id+'">طباعة الطلبية</button></div>';
  return '<article class="card" style="--c:var(--orders)">'+head+(open?detail:'')+
    '<div class="btns"><button class="btn ghost sm" data-act="oToggle" data-id="'+o.id+'" aria-expanded="'+(open?'true':'false')+'">'+(open?'إخفاء التفاصيل':'عرض التفاصيل')+'</button><button class="btn ghost sm" data-act="oEdit" data-id="'+o.id+'">تعديل الطلبية</button><button class="btn"'+(allOk(o)?'':' disabled')+' data-act="oDeliver" data-id="'+o.id+'">تسليم الأوردر</button></div>'+
    '<div class="btns"><button class="btn quiet sm" data-act="oDelete" data-id="'+o.id+'" style="color:var(--bad)">'+(U.confirm==='del'+o.id?'اضغط تاني للتأكيد':'حذف الأوردر')+'</button></div></article>';
}

var FOLD_OPEN={};
document.addEventListener('toggle',function(e){var d=e.target;if(d&&d.dataset&&d.dataset.fk){FOLD_OPEN[d.dataset.fk]=d.open;}},true);
function archiveHTML(arch,kind){
  if(!arch.length)return '';
  var months={};
  arch.forEach(function(o){var k=monthKey(o.created);(months[k]=months[k]||[]).push(o);});
  return '<div class="grp" style="margin-top:18px">الأرشيف</div>'+Object.keys(months).sort().reverse().map(function(k){
    var list=months[k].slice().reverse(),locked=!!(S.locks&&S.locks[lockKey(kind,k)]);
    var undeliv=ordersOf(kind).filter(function(o){return monthKey(o.created)===k&&!o.deliveredAt;}).length;
    return '<details class="card arch" data-fk="arch-'+k+'" style="margin-top:10px;--c:var(--orders)"'+(FOLD_OPEN['arch-'+k]?' open':'')+'><summary class="bh"><div><h3 class="bn">'+k+'</h3><span class="meta">'+list.length+' أوردر'+(undeliv?' · لسه فيه '+undeliv+' مش متسلّم':'')+'</span></div>'+
      '<span class="pill '+(locked?'ok':'low')+'">'+(locked?'مقفول':'مفتوح')+'</span></summary>'+
      list.map(function(o){
        return '<div class="hist"><span><span class="ltr">'+sid(o.id)+'</span> · '+custName(o)+'<br><span class="meta">'+itemsText(o)+'</span></span><span class="meta" style="text-align:end">'+tstr(o.created)+'<br>سُلّم: '+tstr(o.deliveredAt)+'</span></div>';
      }).join('')+'</details>';
  }).join('');
}

function shopProductsHTML(){
  var btn='<div class="btns"><button class="btn" data-act="newProd" data-shop="1">'+svg('plus')+'وصفة محل جديدة</button><button class="btn ghost sm" data-act="recExport" data-k="shop">تصدير</button><button class="btn ghost sm" data-act="recImport" data-k="shop">استيراد</button><button class="btn ghost sm" data-act="rpOpen" data-k="shop">طباعة وصفات</button></div>';
  if(!prodsOf('shop').length)return head('وصفات المحل','الوصفات دي بتظهر في أوردرات المحل بس',btn)+'<div class="empty"><b>مفيش وصفات محل</b><span>ضيف وصفة وحدّدها كوصفة محل عشان تظهر في أوردرات المحل.</span></div>';
  return head('وصفات المحل','الوصفات دي بتظهر في أوردرات المحل بس',btn)+recipePanel();
}

function reservedList(){
  var now=Date.now();
  function dueT(o){return o.due?new Date(o.due).getTime():Infinity;}
  return S.orders.filter(function(o){return !o.deliveredAt;}).sort(function(a,b){
    var da=dueT(a),db=dueT(b),la=da<now,lb=db<now;
    if(la!==lb)return la?-1:1;
    if(da!==db)return da<db?-1:1;
    return (a.created||0)-(b.created||0);
  });
}
function reservedToday(){
  var t=ymd(new Date());
  return reservedList().filter(function(o){return o.due&&o.due.slice(0,10)===t;});
}
var RC_OPEN={};
document.addEventListener('toggle',function(e){var d=e.target;if(d&&d.classList&&d.classList.contains('ordfold')&&d.dataset.oid){RC_OPEN[d.dataset.oid]=d.open;}},true);
function reservedCard(o){
  var late=!!o.due&&new Date(o.due).getTime()<Date.now();
  var tmrw=!!o.due&&o.due.slice(0,10)===ymd(new Date(Date.now()+86400000));
  var xs=ordShort(o),grp={},ord=[];
  xs.forEach(function(x,i){
    var it=o.items[i]||{},n=it.box||1;
    if(!grp[n]){grp[n]={n:n,bt:boxTypeOf(o,n)||it.pack||'',rows:[]};ord.push(n);}
    grp[n].rows.push({x:x,it:it});
  });
  ord.sort(function(a,c){return a-c;});
  var rows=ord.map(function(n){
    var g=grp[n];
    var head='<div class="pkh">تعبئة '+n+(g.bt?' · '+esc(g.bt):'')+'</div>';
    var items=g.rows.map(function(r){
      var x=r.x,it=r.it,p=P(x.p)||{name:'صنف محذوف',unit:''};
      var tap=x.short>0?'':' data-act="resTick" data-id="'+o.id+'" data-p="'+x.p+'" role="button"';
      var cls='rq'+(x.short>0?'':' tap')+(it.ok?' okrow':'');
      return '<div class="'+cls+'"'+tap+'><div><b>'+esc(p.name)+'</b><small>مطلوب '+pieceQ(x.qty,p)+' · متاح '+f(x.have)+(x.pend?' · في التحضير '+f(x.pend):'')+'</small></div>'+
        (x.short>0?'<span class="pill low">ناقص '+f(x.short)+'</span>':'<span class="pill'+(it.ok?' ok':'')+'">'+(it.ok?'✓ صح':'علّم')+'</span>')+'</div>';
    }).join('');
    return '<div class="pkg">'+head+items+'</div>';
  }).join('');
  return '<details class="card ordfold" data-oid="'+o.id+'" style="--c:var(--orders)"'+(RC_OPEN[o.id]===false?'':' open')+'>'+
    '<summary class="mtop"><div><b>'+esc(custName(o))+'</b>'+
    '<small>طلبية '+o.id+' · '+(o.isBox?'علبة جاهزة':okind(o)==='shop'?'أوردر محل':'أوردر عميل')+'</small></div>'+
    '<span class="ordpills">'+(tmrw?'<span class="pill" style="background:color-mix(in srgb,var(--warn) 18%,var(--surface));color:var(--warn)">خارج بكرا</span>':'')+
    '<span class="pill '+(late?'bad':'low')+'">'+(o.due?(late?'متأخر · ':'')+dueStr(o.due):'بدون معاد')+'</span></span></summary>'+
    '<div class="ordbody">'+rows+'</div></details>';
}
function reservedView(){
  var list=reservedList(),today=reservedToday();
  var banner=today.length?'<div class="note" style="background:color-mix(in srgb,var(--warn) 14%,var(--surface))"><b>حفلات هتتسلم النهارده ('+today.length+')</b><div class="meta" style="margin-top:4px">'+
    today.map(function(o){return esc(custName(o))+' · '+fmt12str(o.due.slice(11,16));}).join(' — ')+'</div></div>':'';
  var body=list.length?'<div class="list">'+list.map(reservedCard).join('')+'</div>':
    '<div class="empty"><b>مفيش أوردرات تحت التشغيل</b><span>الأوردرات اللي لسه ما اتسلمتش هتظهر هنا.</span></div>';
  return head('تحت التشغيل','عرض فقط · المتأخر فوق، وبعده الأقرب معاد. الأوردر بيختفي لما يتسلم.','')+banner+body;
}
/* المواسم في الأوردرات + موسم "علب جاهزة" */
function ordSegHTML(){return seasonSeg(ordSeason(),'setSeason',visibleSeasons().concat([['boxes','علب جاهزة']]));}
/* ===== تقويم الأوردرات ===== */
function calTodayKey(){var ms=trustedNow();return ms===null?null:cairoDateKey(ms);}
function calCur(){var k=calTodayKey();return k?k.slice(0,7):new Date().toISOString().slice(0,7);}
function calShift(ym,n){var y=+ym.slice(0,4),m=+ym.slice(5,7)+n;var d=new Date(Date.UTC(y,m-1,1));return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');}
function calGroup(){
  var g={};
  (S.orders||[]).forEach(function(o){if(o.isBox||!o.due)return;var k=String(o.due).slice(0,10);(g[k]=g[k]||[]).push(o);});
  Object.keys(g).forEach(function(k){g[k].sort(function(a,b){return String(a.due).localeCompare(String(b.due));});});
  return g;
}
function calUpcomingDays(){
  var today=calTodayKey(),g=calGroup();
  if(!today)return 0;
  return Object.keys(g).filter(function(k){return k>=today&&g[k].some(function(o){return !o.deliveredAt;});}).length;
}
function calDotClass(o){return o.deliveredAt?'done':(ordComplete(o)?'ready':'open');}
function calCellHTML(k,list,today){
  var n=list?list.length:0;
  var dots=n?list.slice(0,4).map(function(o){return '<i class="cal-dot '+calDotClass(o)+'"></i>';}).join(''):'';
  var names=n?list.slice(0,2).map(function(o){return esc(custName(o));}).join('، ')+(n>2?' …':''):'';
  return '<button class="cal-cell'+(k===today?' today':'')+(n?' has':'')+'" data-act="calDay" data-d="'+k+'" aria-label="'+k+(n?' — '+n+' أوردر':'')+'">'+
    '<span class="cal-num">'+(+k.slice(8,10))+'</span>'+
    (n?'<span class="cal-cnt">'+n+'</span><span class="cal-dots">'+dots+'</span><span class="cal-names">'+names+'</span>':'')+
    '</button>';
}
function calMonthView(){
  var today=calTodayKey(),ym=U.calMonth||calCur(),g=calGroup();
  var y=+ym.slice(0,4),m=+ym.slice(5,7);
  var label=new Date(Date.UTC(y,m-1,15)).toLocaleDateString('ar-EG',{month:'long',year:'numeric',timeZone:'UTC'});
  var first=new Date(Date.UTC(y,m-1,1)).getUTCDay(), days=new Date(Date.UTC(y,m,0)).getUTCDate();
  var monthN=0,cells='';
  for(var i=0;i<first;i++)cells+='<span class="cal-cell empty" aria-hidden="true"></span>';
  for(var d=1;d<=days;d++){
    var k=ym+'-'+String(d).padStart(2,'0'), list=g[k]||[];
    monthN+=list.length;
    cells+=calCellHTML(k,list,today);
  }
  var week=WEEK_DAYS_AR.map(function(n){return '<span>'+n+'</span>';}).join('');
  return '<section class="cal-wrap">'+calModeBar()+
    '<div class="cal-top"><div><b>تقويم الأوردرات</b><small>'+monthN+' أوردر في '+label+'</small></div>'+
    '<div class="cal-nav"><button class="btn ghost sm" data-act="calNav" data-m="1">الشهر اللي بعده</button>'+
    '<button class="btn ghost sm" data-act="calToday">النهاردة</button>'+
    '<button class="btn ghost sm" data-act="calNav" data-m="-1">الشهر اللي قبله</button></div></div>'+
    '<div class="cal-month">'+label+'</div>'+
    '<div class="cal-week">'+week+'</div>'+
    '<div class="cal-grid">'+cells+'</div>'+
    '<div class="cal-legend"><span><i class="cal-dot open"></i>قيد التحضير</span><span><i class="cal-dot ready"></i>جاهز للتسليم</span><span><i class="cal-dot done"></i>متسلّم</span></div>'+
    '</section>';
}
/* ===== التقويم: شهري / أسبوعي / يومي، وسحب الأوردر من يوم لتاني لتغيير ميعاد التسليم ===== */
var CAL_MODES=[['month','شهري'],['week','أسبوعي'],['day','يومي']];
function calMode(){return U.calMode||'month';}
function calAnchorKey(){return U.calAnchor||calTodayKey()||new Date().toISOString().slice(0,10);}
function calAddDays(k,n){var d=new Date(k+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function calWeekStart(k){return calAddDays(k,-new Date(k+'T12:00:00Z').getUTCDay());}
function calCanEdit(){return !limited()||permLevel('orders')==='edit';}
function calDayName(k,long){
  var o=long?{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}:{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'};
  return new Date(k+'T12:00:00Z').toLocaleDateString('ar-EG',o);
}
function calModeBar(){
  return '<div class="seg cal-modes" role="group" aria-label="طريقة العرض">'+CAL_MODES.map(function(m){
    return '<button class="'+(calMode()===m[0]?'on':'')+'" data-act="calMode" data-m="'+m[0]+'">'+m[1]+'</button>';
  }).join('')+'</div>';
}
function calNavBar(mode,from,to,tot){
  var lbl=mode==='week'?calDayName(from,false)+' – '+calDayName(to,false):calDayName(from,true);
  return '<div class="cal-top"><div><b>'+(mode==='week'?'الأسبوع':'اليوم')+'</b><small>'+tot+(tot===1?' أوردر':' أوردر')+' · '+lbl+'</small></div>'+
    '<div class="cal-nav"><button class="btn ghost sm" data-act="calStep" data-n="1">'+(mode==='week'?'الأسبوع اللي بعده':'اليوم اللي بعده')+'</button>'+
    '<button class="btn ghost sm" data-act="calToday">النهاردة</button>'+
    '<button class="btn ghost sm" data-act="calStep" data-n="-1">'+(mode==='week'?'الأسبوع اللي قبله':'اليوم اللي قبله')+'</button></div></div>';
}
function calGripHTML(o,can){
  return (can&&!o.deliveredAt)?'<span class="cal-grip" data-id="'+o.id+'" title="اسحب لتغيير اليوم" aria-label="اسحب لتغيير اليوم">⋮⋮</span>':'';
}
/* صف مختصر للأسبوع: ميعاد + اسم + حالة، والمسك بيحرّك الأوردر */
function calChip(o,can){
  var time=fmt12str(String(o.due).slice(11,16));
  var g=calGripHTML(o,can)||'<span class="cal-grip off"></span>';
  return '<div class="cal-chip '+calDotClass(o)+'">'+g+'<span class="cal-time">'+(time||'--:--')+'</span>'+
    '<span class="cal-chip-n"><b>'+esc(custName(o))+'</b><small class="ltr">'+sid(o.id)+(okind(o)==='shop'?' · محل':'')+'</small></span>'+
    '<i class="cal-dot '+calDotClass(o)+'"></i></div>';
}
function calDayBlock(k,list,today,can){
  var n=list.length,body=list.map(function(o){return calChip(o,can);}).join('');
  return '<section class="cal-day'+(k===today?' today':'')+'" data-drop="'+k+'">'+
    '<div class="cal-day-h"><button class="cal-day-open" data-act="calDay" data-d="'+k+'">'+calDayName(k,true)+'</button>'+
    '<small>'+(n?n+' أوردر':'فاضي')+'</small></div>'+
    '<div class="cal-day-b">'+(body||'<span class="cal-empty">'+(can?'اسحب أوردر هنا عشان ينتقل لليوم ده':'مفيش أوردرات')+'</span>')+'</div></section>';
}
function calWeekHTML(){
  var g=calGroup(),today=calTodayKey(),can=calCanEdit(),st=calWeekStart(calAnchorKey());
  var days=[0,1,2,3,4,5,6].map(function(i){return calAddDays(st,i);});
  var tot=days.reduce(function(a,k){return a+(g[k]||[]).length;},0);
  return calNavBar('week',days[0],days[6],tot)+days.map(function(k){return calDayBlock(k,g[k]||[],today,can);}).join('');
}
function calOrdCard(o,can){
  var time=fmt12str(String(o.due).slice(11,16));
  var st=o.deliveredAt?'<span class="cal-st done">متسلّم</span>':(ordComplete(o)?'<span class="cal-st ready">جاهز</span>':'<span class="cal-st open">قيد التحضير</span>');
  return '<article class="cal-ord"><div class="cal-ord-h">'+calGripHTML(o,can)+'<span class="cal-time">'+(time||'--:--')+'</span>'+
    '<div class="cal-ord-id"><b>'+esc(custName(o))+'</b><small class="ltr">'+sid(o.id)+' · '+(okind(o)==='shop'?'أوردر محل':'أوردر عميل')+'</small></div>'+st+'</div>'+
    '<div class="cal-ord-items">'+itemsText(o)+'</div>'+
    (o.note?'<div class="cal-ord-note">ملاحظة: '+o.note+'</div>':'')+
    '<div class="cal-ord-act"><button class="btn ghost sm" data-act="printOrder" data-id="'+o.id+'">طباعة</button>'+
    (can&&!o.deliveredAt?'<button class="btn sm" data-act="calEditOrder" data-id="'+o.id+'">تعديل</button>':'')+'</div></article>';
}
function calDayViewHTML(){
  var k=calAnchorKey(),today=calTodayKey(),g=calGroup(),can=calCanEdit(),st=calWeekStart(k);
  var list=(g[k]||[]).slice().sort(function(a,b){return String(a.due).localeCompare(String(b.due));});
  /* شريط الأيام اللي في الأسبوع: الصنف بيتسحب عليهم عشان يتنقل لأي يوم */
  var strip=[0,1,2,3,4,5,6].map(function(i){
    var d=calAddDays(st,i),n=(g[d]||[]).length;
    return '<button class="cal-strip-d'+(d===k?' on':'')+(d===today?' today':'')+'" data-drop="'+d+'" data-act="calGoDay" data-d="'+d+'">'+
      '<small>'+WEEK_DAYS_AR[new Date(d+'T12:00:00Z').getUTCDay()]+'</small><b>'+(+d.slice(8,10))+'</b><i>'+(n||'')+'</i></button>';
  }).join('');
  var rows=list.map(function(o){return calOrdCard(o,can);}).join('');
  return calNavBar('day',k,k,list.length)+'<div class="cal-strip">'+strip+'</div>'+
    '<div class="cal-dayrows">'+(rows||'<div class="empty"><b>مفيش أوردرات في اليوم ده</b><span>'+(can?'اسحب أوردر من الشريط اللي فوق عشان ينتقل ليوم تاني.':'')+'</span></div>')+'</div>';
}
function calendarView(){
  var m=calMode();
  if(m==='week')return '<section class="cal-wrap">'+calModeBar()+calWeekHTML()+'</section>';
  if(m==='day')return '<section class="cal-wrap">'+calModeBar()+calDayViewHTML()+'</section>';
  return calMonthView();
}
/* نقل الأوردر لتاني يوم: الميعاد (الساعة) بيفضل زي ما هو */
function calMoveOrder(id,day){
  var o=(S.orders||[]).filter(function(x){return String(x.id)===String(id);})[0];
  if(!o||o.deliveredAt||!o.due||!calCanEdit())return false;
  if(closedMonth(monthKey(o.created),okind(o))){toast('الشهر اتقفل، الأوردر ده مش هينتقل');return false;}
  var cur=String(o.due);
  if(cur.slice(0,10)===day)return false;
  o.due=day+cur.slice(10);
  return true;
}
/* السحب: بالماوس أو الصباع من الـ grip. الـ touch-action none على المسكة بيمنع الصفحة تتحرك وإحنا بنسحب */
var CAL_DRAG=null,CAL_NOCLICK=0;
document.addEventListener('pointerdown',function(e){
  var g=e.target.closest&&e.target.closest('.cal-grip');
  if(!g||!g.getAttribute('data-id')||U.view!=='calendar'||!calCanEdit()||e.button>0)return;
  CAL_DRAG={id:g.getAttribute('data-id'),x:e.clientX,y:e.clientY,lx:e.clientY,on:false,src:g.closest('.cal-chip,.cal-ord'),
    ghost:null,gx:0,gy:0,drop:null,dropEl:null,timer:null};
},true);
function calGhostStart(D,e){
  var r=D.src.getBoundingClientRect();
  D.gx=D.x-r.left;D.gy=D.y-r.top;
  var gh=D.src.cloneNode(true);
  gh.classList.add('cal-ghost');gh.style.width=r.width+'px';
  gh.style.left=(e.clientX-D.gx)+'px';gh.style.top=(e.clientY-D.gy)+'px';
  document.body.appendChild(gh);D.ghost=gh;
  document.body.classList.add('cal-dragging');
  /* لو الصباع قرب أعلى أو أسفل الشاشة، الصفحة بتنزل أو تطلع لوحدها */
  D.timer=setInterval(function(){var y=D.lx,H=window.innerHeight;if(y<90)window.scrollBy(0,-12);else if(y>H-90)window.scrollBy(0,12);},16);
}
document.addEventListener('pointermove',function(e){
  var D=CAL_DRAG;if(!D)return;
  if(!D.on){var dx=e.clientX-D.x,dy=e.clientY-D.y;if(dx*dx+dy*dy<64)return;D.on=true;if(D.src)calGhostStart(D,e);}
  D.lx=e.clientY;
  if(D.ghost){D.ghost.style.left=(e.clientX-D.gx)+'px';D.ghost.style.top=(e.clientY-D.gy)+'px';}
  var el=document.elementFromPoint(e.clientX,e.clientY),t=el&&el.closest?el.closest('[data-drop]'):null;
  var nd=t?t.getAttribute('data-drop'):null;
  if(nd!==D.drop){if(D.dropEl)D.dropEl.classList.remove('cal-over');D.drop=nd;D.dropEl=t;if(t)t.classList.add('cal-over');}
},true);
function calDragEnd(cancel){
  var D=CAL_DRAG;if(!D)return;CAL_DRAG=null;
  if(D.timer)clearInterval(D.timer);
  if(D.ghost)D.ghost.remove();
  document.body.classList.remove('cal-dragging');
  if(D.dropEl)D.dropEl.classList.remove('cal-over');
  if(!D.on)return;
  CAL_NOCLICK=Date.now();
  if(cancel||!D.drop)return;
  if(calMoveOrder(D.id,D.drop)){save();toast('اتنقل الأوردر ليوم '+calDayName(D.drop,true));render();}
}
document.addEventListener('pointerup',function(){calDragEnd(false);},true);
document.addEventListener('pointercancel',function(){calDragEnd(true);},true);
/* بعد السحب ما تتفتحش شاشة اليوم بالغلط من الضغطة اللي بتيجي بعد الإفلات */
document.addEventListener('click',function(e){if(Date.now()-CAL_NOCLICK<500){e.stopPropagation();e.preventDefault();}},true);

function calDayHTML(){
  var k=U.calDay;if(!k)return '';
  var list=calGroup()[k]||[];
  var title=new Date(k+'T12:00:00Z').toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
  var canEd=!limited()||permLevel('orders')==='edit';
  var rows=list.map(function(o){
    var time=fmt12str(String(o.due).slice(11,16));
    var st=o.deliveredAt?'<span class="cal-st done">متسلّم</span>':(ordComplete(o)?'<span class="cal-st ready">جاهز</span>':'<span class="cal-st open">قيد التحضير</span>');
    return '<article class="cal-ord">'+
      '<div class="cal-ord-h"><span class="cal-time">'+(time||'--:--')+'</span>'+
      '<div class="cal-ord-id"><b>'+esc(custName(o))+'</b><small class="ltr">'+sid(o.id)+' · '+(okind(o)==='shop'?'أوردر محل':'أوردر عميل')+'</small></div>'+st+'</div>'+
      '<div class="cal-ord-items">'+itemsText(o)+'</div>'+
      (o.note?'<div class="cal-ord-note">ملاحظة: '+o.note+'</div>':'')+
      '<div class="cal-ord-act"><button class="btn ghost sm" data-act="printOrder" data-id="'+o.id+'">طباعة</button>'+
      (canEd&&!o.deliveredAt?'<button class="btn sm" data-act="calEditOrder" data-id="'+o.id+'">تعديل</button>':'')+'</div></article>';
  }).join('');
  return '<div class="cal-ov"><div class="cal-bg" data-act="calClose"></div><div class="cal-sheet" role="dialog" aria-modal="true" aria-label="أوردرات اليوم">'+
    '<div class="cal-sheet-h"><div><b>'+title+'</b><small>'+list.length+(list.length>1?' أوردرات':' أوردر')+'</small></div>'+
    '<button class="cal-x" data-act="calClose" aria-label="إغلاق">×</button></div>'+
    '<div class="cal-sheet-b">'+rows+'</div></div></div>';
}
function ordersView(kind){
  kind=kind||'cust';
  if(ordSeason()==='boxes')return head(kind==='shop'?'أوردرات المحل':'الأوردرات','علب جاهزة: اختار قالب واطلبه زي أي أوردر، والقوالب الجديدة بتتعمل من الإعدادات','')+ordSegHTML()+boxSeasonHTML();
  var all=ordersOf(kind);
  var open=all.filter(function(o){return !o.deliveredAt&&!ordComplete(o);}).slice().reverse();
  var ready=all.filter(function(o){return !o.deliveredAt&&ordComplete(o);}).slice().reverse();
  var arch=all.filter(function(o){return !!o.deliveredAt;});
  var btn='<div class="btns"><button class="btn ghost sm" data-act="printAllOrders" data-k="'+kind+'">تصدير الأوردرات PDF</button><button class="btn" data-act="newOrder">'+svg('plus')+'أوردر جديد</button></div>';
  var body='';
  if(open.length)body+=grpTitle('في التحضير والإنتاج',open.length)+'<div class="list">'+open.map(orderCard).join('')+'</div>';
  if(ready.length)body+=grpTitle('جاهزة للتسليم',ready.length)+'<div class="list">'+ready.map(readyCard).join('')+'</div>';
  if(!body)body='<div class="empty"><b>'+(kind==='shop'?'مفيش أوردرات محل':'مفيش أوردرات')+'</b><span>سجّل الأوردر من الزرار اللي فوق. لما تسلّمه يتأرشف.</span></div>';
  var sub=kind==='shop'?'أوردرات المحل الشغالة، ولما تسلّمها تتأرشف':'الأوردرات الشغالة، ولما تسلّم الأوردر يتأرشف';
  return head(kind==='shop'?'أوردرات المحل':'الأوردرات',sub,btn)+ordSegHTML()+body+archiveHTML(arch,kind);
}
var PACKS=['سرفيز','علبة صغيرة','علبة وسط','علبة كبيرة','علبة جزمة','سفنديش كبير','سفنديش صغير','فخارة','كاس','بولة','فورمة كبيرة'];
/* التعبئات داخل الطلبية: كل صنف بيتحط في تعبئة (رقم)، ولكل تعبئة نوع. الطلبيات القديمة من غير رقم تعبئة بتتعامل كتعبئة 1 */
function boxOf(os,pid){var bs=os.boxes||[{n:1,type:''}],n=(os.box||{})[pid];return bs.some(function(b){return b.n===n;})?n:bs[0].n;}
function boxTypeOf(os,n){var b=(os.boxes||[]).filter(function(x){return x.n===n;})[0];return b?(b.type||''):'';}
function packGroupsOf(o){
  var g={},ord=[];
  (o.items||[]).forEach(function(it){
    var n=it.box||1;
    if(!g[n]){g[n]={n:n,pack:'',items:[]};ord.push(n);}
    if(!g[n].pack&&it.pack)g[n].pack=it.pack;
    g[n].items.push(it);
  });
  return ord.sort(function(a,b){return a-b;}).map(function(n){return g[n];});
}
/* صفوف الأصناف في الطلبية: لو فيه أكتر من تعبئة بيتعمل عنوان لكل تعبئة */
function itemRowsHTML(o,print){
  var grps=packGroupsOf(o),multi=grps.length>1,n=0,h='';
  grps.forEach(function(gr){
    var vis=gr.items.filter(function(it){return !invoiceHidden(P(it.p));});
    if(!vis.length)return;
    if(multi)h+='<tr><td colspan="'+(print?3:2)+'" style="background:var(--surface-2);font-weight:700">تعبئة '+gr.n+(gr.pack?' · '+esc(gr.pack):'')+'</td></tr>';
    vis.forEach(function(it){
      var p=P(it.p);if(!p)return;n++;
      if(print)h+='<tr><td>'+n+'</td><td>'+esc(p.name)+'</td><td class="n">'+pieceQ(it.qty,p)+'</td></tr>';
      else h+='<tr><td>'+esc(p.name)+(!multi&&it.pack?' · '+esc(it.pack):'')+'</td><td class="n">'+pieceQ(it.qty,p)+'</td></tr>';
    });
  });
  return h;
}
/* تقسيم الكمية على التعبئات: split[pid][رقم التعبئة] = الكمية اللي في التعبئة دي */
function splitOK(s,pid){
  var sp=s.split&&s.split[pid];if(!sp)return false;
  var t=0;Object.keys(sp).forEach(function(k){t+=sp[k]||0;});
  return t>0&&r3(t)===r3(s.items[pid]||0);
}
function qtyIn(s,pid,n){
  if(splitOK(s,pid))return s.split[pid][n]||0;
  return (s.items[pid]||0)>0&&boxOf(s,pid)===n?(s.items[pid]||0):0;
}
function partsOf(s,pid){
  if(splitOK(s,pid))return Object.keys(s.split[pid]).map(Number).filter(function(k){return s.split[pid][k]>0;}).sort(function(a,b){return a-b;}).map(function(k){return {box:k,qty:s.split[pid][k]};});
  return [{box:boxOf(s,pid),qty:s.items[pid]}];
}
function boxesEditorHTML(s){
  var bs=s.boxes||[{n:1,type:''}];
  var list=PRODUCTS.filter(function(p){return (s.items[p.id]||0)>0;});
  var cards=bs.map(function(b){
    var mine=list.filter(function(p){return qtyIn(s,p.id,b.n)>0;});
    var tot=totUnitsTxt(mine.map(function(p){return {p:p.id,qty:qtyIn(s,p.id,b.n)};}));
    var rows=mine.map(function(p){
      var sel=splitOK(s,p.id)?'<small class="meta">من القالب</small>':
        '<select data-ibox="'+p.id+'" aria-label="التعبئة" style="height:40px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--ink);padding:0 6px;font-size:14px">'+
        bs.map(function(x){return '<option value="'+x.n+'"'+(x.n===b.n?' selected':'')+'>تعبئة '+x.n+'</option>';}).join('')+'</select>';
      return '<div class="rq"><div><b>'+esc(p.name)+'</b><small>'+f(qtyIn(s,p.id,b.n))+' '+esc(p.unit||'')+'</small></div>'+sel+'</div>';
    }).join('');
    var del=(bs.length>1&&!mine.length)?'<button class="btn quiet sm" data-act="boxDel" data-n="'+b.n+'">احذف التعبئة</button>':'';
    return '<div class="card" style="--c:var(--orders);padding:12px;gap:8px">'+
      '<div class="bh"><div><h3>تعبئة '+b.n+'</h3><small class="meta">'+(mine.length?mine.length+' صنف · '+esc(tot):'مفيش أصناف فيها لسه')+'</small></div>'+del+'</div>'+
      '<select data-btype="'+b.n+'" aria-label="نوع التعبئة" style="height:44px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--ink);padding:0 8px;font-size:15px"><option value="">نوع التعبئة</option>'+(b.type&&PACKS.indexOf(b.type)<0?'<option value="'+esc(b.type)+'" selected>'+esc(b.type)+'</option>':'')+
      PACKS.map(function(x){return '<option value="'+x+'"'+(b.type===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select>'+rows+'</div>';
  }).join('');
  return '<div class="fld"><span class="sec-l">التعبئات</span><div class="stack">'+cards+'</div>'+
    '<div class="btns"><button class="btn ghost sm" data-act="boxAdd">'+svg('plus')+'تعبئة جديدة</button></div></div>';
}
/* ===== الطلب الذكي: اكتب الطلب بالكلام وهو يفهم الصنف والتعبئة والعدد ===== */
var SM_UNITS=['قطعه','قطع','حبه','حبات','pcs'];
function smNorm(x){
  return String(x||'')
    .replace(/[٠-٩]/g,function(d){return String(d.charCodeAt(0)-1632);})
    .replace(/[۰-۹]/g,function(d){return String(d.charCodeAt(0)-1776);})
    .replace(/[\u064B-\u0652\u0640]/g,'')
    .replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .replace(/(\d)([ظضصم])/g,'$1 $2')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9.:]+/g,' ').trim().toLowerCase();
}
function smTok(x){return smNorm(x).split(' ').filter(Boolean);}
function smLev(a,b){
  var m=a.length,n=b.length,d=[],i,j;
  for(i=0;i<=m;i++)d[i]=[i];
  for(j=0;j<=n;j++)d[0][j]=j;
  for(i=1;i<=m;i++)for(j=1;j<=n;j++)
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[m][n];
}
/* كلمتين بيعتبروا نفس الكلمة لو متطابقين أو فرق حرف/حرفين (للكلمات الطويلة بس) */
function smEq(a,b){
  if(a===b)return true;
  var n=Math.max(a.length,b.length);
  if(n<4)return false;
  return smLev(a,b)<=(n>=6?2:1);
}
function smIsNum(x){return /^\d+(\.\d+)?$/.test(x);}

/* ===== التاريخ والساعة واسم العميل داخل الطلب الذكي ===== */
var SM_AM_W=['الصبح','صباحا','ص'];
var SM_PM_W=['العصر','المغرب','بالليل','الليل','مساء','م','ظ','ض','الضهر','الظهر'];
var SM_TODAY_W=['النهارده','اليوم'];
var SM_TOM_W=['بكره','بكرا','غدا','غدوه'];
var SM_WD=[['الاحد',0],['الاتنين',1],['الاثنين',1],['التلات',2],['الثلاثاء',2],['الاربع',3],['الاربعاء',3],['الخميس',4],['الجمعه',5],['الجمعة',5],['السبت',6]];
function smExtractTime(toks,used){
  var amN=SM_AM_W.map(smNorm),pmN=SM_PM_W.map(smNorm),hourW=smNorm('الساعه');
  for(var i=0;i<toks.length;i++){
    if(used[i])continue;
    var mm=/^(\d{1,2})(?:[:.](\d{2}))?$/.exec(toks[i]);
    if(!mm)continue;
    var prev=(i>0&&!used[i-1])?toks[i-1]:'';
    var next=(i+1<toks.length&&!used[i+1])?toks[i+1]:'';
    var per=amN.indexOf(next)>-1?'am':(pmN.indexOf(next)>-1?'pm':null);
    var hasHourW=prev===hourW,hasMin=!!mm[2];
    if(!per&&!hasHourW&&!hasMin)continue;
    var h=parseInt(mm[1],10),m=mm[2]?parseInt(mm[2],10):0;
    if(h>23||m>59)continue;
    used[i]=1;
    if(hasHourW)used[i-1]=1;
    if(per)used[i+1]=1;
    if(per==='pm'&&h<12)h+=12;
    if(per==='am'&&h===12)h=0;
    if(!per&&h>=1&&h<=6)h+=12;
    return {h:h,m:m};
  }
  return null;
}
var SM_MONTHS=[['يناير',1],['فبراير',2],['مارس',3],['ابريل',4],['مايو',5],['يونيو',6],['يوليو',7],['اغسطس',8],['سبتمبر',9],['اكتوبر',10],['نوفمبر',11],['ديسمبر',12]];
/* يرجّع عدد الأيام من النهارده للتاريخ (أو null لو مفيش تاريخ) */
function smExtractDate(toks,used){
  var now=new Date(),ty=now.getFullYear(),tm=now.getMonth()+1,td=now.getDate();
  var todayUTC=Date.UTC(ty,tm-1,td);
  /* 1) تاريخ كامل: "٢٢ نوفمبر" أو "الاحد ٢٢ نوفمبر ٢٠٢٦" */
  var mi=-1,mon=0;
  for(var i=0;i<toks.length&&mi<0;i++){
    if(used[i])continue;
    for(var k=0;k<SM_MONTHS.length;k++){
      if(smNorm(SM_MONTHS[k][0])===toks[i]){mi=i;mon=SM_MONTHS[k][1];break;}
    }
  }
  if(mi>-1){
    var day=null,year=null,picked=[];
    [mi-1,mi+1,mi+2].forEach(function(j){
      if(j<0||j>=toks.length||used[j])return;
      var t=toks[j];
      if(day===null&&/^\d{1,2}$/.test(t)){day=parseInt(t,10);picked.push(j);}
      else if(year===null&&/^\d{4}$/.test(t)){year=parseInt(t,10);picked.push(j);}
    });
    if(day!==null&&day>=1&&day<=31){
      used[mi]=1;picked.forEach(function(j){used[j]=1;});
      var target=Date.UTC(year||ty,mon-1,day);
      return Math.round((target-todayUTC)/86400000);
    }
  }
  /* 2) كلمات زي النهارده وبكره واسم اليوم */
  var todayN=SM_TODAY_W.map(smNorm),tomN=SM_TOM_W.map(smNorm),tomW=smNorm('بكره'),afterW=smNorm('بعد');
  for(var i2=0;i2<toks.length;i2++){
    if(used[i2])continue;
    var t2=toks[i2];
    if(t2===afterW&&i2+1<toks.length&&!used[i2+1]&&toks[i2+1]===tomW){used[i2]=1;used[i2+1]=1;return 2;}
    if(todayN.indexOf(t2)>-1){used[i2]=1;return 0;}
    if(tomN.indexOf(t2)>-1){used[i2]=1;return 1;}
    for(var k2=0;k2<SM_WD.length;k2++){
      if(smNorm(SM_WD[k2][0])===t2){
        used[i2]=1;
        var off=(SM_WD[k2][1]-new Date().getDay()+7)%7;
        return off===0?7:off;
      }
    }
  }
  return null;
}
function smDay(off){
  var d=new Date();d.setDate(d.getDate()+off);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function smDayLabel(off,date){return off===0?'النهارده':off===1?'بكره':off===2?'بعد بكره':date;}
function smTimeLabel(time){var p=time.split(':'),h=parseInt(p[0],10);return ((h%12)||12)+':'+p[1]+' '+(h<12?'ص':'م');}
function smName(raw){
  var c=String(raw||'').replace(/^\s*(العميل|عميل|الاسم|اسم)\s*[:：\-]?\s*/,'').trim();
  if(!c)return '';
  if(/[0-9٠-٩۰-۹]/.test(c))return '';
  if(!/[\u0621-\u064Aa-zA-Z]/.test(c))return '';
  var words=c.split(/\s+/);
  if(words.length>4)return '';
  return c;
}
function smParseLine(raw,prods,tpls,ctx){
  var all=smTok(raw);
  var used={};
  var tm=smExtractTime(all,used);
  var off=smExtractDate(all,used);
  var toks=all.filter(function(_,k){return !used[k];});
  var res={raw:raw,kind:'none',qty:null,pack:'',pid:null,tid:null,count:1,cands:[],due:null,dueLabel:''};
  if(tm||off!==null){
    var date=off!==null?smDay(off):(ctx&&ctx.lastDue?ctx.lastDue.date:smDay(0));
    var time=tm?String(tm.h).padStart(2,'0')+':'+String(tm.m).padStart(2,'0'):(ctx&&ctx.lastDue?ctx.lastDue.time:'12:00');
    res.due=date+'T'+time;
    res.dueLabel=smDayLabel(off,date)+' '+smTimeLabel(time);
    if(ctx)ctx.lastDue={date:date,time:time};
  }
  /* 1) قالب علبة زي "علبة ٣٠ قطعة" */
  var bestT=null,bestLen=0;
  tpls.forEach(function(t){
    var nt=smTok(t.name);
    if(!nt.length)return;
    var used={},matched=0;
    nt.forEach(function(x){
      for(var k=0;k<toks.length;k++){
        if(!used[k]&&smEq(toks[k],x)){used[k]=1;matched++;break;}
      }
    });
    if(matched<nt.length)return;
    var rest=toks.filter(function(_,k){return !used[k];});
    var words=rest.filter(function(x){return !smIsNum(x)&&!SM_UNITS.some(function(u){return smEq(x,u);});});
    if(words.length)return;
    if(nt.length>bestLen){bestLen=nt.length;bestT=t;res.count=rest.filter(smIsNum).length?parseFloat(rest.filter(smIsNum)[0]):1;}
  });
  if(bestT){res.kind='tpl';res.tid=bestT.id;return res;}
  /* 2) صنف + تعبئة + كمية */
  var work=toks.slice();
  PACKS.forEach(function(pk){
    if(res.pack)return;
    var pt=smTok(pk),idx=-1;
    for(var i=0;i+pt.length<=work.length;i++){
      var ok=true;
      for(var j=0;j<pt.length;j++){if(!smEq(work[i+j],pt[j])){ok=false;break;}}
      if(ok){idx=i;break;}
    }
    if(idx>-1){res.pack=pk;work.splice(idx,pt.length);}
  });
  var qi=-1;
  for(var q=0;q<work.length;q++){if(smIsNum(work[q])){qi=q;break;}}
  if(qi>-1){res.qty=parseFloat(work[qi]);work.splice(qi,1);}
  work=work.filter(function(x){return !SM_UNITS.some(function(u){return smEq(x,u);});});
  if(!work.length){
    if(res.pack){res.kind='hdr';res.hq=res.qty;}
    return res;
  }
  var key=work.join(' ');
  var learned=(S.smartLearn&&S.smartLearn.alias)||{};
  if(learned[key]!=null){
    var hit=prods.filter(function(p){return p.id===learned[key];})[0];
    if(hit){
      res.pid=hit.id;res.learned=true;
      res.kind=res.qty==null?'noqty':'prod';
      return res;
    }
  }
  var scored=[];
  prods.forEach(function(p){
    var pt=smTok(p.name);
    if(!pt.length)return;
    var used={},qm=0;
    work.forEach(function(w){
      for(var k=0;k<pt.length;k++){
        if(!used[k]&&smEq(w,pt[k])){used[k]=1;qm++;break;}
      }
    });
    if(!qm)return;
    var pm=Object.keys(used).length;
    scored.push({pid:p.id,qm:qm,score:(qm/work.length)*0.8+(pm/pt.length)*0.2,full:qm===work.length});
  });
  var full=scored.filter(function(x){return x.full;}).sort(function(a,b){return b.score-a.score;});
  var pool=full.length?full:scored.filter(function(x){return x.qm/work.length>=0.5;}).sort(function(a,b){return b.score-a.score;});
  if(!pool.length)return res;
  var top=pool[0];
  var close=pool.filter(function(x){return x.score>=top.score-0.05;});
  if(close.length===1&&full.length){
    res.pid=top.pid;
    res.kind=res.qty==null?'noqty':'prod';
    return res;
  }
  res.kind='amb';
  res.key=key;
  res.cands=pool.slice(0,4).map(function(x){return x.pid;});
  return res;
}
function smParse(text,kind,season){
  var k=kind||'cust';
  /* نفس الأصناف اللي بتظهر في شاشة اختيار الأصناف (منتجات الحشو للموسم الحالي) */
  var prods=ordProdsOf(k).filter(function(p){return seasonOf(p)===(season||'normal');});
  var tpls=(S.boxTpl||[]).filter(function(t){return (t.kind||'cust')===k;});
  var grp=0,curPack='';
  var ctx={lastDue:null};
  return String(text||'').split(/\n+/).map(function(x){return x.trim();}).filter(Boolean)
    .map(function(raw){
      var r=smParseLine(raw,prods,tpls,ctx);
      if(r.kind==='none'){
        var nm=smName(raw);
        if(r.due)r.kind='due';
        else if(nm){r.kind='name';r.name=nm;}
      }
      if(r.kind==='tpl'){curPack='';return r;}
      if(r.kind==='hdr'){grp++;curPack=r.pack;r.grp=grp;return r;}
      if(r.pack){
        /* سطر فيه تعبئة صريحة بيبدأ مجموعة جديدة */
        grp++;curPack=r.pack;r.grp=grp;return r;
      }
      /* الصنف من غير تعبئة بيتحط في آخر تعبئة اتكتبت فوقه */
      if(curPack){r.pack=curPack;}
      r.grp=grp;
      return r;
    });
}
function smHTML(){
  var sm=U.smart,os=U.osheet||{};
  var h='<div class="fld"><span class="sec-l">اكتب الطلب بسرعة</span>'+
    '<textarea id="smartTxt" rows="3" placeholder="مثال: سرفيز براونيز ٣٠ قطعة&#10;علبة ٣٠ قطعة" style="width:100%;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--ink);padding:8px;font:inherit">'+esc(sm?sm.text:'')+'</textarea>'+
    '<div class="btns"><button class="btn ghost sm" data-act="oSmart">فهم الطلب</button></div>'+
    ((os.cust||os.due)?'<div class="meta" style="margin-top:6px">الأوردر الحالي: '+(os.cust?'العميل '+esc(os.cust):'')+(os.cust&&os.due?' · ':'')+(os.due?'المعاد '+esc(String(os.due).replace('T',' ')):'')+'</div>':'');
  if(sm&&sm.lines.length){
    var sums={};
    sm.lines.forEach(function(ln){if(ln.kind==='prod'&&ln.grp)sums[ln.grp]=r3((sums[ln.grp]||0)+ln.qty);});
    sm.lines.forEach(function(ln,i){
      var txt;
      if(ln.kind==='hdr'){
        var sum=sums[ln.grp]||0;
        txt='<b>'+esc(ln.pack)+'</b>'+(ln.hq!=null?' · '+f(ln.hq)+' قطعة':'')+
          ' <span class="meta">'+(sum?'· الأصناف '+f(sum)+(ln.hq==null||sum===ln.hq?' ✓':' (الهيدر '+f(ln.hq)+')'):'· ضيف تحته الأصناف')+'</span>';
      }else if(ln.kind==='prod'){
        var p=P(ln.pid)||{};
        txt='<b>'+esc(p.name||'')+'</b> · '+f(ln.qty)+' '+esc(p.unit||'')+(ln.pack?' · '+esc(ln.pack):'')+(ln.dueLabel?' · المعاد: '+esc(ln.dueLabel):'');
      }else if(ln.kind==='tpl'){
        var t=(S.boxTpl||[]).filter(function(x){return x.id===ln.tid;})[0];
        txt='<b>'+esc(t?t.name:'قالب')+'</b> · '+f(ln.count)+' علبة';
      }else if(ln.kind==='name'){
        txt='<b>العميل:</b> '+esc(ln.name);
      }else if(ln.kind==='due'){
        txt='<b>المعاد:</b> '+esc(ln.dueLabel);
      }else if(ln.kind==='noqty'){
        var p2=P(ln.pid)||{};
        txt='<b>'+esc(p2.name||'')+'</b> · مش لاقي الكمية، اكتب الرقم في السطر';
      }else if(ln.kind==='amb'){
        txt='<b>'+esc(ln.raw)+'</b><br>اختار الصنف: '+ln.cands.map(function(pid){
          return '<button class="btn ghost sm" data-act="oSmartPick" data-i="'+i+'" data-p="'+pid+'">'+esc((P(pid)||{}).name||'')+'</button>';
        }).join(' ');
      }else{
        txt='<b>'+esc(ln.raw)+'</b> · مش لاقي صنف بالاسم ده';
      }
      h+='<div class="hist" style="align-items:center"><span>'+txt+'</span><button class="btn ghost sm" data-act="oSmartDrop" data-i="'+i+'">×</button></div>';
    });
    var ready=sm.lines.some(function(ln){return ln.kind==='prod'||ln.kind==='tpl'||ln.kind==='name'||ln.kind==='due'||!!ln.due;});
    h+='<div class="btns"><button class="btn main" data-act="oSmartAdd"'+(ready?'':' disabled')+'>أضف اللي فهمته</button></div>';
  }
  return h+'</div>';
}
function smAddProd(os,pid,qty,bn){
  os.items=os.items||{};os.added=os.added||[];os.box=os.box||{};
  os.boxes=os.boxes||[{n:1,type:''}];
  if(os.split&&os.split[pid])delete os.split[pid];
  os.items[pid]=qty;
  os.box[pid]=bn;
  if(os.added.indexOf(pid)<0)os.added.push(pid);
}
function smAddTpl(os,t,count){
  os.items=os.items||{};os.added=os.added||[];os.split=os.split||{};
  os.boxes=os.boxes||[{n:1,type:''}];
  for(var k=0;k<count;k++){
    var mx=Math.max.apply(null,os.boxes.map(function(x){return x.n;}))+1;
    os.boxes.push({n:mx,type:t.name});
    t.items.forEach(function(i){
      os.items[i.p]=r3((os.items[i.p]||0)+i.q);
      if(os.added.indexOf(i.p)<0)os.added.push(i.p);
      os.split[i.p]=os.split[i.p]||{};
      os.split[i.p][mx]=r3((os.split[i.p][mx]||0)+i.q);
    });
  }
}
function ordSheetHTML(){
  if(!U.osheet)return '';
  var s=U.osheet;
  var items=PRODUCTS.map(function(p){return {p:p.id,qty:s.items[p.id]||0};}).filter(function(x){return x.qty>0;});
  var any=items.length>0;
  var seasonP=ordProdsOf(s.kind).filter(function(p){return seasonOf(p)===(s.season||'normal');});
  var addedIds=(s.added||[]).filter(function(id){return seasonP.some(function(p){return p.id===id;});});
  var addedP=addedIds.map(function(id){return seasonP.filter(function(p){return p.id===id;})[0];});
  var open='<button class="back" data-act="oClose" aria-label="إغلاق"></button><section class="sheet f" style="--c:var(--orders)" role="dialog" aria-label="طلبية جديدة"><div class="sbody">';
  var sel='style="width:100%;height:40px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--ink);padding:0 6px;font-size:14px;margin-top:6px"';
  if(s.step==='pick'){
    var gkeys=[];seasonP.forEach(function(p){var k=p.grp||'__none';if(gkeys.indexOf(k)<0)gkeys.push(k);});
    var curTab=(U.oTab==='__all'||gkeys.indexOf(U.oTab)>-1)?U.oTab:'__all';
    var tabs=[['__all','الكل']].concat(gkeys.map(function(k){return [k,k==='__none'?'بدون مجموعة':k];}));
    var loopT=tabs.length>1;var chipsT='';
    (loopT?[0,1,2,3,4]:[2]).forEach(function(cp){tabs.forEach(function(t){var on=curTab===t[0];chipsT+='<button class="cv-c'+(on&&cp===2?' mid':'')+'" role="tab" aria-selected="'+on+'" data-act="oTab" data-v="'+esc(t[0])+'">'+esc(t[1])+'</button>';});});
    
    var cardOf=function(p){
      var on=addedIds.indexOf(p.id)>=0;
      var stkTxt='<small>المتاح: '+f(S.ready[p.id]||0)+' '+esc(p.unit)+'</small>';
      if(!on)return '<button class="pk" data-act="oPick" data-p="'+p.id+'">'+esc(p.name)+stkTxt+'</button>';
      var q=s.items[p.id]||0;
      return '<div class="pk on" style="--c:var(--orders);cursor:default">'+
        '<div class="opk-h"><b>'+esc(p.name)+'</b><button class="ox" data-act="oPick" data-p="'+p.id+'" aria-label="شيل الصنف">×</button></div>'+
        stkTxt+
        '<div class="opk-q"><input type="text" inputmode="'+qIM(p)+'" data-oq="'+p.id+'" value="'+(q>0?q:'')+'" placeholder="0" aria-label="الكمية"><span>'+esc(p.unit)+'</span></div>'+
        '</div>';
    };
    var grid=gkeys.map(function(k){
      var list=seasonP.filter(function(p){return (p.grp||'__none')===k;});
      return '<div class="grp" style="margin-top:12px">'+(k==='__none'?'بدون مجموعة':esc(k))+' ('+list.length+')</div>'+
        '<div class="pkgrid">'+list.map(cardOf).join('')+'</div>';
    }).join('');
    return open+'<h3>اختار الأصناف</h3><div class="meta">اختار الأصناف اللي في الطلبية، وبعد كده اضغط "تم"</div>'+
      smHTML()+
      '<div class="fld"><span class="sec-l">الأصناف'+(addedIds.length?' <span class="pill c">'+addedIds.length+' صنف</span>':'')+'</span>'+
      (seasonP.length?grid:'<div class="meta">مفيش أصناف متاحة في الموسم ده.</div>')+'</div>'+
      '<div class="sfoot"><button class="btn main" data-act="oDone"'+(addedIds.length?'':' disabled')+'>تم</button><button class="btn ghost" data-act="oClose">إلغاء</button></div></div></section>';
  }
  var rows=addedP.map(function(p){
    var q=s.items[p.id]||0,bx=boxOf(s,p.id),pk=boxTypeOf(s,bx);
    return '<div class="hist" style="align-items:center"><span><b>'+esc(p.name)+'</b> <span class="meta">· '+(q>0?f(q)+' '+p.unit:'بدون كمية')+' · تعبئة '+bx+(pk?' · '+esc(pk):'')+'</span></span></div>';
  }).join('');
  return open+'<h3>طلبية جديدة</h3>'+
    '<div class="fld"><label for="oc">'+(s.kind==='shop'?'اسم المحل':'اسم العميل')+'</label><input id="oc" data-oc="1" value="'+esc(s.cust)+'" placeholder="اسم العميل" autocomplete="off"></div>'+
    '<div class="fld"><label for="od">معاد التسليم (تاريخ وساعة)</label><input id="od" data-od="1" type="datetime-local" step="3600" value="'+esc(s.due||'')+'"></div>'+
    '<div class="fld"><label for="onote">ملاحظة (اختياري)</label><textarea id="onote" data-onote="1" rows="2" placeholder="مثال: بدون سكر، توصيل للبيت" style="width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:8px;font:inherit;background:var(--surface-2);color:var(--ink)">'+esc(s.note||'')+'</textarea></div>'+
     boxesEditorHTML(s)+
    '<div class="fld"><span class="sec-l">الأصناف المختارة'+(addedIds.length?' <span class="pill c">'+addedIds.length+' صنف</span>':'')+'</span>'+
      (rows||'<div class="meta">مفيش أصناف مختارة</div>')+
      '<div class="btns"><button class="btn ghost sm" data-act="oBack">تعديل الأصناف</button></div></div>'+
    '<div class="sfoot"><button class="btn main" data-act="oCreate"'+(any?'':' disabled')+'>'+(s.edit?'احفظ التعديل':'أنشئ الطلبية')+'</button><button class="btn ghost" data-act="oClose">إلغاء</button></div></div></section>';
}



/* ---------- actions ---------- */
function lockSettings(){try{sessionStorage.removeItem('khat-set-ok');}catch(e){}U.sBioTried=false;}
function go(v){if(!routeAllowed(v)){toast('مش مسموح لك تفتح القسم ده');v='home';}if(U.view==='settings'&&v!=='settings')lockSettings();U.view=v;U.rsearch='';try{location.hash=v;}catch(e){}window.scrollTo(0,0);}
function toggle(a,i){a=(a||[]).slice();var k=a.indexOf(i);if(k>-1)a.splice(k,1);else a.push(i);return a;}
function blankIng(){return {m:null,n:'',q:'',u:'جرام'};}
function mkStage(kind,name){return {kind:kind,name:name||'',ings:[],steps:['']};}

function hiddenTabs(){return pref('tabsHidden',[]);}
/* صلاحيات التعديل: كل قسم مربوط بالمجموعة اللي بيتخزن فيها في الملف المشترك */
var SECTION_COLL={orders:['orders'],calendar:['orders'],shopOrders:['orders'],reserved:['batches'],prep:['batches'],prod:['batches'],fgstock:['done'],stock:['materials'],recipes:['products'],shopProducts:['products'],filling:['products'],prepreq:['products'],waste:['waste']};
var PROT_COLLS=['orders','batches','done','products','materials','waste'];
function viewNoteHTML(){if(!limited()||canEditView())return '';return '<div class="note" role="status">الصفحة دي للعرض بس: أي تعديل فيها مش هيتحفظ</div>';}
function snapOf(s){return JSON.parse(JSON.stringify(s));}
/* الموظف: الأقسام اللي مش مسموحله يرجع فيها لآخر نسخة من درايف، والإعدادات والمستخدمين والصلاحيات بتفضل زي ما هي عند المالك */
function guardState(local,snap){
  if(!limited()||!snap)return local;
  var out=Object.assign({},local);
  PROT_COLLS.forEach(function(c){if(!canEditColl(c))out[c]=JSON.parse(JSON.stringify(snap[c]||[]));});
  out.users=JSON.parse(JSON.stringify(snap.users||[]));
  var p=Object.assign({},local.prefs||{}),sp=snap.prefs||{};
  ['tabsHidden','perms','aperms','pw'].forEach(function(k){p[k]=sp[k];});
  out.prefs=p;
  return out;
}
function sPwStored(){return pref('pw',null);}
function sUnlocked(){try{return sessionStorage.getItem('khat-set-ok')==='1';}catch(e){return false;}}
function hexPbkdf2(p,salt,iter){
  var enc=new TextEncoder();
  return crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']).then(function(key){
    return crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:iter,hash:'SHA-256'},key,256);
  }).then(function(bits){return Array.from(new Uint8Array(bits)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');});
}
function randHex(){var a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a).map(function(b){return b.toString(16).padStart(2,'0');}).join('');}
function saveSettingsPw(p){
  var salt=randHex(),iter=200000;
  return hexPbkdf2(p,salt,iter).then(function(h){setPref('pw',{salt:salt,hash:h,iter:iter});});
}
function pwField(id,label,ac){return '<div class="fld"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="'+ac+'"></div>';}
/* جدول التبويبات والصلاحيات: كل الأقسام والأجزاء اللي جوه التطبيق مرتبة في مجموعات */
var PERM_GROUPS=[
  {l:'الأوردرات',rows:[
    {k:'orders',l:'أوردرات',d:'طلبات العملاء: تسجيلها ومتابعتها وطباعتها'},
    {k:'shopOrders',l:'أوردرات المحل',d:'طلبات المحل: تسجيلها ومتابعتها'},
    {k:'reserved',l:'تحت التشغيل',d:'الطلبات المحجوزة لإنتاج'},
     {k:'calendar',l:'التقويم',d:'الأيام المحجوزة بالأوردرات ومراجعة الحفلات في كل يوم'}
  ]},
  {l:'الإنتاج',rows:[
    {k:'prep',l:'تحضير',d:'الدفعات، حساب الخامات، وخطوات التجهيز'},
    {k:'prod',l:'إنتاج',d:'تشغيل الدفعات والمؤقت وسجل الإنتاج'},
    {k:'prepreq',l:'تحضيرات مطلوبة',d:'المكونات الوسيطة اللازمة لإعادة إنتاج النواقص'},
    {k:'filling',l:'تحضير حشو',d:'الأصناف المحشوة',sub:[
      {k:'fillrun',l:'تسجيل إنتاج جديد',d:'تشغيل صنف محشو موجود من مخزن الإنتاج'},
      {k:'filladd',l:'إضافة أصناف جديدة',d:'اعمل صنف محشو جديد بكود جديد'}
    ]}
  ]},
  {l:'المخازن',rows:[
    {k:'stock',l:'مكوّنات',d:'تعريف المكوّنات المستخدمة في الوصفات'},
    {k:'fgstock',l:'مخزن الإنتاج',d:'الكميات الجاهزة والنواقص'},
     {k:'tracking',l:'تتبع الصلاحية',d:'الأصناف اللي تحتاج تغيير أو تأكيد تاريخ الصلاحية'},
    {k:'waste',l:'هالك',d:'تسجيل عمليات الهالك'}
  ]},
  {l:'الوصفات',rows:[
    {k:'recipes',l:'وصفات',d:'إضافة الوصفات وتعديلها واستيرادها وتصديرها'},
    {k:'shopProducts',l:'وصفات المحل',d:'وصفات المحل'}
  ]},
  {l:'أدوات التطبيق',rows:[
    {k:'verify',l:'التحقق من البطاقة',d:'عرض: الموظف يشوف كارته بس · يعدّل: يفتح الكاميرا ويتحقق من كروت الموظفين'},
    {k:'refresh',l:'زرار التحديث',d:'تحديث البيانات من درايف'},
    {k:'theme',l:'الوضع الليلي والنهاري',d:'تغيير شكل التطبيق'},
    {k:'sync',l:'شاشة المزامنة',d:'عرض: يشوف حالة المزامنة والأجهزة · يعدّل: يشغّل المزامنة الآن'},
    {k:'approve',l:'اعتماد الإنتاج',d:'اعتماد الدفعات بعد انتهاء الوقت',fixed:true},
    {k:'settings',l:'الإعدادات',d:'صفحة الإعدادات كلها',fixed:true}
  ]}
];
var PERM_OWNER_ONLY=[
  {l:'مواعيد العمل',d:'ساعات فتح التطبيق لكل يوم'},
  {l:'إدارة المستخدمين',d:'إضافة المستخدمين وتعديلهم وأكوادهم وإجازاتهم'},
  {l:'التبويبات والصلاحيات',d:'لوحة الصلاحيات دي'},
  {l:'المواسم',d:'إظهار وإخفاء المواسم في الأوردرات'},
  {l:'الـ PIN والقفل',d:'تغيير رقم الإعدادات وقفلها'},
  {l:'سجل الإنتاج',d:'عرض سجل الإنتاج وحذفه'},
  {l:'قفل الشهور',d:'قفل الشهور وإدارة الأرشيف وتحميل PDF'},
  {l:'النسخ الاحتياطي',d:'تصدير واستيراد البيانات'},
  {l:'درايف',d:'ربط حساب جوجل درايف والمزامنة'},
  {l:'تثبيت التطبيق',d:'تثبيت التطبيق على الجهاز'}
];

/* ===== لوحة الصلاحيات ===== */
var DEFAULT_PERMS={prep:'edit',prod:'edit',refresh:'view',theme:'view'};
var PERM_LV=[['none','لا يرى'],['view','يعرض'],['edit','يعدّل']];
function permCatalog(){
  var out=[];
  PERM_GROUPS.forEach(function(g){
    g.rows.forEach(function(t){
      out.push({k:t.k,l:t.l,d:t.d,g:g.l,fixed:!!t.fixed});
      (t.sub||[]).forEach(function(s){out.push({k:s.k,l:s.l,d:s.d,g:g.l,fixed:!!s.fixed});});
    });
  });
  return out;
}
function permsOf(code){
  var p=pref('perms',{})[code];
  return (p&&typeof p==='object')?p:DEFAULT_PERMS;
}
function permSaveFor(code,obj){var m=Object.assign({},pref('perms',{}));m[code]=obj;setPref('perms',m);}
function permLevel(k){
  if(!limited())return 'edit';
  return permsOf(sessionCode())[k]||'none';
}
function canUse(k){return permLevel(k)!=='none';}
function tabHidden(k){
  if(limited())return !canUse(k);
  if(k==='settings')return false;
  return hiddenTabs().indexOf(k)>-1;
}
function routeAllowed(v){
  if(!v||v==='home')return true;
  if(!limited())return true;
  return canUse(v);
}
function canWrite(){
  if(!authed())return false;
  if(!limited())return true;
  var v=U.view||'home';
  if(v==='home')return false;
  return permLevel(v)==='edit';
}
function canEditView(){return canWrite();}
function canEditColl(c){
  if(!limited())return true;
  return Object.keys(SECTION_COLL).some(function(k){return SECTION_COLL[k].indexOf(c)>-1&&permLevel(k)==='edit';});
}
function canApprove(){return canUse('approve');}
var PERM_PRESET_DEF={
  all:function(cat){var o={};cat.forEach(function(x){o[x.k]='edit';});return o;},
  view:function(cat){var o={};cat.forEach(function(x){o[x.k]=x.k==='approve'?'none':'view';});return o;},
  prod:function(){return {prep:'edit',prod:'edit',stock:'view',fgstock:'view',refresh:'view',theme:'view'};},
  none:function(){return {};}
};
function permSegHTML(uid,k,cur,ap){
  var opts=ap?[['none','لا'],['edit','يعتمد']]:PERM_LV;
  return '<div class="pseg" role="group" aria-label="الصلاحية">'+opts.map(function(o){
    var on=cur===o[0];
    return '<button class="pseg-b'+(on?' on '+o[0]:'')+'" data-act="permSet" data-u="'+esc(uid)+'" data-k="'+k+'" data-lv="'+o[0]+'" aria-pressed="'+on+'">'+o[1]+'</button>';
  }).join('')+'</div>';
}
/* قوالب محفوظة: بتحفظ صلاحيات التبويبات + الإجراءات لأي مستخدم، وتتطبق على أي مستخدم تاني بضغطة */
function savedTplsHTML(sel){
  var tpls=pref('savedPermTpls',[])||[];
  var items=tpls.map(function(t){
    return '<button class="btn ghost sm" data-act="permTplApply" data-u="'+esc(sel.id)+'" data-t="'+esc(t.id)+'">'+esc(t.name)+'</button>'+
      '<button class="btn ghost sm" data-act="permTplDel" data-t="'+esc(t.id)+'" aria-label="حذف القالب">×</button>';
  }).join('');
  return '<div class="ppresets"><span class="meta">قوالبي المحفوظة:</span>'+(items||'<span class="meta">مفيش قوالب لسه</span>')+
    '<button class="btn sm" data-act="permTplSave" data-u="'+esc(sel.id)+'">احفظ صلاحيات '+esc(sel.name||sel.code)+' كقالب</button></div>';
}
function permsCardHTML(){
  if(limited())return '';
  var head='<h3>الصلاحيات</h3>';
  var users=usersList();
  if(!users.length)return '<section class="card perms" style="--c:var(--settings)">'+head+'<p class="meta">ضيف مستخدم الأول من "إدارة المستخدمين"، وبعدين حدد صلاحياته هنا.</p></section>';
  var sel=users.filter(function(u){return u.id===U.permUser;})[0]||users[0];
  var cat=permCatalog(), p=permsOf(sel.code);
  var cnt={none:0,view:0,edit:0};
  cat.forEach(function(x){cnt[p[x.k]||'none']++;});
  var chips=users.map(function(u){
    var on=u.id===sel.id;
    return '<button class="pchip-u'+(on?' on':'')+'" data-act="permSel" data-id="'+esc(u.id)+'" aria-pressed="'+on+'"><span class="puava">'+esc((u.name||'?').charAt(0))+'</span>'+esc(u.name||u.code)+'</button>';
  }).join('');
  var presets=[['all','يعدّل كل حاجة'],['view','يعرض بس'],['prod','موظف إنتاج'],['none','امسح الكل']].map(function(x){
    return '<button class="btn ghost sm" data-act="permPreset" data-u="'+esc(sel.id)+'" data-p="'+x[0]+'">'+x[1]+'</button>';
  }).join('');
  var rows=PERM_GROUPS.map(function(g){
    var items=[];
    g.rows.forEach(function(t){items.push(t);(t.sub||[]).forEach(function(s){items.push(s);});});
    return '<div class="pgrp"><div class="pgrp-h">'+esc(g.l)+'</div>'+items.map(function(t){
      return '<div class="prow"><div class="pinfo"><b>'+esc(t.l)+'</b>'+(t.d?'<small>'+esc(t.d)+'</small>':'')+'</div>'+
        permSegHTML(sel.id,t.k,p[t.k]||'none',t.k==='approve')+'</div>';
    }).join('')+'</div>';
  }).join('');
  var lockedChips=PERM_OWNER_ONLY.map(function(o){return '<span class="pchip-lock">'+esc(o.l)+'</span>';}).join('');
  var hidden=hiddenTabs();
  var ownChips=cat.filter(function(x){return !x.fixed;}).map(function(x){
    var hid=hidden.indexOf(x.k)>-1;
    return '<button class="pchip'+(hid?' off':'')+'" data-act="toggleTab" data-k="'+x.k+'">'+(hid?'مخفي':'ظاهر')+' · '+esc(x.l)+'</button>';
  }).join('');
  return '<section class="card perms" style="--c:var(--settings)">'+head+
    '<p class="meta" style="margin:0">اختار المستخدم، وحدد لكل قسم: لا يرى، أو يعرض، أو يعدّل. أي تغيير بيتحفظ فورًا وبيتطبق عند دخول المستخدم.</p>'+
    '<div class="pusers">'+chips+'</div>'+
    '<div class="pstats"><div><b>'+cnt.edit+'</b><small>يعدّل</small></div><div><b>'+cnt.view+'</b><small>يعرض</small></div><div><b>'+cnt.none+'</b><small>لا يرى</small></div></div>'+
    '<div class="ppresets"><span class="meta">قوالب جاهزة لـ '+esc(sel.name||sel.code)+':</span>'+presets+'</div>'+
    savedTplsHTML(sel)+
    rows+permActsHTML(sel)+
    '<div class="pgrp"><div class="pgrp-h">المالك بس</div><div class="pchips">'+lockedChips+'</div></div>'+
    '<div class="pgrp"><div class="pgrp-h">إخفاء من قائمتك انت (المالك)</div><div class="pchips">'+ownChips+'</div></div>'+
    '</section>';
}
PERM_GROUPS.push({l:'أقسام إضافية',rows:[{k:'boxes',l:'العلب',d:'تعبئة العلب والقوالب'},{k:'boxcomp',l:'تجميع علب',d:'حساب الخامات لكل علبة وتعديل الأصناف والأعداد'}]});

/* ===== صلاحيات الإجراءات داخل التبويبات ===== */
var PERM_SEC_LABEL={orders:'الأوردرات',calendar:'التقويم',prep:'التحضير',prod:'الإنتاج',stock:'الخامات',fgstock:'مخزن الإنتاج',tracking:'تتبع الصلاحية',waste:'الهالك',recipes:'الوصفات',filling:'تحضير الحشو',prepreq:'تحضيرات مطلوبة',boxes:'العلب',boxcomp:'تجميع علب',approve:'اعتماد الإنتاج',settings:'الإعدادات'};
/* إجراءات النظام: دايمًا متاحة (دخول، خروج، البصمة، الإشعارات، التحديث، التنقل) */
var ACT_SYS={gdSetHint:1,toggleOwnerOnly:1,syncEvery:1,login:1,padKey:1,padMode:1,cardOffClose:1,logout:1,bioEnableAct:1,bioGo:1,bioLater:1,settingsBio:1,settingsSubmit:1,sCancel:1,notifAsk:1,notifLater:1,install:1,loaderRetry:1,resetOpen:1,resetBack:1,resetSend:1,resetApprove:1,resetReject:1,deepRefresh:1,theme:1,tab:1,sTab:1,gdConnect:1,gdNow:1,gdOff:1,permSel:1,permSet:1,evOpen:1,evBack:1,syncOpen:1,syncClose:1,syncNow:1,permPreset:1,permSec:1,permActSet:1,permActAll:1,toggleTab:1,updStart:1,updFinish:1,updAdd:1,updDel:1,updGo:1,updClose:1,updSeen:1,updSeenTop:1,uGenCode:1,stripGo:1};
/* كل إجراء داخل التبويبات: [القسم، الاسم، w = بيغيّر بيانات / r = عرض أو تحكم في الشاشة] */
var ACT_CAT={trkOk:['tracking','تأكيد تاريخ الصلاحية','w'],trkOff:['tracking','إخفاء صنف من تتبع الصلاحية','w'],trkFilter:['tracking','فلتر التتبع','r'],trkLoc:['tracking','مكان التخزين في التتبع','r'],
  calEditOrder:['orders','تعديل من التقويم','w'],
  newOrder:['orders','أوردر جديد','w'],oEdit:['orders','تعديل الطلبية','w'],oCancel:['orders','إلغاء الطلبية','w'],
  oDelete:['orders','حذف الطلبية','w'],oDeliver:['orders','تسليم الأوردر','w'],oCreate:['orders','حفظ الأوردر','w'],
  oDone:['orders','تم (إنهاء التعديل)','w'],oBack:['orders','تعديل أصناف الأوردر','w'],oPick:['orders','إضافة صنف للأوردر','w'],oSmart:['orders','الطلب الذكي','w'],oSmartPick:['orders','الطلب الذكي','w'],oSmartDrop:['orders','الطلب الذكي','w'],oSmartAdd:['orders','الطلب الذكي','w'],
  resTick:['orders','تأكيد تحت التشغيل','w'],printOrder:['orders','طباعة الطلبية','r'],printAllOrders:['orders','تصدير الأوردرات PDF','r'],
  oToggle:['orders','فتح تفاصيل الطلبية','r'],oTab:['orders','تبويب داخل الأوردر','r'],oClose:['orders','إغلاق نافذة الأوردر','r'],
  newBatch:['prep','دفعة تحضير جديدة','w'],prepBatches:['prep','إنشاء دفعات التحضير','w'],withdraw:['prep','سحب خامات','w'],
  groupWithdraw:['prep','سحب مجمّع','w'],toProd:['prep','تحويل الدفعة للإنتاج','w'],cancel:['prep','إلغاء الدفعة','w'],
  batchSuggestApply:['prep','تطبيق الدفعات المقترحة','w'],matPick:['prep','اختيار خامة مقترحة','w'],
  goStock:['prep','فتح المخزن','r'],exportBatchMats:['prep','تصدير الخامات PDF','r'],prepTabSet:['prep','تبويب التحضير','r'],
  startRun:['prod','بدء التشغيل','w'],skipTimer:['prod','إنهاء المؤقت الآن','w'],sheetCreate:['prod','إنشاء دفعة إنتاج','w'],
  lotZero:['prod','تصفير الدفعات','w'],testAlarm:['prod','تجربة الصوت','r'],stopAlarm:['prod','إيقاف المنبه','r'],
  sheetProd:['prod','اختيار منتج للإنتاج','r'],sheetSeason:['prod','اختيار موسم الدفعة','r'],sheetQty:['prod','كمية الإنتاج','r'],sheetClose:['prod','إغلاق نافذة الإنتاج','r'],
  fgZero:['fgstock','تصفير المخزن','w'],fgDel:['fgstock','حذف من المخزن','w'],fgSelAll:['fgstock','تحديد الكل','r'],
  printerPair:['settings','ربط الطابعة','w'],printerForget:['settings','فك ربط الطابعة','w'],printerMethod:['settings','طريقة الطباعة الافتراضية','w'],
  lblOpen:['fgstock','طباعة ملصق','r'],lblOpenSel:['fgstock','طباعة ملصقات محددة','r'],lblClose:['fgstock','إغلاق الملصقات','r'],lblPick:['fgstock','اختيار ملصق','r'],lblMethod:['fgstock','طريقة الطباعة','r'],lblPaper:['fgstock','حجم الورق','r'],bcStep:['boxcomp','تغيير عدد العلب (+ و −)','w'],bcAdd:['boxcomp','إضافة صنف للعلبة','w'],bcDel:['boxcomp','حذف صنف من العلبة','w'],bcEdit:['boxcomp','فتح صفحة تعديل العلبة (الترس)','r'],bcSeason:['boxcomp','تغيير الموسم (مولد النبي، رمضان...)','r'],bcPdfBox:['boxcomp','استخراج PDF لتركيبة العلبة','r'],bcPdfTotal:['boxcomp','استخراج PDF لمجموع الكل','r'],bcSaveDraft:['boxcomp','حفظ تعديلات العلبة','w'],bcCancelDraft:['boxcomp','الرجوع من التعديل بدون حفظ','r'],bcQStep:['boxcomp','تغيير كمية الصنف في العلبة (+ و −)','w'],bcNew:['boxcomp','إضافة علبة جديدة','w'],bcDelType:['boxcomp','حذف العلبة كلها','w'],lblCopies:['fgstock','عدد النسخ','r'],lblPrint:['fgstock','طباعة الملصقات','r'],
  fgSel:['fgstock','تحديد صنف','r'],fgClear:['fgstock','إلغاء التحديد','r'],fgFilter:['fgstock','فلتر المخزن','r'],
  fgSeason:['fgstock','موسم المخزن','r'],toggleFgHide:['fgstock','إخفاء/إظهار صنف','r'],fgGrpOpen:['fgstock','فتح مجموعة','r'],
  newMat:['stock','مكوّن جديد','w'],editMat:['stock','تعديل مكوّن','w'],recv:['stock','استلام خامة','w'],
  recvOk:['stock','تأكيد الاستلام','w'],recvClose:['stock','إلغاء الاستلام','r'],filter:['stock','فلتر الخامات','r'],
  toggleMat:['prep','تعليم خامة في التحضير','w'],groupMat:['prep','تعليم خامة للمجموعة','w'],
  wasteAdd:['waste','تسجيل هالك','w'],wasteToggle:['waste','فتح تفاصيل الهالك','r'],wasteFilter:['waste','فلتر الهالك','r'],
  wasteGrpOpen:['waste','فتح مجموعة الهالك','r'],
  newProd:['recipes','وصفة جديدة','w'],editProd:['recipes','تعديل وصفة','w'],copyProd:['recipes','نسخ وصفة','w'],
  formSave:['recipes','حفظ الوصفة','w'],formDelete:['recipes','حذف الوصفة','w'],formClose:['recipes','إغلاق نموذج الوصفة','r'],
  recImport:['recipes','استيراد الوصفات','w'],recExport:['recipes','تصدير الوصفات','r'],rpOpen:['recipes','طباعة الوصفات','r'],
  rpPrint:['recipes','تنفيذ طباعة الوصفات','r'],rpAll:['recipes','تحديد الكل للطباعة','r'],rpNone:['recipes','إلغاء تحديد الطباعة','r'],
  rpToggle:['recipes','تحديد وصفة للطباعة','r'],rpClose:['recipes','إغلاق الطباعة','r'],
  stAdd:['recipes','إضافة مرحلة','w'],stDel:['recipes','حذف مرحلة','w'],stMove:['recipes','ترتيب مرحلة','w'],
  stepAdd:['recipes','إضافة خطوة','w'],stepDel:['recipes','حذف خطوة','w'],ingAdd:['recipes','إضافة مكوّن للوصفة','w'],
  ingDel:['recipes','حذف مكوّن من الوصفة','w'],compAdd:['recipes','إضافة وصفة فرعية','w'],compDel:['recipes','حذف وصفة فرعية','w'],
  altAdd:['recipes','إضافة بديل','w'],altDel:['recipes','حذف بديل','w'],prodKind:['recipes','نوع الصنف','r'],
  rQty:['recipes','تعديل كمية الوصفة','r'],rSet:['recipes','تعيين كمية الوصفة','r'],
  fillMake:['filling','اعمل الصنف المحشو','w'],fillEdit:['filling','تعديل صنف حشو','w'],feToggle:['filling','تعديل صنف حشو','w'],feAdd:['filling','تعديل صنف حشو','w'],feRemove:['filling','تعديل صنف حشو','w'],feSave:['filling','تعديل صنف حشو','w'],feCancel:['filling','تعديل صنف حشو','r'],fillTab:['filling','تبويب الحشو','r'],fillSel:['filling','اختيار صنف حشو','r'],
  fillKind:['filling','نوع الحشو','r'],fillSeason:['filling','موسم الحشو','r'],fillUnit:['filling','وحدة الحشو','r'],
  runDo:['prepreq','تنفيذ الحشو','w'],runMakeBatches:['prepreq','إنشاء دفعة بالنواقص','w'],runPick:['prepreq','اختيار صنف للتشغيل','r'],fillFromShort:['filling','نواقص الحشو','r'],
  boxAdd:['boxes','تعبئة جديدة','w'],boxDel:['boxes','حذف تعبئة','w'],boxOrder:['boxes','طلب تعبئة كأوردر','w'],
  tplAdd:['boxes','إضافة قالب','w'],tplAddAll:['boxes','إضافة قالب','w'],tplSel:['boxes','اختيار علبة','w'],boxOrderSel:['boxes','طلب علب كأوردر','w'],tplDel:['boxes','حذف قالب','w'],tplRemove:['boxes','إزالة من القالب','w'],tplSave:['boxes','حفظ القالب','w'],
  approve:['approve','اعتماد الدفعة','w'],
  userAdd:['settings','إضافة مستخدم','w'],userDel:['settings','حذف مستخدم','w'],userEditOpen:['settings','تعديل مستخدم','w'],
  userEditSave:['settings','حفظ تعديلات المستخدم','w'],userLeave:['settings','إجازة مستخدم','w'],userLeaveClear:['settings','مسح فترة الإجازة','w'],weekMoveClear:['settings','مسح تأجيل الإجازة','w'],
  userHoursToggle:['settings','ساعات المستخدم','w'],hrToggle:['settings','ساعات العمل','w'],cardsExport:['settings','تصدير الكروت','r'],cardsImport:['settings','استيراد الكروت','w'],userCardToggle:['settings','تفعيل/إيقاف الكارت','w'],
  exportBackup:['settings','تنزيل نسخة احتياطية','r'],importBackup:['settings','استيراد نسخة احتياطية','w'],
  lockMonth:['settings','قفل الشهر','w'],monthDelArchive:['settings','حذف أرشيف شهر','w'],monthPdf:['settings','تصدير الشهر PDF','r'],
  archDel:['settings','حذف الأرشيف','w'],toggleSeason:['settings','إظهار/إخفاء موسم','w'],
  plAll:['settings','تحديد سجل الإنتاج','w'],plToggle:['settings','تحديد سجل إنتاج','w'],plDel:['settings','حذف سجل الإنتاج','w'],
  calDay:['calendar','فتح يوم في التقويم','r'],calMode:['calendar','تغيير عرض التقويم','r'],calStep:['calendar','تنقل في التقويم','r'],calGoDay:['calendar','فتح يوم في التقويم','r'],calNav:['calendar','تنقل بين الشهور','r'],calToday:['calendar','الرجوع لليوم الحالي','r'],calClose:['calendar','إغلاق نافذة اليوم','r'],
  cleanStart:['stock','بدء تفريغ المخزن','w'],
  uFilter:['settings','فلترة المستخدمين','r'],evUser:['settings','فلترة الأحداث','r'],evMore:['settings','عرض أحداث أكتر','r'],evPrint:['settings','طباعة الأحداث','r'],uSort:['settings','ترتيب المستخدمين','r'],userEditCancel:['settings','إلغاء تعديل المستخدم','r'],
  sChangeStart:['settings','تغيير الـ PIN','w'],sLock:['settings','قفل الإعدادات','w']
};
function actAllowed(act){
  if(!limited())return true;
  if(BC_WRITE_ACTS.indexOf(act)>-1&&!bcCanEditSeason())return false;
  if(ACT_SYS[act])return true;
  if(!authed())return false;
  var o=(pref('aperms',{})[sessionCode()])||{};
  if(o[act]==='on')return true;
  if(o[act]==='off')return false;
  if(BC_WRITE_ACTS.indexOf(act)>-1&&seasonLevel(bcSeasonCur().id)==='edit')return true;
  var def=ACT_CAT[act];
  if(!def)return canWrite();
  var lvl=permLevel(def[0]);
  return def[2]==='w'?lvl==='edit':lvl!=='none';
}
/* إجراءات بتتعدى الفحص: النظام، وأي إجراء عرض مش مسجل في جدول الصلاحيات. الباقي كله بيتفحص حسب صلاحيته */
function actBypass(a){return !!(ACT_SYS[a]||(READ_ACTS[a]&&!ACT_CAT[a]));}
/* بنخفي الزراير اللي الإجراء بتاعها ممنوع، ونعلّم باقي العناصر */
function applyActGuards(){
  if(!limited())return;
  document.querySelectorAll('[data-act]').forEach(function(el){
    var a=el.getAttribute('data-act');
    if(actBypass(a))return;
    if(actAllowed(a))return;
    el.setAttribute('data-denied','1');
    if(el.tagName==='BUTTON')el.style.display='none';
  });
}
/* كل التبويبات اللي ليها صلاحية في الجدول فوق، بنفس الترتيب والأسامي */
function permTabList(){
  var out=[];
  PERM_GROUPS.forEach(function(g){
    g.rows.forEach(function(t){
      out.push({k:t.k,l:t.l,g:g.l});
      (t.sub||[]).forEach(function(s){out.push({k:s.k,l:s.l,g:g.l+' · '+t.l});});
    });
  });
  return out;
}
/* تبويبات ليها إجراءات بتتبع تبويب تاني، أو مفيش ليها إجراءات منفصلة */
var PERM_TAB_ALIAS={shopOrders:'orders',reserved:'orders',shopProducts:'recipes',fillrun:'filling',filladd:'filling'};
function permActsHTML(sel){
  var tabs=permTabList();
  var curTab=(U.permSec&&tabs.filter(function(t){return t.k===U.permSec;}).length)?U.permSec:'orders';
  var key=PERM_TAB_ALIAS[curTab]||curTab;
  var o=(pref('aperms',{})[sel.code])||{};
  var chips='<select class="permSecSel" data-permsec="1" aria-label="اختار التبويب">'+tabs.map(function(t){return '<option value="'+t.k+'"'+(t.k===curTab?' selected':'')+'>'+esc(t.g)+' · '+esc(t.l)+'</option>';}).join('')+'</select>';
  var bulk=[['def','رجّع للتبويب'],['on','سماح للكل'],['off','منع الكل']].map(function(x){
    return '<button class="btn ghost sm" data-act="permActAll" data-u="'+esc(sel.id)+'" data-s="'+key+'" data-lv="'+x[0]+'">'+x[1]+'</button>';
  }).join('');
  var list=Object.keys(ACT_CAT).filter(function(a){return ACT_CAT[a][0]===key;});
  var tabName=(tabs.filter(function(t){return t.k===key;})[0]||{}).l||key;
  var note=PERM_TAB_ALIAS[curTab]?'<p class="meta" style="margin:0">إجراءات التبويب ده بتتبع تبويب «'+esc(tabName)+'»، وتتعدّل من هناك.</p>':'';
  var rows=list.map(function(a){
    var c=ACT_CAT[a], st=o[a]||'def';
    var seg=[['def','حسب صلاحية التبويب'],['on','مسموح'],['off','ممنوع']].map(function(x){
      var cls=st===x[0]?' on '+(x[0]==='off'?'none':x[0]==='on'?'edit':'view'):'';
      return '<button class="pseg-b'+cls+'" data-act="permActSet" data-u="'+esc(sel.id)+'" data-a="'+a+'" data-lv="'+x[0]+'" aria-pressed="'+(st===x[0])+'">'+x[1]+'</button>';
    }).join('');
    return '<div class="prow"><div class="pinfo"><b>'+esc(c[1])+'</b><small>'+(c[2]==='w'?'بيضيف أو يعدّل أو يحذف بيانات':'بيفتح شاشة أو يعرض معلومات بس')+'</small></div><div class="pseg">'+seg+'</div></div>';
  }).join('');
  var empty='<p class="meta">التبويب ده مفيش فيه إجراءات منفصلة، صلاحيته من فوق (لا يرى / يعرض / يعدّل).</p>';
  return '<div class="pgrp"><div class="pgrp-h">الإجراءات داخل التبويبات</div>'+
    '<p class="meta" style="margin:0">اختار التبويب من القايمة، وبعدين حدد لكل إجراء: حسب صلاحية التبويب، أو مسموح، أو ممنوع.</p>'+
    '<div class="pusers">'+chips+'</div>'+
    note+
    '<div class="ppresets">'+bulk+'</div>'+
    (rows||(note?'':empty))+(curTab==='boxcomp'?bcSeasonPermHTML(sel,o):'')+'</div>';
}
function bcSeasonPermHTML(sel,o){
  var rows=bcSeasons().map(function(x){
    var v=o&&o['bcs_'+x.id];
    var st=(v==='hide'||v==='view'||v==='edit')?v:'def';
    var seg=[['def','حسب التبويب'],['hide','مخفي'],['view','يعرض'],['edit','يعدّل']].map(function(y){
      var cls=st===y[0]?' on '+(y[0]==='hide'?'none':y[0]==='edit'?'edit':y[0]==='view'?'view':''):'';
      return '<button class="pseg-b'+cls+'" data-act="bcSeasonPerm" data-u="'+esc(sel.id)+'" data-s="'+esc(x.id)+'" data-lv="'+y[0]+'" aria-pressed="'+(st===y[0])+'">'+y[1]+'</button>';
    }).join('');
    return '<div class="prow"><div class="pinfo"><b>موسم '+esc(x.name)+'</b><small>مخفي: مابيظهرش له · يعرض: يشوف بس · يعدّل: يقدر يغيّر</small></div><div class="pseg">'+seg+'</div></div>';
  }).join('');
  return '<div class="pgrp"><div class="pgrp-h">مواسم تجميع علب</div><p class="meta" style="margin:0">حدد لكل موسم: مخفي، يعرض بس، ولا يعدّل.</p>'+rows+'</div>';
}

/* ===== إدارة المستخدمين ===== */
/* الحساب بيتعتبر متصل لو عمل حاجة أو نبض خلال آخر 150 ثانية (النبض كل دقيقة) */
var SEEN_LABEL={sheetProd:'بيختار صنف للدفعة',sheetSeason:'بيختار موسم',sheetCreate:'أنشأ دفعة',runPick:'بيحضّر صنف حشو',runDo:'سجّل إنتاج حشو',fillFromShort:'فتح صنف ناقص للإنتاج',toggleOwnerOnly:'غيّر إخفاء وصفة',syncEvery:'غيّر إعداد المزامنة',gdNow:'زامن الآن',gdConnect:'ربط درايف',gdOff:'فصل درايف',userEditOpen:'بيعدّل مستخدم',userCardToggle:'بيغيّر حالة كارت',userLeave:'بيعدّل إجازة',userDel:'بيحذف مستخدم',uSort:'بيتصفح المستخدمين',uFilter:'بيتصفح المستخدمين'};
function markSeen(act){
  if(!authed())return;
  S.seen=S.seen||{};var k=actorCode(),prev=S.seen[k]||{};
  S.seen[k]={t:Date.now(),a:act?(SEEN_LABEL[act]||'بيشتغل على التطبيق'):(prev.a||'')};
}
function isOnline(code){var s=S.seen&&S.seen[code];return !!s&&Date.now()-(s.t||0)<150000;}
function userFlags(u,todayK){
  var p=permsOf(u.code);
  return {leave:userLeaveActive(u,todayK),cardOff:u.cardActive===false,online:isOnline(u.code),noPerm:!Object.keys(p).some(function(k){return p[k]!=='none';})};
}
function userCounts(list,todayK){
  var c={all:list.length,active:0,inactive:0,leave:0,cardOff:0,noPerm:0};
  list.forEach(function(u){var f=userFlags(u,todayK);if(!f.leave&&!f.cardOff)(f.online?c.active++:c.inactive++);if(f.leave)c.leave++;if(f.cardOff)c.cardOff++;if(f.noPerm)c.noPerm++;});
  return c;
}

function userFilterHTML(list,todayK){
  var c=userCounts(list,todayK), cur=U.uFilter||'all';
  return [['all','الكل'],['active','نشط'],['leave','في إجازة'],['cardOff','كارت موقوف'],['noPerm','بدون صلاحيات']].map(function(x){
    return '<button class="dash-chip'+(cur===x[0]?' on':'')+'" data-act="uFilter" data-f="'+x[0]+'">'+x[1]+' '+c[x[0]]+'</button>';
  }).join('');
}
function userMatches(u,todayK){
  var q=String(U.uSearch||'').trim().toLowerCase();
  if(q&&[u.name,u.code,u.job].join(' ').toLowerCase().indexOf(q)<0)return false;
  var f=userFlags(u,todayK), cur=U.uFilter||'all';
  if(cur==='active')return f.online&&!f.leave&&!f.cardOff;
  if(cur==='inactive')return !f.online&&!f.leave&&!f.cardOff;
  if(cur==='leave')return f.leave;
  if(cur==='cardOff')return f.cardOff;
  if(cur==='noPerm')return f.noPerm;
  return true;
}
var USER_SORTS=[['name','الاسم'],['status','الحالة'],['code','الكود'],['recent','الأحدث']];
function userStatusOf(u,todayK){var f=userFlags(u,todayK);return f.cardOff?'off':(f.leave?'leave':(f.online?'active':'inactive'));}
function userSortList(list,todayK){
  var cur=U.uSort||'name', rank={off:0,leave:1,inactive:2,active:3}, arr=list.slice();
  if(cur==='status')arr.sort(function(a,b){return rank[userStatusOf(a,todayK)]-rank[userStatusOf(b,todayK)]||String(a.name||'').localeCompare(String(b.name||''),'ar');});
  else if(cur==='code')arr.sort(function(a,b){return String(a.code).localeCompare(String(b.code));});
  else if(cur==='recent')arr.reverse();
  else arr.sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''),'ar');});
  return arr;
}
function userSortHTML(){
  var cur=U.uSort||'name';
  return USER_SORTS.map(function(x){return '<button class="dash-chip'+(cur===x[0]?' on':'')+'" data-act="uSort" data-s="'+x[0]+'">'+x[1]+'</button>';}).join('');
}
function userKpiHTML(list,todayK){
  var c=userCounts(list,todayK), n=c.all||0, cur=U.uFilter||'all';
  var pct=function(v){return n?Math.round(v/n*100):0;};
  var items=[['all','الإجمالي',c.all,100,'var(--settings)'],['active','نشط الآن',c.active,pct(c.active),'#16a34a'],['leave','في إجازة',c.leave,pct(c.leave),'#3b82f6'],['cardOff','كارت موقوف',c.cardOff,pct(c.cardOff),'#ef4444']];
  return '<div class="dash-kpis">'+items.map(function(x){
    return '<button class="dash-kpi'+(cur===x[0]?' on':'')+'" data-act="uFilter" data-f="'+x[0]+'" style="--k:'+x[4]+'">'+
      '<span class="dash-kpi-t">'+x[1]+'</span><b>'+x[2]+'</b><span class="dash-bar"><i style="width:'+x[3]+'%"></i></span></button>';
  }).join('')+'</div>';
}
/* جدول الحسابات المتصلة دلوقتي: الاسم والكود وآخر عملية */
function onlineTableHTML(list){
  var byCode={};list.forEach(function(u){byCode[u.code]=u;});
  var rows=Object.keys(S.seen||{}).filter(function(k){return isOnline(k);}).map(function(k){
    var u=byCode[k];return {name:u?u.name:(k==='CHEF MYF'?'المالك':k),code:k,a:(S.seen[k].a||'—'),t:S.seen[k].t};
  }).sort(function(x,y){return y.t-x.t;});
  var body=rows.length?rows.map(function(r){var d=new Date(r.t);var hm=fmt12(d.getHours(),d.getMinutes());
    return '<tr><td>'+esc(r.name)+'</td><td class="ltr">'+esc(r.code)+'</td><td>'+esc(r.a)+'</td><td class="ltr">'+hm+'</td></tr>';}).join('')
    :'<tr><td colspan="4" class="dash-empty">مفيش حد متصل دلوقتي</td></tr>';
  return FOLD_CSS+'<details class="card ev-card" data-fk="usr-online"'+(FOLD_OPEN['usr-online']===false?'':' open')+' style="margin:12px 0"><summary class="ev-sum"><div><b>المتصلين الآن</b><small>'+rows.length+' متصل</small></div></summary>'+
    '<div style="overflow-x:auto"><table class="online-tbl" style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:right">الاسم</th><th>الكود</th><th style="text-align:right">آخر عملية</th><th>الوقت</th></tr></thead><tbody>'+body+'</tbody></table></div></details>';
}
var EVENT_LABEL={toProd:'حوّل الدفعة للإنتاج',approve:'اعتمد دفعة',skipTimer:'تخطّى مؤقت دفعة',startRun:'بدأ تشغيل دفعة',toggleCheck:'علّم خطوة في دفعة',withdraw:'سحب خامات',toggleMat:'علّم خامة في دفعة'};
/* آخر الأحداث: من سجل الدفعات المتزامن، مع فلترة لكل مستخدم وطباعة */
function allEventsFor(code){
  var out=[];
  Object.keys(S.plog||{}).forEach(function(id){
    var e=S.plog[id]||{};
    var pr=(PRODUCTS||[]).filter(function(p){return p.id===e.p;})[0];
    (e.ev||[]).forEach(function(x){
      if(code&&x.c!==code)return;
      out.push({c:x.c,a:x.a,t:x.t||0,p:pr?pr.name:'—',b:sid(id)});
    });
  });
  return out.sort(function(x,y){return y.t-x.t;});
}
function evNameOf(list,c){var u=list.filter(function(x){return x.code===c;})[0];return u?u.name:(c==='CHEF MYF'?'المالك':c);}
function evDateStr(t){var d=new Date(t);return d.toLocaleDateString('ar-EG',{day:'numeric',month:'short',year:'numeric',timeZone:TZ_CAIRO})+' · '+fmt12(d.getHours(),d.getMinutes());}
var FOLD_CSS='<style>'+
  '.ev-sum{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px}'+
  '.ev-sum::-webkit-details-marker{display:none}'+
  '.ev-sum small{display:block;color:var(--muted,#6b7090);font-size:12px;font-weight:400}'+
  '.ev-tbl{width:100%;border-collapse:collapse;font-size:13px}'+
  '.ev-tbl th{text-align:right;color:var(--muted,#6b7090);font-weight:600;padding:8px 8px;border-bottom:1px solid var(--line,#D5DDE6);background:var(--surface-2,#F4F6F8);white-space:nowrap}'+
  '.ev-tbl td{padding:9px 8px;border-bottom:1px solid var(--line-2,#E5EBF1);white-space:nowrap;vertical-align:middle;text-align:right}'+
  '.ev-time{font-variant-numeric:tabular-nums;color:var(--ink-2,#3A4959)}'+
  '.ev-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}'+
  '.ev-card{padding:12px 14px}'+
  '.tblfold{margin:8px 0;border:1px solid var(--line,#D5DDE6);border-radius:12px;padding:8px 12px}'+
  '.tblfold-sum{cursor:pointer;font-weight:700;padding:4px 0;list-style:none;display:flex;justify-content:space-between}'+
  '.tblfold-sum::-webkit-details-marker{display:none}'+
  '.tblfold-sum::after{content:"▾";color:var(--muted,#6b7090)}'+
  '.tblfold[open]>.tblfold-sum::after{content:"▴"}'+
  '.bfold>summary{list-style:none;cursor:pointer;display:block}'+
  '.bfold>summary::-webkit-details-marker{display:none}'+
  '.bfold>summary::marker{content:""}'+
  '.bfold-ops{padding:4px 2px 8px;margin-inline-start:6px;border-inline-start:2px solid var(--line-2,#E5EBF1);padding-inline-start:10px}'+
  '.bfold-op{display:flex;justify-content:space-between;gap:6px;padding:5px 0;font-size:12px;color:var(--ink-2,#3A4959);border-bottom:1px dashed var(--line-2,#E5EBF1)}'+
  '.bfold-op:last-child{border-bottom:0}'+
  '.bfold-op small{color:var(--muted,#6b7090);white-space:nowrap}'+
  '</style>';
/* عمليات الدفعة الواحدة مضغوطة جوه الصف: بتتفتح بالضغط على الدفعة نفسها */
function batchOpsHTML(k){
  var e=S.plog&&S.plog[k];
  if(!e||!(e.ev||[]).length)return '<div class="meta">مفيش عمليات مسجلة</div>';
  var list=usersList();
  var evs=e.ev.slice().sort(function(x,y){return (x.t||0)-(y.t||0);});
  return '<div class="bfold-ops">'+evs.map(function(x){
    return '<div class="bfold-op"><span>'+esc(evNameOf(list,x.c))+' · '+esc(x.l||EVENT_LABEL[x.a]||'عملية')+(x.g?' · '+esc(x.g):'')+'</span><small>'+evDateStr(x.t||0)+'</small></div>';
  }).join('')+'</div>';
}
function recentEventsHTML(list){
  var sel=U.evUser||'', n=U.evN||40;
  var groups=batchGroups(sel), shown=groups.slice(0,n);
  var totalOps=groups.reduce(function(a,g){return a+g.n;},0);
  var userChips=list.map(function(u){return '<button class="dash-chip'+(sel===u.code?' on':'')+'" data-act="evUser" data-c="'+esc(u.code)+'">'+esc(u.name)+'</button>';}).join('');
  var chips='<button class="dash-chip'+(!sel?' on':'')+'" data-act="evUser" data-c="">الكل</button>'+userChips+
    (list.some(function(u){return u.code==='CHEF MYF';})?'':'<button class="dash-chip'+(sel==='CHEF MYF'?' on':'')+'" data-act="evUser" data-c="CHEF MYF">المالك</button>');
  var rows=shown.length?shown.map(function(g){return evGroupRowHTML(g,list);}).join(''):'<li class="dash-empty">مفيش عمليات مسجلة للاختيار ده</li>';
  var more=groups.length>n?'<button class="btn ghost sm" data-act="evMore">عرض أكتر ('+(groups.length-n)+' باقي)</button>':'<span></span>';
  var evCss='<style>'+
    '.ev-list{list-style:none;margin:0;padding:0}'+
    '.ev-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;padding:10px 0;border-bottom:1px solid var(--line-2,#E5EBF1);align-items:center}'+
    '.ev-row:last-child{border-bottom:0}'+
    '.ev-who{display:flex;align-items:center;gap:8px;min-width:0}'+
    '.ev-who>div{min-width:0}'+
    '.ev-who b{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
    '.ev-who small{display:block;font-size:11px;color:var(--muted,#6b7090)}'+
    '.ev-time{font-size:11.5px;color:var(--muted,#6b7090);white-space:nowrap;font-variant-numeric:tabular-nums}'+
    '.ev-act{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;min-width:0;padding-inline-start:36px}'+
    '.ev-act small{font-size:11.5px;color:var(--muted,#6b7090);overflow-wrap:anywhere;min-width:0}'+
    EV_GRP_CSS+
    '</style>';
  return FOLD_CSS+evCss+'<details class="card ev-card" data-fk="usr-events"'+(FOLD_OPEN['usr-events']===false?'':' open')+' style="margin:12px 0">'+
    '<summary class="ev-sum"><div><b>آخر الأحداث</b><small>'+groups.length+' دفعة · '+totalOps+' عملية'+(sel?' للمستخدم المختار':'')+'</small></div></summary>'+
    '<div class="dash-filters" style="margin:10px 0">'+chips+'</div>'+
    '<ul class="ev-list">'+rows+'</ul>'+
    '<div class="ev-foot">'+more+'<button class="btn primary sm" data-act="evPrint">طباعة '+(sel?'عمليات المستخدم':'كل العمليات')+'</button></div>'+
    '</details>';
}
/* تجميع الأحداث حسب الدفعة (العملية من أولها): كل دفعة صف واحد، وبيفتح صفحتها */
var EV_GRP_CSS=
  '.ev-list{list-style:none;margin:0;padding:0}'+
  '.ev-grp{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;text-align:right;background:transparent;border:0;border-bottom:1px solid var(--line-2,#E5EBF1);padding:9px 2px;cursor:pointer;color:inherit;font:inherit}'+
  '.ev-grp:active{background:var(--surface-2,#F4F6F8)}'+
  '.ev-grp-main{min-width:0;display:flex;flex-direction:column}'+
  '.ev-grp-main b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
  '.ev-grp-main small{font-size:11px;color:var(--muted,#6b7090)}'+
  '.ev-grp-side{display:flex;flex-direction:column;align-items:flex-end;gap:2px}'+
  '.ev-grp-side small{font-size:11px;color:var(--muted,#6b7090);white-space:nowrap}'+
  '.ev-grp-who{grid-column:1 / -1;font-size:11px;color:var(--muted,#6b7090);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';
function batchGroups(code){
  var out=[];
  Object.keys(S.plog||{}).forEach(function(id){
    var e=S.plog[id]||{}, all=e.ev||[];
    var evs=all.filter(function(x){return !code||x.c===code;});
    if(!evs.length)return;
    var pr=(PRODUCTS||[]).filter(function(p){return p.id===e.p;})[0];
    var users=[];evs.forEach(function(x){if(users.indexOf(x.c)<0)users.push(x.c);});
    var last=0;evs.forEach(function(x){if((x.t||0)>last)last=x.t||0;});
    var first=e.at||Math.min.apply(null,all.map(function(x){return x.t||0;}));
    var tl=e.tabLbl||(id.indexOf('tab:')===0?(TAB_LBL[id.slice(4)]||id.slice(4)):'');
    out.push({k:id,b:tl?'':sid(id),p:tl||(pr?pr.name:'—'),start:first,last:last,n:evs.length,users:users});
  });
  return out.sort(function(x,y){return y.last-x.last;});
}
function evGroupRowHTML(g,list){
  var names=g.users.map(function(c){return evNameOf(list,c);}).join('، ');
  var inner='<div class="ev-grp-main"><b>'+esc(g.p)+'</b><small class="ltr">'+esc(g.b)+'</small></div>'+
    '<div class="ev-grp-side"><span class="dash-badge ok">'+g.n+' عملية</span><small>بدأت '+evDateStr(g.start)+'</small></div>'+
    '<small class="ev-grp-who">'+esc(names)+'</small>';
  if(String(g.k).indexOf('tab:')===0)return '<li><button class="ev-grp" data-act="evOpen" data-k="'+esc(g.k)+'">'+inner+'</button></li>';
  return '<li><details class="bfold"><summary class="ev-grp">'+inner+'</summary>'+batchOpsHTML(g.k)+'</details></li>';
}
/* صفحة الدفعة: كل عملياتها من البداية، وزرار رجوع للسجل */
function evBatchPageHTML(list){
  var k=U.evBatch, e=S.plog&&S.plog[k];
  var back='<button class="btn ghost sm" data-act="evBack">→ رجوع للسجل</button>';
  if(!e||!(e.ev||[]).length)return '<section class="card" style="--c:var(--settings)">'+back+'<div class="meta" style="margin-top:12px">العملية دي مابقتش موجودة في السجل.</div></section>';
  var pr=(PRODUCTS||[]).filter(function(p){return p.id===e.p;})[0];
  var isTab=String(k).indexOf('tab:')===0;
  var tabName=e.tabLbl||(isTab?(TAB_LBL[String(k).slice(4)]||String(k).slice(4)):'');
  var evs=e.ev.slice().sort(function(x,y){return (x.t||0)-(y.t||0);});
  var first=evs[0].t||0, users=[];evs.forEach(function(x){if(users.indexOf(x.c)<0)users.push(x.c);});
  var rows=evs.map(function(x){
    var nm=evNameOf(list,x.c);
    return '<li class="ev-row">'+
      '<div class="ev-who"><span class="uava sm">'+esc((nm||'?').charAt(0))+'</span><div><b>'+esc(nm)+'</b><small class="ltr">'+esc(x.c)+'</small></div></div>'+
      '<time class="ev-time">'+evDateStr(x.t||0)+'</time>'+
      '<div class="ev-act"><span class="dash-badge ok">'+esc(x.l||EVENT_LABEL[x.a]||'عملية على الدفعة')+'</span>'+(x.g?'<small>'+esc(x.g)+'</small>':'')+'</div>'+
      '</li>';
  }).join('');
  return '<section class="card ev-card" style="--c:var(--settings)">'+
    '<div class="bchead">'+back+'<span class="meta">'+evs.length+' عملية · '+users.length+' مستخدم</span></div>'+
    '<div style="margin-top:12px"><b>'+esc(tabName||(pr?pr.name:'—'))+'</b>'+(isTab?'':' <small class="ltr">'+esc(sid(k))+'</small>')+'</div>'+
    '<div class="meta" style="margin:4px 0 8px">بدأت '+evDateStr(first)+(e.qty?' · الكمية '+esc(String(e.qty)):'')+'</div>'+
    '<ul class="ev-list">'+rows+'</ul>'+
    '<style>'+EV_GRP_CSS+'.ev-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;padding:10px 0;border-bottom:1px solid var(--line-2,#E5EBF1);align-items:center}.ev-who{display:flex;align-items:center;gap:8px;min-width:0}.ev-who>div{min-width:0}.ev-who b{display:block;font-size:13px}.ev-who small{display:block;font-size:11px;color:var(--muted,#6b7090)}.ev-time{font-size:11.5px;color:var(--muted,#6b7090);white-space:nowrap}.ev-act{grid-column:1 / -1;padding-inline-start:36px}</style>'+
    '</section>';
}
function printEvents(sel){
  var list=usersList(), all=allEventsFor(sel);
  var who=sel?evNameOf(list,sel)+' ('+sel+')':'كل المستخدمين';
  var rows=all.map(function(x,i){var nm=evNameOf(list,x.c);
    return '<tr><td>'+(i+1)+'</td><td>'+evDateStr(x.t)+'</td><td>'+esc(nm)+'</td><td>'+esc(EVENT_LABEL[x.a]||'عملية')+'</td><td>'+esc(x.p)+'</td><td>'+esc(x.b)+'</td></tr>';}).join('');
  doPrint('<h1>سجل العمليات</h1><div class="pm">'+esc(who)+' · '+all.length+' عملية · طُبع '+esc(tstr(Date.now()))+'</div>'+
    '<table class="pt"><thead><tr><th>#</th><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>الصنف</th><th>الدفعة</th></tr></thead><tbody>'+
    (rows||'<tr><td colspan="6">لا توجد عمليات</td></tr>')+'</tbody></table>');
}
function userDonutHTML(list,todayK){
  var n=list.length, c={active:0,inactive:0,leave:0,off:0}, R=52, C=2*Math.PI*R, acc=0, segs='';
  list.forEach(function(u){c[userStatusOf(u,todayK)]++;});
  var parts=[['active','#16a34a','نشط'],['inactive','#94a3b8','غير نشط'],['leave','#3b82f6','في إجازة'],['off','#ef4444','كارت موقوف']];
  parts.forEach(function(x){
    var len=(n?c[x[0]]/n:0)*C;
    if(len>0)segs+='<circle cx="70" cy="70" r="'+R+'" fill="none" stroke="'+x[1]+'" stroke-width="16" stroke-dasharray="'+len.toFixed(2)+' '+(C-len).toFixed(2)+'" stroke-dashoffset="'+(-acc).toFixed(2)+'" transform="rotate(-90 70 70)"/>';
    acc+=len;
  });
  var legend=parts.map(function(x){return '<div><i style="background:'+x[1]+'"></i>'+x[2]+'<span>'+c[x[0]]+'</span></div>';}).join('')+
    (userCounts(list,todayK).noPerm?'<div><i style="background:#f59e0b"></i>بدون صلاحيات<span>'+userCounts(list,todayK).noPerm+'</span></div>':'');
  return '<div class="dash-mid"><div class="dash-donut"><svg viewBox="0 0 140 140" role="img" aria-label="توزيع المستخدمين">'+
    '<circle cx="70" cy="70" r="'+R+'" fill="none" stroke="var(--line)" stroke-width="16"/>'+segs+'</svg>'+
    '<div class="dash-donut-c"><b>'+n+'</b><small>مستخدم</small></div></div><div class="dash-legend">'+legend+'</div></div>';
}
function userRowsHTML(list,todayK){
  var shown=userSortList(list.filter(function(u){return userMatches(u,todayK);}),todayK);
  if(!shown.length)return '<div class="dash-empty">مفيش مستخدمين مطابقين للبحث أو الفلتر.</div>';
  return '<div class="dash-grid">'+shown.map(function(u){
    var f=userFlags(u,todayK), conf=U.confirm==='udel:'+u.id, st=userStatusOf(u,todayK);
    var badge=st==='off'?'<span class="dash-badge off">كارت موقوف</span>':(st==='leave'?'<span class="dash-badge leave">في إجازة</span>':(st==='inactive'?'<span class="dash-badge">غير نشط</span>':'<span class="dash-badge ok">نشط</span>'));
    var tags=f.noPerm?'<div class="dash-u-tags"><span class="dash-badge warn">بدون صلاحيات</span></div>':'';
    var leaveLbl=(u.leave===todayK)?'ألغِ إجازة النهاردة':'إجازة النهاردة';
    return '<article class="dash-user st-'+st+'">'+
      '<header><span class="uava">'+esc((u.name||'?').charAt(0))+'</span>'+
      '<div class="dash-u-id"><b>'+esc(u.name)+'</b><small class="ltr">'+esc(u.code)+(u.job?' · '+esc(u.job):'')+'</small></div>'+badge+'</header>'+
      tags+
      '<footer class="dash-u-act">'+
        '<button class="btn ghost sm" data-act="userEditOpen" data-id="'+u.id+'">تعديل</button>'+
        '<button class="btn ghost sm" data-act="userCardToggle" data-id="'+u.id+'">'+(f.cardOff?'تفعيل الكارت':'إيقاف الكارت')+'</button>'+
        '<button class="btn ghost sm" data-act="userLeave" data-id="'+u.id+'" '+(todayK?'':'disabled')+'>'+leaveLbl+'</button>'+
        '<button class="btn ghost sm'+(conf?' danger':'')+'" data-act="userDel" data-id="'+u.id+'">'+(conf?'تأكيد الحذف':'حذف')+'</button>'+
      '</footer></article>';
  }).join('')+'</div>';
}
function userDashHTML(list,todayK){
  var nowMs=trustedNow(), dateStr='';
  if(nowMs!==null){try{dateStr=new Date(nowMs).toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long',timeZone:TZ_CAIRO});}catch(e){}}
  return '<div class="dash-head"><div><b>لوحة المستخدمين</b><small>'+esc(dateStr||'')+'</small></div><span class="dash-badge ok">'+list.length+' مستخدم</span></div>'+
    userKpiHTML(list,todayK)+onlineTableHTML(list)+recentEventsHTML(list)+userDonutHTML(list,todayK)+
    '<div class="dash-tools"><div class="dash-search"><input id="uSearch" type="search" autocomplete="off" placeholder="ابحث بالاسم أو الكود أو الوظيفة" value="'+esc(U.uSearch||'')+'"></div>'+
    '<div class="dash-sorts">'+userSortHTML()+'</div><div class="dash-filters">'+userFilterHTML(list,todayK)+'</div></div>'+
    userRowsHTML(list,todayK);
}

/* البحث بيعمل إعادة رسم، فبنرجّع التركيز للخانة ومكان الكتابة */
function focusSearchKeep(){
  if(!U.uSearchFocus)return;
  U.uSearchFocus=false;
  var si=document.getElementById('uSearch');
  if(si){si.focus();var n=si.value.length;try{si.setSelectionRange(n,n);}catch(e){}}
}
document.addEventListener('input',function(e){
  if(e.target&&e.target.id==='uSearch'){U.uSearch=e.target.value;U.uSearchFocus=true;render();}
});
var WEEK_DAYS_AR=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
function weekOffOf(u){return (u&&u.weekOff!=null&&u.weekOff!=='')?Number(u.weekOff):null;}
function weekMoveOf(u){var m=u&&u.weekMove;return (m&&m.from&&m.to)?m:null;}
function addDaysKey(k,n){var d=new Date(k+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function weekMoveFor(woN,toWd,todayK){var from=addDaysKey(todayK,(woN-weekdayOfKey(todayK)+7)%7);return {from:from,to:addDaysKey(from,(toWd-woN+7)%7)};}
function weekMoveOptions(cur){return '<option value="">بدون</option>'+WEEK_DAYS_AR.map(function(n,i){return '<option value="'+i+'"'+(String(cur)===String(i)?' selected':'')+'>'+n+'</option>';}).join('');}
function weekdayOfKey(k){return new Date(k+'T12:00:00Z').getUTCDay();}
function weekOffOptions(cur){return '<option value="">بدون</option>'+WEEK_DAYS_AR.map(function(n,i){return '<option value="'+i+'"'+(String(cur)===String(i)?' selected':'')+'>'+n+'</option>';}).join('');}
function usersCardHTML(){
  var list=usersList();
  if(limited()){
    var nl=list.map(function(u){return '<tr><td><div class="uname"><span class="uava sm">'+esc((u.name||'?').charAt(0))+'</span><b>'+esc(u.name)+'</b></div></td></tr>';}).join('');
    return '<section class="card" style="--c:var(--settings)"><h3>المستخدمين</h3>'+(nl?'<table class="ttab utable"><thead><tr><th>المستخدم</th></tr></thead><tbody>'+nl+'</tbody></table>':'<div class="meta" style="margin-top:12px">مفيش مستخدمين لسه.</div>')+'</section>';
  }
  var nowMs=trustedNow(),todayK=nowMs===null?null:cairoDateKey(nowMs);
  var rows='';
  var editBox='';
  var eu=U.editUser?list.filter(function(x){return x.id===U.editUser;})[0]:null;
  if(eu){
    var onNow=userLeaveActive(eu,todayK);var mv=weekMoveOf(eu);if(mv&&todayK&&mv.to<todayK)mv=null;
    var period=(eu.leaveFrom&&eu.leaveTo)?('من '+eu.leaveFrom+' إلى '+eu.leaveTo):'مفيش فترة إجازة';
    editBox='<div class="uedit">'+
      '<div class="uedit-h"><span class="uava">'+esc((eu.name||'?').charAt(0))+'</span><div><b>'+esc(eu.name)+'</b><small>الكود <span class="ltr">'+esc(eu.code)+'</span>'+(onNow?' · <span class="upill">في إجازة الآن</span>':'')+'</small></div><button class="btn ghost sm" data-act="userEditCancel">إغلاق</button></div>'+
      '<div class="ugrp"><span class="sec-l">البيانات</span>'+
        '<div class="urow"><div class="fld"><label for="uEditName">الاسم</label><input id="uEditName" autocomplete="off" value="'+esc(eu.name)+'"></div>'+
        '<div class="fld"><label for="uEditCode">الكود</label><div style="display:flex;gap:8px;align-items:center"><input id="uEditCode" autocomplete="off" maxlength="12" value="'+esc(eu.code)+'" style="flex:1;min-width:0"><button type="button" data-act="uGenCode" data-target="uEditCode" aria-label="كود عشوائي" title="كود عشوائي" style="flex:none;width:44px;height:44px;border-radius:50%;border:1px solid var(--line,#e4e6f2);background:#fff;cursor:pointer;font-size:20px;color:var(--navy,#2d3591)">↻</button></div></div></div>'+
        '<small class="uhint">الكود من ٣ لـ ١٢ حرف أو رقم، عربي أو إنجليزي، ومينفعش يتكرر.</small>'+
        '<div class="fld"><label for="uEditWa">رقم الواتساب</label><input id="uEditWa" inputmode="tel" autocomplete="off" placeholder="01xxxxxxxxx" value="'+esc(eu.wa||'')+'"></div>'+
        '<small class="uhint">رقم الواتساب ده بيتستخدم في استعادة الـ PIN (آخر ٤ أرقام منه).</small></div>'+
      '<div class="ugrp"><span class="sec-l">بيانات الشغل</span>'+
        '<div class="urow"><div class="fld"><label for="uEditJob">الوظيفة</label><input id="uEditJob" autocomplete="off" value="'+esc(eu.job||'')+'"></div>'+
        '<div class="fld"><label for="uEditJoin">تاريخ الانضمام</label><input id="uEditJoin" type="date" value="'+esc(eu.joinDate||'')+'"></div></div></div>'+
      '<div class="ugrp"><span class="sec-l">بيانات الكارت</span>'+
        '<small class="uhint">علّم بس اللي عايز يظهر للمستخدم في صفحة الكارت.</small>'+cardFieldBoxes(eu)+'</div>'+
      '<div class="ugrp"><span class="sec-l">الباسورد</span>'+
        '<div class="fld"><label for="uEditPw">باسورد جديد</label><input id="uEditPw" type="password" autocomplete="new-password" placeholder="اتركه فاضي لو مش عايز تغيّره"></div></div>'+
      '<div class="ugrp"><span class="sec-l">يوم الإجازة الأسبوعي</span>'+
        '<div class="fld"><label for="uWeekOff">اليوم اللي بيتكرر كل أسبوع</label><select id="uWeekOff">'+weekOffOptions(eu.weekOff)+'</select></div>'+
        '<small class="uhint">المستخدم بياخد إجازة في اليوم ده كل أسبوع تلقائي، ومش محتاج تفعّله كل مرة.</small>'+
        '<div class="fld"><label for="uWeekMove">اتأجلت ليوم</label><select id="uWeekMove">'+weekMoveOptions(mv?weekdayOfKey(mv.to):'')+'</select></div>'+
        '<small class="uhint">'+(mv?'الإجازة الجاية اتأجلت ليوم '+WEEK_DAYS_AR[weekdayOfKey(mv.to)]+' ('+esc(mv.to)+')، ولما اليوم ده يخلص التأجيل بيختفي لوحده.':'اختار اليوم اللي الإجازة تتنقل ليه، والتأجيل بيختفي لوحده بعد اليوم ده.')+'</small>'+
        '<div class="ubtns"><button class="btn ghost sm" data-act="weekMoveClear">مسح التأجيل</button></div></div>'+
      '<div class="ugrp"><span class="sec-l">الإجازة التلقائية</span>'+
        '<div class="urow"><div class="fld"><label for="uLeaveFrom">من يوم</label><input id="uLeaveFrom" type="date" value="'+esc(eu.leaveFrom||'')+'"></div>'+
        '<div class="fld"><label for="uLeaveTo">لحد يوم</label><input id="uLeaveTo" type="date" value="'+esc(eu.leaveTo||'')+'"></div></div>'+
        '<small class="uhint">الوضع بيتفعل تلقائي أول يوم في الفترة وبيتقفل تلقائي بعد آخر يوم. الحالية: '+esc(period)+'.</small>'+
        '<div class="ubtns"><button class="btn ghost sm" data-act="userLeaveClear">مسح الفترة</button><button class="btn ghost sm" data-act="userLeave" data-id="'+eu.id+'" '+(todayK?'':'disabled')+'>'+(eu.leave===todayK?'ألغِ إجازة النهاردة':'إجازة النهاردة بس')+'</button></div></div>'+
      '<div class="ubtns ufoot"><button class="btn ghost" data-act="userEditCancel">إلغاء</button><button class="btn" data-act="userEditSave">حفظ التعديلات</button></div>'+
    '</div>';
  }
  var form='<div class="stack" style="margin-top:10px">'+
    '<div class="fld"><label for="uName">اسم المستخدم</label><input id="uName" autocomplete="off" placeholder="مثال: أحمد"></div>'+
    '<div class="fld"><label for="uPw">الباسورد</label><input id="uPw" type="password" autocomplete="new-password" placeholder="4 حروف أو أرقام على الأقل"></div>'+
    '<div class="fld"><label for="uCode">الكود (اختياري)</label><div style="display:flex;gap:8px;align-items:center"><input id="uCode" autocomplete="off" maxlength="12" placeholder="يتولد تلقائي لو فاضي" style="flex:1;min-width:0"><button type="button" data-act="uGenCode" data-target="uCode" aria-label="كود عشوائي" title="كود عشوائي" style="flex:none;width:44px;height:44px;border-radius:50%;border:1px solid var(--line,#e4e6f2);background:#fff;cursor:pointer;font-size:20px;color:var(--navy,#2d3591)">↻</button></div></div>'+
    '<div class="fld"><label for="uWa">رقم الواتساب (اختياري)</label><input id="uWa" inputmode="tel" autocomplete="off" placeholder="01xxxxxxxxx"></div>'+
    '<div class="fld"><label for="uJob">الوظيفة (اختياري)</label><input id="uJob" autocomplete="off" placeholder="مثال: عامل إنتاج"></div>'+
     '<div class="fld"><label for="uJoin">تاريخ الانضمام (اختياري)</label><input id="uJoin" type="date"></div>'+
     '<button class="btn block" data-act="userAdd">إضافة مستخدم</button></div>';
  if(U.evBatch)return evBatchPageHTML(list);
  return '<section class="card" style="--c:var(--settings)"><h3>إدارة المستخدمين</h3>'+
    '<p class="meta" style="margin:0">كل مستخدم بيدخل بالباسورد بتاعه، ولازم يكون مختلف عن باسورد المالك وعن أي مستخدم تاني.</p>'+
    (list.length?userDashHTML(list,todayK):'<div class="meta" style="margin-top:12px">مفيش مستخدمين لسه.</div>')+
    editBox+
    '<div class="pgrp"><div class="pgrp-h">إضافة مستخدم جديد</div>'+form+'</div>'+
    '<small class="uhint">معرّف ملف الكروت (لصفحة الكروت): <span class="ltr">'+esc(GD.cardsId||'يظهر بعد أول مزامنة مع درايف')+'</span></small>'+'<div class="ubtns" style="margin-top:12px"><button class="btn ghost sm" data-act="cardsExport">تصدير بيانات الكروت (cards.json)</button> <button class="btn ghost sm" data-act="cardsImport">استيراد بيانات الكروت</button></div>'+
    resetReqsHTML()+'</section>';
}
function resetReqsHTML(){
  var rs=pref('resetReqs',[]).filter(function(r){return !r.owner;});
  if(!rs.length)return '';
  return '<div class="grp" style="margin-top:14px">طلبات إعادة التعيين ('+rs.length+')</div>'+
    rs.map(function(r){
      return '<div class="hist" style="align-items:center"><span><b>'+esc(r.name)+'</b> · الكود: '+esc(r.code||'')+'<br><span class="meta">واتساب: '+esc(r.wa||'-')+' · '+tstr(r.at)+'</span></span>'+
        '<span class="acts"><button class="btn sm" data-act="resetApprove" data-id="'+r.id+'">اعتماد</button>'+
        '<button class="btn ghost sm" data-act="resetReject" data-id="'+r.id+'">رفض</button></span></div>';
    }).join('');
}
/* كل تشغيل: دفعات الإنتاج العادي + تحضير الحشو، مرتبين من الأحدث */
function prodRunsAll(){
  var log=S.plog||{},out=[];
  Object.keys(log).forEach(function(id){
    var e=log[id];
    out.push({id:id,type:'prod',p:e.p,qty:e.qty,at:e.at||0,by:e.by||[],ev:e.ev||[],code:sid(id)});
  });
  PRODUCTS.forEach(function(p){
    if(!p.fill||!Array.isArray(p.fillRuns))return;
    p.fillRuns.forEach(function(r,i){
      if(r.logHidden)return;
      var by=r.by?[r.by]:(i===0&&p.by?[p.by]:[]);
      out.push({id:'f:'+p.id+':'+i,type:'fill',p:p.id,qty:r.out,at:r.at||0,by:by,ev:[],code:p.code||'—'});
    });
  });
  out.sort(function(x,y){return y.at-x.at;});
  return out.slice(0,300);
}


document.addEventListener('input',function(e){
  var t=e.target;if(!t||t.id!=='plq')return;
  var q=(t.value||'').trim().toLowerCase(),shown=0;
  document.querySelectorAll('#plBody tr.plrow').forEach(function(r){
    var hit=!q||(r.getAttribute('data-q')||'').indexOf(q)>-1;
    r.hidden=!hit;if(hit)shown++;
  });
  var em=document.getElementById('plEmpty');if(em)em.hidden=shown>0;
});

function seasonsCardHTML(){
  var rows=SEASONS.map(function(x){
    if(x[0]==='normal')return '<tr><td>'+x[1]+'</td><td><span class="meta">دايمًا ظاهر</span></td></tr>';
    var hid=seasonHidden(x[0]);
    return '<tr><td>'+x[1]+'</td><td><button class="tg'+(hid?'':' on')+'" data-act="toggleSeason" data-k="'+x[0]+'">'+(hid?'مخفي':'ظاهر')+'</button></td></tr>';
  }).join('');
  return '<section class="card" style="--c:var(--settings)"><h3>المواسم في الأوردرات</h3><p class="meta" style="margin:0">التبويبات دي بتظهر في الأوردرات وأوردرات المحل بس. لو خفيت موسم، أوردراته مش هتظهر لحد ما ترجعه.</p><table class="ttab"><tbody>'+rows+'</tbody></table></section>';
}
/* ===== الطابعة الحرارية: الربط مرة واحدة، والاسم وطريقة الطباعة بيتحفظوا في درايف ===== */
function printerInfo(){return S.printer||{};}
function printerCardHTML(){
  var pr=printerInfo(),on=pr.method||'bt';
  var status=pr.id?'<b>'+esc(unesc(pr.name||'طابعة'))+'</b><small class="meta"> · متربطة</small>':'<span class="meta">مفيش طابعة مربوطة</span>';
  var lim=limited();
  return '<section class="card" style="--c:var(--settings)"><h3>الطابعة الحرارية</h3>'+
    '<p class="meta" style="margin:0">اربطها مرة واحدة، والاسم وطريقة الطباعة بيتحفظوا في درايف.</p>'+
    '<div class="pst" style="margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2,#f7f8fc)">'+
      '<div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:'+(pr.id?'#16a34a':'#9ca3af')+'"></span>'+status+'</div>'+
    '</div>'+
    '<div class="sec-l">طريقة الطباعة الافتراضية</div>'+
    '<div class="seg" role="group" aria-label="طريقة الطباعة الافتراضية" style="width:100%;display:flex">'+
      [['bt','🔵 بلوتوث'],['raw','📲 RawBT']].map(function(x){return '<button style="flex:1" class="'+(on===x[0]?'on':'')+'" data-act="printerMethod" data-v="'+x[0]+'"'+(lim?' disabled':'')+'>'+x[1]+'</button>';}).join('')+
    '</div>'+
    '<div class="dbtns" style="margin-top:12px">'+
      (lim?'':'<button class="btn sm" data-act="printerPair">🔵 ربط طابعة بلوتوث</button>')+
      (pr.id&&!lim?'<button class="btn ghost sm" data-act="printerForget">فك الربط</button>':'')+
    '</div>'+
    '<p class="meta" style="margin:10px 0 0;font-size:12px">طريقة RawBT بتستخدم الطابعة اللي متربطة في تطبيق RawBT نفسه، ومش محتاجة ربط هنا.</p>'+
  '</section>';
}
function securityCardHTML(){
  return '<section class="card" style="--c:var(--settings)"><h3>حماية الإعدادات</h3><p class="meta" style="margin:0">الإعدادات بتتقفل تلقائيًا لما تقفل المتصفح أو تسجل خروج.</p><div class="dbtns"><button class="btn ghost sm" data-act="sChangeStart">تغيير الـ PIN</button><button class="btn ghost sm" data-act="sLock">قفل الإعدادات</button></div></section>';
}
/* زرار البصمة لفتح الإعدادات للمالك بدل الـ PIN */
function settingsBioBtn(){
  if(limited()||!bioSupported())return '';
  return localStorage.getItem(BIO_KEY)
    ?'<button class="btn block" data-act="settingsBio" style="margin-bottom:8px">افتح الإعدادات بالبصمة أو الوجه</button>'
    :'<button class="btn ghost block" data-act="bioEnableAct" style="margin-bottom:8px">فعّل البصمة بدل الـ PIN</button>';
}
function settingsGate(){
  if(sUnlocked()&&!U.sChange)return settingsView();
  var st=sPwStored(),err=U.sErr?'<div class="note">'+U.sErr+'</div>':'',mode=!st?'setup':(U.sChange?'change':'unlock');
  var title,body,btn,extra='';
  /* المالك بس: لو البصمة مفعّلة، تطلب تلقائي أول ما يدخل الإعدادات (مرة واحدة لكل دخول) */
  if(mode==='unlock'&&!limited()&&bioSupported()&&localStorage.getItem(BIO_KEY)&&!U.sBioTried){U.sBioTried=true;setTimeout(function(){if(U.view==='settings'&&!sUnlocked())ACT.settingsBio();},50);}
  if(mode==='setup'){title='اختار PIN للإعدادات';body='<p class="meta" style="margin:0 0 8px">تنبيه: الـ PIN من 4 أرقام ضعيف، ممكن حد يعرفه بسهولة. استخدم 6 أرقام أو أكتر.</p>'+pwField('spw1','الـ PIN الجديد','new-password')+pwField('spw2','تأكيد الـ PIN','new-password');btn='حفظ الـ PIN';}
  else if(mode==='change'){title='تغيير PIN الإعدادات';body='<p class="meta" style="margin:0 0 8px">تنبيه: الـ PIN من 4 أرقام ضعيف، ممكن حد يعرفه بسهولة. استخدم 6 أرقام أو أكتر.</p>'+pwField('spwOld','الـ PIN الحالي','current-password')+pwField('spw1','الـ PIN الجديد','new-password')+pwField('spw2','تأكيد الـ PIN الجديد','new-password');btn='حفظ الـ PIN الجديد';extra='<button class="btn ghost block" data-act="sCancel" style="margin-top:8px">إلغاء</button>';}
  else{title='الإعدادات محمية';body=pwField('spw1','الـ PIN','current-password');btn='دخول';extra=settingsBioBtn()+'<p class="meta" style="margin:0">لو نسيت الـ PIN مفيش طريقة تستعيده من التطبيق. الحل الوحيد إنك تمسح بيانات الموقع من المتصفح، وده هيمسح كل البيانات.</p>';}
  return '<section class="card" style="--c:var(--settings);max-width:420px;margin:24px auto"><h3>'+title+'</h3>'+err+body+'<button class="btn block" data-act="settingsSubmit">'+btn+'</button>'+extra+'</section>';
}

function verifyBtn(){return '<button class="btn ghost sm themebtn" data-act="tab" data-v="verify" aria-label="التحقق من البطاقة" title="التحقق من البطاقة"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M14 10h4M14 14h3M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2"/></svg></button>';}
function verifyView(){
  var own=limited()&&permLevel('verify')!=='edit';
  var src=own?new URL('./?id='+encodeURIComponent(sessionCode())+'&own=1',location.href).href:new URL('./?card=1',location.href).href;
  return '<div style="position:fixed;inset:0;z-index:60;background:#070b22">'+
    '<iframe data-verify allow="camera; web-share; clipboard-write" src="'+esc(src)+'" title="التحقق من البطاقة" style="width:100%;height:100%;border:0;display:block"></iframe>'+
    '<button class="btn ghost sm" data-act="tab" data-v="home" style="position:absolute;top:12px;inset-inline-start:12px;z-index:1;width:auto;padding:8px 14px;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35)">رجوع</button></div>';
}
var MOON_P='<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
var SUN_P='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
function curTheme(){var t=document.documentElement.getAttribute('data-theme');if(t)return t;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
function settingsBtn(){return '<button class="btn ghost sm themebtn" data-act="tab" data-v="settings" aria-label="الإعدادات" title="الإعدادات"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>';}
function themeBtn(){var d=curTheme()==='dark',lbl=d?'الوضع النهاري':'الوضع الليلي';return '<button class="btn ghost sm themebtn" data-act="theme" aria-label="'+lbl+'" title="'+lbl+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(d?SUN_P:MOON_P)+'</svg></button>';}
function installHTML(){
  if(matchMedia('(display-mode: standalone)').matches||navigator.standalone)return '';
  var btn=window.KH_INSTALL?'<button class="btn sm" data-act="install">تثبيت التطبيق</button>':'';
  var ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  var hint=ios?'<p class="meta" style="margin:0">على iPhone: من Safari اضغط زر المشاركة ثم "إضافة إلى الشاشة الرئيسية".</p>':(btn?'':'<p class="meta" style="margin:0">لو المتصفح بيدعم التثبيت هيظهر زر التثبيت هنا.</p>');
  return '<section class="card dat" style="--c:var(--prep)"><div class="row"><h3>تثبيت التطبيق على الهاتف</h3></div>'+hint+(btn?'<div class="dbtns">'+btn+'</div>':'')+'</section>';
}
/* ===== تجميع علب: حساب الخامات لكل علبة (من ملف سيجما) ===== */
var BC_SEED=[{"name": "علبة جزمة", "count": 0, "items": [["ملبن فسدق", 2.0], ["مرزيبان", 2.0], ["اكلير ملبن", 1.0], ["اكلير فدسق", 1.0], ["اكلير لوز", 1.0], ["اكلير سوداني", 1.0], ["ملبن حبل", 2.0], ["فرسكة فدسق", 1.0], ["فرسكة بندق", 1.0], ["فرسكة سوداني", 1.0], ["فرسكة عسل وطحينه", 1.0], ["بندق", 0.0], ["لوز", 1.0], ["كاجو", 1.0], ["بيكان", 1.0], ["فدسق", 1.0], ["سابليه شكولاته", 2.0], ["لب اخضر", 2.0], ["فوليه", 1.0], ["حمصيه", 1.0], ["سمسميه", 1.0], ["برازق فسدق", 2.0]]}, {"name": "علبة صغيرة", "count": 2, "items": [["ملبن فسدق", 3.0], ["مرزيبان", 3.0], ["اكلير ملبن", 2.0], ["اكلير فدسق", 2.0], ["اكلير لوز", 2.0], ["اكلير سوداني", 2.0], ["ملبن حبل", 2.0], ["فرسكة فدسق", 1.0], ["فرسكة بندق", 1.0], ["فرسكة سوداني", 1.0], ["فرسكة عسل وطحينه", 1.0], ["بندق", 2.0], ["لوز", 1.0], ["كاجو", 1.0], ["بيكان", 1.0], ["فدسق", 1.0], ["سابليه شكولاته", 2.0], ["لب اخضر", 2.0], ["فوليه", 2.0], ["حمصيه", 2.0], ["سمسميه", 2.0]]}, {"name": "علبة وسط", "count": 12, "items": [["ملبن فسدق", 4.0], ["مرزيبان", 8.0], ["اكلير ملبن", 2.0], ["اكلير فدسق", 2.0], ["اكلير لوز", 2.0], ["اكلير سوداني", 2.0], ["ملبن حبل", 10.0], ["فرسكة فدسق", 2.0], ["فرسكة بندق", 2.0], ["فرسكة سوداني", 2.0], ["فرسكة عسل وطحينه", 2.0], ["بندق", 3.0], ["لوز", 2.0], ["كاجو", 2.0], ["بيكان", 2.0], ["فدسق", 2.0], ["سابليه شكولاته", 4.0], ["لب اخضر", 6.0], ["فوليه", 3.0], ["حمصيه", 3.0], ["سمسميه", 3.0], ["برازق فسدق", 4.0]]}, {"name": "علبة كبيرة", "count": 13, "items": [["ملبن فسدق", 13.0], ["مرزيبان", 12.0], ["اكلير ملبن", 7.0], ["اكلير فدسق", 7.0], ["اكلير لوز", 7.0], ["اكلير سوداني", 7.0], ["ملبن حبل", 14.0], ["فرسكة فدسق", 5.0], ["فرسكة بندق", 5.0], ["فرسكة سوداني", 5.0], ["فرسكة عسل وطحينه", 5.0], ["بندق", 6.0], ["لوز", 6.0], ["كاجو", 6.0], ["بيكان", 6.0], ["فدسق", 6.0], ["سابليه شكولاته", 6.0], ["لب اخضر", 10.0], ["فوليه", 8.0], ["حمصيه", 8.0], ["سمسميه", 8.0], ["برازق فسدق", 7.0], ["برازق نوتيلا", 7.0]]}, {"name": "علبة متر", "count": 0, "items": [["ملبن فسدق", 6.0], ["مرزيبان", 10.0], ["اكلير ملبن", 5.0], ["اكلير فدسق", 5.0], ["اكلير لوز", 5.0], ["اكلير سوداني", 5.0], ["ملبن حبل", 10.0], ["فرسكة فدسق", 4.0], ["فرسكة بندق", 4.0], ["فرسكة سوداني", 4.0], ["فرسكة عسل وطحينه", 4.0], ["بندق", 4.0], ["لوز", 4.0], ["كاجو", 4.0], ["بيكان", 0.0], ["فدسق", 4.0], ["سابليه شكولاته", 4.0], ["لب اخضر", 10.0], ["فوليه", 4.0], ["حمصيه", 4.0], ["سمسميه", 4.0], ["برازق فسدق", 5.0]]}, {"name": "علبة دولاب", "count": 2, "items": [["ملبن فسدق", 10.0], ["مرزيبان", 10.0], ["اكلير ملبن", 5.0], ["اكلير فدسق", 5.0], ["اكلير لوز", 5.0], ["اكلير سوداني", 5.0], ["ملبن حبل", 2.0], ["فرسكة فدسق", 4.0], ["فرسكة بندق", 4.0], ["فرسكة سوداني", 4.0], ["فرسكة عسل وطحينه", 4.0], ["بندق", 4.0], ["لوز", 4.0], ["كاجو", 4.0], ["بيكان", 4.0], ["فدسق", 5.0], ["سابليه شكولاته", 4.0], ["لب اخضر", 5.0], ["فوليه", 3.0], ["حمصيه", 3.0], ["سمسميه", 3.0], ["برازق فسدق", 4.0]]}];
/* المواسم: كل موسم ليه صفحته ولعبه. مولد النبي هو الأصل (تركيبته القديمة)، والباقي فاضي لحد ما تضيف فيه */
var BC_SEASON_DEFAULTS=[{id:'mawlid',name:'مولد النبي'},{id:'ramadan',name:'رمضان'},{id:'xmas',name:'الكريسماس'},{id:'yamish',name:'الياميش'},{id:'sham',name:'شم النسيم'}];
function bcSeeded(){return BC_SEED.map(function(t,i){return {id:'bc'+i,name:t.name,count:t.count,items:t.items.map(function(x){return {name:x[0],q:x[1]};})};});}
function bcSeasons(){
  if(!Array.isArray(S.bcSeasons)){
    var base=(S.boxComp&&Array.isArray(S.boxComp.types))?S.boxComp.types:bcSeeded();
    if(S.boxComp)delete S.boxComp;
    S.bcSeasons=BC_SEASON_DEFAULTS.map(function(x){return {id:x.id,name:x.name,types:x.id==='mawlid'?base:[]};});
  }
  return S.bcSeasons;
}
function bcSeasonCur(){var L=bcSeasons();return L.filter(function(x){return x.id===U.bcSeason;})[0]||L[0];}
function bcData(){var c=bcSeasonCur();if(!Array.isArray(c.types))c.types=[];return c.types;}
function bcType(id){return bcData().filter(function(t){return t.id===id;})[0]||null;}
function bcTargetType(id){if(U.bcDraft&&U.bcDraft.id===id)return U.bcDraft;return bcType(id);}
function bcNorm(n){return String(n||'').replace(/\s+/g,' ').trim();}
function bcTotals(){
  var m={},order=[];
  bcData().forEach(function(t){(t.items||[]).forEach(function(it){
    var k=bcNorm(it.name);if(!k)return;
    if(order.indexOf(k)<0){order.push(k);m[k]=0;}
    m[k]+=(Number(it.q)||0)*(Number(t.count)||0);
  });});
  return order.map(function(k){return {name:k,total:m[k]};});
}
function bcTotalBoxes(){return bcData().reduce(function(a,t){return a+(Number(t.count)||0);},0);}
function bcNames(){var names=[];bcData().forEach(function(t){(t.items||[]).forEach(function(it){var k=bcNorm(it.name);if(k&&names.indexOf(k)<0)names.push(k);});});return names;}
var BC_PDF='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 14h8M8 17h5"/></svg>';
/* استخراج PDF: بيفتح نافذة الطباعة، واختار "حفظ كـ PDF" من الطباعة */
function bcPrintHTML(title,body){
  var f=document.createElement('iframe');
  f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  var d=f.contentDocument||f.contentWindow.document;
  d.open();
  d.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#000;margin:0}h1{font-size:20px;margin:0 0 4px}.sub{font-size:12px;color:#555;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #999;padding:6px 8px;text-align:right}th{background:#eee}td.n,th.n{text-align:left;width:120px}tfoot td{font-weight:700}</style></head><body>'+body+'</body></html>');
  d.close();
  setTimeout(function(){
    try{f.contentWindow.focus();f.contentWindow.print();}catch(e){toast('ماقدرتش أفتح الطباعة');}
    setTimeout(function(){f.remove();},2000);
  },300);
}
function bcDateText(){try{return new Date().toLocaleDateString('ar-EG-u-nu-latn',{year:'numeric',month:'long',day:'numeric'});}catch(e){return '';}}
function bcBoxPdfHTML(t){
  var count=Number(t.count)||0;
  var rows=(t.items||[]).filter(function(it){return bcNorm(it.name);}).map(function(it){
    var q=Number(it.q)||0;
    return '<tr><td>'+esc(bcNorm(it.name))+'</td><td>'+q+'</td><td class="n">'+(q*count)+'</td></tr>';
  }).join('')||'<tr><td colspan="3">مفيش أصناف</td></tr>';
  var sum=(t.items||[]).reduce(function(a,it){return a+(Number(it.q)||0)*count;},0);
  return '<h1>'+esc(t.name)+'</h1><div class="sub">عدد العلب المطلوبة: '+count+' · '+bcDateText()+'</div>'+
    '<table><thead><tr><th>الصنف</th><th>الكمية في العلبة</th><th class="n">الإجمالي</th></tr></thead><tbody>'+rows+'</tbody>'+
    '<tfoot><tr><td>المجموع</td><td></td><td class="n">'+sum+'</td></tr></tfoot></table>';
}
function bcTotalPdfHTML(){
  var tot=bcTotals();
  var rows=tot.map(function(r){return '<tr><td>'+esc(r.name)+'</td><td class="n">'+r.total+'</td></tr>';}).join('')||'<tr><td colspan="2">مفيش أصناف</td></tr>';
  return '<h1>مجموع الكل - '+esc(bcSeasonCur().name)+'</h1><div class="sub">إجمالي عدد العلب: '+bcTotalBoxes()+' · '+bcDateText()+'</div>'+
    '<table><thead><tr><th>الصنف</th><th class="n">الإجمالي</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
var BC_GEAR='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
function bcItemHTML(t,it,i){
  return '<div class="bcitem"><input class="bcn" list="bcNames" value="'+esc(it.name)+'" placeholder="اسم الصنف" data-bc="name" data-t="'+esc(t.id)+'" data-i="'+i+'">'+
    '<div class="bcline"><span class="bcl">الكمية في العلبة</span><div class="bcqs">'+
    '<button class="bcb" data-act="bcQStep" data-t="'+esc(t.id)+'" data-i="'+i+'" data-d="-1">−</button>'+
    '<input class="bcq" type="number" inputmode="decimal" min="0" step="any" value="'+(Number(it.q)?Number(it.q):'')+'" placeholder="0" data-bc="qty" data-t="'+esc(t.id)+'" data-i="'+i+'">'+
    '<button class="bcb" data-act="bcQStep" data-t="'+esc(t.id)+'" data-i="'+i+'" data-d="1">+</button></div>'+
    '<button class="bcx" data-act="bcDel" data-t="'+esc(t.id)+'" data-i="'+i+'" aria-label="حذف الصنف">×</button></div></div>';
}
/* صف التبويبات: كل علبة فيها اسمها وعدد العلب (قابل للكتابة) وترس للتعديل، والمجموع على الشمال */
function bcTabsRowHTML(){
  var T=bcData();
  var tabs=T.map(function(t){
    return '<div class="bctab"><span class="bctn">'+esc(t.name)+'</span>'+
      '<input class="bctc" type="number" inputmode="numeric" min="0" step="1" value="'+(Number(t.count)?Number(t.count):'')+'" placeholder="0" data-bc="cnt" data-t="'+esc(t.id)+'" aria-label="عدد العلب">'+
      '<div class="bcacts"><button class="bcgear" data-act="bcEdit" data-t="'+esc(t.id)+'" aria-label="تعديل العلبة">'+BC_GEAR+'</button><button class="bcgear" data-act="bcPdfBox" data-t="'+esc(t.id)+'" aria-label="استخراج PDF للعلبة">'+BC_PDF+'</button></div></div>';
  }).join('');
  return '<div class="bcstack">'+tabs+'<button class="bctab-add" data-act="bcNew" aria-label="علبة جديدة">+ علبة جديدة</button></div>';
}
/* صلاحية كل موسم لكل مستخدم: مخفي / عرض / تعديل. لو مش متحددة بتتبع صلاحية تبويب تجميع علب */
var BC_WRITE_ACTS=['bcEdit','bcNew','bcSaveDraft','bcDelType','bcStep','bcAdd','bcDel','bcQStep'];
function seasonLevel(id){
  if(!limited())return 'edit';
  var o=(pref('aperms',{})[sessionCode()])||{};
  var v=o['bcs_'+id];
  if(v==='hide'||v==='view'||v==='edit')return v;
  var lv=permLevel('boxcomp');
  return lv==='edit'?'edit':lv==='view'?'view':'hide';
}
function bcVisibleSeasons(){return bcSeasons().filter(function(x){return seasonLevel(x.id)!=='hide';});}
function bcCanEditSeason(){return seasonLevel(bcSeasonCur().id)==='edit';}
function bcSeasonsHTML(){
  var cur=bcSeasonCur().id;
  return '<div class="bcseasons">'+bcVisibleSeasons().map(function(x){
    return '<button class="bcseason'+(x.id===cur?' on':'')+'" data-act="bcSeason" data-v="'+esc(x.id)+'">'+esc(x.name)+'</button>';
  }).join('')+'</div>';
}
function boxCompView(){
  var vis=bcVisibleSeasons();
  if(!vis.length)return head('تجميع علب','مفيش مواسم متاحة لحسابك')+'<div class="meta" style="text-align:center;padding:20px 0">كلمة المالك هي اللي بتظهر لك المواسم</div>';
  if(!vis.some(function(x){return x.id===bcSeasonCur().id;}))U.bcSeason=vis[0].id;
  if(U.bcDraft&&!bcCanEditSeason()){U.bcDraft=null;U.bcDraftNew=false;}
  if(U.bcDraft)return bcSeasonsHTML()+editorView(U.bcDraft);
  var head0=head('تجميع علب','موسم: '+bcSeasonCur().name);
  if(!bcData().length)return head0+bcSeasonsHTML()+'<div class="bcsplit">'+bcTabsRowHTML()+'</div><div class="meta" style="text-align:center;padding:20px 0">الموسم ده فاضي، اضغط + علبة جديدة عشان تبدأ</div>';
  return head0+bcSeasonsHTML()+'<div class="bcsplit">'+bcTabsRowHTML()+'<div class="bcsum">'+bcTotalView()+'</div></div>';
}
/* جدول المجموع */
function bcTotalView(){
  var tot=bcTotals();
  var rows=tot.length?tot.map(function(r){return '<tr><td>'+esc(r.name)+'</td><td>'+r.total+'</td></tr>';}).join(''):'<tr><td colspan="2" class="meta">مفيش أصناف لسه</td></tr>';
  return '<section class="bccard"><div class="bchead"><b>مجموع الكل</b><span class="bcacts"><span class="meta">'+bcTotalBoxes()+' علبة</span><button class="bcgear" data-act="bcPdfTotal" aria-label="استخراج PDF للمجموع">'+BC_PDF+'</button></span></div>'+
    '<table class="bctbl"><thead><tr><th>الصنف</th><th>الإجمالي</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
}
/* صفحة تعديل العلبة: بتتحفظ بس لما تضغط حفظ، وحذف بيشيل العلبة */
function editorView(d){
  var dl='<datalist id="bcNames">'+bcNames().map(function(n){return '<option value="'+esc(n)+'">';}).join('')+'</datalist>';
  var items=(d.items||[]).map(function(it,i){return bcItemHTML(d,it,i);}).join('');
  return dl+
    '<div class="bcrowtop"><button class="btn ghost sm" data-act="bcCancelDraft">→ رجوع بدون حفظ</button></div>'+
    '<section class="bccard"><div class="bchead"><input class="bcname" value="'+esc(d.name)+'" data-bc="tname" data-t="'+esc(d.id)+'" aria-label="اسم العلبة">'+
    '<div class="bcstep"><button class="bcb" data-act="bcStep" data-t="'+esc(d.id)+'" data-d="-1">−</button>'+
    '<input class="bcnum" type="number" inputmode="numeric" min="0" step="1" value="'+(Number(d.count)?Number(d.count):'')+'" placeholder="0" data-bc="cnt" data-t="'+esc(d.id)+'" aria-label="عدد العلب">'+
    '<button class="bcb" data-act="bcStep" data-t="'+esc(d.id)+'" data-d="1">+</button></div></div>'+
    '<div class="bcmeta">عدد العلب المطلوبة · '+(d.items||[]).length+' صنف</div>'+items+
    '<button class="btn ghost sm bcadd" data-act="bcAdd" data-t="'+esc(d.id)+'">+ صنف جديد</button></section>'+
    '<div class="bcfoot"><button class="btn" data-act="bcSaveDraft">حفظ</button><button class="btn ghost bcdanger" data-act="bcDelType" data-t="'+esc(d.id)+'">حذف</button></div>';
}
document.addEventListener('change',function(e){
  var el=e.target;if(!el||!el.dataset||!el.dataset.bc)return;
  if(!canWrite()||!bcCanEditSeason()){toast('مش مسموح لك تعدل هنا');render();return;}
  var t=bcTargetType(el.dataset.t);if(!t)return;
  if(el.dataset.bc==='cnt'){t.count=Math.max(0,Math.floor(Number(el.value)||0));}
  else if(el.dataset.bc==='qty'){var a=t.items[Number(el.dataset.i)];if(a)a.q=Math.max(0,Number(el.value)||0);}
  else if(el.dataset.bc==='tname'){t.name=bcNorm(el.value)||'علبة';}
  else if(el.dataset.bc==='name'){var b=t.items[Number(el.dataset.i)];if(b)b.name=bcNorm(el.value);}
  save();render();
});
var ACT={ trkOk:function(d){
    var fr0=fillRunOf(d.id);
    if(fr0){if(!fr0.run.exp){toast('حدد تاريخ الصلاحية الأول');return false;}fr0.run.expOk=Date.now();toast('اتأكد تاريخ الصلاحية');return;}
    var td=S.done.filter(function(x){return x.id===d.id&&x.p===d.p;})[0];
    if(!td){toast('الدفعة دي مش موجودة');return false;}
    if(!td.exp){toast('حدد تاريخ الصلاحية الأول');return false;}
    td.expOk=Date.now();toast('اتأكد تاريخ الصلاحية');
  },
  trkOff:function(d){
    if(!canWrite()){toast('مش مسموح لك تعدّل هنا');return false;}
    var tp=P(d.p);if(!tp){toast('الصنف ده مش موجود');return false;}
    tp.trkOff=true;toast('اتشال '+tp.name+' من تتبع الصلاحية');
  },
  trkFilter:function(d){U.trkF=(U.trkF===d.v)?'attn':d.v;},
  trkLoc:function(d){U.trkLoc=d.v;},
  synDelDev:function(d){if(limited())return false;synDelDevice(d.k);return false;},bcSeasonPerm:function(d){var u=usersList().filter(function(x){return x.id===d.u;})[0];if(!u)return false;var m=Object.assign({},pref('aperms',{}));var o=Object.assign({},m[u.code]||{});var k='bcs_'+d.s;if(d.lv==='def')delete o[k];else o[k]=d.lv;m[u.code]=o;setPref('aperms',m);render();return false;}, bcSeason:function(d){if(seasonLevel(d.v)==='hide')return false;U.bcSeason=d.v;U.bcDraft=null;U.bcDraftNew=false;}, bcPdfBox:function(d){var t=bcType(d.t);if(!t)return false;bcPrintHTML(t.name,bcBoxPdfHTML(t));return false;}, bcPdfTotal:function(){bcPrintHTML('مجموع الكل',bcTotalPdfHTML());return false;}, bcStep:function(d){var t=bcTargetType(d.t);if(!t)return false;t.count=Math.max(0,(Number(t.count)||0)+Number(d.d));}, bcAdd:function(d){var t=bcTargetType(d.t);if(!t)return false;t.items=t.items||[];t.items.push({name:'',q:0});}, bcDel:function(d){var t=bcTargetType(d.t);if(!t)return false;t.items.splice(Number(d.i),1);}, bcQStep:function(d){var t=bcTargetType(d.t);if(!t)return false;var it=t.items[Number(d.i)];if(!it)return false;it.q=Math.max(0,(Number(it.q)||0)+Number(d.d));}, bcEdit:function(d){var t=bcType(d.t);if(!t)return false;U.bcDraft=JSON.parse(JSON.stringify(t));U.bcDraftNew=false;}, bcNew:function(){var id='bc'+Date.now().toString(36);var t={id:id,name:'علبة جديدة',count:0,items:[]};bcData().push(t);U.bcDraft=JSON.parse(JSON.stringify(t));U.bcDraftNew=true;}, bcSaveDraft:function(){var d=U.bcDraft;if(!d)return false;var real=bcType(d.id);if(!real)return false;real.name=bcNorm(d.name)||'علبة';real.count=Math.max(0,Math.floor(Number(d.count)||0));real.items=(d.items||[]).filter(function(it){return bcNorm(it.name);}).map(function(it){return {name:bcNorm(it.name),q:Number(it.q)||0};});U.bcDraft=null;U.bcDraftNew=false;}, bcCancelDraft:function(){var d=U.bcDraft;if(d&&U.bcDraftNew){bcSeasonCur().types=bcData().filter(function(x){return x.id!==d.id;});}U.bcDraft=null;U.bcDraftNew=false;}, bcDelType:function(d){var t=bcType(d.t);if(!t)return false;if(!window.confirm('حذف العلبة "'+t.name+'"؟'))return false;bcSeasonCur().types=bcData().filter(function(x){return x.id!==d.t;});U.bcDraft=null;U.bcDraftNew=false;},
  theme:function(){var n=curTheme()==="dark"?"light":"dark";var u=sessionCode()?userByCode(sessionCode()):null;if(u){u.theme=n;save();}else setPref('theme',n);render();return false;},
  install:function(){var p=window.KH_INSTALL;if(!p)return false;p.prompt();p.userChoice.then(function(){window.KH_INSTALL=null;render();});return false;},
  login:function(){
    if(U.lbusy)return false;
    var p=(document.getElementById('lpin')||{}).value||'';U.lpinVal='';
    U.lbusy=true;U.loginErr=null;render();
    var done=function(){U.lbusy=false;};
    checkPin(p).then(function(ok){
      if(ok){lvRun(function(){done();lockSettings();bioSessionSet();liveSet();try{localStorage.setItem(AUTH_KEY,'1');}catch(e){}try{if(localStorage.getItem(BIO_KEY)&&!localStorage.getItem('khat-bio-auth'))localStorage.setItem('khat-bio-auth',localStorage.getItem(AUTH_KEY)||'1');}catch(e){}U.bioPrompt=bioSupported()&&!localStorage.getItem(BIO_KEY);render();});return null;}
      return findUserByPw(p).then(function(u){
        if(u&&u.cardActive===false){done();U.cardOffPop=true;}
        else if(u){lvRun(function(){done();lockSettings();bioSessionSet();liveSet();try{localStorage.setItem(AUTH_KEY,'u:'+u.code);}catch(e){}try{if(localStorage.getItem(BIO_KEY)&&!localStorage.getItem('khat-bio-auth'))localStorage.setItem('khat-bio-auth',localStorage.getItem(AUTH_KEY)||'1');}catch(e){}U.view='home';U.bioPrompt=bioSupported()&&!localStorage.getItem(BIO_KEY);render();});return;}
        else{done();U.loginErr='الباسورد غلط';}
        render();
      });
    }).catch(function(){done();U.loginErr='المتصفح مش بيدعم التحقق دلوقتي، افتح الصفحة من HTTPS';render();});
    return false;
  },
  padKey:function(d){
    var el=document.getElementById('lpin');if(!el)return false;
    var v=el.value||'';
    if(d.k==='del')v=v.slice(0,-1);
    else if(v.length<32)v+=d.k;
    el.value=v;U.lpinVal=v;
    var dk=document.getElementById('pdots');if(dk)dk.innerHTML=pinDotsInner(v.length);
    if(d.k!=='del'&&v.length===4){ACT.login();}
    return false;
  },
  padMode:function(){
    var el=document.getElementById('lpin');U.lpinVal=el?el.value:(U.lpinVal||'');
    U.lpadNative=!U.lpadNative;render();return false;
  },
  gdConnect:function(){
    if(!GD.tc){gdLoadGis();toast('استنى ثانية لحد ما جوجل يحمّل وجرّب تاني');return false;}
    GD.on=true;GD.needTap=false;GD.err=null;gdSaveCfg();gdRequest();
  },
  deepRefresh:function(){deepRefresh();return false;},
  toggleOwnerOnly:function(d){if(limited())return false;var p=P(d.id);if(!p)return false;p.ownerOnly=!p.ownerOnly;toast(p.ownerOnly?'الوصفة اتخفت عن الموظفين':'الوصفة ظهرت للكل');},
  gdSetHint:function(){var v=gdHint();try{if(v)localStorage.setItem('khat-gd-hint',v);else localStorage.removeItem('khat-gd-hint');}catch(e){}toast(v?'اتحفظ البريد، الدخول الجاي هيتم بيه':'اتشال البريد');},
  syncEvery:function(d){var v=Number(d.v);if(!SYNC_CHOICES.hasOwnProperty(v))return false;uiSave('syncEvery',v);toast('معدل المزامنة: '+SYNC_CHOICES[v]);render();return false;},
  gdNow:function(){
    if(!GD.on)return false;
    if(!gdTokOk()){GD.needTap=false;gdRequest();return false;}
    GD.busy=false;gdSync().then(function(){render();});return false;
  },
  gdOff:function(){
    if(hasPending()&&!confirm('فيه تعديلات لسه مترفعتش على درايف. لو فصلت دلوقتي ممكن تضيع. تكمل الفصل؟'))return false;
    obDel('main').catch(function(){});obDel('cards').catch(function(){});
    GD.on=false;GD.ok=false;GD.id=null;GD.tok=null;GD.exp=0;GD.ver=null;GD.err=null;GD.shown=null;
    try{localStorage.removeItem('khat-gd-tok');}catch(e){}
    gdSaveCfg();toast('اتفصل عن درايف');
  },
  exportBackup:function(){exportBackup();return false;},
  importBackup:function(){importBackup();return false;},
  cardOffClose:function(){U.cardOffPop=false;render();return false;},
  logout:function(){try{localStorage.removeItem(AUTH_KEY);}catch(e){}lockSettings();U.view='home';U.loginErr=null;render();return false;},
  tab:function(d){go(d.v);},
  goStock:function(){U.filter='low';go('stock');},
  filter:function(d){U.filter=d.v;},
  toggleTab:function(d){
    var a=hiddenTabs(),i=a.indexOf(d.k);
    if(i>-1)a.splice(i,1);else a.push(d.k);
    setPref('tabsHidden',a);
    render();return false;
  },
  updAdd:function(){
    if(sessionCode())return false;
    var v=((document.getElementById('updVer')||{}).value||'').trim();
    var t=((document.getElementById('updTitle')||{}).value||'').trim();
    var items=[];
    if(!t){toast('اكتب عنوان التحديث');return false;}
    if(!/^\d+(\.\d+){0,2}$/.test(v)){toast('اكتب رقم الإصدار زي 1.1.1');return false;}
    if(verCmp(v,updLatestVer())<=0){toast('الإصدار لازم يكون أعلى من آخر إصدار منشور');return false;}
    var list=updList().slice();
    var dv=parseFloat(((document.getElementById('updDur')||{}).value||'').trim());
    var du=((document.getElementById('updDurU')||{}).value)||'s';
    var dur=dv>0?Math.round(du==='s'?dv:dv*60):30;
    dur=Math.max(5,Math.min(7200,dur));
    var pv=((document.getElementById('updPrev')||{}).value||'').trim();
    if(pv&&!/^\d+(\.\d+){0,2}$/.test(pv)){toast('اكتب الإصدار السابق زي 2.0');return false;}
    if(pv&&verCmp(pv,v)>=0){toast('الإصدار السابق لازم يكون أقل من الإصدار الجديد');return false;}
    var rec={id:'upd-'+Date.now().toString(36),ver:v||'-',date:stamp(),title:t,items:items,dur:dur};
    if(pv)rec.prev=pv;
    list.unshift(rec);
    setPref('appUpdates',list);
    toast('تم نشر التحديث');
    return true;
  },
  updDel:function(d){
    if(sessionCode())return false;
    if(!confirm('تحذف التحديث ده؟'))return false;
    setPref('appUpdates',updList().filter(function(x){return x.id!==d.id;}));
    return true;
  },
  updClose:function(){return false;},
  updSeen:function(){var o=document.getElementById('updDone');if(o)o.remove();return false;},
  updSeenTop:function(d){if(d.id!=null&&d.id!=='')updMarkSeen(d.id);var t=document.getElementById('updTop');if(t)t.remove();return false;},
  updGo:function(d){var p=document.getElementById('updPrompt');if(p)p.remove();updStart(d.id);return false;},
  updStart:function(d){updStart(d.id);return false;},
  updFinish:function(d){updFinish(d.id);return false;},
  settingsSubmit:function(){
    var st=sPwStored(),mode=!st?'setup':(U.sChange?'change':'unlock');
    var get=function(id){var e=document.getElementById(id);return e?e.value:'';};
    var pw=get('spw1'),c=get('spw2'),old=get('spwOld');
    if(!/^[0-9]+$/.test(pw)||(mode==='unlock'&&!pw)){U.sErr='الـ PIN أرقام بس';render();return false;}
    var ok=function(){try{sessionStorage.setItem('khat-set-ok','1');}catch(e){}U.sErr=null;U.sChange=false;render();};
    var fail=function(){U.sErr='المتصفح مش بيدعم التحقق دلوقتي، افتح الصفحة من HTTPS';render();};
    if(mode==='unlock'){
      hexPbkdf2(pw,st.salt,st.iter).then(function(h){if(h===st.hash)ok();else{U.sErr='الـ PIN غلط';render();}}).catch(fail);
      return false;
    }
    if(!/^[0-9]{4,6}$/.test(pw)){U.sErr='الـ PIN لازم يكون من 4 لـ 6 أرقام';render();return false;}
    if(pw!==c){U.sErr='التأكيد مش مطابق';render();return false;}
    if(mode==='setup'){saveSettingsPw(pw).then(ok).catch(fail);return false;}
    if(!/^[0-9]{4,6}$/.test(old)){U.sErr='الـ PIN الحالي أرقام بس';render();return false;}
    hexPbkdf2(old,st.salt,st.iter).then(function(h){
      if(h!==st.hash){U.sErr='الـ PIN الحالي غلط';render();return;}
      return saveSettingsPw(pw).then(ok);
    }).catch(fail);
    return false;
  },
  sChangeStart:function(){U.sChange=true;U.sErr=null;render();return false;},
  sCancel:function(){U.sChange=false;U.sErr=null;render();return false;},
  sLock:function(){try{sessionStorage.removeItem('khat-set-ok');}catch(e){}U.sBioTried=false;U.view='home';U.sErr=null;render();return false;},
  toggleSeason:function(d){
    var a=hiddenSeasons(),i=a.indexOf(d.k);
    if(i>-1)a.splice(i,1);else a.push(d.k);
    setPref('seasonsHidden',a);
    render();return false;
  },
  toggleFgHide:function(d){
    var a=fgHiddenIds(),i=a.indexOf(d.p);
    if(i>-1)a.splice(i,1);else a.push(d.p);
    setPref('fgHidden',a);
    render();return false;
  },
  setSeason:function(d){U.season=d.v;if(d.v==='boxes')U.boxKind=screenKind();U.rsel=null;render();return false;},
  prodSeason:function(d){U.form.season=d.v;render();return false;},
  prodKind:function(d){U.form.shop=d.v==='shop';render();return false;},
  prodOrd:function(d){U.form.noOrder=d.v==='hide';render();return false;},
  shopTab:function(d){U.shopTab=d.v;render();return false;},
  matsToggle:function(){U.matsOpen=!U.matsOpen;render();return false;},
  newBatch:function(d){
    if(!PRODUCTS.length){toast('ضيف منتج الأول');return ACT.newProd();}
    U.form=null;U.sheet={sel:[],q:{},shop:!!(d&&d.shop)};
  },
  newMat:function(){U.sheet=null;U.confirm=null;U.form={kind:'mat',edit:null,name:'',cat:'',unit:'جرام',min:'',qty:'',storage:'مخزن جاف',exp:'',supplier:'',notes:'',alts:[]};},
  editMat:function(d){
    var m=M(d.id);U.sheet=null;U.confirm=null;
    U.form={kind:'mat',edit:m.id,origUnit:m.unit,name:unesc(m.name),cat:unesc(m.cat),unit:m.unit,min:String(m.min),qty:'',storage:m.storage||'مخزن جاف',exp:m.exp||'',supplier:unesc(m.supplier),notes:unesc(m.notes),alts:(m.alts||[]).map(function(a){return {u:a.u,f:String(a.f)};})};
  },
  newProd:function(d){
    U.sheet=null;U.osheet=null;U.confirm=null;
    U.form={kind:'prod',edit:null,noOrder:false,fgStore:'عادي',shop:!!(d&&d.shop),season:curSeason(),name:'',cat:'',unit:'قطعة',mins:'',temp:'',yield:'1',stages:[mkStage('prep','وزن الصنف')],comps:[],notes:''};
  },
  copyProd:function(d){
    var p=P(d.id);if(!p)return false;
    ACT.editProd(d);
    if(U.form){U.form.edit=null;U.form.name=unesc(p.name)+' (نسخة)';}
  },
  editProd:function(d){
    var p=P(d.id);U.sheet=null;U.osheet=null;U.confirm=null;
    U.form={kind:'prod',edit:p.id,fgStore:fgStoreOf(p),group:unesc(p.group||''),noOrder:!!p.noOrder,shop:!!p.shop,season:seasonOf(p),name:unesc(p.name),cat:unesc(p.cat),unit:PROD_UNITS.indexOf(p.unit)>-1?p.unit:(isPieceU(p.unit)?'قطعة':'جرام'),mins:(hasOven(p)?String(p.mins):''),temp:(p.temp==null?'':String(p.temp)),yield:String(p.yield||1),notes:unesc(p.notes),comps:(p.comps||[]).map(function(c){return {p:c.p,q:String(c.q)};}),
      stages:p.stages.map(function(g){
        return {kind:g.kind,name:unesc(g.name),
          ings:g.ings.map(function(i){var m=M(i.m);return {m:i.m,n:m?unesc(m.name):'',q:String(i.dq!=null?i.dq:i.q),u:i.du||(m?m.unit:'جرام')};}),
          steps:g.steps.length?g.steps.map(unesc):['']};
      })};
  },
  compAdd:function(){U.form.comps.push({p:'',q:'1'});},
  compDel:function(d){U.form.comps.splice(Number(d.i),1);},
  stAdd:function(d){var F=U.form;F.stages.push(mkStage(d.k,''));U.focus='[data-gi="'+(F.stages.length-1)+'"]'+(d.k==='prep'?'[data-ii="0"][data-fd="n"]':'[data-gf="name"]');},
  stDel:function(d){U.form.stages.splice(Number(d.gi),1);},
  stMove:function(d){
    var a=U.form.stages,i=Number(d.gi),dir=Number(d.d),j=i+dir;
    while(j>=0&&j<a.length&&a[j].kind!==a[i].kind)j+=dir;
    if(j<0||j>=a.length)return false;
    var t=a[i];a[i]=a[j];a[j]=t;
  },
  ingAdd:function(d){var g=U.form.stages[Number(d.gi)];g.ings.push(blankIng());U.focus='[data-gi="'+d.gi+'"][data-ii="'+(g.ings.length-1)+'"][data-fd="n"]';},
  ingDel:function(d){U.form.stages[Number(d.gi)].ings.splice(Number(d.ii),1);},
  stepAdd:function(d){var g=U.form.stages[Number(d.gi)];g.steps.push('');U.focus='[data-gi="'+d.gi+'"][data-ti="'+(g.steps.length-1)+'"]';},
  stepDel:function(d){var g=U.form.stages[Number(d.gi)];g.steps.splice(Number(d.ti),1);if(!g.steps.length)g.steps.push('');},
  printOrder:function(d){var o=S.orders.filter(function(x){return x.id===d.id;})[0];if(o)doPrint(printOrderHTML(o));return false;},
  printerPair:function(){
    if(!navigator.bluetooth){toast('المتصفح ده مش بيدعم البلوتوث');return false;}
    navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:BT_SERVICES}).then(function(dev){
      S.printer=Object.assign({},printerInfo(),{id:dev.id,name:dev.name||'طابعة'});
      save();render();toast('اتربطت '+(dev.name||'الطابعة')+' وهتتحفظ في درايف');
    }).catch(function(e){if(e&&e.name!=='NotFoundError')toast('الطابعة دي مش BLE، استخدم RawBT');});
    return false;
  },
  printerForget:function(){S.printer=Object.assign({},printerInfo(),{id:null,name:''});},
  printerMethod:function(d){S.printer=Object.assign({},printerInfo(),{method:d.v});},
  lblOpen:function(d){var p=P(d.p);if(!p){toast('الصنف مش موجود');return false;}U.lbl={ids:[p.id],i:0,copies:1,method:printerInfo().method||'bt'};},
  lblOpenSel:function(){var ids=(U.fgSel||[]).slice();if(!ids.length){toast('حدد صنف واحد على الأقل');return false;}U.lbl={ids:ids,i:0,copies:1,method:printerInfo().method||'bt'};},
  lblClose:function(){U.lbl=null;},
  lblPick:function(d){if(U.lbl)U.lbl.i=+d.i||0;},
  lblPaper:function(d){if(U.lbl)U.lbl.paper=lblPaperOf({paper:d.v}).k;},
  lblMethod:function(d){if(!U.lbl)return false;if(lblPaperOf(U.lbl).sheet&&d.v!=='web'){toast('الورق ده بيتطبع من المتصفح بس');return false;}U.lbl.method=d.v;},
  lblCopies:function(d){if(U.lbl)U.lbl.copies=Math.max(1,Math.min(20,(U.lbl.copies||1)+(+d.d)));},
  lblPrint:function(){
    var list=lblItems(),L=U.lbl;if(!list.length||!L)return false;
    var copies=L.copies||1,pp=lblPaperOf(L);
    if(L.method==='web'||pp.sheet){
      var html='';list.forEach(function(p){for(var c=0;c<copies;c++)html+=lblPageWrap(fgLabelHTML(p),pp);});
      doPrintLabel(html,pp);
    }else{
      var parts=[];list.forEach(function(p){for(var c=0;c<copies;c++)parts.push(fgLabelEscpos(p,pp));});
      var total=parts.reduce(function(n,x){return n+x.length;},0),bytes=new Uint8Array(total),off=0;
      parts.forEach(function(x){bytes.set(x,off);off+=x.length;});
      if(L.method==='raw')printBytesRaw(bytes);else printBytesBT(bytes);
    }
    return false;
  },
  formClose:function(){U.form=null;U.confirm=null;},
  formSave:function(){return U.form.kind==='mat'?saveMat(U.form):saveProd(U.form);},
  recExport:function(d){return recExport(d);},
  bioGo:function(){
    if(U.lbusy)return false;
    U.lbusy=true;
    bioUnlock().then(function(){
      var who='';try{who=localStorage.getItem('khat-bio-auth')||'';}catch(e){}
      if(!who){U.lbusy=false;render();toast('سجّل دخول بالرقم السري مرة، والبصمة هتشتغل بعدها');return;}
      window.LV_BIO=true;lvRun(function(){
        U.lbusy=false;U.bioOk=true;bioSessionSet();
        liveSet();try{localStorage.setItem(AUTH_KEY,who);}catch(e){}
        if(who.indexOf('u:')===0)U.view='home';
        render();
      });
    }).catch(function(e){U.lbusy=false;render();toast('البصمة ما نجحتش ('+((e&&e.name)||'خطأ')+')');});
    return false;
  },
  bioSkipAct:function(){U.bioSkip=true;bioSessionSet();render();},
  bioLater:function(){U.bioPrompt=false;},
  settingsBio:function(){
    if(limited())return false;
    bioUnlock().then(function(){try{sessionStorage.setItem('khat-set-ok','1');}catch(e){}U.sErr=null;U.sChange=false;render();})
      .catch(function(){U.sErr='ما اتعرّفش عليك، جرّب تاني أو استخدم الـ PIN';render();});
    return false;
  },
  loaderRetry:function(){GD.err=null;gdStage('جاري المحاولة…',Math.min(GD.pct||0,5));gdSync();},
  bioEnableAct:function(){bioEnable().then(function(){try{localStorage.setItem('khat-bio-auth',localStorage.getItem(AUTH_KEY)||'1');}catch(e){}U.bioPrompt=false;toast('اتفعّل فتح التطبيق بالبصمة');render();}).catch(function(){toast('تعذّر تفعيل البصمة على الجهاز ده');});},
  prepTabSet:function(d){U.prepTab=d.v;render();return false;},
  recImport:function(d){return recImportFile(d);},
  archDel:function(d){if(limited())return false;
    var p=P(d.p);if(!p||!p.archived)return false;
    var key='arch'+p.id;
    if(U.confirm!==key){U.confirm=key;setTimeout(function(){if(U.confirm===key){U.confirm=null;render();}},3000);return;}
    U.confirm=null;return permDelete(p);
  },
  formDelete:function(){
    var F=U.form;
    if(U.confirm!=='del'){U.confirm='del';setTimeout(function(){if(U.confirm==='del'){U.confirm=null;render();}},3000);return;}
    U.confirm=null;
    if(F.kind==='mat'){
      var used=PRODUCTS.filter(function(p){return p.recipe[F.edit]!==undefined;});
      if(used.length){toast('مستخدم في وصفة '+used[0].name+'، شيله منها الأول');render();return false;}
      S.materials=S.materials.filter(function(m){return m.id!==F.edit;});delete S.stock[F.edit];
    }else{
      if(PRODUCTS.some(function(x){return (x.comps||[]).some(function(c){return c.p===F.edit;});})){toast('الوصفة دي داخلة كوصفة فرعية في وصفة تانية، شيلها منها الأول');render();return false;}
      var pSel=P(F.edit);
      var inUse=S.batches.some(function(b){return b.p===F.edit;})||S.done.some(function(d){return d.p===F.edit;});
      if((S.ready[F.edit]||0)>0){toast('صفّر مخزون الصنف الأول عشان يتأرشف أو يتحذف');render();return false;}
      if(pSel&&pSel.archived)return permDelete(pSel);
      if(inUse){if(pSel)pSel.archived=true;bind(S);U.form=null;toast('اتأرشف الصنف، سجلاته القديمة فضلت محفوظة');return;}
      S.products=S.products.filter(function(p){return p.id!==F.edit;});delete S.ready[F.edit];
    }
    bind(S);U.form=null;toast('تم الحذف');
  },
  sheetClose:function(){U.sheet=null;},
  sheetSeason:function(d){var sh=U.sheet;if(!sh)return false;sh.season=d.v||null;sh.sel=[];sh.q={};},
  sheetProd:function(d){
    var sh=U.sheet,i=sh.sel.indexOf(d.p);
    if(i>-1){sh.sel.splice(i,1);}else{sh.sel.push(d.p);if(!sh.q[d.p])sh.q[d.p]=1;}
  },
  sheetQty:function(d){var sh=U.sheet;sh.q[d.p]=Math.max(0.25,Math.min(500,r3((sh.q[d.p]||1)+Number(d.d))));},
  sheetCreate:function(){
    var s=U.sheet;
    if(!s.sel.length){toast('اختار صنف واحد على الأقل');return false;}
    var ids=[],held=0;
    s.sel.forEach(function(pid){
      var id='B-'+nextBatchNo()+'-'+devId();
      var nb={id:id,p:pid,qty:s.q[pid]||1,stage:'prep',withdrawn:false,checks:[],created:Date.now(),by:actorName(),byc:actorCode()};
      var tgt=fgShortRows().filter(function(r){return r.x.p===pid&&!S.batches.some(function(b){return b.o===r.o.id&&b.p===pid;});}).sort(function(a,b){return String(a.o.due||'').localeCompare(String(b.o.due||''));})[0];
      if(tgt){nb.o=tgt.o.id;held++;}
      S.batches.push(nb);ids.push(id);
    });
    U.sheet=null;
    notifyNew(ids.length>1?'دفعات جديدة':'دفعة جديدة',ids.length>1?ids.length+' دفعات اتعملوا':'دفعة '+sid(ids[0])+' اتعملت','newb-'+Date.now(),'prep');
    toast(ids.length>1?'تم إنشاء '+ids.length+' دفعات'+(held?' · '+held+' منها اتحجزت لأوردرات':''):'تم إنشاء الدفعة '+sid(ids[0])+(held?' · اتحجزت لطلبية':''));
    go('prep');
  },
  groupMat:function(d){
    var list=String(d.ids||'').split(',').filter(Boolean).map(function(id){return batch(id);}).filter(Boolean);
    if(!list.length)return;
    var on=!list.every(function(b){return (b.mchecks||[]).indexOf(d.k)>-1;});
    list.forEach(function(x){markBy(x,'toggleMat');var cur=(x.mchecks||[]).filter(function(y){return y!==d.k;});x.mchecks=on?cur.concat([d.k]):cur;});
  },
  groupWithdraw:function(d){var n=0;String(d.ids||'').split(',').filter(Boolean).forEach(function(id){var b=batch(id);if(groupReady(b)){ACT.withdraw({id:id});n++;}});if(n)toast('تم سحب المواد لـ '+n+' دفعة');},
  withdraw:function(d){markBy(batch(d.id),'withdraw');
    var b=batch(d.id);if(!b)return;
    /* سحب الخامات مفتوح ولا يعتمد على رصيد */
    if(compShort(b).length){toast('في نقص في مخزن الإنتاج');return;}
    applyWithdraw(S,b);b.stage='prod';b.startedAt=null;b.notified=false;b.ringing=false;toast('تم تحضير المقادير وانتقلت الدفعة للإنتاج');
  },
  toggleCheck:function(d){markBy(batch(d.id),'toggleCheck');var b=batch(d.id);b.checks=toggle(b.checks,Number(d.i));},
  toggleMat:function(d){var b=batch(d.id);if(!b)return;
    /* داخل مجموعة: التعليم على المادة بيتعمل على نفس المادة في كل دفعات المجموعة */
    var g=groupKeyOf(b);
    var targets=g?S.batches.filter(function(x){return x.stage==='prep'&&!x.withdrawn&&groupKeyOf(x)===g&&matKeys(need(x),compNeed(x)).indexOf(d.k)>-1;}):[b];
    if(targets.indexOf(b)<0)targets.push(b);
    var on=(b.mchecks||[]).indexOf(d.k)<0;
    targets.forEach(function(x){markBy(x,'toggleMat');var cur=(x.mchecks||[]).filter(function(y){return y!==d.k;});x.mchecks=on?cur.concat([d.k]):cur;});
  },
  toProd:function(d){var b=batch(d.id);if(!b)return;markBy(b,'toProd');b.stage='prod';b.startedAt=null;b.notified=false;b.ringing=false;toast(b.id+' دخلت الإنتاج');},
  cancel:function(d){
    var b=batch(d.id);
    if(U.confirm!==d.id){U.confirm=d.id;setTimeout(function(){if(U.confirm===d.id){U.confirm=null;render();}},3000);return;}
    if(b.withdrawn){var dn=b.drawn||need(b);for(var k in dn)S.stock[k]=r3((S.stock[k]||0)+dn[k]);}
    compBack(b);
    tombAdd('batches',d.id);S.batches=S.batches.filter(function(x){return x.id!==d.id;});U.confirm=null;
    toast(b.withdrawn?'اتلغت الدفعة ورجعت المواد للمخزن':'اتلغت الدفعة');
  },
  startRun:function(d){markBy(batch(d.id),'startRun');var b=batch(d.id);b.startedAt=Date.now();b.notified=false;b.ringing=false;scheduleNotif(b);toast('بدأ تشغيل '+P(b.p).name);},
  skipTimer:function(d){markBy(batch(d.id),'skipTimer');var b=batch(d.id);b.startedAt=Date.now()-dur(b);},
  recv:function(d){U.recv={id:d.id,mode:d.m};},
  recvClose:function(){U.recv=null;},
  recvOk:function(){
    var el=document.getElementById('recvIn'),v=el?num(el.value):NaN;
    if(!isFinite(v)||v<0||(U.recv.mode==='add'&&v<=0)){toast('اكتب كمية صحيحة');return false;}
    var m=M(U.recv.id);
    S.stock[m.id]=r3(U.recv.mode==='add'?(S.stock[m.id]||0)+v:v);
    toast((U.recv.mode==='add'?'تم استلام ':'تم تسجيل ')+f(v)+' '+m.unit+' '+m.name);U.recv=null;
  },
  approve:function(d){if(!canApprove()){toast('مش مسموح لك تعتمد الإنتاج');return false;}markBy(batch(d.id),'approve');
    var b=batch(d.id),p=P(b.p),rej=b.rej||0,good=pc(b)-rej;
    var stk=stkQty(b),toStk=stk;
    S.done.push({id:b.id,p:b.p,code:p?p.code:'',name:p?p.name:'',unit:p?p.unit:'',qty:pc(b),good:good,rej:rej,stk:stk,at:Date.now(),o:b.o,by:b.by||'',byc:b.byc||'',ap:actorName(),apc:actorCode()});
    var ordA=b.o?S.orders.filter(function(x){return x.id===b.o;})[0]:null,itA=ordA?ordA.items.filter(function(x){return x.p===b.p;})[0]:null;
    if(itA){
      var toOrd=Math.min(stk,Math.max(0,r3(itA.qty-(itA.fs||0)-(itA.got||0))));
      itA.got=r3((itA.got||0)+toOrd);
      var still=Math.max(0,r3(itA.qty-(itA.fs||0)-(itA.got||0)));
      var fromRdy=Math.min(still,S.ready[b.p]||0);
      if(fromRdy>0){itA.got=r3(itA.got+fromRdy);S.ready[b.p]=r3(S.ready[b.p]-fromRdy);}
      var over=r3(stk-toOrd);toStk=over>0?over:0;
      if(over>0)S.ready[b.p]=r3((S.ready[b.p]||0)+over);
    }else S.ready[b.p]=(S.ready[b.p]||0)+stk;
    S.done[S.done.length-1].toStk=toStk;S.done[S.done.length-1].exp=(b.exp!=null?b.exp:defExp(p))||'';
    tombAdd('batches',d.id);S.batches=S.batches.filter(function(x){return x.id!==d.id;});
    allocReady(b.p);
    toast('اتعتمد '+f(good)+' '+p.unit+' من '+sid(b.id)+' · دخل المخزن '+f(stk));
  },
  fgFilter:function(d){U.fgf=d.v;},
  fgSeason:function(d){U.fgSeason=d.v;},
  fgSel:function(d){if(limited())return false;
    U.fgSel=U.fgSel||[];var i=U.fgSel.indexOf(d.p);
    if(i>-1)U.fgSel.splice(i,1);else U.fgSel.push(d.p);
    U.confirm=null;
  },
  fgSelAll:function(){if(limited())return false;
    var F=U.fgf||'all',vis=fgVisIds(F);U.fgSel=U.fgSel||[];
    var allIn=vis.length>0&&vis.every(function(id){return U.fgSel.indexOf(id)>-1;});
    if(allIn)U.fgSel=U.fgSel.filter(function(id){return vis.indexOf(id)<0;});
    else vis.forEach(function(id){if(U.fgSel.indexOf(id)<0)U.fgSel.push(id);});
    U.confirm=null;
  },
  fgDel:function(){if(limited())return false;
    var ids=(U.fgSel||[]).slice();if(!ids.length)return false;
    var ok=[],skip=0;
    ids.forEach(function(id){
      var p=PRODUCTS.filter(function(x){return x.id===id;})[0];
      if(!p||!isFill(p)){skip++;return;}
      if((S.ready[p.id]||0)>0||S.orders.some(function(o){return !o.deliveredAt&&(o.items||[]).some(function(it){return it.p===p.id;});})||S.batches.some(function(b){return b.p===p.id;})){skip++;return;}
      ok.push(p);
    });
    if(!ok.length){toast('مفيش أصناف في المحدد تنفع تتحذف');return false;}
    if(U.confirm!=='fgdel'){U.confirm='fgdel';setTimeout(function(){if(U.confirm==='fgdel'){U.confirm=null;render();}},3000);return;}
    var del={};ok.forEach(function(p){del[p.id]=1;});
    S.products=S.products.filter(function(x){return !del[x.id];});
    ok.forEach(function(p){delete S.ready[p.id];});
    U.fgSel=(U.fgSel||[]).filter(function(id){return !del[id];});
    U.confirm=null;bind(S);
    toast('اتحذف '+ok.length+' صنف'+(skip?' · اتعدى '+skip+' لأنه مرتبط بحاجة':''));
  },
  fgClear:function(){if(limited())return false;U.fgSel=[];U.confirm=null;},
  tplAdd:function(d){
    var p=P(d.p);if(!p)return false;
    var q=parseFloat((U.tplQ||{})[d.p]);
    if(!(q>0)){toast('اكتب كمية أكبر من صفر');return false;}
    U.tpl=U.tpl||{name:'',items:[]};
    var it=U.tpl.items.filter(function(i){return i.p===p.id;})[0];
    if(it)it.q=r3(it.q+q);else U.tpl.items.push({p:p.id,name:p.name,unit:p.unit,q:r3(q)});
    if(U.tplQ)delete U.tplQ[d.p];
  },
  tplSel:function(d){U.tplSel=U.tplSel||{};U.tplSel[d.id]=!U.tplSel[d.id];},
  boxOrderSel:function(){
    var ids=Object.keys(U.tplSel||{}).filter(function(k){return U.tplSel[k];});
    var tpls=ids.map(function(id){return (S.boxTpl||[]).filter(function(x){return x.id===id;})[0];}).filter(Boolean);
    if(!tpls.length){toast('اختار علبة واحدة على الأقل');return false;}
    var items={},added=[],split={},boxes=[],num=0;
    tpls.forEach(function(t){
      var inp=document.querySelector('[data-bcount="'+t.id+'"]');
      var n=parseInt(inp&&inp.value,10);if(!(n>0))n=(U.tplCnt||{})[t.id]||1;
      for(var k=0;k<n;k++){
        num++;boxes.push({n:num,type:t.name});
        t.items.forEach(function(i){
          items[i.p]=r3((items[i.p]||0)+i.q);
          if(added.indexOf(i.p)<0)added.push(i.p);
          split[i.p]=split[i.p]||{};
          split[i.p][num]=r3((split[i.p][num]||0)+i.q);
        });
      }
    });
    U.sheet=null;U.form=null;
    U.osheet={cust:'',items:items,added:added,boxes:boxes,box:{},split:split,due:'',season:'normal',kind:(tpls[0].kind||'cust'),step:'pick'};
    U.tplSel={};
    toast('اكمّل اسم العميل ومعاد التسليم');
  },
  tplAddAll:function(){
    var fillP=PRODUCTS.filter(function(p){return isFill(p)&&!p.archived&&(p.fill||'cust')===(U.tplKind||'cust');});
    U.tpl=U.tpl||{name:'',items:[]};
    var n=0;
    fillP.forEach(function(p){
      var q=parseFloat((U.tplQ||{})[p.id]);
      if(!(q>0))return;
      var it=U.tpl.items.filter(function(i){return i.p===p.id;})[0];
      if(it)it.q=r3(it.q+q);else U.tpl.items.push({p:p.id,name:p.name,unit:p.unit,q:r3(q)});
      delete U.tplQ[p.id];n++;
    });
    if(!n){toast('اكتب كمية في صنف واحد على الأقل');return false;}
    toast('اتضاف '+n+' صنف للقالب');
  },
  tplRemove:function(d){if(U.tpl)U.tpl.items=U.tpl.items.filter(function(i){return i.p!==d.p;});},
  tplSave:function(){
    var T=U.tpl;var nm=((document.querySelector('[data-tname]')||{}).value||T&&T.name||'').trim();
    if(!nm||!T||!T.items.length){toast('اكتب اسم القالب وضيف أصناف');return false;}
    S.boxTpl=S.boxTpl||[];
    S.boxTpl.push({id:'t'+Date.now().toString(36),name:nm,kind:(U.tplKind||'cust'),items:T.items.map(function(i){return {p:i.p,name:i.name,unit:i.unit,q:i.q};})});
    U.tpl={name:'',items:[]};toast('اتحفظ القالب');
  },
  tplDel:function(d){tombMap('boxTpl',d.id);S.boxTpl=(S.boxTpl||[]).filter(function(t){return t.id!==d.id;});},
  boxOrder:function(d){
    var t=(S.boxTpl||[]).filter(function(x){return x.id===d.id;})[0];if(!t)return false;
    var inp=document.querySelector('[data-bcount="'+d.id+'"]');var n=parseInt(inp&&inp.value,10);if(!(n>0))n=1;
    var items={},added=[],split={},boxes=[];
    for(var k=1;k<=n;k++)boxes.push({n:k,type:t.name});
    t.items.forEach(function(i){
      items[i.p]=r3((items[i.p]||0)+i.q*n);
      if(added.indexOf(i.p)<0)added.push(i.p);
      split[i.p]=split[i.p]||{};
      for(var j=1;j<=n;j++)split[i.p][j]=r3((split[i.p][j]||0)+i.q);
    });
    U.sheet=null;U.form=null;
    U.osheet={cust:'',items:items,added:added,boxes:boxes,box:{},split:split,due:'',season:'normal',kind:(t.kind||'cust'),step:'pick'};
    toast(n>1?'اتقسمت الكمية على '+n+' تعبئات':'اكمّل اسم العميل ومعاد التسليم');
  },
  wasteToggle:function(d){U.wasteOpen=(U.wasteOpen===d.p)?null:d.p;},
  wasteClose:function(){U.wasteOpen=null;},
  wasteFilter:function(d){U.wf=d.v;},
  wasteGrpOpen:function(d){U.wGrpOpen=U.wGrpOpen||{};U.wGrpOpen[d.g]=!U.wGrpOpen[d.g];},
  wasteAdd:function(d){
    var p=PRODUCTS.filter(function(x){return x.id===d.p;})[0];if(!p)return false;
    var inp=document.querySelector('[data-wq="'+d.p+'"]');
    var q=parseFloat(inp&&inp.value);
    if(!(q>0)){toast('اكتب كمية أكبر من صفر');return false;}
    var stk=S.ready[p.id]||0;
    if(q>stk){toast('الكمية أكبر من المتاح في المخزن ('+f(stk)+')');return false;}
    S.ready[p.id]=r3(stk-q);
    S.waste=S.waste||[];
    S.waste.push({id:'w'+Date.now().toString(36),p:p.id,name:p.name,qty:r3(q),at:Date.now()});
    U.wasteOpen=null;
    toast('اتسجل هالك '+f(q)+' من '+p.name);
  },
  fgZero:function(){if(limited())return false;
    var ids=U.fgSel||[];if(!ids.length)return;
    if(U.confirm!=='fgzero'){
      U.confirm='fgzero';
      setTimeout(function(){if(U.confirm==='fgzero'){U.confirm=null;render();}},3000);
      return;
    }
    ids.forEach(function(id){S.ready[id]=0;});
    toast('اتصفر مخزون '+ids.length+' صنف');
    U.confirm=null;U.fgSel=[];
  },
  lotZero:function(d){
    if(limited())return false;
    var key='lot:'+d.p+':'+d.id;
    if(U.confirm!==key){U.confirm=key;setTimeout(function(){if(U.confirm===key){U.confirm=null;render();}},3000);return;}
    var L=fgLots(d.p).filter(function(l){return String(l.id)===String(d.id);})[0];
    U.confirm=null;
    if(!L){toast('الدفعة دي خلصت');return;}
    if(d.id){S.done.forEach(function(x){if(x.p===d.p&&x.id===d.id)x.zeroed=true;});}
    S.ready[d.p]=r3((S.ready[d.p]||0)-L.q);
    toast('اتصفرت الدفعة '+(d.id||'رصيد سابق'));
  },
  cleanStart:function(){
    if(U.confirm!=='clean'){U.confirm='clean';setTimeout(function(){if(U.confirm==='clean'){U.confirm=null;render();}},3000);return;}
    S.materials=[];S.products=[];S.stock={};S.batches=[];S.done=[];S.ready={};S.demo=false;S.seq=100;S.orders=[];S.oseq=0;
    bind(S);U.confirm=null;U.filter='all';
    toast('الصفحة فاضية، ضيف أول صنف');go('recipes');ACT.newMat();
  },
  rQty:function(d){U.rqty=Math.max(1,Math.min(999,(U.rqty||1)+Number(d.d)));},
  rSet:function(d){U.rqty=Number(d.v);},
  newOrder:function(){
    if(!PRODUCTS.length){toast('ضيف منتج الأول');return ACT.newProd();}
    U.sheet=null;U.form=null;U.osheet={cust:'',items:{},added:[],boxes:[{n:1,type:''}],box:{},due:'',season:ordSeason()==='boxes'?'normal':ordSeason(),kind:U.view==='shopOrders'?'shop':'cust',step:'pick'};
  },

  oClose:function(){U.osheet=null;U.smart=null;},
  oDone:function(){
    var os=U.osheet;if(!os)return false;
    if(!(os.added||[]).length){toast('اختار صنف واحد على الأقل');return false;}
    os.step='form';
  },
  oBack:function(){var os=U.osheet;if(os)os.step='pick';},
  oTab:function(d){U.oTab=d.v;},
  boxAdd:function(){
    var os=U.osheet;if(!os)return false;
    os.boxes=os.boxes||[{n:1,type:''}];
    var n=Math.max.apply(null,os.boxes.map(function(b){return b.n;}))+1;
    os.boxes.push({n:n,type:''});
  },
  boxDel:function(d){
    var os=U.osheet;if(!os)return false;
    var n=Number(d.n);
    var used=PRODUCTS.some(function(p){return qtyIn(os,p.id,n)>0;});
    if(used){toast('انقل الأصناف اللي في التعبئة دي الأول');return false;}
    if((os.boxes||[]).length<=1){toast('لازم تفضل تعبئة واحدة على الأقل');return false;}
    os.boxes=os.boxes.filter(function(b){return b.n!==n;});
  },
  oSmart:function(){
    var os=U.osheet;if(!os)return false;
    var el=document.getElementById('smartTxt');
    var txt=el?el.value:(U.smart?U.smart.text:'');
    U.smart={text:txt,lines:smParse(txt,os.kind,os.season)};
    if(!U.smart.lines.length)U.smart=null;
  },
  oSmartPick:function(d){
    var sm=U.smart;if(!sm||!sm.lines[Number(d.i)])return false;
    var ln=sm.lines[Number(d.i)];
    var real=PRODUCTS.filter(function(x){return String(x.id)===String(d.p);})[0];
    ln.pid=real?real.id:d.p;ln.cands=[];
    if(ln.key&&ln.pid!=null){
      S.smartLearn=S.smartLearn||{};
      S.smartLearn.alias=S.smartLearn.alias||{};
      if(Object.keys(S.smartLearn.alias).length<2000)S.smartLearn.alias[ln.key]=ln.pid;
      S.smartLearn.count=(S.smartLearn.count||0)+1;
    }
    ln.kind=ln.qty==null?'noqty':'prod';
  },
  oSmartDrop:function(d){
    var sm=U.smart;if(!sm)return false;
    sm.lines.splice(Number(d.i),1);
    if(!sm.lines.length)U.smart=null;
  },
  oSmartAdd:function(){
    var os=U.osheet,sm=U.smart;if(!os||!sm)return false;
    var nP=0,nT=0,grpBox={};
    sm.lines.forEach(function(ln){
      if(ln.kind==='prod'&&ln.pid&&ln.qty>0){
        var bn=os.boxes[0].n;
        if(ln.pack){
          var g='g'+ln.grp;
          if(!grpBox[g]){
            var mx=Math.max.apply(null,os.boxes.map(function(x){return x.n;}))+1;
            os.boxes.push({n:mx,type:ln.pack});grpBox[g]=mx;
          }
          bn=grpBox[g];
        }
        smAddProd(os,ln.pid,ln.qty,bn);nP++;
      }
      else if(ln.kind==='tpl'){var t=(S.boxTpl||[]).filter(function(x){return x.id===ln.tid;})[0];if(t&&t.items.length){smAddTpl(os,t,ln.count);nT++;}}
    });
    var cust=null,due=null;
    sm.lines.forEach(function(ln){if(ln.kind==='name')cust=ln.name;if(ln.due)due=ln.due;});
    if(cust)os.cust=cust;
    if(due)os.due=due;
    U.smart=null;
    U.oTab='__all';
    toast('اتضاف: '+nP+' صنف'+(nT?' · '+nT+' قالب':'')+(cust?' · العميل: '+cust:'')+(due?' · المعاد اتحدد':''));
  },
  oPick:function(d){
    var os=U.osheet;if(!os)return false;
    os.added=os.added||[];
    var k=os.added.indexOf(d.p);
    if(k>-1){os.added.splice(k,1);delete os.items[d.p];if(os.box)delete os.box[d.p];return;}
    os.added.push(d.p);
    U.focus='[data-oq="'+d.p+'"]';
  },
  cardsExport:function(){exportCards();return false;},
  cardsImport:function(){importCards();return false;},
  stripGo:function(d){
    if(d.v&&d.v!==U.view&&routeAllowed(d.v)){U.view=d.v;return;}
    toast(smartNoteInfo().t);
  },
  uGenCode:function(d){
    var el=document.getElementById(d.target||'uCode');if(!el)return false;
    var c,tries=0;
    do{c=randUserCode();tries++;}while(userCodeTaken(c,null)&&tries<50);
    el.value=c;
    return false;
  },
  userAdd:function(){
    var n=((document.getElementById('uName')||{}).value||'').trim();
    var pw=(document.getElementById('uPw')||{}).value||'';
    if(!n){toast('اكتب اسم المستخدم');return false;}
    if(pw.length<4){toast('الباسورد لازم يكون 4 حروف أو أرقام على الأقل');return false;}
    var cIn=((document.getElementById('uCode')||{}).value||'').trim();
    if(cIn&&!validUserCode(cIn)){toast('الكود لازم يكون من ٣ لـ ١٢ حرف أو رقم');return false;}
    if(cIn&&userCodeTaken(cIn,null)){toast('الكود ده مستخدم قبل كده، اختار غيره');return false;}
    var wIn=waDigits((document.getElementById('uWa')||{}).value);if(wIn&&!/^[0-9]{10,15}$/.test(wIn)){toast('اكتب رقم الواتساب صح');return false;}
    var jobIn=((document.getElementById('uJob')||{}).value||'').trim(),joinIn=((document.getElementById('uJoin')||{}).value||'');
    var code=cIn||nextUserCode(),salt=randHex();
    toast('جاري إضافة المستخدم...');
    /* الفحوصات الثلاثة بتشتغل مع بعض بدل ما تستنى بعض */
    Promise.all([checkPin(pw),findUserByPw(pw),hexPbkdf2(pw,salt,200000)]).then(function(r){
      if(r[0]){toast('الباسورد ده بتاع المالك، اختار غيره');return;}
      if(r[1]){toast('الباسورد ده مستخدم قبل كده، اختار غيره');return;}
      if(userCodeTaken(code,null)){toast('الكود ده اتاخد للتو، جرّب كود تاني');return;}
      usersList().push({id:'U'+Date.now().toString(36),name:n,code:code,salt:salt,h:r[2],iter:200000,wa:wIn||null,job:jobIn||null,joinDate:joinIn||null});
      permSaveFor(code,Object.assign({},DEFAULT_PERMS));
      var nu=document.getElementById('uName'),np=document.getElementById('uPw'),nc=document.getElementById('uCode');if(nu)nu.value='';if(np)np.value='';if(nc)nc.value='';var nwa=document.getElementById('uWa');if(nwa)nwa.value='';
      ['uJob','uJoin'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
      toast('اتضاف المستخدم · الكود '+code);render();
    }).catch(function(){toast('حصل خطأ، جرّب تاني');});
    return false;
  },
  matPick:function(d){
    var el=document.querySelector('[data-fd="n"][data-gi="'+d.gi+'"][data-ii="'+d.ii+'"]');
    if(!el)return false;
    el.value=d.n;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    var box=document.querySelector('[data-msug="'+d.gi+'-'+d.ii+'"]');if(box)box.innerHTML='';
    return false;
  },
  hrToggle:function(d){
    var h=(pref('hours',null)||DAY_NAMES.map(function(){return {on:false,from:'09:00',to:'18:00'};})).map(function(x){return Object.assign({},x);});
    var i=Number(d.d);h[i]=Object.assign({from:'09:00',to:'18:00'},h[i],{on:!(h[i]&&h[i].on)});
    setPref('hours',h);
  },
  userLeave:function(d){
    var u=usersList().filter(function(x){return x.id===d.id;})[0];
    var ms=trustedNow();
    if(!u)return false;
    if(ms===null){toast('محتاج إنترنت عشان نحدد تاريخ النهاردة');return false;}
    var today=cairoDateKey(ms);
    u.leave=(u.leave===today)?null:today;
    toast(u.leave?'اتسجلت إجازة '+u.name+' النهاردة':'اتلغت إجازة '+u.name);
  },
  userPwOpen:function(d){U.pwUser=d.id;U.editUser=null;U.confirm=null;render();return false;},
  userPwCancel:function(){U.pwUser=null;},
  userEditOpen:function(d){U.editUser=d.id;U.pwUser=null;U.confirm=null;render();return false;},
  userEditCancel:function(){U.editUser=null;},
  userEditSave:function(){
    var u=usersList().filter(function(x){return x.id===U.editUser;})[0];
    if(!u){U.editUser=null;return false;}
    var g=function(id){return ((document.getElementById(id)||{}).value||'').trim();};
    var n=g('uEditName'),c=g('uEditCode'),pw=g('uEditPw'),lf=g('uLeaveFrom'),lt=g('uLeaveTo'),wo=g('uWeekOff');
    var jb=g('uEditJob'),jd=g('uEditJoin');var wmv=g('uWeekMove');
    var wa=waDigits(g('uEditWa'));
    if(wa&&!/^[0-9]{10,15}$/.test(wa)){toast('اكتب رقم الواتساب صح');return false;}
    if(!n){toast('اكتب اسم المستخدم');return false;}
    if(!validUserCode(c)){toast('الكود لازم يكون من ٣ لـ ١٢ حرف أو رقم');return false;}
    if(c.toLowerCase()!==String(u.code).toLowerCase()&&userCodeTaken(c,u.id)){toast('الكود ده مستخدم قبل كده، اختار غيره');return false;}
    if((lf&&!lt)||(lt&&!lf)){toast('حدد بداية ونهاية الإجازة');return false;}
    if(lf&&lt&&lt<lf){toast('نهاية الإجازة لازم تكون بعد البداية');return false;}
    var woN=(wo===''?null:Number(wo));
    var newMove=null,nowM=trustedNow(),todayM=nowM===null?null:cairoDateKey(nowM);
    if(wmv!==''){
      if(woN===null){toast('حدد يوم الإجازة الأسبوعي الأول');return false;}
      if(Number(wmv)===woN){toast('اليوم المؤجل لازم يكون غير يوم الإجازة الأسبوعي');return false;}
      var cm=weekMoveOf(u);
      var same=cm&&weekdayOfKey(cm.to)===Number(wmv)&&weekdayOfKey(cm.from)===woN&&(!todayM||cm.to>=todayM);
      if(same)newMove=cm;
      else if(!todayM){toast('محتاج إنترنت عشان نحسب تاريخ التأجيل');return false;}
      else newMove=weekMoveFor(woN,Number(wmv),todayM);
    }
    if(pw&&pw.length<4){toast('الباسورد لازم يكون 4 حروف أو أرقام على الأقل');return false;}
    var finish=function(){
      var old=u.code;
      if(c!==old)renameUserCode(old,c);
      u.name=n;u.code=c;u.wa=wa||null;u.job=jb||null;u.joinDate=jd||null;
      var sh={};document.querySelectorAll('[data-cf]').forEach(function(el){sh[el.getAttribute('data-cf')]=el.checked;});u.show=sh;
      u.leaveFrom=lf||null;u.leaveTo=lt||null;
      var ca=document.querySelector('[data-cactive]');if(ca)u.cardActive=ca.checked;
      u.weekOff=wo===''?null:Number(wo);
      u.weekMove=newMove;
      U.editUser=null;U.pwUser=null;save();
      toast('اتحفظت التعديلات'+(c!==old?' · الكود الجديد '+c:''));render();
    };
    if(!pw){finish();return false;}
    var salt=randHex();
    toast('جاري حفظ التعديلات...');
    Promise.all([checkPin(pw),findUserByPw(pw),hexPbkdf2(pw,salt,200000)]).then(function(r){
      if(r[0]){toast('الباسورد ده بتاع المالك، اختار غيره');return;}
      if(r[1]&&r[1].id!==u.id){toast('الباسورد ده مستخدم قبل كده، اختار غيره');return;}
      u.salt=salt;u.h=r[2];u.iter=200000;
      finish();
    }).catch(function(){toast('حصل خطأ، جرّب تاني');});
    return false;
  },
  weekMoveClear:function(){
    var el=document.getElementById('uWeekMove');if(el)el.value='';
    return false;
  },
  userLeaveClear:function(){
    ['uLeaveFrom','uLeaveTo'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    return false;
  },
  matPick:function(d){
    var el=document.querySelector('[data-fd="n"][data-gi="'+d.gi+'"][data-ii="'+d.ii+'"]');
    if(!el)return false;
    el.value=d.n;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    var box=document.querySelector('[data-msug="'+d.gi+'-'+d.ii+'"]');if(box)box.innerHTML='';
    return false;
  },
  hrToggle:function(d){
    var h=(pref('hours',null)||DAY_NAMES.map(function(){return {on:false,from:'09:00',to:'18:00'};})).map(function(x){return Object.assign({},x);});
    var i=Number(d.d);h[i]=Object.assign({from:'09:00',to:'18:00'},h[i],{on:!(h[i]&&h[i].on)});
    setPref('hours',h);
  },
  userLeave:function(d){
    var u=usersList().filter(function(x){return x.id===d.id;})[0];
    var ms=trustedNow();
    if(!u)return false;
    if(ms===null){toast('محتاج إنترنت عشان نحدد تاريخ النهاردة');return false;}
    var today=cairoDateKey(ms);
    u.leave=(u.leave===today)?null:today;
    toast(u.leave?'اتسجلت إجازة '+u.name+' النهاردة':'اتلغت إجازة '+u.name);
  },
  userPwOpen:function(d){U.pwUser=d.id;U.editUser=null;U.confirm=null;render();return false;},
  userPwCancel:function(){U.pwUser=null;},
  userEditOpen:function(d){U.editUser=d.id;U.pwUser=null;U.confirm=null;render();return false;},
  userEditCancel:function(){U.editUser=null;},
  userPwSave:function(){
    var u=usersList().filter(function(x){return x.id===U.pwUser;})[0];
    if(!u){U.pwUser=null;return;}
    var pw=(document.getElementById('uPwNew')||{}).value||'';
    if(pw.length<4){toast('الباسورد لازم يكون 4 حروف أو أرقام على الأقل');return false;}
    var salt=randHex();
    toast('جاري حفظ الباسورد...');
    Promise.all([checkPin(pw),findUserByPw(pw),hexPbkdf2(pw,salt,200000)]).then(function(r){
      if(r[0]){toast('الباسورد ده بتاع المالك، اختار غيره');return;}
      if(r[1]&&r[1].id!==u.id){toast('الباسورد ده مستخدم قبل كده، اختار غيره');return;}
      u.salt=salt;u.h=r[2];u.iter=200000;U.pwUser=null;save();
      toast('اتغيّر باسورد '+u.name);render();
    }).catch(function(){toast('حصل خطأ، جرّب تاني');});
    return false;
  },
  userDel:function(d){
    if(U.confirm!=='udel:'+d.id){U.confirm='udel:'+d.id;setTimeout(function(){if(U.confirm==='udel:'+d.id){U.confirm=null;render();}},3000);render();return false;}
    var u=usersList().filter(function(x){return x.id===d.id;})[0];
    S.users=usersList().filter(function(x){return x.id!==d.id;});
    if(u){var m=Object.assign({},pref('perms',{}));delete m[u.code];setPref('perms',m);var am=Object.assign({},pref('aperms',{}));delete am[u.code];setPref('aperms',am);}
    U.confirm=null;toast('اتشال المستخدم');render();return false;
  },
  permSel:function(d){U.permUser=d.id;render();return false;},
  permSet:function(d){
    var u=usersList().filter(function(x){return x.id===d.u;})[0];if(!u)return false;
    var o=Object.assign({},permsOf(u.code));
    if(d.lv==='none')delete o[d.k];else o[d.k]=d.lv;
    permSaveFor(u.code,o);render();return false;
  },
  permPreset:function(d){
    var u=usersList().filter(function(x){return x.id===d.u;})[0];if(!u)return false;
    var fn=PERM_PRESET_DEF[d.p];if(!fn)return false;
    permSaveFor(u.code,fn(permCatalog()));render();toast('اتطبق القالب');return false;
  },
  permTplSave:function(d){
    var u=usersList().filter(function(x){return x.id===d.u;})[0];if(!u)return false;
    var name=(window.prompt('اسم القالب اللي هتحفظ بيه الصلاحيات دي؟','')||'').trim();
    if(!name)return false;
    var list=(pref('savedPermTpls',[])||[]).slice();
    list.push({id:'t'+Date.now(),name:name,perms:Object.assign({},permsOf(u.code)),aperms:Object.assign({},(pref('aperms',{})[u.code])||{})});
    setPref('savedPermTpls',list);render();toast('اتحفظ القالب');return false;
  },
  permTplApply:function(d){
    var u=usersList().filter(function(x){return x.id===d.u;})[0];if(!u)return false;
    var t=(pref('savedPermTpls',[])||[]).filter(function(x){return x.id===d.t;})[0];if(!t)return false;
    permSaveFor(u.code,Object.assign({},t.perms));
    var m=Object.assign({},pref('aperms',{}));m[u.code]=Object.assign({},t.aperms||{});setPref('aperms',m);
    render();toast('اتطبق القالب');return false;
  },
  permTplDel:function(d){
    setPref('savedPermTpls',(pref('savedPermTpls',[])||[]).filter(function(x){return x.id!==d.t;}));
    render();return false;
  },
  permSec:function(d){U.permSec=d.s;render();return false;},
  permActSet:function(d){
    var u=usersList().filter(function(x){return x.id===d.u;})[0];if(!u)return false;
    var m=Object.assign({},pref('aperms',{}));var o=Object.assign({},m[u.code]||{});
    if(d.lv==='def')delete o[d.a];else o[d.a]=d.lv;
    m[u.code]=o;setPref('aperms',m);render();return false;
  },
  permActAll:function(d){
    var u=usersList().filter(function(x){return x.id===d.u;})[0];if(!u)return false;
    var m=Object.assign({},pref('aperms',{}));var o=Object.assign({},m[u.code]||{});
    Object.keys(ACT_CAT).forEach(function(a){
      if(ACT_CAT[a][0]!==d.s)return;
      if(d.lv==='def')delete o[a];else o[a]=d.lv;
    });
    m[u.code]=o;setPref('aperms',m);render();toast('اتطبق على القسم');return false;
  },
  calNav:function(d){U.calMonth=calShift(U.calMonth||calCur(),Number(d.m));U.calDay=null;render();return false;},
  calToday:function(){U.calMonth=null;U.calAnchor=null;U.calDay=null;render();return false;},
  calMode:function(d){U.calMode=d.m;U.calDay=null;if(d.m==='month'){U.calAnchor=null;}else{U.calAnchor=U.calMonth?U.calMonth+'-01':(U.calAnchor||calTodayKey()||null);}return true;},
  calStep:function(d){U.calAnchor=calAddDays(calAnchorKey(),Number(d.n)*(calMode()==='week'?7:1));return true;},
  calGoDay:function(d){U.calAnchor=d.d;U.calDay=null;return true;},
  calDay:function(d){if(!(calGroup()[d.d]||[]).length){toast('مفيش أوردرات في اليوم ده');return false;}U.calDay=d.d;render();return false;},
  calClose:function(){U.calDay=null;render();return false;},
  calEditOrder:function(d){
    var o=(S.orders||[]).filter(function(x){return x.id===d.id;})[0];
    if(!o){toast('الأوردر ده مش موجود');return false;}
    U.calDay=null;U.view=okind(o)==='shop'?'shopOrders':'orders';
    ACT.oEdit({id:o.id});
    render();return false;
  },
  uFilter:function(d){U.uFilter=d.f;render();return false;},
  evUser:function(d){U.evUser=d.c||'';U.evN=40;render();return false;},
  evMore:function(d){U.evN=(U.evN||40)+40;render();return false;},
  evOpen:function(d){U.evBatch=d.k||null;render();return false;},
  evBack:function(d){U.evBatch=null;render();return false;},
  syncOpen:function(){U.syncOpen=true;render();syncLiveStart();return false;},
  syncClose:function(){U.syncOpen=false;syncLiveStop();render();return false;},
  syncNow:function(){
    if(!GD.on)return false;
    if(!gdTokOk()){GD.needTap=false;gdRequest();return false;}
    GD.busy=false;render();gdSync().then(function(){render();});return false;
  },
  evPrint:function(d){printEvents(U.evUser||'');return false;},
  uSort:function(d){U.uSort=d.s;render();return false;},
  userCardToggle:function(d){
    var u=usersList().filter(function(x){return x.id===d.id;})[0];if(!u)return false;
    u.cardActive=(u.cardActive===false);
    save();toast(u.cardActive?'الكارت اتفعّل':'الكارت اتوقف');render();return false;
  },
  foldToggle:function(d){U.folds=U.folds||{};U.folds[d.k]=!U.folds[d.k];render();return false;},
  oCreate:function(){
    var os=U.osheet,list=PRODUCTS.filter(function(p){return (os.items[p.id]||0)>0;});
    if(!list.length){toast('اختار منتج وكمية');return false;}
    if(!os.due){toast('اكتب معاد التسليم');return false;}
    var eo=os.edit?(S.orders||[]).filter(function(x){return x.id===os.edit&&!x.deliveredAt;})[0]:null;
    if(os.edit&&!eo){toast('الأوردر ده اتسلّم أو اتلغى، مينفعش يتعدّل');return false;}
    if(eo)(eo.items||[]).forEach(function(it){S.ready[it.p]=r3((S.ready[it.p]||0)+(Number(it.fs)||0));});
    if(!eo)S.oseq++;
    var id=eo?eo.id:('O-'+S.oseq+'-'+devId()),now=Date.now(),lacks=0;
    var items=[];
    list.forEach(function(p){
      var avail=S.ready[p.id]||0,short=false;
      partsOf(os,p.id).forEach(function(pt){
        var fs=Math.min(pt.qty,avail);avail=r3(avail-fs);
        if(pt.qty-fs>0)short=true;
        items.push({p:p.id,qty:pt.qty,fs:fs,got:0,pack:boxTypeOf(os,pt.box),box:pt.box});
      });
      S.ready[p.id]=r3(avail);
      if(short)lacks++;
    });
    if(eo){
      eo.items=items;eo.cust=esc((os.cust||'').trim());eo.due=os.due;eo.season=os.season||'normal';eo.note=esc((os.note||'').trim());
      U.osheet=null;U.oexp=null;
      toast('اتعدّلت الطلبية '+id+(lacks?' · فيه '+lacks+' صنف ناقص':' · كلها من المخزن'));
      return;
    }
    S.orders.push({id:id,kind:os.kind||'cust',cust:esc((os.cust||'').trim()),items:items,created:now,due:os.due,season:os.season||'normal',note:esc((os.note||'').trim())});
    notifyNew('أوردر جديد',((os.cust||'').trim()||'بدون اسم')+' · '+id+(os.due?' · ميعاد: '+os.due:''),'order-'+id,'orders');
    U.osheet=null;U.oexp=null;
    toast('تم تسجيل الطلبية '+id+(lacks?' · فيه '+lacks+' صنف ناقص، شوفه في مخزن الإنتاج':' · كلها من المخزن'));
  },
  oToggle:function(d){U.oexp=U.oexp===d.id?null:d.id;},
  oEdit:function(d){
    var o=(S.orders||[]).filter(function(x){return x.id===d.id&&!x.deliveredAt;})[0];
    if(!o){toast('مينفعش تعدّل أوردر اتسلّم');return false;}
    var items={},added=[],split={},boxes=[];
    (o.items||[]).forEach(function(it){
      items[it.p]=r3((items[it.p]||0)+(Number(it.qty)||0));
      if(added.indexOf(it.p)<0)added.push(it.p);
      var bn=it.box||1;
      split[it.p]=split[it.p]||{};split[it.p][bn]=r3((split[it.p][bn]||0)+(Number(it.qty)||0));
      if(!boxes.some(function(b){return b.n===bn;}))boxes.push({n:bn,type:it.pack||''});
    });
    boxes.sort(function(a,b){return a.n-b.n;});
    U.sheet=null;U.form=null;
    U.osheet={cust:unesc(o.cust||''),note:unesc(o.note||''),items:items,added:added,boxes:boxes,box:{},split:split,due:o.due||'',season:o.season||'normal',kind:o.kind||'cust',step:'pick',edit:o.id};
    toast('عدّل التفاصيل واحفظ');
  },
  printAllOrders:function(d){
    var list=ordersOf(d.k||'cust').filter(function(o){return !o.deliveredAt;});
    if(!list.length){toast('مفيش أوردرات تتطبع');return false;}
    var old=document.title;document.title='الأوردرات '+stamp();
    doPrint(printAllHTML(list));document.title=old;return false;
  },
  exportBatchMats:function(){
    var list=S.batches.filter(function(b){return b.stage==='prep'&&!b.withdrawn;});
    if(!list.length){toast('مفيش دفعات بانتظار السحب');return false;}
    var old=document.title;document.title='خامات الدفعات '+stamp();
    doPrint(batchMatsHTML(list));document.title=old;return false;
  },
  monthPdf:function(d){
    var old=document.title;document.title='تقرير '+(d.kind==='shop'?'أوردرات المحل':'الأوردرات')+' شهر '+d.k;
    try{printReport(document.title,monthReportHTML(d.k,d.kind));}catch(e){toast('حصلت مشكلة في التقرير');}document.title=old;return false;
  },
  resTick:function(d){
    var o=S.orders.filter(function(x){return x.id===d.id;})[0];if(!o)return false;
    var it=(o.items||[]).filter(function(i){return i.p===d.p;})[0];if(!it)return false;
    var x=ordShort(o).filter(function(r){return r.p===d.p;})[0];
    if(x&&x.short>0){toast('الصنف ده لسه ناقص، مينفعش تعلّمه');return false;}
    it.ok=!it.ok;
  },
  oDeliver:function(d){
    var o=S.orders.filter(function(x){return x.id===d.id;})[0];if(!o)return false;
    if(orderBatches(o).length||!ordComplete(o)){toast('الأوردر لسه ناقص أصناف، شوف النواقص');return false;}
    if(!allOk(o)){toast('علّم كل الأصناف في صفحة تحت التشغيل الأول');return false;}
    o.deliveredAt=Date.now();toast('تم تسليم '+o.id+' وأرشفته');
  },
  monthDelArchive:function(d){
    if(limited())return false;
    var key=lockKey(d.kind,d.k);
    if(U.confirm!=='delarch:'+key){
      U.confirm='delarch:'+key;
      setTimeout(function(){if(U.confirm==='delarch:'+key){U.confirm=null;render();}},4000);
      return;
    }
    U.confirm=null;
    /* الأرشيف ده النسخة الوحيدة من بيانات الشهر، فبنمسحه بس بعد تأكيد المالك */
    Object.keys(S.archive||{}).forEach(function(x){if(S.archive[x]&&S.archive[x].month===d.k){tombMap('archive',x);delete S.archive[x];}});
    if(S.locks){['cust','shop'].forEach(function(kd){var lk=lockKey(kd,d.k);if(S.locks[lk]!==undefined){tombMap('locks',lk);delete S.locks[lk];}});}
    save();render();toast('الشهر اتحذف من الأرشيف');return false;
  },
  lockMonth:function(d){
    var key=lockKey(d.kind,d.k);
    if(S.orders.some(function(o){return !o.deliveredAt&&!closeKeep(o);})){toast('فيه أوردرات لسه مش متسلّمة، سلّمها الأول');return false;}
    if(S.batches.length){toast('فيه دفعات لسه شغالة، خلّصها الأول');return false;}
    if(U.confirm!=='lock:'+key){U.confirm='lock:'+key;setTimeout(function(){if(U.confirm==='lock:'+key){U.confirm=null;render();}},3000);return;}
    U.confirm=null;
    var cp=function(x){return JSON.parse(JSON.stringify(x));};
    var toArch=S.orders.filter(function(o){return !closeKeep(o);});
    var keep=S.orders.filter(closeKeep);
    /* أرشفة نسخة كاملة قبل المسح */
    S.archive=S.archive||{};
    S.archive['close|'+d.k+'|'+Date.now()]={kind:'all',month:d.k,at:Date.now(),orders:cp(toArch),batches:cp(S.batches),done:cp(S.done),stock:cp(S.stock||{})};
    /* مسح كل البيانات السابقة، والأوردرات المستقبلية بتفضل */
    toArch.forEach(function(o){tombAdd('orders',o.id);});
    S.batches.forEach(function(b){tombAdd('batches',b.id);});
    S.done.forEach(function(x){tombAdd('done',x.id);});
    keep.forEach(function(o){o.keepAfterLock=true;});
    S.orders=keep;S.batches=[];S.done=[];
    S.stock={};
    S.locks=S.locks||{};S.locks[lockKey('cust',d.k)]=Date.now();S.locks[lockKey('shop',d.k)]=Date.now();
    U.oexp=null;U.sheet=null;U.form=null;U.osheet=null;U.recv=null;
    bind(S);
    toast('اتقفل شهر '+d.k+' واتأرشف. الأوردرات اللي تسليمها بعد النهارده فضلت');
  },
  fillPick:function(d){
    var p=PRODUCTS.filter(function(x){return x.id===d.id;})[0];
    if(!p)return false;
    U.fill=U.fill||{name:'',kind:'cust',q:{}};
    U.fill.name=p.name;U.fill.grp=p.grp||'';
    if(isFill(p)){
      U.fill.kind=p.fill;U.fill.unit=p.unit;
      /* اختيار الصنف من الاقتراحات بيملي الخامات والكميات من آخر تشغيل زي ما بيحصل وانت بتكتب */
      var lrP=fillLastRun(p);
      if(lrP){
        U.fill.autoName=p.name;
        U.fill.sel=lrP.from.map(function(x){return x.p;});
        U.fill.q={};lrP.from.forEach(function(x){U.fill.q[x.p]=x.q;});
        U.fill.out=String(lrP.out);
      }
    }
  },
  grpOpen:function(d){U.oGrp=U.oGrp||{};U.oGrp[d.g]=!U.oGrp[d.g];},
  fgGrpOpen:function(d){U.fGrpOpen=U.fGrpOpen||{};U.fGrpOpen[d.g]=!U.fGrpOpen[d.g];},
  fillFromShort:function(d){var p=P(d.p);if(!p)return false;var a=shortByProduct(fgShortRows()).filter(function(x){return x.p===d.p;})[0];if(!a)return false;
    /* صنف نهائي: بيتفتح في صفحة تسجيل الإنتاج نفسها، بالاسم والكمية الناقصة */
    ACT.runPick({id:p.id});U.run.out=String(r3(a.short));fillRescale(U.run);U.fillTab='run';},
  fillSel:function(d){
    U.fill=U.fill||{name:'',kind:'cust',q:{}};U.fill.sel=U.fill.sel||[];
    var k=U.fill.sel.indexOf(d.p);
    if(k>-1){U.fill.sel.splice(k,1);if(U.fill.q)delete U.fill.q[d.p];}
    else U.fill.sel.push(d.p);
  },
  fillGrp:function(d){U.fill=U.fill||{name:'',kind:'cust',q:{}};U.fill.grp=d.v;},
  fillUnit:function(d){U.fill=U.fill||{name:'',kind:'cust',q:{}};U.fill.unit=d.v;},
  fillKind:function(d){U.fill=U.fill||{name:'',kind:'cust',q:{}};U.fill.kind=d.v;},
  fillSeason:function(d){U.fill=U.fill||{name:'',kind:'cust',q:{}};U.fill.season=d.v;},
  fillEdit:function(d){
    var kind=(U.fgf||'fillcust').slice(4);
    if(d.id==='new'){U.fedit={id:'new',kind:kind,name:'',store:'عادي',yield:'',rows:[]};return;}
    var p=PRODUCTS.filter(function(x){return String(x.id)===String(d.id);})[0];
    if(!p||!isFill(p))return false;
    var lr=p.runFrom?null:fillLastRun(p);
    var src=p.runFrom||(lr?lr.from:[]);
    var yv=p.runOut!=null?p.runOut:(lr?lr.out:'');
    U.fedit={id:p.id,kind:p.fill,name:p.name,grp:p.grp||'',store:fgStoreOf(p),yield:yv,rows:src.map(function(x){return {p:x.p,q:x.q};})};
  },
  feAdd:function(){
    var E=U.fedit;if(!E)return false;
    feSync();
    var sel=document.getElementById('feAddSel');var v=sel?sel.value:'';
    if(!v){toast('اختار خامة الأول');return false;}
    var real=PRODUCTS.filter(function(x){return String(x.id)===String(v);})[0];
    if(!real)return false;
    if(E.rows.some(function(r){return String(r.p)===String(real.id);})){toast('الخامة دي موجودة قبل كده');return false;}
    E.rows.push({p:real.id,q:''});
  },
  feToggle:function(d){
    var E=U.fedit;if(!E)return false;
    feSync();
    var real=PRODUCTS.filter(function(x){return String(x.id)===String(d.p);})[0];
    var pid=real?real.id:d.p,idx=-1;
    E.rows.forEach(function(r,k){if(String(r.p)===String(pid))idx=k;});
    if(idx>-1)E.rows.splice(idx,1);else E.rows.push({p:pid,q:''});
  },
  feRemove:function(d){return ACT.feToggle(d);},
  feCancel:function(){U.fedit=null;},
  feSave:function(){
    var E=U.fedit;if(!E)return false;
    feSync();
    var name=String(E.name||'').trim();
    if(!name){toast('اكتب اسم الصنف');return false;}
    var dup=PRODUCTS.filter(function(x){return isFill(x)&&!x.archived&&String(x.name||'').trim()===name&&String(x.id)!==String(E.id);})[0];
    if(dup){toast('فيه صنف بنفس الاسم ده');return false;}
    var Y=num(E.yield);
    if(!(Y>0)){toast('اكتب الناتج في الدفعة');return false;}
    var rows=(E.rows||[]).map(function(r){return {p:r.p,q:num(r.q)};}).filter(function(r){return r.q>0;});
    if(!rows.length){toast('اختار خامة واكتب كميتها');return false;}
    var grp=String(E.grp||'').trim();
    var ex=E.id==='new'?null:PRODUCTS.filter(function(x){return String(x.id)===String(E.id);})[0];
    if(ex){
      ex.name=name;ex.grp=grp;ex.shelf=esc(String(E.shelf||'').trim());ex.runFrom=rows;ex.runOut=Y;ex.fgStore=FG_STORES.indexOf(E.store)>-1?E.store:'عادي';
      toast('اتحفظ '+name);
    }else{
      var codes=[];
      rows.forEach(function(r){var sp=P(r.p);if(sp&&sp.code!=null&&codes.indexOf(String(sp.code))<0)codes.push(String(sp.code));});
      var np={id:'p'+Date.now().toString(36),name:name,code:mergedCode(),srcCodes:codes,season:'normal',grp:grp,unit:'قطعة',mins:0,yield:1,comps:[],recipe:{},prep:[],shop:E.kind==='shop',fill:E.kind,by:actorCode(),from:[],fromTotal:0,outTotal:0,legacyFrom:[],legacyOutEstimate:0,fillRuns:[],shelf:esc(String(E.shelf||'').trim()),runFrom:rows,runOut:Y,fgStore:FG_STORES.indexOf(E.store)>-1?E.store:'عادي'};
      S.products.push(np);S.ready[np.id]=0;allocReady(np.id);
      toast('اتضاف '+name);
    }
    bind(S);U.fedit=null;
  },
  fillMake:function(){
    var F=U.fill||{name:'',kind:'cust',q:{},out:'',unit:'قطعة',sel:[]};
    var name=String(F.name||'').trim();
    if(!name){toast('اكتب اسم الصنف');return false;}
    var ex=PRODUCTS.filter(function(x){return isFill(x)&&String(x.name||'').trim()===name;})[0];
    if(ex&&!F.allowExisting){toast('الصنف ده موجود قبل كده، شغّله من تبويب حشو');return false;}
    if(ex&&!(F.sel||[]).length){
      var lr0=fillLastRun(ex);
      if(lr0){
        F.q=F.q||{};F.sel=lr0.from.map(function(x){return x.p;});
        lr0.from.forEach(function(x){F.q[x.p]=x.q;});
        if(!(num(F.out)>0))F.out=String(lr0.out);
      }
    }
    var out=num(F.out);
    if(!(isFinite(out)&&out>0)){toast('اكتب الكمية الناتجة');return false;}
    var src=PRODUCTS.filter(function(p){return !isFill(p)&&!p.archived&&(F.q[p.id]||0)>0;});
    if(!src.length){toast('اختار خامة واحدة على الأقل واكتب الكمية المسحوبة');return false;}
    for(var i=0;i<src.length;i++){
      if(F.q[src[i].id]>(S.ready[src[i].id]||0)+1e-9){toast('الكمية أكبر من المتاح في '+src[i].name);return false;}
    }
    var unit=F.unit||'قطعة';
    var codes=[];
    function addCode(c){if(c!==undefined&&c!==null&&c!==''&&codes.indexOf(String(c))<0)codes.push(String(c));}
    src.forEach(function(p){addCode(p.code);});
    var pulled=r3(src.reduce(function(a,p){return a+F.q[p.id];},0));
    src.forEach(function(p){S.ready[p.id]=r3((S.ready[p.id]||0)-F.q[p.id]);});
    if(ex){
      var prev=(ex.srcCodes||[]).slice();
      codes.forEach(function(c){if(prev.indexOf(c)<0)prev.push(c);});
      ex.srcCodes=prev;
      /* حفظ كل تشغيله بناتجها ومكوناتها حتى تتحسب احتياجات العجز بدقة */
      if(!Array.isArray(ex.fillRuns)){
        ex.legacyFrom=(ex.from||[]).map(function(x){return {p:x.p,q:x.q||x.t||0};});
        ex.legacyOutEstimate=ex.fromTotal||0; // تقدير للبيانات القديمة التي لم تسجل الناتج لكل تشغيله
        ex.fillRuns=[];
      }
      ex.fillRuns.push({at:Date.now(),out:out,by:actorCode(),from:src.map(function(p){return {p:p.id,q:F.q[p.id]};}),exp:defExp(ex)});
      S.ready[ex.id]=r3((S.ready[ex.id]||0)+out);
      ex.from=(ex.from||[]).concat(src.map(function(p){return {p:p.id,q:F.q[p.id],t:F.q[p.id]};}));
      ex.fromTotal=r3((ex.fromTotal||0)+pulled);
      ex.outTotal=r3((ex.outTotal||0)+out);
      if((F.grp||'').trim())ex.grp=(F.grp||'').trim();
      if(F.season)ex.season=F.season;
      allocReady(ex.id);
      bind(S);U.fill=null;
      toast('اتزودت '+name+' بكمية '+f(r3(out))+' '+ex.unit+' وأكوادها اتضافت');
      return;
    }
    var code=mergedCode();
    var np={id:'p'+Date.now().toString(36),name:name,code:code,srcCodes:codes,season:F.season||'normal',grp:(F.grp||'').trim(),unit:unit,mins:0,yield:1,comps:[],recipe:{},prep:[],shop:F.kind==='shop',fill:F.kind,by:actorCode(),
      from:src.map(function(p){return {p:p.id,q:F.q[p.id],t:F.q[p.id]};}),fromTotal:pulled,outTotal:out,legacyFrom:[],legacyOutEstimate:0,fillRuns:[{at:Date.now(),out:out,by:actorCode(),from:src.map(function(p){return {p:p.id,q:F.q[p.id]};})}]};
    S.products.push(np);S.ready[np.id]=r3(out);allocReady(np.id);
    np.fillRuns[0].exp=defExp(np);
    bind(S);U.fill=null;
    toast('اتعمل '+name+' بكود '+code+' وكمية '+f(r3(out))+' '+unit);
  },
  oCancel:function(d){
    var lo=S.orders.filter(function(x){return x.id===d.id;})[0];
    if(lo&&isLocked(lo)){
      /* الشهر المقفول: المالك بس يقدر يلغي، وبعد تأكيد تاني */
      if(limited()){toast('الشهر ده اتقفل، الأوردر مش ينفع يتلغي');return false;}
      if(U.confirm!=='cancellock'+d.id){
        U.confirm='cancellock'+d.id;
        setTimeout(function(){if(U.confirm==='cancellock'+d.id){U.confirm=null;render();}},4000);
        toast('الشهر ده متقفل. الإلغاء هيشيل الأوردر من القايمة. اضغط إلغاء تاني للتأكيد');
        return false;
      }
      U.confirm='o'+d.id;
    }
    var key='o'+d.id,bs=S.batches.filter(function(b){return b.o===d.id;});
    if(bs.some(function(b){return b.stage!=='prep';})){toast('في دفعات دخلت الإنتاج، ما ينفعش تلغي الطلبية');return false;}
    if(U.confirm!==key){U.confirm=key;setTimeout(function(){if(U.confirm===key){U.confirm=null;render();}},3000);return;}
    bs.forEach(function(b){if(b.withdrawn){var dn=b.drawn||need(b);for(var k in dn)S.stock[k]=r3((S.stock[k]||0)+dn[k]);}compBack(b);});
    if(lo)lo.items.forEach(function(it){var back=(it.fs||0)+(it.got||0);if(back>0)S.ready[it.p]=r3((S.ready[it.p]||0)+back);});
    bs.forEach(function(b){tombAdd('batches',b.id);});tombAdd('orders',d.id);
    S.batches=S.batches.filter(function(b){return b.o!==d.id;});
    S.orders=S.orders.filter(function(o){return o.id!==d.id;});
    U.confirm=null;toast('اتلغت الطلبية');
  },
  oDelete:function(d){
    var lo=S.orders.filter(function(x){return x.id===d.id;})[0];
    if(!lo)return false;
    if(isLocked(lo)){
      /* الشهر المقفول: المالك بس يقدر يحذف، وبعد تأكيد تاني */
      if(limited()){toast('الشهر ده اتقفل، الأوردر مش ينفع يتحذف');return false;}
      if(U.confirm!=='dellock'+d.id){
        U.confirm='dellock'+d.id;
        setTimeout(function(){if(U.confirm==='dellock'+d.id){U.confirm=null;render();}},4000);
        toast('الشهر ده متقفل. الحذف هيشيل الأوردر من القايمة. اضغط حذف تاني للتأكيد');
        return false;
      }
      U.confirm='del'+d.id;
    }
    var key='del'+d.id,bs=S.batches.filter(function(b){return b.o===d.id;});
    if(bs.length){toast('الأوردر فيه دفعات في الإنتاج، ما ينفعش يتحذف');return false;}
    if(U.confirm!==key){U.confirm=key;setTimeout(function(){if(U.confirm===key){U.confirm=null;render();}},3000);return;}
    (lo.items||[]).forEach(function(it){var back=(it.fs||0)+(it.got||0);if(back>0)S.ready[it.p]=r3((S.ready[it.p]||0)+back);});
    tombAdd('orders',d.id);
    S.orders=S.orders.filter(function(o){return o.id!==d.id;});
    U.confirm=null;toast('اتحذف الأوردر والكميات رجعت للمخزن');
  },
  stopAlarm:function(){S.batches.forEach(function(b){b.ringing=false;});stopAlarmLoop();},
  notifAsk:function(){try{Notification.requestPermission().then(function(){render();}).catch(function(){});}catch(e){}},
  notifLater:function(){U.notifLater=true;},
  testAlarm:function(){unlockAudio();beep();buzz();showSysNotif('تجربة التنبيه','لو وصلك الإشعار بصوت واهتزاز يبقى شغال','test');toast('لو سمعت الصوت وحسيت الاهتزاز يبقى التنبيه شغال');return false;},
};
var READ_ACTS={calNav:1,calDay:1,calClose:1,calToday:1,deepRefresh:1,resetOpen:1,resetBack:1,resetSend:1,resetApprove:1,resetReject:1,notifAsk:1,notifLater:1,wasteToggle:1,wasteClose:1,wasteFilter:1,wasteGrpOpen:1,tab:1,fgFilter:1,fgSel:1,fgClear:1,goStock:1,filter:1,rQty:1,rSet:1,oToggle:1,oClose:1,sheetClose:1,sheetProd:1,sheetQty:1,
  formClose:1,altAdd:1,altDel:1,stAdd:1,stMove:1,stDel:1,ingAdd:1,ingDel:1,stepAdd:1,stepDel:1,stopAlarm:1,testAlarm:1,
  printOrder:1,printAllOrders:1,exportBatchMats:1,monthPdf:1,logout:1,login:1,gdConnect:1,gdOff:1,recvClose:1,recv:1,
  newOrder:1,oEdit:1,newBatch:1,newMat:1,newProd:1,editMat:1,editProd:1,toggle:1,rQty:1,theme:1,install:1,matsToggle:1,prodKind:1,prodOrd:1,setSeason:1,prodSeason:1,toggleSeason:1,shopTab:1,toggleTab:1,settingsSubmit:1,settingsBio:1,bioGo:1,bioSkipAct:1,bioEnableAct:1,sChangeStart:1,sCancel:1,sLock:1};
/* ألوان الحقول: أخضر مع علامة صح، أو أحمر مع علامة غلط */
/* حذف جهاز من القايمة (ما ينفعش على الجهاز اللي انت فيه) */
function synDelDevice(k){
  if(!S.devs||!S.devs[k])return;
  if(!window.confirm('تشيل الجهاز ده من القايمة؟ لو كان لسه بيشتغل هيرجع يظهر تلقائي.'))return;
  delete S.devs[k];
  if(S.devUser)delete S.devUser[k];
  S.devGone=S.devGone||{};S.devGone[k]=nowStamp();
  save();render();
}
function paintField(id,st){
  if(id==='rLast'){paintBox(st);return;}
  var inp=document.getElementById(id);if(!inp)return;
  var c=st==='ok'?'#22c55e':st==='bad'?'#ef4444':'';
  var ic=document.getElementById(id+'Ic');
  var side=id==='rLast'?'right:20px':'right:14px';
  inp.style.borderColor=c;if(id!=='rLast')inp.style.paddingInlineStart=c?'38px':'';inp.style.paddingInlineEnd='';
  if(!c){if(ic&&ic.parentNode)ic.parentNode.removeChild(ic);return;}
  if(!ic){ic=document.createElement('span');ic.id=id+'Ic';ic.style.cssText='position:absolute;'+side+';top:50%;transform:translateY(-50%);font-weight:700';inp.parentNode.appendChild(ic);}
  ic.style.color=c;ic.textContent=st==='ok'?'✓':'✕';
}
/* بيتنادى وإحنا بنكتب: بيلوّن ويعرض الرقم المخفي من غير ما يعيد رسم الفورم (عشان الـ PIN ميتمسحش) */
function resetLiveCheck(){
  var code=((document.getElementById('rCode')||{}).value||'').trim();
  var last=lastDigits();
  var u=findUserByCode(code);
  paintField('rCode',!code?'':(u?'ok':'bad'));
  if(!u||last.length<4){paintField('rLast','');return;}
  paintField('rLast',waDigits(u.wa).slice(-4)===last?'ok':'bad');
}
document.addEventListener('input',function(e){if(e.target&&e.target.id==='rCode')resetLiveCheck();});
/* الـ PIN بيتفحص وإنت بتكتبه: لو مستخدم قبل كده (عند حد تاني أو عند نفس المستخدم أو المالك) بيتلون أحمر فوراً */
var PIN_T=null,PIN_SEQ=0;
function setRErr(msg){var el=document.getElementById('rErr');if(el){el.textContent=msg||'';el.style.display=msg?'block':'none';}}
function pinReuseCands(u){
  var c=usersList().filter(function(x){return x.salt&&x.h;}).map(function(x){return {salt:x.salt,h:x.h,iter:x.iter||200000};});
  if(u)(u.hist||[]).forEach(function(x){c.push(x);});
  if(S.auth&&S.auth.salt&&S.auth.hash)c.push({salt:S.auth.salt,h:S.auth.hash,iter:S.auth.iter||200000});
  return c;
}
function pinLiveCheck(){
  var pw=((document.getElementById('rPw')||{}).value||''),pw2=((document.getElementById('rPw2')||{}).value||'');
  var seq=++PIN_SEQ;clearTimeout(PIN_T);
  if(pw2)paintField('rPw2',pw2!==pw?'bad':(/^[0-9]{4,6}$/.test(pw)?'ok':''));
  if(!/^[0-9]{4,6}$/.test(pw)){paintField('rPw','');setRErr('');return;}
  var u=findUserByCode(((document.getElementById('rCode')||{}).value||'').trim());
  PIN_T=setTimeout(function(){
    var cands=pinReuseCands(u);
    Promise.all(cands.map(function(x){return hexPbkdf2(pw,x.salt,x.iter).then(function(h){return h===x.h;});})).then(function(hits){
      if(seq!==PIN_SEQ)return;
      if(hits.some(Boolean)){paintField('rPw','bad');if(pw2)paintField('rPw2','bad');setRErr('الـ PIN ده مستخدم قبل كده، اختار PIN جديد غيره');}
      else{paintField('rPw','ok');if(pw2&&pw2===pw)paintField('rPw2','ok');setRErr('');}
    });
  },400);
}
document.addEventListener('input',function(e){if(e.target&&(e.target.id==='rPw'||e.target.id==='rPw2'))pinLiveCheck();});
ACT.resetOpen=function(){U.reset=true;U.rVerified=null;U.resetErr=null;U.resetDone=null;U.rMark=null;U.rv=null;};
ACT.resetBack=function(){U.reset=false;U.rVerified=null;U.resetErr=null;U.resetDone=null;U.rMark=null;U.rv=null;};
/* الأخطاء بتظهر من غير ما الفورم يتعاد رسمه، عشان الكود والـ PIN اللي كتبتهم يفضلوا مكانهم */
function resetShowErr(msg){var el=document.getElementById('rErr');if(el){el.textContent=msg;el.style.display='block';}toast(msg);}
function resetMarks(m){m=m||{};paintField('rCode',m.code||'');paintField('rLast',m.last||'');paintField('rPw',m.pw||'');paintField('rPw2',m.pw2||'');}
ACT.resetSend=function(){
  var g=function(id){return ((document.getElementById(id)||{}).value||'').trim();};
  if(!U.rVerified)return fail('اكتب الكود وآخر ٤ أرقام من الواتساب الأول');
  var code=g('rCode'),last=lastDigits();
  var pw=(document.getElementById('rPw')||{}).value||'',pw2=(document.getElementById('rPw2')||{}).value||'';
  var u=findUserByCode(code);
  var fail=function(msg,mark){resetShowErr(msg);resetMarks(mark);return false;};
  if(!code)return fail('اكتب الكود بتاعك');
  if(!u)return fail('الكود ده مش موجود',{code:'bad'});
  if(u.cardActive===false)return fail('الكارت ده موقوف، مينفعش تغيّر الـ PIN دلوقتي. كلم المالك عشان يفعّله الأول',{code:'ok'});
  var waD=waDigits(u.wa);
  if(!waD)return fail('المستخدم ده مش متسجل عنده رقم واتساب، كلم المالك',{code:'ok'});
  if(!/^[0-9]{4}$/.test(last))return fail('اكتب آخر ٤ أرقام من رقم الواتساب',{code:'ok'});
  if(waD.slice(-4)!==last)return fail('آخر ٤ أرقام مش مطابقة لرقم الواتساب المسجل',{code:'ok',last:'bad'});
  if(!/^[0-9]{4,6}$/.test(pw))return fail('الـ PIN لازم يكون من 4 لـ 6 أرقام بس',{code:'ok',last:'ok',pw:'bad'});
  if(pw!==pw2)return fail('التأكيد مش مطابق',{code:'ok',last:'ok',pw2:'bad'});
  /* الـ PIN ميكونش مستخدم: لا عند حد تاني ولا عند المستخدم نفسه قبل كده، ولا عند المالك */
  var cands=usersList().filter(function(x){return x.salt&&x.h;}).map(function(x){return {salt:x.salt,h:x.h,iter:x.iter||200000};});
  (u.hist||[]).forEach(function(x){cands.push(x);});
  if(S.auth&&S.auth.salt&&S.auth.hash)cands.push({salt:S.auth.salt,h:S.auth.hash,iter:S.auth.iter||200000});
  Promise.all(cands.map(function(x){return hexPbkdf2(pw,x.salt,x.iter).then(function(h){return h===x.h;});})).then(function(hits){
    if(hits.some(Boolean)){
      resetShowErr('الـ PIN ده مستخدم قبل كده، اختار PIN جديد غيره');
      resetMarks({code:'ok',last:'ok',pw:'bad',pw2:'bad'});
      return;
    }
    var salt=randHex();
    return hexPbkdf2(pw,salt,200000).then(function(h){
      if(u.salt&&u.h)u.hist=(u.hist||[]).concat([{salt:u.salt,h:u.h,iter:u.iter||200000}]).slice(-5);
      u.salt=salt;u.h=h;u.iter=200000;
      save();
      U.resetErr=null;U.rMark=null;U.rv=null;U.resetDone=true;render();
    });
  }).catch(function(){resetShowErr('المتصفح مش بيدعم التحقق دلوقتي، افتح الصفحة من HTTPS');});
  return false;
};
ACT.resetApprove=function(d){
  var rs=pref('resetReqs',[]),r=rs.filter(function(x){return x.id===d.id;})[0];
  if(!r)return false;
  var u=usersList().filter(function(x){return x.code===r.code;})[0];
  if(!u){toast('المستخدم ده مش موجود');}
  else if(u.cardActive===false){toast('الكارت ده موقوف، فعّله الأول عشان تغيّر الـ PIN');return false;}
  else{
    u.salt=r.salt;u.h=r.h;u.iter=r.iter;
    toast('اتغيّر الـ PIN بتاع '+u.name);
    if(r.wa)window.open('https://wa.me/'+r.wa+'?text='+encodeURIComponent('تم اعتماد الـ PIN الجديد بتاعك في RMY Pro ✅\nتقدر تدخل بيه دلوقتي.'),'_blank');
  }
  setPref('resetReqs',rs.filter(function(x){return x.id!==d.id;}));
};
ACT.resetReject=function(d){
  var rs=pref('resetReqs',[]),r=rs.filter(function(x){return x.id===d.id;})[0];
  setPref('resetReqs',rs.filter(function(x){return x.id!==d.id;}));
  toast('اترفض الطلب');
  if(r&&r.wa)window.open('https://wa.me/'+r.wa+'?text='+encodeURIComponent('للأسف طلب تغيير الـ PIN بتاعك في RMY Pro اترفض. كلم المالك لو محتاج مساعدة.'),'_blank');
};
ACT.altAdd=function(){var F=U.form;F.alts=F.alts||[];var u=UNITS_M.filter(function(x){return x!==F.unit;})[0];F.alts.push({u:u,f:''});};
ACT.altDel=function(d){if(U.form&&U.form.alts)U.form.alts.splice(Number(d.i),1);};
ACT.batchSuggestApply=function(){
  var sg=batchSuggestions(),made=0;
  if(!sg.length){toast('مفيش نواقص تحتاج دفعات');return false;}
  sg.forEach(function(x){
    for(var i=0;i<x.n;i++){
      var id='B-'+nextBatchNo()+'-'+devId();
      S.batches.push({id:id,p:x.pid,qty:x.per,stage:'prep',withdrawn:false,checks:[],created:Date.now(),by:actorName(),byc:actorCode()});made++;
    }
  });
  toast('اتعملت '+made+' دفعة مقترحة');
  notifyNew('دفعات جديدة',made+' دفعة مقترحة اتعملت','newb-'+Date.now(),'prep');
  go('prep');
};
ACT.fillTab=function(d){U.fillTab=d.v;};
ACT.runPick=function(d){
  var p=P(d.id);if(!p)return false;
  var lr=fillLastRun(p);
  var R={name:p.name,pid:p.id,grp:p.grp||'',q:{},out:'',sel:[]};
  if(lr){R.sel=lr.from.map(function(x){return x.p;});lr.from.forEach(function(x){R.q[x.p]=x.q;});R.out=String(lr.out);}
  U.run=R;
};
ACT.runDo=function(){
  var R=U.run;if(!R||!R.pid){toast('اختار الصنف المحشو الأول');return false;}
  var p=P(R.pid);if(!p){toast('الصنف ده مش موجود');return false;}
  if(!(num(R.out)>0)){toast('اكتب الكمية الناتجة');return false;}
  if(!(R.sel||[]).length){toast('الصنف ده ملوش خامات');return false;}
  var short=R.sel.some(function(pid){return (num(R.q[pid])||0)>(S.ready[pid]||0)+1e-9;});
  if(short){toast('فيه خامات ناقصة في المخزن');return false;}
  U.fill={allowExisting:true,name:String(p.name||'').trim(),kind:p.fill||'cust',q:Object.assign({},R.q),out:String(R.out),unit:p.unit||'قطعة',sel:R.sel.slice(),grp:p.grp||'',season:p.season||'normal'};
  if(ACT.fillMake()===false){U.fill=null;return false;}
  U.run=null;
};
ACT.runMakeBatches=function(){
  var R=U.run;if(!R)return false;
  var made=0;
  (R.sel||[]).forEach(function(pid){
    var lack=runNetLack(R,pid);if(!(lack>0))return;
    var qty=Math.ceil(r3(lack/yieldOf(pid)));if(!(qty>0))return;
    var id='B-'+nextBatchNo()+'-'+devId();
    S.batches.push({id:id,p:pid,qty:qty,stage:'prep',withdrawn:false,checks:[],created:Date.now(),by:actorName(),byc:actorCode()});
    made++;
  });
  if(!made){toast('مفيش نواقص تحتاج دفعات');return false;}
  toast('اتعمل '+made+' دفعة للنواقص');
  notifyNew('دفعات جديدة',made+' دفعة اتعملت للنواقص','newb-'+Date.now(),'prep');
};
ACT.userHoursToggle=function(d){
  var u=usersList().filter(function(x){return x.id===d.id;})[0];
  if(!u)return false;
  u.noHours=!u.noHours;
  toast(u.noHours?'مواعيد العمل مش هتتطبق على '+u.name:'مواعيد العمل هتتطبق على '+u.name);
};
ACT.prepBatches=function(){
  var lk=prepLackTotals(),ks=Object.keys(lk);
  if(!ks.length){toast('مفيش تحضيرات ناقصة');return false;}
  var made=0;
  ks.forEach(function(pid){
    /* الدفعة بتتعمل كاملة: لو فيه نقص أقل من وجبة كاملة بتتعمل وجبة كاملة واحدة، ولو أكتر بتتعمل بالعدد الكامل اللي يكفي */
    var qty=Math.ceil(r3(lk[pid]/yieldOf(pid)));
    if(!(qty>0))return;
    var id='B-'+nextBatchNo()+'-'+devId();
    S.batches.push({id:id,p:pid,qty:qty,stage:'prep',withdrawn:false,checks:[],created:Date.now(),by:actorName(),byc:actorCode()});
    made++;
  });
  if(!made){toast('مفيش تحضيرات ناقصة');return false;}
  toast('تم إنشاء '+made+' دفعة كاملة للتحضيرات الناقصة');
  notifyNew('دفعات جديدة',made+' دفعة كاملة اتعملت للتحضيرات الناقصة','newb-'+Date.now(),'prep');
  go('prep');
};
ACT.plToggle=function(d){
  U.plSel=U.plSel||[];var i=U.plSel.indexOf(d.id);
  if(i>-1)U.plSel.splice(i,1);else U.plSel.push(d.id);
};
ACT.sTab=function(d){U.sTab=(d.k===''||d.k==null)?null:+d.k;};
ACT.plAll=function(){
  var ids=prodRunsAll().map(function(r){return r.id;});
  U.plSel=(U.plSel||[]).length===ids.length?[]:ids;
};
ACT.plDel=function(){
  var ids=(U.plSel||[]);
  if(!ids.length){toast('اختار دفعات الأول');return false;}
  if(U.confirm!=='pldel'){U.confirm='pldel';setTimeout(function(){if(U.confirm==='pldel'){U.confirm=null;render();}},3000);return;}
  U.confirm=null;
  S.plogTomb=S.plogTomb||{};
  ids.forEach(function(id){
    if(String(id).indexOf('f:')===0){
      var parts=String(id).split(':'),pr=S.products.filter(function(x){return x.id===parts[1];})[0];
      var run=pr&&Array.isArray(pr.fillRuns)?pr.fillRuns[+parts[2]]:null;
      if(run)run.logHidden=true;
      return;
    }
    delete S.plog[id];S.plogTomb[id]=Date.now();
  });
  U.plSel=[];
  toast('اتمسحت '+ids.length+' دفعة من السجل');
};
ACT.rpOpen=function(d){var k=(d&&d.k==='shop')?'shop':'cust';if(!U.rp||U.rp.kind!==k)U.rp={kind:k,sel:[],q:1,search:''};U.rp.open=true;};
ACT.rpClose=function(){if(U.rp)U.rp.open=false;};
ACT.rpToggle=function(d){var s=rpState(),i=s.sel.indexOf(d.p);if(i>-1)s.sel.splice(i,1);else s.sel.push(d.p);};
ACT.rpAll=function(){var s=rpState();rpAvail().forEach(function(p){if(s.sel.indexOf(p.id)<0)s.sel.push(p.id);});};
ACT.rpNone=function(){rpState().sel=[];};
ACT.rpPrint=function(){
  var s=rpState();
  var list=prodsOf(s.kind).filter(function(p){return s.sel.indexOf(p.id)>-1;});
  if(!list.length){toast('اختار وصفة واحدة على الأقل');return false;}
  var old=document.title;document.title='وصفات '+stamp();
  doPrint(recipePrintHTML(list,s.q>0?s.q:1));document.title=old;return false;
};
READ_ACTS.rpOpen=1;READ_ACTS.rpClose=1;READ_ACTS.rpToggle=1;READ_ACTS.rpAll=1;READ_ACTS.rpNone=1;READ_ACTS.rpPrint=1;
READ_ACTS.plToggle=1;READ_ACTS.plAll=1;READ_ACTS.sTab=1;READ_ACTS.fillTab=1;READ_ACTS.fillFromShort=1;READ_ACTS.runPick=1;
document.addEventListener('click',function(e){
  var t=e.target.closest?e.target.closest('[data-act]'):null;
  if(!t||t.disabled)return;
  var fn=ACT[t.dataset.act];if(!fn)return;
  if(!actBypass(t.dataset.act)&&!actAllowed(t.dataset.act)){toast('مش مسموح لك تعمل الإجراء ده');return;}
  markSeen(t.dataset.act);
  var rr=fn(t.dataset);
  logUserAct(t.dataset.act,t.dataset);
  if(rr===false)return;
  save();render();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&e.target&&/^spw/.test(e.target.id||'')){ACT.settingsSubmit();return;}
  if(e.key==='Enter'&&e.target&&e.target.id==='lpin'){ACT.login();return;}
  if(e.key==='Enter'&&e.target&&e.target.id==='recvIn'){
    if(!canWrite()){toast('مش مسموح بالتعديل في القسم ده');return;}
    if(ACT.recvOk()!==false){save();render();}
  }
  if(e.key==='Escape'&&(U.sheet||U.form||U.osheet||(U.rp&&U.rp.open))){U.sheet=null;U.form=null;U.osheet=null;if(U.rp)U.rp.open=false;render();}
});
/* تطبيع للعربي: بيشيل التشكيل، ويوحّد الألف والياء والتاء المربوطة عشان الكتابة تتطابق */
function matNorm(s){
  return String(s||'').replace(/[\u064B-\u0652\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').trim().toLowerCase();
}
function matSuggestBox(t){
  var box=document.querySelector('[data-msug="'+t.dataset.gi+'-'+t.dataset.ii+'"]');
  if(!box)return;
  var q=matNorm(t.value);
  if(!q){box.innerHTML='';return;}
  var dups=matDupNames();
  var hits=MATERIALS.filter(function(m){return matNorm(unesc(m.name)).indexOf(q)>-1;})
    .sort(function(a,b){
      var x=matNorm(unesc(a.name)).indexOf(q)===0?0:1,y=matNorm(unesc(b.name)).indexOf(q)===0?0:1;
      return x-y;
    }).slice(0,6);
  box.innerHTML=hits.map(function(m){
    var lbl=matOptLabel(m,dups);
    return '<button type="button" class="msugBtn" data-act="matPick" data-gi="'+t.dataset.gi+'" data-ii="'+t.dataset.ii+'" data-n="'+esc(lbl)+'">'+esc(lbl)+'</button>';
  }).join('');
}
function onField(e){
  var t=e.target,F=U.form,d=t&&t.dataset;
  if(!d)return;
  if(d.fg!==undefined){U.fill=U.fill||{name:'',kind:'cust',q:{}};U.fill.grp=t.value;return;}
  if(d.fn!==undefined){
    U.fill=U.fill||{name:'',kind:'cust',q:{}};U.fill.name=t.value;
    var sb=document.getElementById('fillSug');if(sb)sb.innerHTML=fillSuggest(U.fill);
    var mb=document.getElementById('fillMakeBtn');if(mb)mb.disabled=fillDupName(U.fill.name);
    return;
  }
  if(d.rn!==undefined){
    U.run=U.run||{name:'',pid:null,grp:'',q:{},out:'',sel:[]};U.run.name=t.value;
    var rpk=U.run.pid?P(U.run.pid):null;
    if(rpk&&String(rpk.name||'').trim()!==String(t.value||'').trim()){U.run.pid=null;U.run.sel=[];U.run.q={};U.run.out='';var rbx=document.querySelector('[data-ro]');if(rbx)rbx.value='';var rbd=document.getElementById('runBody');if(rbd)rbd.innerHTML=runBodyHTML(U.run);}
    var rsg=document.getElementById('runSug');if(rsg)rsg.innerHTML=runSuggest(U.run);
    return;
  }
  if(d.ro!==undefined){
    U.run=U.run||{name:'',pid:null,grp:'',q:{},out:'',sel:[]};U.run.out=t.value;fillRescale(U.run);
    var rbd2=document.getElementById('runBody');if(rbd2)rbd2.innerHTML=runBodyHTML(U.run);
    return;
  }
  if(d.fq!==undefined){U.fill=U.fill||{name:'',kind:'cust',q:{}};var fv=num(t.value);U.fill.q[d.fq]=(isFinite(fv)&&fv>0)?r3(fv):0;return;}
  if(d.fo!==undefined){
    U.fill=U.fill||{name:'',kind:'cust',q:{}};U.fill.out=t.value;
    fillRescale(U.fill);
    Object.keys(U.fill.q||{}).forEach(function(id){var el=document.querySelector('[data-fq="'+id+'"]');if(el)el.value=U.fill.q[id]||'';});
    var sbo=document.getElementById('fillSug');if(sbo)sbo.innerHTML=fillSuggest(U.fill);
    return;
  }
  if(d.sq!==undefined&&U.sheet){var sv=num(t.value);U.sheet.q[d.sq]=(isFinite(sv)&&sv>0)?Math.min(500,r3(sv)):1;var oe=document.querySelector('[data-out="'+d.sq+'"]');if(oe&&P(d.sq))oe.textContent=batchOutTxt(P(d.sq),U.sheet.q[d.sq]);return;}
  if(d.oq!==undefined&&U.osheet){var ov=num(t.value);U.osheet.items[d.oq]=(isFinite(ov)&&ov>=0)?Math.min(99999,qFloor(P(d.oq),ov)):0;return;}
  if(d.exp!==undefined){var eb=batch(d.exp);if(eb)eb.exp=t.value||'';return;}
  if(d.tdate!==undefined){
    if(!canWrite()){toast('مش مسموح لك تعدّل هنا');render();return;}
    var frd=fillRunOf(d.tdate);if(frd){frd.run.exp=t.value||'';frd.run.expOk=0;save();render();return;}
    var tdn=S.done.filter(function(x){return x.id===d.tdate;})[0];
    if(tdn){tdn.exp=t.value||'';tdn.expOk=0;save();render();}
    return;
  }
  if(d.stk!==undefined){var sb=batch(d.stk),v=num(t.value);sb.stk=(isFinite(v)&&v>=0)?r3(v):0;return;}
  if(d.rej!==undefined){var rb=batch(d.rej),rv=num(t.value);rb.rej=(isFinite(rv)&&rv>=0)?Math.min(pc(rb),r3(rv)):0;if(rb.stk==null){var se=document.querySelector('[data-stk="'+rb.id+'"]');if(se)se.value=pc(rb)-rb.rej;}return;}
  if(d.rsq!==undefined){U.rsearch=t.value;rSearchUpdate();return;}
  if(d.rs!==undefined){U.rsel=t.value;U.rqty=1;if(e&&e.type==='change')render();return;}
  if(U.osheet&&d.oc!==undefined){U.osheet.cust=t.value;return;}
  if(U.osheet&&d.od!==undefined){var dv=t.value;if(dv&&/T\d\d:\d\d/.test(dv)&&!/T\d\d:00/.test(dv)){dv=dv.replace(/T(\d\d):\d\d/,'T$1:00');t.value=dv;}U.osheet.due=dv;return;}
  if(d.af!==undefined&&U.form&&U.form.alts){var al=U.form.alts[Number(d.af)];if(al){if(d.afk==='u')al.u=t.value;else al.f=t.value;}return;}
  if(!F)return;
  if(d.f!==undefined){F[d.f]=t.value;return;}
  if(d.ci!==undefined){var cr=(F.comps||[])[Number(d.ci)];if(cr){if(d.cf==='p')cr.p=t.value;else cr.q=t.value;}return;}
  if(d.gi===undefined||!F.stages)return;
  var g=F.stages[Number(d.gi)];if(!g)return;
  if(d.gf==='name'){g.name=t.value;}
  else if(d.ii!==undefined){
    var r=g.ings[Number(d.ii)];if(!r)return;
    if(d.fd==='n'){
      r.n=t.value;
      matSuggestBox(t);
      var mm=findMat(t.value);
      r.m=mm?mm.id:null;if(mm)r.u=mm.unit;
      try{
        var ln=t.closest('.iline'),su=ln&&ln.querySelector('select');
        if(su){su.innerHTML=ingUnitOpts(r);su.value=r.u;su.disabled=false;}
      }catch(x){}
    }
    else if(d.fd==='q')r.q=t.value;
    else if(d.fd==='u')r.u=t.value;
  }
  else if(d.ti!==undefined){g.steps[Number(d.ti)]=t.value;}
}
document.addEventListener('input',onField);
document.addEventListener('change',function(e){var ds=e.target&&e.target.dataset;
  if(ds&&ds.hr!==undefined){var hh=(pref('hours',null)||DAY_NAMES.map(function(){return {on:false,from:'09:00',to:'18:00'};})).map(function(x){return Object.assign({},x);});var di=Number(ds.d);hh[di]=Object.assign({on:true,from:'09:00',to:'18:00'},hh[di]);hh[di][ds.hr]=e.target.value||hh[di][ds.hr];setPref('hours',hh);render();return;}
  if(ds&&ds.btype!==undefined&&U.osheet){var bb=(U.osheet.boxes||[]).filter(function(b){return b.n===Number(ds.btype);})[0];if(bb)bb.type=e.target.value;render();return;}
  if(ds&&ds.ibox!==undefined&&U.osheet){U.osheet.box=U.osheet.box||{};U.osheet.box[ds.ibox]=Number(e.target.value);render();return;}
  if(ds&&ds.oadd!==undefined){var v=e.target.value;if(v&&U.osheet){U.osheet.added=U.osheet.added||[];if(U.osheet.added.indexOf(v)<0)U.osheet.added.push(v);if(U.osheet.items[v]===undefined)U.osheet.items[v]=0;}render();return;}if(ds&&(ds.oq!==undefined||ds.opk!==undefined)){onField(e);render();return;}if(ds&&ds.sq!==undefined){onField(e);render();return;}if(ds&&ds.f==='unit'&&U.form){onField(e);render();return;}if(ds&&ds.rs!==undefined)onField(e);if(ds&&(ds.rej!==undefined||ds.stk!==undefined)){if(!canWrite()){toast('مش مسموح بالتعديل في القسم ده');return;}onField(e);save();render();}});
syncTime();
setInterval(function(){if(!document.hidden)syncTime();},300000);
document.addEventListener('visibilitychange',function(){if(!document.hidden)syncTime();});
/* الإجازة بتخص يوم واحد: أول ما اليوم يتغير بتتلغي لوحدها من البيانات */
/* بيتعمل مرة واحدة كل يوم عند تغيير التاريخ بتوقيت القاهرة (منتصف الليل)، حتى لو التطبيق كان مقفول وقتها */
function clearStaleLeaves(){
  var ms=trustedNow();if(ms===null)return;
  var today=cairoDateKey(ms);
  var last=null;try{last=localStorage.getItem('khat-leave-day');}catch(e){}
  if(last===today)return;
  var changed=false;
  usersList().forEach(function(u){if(u.leave&&u.leave!==today){u.leave=null;changed=true;}if(u.weekMove&&u.weekMove.to<today){u.weekMove=null;changed=true;}});
  try{localStorage.setItem('khat-leave-day',today);}catch(e){}
  if(changed)save();
}
setInterval(function(){
  clearStaleLeaves();
  if(!limited())return;
  if(kickStoppedUser()){render();return;}
  var o=onLeaveToday()===false?workOpenNow():false;
  if(o===true)markOpenSeen();
  var blocked=onLeaveToday()!==false||o!==true;
  if(!!U.restShown!==blocked)render();
},60000);
/* الهيدر يبقى زجاجي لما المحتوى يتحرك تحته (نزول)، ويرجع عادي فوق */
function hdrGlass(){
  var h=document.querySelector('.top');if(!h)return;
  var y=window.scrollY||document.documentElement.scrollTop||0;
  h.classList.toggle('glass',y>6);
}
window.addEventListener('scroll',hdrGlass,{passive:true});
window.addEventListener('hashchange',function(){
  var h=(location.hash||'').slice(1);
  if(h&&!routeAllowed(h)){h=U.view||'home';try{history.replaceState(null,'','#'+h);}catch(e){}toast('مش مسموح لك تفتح القسم ده');}
  if(['home','orders','shopOrders','shopProducts','recipes','settings','prep','prod','stock','fgstock','tracking','reserved','filling','prepreq','waste','boxes','boxcomp'].indexOf(h)>-1&&h!==U.view){U.view=h;render();window.scrollTo(0,0);}
});

/* ---------- live timers ---------- */
var lastSyncAt=0;
function tick(){
  updateConn();
  if(authed()&&!document.hidden){var me=(S.seen||{})[actorCode()];if(!me||Date.now()-(me.t||0)>60000){markSeen(null);save();}}
  var changed=false;
  S.batches.forEach(function(b){
    if(b.stage==='prod'&&b.startedAt&&!b.notified&&timerDone(b)){b.notified=true;b.ringing=true;changed=true;notifyDone(b);}
  });
  if(changed){save();render();}
  wakeSync();
  alarmDue();
  var ev=syncEvery();if(ev>0&&Date.now()-lastSyncAt>=ev){lastSyncAt=Date.now();gdSync();}
  if(document.hidden||changed)return;
  var hc=document.querySelector('.hcd');
  if(hc){var cb=prodCountdown();if(cb){var fg=hc.querySelector('.hcd-fg');if(fg)fg.style.strokeDashoffset=100*(1-elapsed(cb)/dur(cb));var tt=document.querySelector('.hcdt');if(tt)tt.textContent=mmss(dur(cb)-elapsed(cb));}}
  var rings=document.querySelectorAll('[data-ring]');
  for(var i=0;i<rings.length;i++){
    var el=rings[i],b=batch(el.dataset.ring);
    if(!b||!b.startedAt)continue;
    el.querySelector('.rp').style.strokeDashoffset=RING*(1-elapsed(b)/dur(b));
    el.querySelector('.rt').textContent=mmss(dur(b)-elapsed(b));
  }
}
setInterval(tick,1000);
fsStart();
document.addEventListener('visibilitychange',tick);
function vvSync(){
  var vv=window.visualViewport,root=document.documentElement;
  var h=vv?vv.height:window.innerHeight,t=vv?vv.offsetTop:0;
  root.style.setProperty('--vvh',h+'px');
  root.style.setProperty('--vvb',Math.max(0,window.innerHeight-h-t)+'px');
}
if(window.visualViewport){window.visualViewport.addEventListener('resize',vvSync);window.visualViewport.addEventListener('scroll',vvSync);}
window.addEventListener('resize',vvSync);
document.addEventListener('focusin',function(e){
  var t=e.target;
  if(t&&t.matches&&t.matches('input,select,textarea'))setTimeout(function(){try{t.scrollIntoView({block:'center'});}catch(x){}},300);
});
vvSync();

try{render();}catch(e){console.error('first render',e);}
restoreLocal().then(function(){try{S.batches.forEach(function(b){if(b.stage==='finish'){b.stage='prod';b.startedAt=b.startedAt||(Date.now()-dur(b)-1000);b.notified=true;b.ringing=false;}});migrateBoxOrders();PRODUCTS.forEach(function(p){allocReady(p.id);});save();render();}catch(e){console.error("boot",e);}if(!window.RMY_NEEDS_DATA)document.dispatchEvent(new Event("rmy:loaded"));});
})();
}
/* تغيير مكان التخزين: لو فيه مدة واحدة بتتطبق لوحدها، ولو مش مناسبة بتتفضّى عشان يختار */
document.addEventListener('change',function(e){
  var t=e.target;if(!t)return;
  if(t.dataset&&t.dataset.f==='fgStore'&&U.form){
    U.form.fgStore=t.value;U.form.shelf=shelfForStore(t.value,U.form.shelf);render();return;
  }
  if(t.id==='feStore'&&U.fedit){
    U.fedit.store=t.value;U.fedit.shelf=shelfForStore(t.value,U.fedit.shelf);render();
  }
});
/* قياس جودة الاتصال الحقيقية: زمن رد السيرفر الفعلي + نوع الشبكة لو المتصفح بيعرضه */
var NETQ={lvl:'',ms:0,mbps:null,busy:false};
var NET_LBL={fast:'سريع',mid:'متوسط',slow:'بطيء',off:'مفيش'};
function netKpiHTML(){
  var q=NETQ,cls='',txt='بيقيس…';
  if(!navigator.onLine||q.lvl==='off'){cls='bad';txt='مفيش';}
  else if(q.lvl){
    cls=q.lvl==='fast'?'good':q.lvl==='mid'?'warn':'bad';
    txt=NET_LBL[q.lvl]+(q.ms?' · '+Math.round(q.ms)+' مللي':'')+(q.mbps?' · ~'+q.mbps.toFixed(1)+' ميجا':'');
  }
  return '<div class="syn-kpi '+cls+'" id="netKpi"><span>'+synIco('wifi')+'</span><small>الإنترنت</small><b>'+txt+'</b></div>';
}
function netPaint(){var el=document.getElementById('netKpi');if(el)el.outerHTML=netKpiHTML();}
function netMeasure(){
  if(!navigator.onLine){NETQ.lvl='off';NETQ.ms=0;netPaint();return;}
  if(NETQ.busy)return;
  NETQ.busy=true;
  var t0=performance.now(),ok=true;
  var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
  var to=setTimeout(function(){if(ctrl)ctrl.abort();},8000);
  fetch('./?netq='+Date.now(),{method:'HEAD',cache:'no-store',signal:ctrl?ctrl.signal:undefined})
    .then(function(r){if(!r.ok)ok=false;},function(){ok=false;})
    .then(function(){
      clearTimeout(to);NETQ.busy=false;
      var ms=performance.now()-t0,c=navigator.connection||{};
      NETQ.ms=ok?ms:0;
      NETQ.mbps=(typeof c.downlink==='number'&&c.downlink>0)?c.downlink:null;
      var slow=/2g/.test(c.effectiveType||'');
      NETQ.lvl=!ok?'off':(slow||ms>1500)?'slow':ms>500?'mid':'fast';
      netPaint();
    });
}
netMeasure();
setInterval(netMeasure,15000);
window.addEventListener('online',netMeasure);
window.addEventListener('offline',function(){NETQ.lvl='off';NETQ.ms=0;netPaint();});
/* اختيار مدة الصلاحية من الأزرار */
ACT.shelfPick=function(d){
  if(d.t==='form'&&U.form){U.form.shelf=d.v;return;}
  if(d.t==='fedit'&&U.fedit){U.fedit.shelf=d.v;return;}
  return false;
};
