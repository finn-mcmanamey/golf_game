/* ===== Tee off that never sticks on "Teeing off…". The round starts after the next painted frame, or after TEE_WAIT ms if the
   browser is holding frames back (a busy graphics card, a paused page). A start that throws puts the menu back and tries once more;
   a second failure unlocks the button and says so with a bug code. While teeing off the front scene stops redrawing so the graphics
   card is free for the new hole. Menu flow only: nothing here touches a round's rules or records ===== */
const TEE_WAIT=150;

/* run f once: after the next frame, or after TEE_WAIT ms, whichever comes first */
function teeSoon(f){let done=false;const go=()=>{if(done)return;done=true;f()};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>setTimeout(go,0));setTimeout(go,TEE_WAIT)}

/* the main button is mid-tee-off (the front scene pauses its drawing meanwhile) */
function teeBusy(){const b=$('btnMain');return!!b&&b.classList.contains('busy')}

/* start what the main button offers; a throw restores the menu and retries once, then tells the player */
function teeOff(a,retry){
  try{if(a==='resume')continueRound();else if(a==='career')careerEvent();else if(a==='tour')tourEvent();else goToday()}
  catch(e){errNote(e&&e.message||e,e&&e.stack);teeRestore();
    if(retry){teeLock();teeSoon(()=>teeOff(a,false));return}
    teeUnlock();s6Note('Couldn’t tee off · '+String(e&&e.message||e).slice(0,80),'Copy bug code',()=>bugKey());return}
  if(frontShown())try{frontRefresh(loadSave())}catch(e){errNote(e&&e.message||e,e&&e.stack);teeUnlock()}}

/* a start that failed half-way may have hidden the menu: bring it back the way the Menu button does */
function teeRestore(){if(frontShown())return;try{$('btnMenu').onclick()}catch(e){errNote(e&&e.message||e,e&&e.stack);
  $('title').classList.remove('hide');['hud','bottom','tools'].forEach(id=>$(id).classList.remove('on'));S.mode='title'}}

/* the button's two states, set directly so they cannot fail with the rest of the menu */
function teeLock(){const b=$('btnMain');if(!b)return;b.classList.add('busy');$('mainT').textContent='Teeing off…'}
function teeUnlock(){const b=$('btnMain');if(!b)return;b.classList.remove('busy');$('mainT').textContent=FRONT.act==='today'?'Play today’s':'Continue'}
