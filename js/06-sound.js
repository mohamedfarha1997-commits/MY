if(!RMY_CARD){
(function(){
  'use strict';
  /* ---- محرك الصوت: نغمات قصيرة مولّدة من المتصفح (مفيش ملفات صوت) ---- */
  var psA=null;
  function sfxOn(){try{return localStorage.getItem('ps-sfx')!=='0';}catch(e){return true;}}
  function ctx(){
    if(!psA){var C=window.AudioContext||window.webkitAudioContext;if(!C)return null;try{psA=new C();}catch(e){return null;}}
    if(psA.state==='suspended')psA.resume().catch(function(){});
    return psA;
  }
  function note(freq,start,dur,vol,type){
    var c=ctx();if(!c)return;
    var t=c.currentTime+start,o=c.createOscillator(),g=c.createGain();
    o.type=type||'sine';o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol,t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur+0.03);
  }
  function sfx(k){
    if(!sfxOn())return;
    if(k==='move'){note(1320,0,0.045,0.045,'sine');}
    else if(k==='select'){note(784,0,0.09,0.09,'triangle');note(1175,0.07,0.16,0.08,'triangle');}
    else if(k==='back'){note(620,0,0.09,0.07,'triangle');note(415,0.06,0.14,0.06,'triangle');}
    else if(k==='boot'){[523,659,784,1047].forEach(function(f,i){note(f,i*0.15,0.6,0.07,'sine');note(f*2,i*0.15,0.35,0.02,'sine');});}
  }

  /* ---- شاشة الفتح: تنتهي لما التحميل الفعلي يخلص (إشارة rmy:loaded) ---- */
  var psb=document.getElementById('psBoot');
  var reduce=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  var t0=Date.now(),minShow=0,loaded=false;
  function bootDone(){
    if(!psb)return;
    var el=psb;psb=null;el.classList.add('done');
    setTimeout(function(){el.remove();},700);
  }
  function tryDone(){
    if(!psb||!loaded)return;
    var wait=minShow-(Date.now()-t0);
    if(wait>0){setTimeout(tryDone,wait);return;}
    bootDone();
  }
  var booted=false;
  function playBoot(){if(booted||!psb)return;booted=true;sfx('boot');}
  var c0=ctx();
  if(c0&&c0.state==='running')playBoot();
  else document.addEventListener('pointerdown',playBoot,{once:true,passive:true});
  document.addEventListener('rmy:loaded',function(){loaded=true;tryDone();});
  setTimeout(function(){if(!window.RMY_NEEDS_DATA){loaded=true;tryDone();}},4000);

})();
}