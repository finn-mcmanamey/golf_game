// ===== v8: two painted arenas =====
// Lantern Festival and Glowshroom Forest use painted backdrops (generated with GameFoundry, embedded at build time from
// assets/ by build.mjs's '@asset:' rule) behind the usual hand-drawn ground, ledges and effects.
// Drawing only: the pictures never touch physics, and headless runs (no Image) just skip them.

// Loads a backdrop once; draws nothing until it has decoded (and never in a page without Image).
function paintedImage(src) {
  const pic = { img: null, ready: false };
  if (typeof Image !== 'undefined') {
    pic.img = new Image();
    pic.img.onload = () => { pic.ready = true; };
    pic.img.src = src;
  }
  return pic;
}
const PAINTED = {
  lanterns: paintedImage('@asset:arena-lanterns.webp'),
  glowshroom: paintedImage('@asset:arena-glowshroom.webp'),
};

// The picture fills the view's width with a little parallax; the sky above it is a gradient in its top colour. `dim`
// darkens it so the painted scenery never competes with the real ledges drawn on top.
function paintedBackdrop(ctx, pic, fl, skyTop, skyEdge, dim) {
  mapSky(ctx, fl, [skyTop, skyTop, skyEdge, skyEdge]);
  if (!pic.ready) return;
  mapFar(ctx, .12, c => {
    const w = W + 160, h = w * pic.img.height / pic.img.width;
    c.drawImage(pic.img, -80, fl + 30 - h, w, h);
    mapRect(c, `rgba(4,2,20,${dim})`, -80, fl + 30 - h, w, h);
    mapVGrad(c, -80, fl + 30 - h - 2, w, 60, [skyEdge, rgba(skyEdge, 0)]);   // soften the picture's top edge
  });
}

// ---------- Lantern Festival ----------
// Paper-lantern ledges rise and sink on the breeze; a wooden bridge spans the middle.
const LANTERN_GOLD = '#ffb547';

defMap('lanterns', {
  name: 'Lantern Festival', order: 240,
  desc: 'A night river full of floating lanterns. The lantern ledges rise and sink on the breeze, so time your jumps.',
  floor: 650, walls: true,
  palette: { sky1: '#0b1550', sky2: '#182f69', ground: '#2a1a14', line: LANTERN_GOLD, accent: '#ff7a3a', solid: '#3a2418' },
  solids: [
    { x: 120, y: 470, w: 170, lantern: 1, move: { dx: 0, dy: 70, period: 6.5, phase: 0 } },
    { x: 990, y: 470, w: 170, lantern: 1, move: { dx: 0, dy: 70, period: 6.5, phase: .5 } },
    { x: 490, y: 430, w: 300, bridge: 1 },
    { x: 560, y: 250, w: 160, lantern: 1, move: { dx: 0, dy: 55, period: 5, phase: .25 } },
  ],
  spawns: [[300, 650], [980, 650], [640, 430], [205, 470]],
  drawBg(ctx, t) {
    const fl = this.floor;
    paintedBackdrop(ctx, PAINTED.lanterns, fl, '#0b1550', '#182f69', .18);
    mapParticles(ctx, t, 18, { vy: -22, vx: 3, size: 2.5, color: '#ffd28a', alpha: .55, shape: 'circle', seed: 31, sway: 14 });
    mapGround(ctx, fl, '#2a1a14', LANTERN_GOLD, 3, () => {   // a plank boardwalk along the river
      for (let x = -40; x < W + 40; x += 46) mapRect(ctx, 'rgba(0,0,0,.25)', x, fl + 4, 2, H - fl + 40);
      for (let x = 30; x < W; x += 180) glow(ctx, LANTERN_GOLD, 14, () => circle(ctx, x, fl + 16, 3, rgba(LANTERN_GOLD, .8)));
    });
  },
  drawSolid(ctx, s, t) {
    if (s.bridge) {   // an arched wooden bridge deck with railings
      mapSlab(ctx, s, '#3a2418', LANTERN_GOLD);
      for (let x = s.x + 12; x < s.x + s.w - 8; x += 36) lineXY(ctx, x, s.y, x, s.y - 20, rgba(LANTERN_GOLD, .5), 2);
      lineXY(ctx, s.x + 8, s.y - 20, s.x + s.w - 8, s.y - 20, rgba(LANTERN_GOLD, .6), 2);
      return;
    }
    // A lantern ledge: a glowing paper lantern hangs under a thin wooden tray.
    const cx = s.x + s.w / 2, flick = .85 + .15 * Math.sin(t * 7 + s.x);
    glow(ctx, LANTERN_GOLD, 26 * flick, () => {
      mapBrush(ctx, rgba('#ffcf7a', .9 * flick)); ctx.ellipse(cx, s.y + 34, s.w * .28, 28, 0, 0, TAU); ctx.fill();
    });
    for (const dy of [14, 34, 54]) lineXY(ctx, cx - s.w * .26, s.y + dy, cx + s.w * .26, s.y + dy, 'rgba(160,70,20,.45)', 1.5);
    mapSlab(ctx, s, '#3a2418', LANTERN_GOLD);
  },
});

