
window.rmyCardBoot=function(){

var DATA={cards:[],updated:null};
var currentCode='';
var out=document.getElementById('out');
var OWN_MODE=new URLSearchParams(location.search).get('own')==='1';
var qid=new URLSearchParams(location.search).get('id')||(location.hash||'').slice(1);
/* إعدادات صفحة الكروت: معرّف ملف الكروت (من الإعدادات) ومفتاح Google API. لو فاضيين بتتقري cards.json اللي جنب الصفحة */
var CARDS_FILE_ID='1HooDudVdgdVoJNzG9A8n822KZgWhWj4l';
var CARDS_API_KEY='AIzaSyA97tpmMo2oZjgmvUZY3_vDzdj_KAkIFJI';
var DATA_URL=new URL('cards.json',location.href).href;
var CARDS_SRC=(CARDS_FILE_ID&&CARDS_API_KEY)?'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(CARDS_FILE_ID)+'?alt=media&key='+encodeURIComponent(CARDS_API_KEY):DATA_URL;
var LOGO='<svg viewBox="0 0 1560 420" aria-hidden="true"><g fill="#FFFFFF"><path d=" M120 70 H475 C535 70 570 105 570 155 C570 205 535 235 475 235 H250 L165 350 H65 L200 180 H465 C480 180 490 170 490 155 C490 140 480 130 465 130 H120 Z"/><path d=" M250 252 H420 L590 350 H420 Z"/><path d=" M610 70 H700 L820 190 L940 70 H1030 V350 H940 V165 L820 285 L700 165 V350 H610 Z"/><path d=" M1050 70 H1160 L1270 165 L1380 70 H1490 L1320 250 V350 H1220 V250 Z"/></g></svg>';

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function norm(s){return String(s||'').trim().toUpperCase();}
function findCard(id){return DATA.cards.filter(function(c){return norm(c.code)===norm(id);})[0]||null;}
function fmtDate(d){
  if(!d)return '';
  var t=new Date(d+'T00:00:00');
  return isNaN(t)?d:t.toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'});
}

function showCard(c){
  currentCode=c.code;
  var initial=String(c.name||c.code||'?').trim().charAt(0).toUpperCase();
  var upd=DATA.updated?new Date(DATA.updated).toLocaleDateString('ar-EG'):'';
  var fields='';
  if(c.job)fields+='<div class="fx-f"><span class="fx-k">Position · الوظيفة</span><span class="fx-v">'+esc(c.job)+'</span></div>';
  if(c.joinDate)fields+='<div class="fx-f"><span class="fx-k">Joined · الانضمام</span><span class="fx-v">'+esc(fmtDate(c.joinDate))+'</span></div>';
  if(c.wa)fields+='<div class="fx-f full"><span class="fx-k">WhatsApp · واتساب</span><span class="fx-v en">'+esc(c.wa)+'</span></div>';
  var act=c.active!==false;
  if(!act){
    var waStop='https://wa.me/201508999341?text='+encodeURIComponent('السلام عليكم، الكارت بتاعي (ID: '+c.code+') اتوقف، ممكن أستفسر؟');
    out.innerHTML='<div class="panel" role="alert"><div class="ico">!</div>'+
      '<h2>الكارت ده موقوف</h2>'+
      '<p>المسئول قام بإيقاف الكارت ده، ومش هتقدر تستخدمه دلوقتي.</p>'+
      '<p>لو عايز تعرف السبب أو تفعّل الكارت تاني، تواصل مع المسئول على الواتساب:</p>'+
      '<p><a class="btn" href="'+waStop+'" target="_blank" rel="noopener">تواصل مع المسئول على واتساب</a></p>'+
      (OWN_MODE?'':'<a class="linkline noprint" href="#" id="anotherLink">تحقق من ID تاني</a>')+
    '</div>';
    var anotherStop=document.getElementById('anotherLink');
    if(anotherStop)anotherStop.onclick=function(e){e.preventDefault();askId();};
    return;
  }
  out.innerHTML='<section class="fx" id="card">'+
    '<div class="fx-top"><div><div class="fx-wm">'+LOGO+'</div><div class="fx-sub">Identity module · RMY</div></div>'+
      '<span class="fx-tag">Verified</span></div>'+
    '<div class="fx-person"><div class="fx-ring" aria-hidden="true"><div class="fx-ini">'+esc(initial)+'</div></div>'+
      '<div class="fx-who"><p class="fx-name">'+esc(c.name||c.code)+'</p><div class="fx-role">MEMBER · عضو</div></div></div>'+
    (fields?'<div class="fx-grid">'+fields+'</div>':'')+
    '<div class="fx-strip"><div class="fx-row"><span class="fx-k">ID NUMBER · رقم الـ ID</span><span class="fx-st '+(act?'':'off')+'">'+(act?'Active':'Inactive')+'</span></div>'+
      '<div class="fx-num">'+esc(c.code)+'</div>'+
      '<div class="fx-bc"><svg id="bcSvg" role="img" aria-label="باركود الكارت"></svg></div></div>'+
    '<div class="fx-foot"><span>RMY Pro</span>'+(upd?'<span>Updated · '+esc(upd)+'</span>':'')+'</div>'+
  '</section>'+
  '<div class="noprint actions"><button class="btn" id="shareBtn">مشاركة</button><button class="btn ghost" id="pdfBtn">تصدير PDF</button></div>'+
  '<div class="noprint actions" style="margin-top:10px"><button class="btn ghost" id="bigBcBtn">باركود كبير للمسح</button></div>'+
  (OWN_MODE?'':'<a class="linkline noprint" href="#" id="anotherLink">تحقق من ID تاني</a>');

  document.getElementById('pdfBtn').onclick=downloadPdf;
  document.getElementById('shareBtn').onclick=shareCard;
  document.getElementById('bigBcBtn').onclick=function(){showBigBarcode(c.code);};
  initScratch();
  makeBarcode(c.code);
  var another=document.getElementById('anotherLink');
  if(another)another.onclick=function(e){e.preventDefault();askId();};
}

/* طبقة فضية تتمسح بالإيد أو الماوس، ولما أغلب المساحة تتمسح بتختفي خالص */
function initScratch(){
  var cv=document.getElementById('scratchC');
  if(!cv||!cv.getContext)return;
  var box=cv.parentNode,w=box.offsetWidth,h=box.offsetHeight,dpr=window.devicePixelRatio||1;
  if(!w||!h)return;
  cv.width=w*dpr;cv.height=h*dpr;
  var ctx=cv.getContext('2d');
  ctx.scale(dpr,dpr);
  var g=ctx.createLinearGradient(0,0,w,h);
  g.addColorStop(0,'#d9dce6');g.addColorStop(.5,'#f7f8fc');g.addColorStop(1,'#b7bdcf');
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  /* حبيبات الفويل */
  for(var k=0;k<w*h/9;k++){
    ctx.fillStyle=Math.random()<.5?'rgba(255,255,255,.5)':'rgba(90,100,130,.12)';
    ctx.fillRect(Math.random()*w,Math.random()*h,1,1);
  }
  /* كلمة خفيفة وباهتة */
  ctx.fillStyle='rgba(11,16,48,.3)';
  ctx.font='400 11px Tajawal, Tahoma, sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('خربش هنا',w/2,h/2);
  ctx.globalCompositeOperation='destination-out';
  ctx.lineCap='round';ctx.lineJoin='round';

  var drawing=false,last=null,done=false;
  function pt(e){var r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  function scratchTo(p){
    var from=last||p;
    var dist=Math.hypot(p.x-from.x,p.y-from.y);
    var steps=Math.max(1,Math.ceil(dist/3));
    for(var s=1;s<=steps;s++){
      var t=s/steps,x=from.x+(p.x-from.x)*t,y=from.y+(p.y-from.y)*t;
      /* خط متقطع بعرض متغيّر عشان يبان زي الخربشة الحقيقية */
      ctx.beginPath();
      ctx.lineWidth=8+Math.random()*10;
      ctx.moveTo(x+(Math.random()-.5)*3,y+(Math.random()-.5)*3);
      ctx.lineTo(x+(Math.random()-.5)*3,y+(Math.random()-.5)*3);
      ctx.stroke();
      /* قشور صغيرة بتتشال حوالين الخط */
      if(Math.random()<.3){
        ctx.beginPath();
        ctx.arc(x+(Math.random()-.5)*20,y+(Math.random()-.5)*14,Math.random()*1.8+.4,0,Math.PI*2);
        ctx.fill();
      }
    }
    last=p;
  }
  function checkDone(){
    if(done)return;
    var d=ctx.getImageData(0,0,cv.width,cv.height).data,n=0,t=0;
    for(var i=3;i<d.length;i+=4){t++;if(d[i]<128)n++;}
    /* الطبقة بتفضل لحد ما تتخربش كلها تقريباً، ومفيش جزء متخربش يفضل */
    if(t&&n/t>0.998){done=true;cv.remove();}
  }
  cv.addEventListener('pointerdown',function(e){
    if(done)return;
    drawing=true;last=null;
    if(cv.setPointerCapture)cv.setPointerCapture(e.pointerId);
    scratchTo(pt(e));
    e.preventDefault();
  });
  cv.addEventListener('pointermove',function(e){
    if(!drawing||done)return;
    scratchTo(pt(e));
  });
  function end(){
    if(!drawing)return;
    drawing=false;last=null;
    checkDone();
  }
  cv.addEventListener('pointerup',end);
  cv.addEventListener('pointercancel',end);
}

/* تجهيز الكارت للتصدير: الطبقة الفضية بتتخفى عشان الرقم يبان، والباركود (SVG) بيتحوّل لصورة عشان يتصور زي ما هو */
function cardPdfPrep(el){
  var swaps=[],jobs=[];
  /* الطبقة الفضية (scratchC) بتفضل زي ما هي على الشاشة: الـ ID بيفضل مخفي لحد ما يتخربش */
  [].forEach.call(el.querySelectorAll('svg'),function(svg){
    var r=svg.getBoundingClientRect();
    var str=new XMLSerializer().serializeToString(svg);
    if(str.indexOf('xmlns=')<0)str=str.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');
    var img=new Image();
    img.style.cssText=svg.getAttribute('style')||'';
    img.style.width=r.width+'px';img.style.height=r.height+'px';
    jobs.push(new Promise(function(res){img.onload=res;img.onerror=res;}));
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(str);
    swaps.push({el:svg,img:img});
    svg.parentNode.replaceChild(img,svg);
  });
  return Promise.all(jobs)
    .then(function(){return document.fonts&&document.fonts.ready?document.fonts.ready:null;})
    .then(function(){return swaps;});
}
function cardPdfRestore(swaps){
  (swaps||[]).forEach(function(x){
    if(x.img){if(x.img.parentNode)x.img.parentNode.replaceChild(x.el,x.img);}
    else if(x.el){x.el.style.display=x.disp||'';}
  });
}
function downloadPdf(){
  var el=document.getElementById('card');
  var btn=document.getElementById('pdfBtn');
  /* التصدير بيستخدم محرك الطباعة في المتصفح نفسه، فالكارت بيطلع بالألوان والتدرجات زي ما هو قدامك بالظبط.
     من نافذة الطباعة اختار "Save as PDF" / "حفظ كـ PDF" */
  if(!el)return;
  /* نسخة نضيفة من الكارت بتتطبع لوحدها. طبقة الخربشة بتتشال من النسخة عشان الكود يبان */
  var wrap=document.createElement('div');wrap.id='cardPrint';
  var c=el.cloneNode(true);c.removeAttribute('id');
  c.querySelectorAll('canvas').forEach(function(d){d.parentNode.removeChild(d);});
  wrap.appendChild(c);document.body.appendChild(wrap);
  document.body.classList.add('card-print');
  var clean=function(){document.body.classList.remove('card-print');if(wrap.parentNode)wrap.parentNode.removeChild(wrap);window.removeEventListener('afterprint',clean);};
  window.addEventListener('afterprint',clean);
  setTimeout(function(){try{window.print();}catch(e){clean();}},50);
}

function askId(msg){
  out.innerHTML='<div class="panel">'+
    '<div class="ico">ID</div>'+
    '<h2>التحقق من البطاقة</h2>'+
    '<p class="'+(msg&&msg.indexOf('مش موجود')>-1?'err':'')+'">'+esc(msg||'اكتب رقم الـ ID الموجود على الكارت')+'</p>'+
    '<input class="input" id="q" placeholder="CODE" autocomplete="off" autocapitalize="characters">'+
    '<div class="actions" style="margin-top:14px"><button class="btn" id="go">عرض البطاقة</button></div>'+
    '<button class="btn ghost" id="scanBtn" style="width:100%;margin-top:10px">امسح الـ QR بالكاميرا</button>'+
  '</div>';
  var q=document.getElementById('q');
  document.getElementById('go').onclick=function(){go(q.value);};
  q.onkeydown=function(e){if(e.key==='Enter')go(q.value);};
  q.focus();
  document.getElementById('scanBtn').onclick=function(){unlockAudio();openScanner();};
}

var audioCtx=null,scanner={active:false,stream:null,raf:0,det:null,off:null};
function unlockAudio(){try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;if(!audioCtx)audioCtx=new AC();if(audioCtx.state==='suspended')audioCtx.resume();}catch(e){}}
/* صوت "بيب" زي ماسحات السوبر ماركت */
function beep(){try{if(!audioCtx)return;var o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime;o.type='sine';o.frequency.setValueAtTime(1760,t);o.frequency.setValueAtTime(2093,t+0.09);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.35,t+0.01);g.gain.exponentialRampToValueAtTime(0.0001,t+0.22);o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+0.25);}catch(e){}}
function scanMsg(m){var el=document.getElementById('scanT');if(el)el.textContent=m;}
/* الـ QR ممكن يكون الـ ID نفسه أو لينك فيه ?id= */
function parseCode(t){try{var u=new URL(t,location.href);var id=u.searchParams.get('id');if(id)return id;var h=(u.hash||'').slice(1);if(h)return h;}catch(e){}return String(t||'').trim();}
function closeScanner(){scanner.active=false;cancelAnimationFrame(scanner.raf);clearTimeout(scanner.hint);scanner.track=null;scanner.zoomCaps=null;scanner.cand=null;scanner.curZoom=null;clearBox();if(scanner.stream){scanner.stream.getTracks().forEach(function(t){t.stop();});scanner.stream=null;}var ov=document.getElementById('scanOv');if(ov)ov.remove();}
function frameOf(v){var off=scanner.off||(scanner.off=document.createElement('canvas'));off.width=v.videoWidth;off.height=v.videoHeight;var c=off.getContext('2d',{willReadFrequently:true});c.drawImage(v,0,0,off.width,off.height);return c;}
/* يرجّع {text, pts} بإحداثيات الفيديو لو لقى باركود/QR في الشاشة كلها، أو null */
function detectOn(src){
  if(scanner.det)return scanner.det.detect(src).then(function(r){if(!r||!r.length)return null;var b=r[0].boundingBox;return {text:r[0].rawValue,pts:[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}]};}).catch(function(){return null;});
  if(window.ZXing){return zxDetect(src);}
  if(window.jsQR){var img=src.getContext('2d',{willReadFrequently:true}).getImageData(0,0,src.width,src.height);var q=jsQR(img.data,img.width,img.height,{inversionAttempts:'attemptBoth'});if(!q)return Promise.resolve(null);var L=q.location;return Promise.resolve({text:q.data,pts:[L.topLeftCorner,L.topRightCorner,L.bottomRightCorner,L.bottomLeftCorner]});}
  return Promise.resolve(null);
}
/* مجموع متوسط لكل نقطة في نافذة (2rx+1)x(2ry+1) باستخدام integral image */
function boxSum(src,W,H,rx,ry){
  var I=new Float64Array((W+1)*(H+1));
  for(var y=0;y<H;y++){var row=0;for(var x=0;x<W;x++){row+=src[y*W+x];I[(y+1)*(W+1)+x+1]=I[y*(W+1)+x+1]+row;}}
  var out=new Float32Array(W*H);
  for(var y2=0;y2<H;y2++){
    var ya=Math.max(0,y2-ry),yb=Math.min(H,y2+ry+1);
    for(var x2=0;x2<W;x2++){
      var xa=Math.max(0,x2-rx),xb=Math.min(W,x2+rx+1);
      var s=I[yb*(W+1)+xb]-I[ya*(W+1)+xb]-I[yb*(W+1)+xa]+I[ya*(W+1)+xa];
      out[y2*W+x2]=s/((xb-xa)*(yb-ya));
    }
  }
  return out;
}
/* يلاقي مكان الباركود (مستطيل فيه تدرّج أفقي قوي وعمودي ضعيف) من غير ما يفك شفرته
   g: صورة رمادي (Uint8), W,H: أبعادها. يرجّع {x,y,w,h} بإحداثيات الصورة أو null */
