// 80b-weapon-sfx.js: every weapon's own swing/shot and hit sound, played as sfx('ws:<key>') and sfx('wh:<key>').
// A recipe is 'swing|hit'; layers 'kind secs Hz Hz2 vol [delay] [Q]': nb/nh/nl noise, ts/tt/tq/tw tones, m metal, hw/hn
// held saw/noise drones. Signatures in WSND; other weapons use their category's, set by mass and reach, at a hashed pitch.

const WSND_CAT = {
  blade: 'ts .16 3600 3300 .025,nb .1 2600 5200 .12 0 2|nh .14 6500 2200 .3,tt .1 2900 2300 .035',
  heavy: 'nb .24 300 1000 .3 0 1.2|ts .28 110 34 .6,nl .18 260 260 .45',
  polearm: 'nb .2 1100 2800 .16 0 2.5|nb .06 2400 2400 .35,ts .08 240 90 .3',
  chain: 'nh .03 5200 5200 .07,nh .03 4600 4600 .06 .05,nh .03 5600 5600 .07 .1|nh .04 7000 7000 .4,tq .05 3000 900 .04',
  fist: 'nb .08 700 2000 .16 0 1.4|ts .12 170 55 .5,nl .08 600 600 .4',
  shield: 'nb .14 500 1400 .15 0 1.2|m .4 620 620 .08,ts .1 140 60 .3',
  ranged: 'tq .025 1800 1500 .025|nb .05 3000 3000 .45,tq .05 1800 500 .03',
  magic: 'ts .14 1200 2400 .03|tw .22 1700 300 .05,nb .2 6000 1500 .14 0 3',
  exotic: 'tt .12 300 700 .05|tt .12 300 1400 .08,tq .14 1400 200 .03 .06',
};
// An empty half uses the category's; a bare key borrows that weapon's. Gun layers play over the gun's ranged.sfx.
const WSND = {
  'frying-pan': '|tt .09 600 300 .2,ts .14 180 80 .4', // bo-ink
  bat: '|tt .05 900 700 .45,nb .04 1800 1800 .2 0 4,ts .1 220 90 .3', // tok
  chainsaw: 'hw .9 72 72 .07|nb .12 2400 1800 .25 0 2,tw .1 160 110 .06', // motor
  lollipop: '|nh .05 3500 3500 .3,nh .04 4500 4500 .22 .045,tt .06 2200 1800 .05 .02', // crunch
  'boxing-gloves': '|nl .12 900 250 .7,nb .08 1400 600 .25 0 .7', 'glove-left': 'boxing-gloves', // pomf
  whip: 'nb .14 900 3000 .05 0 2,nh .02 7500 7500 .2 .13,tq .025 2800 700 .05 .13|', // crack
  nunchaku: 'tt .03 1500 1300 .12,tt .03 1700 1500 .1 .07|tt .05 1100 800 .25,ts .1 250 100 .3', // clacks
  katana: 'ts .35 4200 4100 .025,nb .1 3000 7000 .05 0 3|nh .12 8000 3000 .3,ts .25 4200 4000 .02', // ring
  greatsword: 'nb .4 200 900 .35,nl .35 400 150 .1|ts .3 90 30 .6,nh .2 4000 1200 .25', // whoosh
  rapier: 'nb .09 4000 9000 .25 0 4|nb .04 5000 5000 .25 0 3,ts .06 1800 900 .05', // swish
  'war-fan': 'nb .03 1600 2400 .16 0 3,nb .03 1700 2600 .16 .035 3,nb .03 1800 2800 .16 .07 3,nb .03 1900 3000 .14 .105 3|', // flutter
  hammer: '|m .9 150 150 .12,ts .45 75 28 .7', // bong
  scythe: 'nb .5 300 2400 .14 0 1.6,nb .4 2000 600 .06 .15 2|nh .2 5000 1500 .3,ts .4 2200 2000 .015', // whoosh
  'plasma-staff': 'tw .3 110 140 .05,ts .3 220 280 .04|tw .12 900 200 .06,nh .1 6000 6000 .2', 'plasma-end': 'plasma-staff', // hum
  shotgun: 'nb .05 1500 900 .2 .28 2,nb .05 1200 1800 .2 .4 2|', // pump
  minigun: 'hw .14 55 55 .08|', // brrt
  sniper: 'nb .3 1200 500 .08 .25 1.5,nb .3 1000 400 .05 .5 1.5|', // echo
  rocket: 'nb .6 300 3000 .2,nl .5 200 120 .15|', // launch
  crossbow: 'tt .2 220 110 .12,nb .03 2500 2500 .15 0 3|', // latch
  longbow: 'ts .45 196 190 .1,tt .3 392 380 .04|', // string
  kunai: 'ts .025 4800 4600 .08,nh .02 8000 8000 .1|', // tick
  boomerang: 'nb .04 900 1100 .07 0 4,nb .04 950 1100 .06 .06 4,nb .04 900 1100 .05 .12 4,nb .04 950 1100 .04 .18 4|', // whirr
  laser: 'ts .1 4000 800 .06|', // pew
  plasma: 'tw .35 70 90 .06,ts .3 140 180 .05|', // hum
  flamethrower: 'hn .12 700 700 .25|', // roar
  cryo: 'nh .12 7000 9000 .1,ts .06 3200 3600 .03,ts .06 4300 4800 .02 .03|', // hiss
  'storm-staff': 'tq .15 2000 120 .05,nh .02 5000 5000 .2 .03,nh .02 4000 4000 .15 .08|', // zap
  wand: 'ts .09 2600 2680 .03,ts .09 3300 3400 .03 .05,ts .09 3950 4070 .03 .1|', // sparkle
  'void-orb': 'ts .4 300 150 .06,ts .4 312 140 .05|', // warble
  slingshot: 'tt .07 300 900 .1,nb .05 1500 3000 .08 0 2|', // thwip
  bubble: 'ts .07 250 600 .1,ts .06 350 800 .08 .07|ts .04 900 1800 .2,nh .03 5000 5000 .1', // blub, pop
  confetti: 'nb .06 2000 2000 .3,nh .3 6000 6000 .05 .05,tt .15 500 900 .04|', // popper
};
const WSND_NAME = { s: 'sine', t: 'triangle', q: 'square', w: 'sawtooth', n: 'noise', b: 'bandpass', h: 'highpass', l: 'lowpass' };
const WSND_CACHE = {};

