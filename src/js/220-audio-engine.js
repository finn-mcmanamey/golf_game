/* ===== B-5 one audio engine: a single context, made on the first press and resumed on any press after a suspension; a master gain that mute and a hidden tab ramp; a sound asked for while suspended is dropped, a repeat inside AUDIO_DEDUP plays once, at most AUDIO_VOICES at a time; loops glide with setTargetAtTime ===== */
const AUDIO_RAMP=.03,AUDIO_FADE=.25,AUDIO_DEDUP=.035,AUDIO_VOICES=24,POP_STEP=.05;
function auRamp(v,T){const g=AU.master;if(!g)return;const t=AU.ctx.currentTime,p=g.gain;(p.cancelAndHoldAtTime||p.cancelScheduledValues).call(p,t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(v,t+T)}
/* mute: saved (the settings' own key) and applied before any sound; save=false for a bug replay's sandbox */
function auSet(on,save=true){AU.on=on;if(save)VS.setItem('voxellinks.sound',on?'1':'0');const b=typeof document!=='undefined'&&document.getElementById?document.getElementById('btnSnd'):null;if(b)b.innerHTML=on?ic('sound'):ic('mute');if(AU.ctx&&!AU.hidden)auRamp(on?1:0,AUDIO_RAMP)}
function auTarget(p,v,tau){if(p._vl===v)return;p._vl=v;const t=AU.ctx.currentTime;(p.cancelAndHoldAtTime||p.cancelScheduledValues).call(p,t);p.setTargetAtTime(v,t,tau)}
function auUnlock(){AU.init();if(AU.ctx&&AU.ctx.state==='suspended'&&!AU.hidden)AU.ctx.resume().catch(()=>{})}
/* a hidden tab (or a sleeping laptop) fades out over AUDIO_FADE and suspends; coming back resumes and fades in */
function auVisible(hidden){AU.hidden=hidden;const c=AU.ctx;if(!c)return;clearTimeout(AU.susT);if(hidden){auRamp(0,AUDIO_FADE);AU.susT=setTimeout(()=>{if(AU.hidden)c.suspend().catch(()=>{})},AUDIO_FADE*1000+20)}else c.resume().then(()=>auRamp(AU.on?1:0,AUDIO_FADE)).catch(()=>{})}
if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){document.addEventListener('visibilitychange',()=>auVisible(document.visibilityState==='hidden'));addEventListener('pagehide',()=>auVisible(true));addEventListener('pageshow',()=>auVisible(document.visibilityState==='hidden'))}
VL.feature({id:'b5.audio',kind:'view',deps:['core.view'],f:['B-5']});
