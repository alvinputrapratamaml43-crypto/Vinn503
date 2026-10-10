(()=>{
 const gate=document.getElementById('securityGate'),count=document.getElementById('gateCount'),progress=document.getElementById('gateProgress'),message=document.getElementById('gateMessage'),status=document.getElementById('gateStatus'),button=document.getElementById('biometricButton');
 if(!gate)return;
 let remaining=5;
 const tick=()=>{
   count.textContent=remaining;
   progress.style.width=((5-remaining)/5*100)+'%';
   if(remaining<=0){
     clearInterval(timer);
     message.textContent='';
     status.innerHTML='<span class="gate-pulse"></span> SIAP UNTUK AKSES';
     button.hidden=false;
     return;
   }
   remaining--;
 };
 tick();const timer=setInterval(tick,1000);
 button.addEventListener('click',()=>{
   if(button.disabled)return;
   button.disabled=true;
   message.textContent='';
   status.innerHTML='<span class="gate-pulse"></span> AKSES DIBERIKAN';
   progress.style.width='100%';
   button.classList.add('fingerprint-success');
   if(typeof window.startVINN503Music==='function')window.startVINN503Music();
   setTimeout(()=>{gate.classList.add('gate-leaving');setTimeout(()=>gate.remove(),450)},450);
 });
})();