// ---------- Glowshroom Forest ----------
// Mushroom caps are ledges; the little glowing mushrooms on the forest floor are springs.
const SHROOM_TEAL = '#5ef2ff', SHROOM_VIOLET = '#e05cff';

defMap('glowshroom', {
  name: 'Glowshroom Forest', order: 241,
  desc: 'A glowing mushroom forest. Stand on the giant caps, and step on the small glowing mushrooms to spring sky-high.',
  floor: 650, walls: true,
  palette: { sky1: '#160b57', sky2: '#2a1470', ground: '#0a0a2a', line: SHROOM_TEAL, accent: SHROOM_VIOLET, solid: '#1c1450' },
  solids: [
    { x: 110, y: 440, w: 230, cap: SHROOM_TEAL },
    { x: 940, y: 440, w: 230, cap: SHROOM_VIOLET },
    { x: 510, y: 300, w: 260, cap: SHROOM_TEAL },
  ],
  pads: [
    { x: 395, y: 650, w: 96, v: 1950, color: SHROOM_TEAL },
    { x: 789, y: 650, w: 96, v: 1950, color: SHROOM_VIOLET },
  ],
  spawns: [[290, 650], [990, 650], [225, 440], [1055, 440]],
  onStep(dt) {
    if (!this.livePads) this.livePads = this.pads.map(p => Object.assign({}, p));   // per-round copy (squash state)
    mapStepPads(this, this.livePads, dt);
  },
  drawBg(ctx, t) {
    const fl = this.floor;
    paintedBackdrop(ctx, PAINTED.glowshroom, fl, '#0c0640', '#160b57', .38);
    mapParticles(ctx, t, 30, { vy: -12, vx: 5, size: 2, color: '#b8a8ff', alpha: .6, shape: 'circle', seed: 17, sway: 18 });
    mapGround(ctx, fl, '#0a0a2a', SHROOM_TEAL, 3, () => mapHaze(ctx, fl + 60, 60, '#5e3cff', .25));
  },
  drawSolid(ctx, s, t) {
    // A giant mushroom: a stem down to the ground and a glowing domed cap whose top is the ledge.
    const cx = s.x + s.w / 2, pulse = .8 + .2 * Math.sin(t * 1.6 + s.x * .01);
    mapRect(ctx, '#2c2468', cx - 22, s.y + 10, 44, this.floor - s.y - 10);
    glow(ctx, s.cap, 22 * pulse, () => {
      mapBrush(ctx, rgba(s.cap, .85)); ctx.ellipse(cx, s.y + 12, s.w / 2 + 8, 24, 0, Math.PI, TAU); ctx.fill();
    });
    mapRect(ctx, rgba(s.cap, .55), s.x - 4, s.y + 8, s.w + 8, 8);
    for (let k = 0; k < 5; k++) circle(ctx, s.x + s.w * (.15 + k * .175), s.y + 2 - (k % 2) * 6, 4, 'rgba(255,255,255,.75)');
  },
  drawFg(ctx, t) {
    for (const pd of this.livePads || this.pads) shroomDrawPad(ctx, pd, t);
  },
});

// A small glowing mushroom spring that squashes when someone bounces on it.
function shroomDrawPad(ctx, pd, t) {
  const sq = pd.squash || 0, cx = pd.x + pd.w / 2, top = pd.y - 18 + sq * 8;
  mapRect(ctx, '#3a2c80', cx - 9, top + 6, 18, pd.y - top - 6);
  glow(ctx, pd.color, 16 + sq * 22, () => {
    mapBrush(ctx, rgba(pd.color, .9)); ctx.ellipse(cx, top + 6, pd.w / 2 + sq * 8, 14 - sq * 5, 0, Math.PI, TAU); ctx.fill();
  });
  const bob = Math.sin(t * 6) * 3;   // the same up-arrow hint as Rainbow Bounce's drums
  poly(ctx, [[cx - 7, top - 18 + bob], [cx, top - 27 + bob], [cx + 7, top - 18 + bob]], rgba(pd.color, .7));
}

on('boot', () => Object.assign(LORE_LINES.m, {
  lanterns: 'On the night the Great Candle was first lit, the river towns sent a lantern up for every wick that answered. ' +
    'They still do, and the lanterns that catch the breeze low enough make fine stepping stones.',
  glowshroom: 'Where the Wick once spilled a drop of light, the mushrooms drank it and never stopped glowing. ' +
    'The little ones spring back hard, so fighters use them to reach the caps.',
}));