function findBarcodeBox(g,W,H){
  var gx=new Float32Array(W*H),gy=new Float32Array(W*H);
  for(var y=0;y<H-1;y++)for(var x=0;x<W-1;x++){var i=y*W+x;gx[i]=Math.abs(g[i+1]-g[i]);gy[i]=Math.abs(g[i+W]-g[i]);}
  var rx=Math.max(2,Math.round(W/80)),ry=Math.max(2,Math.round(H/80));
  var ax=boxSum(gx,W,H,rx,ry),ay=boxSum(gy,W,H,rx,ry);
  var m=new Float32Array(W*H);
  for(var k=0;k<W*H;k++)m[k]=(ax[k]>40&&ax[k]>2.2*ay[k])?1:0;
  var cw=Math.max(3,Math.round(W/12));          /* دمج الخطوط الأفقي عشان تبقى كتلة واحدة */
  var mc=boxSum(m,W,H,cw,1);
  var bin=new Uint8Array(W*H);
  for(var q=0;q<W*H;q++)bin[q]=mc[q]>0.5?1:0;
  var seen=new Uint8Array(W*H),best=null;
  for(var s0=0;s0<W*H;s0++){
    if(!bin[s0]||seen[s0])continue;
    var minx=W,maxx=0,miny=H,maxy=0,n=0,st=[s0];seen[s0]=1;
    while(st.length){
      var p=st.pop(),px=p%W,py=(p-px)/W;n++;
      if(px<minx)minx=px;if(px>maxx)maxx=px;if(py<miny)miny=py;if(py>maxy)maxy=py;
      if(px>0&&bin[p-1]&&!seen[p-1]){seen[p-1]=1;st.push(p-1);}
      if(px<W-1&&bin[p+1]&&!seen[p+1]){seen[p+1]=1;st.push(p+1);}
      if(py>0&&bin[p-W]&&!seen[p-W]){seen[p-W]=1;st.push(p-W);}
      if(py<H-1&&bin[p+W]&&!seen[p+W]){seen[p+W]=1;st.push(p+W);}
    }
    var bw=maxx-minx+1,bh=maxy-miny+1;
    var ok=bw>=W*0.08&&bw>=1.8*bh&&n>=0.3*bw*bh;   /* مستطيل عريض ومليان */
    if(ok&&(!best||n>best.n))best={x:minx,y:miny,w:bw,h:bh,n:n};
  }
  return best?{x:best.x,y:best.y,w:best.w,h:best.h}:null;
}

