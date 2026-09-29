/* Mainstreet Advisory site tracking: Meta Pixel, source capture (?src= / utm_*), Vercel Web Analytics. Google Analytics stays inline in each page. */
(function(){
  var st={};
  try{var q=new URLSearchParams(location.search),h=false;['src','utm_source','utm_medium','utm_campaign','utm_content'].forEach(function(k){var v=q.get(k);if(v){st[k]=v.slice(0,80);h=true;}});if(h){sessionStorage.setItem('ms_src',JSON.stringify(st));if(window.gtag){gtag('event','source_landing',st);}}else{st=JSON.parse(sessionStorage.getItem('ms_src')||'{}');}}catch(e){}
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init','1573704104778310');
  fbq('track','PageView');
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('.apply-link');if(!a){return;}fbq('track','Lead',st);if(window.gtag){gtag('event','generate_lead',st);}if(window.va){window.va('event',{name:'apply_click',data:st});}});
  if(!document.querySelector('script[src*="/_vercel/insights"]')){window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};var s=document.createElement('script');s.defer=true;s.src='/_vercel/insights/script.js';document.head.appendChild(s);}
})();
