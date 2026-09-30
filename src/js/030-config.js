/* ================= config ================= */
const G=9.81,KD=.0048,KL=.0032,KS=.0025,BALL_R=.1,CUP_R=.22,CS=2,DT=1/120;
const CLUB_SET=[['Driver','DR',98.5,11.5,.55,1],['Mini driver','MD',93,13,.58,.95],['3 Wood','3W',85.6,14.5,.62,.9],['5 Wood','5W',80.5,16,.66,.85],['7 Wood','7W',76,17.5,.7,.82],['2 Hybrid','2H',78,16.5,.68,.85],['3 Hybrid','3H',74.5,17.5,.71,.82],['4 Hybrid','4H',71.5,18.2,.74,.79],
  ['2 Iron','2I',77,15,.66,.86],['3 Iron','3I',73.5,16.5,.7,.83],['4 Iron','4I',70.5,17.8,.74,.79],['5 Iron','5I',67.6,19,.78,.75],['6 Iron','6I',62.2,21.2,.84,.68],['7 Iron','7I',56.9,23.5,.9,.62],['8 Iron','8I',52.6,26,.95,.56],['9 Iron','9I',48.4,28.5,1,.5],
  ['Pitch wedge','PW',41.1,34,1.1,.42],['Gap wedge','GW',38,39,1.15,.39],['Sand wedge','SW',34.6,46,1.2,.35],['Lob wedge','LW',30.5,53,1.28,.32],['Chipper','CH',30,12,.3,.3],['Putter','PT',7.6,0,0,.12],
  ['Bump','Bump',23.3,18,.45,.3,'sg'],['Pitch','Pitch',22.9,32,1.05,.35,'sg'],['Flop','Flop',18.3,56,1.3,.3,'sg'],['Splash','Splash',15.5,44,.85,.3,'sg']]
  .map(([n,s,v,a,spin,side,kind],id)=>({id,n,s,v,ang:a*DEG,spin,side,putter:s==='PT',sg:kind==='sg',sgi:kind==='sg'?id-22:-1,carry:0,total:0}));
const N_CLUBS=22,OLD8=[0,2,11,13,15,16,18,21],PUTTER=CLUB_SET[21],SG_SET=CLUB_SET.slice(22),clubById=id=>CLUB_SET[id]||CLUB_SET[0];
const BAG_SIZE=14,DEFAULT_BAG=[0,2,3,7,11,12,13,14,15,16,17,18,19,21],HOUSE_BAGS={1:[0,2,3,4,7,11,12,13,14,15,16,18,21],2:DEFAULT_BAG,3:[0,2,9,10,11,12,13,14,15,16,17,18,19,21]};
const BALLS=[{n:'Firm',v:1.02,spin:.9},{n:'Soft',v:.985,spin:1.12}];
function bagFor(ids){const b=ids.map(clubById).filter(c=>!c.sg&&!c.putter).sort((a,b)=>b.v-a.v);b.push(PUTTER);return b}
function bagMask(ids){let m=0;for(const id of ids)if(id<N_CLUBS)m|=1<<id;return m>>>0}
function maskBag(m){const ids=[];for(let i=0;i<N_CLUBS;i++)if(m&(1<<i))ids.push(i);if(!ids.includes(21))ids.push(21);return ids}
let CLUBS=bagFor(DEFAULT_BAG);
function setBag(ids){CLUBS=bagFor(ids);S.bag=CLUBS.map(c=>c.id);S.club=Math.min(S.club,CLUBS.length-1)}
function withBag(ids,fn){const sv=CLUBS;CLUBS=bagFor(ids);try{return fn()}finally{CLUBS=sv}}
const curClub=()=>S.sg?SG_SET[S.sgi]:(CLUBS[ S.club ]||PUTTER);
function selectClubId(id){const c=clubById(id);if(c.sg){S.sg=true;S.sgi=c.sgi;return}S.sg=false;const i=CLUBS.findIndex(k=>k.id===id);S.club=i>=0?i:CLUBS.length-1}
const SG={range:40,band:[.06,2.5*DEG],thin:{ang:.55,v:1.2,spin:.4},chunk:.7,land:[.4,1.3],checkK:2.5,checkK3:8,pinPow:[.2,1]};
const sgPow=c=>c.sg&&W?clamp(Math.sqrt(MM.hyp(W.pin.x-PB.x,W.pin.z-PB.z)/Math.max(1,c.carry)),SG.pinPow[0],SG.pinPow[1]):1;
const SG_LIE=[[[.95,.9],[.85,.8],[1,1],[1,1],[1,1],[1,1],[.5,.3],[1,1],[1,1]],[[.9,.55],[.8,.35],[1,1],[1,1],[1,1],[1,1],[.6,.3],[1,1],[1,1]],[[.85,.5],[.7,.3],[1,1],[1,1],[1,1],[1,1],[.55,.25],[1,1],[1,1]],[[.75,.5],[.75,.5],[.7,.6],[.7,.6],[.7,.6],[.7,.6],[.95,.9],[.7,.6],[.85,.7]]];
const TIGHT=[false,false,false,true,false,true,false,false,true];
function sgDefault(ty,d){if(ty===6)return 3;if(ty<=1)return d>15?0:1;return 1}
function sgAvailable(i,bag){const b=bag||S.bag;if(i===2)return b.includes(19);if(i===3)return b.includes(18)||b.includes(19);return true}
const botBag=house=>S.cv>=3?(HOUSE_BAGS[typeof house==='number'?house:(house&&house.id|0)]||DEFAULT_BAG):OLD8;
const SURF=[
  {n:'Rough',rest:.25,bf:.5,roll:4.5,col:[.30,.50,.22],var:.14},
  {n:'Deep rough',rest:.18,bf:.65,roll:7.5,col:[.24,.40,.17],var:.16},
  {n:'Fairway',rest:.42,bf:.4,roll:3.0,col:[.42,.68,.30],var:.05},
  {n:'Fringe',rest:.38,bf:.45,roll:1.5,col:[.47,.72,.33],var:.05},
  {n:'Green',rest:.35,bf:.5,roll:.95,col:[.55,.81,.37],var:.03},
  {n:'Tee',rest:.4,bf:.4,roll:2,col:[.44,.70,.31],var:.04},
  {n:'Sand',rest:.07,bf:.95,roll:10,col:[.91,.84,.62],var:.05},
  {n:'Water',rest:.05,bf:.9,roll:9,col:[.36,.34,.25],var:.08},
  {n:'Waste area',rest:.15,bf:.7,roll:6,col:[.80,.68,.50],var:.08}];
