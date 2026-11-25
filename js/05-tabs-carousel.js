if(!RMY_CARD){
(function(){
  /* padding = half the viewport minus half the first/last chip, so the scroll range
     stops exactly on the first and last tab (no empty space past them) */
  function pad(c){
    var ch=c.querySelectorAll('.cv-c');if(!ch.length)return;
    var W=c.clientWidth;
    c.style.paddingInlineStart=Math.max(0,W/2-ch[0].offsetWidth/2)+'px';
    c.style.paddingInlineEnd=Math.max(0,W/2-ch[ch.length-1].offsetWidth/2)+'px';
  }
  function nearest(c){
    var cr=c.getBoundingClientRect(),cc=cr.left+cr.width/2,best=null,bd=1e9;
    c.querySelectorAll('.cv-c').forEach(function(b){
      var r=b.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-cc);
      if(d<bd){bd=d;best=b;}
    });
    return best;
  }
  function paint(c,b){
    c.querySelectorAll('.cv-c').forEach(function(x){
      x.classList.toggle('mid',x===b);
      x.setAttribute('aria-selected',x===b?'true':'false');
    });
  }
  function wrap(c){
    var ch=c.querySelectorAll('.cv-c'),n=ch.length/5;if(!n||ch.length%5)return;
    var b=nearest(c),idx=Array.prototype.indexOf.call(ch,b);
    if(idx<n||idx>=4*n)ch[idx%n+2*n].scrollIntoView({inline:'center',block:'nearest',behavior:'instant'});
  }
  function bind(c){
    if(c.dataset.cvi)return;
    c.dataset.cvi='1';
    pad(c);
    var t=null,raf=0,touching=false,lastMove=0;
    function settle(){
      /* لو الإصبع فضل واقف من غير حركة لفترة، نعتبره اترفع عشان الاختيار ميتعلقش */
      if(touching&&Date.now()-lastMove<900)return;
      touching=false;
      if(c.classList.contains('cv-loop'))wrap(c);
      var b=nearest(c);if(!b)return;
      paint(c,b);
      if(b.dataset.v!==U.oTab){U.oTab=b.dataset.v;render();return;}
      b.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
    }
    function later(ms){clearTimeout(t);t=setTimeout(settle,ms);}
    function down(){touching=true;lastMove=Date.now();clearTimeout(t);}
    function up(){touching=false;later(60);}
    c.addEventListener('touchstart',down,{passive:true});
    c.addEventListener('touchmove',function(){lastMove=Date.now();},{passive:true});
    c.addEventListener('touchend',up,{passive:true});
    c.addEventListener('touchcancel',up,{passive:true});
    c.addEventListener('scroll',function(){
      lastMove=Date.now();
      if(!raf)raf=requestAnimationFrame(function(){raf=0;var b=nearest(c);if(b)paint(c,b);});
      later(160);
    },{passive:true});
    c.addEventListener('scrollend',function(){if(!touching)later(0);});
    var mid=c.querySelector('.cv-c.mid');
    if(mid)mid.scrollIntoView({inline:'center',block:'nearest'});
  }
  function scan(){document.querySelectorAll('.cv').forEach(bind);}
  var app=document.getElementById('app');
  if(app)new MutationObserver(scan).observe(app,{childList:true,subtree:true});
  window.addEventListener('resize',function(){document.querySelectorAll('.cv').forEach(pad);});
  scan();
})();
}