/* يلاقي مكان الباركود في الشاشة كلها (على صورة صغيرة وسريعة) */
function locateCandidate(v){
  var k=Math.min(1,480/v.videoWidth),W=Math.round(v.videoWidth*k),H=Math.round(v.videoHeight*k);
  var c=scanner.loc||(scanner.loc=document.createElement('canvas'));
  c.width=W;c.height=H;
  var ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(v,0,0,W,H);
  var d=ctx.getImageData(0,0,W,H).data,g=new Uint8Array(W*H);
  for(var i=0,j=0;i<d.length;i+=4,j++)g[j]=(d[i]*77+d[i+1]*150+d[i+2]*29)>>8;
  var b=findBarcodeBox(g,W,H);
  scanner.cand=b?{x:b.x/k,y:b.y/k,w:b.w/k,h:b.h/k}:null;
  return scanner.cand;
}
/* قص الكود من الفيديو بدقته الأصلية (تكبير رقمي) عشان يتفك */
function cropVideo(v,r){
  var pw=r.w*0.15,ph=r.h*0.3;
  var x=Math.max(0,Math.floor(r.x-pw)),y=Math.max(0,Math.floor(r.y-ph));
  var w=Math.min(v.videoWidth-x,Math.ceil(r.w+2*pw)),h=Math.min(v.videoHeight-y,Math.ceil(r.h+2*ph));
  var k=Math.min(2,Math.max(1,800/w));
  var c=scanner.crop||(scanner.crop=document.createElement('canvas'));
  c.width=Math.round(w*k);c.height=Math.round(h*k);
  var cx=c.getContext('2d',{willReadFrequently:true});
  try{cx.filter='grayscale(1) contrast(1.8) brightness(1.1)';}catch(e){}
  cx.drawImage(v,x,y,w,h,0,0,c.width,c.height);
  try{cx.filter='none';}catch(e){}
  return {canvas:c,x:x,y:y,sx:w/c.width,sy:h/c.height};
}
/* تكبير الكاميرا نحو الكود: يقرب لحد ما الباركود يبقى حوالي 40% من عرض الشاشة */
function zoomTo(c,v){
  var tr=scanner.track,z=scanner.zoomCaps;
  if(!tr||!z||c.w>=0.4*v.videoWidth)return;
  if(Date.now()-(scanner.lastZoom||0)<300)return;
  scanner.lastZoom=Date.now();
  var cur=scanner.curZoom||z.min,top=Math.min(z.max,4);
  var nz=Math.min(top,cur*(0.4*v.videoWidth)/c.w);
  if(nz<=cur*1.05)return;
  scanner.curZoom=nz;
  tr.applyConstraints({advanced:[{zoom:nz}]}).catch(function(){});
}
function detectFrame(v){
  var cand=locateCandidate(v);
  if(cand){
    /* لقينا مكان الباركود: نقراه من القص فوراً (أسرع)، والزوم بيحصل في الخلفية */
    zoomTo(cand,v);
    var cr=cropVideo(v,cand);
    return detectOn(cr.canvas).then(function(h){
      if(h){h.pts=h.pts.map(function(p){return {x:cr.x+p.x*cr.sx,y:cr.y+p.y*cr.sy};});return h;}
      return scanner.det?detectOn(v):detectOn(frameOf(v).canvas);
    });
  }
  return scanner.det?detectOn(v):detectOn(frameOf(v).canvas);
}
/* التكبير التلقائي: لو ماشفناش باركود، الكاميرا بتكبّر وتصغّر بالتدريج لحد ما تلاقيه على أي بُعد */
function clearBox(){var cv=document.getElementById('scanC');if(cv){var c=cv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cv.width,cv.height);}}
function sweepZoom(){
  var tr=scanner.track,z=scanner.zoomCaps;
  if(!tr||!z||Date.now()-(scanner.lastZoom||0)<1200)return;
  scanner.lastZoom=Date.now();
  var top=Math.min(z.max,4),lv=[];
  for(var i=0;i<=4;i++)lv.push(z.min+(top-z.min)*i/4);
  scanner.zi=((scanner.zi||0)+1)%lv.length;
  scanner.curZoom=lv[scanner.zi];
  tr.applyConstraints({advanced:[{zoom:lv[scanner.zi]}]}).catch(function(){});
}
/* إطار أخضر بأركان حوالين الباركود المتقري، متظبط على حجم الفيديو المعروض */
function drawBox(pts,v,col){
  var cv=document.getElementById('scanC');if(!cv)return;
  var r=v.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  cv.width=r.width*dpr;cv.height=r.height*dpr;
  var ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,r.width,r.height);
  var s=Math.max(r.width/v.videoWidth,r.height/v.videoHeight),ox=(r.width-v.videoWidth*s)/2,oy=(r.height-v.videoHeight*s)/2;
  var xs=pts.map(function(p){return p.x*s+ox;}),ys=pts.map(function(p){return p.y*s+oy;});
  var x0=Math.min.apply(null,xs)-10,x1=Math.max.apply(null,xs)+10,y0=Math.min.apply(null,ys)-10,y1=Math.max.apply(null,ys)+10;
  if(y1-y0<60){var cy=(y0+y1)/2;y0=cy-30;y1=cy+30;}
  var L=Math.max(16,Math.min(x1-x0,y1-y0)*0.3);
  ctx.strokeStyle=col||'#22c55e';ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=6;
  ctx.beginPath();
  ctx.moveTo(x0,y0+L);ctx.lineTo(x0,y0);ctx.lineTo(x0+L,y0);
  ctx.moveTo(x1-L,y0);ctx.lineTo(x1,y0);ctx.lineTo(x1,y0+L);
  ctx.moveTo(x1,y1-L);ctx.lineTo(x1,y1);ctx.lineTo(x1-L,y1);
  ctx.moveTo(x0+L,y1);ctx.lineTo(x0,y1);ctx.lineTo(x0,y1-L);
  ctx.stroke();
}
function loopScan(){
  if(!scanner.active)return;
  var v=document.getElementById('scanV');
  if(!v||v.readyState<2||!v.videoWidth){scanner.raf=requestAnimationFrame(loopScan);return;}
  detectFrame(v).then(function(hit){
    if(!scanner.active)return;
    if(hit&&hit.text){drawBox(hit.pts,v);onScanned(hit.text);return;}
    if(scanner.cand){var c=scanner.cand;drawBox([{x:c.x,y:c.y},{x:c.x+c.w,y:c.y},{x:c.x+c.w,y:c.y+c.h},{x:c.x,y:c.y+c.h}],v,'#ffffff');}
    else{clearBox();sweepZoom();}
    scanner.raf=requestAnimationFrame(loopScan);
  }).catch(function(e){scanMsg('خطأ: '+(e&&e.message||e)+' · '+(e&&e.stack?String(e.stack).split('\n')[1]:''));if(scanner.active)scanner.raf=requestAnimationFrame(loopScan);});
}
/* مطابقة مرنة: بتتجاهل المسافات والشرط والأرقام العربي/الإنجليزي */
function codeKey(x){return String(x||'').replace(/[\u0660-\u0669]/g,function(d){return String(d.charCodeAt(0)-0x0660);}).toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^0+(?=.)/,'');}
function findCardLoose(id){var k=codeKey(id);if(!k)return null;return DATA.cards.filter(function(c){return codeKey(c.code)===k;})[0]||null;}
/* أي خطأ في الجافاسكربت يظهر على شاشة الماسح عشان نعرف السبب */
window.addEventListener('error',function(e){var el=document.getElementById('scanT');if(el)el.textContent='خطأ: '+(e&&e.message);});
function onScanned(text){
  scanMsg('قريت: "'+String(text).slice(0,60)+'"');
  var code=parseCode(text);
  var card=findCard(code)||findCardLoose(code);
  if(!card){
    scanMsg('اتقرا: "'+String(code).slice(0,40)+'" ومش موجود في الكروت');
    scanner.raf=requestAnimationFrame(loopScan);
    return;
  }
  code=card.code;
  scanner.active=false;cancelAnimationFrame(scanner.raf);
  beep();
  try{if(navigator.vibrate&&navigator.userActivation&&navigator.userActivation.hasBeenActive)navigator.vibrate([80,40,80]);}catch(e){}
  scanMsg('تم القراءة ✓');
  setTimeout(function(){closeScanner();go(code);},250);
}
/* قراية بديلة لو المتصفح مش بيدعم BarcodeDetector: ZXing (باركود وQR) مع TRY_HARDER */
var zxReader=null;
function zxDetect(c){
  var W=c.width,H=c.height;
  var d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,lum=new Uint8ClampedArray(W*H);
  for(var i=0,j=0;i<d.length;i+=4,j++){lum[j]=(d[i]*77+d[i+1]*150+d[i+2]*29)>>8;}
  try{
    if(!zxReader)zxReader=new ZXing.MultiFormatReader();
    var hints=null;try{hints=new Map();hints.set(ZXing.DecodeHintType.TRY_HARDER,true);}catch(e){hints=null;}
    var res=zxReader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(lum,W,H))),hints);
    var ps=(res.getResultPoints()||[]).map(function(p){return {x:p.getX(),y:p.getY()};});
    var x0=0,y0=0,x1=W,y1=H;
    if(ps.length){x0=Math.max(0,Math.min.apply(null,ps.map(function(p){return p.x;}))-10);x1=Math.min(W,Math.max.apply(null,ps.map(function(p){return p.x;}))+10);y0=Math.max(0,Math.min.apply(null,ps.map(function(p){return p.y;}))-10);y1=Math.min(H,Math.max.apply(null,ps.map(function(p){return p.y;}))+10);}
    return Promise.resolve({text:res.getText(),pts:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}]});
  }catch(e){return Promise.resolve(null);}
}
/* يخلي الباركود يتكبّر بنسبته الأصلية (مستطيل) من غير ما يتمطّط */
function fitSvg(svg){
  var w=parseFloat(svg.getAttribute('width'))||0,h=parseFloat(svg.getAttribute('height'))||0;
  if(w&&h){svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.removeAttribute('width');svg.removeAttribute('height');}
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
}
/* باركود Code 128 للكود بتاع الكارت */
function makeBarcode(code){
  var svg=document.getElementById('bcSvg');if(!svg||!window.JsBarcode)return;
  try{JsBarcode(svg,String(code),{format:'CODE128',displayValue:false,margin:0,height:40,width:3,background:'#ffffff',lineColor:'#0b1030'});svg.setAttribute('preserveAspectRatio','none');}catch(e){}
}
/* باركود كبير على الشاشة: نفس المستطيل والأرقام تحت الخطوط، بس بعرض الشاشة */
function showBigBarcode(code){
  var old=document.getElementById('bigBc');if(old)old.remove();
  var ov=document.createElement('div');ov.id='bigBc';
  ov.innerHTML='<svg id="bigBcSvg" role="img" aria-label="باركود كبير"></svg><button class="btn ghost" id="bigBcX">إغلاق</button>';
  document.body.appendChild(ov);
  document.getElementById('bigBcX').onclick=function(){ov.remove();};
  var svg=document.getElementById('bigBcSvg');if(!window.JsBarcode)return;
  try{JsBarcode(svg,String(code),{format:'CODE128',displayValue:true,fontSize:28,textMargin:8,font:'monospace',margin:24,height:150,width:4,background:'#ffffff',lineColor:'#000000'});fitSvg(svg);}catch(e){}
}
/* مشاركة لينك الكارت، ولو المتصفح مش بيدعم المشاركة بننسخه */
function shareCard(){
  var c=currentCode,btn=document.getElementById('shareBtn');
  var link=location.href.split('#')[0].split('?')[0]+'?id='+encodeURIComponent(c);
  if(navigator.share){navigator.share({title:'RMY ID',text:'بطاقة RMY · '+c,url:link}).catch(function(){});return;}
  if(navigator.clipboard&&btn){navigator.clipboard.writeText(link).then(function(){btn.textContent='اتنسخ الرابط ✓';setTimeout(function(){btn.textContent='مشاركة';},2000);}).catch(function(){});}
}
function openScanner(){
  closeScanner();
  var ov=document.createElement('div');ov.id='scanOv';
  ov.innerHTML='<video id="scanV" playsinline muted autoplay></video><canvas id="scanC"></canvas><div class="scantxt" id="scanT">وجّه الكاميرا على الباركود، الماسح بيدوّر عليه وبيكبّره<br><small style="opacity:.6">نسخة v10</small></div><button class="btn ghost" id="scanTorch" style="display:none;position:absolute;top:64px;left:12px;width:auto;padding:10px 14px">فلاش</button><button class="btn ghost" id="scanX">إغلاق</button>';
  document.body.appendChild(ov);
  document.getElementById('scanX').onclick=closeScanner;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){scanMsg('الكاميرا مش متاحة على المتصفح ده، اكتب الـ ID يدوي');return;}
  if('BarcodeDetector' in window){try{scanner.det=new BarcodeDetector({formats:['code_128','code_39','ean_13','ean_8','upc_a','itf','qr_code']});}catch(e){scanner.det=null;}}
  if(!scanner.det&&!window.jsQR&&!window.ZXing){scanMsg('المتصفح ده مش بيقرأ الـ QR، اكتب الـ ID يدوي');return;}
  navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false}).then(function(s){
    if(!ov.isConnected){s.getTracks().forEach(function(t){t.stop();});return;}
    scanner.stream=s;scanner.active=true;
    var tr=s.getVideoTracks()[0],caps=(tr&&tr.getCapabilities)?tr.getCapabilities():{};
    scanner.track=tr;scanner.zoomCaps=(caps.zoom&&caps.zoom.max>caps.zoom.min)?caps.zoom:null;scanner.zi=0;scanner.lastZoom=Date.now();
    if(tr&&caps.focusMode&&caps.focusMode.indexOf('continuous')>-1){tr.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(function(){});}
    if(caps.torch){var tb=document.getElementById('scanTorch');if(tb){tb.style.display='block';tb.onclick=function(){var on=tb.dataset.on==='1';tr.applyConstraints({advanced:[{torch:!on}]}).then(function(){tb.dataset.on=on?'0':'1';tb.textContent=on?'فلاش':'إطفاء';}).catch(function(){});};}}
    var v=document.getElementById('scanV');v.srcObject=s;
    return v.play().then(function(){loopScan();scanner.hint=setTimeout(function(){if(scanner.active)scanMsg('قرّب الكاميرا شوية وثبّتها على الباركود. لو الكود على شاشة، اعرضه كبير من زرار "باركود كبير للمسح"');},7000);});
  }).catch(function(e){scanMsg('الكاميرا ماشتغلتش ('+((e&&e.name)||'خطأ')+'). اسمح بالكاميرا أو اكتب الـ ID يدوي');});
}
function go(v){
  var c=findCard(v);
  if(!c){askId('الـ ID ده مش موجود، اتأكد منه وجرّب تاني');return;}
  history.replaceState(null,'','?id='+encodeURIComponent(c.code));
  showCard(c);
}