const LIE=[[.9,.55],[.8,.35],[1,1],[1,1],[1,1],[1,1],[.82,.6],[.9,.5],[.88,.5]],PUTT=[.55,.4,.85,.95,1,.9,.3,.5,.45];
/* Course versions: 0 = classic (round codes v1/v2), 1 = biome courses (round codes v3). The biome comes from the seed. */
const CV=7,ONES=[1,1,1,1,1,1,1,1,1,1],firmArr=(k,cv)=>[k,1,k,k,cv>=2?1-(1-k)*GREEN_FIRM:k,k,1,1,1,1],GREEN_FIRM=.4;
const BIOMES=[
  {n:'Classic',roll:1,bf:1,wind:1,hills:1,detail:1,dm:14,dt:.1,waste:false},
  {n:'Links',roll:.85,bf:.9,wind:1.35,hills:1.35,detail:1.5,dm:7,dt:-.25,waste:false,trees:.2,gap:12,kinds:[['pine',1]],pine:[.15,.34,.23],
    pal:{0:[.44,.52,.28],1:[.70,.63,.40],2:[.45,.62,.31],3:[.48,.66,.33],4:[.52,.74,.36],5:[.46,.64,.31],6:[.90,.84,.66]},fog:[.84,.88,.92],sky:[.38,.58,.86],hillCols:[[.56,.62,.66],[.55,.56,.42]],ringCol:[.52,.54,.34],waterCol:[.24,.46,.62]},
  {n:'Heath',roll:1,bf:1,wind:1,hills:1.1,detail:1.2,dm:5,dt:-.45,waste:false,trees:.55,gap:9,kinds:[['gorse',.6],['pine',.4]],pine:[.17,.38,.22],
    pal:{0:[.40,.46,.26],1:[.44,.30,.42],2:[.44,.64,.30],3:[.47,.68,.33],4:[.53,.78,.36],5:[.45,.66,.31],6:[.88,.80,.60]},fog:[.83,.82,.88],sky:[.42,.50,.80],hillCols:[[.52,.48,.58],[.42,.40,.38]],ringCol:[.36,.33,.32],waterCol:[.22,.40,.62]},
  {n:'Desert',roll:.75,bf:.85,wind:.8,hills:.8,detail:.7,dm:12,dt:.35,waste:true,trees:.45,gap:6,kinds:[['cactus',1]],
    pal:{0:[.50,.58,.30],1:[.56,.52,.34],2:[.45,.66,.30],3:[.48,.70,.33],4:[.54,.80,.37],5:[.46,.68,.31],6:[.95,.87,.66],8:[.82,.68,.50]},fog:[.93,.86,.76],sky:[.34,.52,.86],hillCols:[[.82,.58,.42],[.74,.50,.34]],ringCol:[.78,.63,.45],waterCol:[.20,.55,.62]},
  {n:'Parkland',roll:1.35,bf:1.2,wind:.6,hills:.9,detail:.8,dm:22,dt:.35,waste:false,trees:1.8,gap:5,kinds:[['oak',.7],['pine',.3]],pine:[.18,.42,.22],autumn:.12,
    pal:{0:[.26,.46,.20],1:[.21,.38,.16],2:[.38,.64,.28],3:[.43,.69,.31],4:[.50,.78,.34],5:[.40,.66,.29],6:[.92,.86,.68]},fog:[.78,.85,.90],sky:[.26,.48,.90],hillCols:[[.38,.50,.54],[.24,.40,.26]],ringCol:[.21,.38,.17]},
  {n:'Alpine',roll:1.1,bf:1.05,wind:.9,hills:2.2,detail:1.4,dm:9,dt:-.15,waste:false,trees:1.1,gap:7,kinds:[['pine',1]],pine:[.10,.30,.19],alpine:true,
    pal:{0:[.36,.50,.26],1:[.30,.42,.22],2:[.40,.64,.30],3:[.44,.68,.32],4:[.50,.76,.35],5:[.42,.66,.30],6:[.86,.82,.70]},fog:[.82,.87,.93],sky:[.30,.52,.88],hillCols:[[.66,.70,.76],[.36,.46,.40]],ringCol:[.30,.42,.22],waterCol:[.20,.44,.58]},
  {n:'Coastal',roll:.9,bf:.9,wind:1.2,hills:1.2,detail:1.3,dm:7,dt:-.2,waste:false,trees:.3,gap:11,kinds:[['gorse',.65],['pine',.35]],pine:[.16,.36,.24],coast:true,
    pal:{0:[.46,.54,.30],1:[.62,.60,.40],2:[.44,.64,.31],3:[.47,.67,.33],4:[.52,.76,.36],5:[.45,.65,.31],6:[.93,.88,.70]},fog:[.86,.90,.94],sky:[.36,.58,.88],hillCols:[[.58,.64,.70],[.48,.54,.44]],ringCol:[.46,.52,.32],waterCol:[.16,.42,.60]}];
