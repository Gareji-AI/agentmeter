/** sendMessage returns void: wait for the real run outcome before claiming success. */
export function runStudioSession(session,text,timeoutMs=15000) {
  return new Promise((resolve,reject)=>{
    let sent=false;let finished=false;
    const finish=error=>{if(finished)return;finished=true;clearTimeout(timer);session.removeEventListener('changed',changed);error?reject(error):resolve();};
    const changed=()=>{
      if(!sent||session.status==='running')return;
      const error=session.messages.flatMap(m=>m.parts).findLast(p=>p.type==='error');
      if(session.status==='error'||error)return finish(new Error(error?.message||'Studio request failed'));
      if(session.status==='idle')finish();
    };
    const timer=setTimeout(()=>{finish(new Error('Studio request timed out'));session.cancel();},timeoutMs);
    session.addEventListener('changed',changed);
    try{session.sendMessage(text);sent=true;changed();}catch(error){finish(error);}
  });
}