// A weapon's layers { s, h }: its signature, or its category's lowered by mass with the swing stretched by reach; always
// at its own pitch. Each layer is [kind, secs, Hz, Hz2, vol, delay, Q].
function wsndRecipe(key) {
  if (WSND_CACHE[key]) return WSND_CACHE[key];
  const w = WEAPONS[key] || {}, own = WSND[WSND[key]] || WSND[key] || '|', cat = (WSND_CAT[w.cat] || WSND_CAT.exotic).split('|');
  const pitch = 2 ** ((musicHash(key) % 49 - 24) / 96), heavy = pitch / (w.mass || 1) ** .3, reach = clamp((w.len || 60) / 80, .6, 1.6);
  const shape = (str, fk, dk) => str.split(',').map(l => l.split(' ').map((x, i) => !i ? x : i === 1 ? Math.round(x * dk * 1e3) / 1e3 : i < 4 ? Math.round(x * fk) : +x));
  const [s, h] = own.split('|');
  return WSND_CACHE[key] = { s: s ? shape(s, pitch, 1) : shape(cat[0], heavy, reach), h: h ? shape(h, pitch, 1) : shape(cat[1], heavy, 1) };
}

function wsndPlay(layers, v, key) {
  for (const [k, dur, f0, f1, vol, delay = 0, q = 1] of layers) {
    if (k === 'm') metal(f0, dur, vol * v, delay);
    else if (k[0] === 'n') noiseSweep(dur, f0, f1, vol * v, WSND_NAME[k[1]], delay, q);
    else if (k[0] === 'h') audioHold(key, dur, WSND_NAME[k[1]], f0, vol * v);
    else tone(f0, f1, dur, WSND_NAME[k[1]], vol * v, delay);
  }
}
defSfx('ws', (v, key) => wsndPlay(wsndRecipe(key).s, v, key));
defSfx('wh', (v, key) => wsndPlay(wsndRecipe(key).h, v, key));

// Each melee attack (not a mount's) adds its weapon's swing to the generic whoosh; each shot adds the gun's layer.
on('attack', f => { if (AC && !f.w.ranged && !f.mount) sfx('ws:' + f.wkey); });
on('fire', f => { if (AC) sfx('ws:' + f.wkey); });
// Direct hits by a weapon (melee or its shots) get its hit sound; a gun swung as a club lands like a punch.
on('damage', (B, amt, o) => {
  if (!AC || !o || o.small || (o.kind !== 'melee' && o.kind !== 'proj')) return;
  const w = o.weapon || (o.src && o.src.w);
  if (w) sfxAt(w.hitSfx || 'wh:' + (o.kind === 'melee' && w.ranged ? 'fists' : w.key), o.x ?? B.P[1].x, clamp(amt / 16, .5, 1.3));
});