/* course version 4 draws six biomes (F-059); versions 1-3 keep four */
const biomeOf=(seed,cv)=>{if(!cv)return 0;let h=Math.imul((seed|0)^0x9E3779B9,0x85EBCA6B);h^=h>>>13;h=Math.imul(h,0xC2B2AE35);h^=h>>>16;return 1+((h>>>0)%(cv>=4?6:4))};
const PAR9=[4,3,5,4,4,3,4,5,4],PAR18=PAR9.concat([4,4,3,5,4,4,3,5,4]),FOG=[.80,.86,.92],SUN=norm([-.4,.75,.45]);
/* ===== Brief v4 numbers: each lives once in the brief; code uses the brief's names ===== */
// F-057 Real 18
const PAR18_4=[4,3,5,4,4,3,4,5,4,4,5,3,4,4,5,4,3,4],CLUB_OFF=35,BACK_TURN=[100,160],ROUTE_TRIES=11,ISLAND_17=.5,IDLE_SLICE=3;
const parsFor=(n,cv,kind)=>cv>=CV_ISL&&kind>=2?islPars(n,kind):cv>=4&&kind===1?new Array(n).fill(3):n===18?(cv>=4?PAR18_4:PAR18).slice():PAR9.slice(0,n);
// F-058 seeded architects: weights and dimensions by style
const ARCH_STYLES=[{n:'penal',col:'var(--bad)',w:{'Short iron':1.4,Punchbowl:1.3,Dogleg:1.3,'Three-shot':1.3,'Island green':.6,Cape:.6,Drivable:.7,'Reachable over water':.7},fw:.85,gr:.88,gb:1,fb:1,side:1,aggr:.2,caut:-.2},
  {n:'strategic',col:'var(--info)',w:{'Split fairway':2,Drivable:1.5,'Double dogleg':1.3,Dogleg:1.2},fw:1.15,gr:1.1,tilt:1.4,gb:0,fb:0,short:true,side:.8,aggr:0,caut:0},
  {n:'heroic',col:'var(--acc)',w:{'Island green':1.8,Cape:1.8,'Long over water':1.5,'Reachable over water':1.6,Drivable:1.3},fw:1,gr:1,gb:-1,fb:-1,side:1.4,aggr:-.3,caut:.3}];
