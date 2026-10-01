/* ===== v6 M3 · The second routing and the island clock: F-123 opens routing B (routed with the island in M1, so version 8 froze it); F-124 maps your local 24 hours onto the island's daylight for free play and the front page. The hour paints; it never touches a scored stroke: routings keep v4's holeClock and take their season from the date. */
const ISLAND_DAY=[6,20];
const islHourAt=h=>ISLAND_DAY[0]+(((h%24)+24)%24)*(ISLAND_DAY[1]-ISLAND_DAY[0])/24;
function islHourNow(){if(ISL.hourFix!=null)return islHourAt(ISL.hourFix);const d=new Date();return islHourAt(d.getHours()+d.getMinutes()/60)}
const islClockOn=W=>W&&W.cv>=CV_ISL&&(S.kind&7)===6;
const islClockText=()=>{const t=islHourNow();return String(Math.floor(t)).padStart(2,'0')+':'+String(Math.floor((t%1)*60)).padStart(2,'0')};
VL.feature({id:'v6m3.routing',kind:'sim',deps:['v6m1.island'],f:['F-123','F-124']});
