/* ===== The in-round Menu button: back to the home screen at any calm moment. The round is saved first,
   so the home screen offers Continue and the round picks up on the same stroke. Menu flow only ===== */

/* not while a swing or a ball in flight is being played out, or a replay is showing: those finish first */
function goHomeBusy(){return S.mode==='swing'||S.mode==='shot'||!!S.replay}

function goHome(){AU.play('ui');if(goHomeBusy()){hint('Wait for the ball to stop, then Menu',1.6);return}
  saveRound();$('btnMenu').onclick()}
$('btnToMenu').onclick=goHome;

VL.feature({id:'menu.home',kind:'view',deps:['core.view'],f:[]});