const ARCHITECT_NAMES=['Morag Duncan','M. Okonkwo','Aurelio Vance','Hester Lowe','Kenji Arai','Branwen Pugh','Tobias Quill','Solveig Dahl','Rafferty Coyle','Amara Eze','Clement Rook','Ines Barros','Fergus Lamont','Yara Haddad','Otis Penhale','Wren Castell','Duncan Marr','Liesl Faber'];
// F-059 alpine and coastal
const AIR_ALPINE=.87,SNOW_LINE=22,COAST_S0=[170,260],COAST_IN=25,COAST_WOBBLE=12,CLIFF_H=6,CLIFF_TEE=3,SEA_BREEZE=2;
// F-053 seasons (index 0 spring, 1 summer, 2 autumn, 3 winter) and F-054 green speed
const SEASONS=[{n:'Spring',roll:1,bf:1,firm:.4,sun:55},{n:'Summer',roll:.85,bf:.9,firm:.6,sun:70},{n:'Autumn',roll:1.05,bf:1.05,firm:.4,sun:42},{n:'Winter',roll:1.3,bf:1.2,firm:.25,sun:28}],SEASON_ORDER=[2,3,0,1];
const STIMP_BASE=[10,10,9.5,10.5,9,9.5,10],STIMP_SEASON=[.3,1.2,0,-1.2],STIMP_WEATHER={Clear:0,Breezy:.2,Overcast:-.2,Rain:-1},STIMP_DAY=.5,STIMP_CLAMP=[7.5,13],STIMP_REF=10,STIMP_DIFF=2;
// F-055 seeded wear and F-056 winter rules
const WEAR_LEVEL={free:0,daily:1,par3:1,tour:2,cup:2,weekly:2,r1:2,r2:3},DIVOT_P=.05,WORN_P=.04,DIVOT_ZONE=[215,275],WEAR_W={drive:1,layup:.7,tee3:.5,approach:1,edge:.6};
const PLACE_R=.15,PLACE_TRIES=12,WINTER_WEAR=.3;
// F-050 fat and thin (ZONE_LIE by surface index: rough, deep rough, fairway, fringe, green, tee, sand, water, waste)
const ZONE_BASE=.03,ZONE_LIE=[.85,.7,1,.95,1,1,.8,1,.85],ZONE_SPLASH=.95,ZONE_STATE={sit:.85,divot:.75,worn:.85,plug:.6},ZONE_STANCE=.3,MISHIT_SPAN=.8,FAT_V=.32,FAT_ANG=.22,FAT_SPIN=.15,THIN_ANG=.5,THIN_V=.06,THIN_SPIN=.6,TEMPO_FAT_MIN=.25,ZONE_SHOW=.97;
// F-049 punch and stinger
const PUNCH_ANG=.42,PUNCH_V=.72,PUNCH_SPIN=.55,STING_ANG=.62,STING_V=1,STING_SPIN=.7,CANOPY_WARN=40;
// F-048 penalties and drops
const PENALTY=1,LATERAL_R=2.3,BACKLINE_MAX=120,BACKLINE_STEP=1,DROP_H=.5,DROP_KEEP=1.15,PROV_NEAR=12,PROV_MAX=1,UNPLAY_BUNKER_OUT=2,STAKE_GAP=12;
// F-051 casual rules, F-072 seats
const GIMME_R=1,MULL_PER_NINE=1,MULL_ATTEMPT=7001,SEAT_ATTEMPT=100;
// F-052 pressure
const PRESS_FROM=7,PRESS_FROM18=13,PRESS_LEAD=[1,2],PRESS_BPM=[60,30],PRESS_FOV=7*DEG,PRESS_CAM=.12,PRESS_DUCK=.5,CROWD=[.03,.005];
