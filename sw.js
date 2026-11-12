/* RMY Pro service worker: notification tap handling.
   If you already have a sw.js, keep it and just add the 'notificationclick' block below. */
self.addEventListener('install',function(){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});
self.addEventListener('notificationclick',function(e){
  e.notification.close();
  var view=(e.notification.data&&e.notification.data.view)||'home';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++){
      var c=list[i];
      if(c.url.indexOf(self.registration.scope)===0){
        return c.focus().then(function(){c.postMessage({type:'open-view',view:view});});
      }
    }
    return self.clients.openWindow(self.registration.scope+'#'+view);
  }));
});
