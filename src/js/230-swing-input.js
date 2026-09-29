/* ===== Q-01 swing input: the meter is a clock. The mark is a function of time since the first click; each click is placed on the clock by its own timestamp (pointerdown, not release); the top and a missed third click are decided by the clock and never ahead of a click still being delivered; clicks inside CLICK_DEBOUNCE are ignored; losing focus pauses the meter ===== */
const CLICK_DEBOUNCE=80,METER_GRACE=50,TICK_TOP=[1200,.03,.125],TICK_ZONE=[2400,.012,.2],MT={t1:0,t2:0,p:1,last:-1e9,pause:null,top:false};
const mtUp=c=>mRate()/(c.putter?2:1.15)/1000,mtDown=c=>mRate()/(1.15*(c.putter?1.5:1))/1000;
/* the third click at time t: inside the zone it is direction, beyond the edge it is contact (F-050); the clock past zero is a full mishit */
function mtThird(t,pt){const c=curClub(),m=MT.p-(t-MT.t2)*mtDown(c);if(m<=0)return mtMiss();const zw=pt==='touch'?.045:.03;S.mis=0;let inZone;
  if(S.cv>=4&&!c.putter){const raw=(m-ZC)/(zw*zoneK());S.acc=clamp(raw,-1,1);S.mis=Math.sign(raw)*clamp((Math.abs(raw)-1)/MISHIT_SPAN,0,1);inZone=Math.abs(raw)<=1}else{S.acc=clamp((m-ZC)/zw,-1.6,1.6);inZone=Math.abs(S.acc)<1}
  if(inZone)AU.tone(TICK_ZONE[0],TICK_ZONE[0],TICK_ZONE[1],TICK_ZONE[2],'square');S.mark=m;S.ph=0;beginSwing({pow:S.pow})}
function mtMiss(){const c=curClub(),v4=S.cv>=4&&!c.putter;S.mark=0;S.acc=v4?-1:-1.6;S.mis=v4?-1:0;S.ph=0;beginSwing({pow:S.pow})}
/* a meter click (Space, the meter, or the course while the meter runs), at its own timestamp */
function mtClick(e,pt){const t=e&&typeof e.timeStamp==='number'?e.timeStamp:S.frameNow,c=curClub();
  if(MT.pause!=null){const d=t-MT.pause;MT.t1+=d;MT.t2+=d;MT.pause=null;MT.last=t;$('msg').classList.remove('on');S.msgT=0;return}
  if(S.ph>0&&t-MT.last<CLICK_DEBOUNCE)return;MT.last=t;
  if(S.ph===0){S.ph=1;MT.t1=t;MT.top=false;S.mark=0;AU.play('ui');return}
  if(S.ph===1){const top=MT.t1+1/mtUp(c);if(t<=top+METER_GRACE){/* up to METER_GRACE past the top it is still the power click: full power */const tp=Math.min(t,top);S.pow=clamp((tp-MT.t1)*mtUp(c),.05,1);MT.t2=tp;MT.p=S.pow;S.mark=S.pow;S.ph=2;AU.play('ui');return}S.pow=1;MT.t2=top;MT.p=1;S.ph=2}
  mtThird(t,pt)}
/* each frame draws the mark from the clock; the top and a missed third click fall METER_GRACE after the clock passes them */
function mtFrame(){if(S.mode!=='aim'||S.ph===0||MT.pause!=null)return;const c=curClub(),t=S.frameNow;
  if(S.ph===1){const top=MT.t1+1/mtUp(c);if(t<top)S.mark=Math.max(0,(t-MT.t1)*mtUp(c));else{S.mark=1;if(!MT.top){MT.top=true;AU.tone(TICK_TOP[0],TICK_TOP[0],TICK_TOP[1],TICK_TOP[2])}if(t>=top+METER_GRACE){S.pow=1;MT.t2=top;MT.p=1;S.ph=2}}}
  if(S.ph===2){const z=MT.t2+MT.p/mtDown(c);S.mark=Math.max(0,MT.p-(t-MT.t2)*mtDown(c));if(t>=z+METER_GRACE)mtMiss()}}
function mtPause(){if(S.mode==='aim'&&S.ph>0&&MT.pause==null){MT.pause=typeof performance!=='undefined'?performance.now():S.frameNow;msg('Paused','click to continue',1e9)}}
if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){addEventListener('blur',mtPause);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')mtPause()})}
/* the course: while the meter runs a pointerdown is a click at once (a drag cannot aim then); otherwise a press that does not move is a click on release, a moving one aims */
function pointerDown(e){if(e.button===2){if(S.mode==='aim'&&S.ph===0&&!S.over&&!S.photo)targetClick4(e);return}if(S.mode==='shot'&&!S.photo&&ffDown(e.timeStamp))return;if(S.over)return;if(S.intro)S.intro=null;if(S.mode==='aim'&&(S.ph>0||MT.pause!=null)&&!S.photo&&!S.ov&&!S.mapOpen&&!S.zoom){press(e,e.pointerType);return}S.drag={x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,moved:false,t:e.timeStamp,pt:e.pointerType};try{cv.setPointerCapture(e.pointerId)}catch(x){}}
function pointerUp(e){if(ffUp(e.timeStamp))return;if(S.putt){puttUp(e);return}const d=S.drag;if(!d)return;S.drag=null;cv.classList.remove('drag');if(!d.moved)press({timeStamp:d.t,clientX:d.x0,clientY:d.y0},d.pt);else endDragLook()}
