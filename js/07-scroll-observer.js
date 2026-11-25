if(!RMY_CARD){
(function(){
  var pending=0;
  function show(el){
    if(!el)return;
    el.classList.add('is-scrolling');
    clearTimeout(el._scT);
    el._scT=setTimeout(function(){el.classList.remove('is-scrolling');},900);
  }
  document.addEventListener('scroll',function(ev){
    var t=ev.target;
    if(!t)return;
    show(t.nodeType===9?document.documentElement:t);
  },{capture:true,passive:true});

  function fit(){
    pending=0;
    var root=document.documentElement;
    if(root.scrollHeight>window.innerHeight+1)root.removeAttribute('data-fit');
    else root.setAttribute('data-fit','');
    var els=document.body?document.body.querySelectorAll('*'):[];
    for(var i=0;i<els.length;i++){
      var e=els[i];
      if(e.clientHeight===0&&e.clientWidth===0)continue;
      if(!e.hasAttribute('data-fit')){
        var cs=getComputedStyle(e);
        if(!/(auto|scroll)/.test(cs.overflowX+' '+cs.overflowY))continue;
      }
      var needs=(e.scrollHeight>e.clientHeight+1)||(e.scrollWidth>e.clientWidth+1);
      if(needs)e.removeAttribute('data-fit');else e.setAttribute('data-fit','');
    }
  }
  function schedule(){ if(!pending)pending=requestAnimationFrame(fit); }

  var mo=new MutationObserver(schedule);
  function startObserving(){
    if(document.body)mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden']});
  }
  window.addEventListener('resize',schedule);
  window.addEventListener('orientationchange',schedule);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',schedule);
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){startObserving();schedule();});
  }else{startObserving();schedule();}
  window.addEventListener('load',schedule);
})();
}