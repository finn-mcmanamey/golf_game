/* ===== S-5 pause and resume exactly: a hidden tab or a lost focus holds the round — clock, meter, swing, ball and ghosts in flight, music scheduler, particles — and a single frame gap over PAUSE_GAP (a sleep, a stall) advances nothing; it resumes from the same physics tick ===== */
const PAUSE_GAP=250,ERR_WINDOW=10000,PZ={on:false,why:'',last:0},S6={t:[],busy:false};
const pzHold=(on,why)=>{PZ.on=on;PZ.why=on?why:''};
if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){document.addEventListener('visibilitychange',()=>pzHold(document.visibilityState==='hidden','hidden'));addEventListener('blur',()=>pzHold(true,'blur'));addEventListener('focus',()=>{if(document.visibilityState!=='hidden')pzHold(false)})}
/* true when this frame must not advance the round; a gap also moves the meter's clock on by the gap, so a running meter resumes where it was */
function pzSkip(fms){const gap=fms>PAUSE_GAP&&PZ.last<=PAUSE_GAP;PZ.last=fms;if(gap&&S.ph>0&&MT.pause==null){MT.t1+=fms;MT.t2+=fms}return PZ.on||gap}
