

window.addEventListener('error',function(e){try{var a=document.getElementById('app');var m='خطأ: '+(e&&e.message?e.message:'غير معروف');if(a&&!a.textContent.trim()){a.innerHTML='<div dir="rtl" style="padding:16px;font:14px sans-serif;color:#b91c1c"><b>حصلت مشكلة في تحميل الصفحة</b><div style="margin-top:8px;word-break:break-all">'+m+'</div><button onclick="location.reload()" style="margin-top:12px;padding:8px 14px">إعادة التحميل</button></div>';}}catch(x){}});
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.KH_INSTALL=e;});
window.addEventListener('appinstalled',function(){window.KH_INSTALL=null;});
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(function(){});}