fetch(CARDS_SRC,{cache:'no-store'})
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
  .then(function(j){
    DATA.cards=j.cards||[];
    DATA.updated=j.updated||null;
    if(qid){
      var c=findCard(qid);
      if(c){showCard(c);return;}
      if(OWN_MODE){out.innerHTML='<div class="panel"><div class="ico">!</div><h2>بطاقتك مش متاحة دلوقتي</h2><p>كلم المالك عشان يتأكد من بياناتك.</p></div>';return;}
      askId('الـ ID ده مش موجود، اتأكد منه وجرّب تاني');
      return;
    }
    askId();
  })
  .catch(function(err){
    out.innerHTML='<div class="panel"><div class="ico">!</div>'+
      '<h2>تعذّر تحميل البيانات</h2>'+
      '<p>الملف المطلوب:</p><code>'+esc(DATA_URL)+'</code>'+
      '<p style="margin-top:14px">السبب: '+esc(String(err&&err.message||'غير معروف'))+'</p>'+
      '<p>اتأكد إن cards.json مرفوع في نفس المكان اللي فيه index.html، وإن تصدير الكروت اتعمل بعد آخر تعديل.</p>'+
    '</div>';
  });

};
(function(){
  if(!RMY_CARD)return;
  document.title='RMY · Identification Card';
  document.documentElement.setAttribute('lang','ar');
  document.documentElement.setAttribute('dir','rtl');
  document.querySelectorAll('style,link[data-app-css]').forEach(function(s){if(s.id!=='cardCss')s.disabled=true;});
  var fl=document.createElement('link');fl.rel='stylesheet';
  fl.href='https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap';
  document.head.appendChild(fl);
  document.body.innerHTML="<div class=\"stage\"><div id=\"out\"><div class=\"loading\"><span></span><span></span><span></span></div></div>";
  var libs=["https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js","https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js","https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js","https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js","https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js"];
  Promise.all(libs.map(function(u){return new Promise(function(res){
    var s=document.createElement('script');s.src=u;s.onload=s.onerror=res;document.head.appendChild(s);
  });})).then(function(){window.rmyCardBoot();});
})();
