/* ===== Q-04 drag putting stroke: on the green, press on the course and pull toward you — the backstroke's length sets the pace — then push back through where you started; the push's drift sets the line; the distance shows only after the ball stops ===== */
const PUTT_PX=.3,PUTT_EXP=1.6,DECEL_K=.6,DECEL_LOSS=.85,PUTT_LINE=.02,PUTT_START=8;
const puttDrag=()=>!!W&&S.mode==='aim'&&S.ph===0&&!S.ov&&!S.photo&&!SETS.puttMeter&&curClub().putter&&S.swing!=='tempo';
const puttPace=back=>MM.pow(Math.max(0,back)/(PUTT_PX*innerHeight),PUTT_EXP);
/* a move on the course: starts the stroke when the first movement pulls toward you, then follows it; true when it took the move */
function puttMove(e){let p=S.putt;if(!p){const d=S.drag;if(!d||d.moved||!puttDrag())return false;const dx=e.clientX-d.x0,dy=e.clientY-d.y0;if(dy<PUTT_START||Math.abs(dx)>dy)return false;
    p=S.putt={x0:d.x0,y0:d.y0,t0:d.t,back:0,topT:d.t};S.drag=null;cv.classList.remove('drag')}
  const back=e.clientY-p.y0;if(back>p.back){p.back=back;p.topT=e.timeStamp}S.mark=clamp(puttPace(p.back),0,1);if(p.back>=PUTT_START&&back<=0)puttStrike(e,p);return true}
function puttStrike(e,p){S.putt=null;let pow=clamp(puttPace(p.back),.05,1);const backV=p.back/Math.max(1,p.topT-p.t0),pushV=p.back/Math.max(1,e.timeStamp-p.topT);if(pushV<DECEL_K*backV){pow*=DECEL_LOSS;hint('Decel',1.4)}
  S.pow=pow;S.acc=clamp((e.clientX-p.x0)*PUTT_LINE*DEG/.012,-1.6,1.6);S.mis=0;S.mark=pow;S.puttRead={x:PB.x,z:PB.z,pow};S.swingK0=curTick();doStrike()}
function puttUp(){const p=S.putt;S.putt=null;S.mark=0;if(p&&p.back>=PUTT_START)hint('Push back through the ball to putt',1.6);updateHud(true)}
/* after the ball stops: what it rolled, and what that stroke rolls on a flat green at this speed */
function puttReadout(){const R=S.puttRead;if(!R||!W)return;S.puttRead=null;const rolled=Math.hypot(PB.x-R.x,PB.z-R.z),v0=PUTTER.v*R.pow*PUTT[4],a=SURF[4].roll*(W.rk?W.rk[4]:1),flat=v0*v0/(2*a);setTimeout(()=>hint('Rolled '+rolled.toFixed(1)+' m · stroke for '+flat.toFixed(1)+' m',3),600)}
VL.feature({id:'q04.putt',kind:'shell',deps:['q01.swing'],f:['Q-04']});
