// 75-cosmetics.js: hats, colour packs, player settings, the v4 save migration, lifetime stats and achievements.
// A hat's draw(ctx, f, h) runs with the context already moved to the head centre and rotated so -y points out of the
// top of the head; h = { r, face, scale, color }. Sizes are multiples of h.r so hats grow with bosses.
// v4: everything is free from the start (no coins or shop); a `hidden` hat is a secret until its code is found.

// ---------- hat drawing helpers ----------
function hatRect(ctx, x, y, w, h, fill, stroke, lw = 1.5) {
  ctx.beginPath(); ctx.rect(x, y, w, h);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function hatEllipse(ctx, x, y, rx, ry, fill, stroke, lw = 1.5, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
// A dome sitting on the head: the upper half of a circle around (0, y).
function hatDome(ctx, y, rad, fill, stroke, lw = 1.5) {
  ctx.beginPath(); ctx.arc(0, y, rad, Math.PI, 0); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
// Point a fraction t of the way from a to b (for stripes on cones).
const hatLerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
// Hat-local time, so hats animate in menus too.
const hatT = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : G_STATE.t);
const hatLw = h => 1.5 * h.scale;

// ---------- hats ----------
defHat('none', { name: 'None', order: 0, draw() {} });

defHat('band', {
  name: 'Ninja Band', order: 1,
  draw(ctx, f, h) {
    const r = h.r;
    ctx.fillStyle = '#ff3d5a';
    ctx.fillRect(-r * 1.02, -r * .55, r * 2.04, r * .42);
    const tail = Math.sin(G_STATE.t * 9 + f.id) * r * .25;   // ribbon tails flutter behind the head
    line(ctx, { x: -h.face * r, y: -r * .35 }, { x: -h.face * r * 2.1, y: -r * .1 + tail }, '#ff3d5a', r * .22);
    line(ctx, { x: -h.face * r, y: -r * .3 }, { x: -h.face * r * 1.8, y: r * .25 - tail }, '#d92a45', r * .18);
  },
});

defHat('cap', {
  name: 'Ball Cap', order: 2,
  draw(ctx, f, h) {
    const r = h.r, d = h.face;
    hatDome(ctx, -r * .35, r * 1.02, '#ff3d5a', '#7a1424', hatLw(h));
    poly(ctx, [[d * r * .2, -r * .42], [d * r * 1.9, -r * .32], [d * r * 1.85, -r * .14], [d * r * .2, -r * .2]], '#d92a45', '#7a1424', hatLw(h));
    circle(ctx, 0, -r * 1.36, r * .13, '#ffffff');
  },
});

defHat('beanie', {
  name: 'Beanie', order: 3,
  draw(ctx, f, h) {
    const r = h.r;
    hatDome(ctx, -r * .3, r * 1.06, '#2ee6a0', '#138a60', hatLw(h));
    hatRect(ctx, -r * 1.1, -r * .52, r * 2.2, r * .4, '#1fb582', '#138a60', hatLw(h));
    circle(ctx, 0, -r * 1.45, r * .32, '#f4f6ff', '#c8ccd8', hatLw(h));
  },
});

defHat('sprout', {
  name: 'Sprout', order: 4,
  draw(ctx, f, h) {
    const r = h.r, sway = Math.sin(hatT() * 2.5 + f.id) * r * .12;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r * .95); ctx.quadraticCurveTo(r * .1, -r * 1.4, sway, -r * 1.8);
    ctx.strokeStyle = '#4fd36a'; ctx.lineWidth = r * .14; ctx.stroke();
    hatEllipse(ctx, sway - r * .38, -r * 1.85, r * .4, r * .18, '#7cff8a', '#2f9a44', hatLw(h), -.5);
    hatEllipse(ctx, sway + r * .38, -r * 1.9, r * .4, r * .18, '#7cff8a', '#2f9a44', hatLw(h), .5);
  },
});

defHat('catears', {
  name: 'Cat Ears', order: 5,
  draw(ctx, f, h) {
    const r = h.r;
    for (const s of [-1, 1]) {
      poly(ctx, [[s * r * .2, -r * .8], [s * r * .95, -r * .5], [s * r * .78, -r * 1.65]], h.color, '#0b0c18', hatLw(h));
      poly(ctx, [[s * r * .4, -r * .82], [s * r * .78, -r * .66], [s * r * .7, -r * 1.3]], '#ff9ad5');
    }
  },
});

defHat('bunny', {
  name: 'Bunny Ears', order: 6,
  draw(ctx, f, h) {
    const r = h.r, wob = Math.sin(hatT() * 4 + f.id) * .07;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * r * .4, -r * .8); ctx.rotate(s * .2 + wob * s);
      hatEllipse(ctx, 0, -r * 1.0, r * .32, r * 1.05, '#f4f6ff', '#b9bfd6', hatLw(h));
      hatEllipse(ctx, 0, -r * .95, r * .15, r * .72, '#ffb3d1');
      ctx.restore();
    }
  },
});

defHat('party', {
  name: 'Party Hat', order: 7,
  draw(ctx, f, h) {
    const r = h.r, L = [-r * .62, -r * .82], R = [r * .62, -r * .82], T = [r * .1 * h.face, -r * 2.5];
    poly(ctx, [L, R, T], '#ff5ad1', '#9c1f78', hatLw(h));
    for (const [a, b] of [[.2, .38], [.56, .72]]) poly(ctx, [hatLerp(L, T, a), hatLerp(R, T, a), hatLerp(R, T, b), hatLerp(L, T, b)], '#ffd84a');
    circle(ctx, T[0], T[1], r * .26, '#5ef2ff', '#1a8fa0', hatLw(h));
  },
});

defHat('headphones', {
  name: 'Headphones', order: 8,
  draw(ctx, f, h) {
    const r = h.r;
    ctx.beginPath(); ctx.arc(0, -r * .05, r * 1.22, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = '#2a2d3e'; ctx.lineWidth = r * .3; ctx.stroke();
    ctx.strokeStyle = '#5ef2ff'; ctx.lineWidth = r * .08; ctx.stroke();
    for (const s of [-1, 1]) {
      hatEllipse(ctx, s * r * 1.08, r * .05, r * .34, r * .55, '#2a2d3e', '#5ef2ff', hatLw(h));
      hatEllipse(ctx, s * r * 1.08, r * .05, r * .12, r * .25, '#ff5ad1');
    }
  },
});

defHat('antennae', {
  name: 'Antennae', order: 9,
  draw(ctx, f, h) {
    const r = h.r, t = hatT();
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const tx = s * r * .8 + Math.sin(t * 3 + s + f.id) * r * .15, ty = -r * 2.1;
      ctx.beginPath(); ctx.moveTo(s * r * .3, -r * .9); ctx.quadraticCurveTo(s * r * .45, -r * 1.6, tx, ty);
      ctx.strokeStyle = '#c9cfff'; ctx.lineWidth = r * .1; ctx.stroke();
      circle(ctx, tx, ty, r * .24, '#9dff5a', '#e8ffd6', hatLw(h) * .6);
    }
  },
});

defHat('bow', {
  name: 'Big Bow', order: 10,
  draw(ctx, f, h) {
    const r = h.r, x = -h.face * r * .25, y = -r * 1.08;
    for (const s of [-1, 1]) poly(ctx, [[x, y], [x + s * r * .9, y - r * .5], [x + s * r * .95, y + r * .35]], '#ff5ad1', '#9c1f78', hatLw(h));
    circle(ctx, x, y, r * .22, '#ff8ae0', '#9c1f78', hatLw(h));
  },
});

defHat('cone', {
  name: 'Traffic Cone', order: 11,
  draw(ctx, f, h) {
    const r = h.r, L = [-r * .7, -r * .8], R = [r * .7, -r * .8], TL = [-r * .16, -r * 2.45], TR = [r * .16, -r * 2.45];
    poly(ctx, [L, R, TR, TL], '#ff8a1e', '#a64b00', hatLw(h));
    for (const [a, b] of [[.25, .4], [.6, .74]]) poly(ctx, [hatLerp(L, TL, a), hatLerp(R, TR, a), hatLerp(R, TR, b), hatLerp(L, TL, b)], '#f4f6ff');
    hatRect(ctx, -r * 1.05, -r * .9, r * 2.1, r * .24, '#ff8a1e', '#a64b00', hatLw(h));
  },
});

defHat('fez', {
  name: 'Fez', order: 12,
  draw(ctx, f, h) {
    const r = h.r, d = h.face, sway = Math.sin(hatT() * 3 + f.id) * r * .1;
    poly(ctx, [[-r * .66, -r * .7], [-r * .5, -r * 1.75], [r * .5, -r * 1.75], [r * .66, -r * .7]], '#c8203a', '#7a1424', hatLw(h));
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r * 1.75); ctx.lineTo(-d * r * .6, -r * 1.62); ctx.lineTo(-d * r * .78 + sway, -r * .95);
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = r * .1; ctx.stroke();
  },
});

defHat('chef', {
  name: 'Chef Hat', order: 13,
  draw(ctx, f, h) {
    const r = h.r, lw = hatLw(h);
    for (const [x, y, rad] of [[-r * .55, -r * 1.6, r * .55], [r * .55, -r * 1.6, r * .55], [0, -r * 1.95, r * .66]]) circle(ctx, x, y, rad, '#f4f6ff', '#b9bfd6', lw);
    hatRect(ctx, -r * .85, -r * 1.25, r * 1.7, r * .5, '#f4f6ff', '#b9bfd6', lw);
  },
});

defHat('cowboy', {
  name: 'Cowboy Hat', order: 14,
  draw(ctx, f, h) {
    const r = h.r, lw = hatLw(h);
    poly(ctx, [[-r * .72, -r * .9], [-r * .62, -r * 1.9], [0, -r * 1.62], [r * .62, -r * 1.9], [r * .72, -r * .9]], '#9c6b3c', '#5a3a1c', lw);
    hatRect(ctx, -r * .7, -r * 1.14, r * 1.4, r * .22, '#3a2412');
    ctx.beginPath(); ctx.moveTo(-r * 1.95, -r * 1.25);
    ctx.quadraticCurveTo(0, -r * .5, r * 1.95, -r * 1.25); ctx.quadraticCurveTo(0, -r * .8, -r * 1.95, -r * 1.25);
    ctx.fillStyle = '#b07a45'; ctx.fill(); ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = lw; ctx.stroke();
  },
});

defHat('pirate', {
  name: 'Pirate Hat', order: 15,
  draw(ctx, f, h) {
    const r = h.r;
    // A lifted dark felt with a lighter crown band so it reads as solid on dark skies and panels.
    poly(ctx, [[-r * 1.6, -r * .7], [-r * 1.1, -r * 1.65], [0, -r * 1.3], [r * 1.1, -r * 1.65], [r * 1.6, -r * .7], [0, -r * .95]], '#3d3656', '#ffd84a', hatLw(h));
    poly(ctx, [[-r * 1.15, -r * 1.5], [0, -r * 1.18], [r * 1.15, -r * 1.5], [r * 1.0, -r * 1.3], [0, -r * 1.05], [-r * 1.0, -r * 1.3]], '#57507a');
    lineXY(ctx, -r * .3, -r * .95, r * .3, -r * 1.35, '#f4f6ff', r * .08);
    lineXY(ctx, r * .3, -r * .95, -r * .3, -r * 1.35, '#f4f6ff', r * .08);
    circle(ctx, 0, -r * 1.2, r * .2, '#f4f6ff');
  },
});

defHat('propeller', {
  name: 'Propeller Cap', order: 16,
  draw(ctx, f, h) {
    const r = h.r, cols = ['#ff3d5a', '#ffd84a', '#2ee6ff', '#9dff5a'];
    for (let k = 0; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(0, -r * .3); ctx.arc(0, -r * .3, r * 1.05, Math.PI + k * Math.PI / 4, Math.PI + (k + 1) * Math.PI / 4); ctx.closePath();
      ctx.fillStyle = cols[k]; ctx.fill();
    }
    lineXY(ctx, 0, -r * 1.3, 0, -r * 1.75, '#c9cfff', r * .12);
    const spin = Math.cos(hatT() * 20 + f.id) * r * 1.2;     // a spinning blade seen from the side
    lineXY(ctx, -spin, -r * 1.8, spin, -r * 1.8, '#ff5ad1', r * .22);
    circle(ctx, 0, -r * 1.8, r * .14, '#f4f6ff');
  },
});

defHat('mohawk', {
  name: 'Neon Mohawk', order: 17,
  draw(ctx, f, h) {
    const r = h.r, pts = [];
    for (let k = 0; k <= 6; k++) {
      const a = -Math.PI * (.88 - k * .76 / 6), len = r * (.6 + .45 * Math.sin(Math.PI * k / 6));
      pts.push([Math.cos(a) * r * .92, Math.sin(a) * r * .92], [Math.cos(a) * (r + len), Math.sin(a) * (r + len)]);
    }
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    ctx.fillStyle = '#ff3df0'; ctx.fill(); ctx.strokeStyle = '#ffd1fb'; ctx.lineWidth = hatLw(h) * .7; ctx.stroke();
  },
});

defHat('flowers', {
  name: 'Flower Crown', order: 18,
  draw(ctx, f, h) {
    const r = h.r, cols = ['#ff5ad1', '#ffd84a', '#5ef2ff', '#ff8a2e', '#b98cff'];
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI * (.9 - k * .2), x = Math.cos(a) * r * .95, y = Math.sin(a) * r * .95;
      for (let p = 0; p < 5; p++) circle(ctx, x + Math.cos(p * TAU / 5) * r * .17, y + Math.sin(p * TAU / 5) * r * .17, r * .14, cols[k]);
      circle(ctx, x, y, r * .1, '#fff7c2');
    }
  },
});

defHat('gradcap', {
  name: 'Grad Cap', order: 19,
  draw(ctx, f, h) {
    const r = h.r, d = h.face, sway = Math.sin(hatT() * 2 + f.id) * r * .12;
    hatRect(ctx, -r * .8, -r * 1.2, r * 1.6, r * .5, '#1b1c26', '#5d6290', hatLw(h));
    poly(ctx, [[-r * 1.5, -r * 1.22], [0, -r * 1.52], [r * 1.5, -r * 1.22], [0, -r * .96]], '#22243a', '#7d84b8', hatLw(h));
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -r * 1.24); ctx.lineTo(d * r * 1.25, -r * 1.2); ctx.lineTo(d * r * 1.3 + sway, -r * .45);
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = r * .09; ctx.stroke();
    circle(ctx, 0, -r * 1.24, r * .1, '#ffd84a');
  },
});

defHat('santa', {
  name: 'Festive Hat', order: 20,
  draw(ctx, f, h) {
    const r = h.r, d = h.face, tx = -d * r * 1.55, ty = -r * 1.25 + Math.sin(hatT() * 3 + f.id) * r * .08;
    ctx.beginPath(); ctx.moveTo(d * r, -r * .75); ctx.quadraticCurveTo(d * r * .3, -r * 2.5, tx, ty);
    ctx.quadraticCurveTo(-d * r * .6, -r * 1.4, -d * r, -r * .75); ctx.closePath();
    ctx.fillStyle = '#e8283c'; ctx.fill(); ctx.strokeStyle = '#7a1424'; ctx.lineWidth = hatLw(h); ctx.stroke();
    hatRect(ctx, -r * 1.1, -r * .98, r * 2.2, r * .42, '#f4f6ff', '#c8ccd8', hatLw(h));
    circle(ctx, tx, ty, r * .28, '#f4f6ff');
  },
});

defHat('strawhat', {
  name: 'Straw Hat', order: 21,
  draw(ctx, f, h) {
    const r = h.r;
    hatEllipse(ctx, 0, -r * .78, r * 2.0, r * .38, '#e8c873', '#a8862e', hatLw(h));
    hatDome(ctx, -r * .85, r * .85, '#f0d488', '#a8862e', hatLw(h));
    hatRect(ctx, -r * .85, -r * 1.12, r * 1.7, r * .24, '#ff3d5a');
  },
});

defHat('tophat', {
  name: 'Top Hat', order: 22,
  draw(ctx, f, h) {
    const r = h.r, lw = hatLw(h);
    hatRect(ctx, -r * .78, -r * 2.55, r * 1.56, r * 1.65, '#3a3550', '#c9cfff', lw);   // lifted from near-black so it reads solid
    hatRect(ctx, -r * .5, -r * 2.45, r * .26, r * 1.1, 'rgba(255,255,255,.14)');      // soft sheen down the crown
    hatRect(ctx, -r * .78, -r * 1.3, r * 1.56, r * .3, '#ff5ad1');
    hatRect(ctx, -r * 1.28, -r * 1.0, r * 2.56, r * .24, '#4a4466', '#c9cfff', lw);
  },
});

defHat('wizard', {
  name: 'Wizard Hat', order: 23,
  draw(ctx, f, h) {
    const r = h.r, d = h.face, tipX = -d * r * .7 + Math.sin(hatT() * 2 + f.id) * r * .1;
    ctx.beginPath(); ctx.moveTo(-r * .85, -r * .9); ctx.quadraticCurveTo(-r * .3, -r * 2, tipX, -r * 3.0);
    ctx.quadraticCurveTo(r * .35, -r * 2, r * .85, -r * .9); ctx.closePath();
    ctx.fillStyle = '#5b3dc4'; ctx.fill(); ctx.strokeStyle = '#b98cff'; ctx.lineWidth = hatLw(h); ctx.stroke();
    hatEllipse(ctx, 0, -r * .88, r * 1.5, r * .3, '#4a2fa8', '#b98cff', hatLw(h));
    for (const [x, y, s] of [[-r * .2, -r * 1.5, .22], [r * .3, -r * 1.95, .16], [-r * .05, -r * 2.35, .12]]) hatStar(ctx, x, y, r * s, '#ffd84a');
  },
});

// A four-point sparkle.
function hatStar(ctx, x, y, s, color) {
  poly(ctx, [[x, y - s * 2], [x + s * .5, y - s * .5], [x + s * 2, y], [x + s * .5, y + s * .5], [x, y + s * 2], [x - s * .5, y + s * .5], [x - s * 2, y], [x - s * .5, y - s * .5]], color);
}

defHat('horns', {
  name: 'Devil Horns', order: 24,
  draw(ctx, f, h) {
    const r = h.r;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * r * .25, -r * .9);
      ctx.quadraticCurveTo(s * r * 1.15, -r * 1.0, s * r * 1.0, -r * 1.9);
      ctx.quadraticCurveTo(s * r * .8, -r * 1.15, s * r * .72, -r * .62); ctx.closePath();
      ctx.fillStyle = '#ff3d3d'; ctx.fill(); ctx.strokeStyle = '#7a0f18'; ctx.lineWidth = hatLw(h); ctx.stroke();
    }
  },
});

defHat('viking', {
  name: 'Viking Helm', order: 25,
  draw(ctx, f, h) {
    const r = h.r, lw = hatLw(h);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * r * .85, -r * .55);
      ctx.quadraticCurveTo(s * r * 1.95, -r * .75, s * r * 1.8, -r * 1.95);
      ctx.quadraticCurveTo(s * r * 1.55, -r * 1.05, s * r * .8, -r * 1.0); ctx.closePath();
      ctx.fillStyle = '#f0e6c8'; ctx.fill(); ctx.strokeStyle = '#8a7a52'; ctx.lineWidth = lw; ctx.stroke();
    }
    hatDome(ctx, -r * .2, r * 1.08, '#8d96a8', '#4c5366', lw);
    hatRect(ctx, -r * 1.12, -r * .42, r * 2.24, r * .3, '#b08a3e', '#6e5420', lw);
    for (const x of [-.7, 0, .7]) circle(ctx, x * r, -r * .27, r * .07, '#ffe9a8');
  },
});

defHat('laurel', {
  name: 'Golden Laurel', order: 26,
  draw(ctx, f, h) {
    const r = h.r;
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI * (.95 - k * .1), x = Math.cos(a) * r * 1.0, y = Math.sin(a) * r * 1.0;
      hatEllipse(ctx, x, y, r * .3, r * .13, '#ffd84a', '#a8801a', hatLw(h) * .5, a + Math.PI / 2 + (k < 5 ? .5 : -.5));
    }
  },
});

defHat('helm', {
  name: 'Knight Helm', order: 27,
  draw(ctx, f, h) {
    const r = h.r, d = h.face, lw = hatLw(h), sway = Math.sin(hatT() * 3 + f.id) * r * .1;
    ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.quadraticCurveTo(-d * r * .9, -r * 2.3, -d * r * 1.9, -r * 1.6 + sway);
    ctx.quadraticCurveTo(-d * r * 1.0, -r * 1.6, 0, -r * 1.05); ctx.fillStyle = '#ff3d5a'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, -r * .1, r * 1.12, Math.PI, 0); ctx.lineTo(r * 1.12, r * 1.05); ctx.lineTo(-r * 1.12, r * 1.05); ctx.closePath();
    ctx.fillStyle = '#9aa3b8'; ctx.fill(); ctx.strokeStyle = '#e1e6f2'; ctx.lineWidth = lw; ctx.stroke();
    hatRect(ctx, d > 0 ? r * .05 : -r * 1.12, -r * .25, r * 1.07, r * .18, '#0b0c18');
    lineXY(ctx, 0, -r * 1.2, 0, r * 1.0, '#c3cad9', lw);
  },
});

defHat('kabuto', {
  name: 'Samurai Kabuto', order: 28,
  draw(ctx, f, h) {
    const r = h.r, d = h.face, lw = hatLw(h);
    poly(ctx, [[-d * r * 1.1, -r * .3], [-d * r * 1.55, r * .55], [-d * r * .7, r * .45], [-d * r * .45, -r * .3]], '#3a1520', '#c9a14a', lw);
    hatDome(ctx, -r * .25, r * 1.12, '#3a1520', '#c9a14a', lw);
    hatRect(ctx, -r * 1.18, -r * .4, r * 2.36, r * .22, '#c9a14a');
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {   // golden crest rising from the brow
      ctx.beginPath(); ctx.moveTo(d * r * .45, -r * 1.0); ctx.quadraticCurveTo(d * r * .45 + s * r * 1.0, -r * 1.3, d * r * .45 + s * r * .7, -r * 2.4);
      ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = r * .18; ctx.stroke();
    }
    circle(ctx, d * r * .45, -r * 1.0, r * .2, '#ffd84a', '#a8801a', lw * .6);
  },
});

defHat('unicorn', {
  name: 'Unicorn Horn', order: 29,
  draw(ctx, f, h) {
    const r = h.r, d = h.face, b1 = [d * r * .2, -r * .8], b2 = [d * r * .7, -r * .6], tip = [d * r * 1.15, -r * 2.4];
    glow(ctx, '#ff8ae0', 10 * h.scale, () => poly(ctx, [b1, b2, tip], '#fff4d6', '#ffb3e6', hatLw(h)));
    for (const t of [.25, .5, .72]) { const a = hatLerp(b1, tip, t), b = hatLerp(b2, tip, t - .1); lineXY(ctx, a[0], a[1], b[0], b[1], '#ffd84a', r * .08); }
  },
});

defHat('bubble', {
  name: 'Space Bubble', order: 30,
  draw(ctx, f, h) {
    const r = h.r;
    hatEllipse(ctx, 0, r * 1.45, r * 1.0, r * .3, '#c9cfff', '#7d84b8', hatLw(h));
    circle(ctx, 0, r * .05, r * 1.55, 'rgba(160,220,255,.14)', 'rgba(205,240,255,.85)', r * .1);
    ctx.beginPath(); ctx.arc(0, r * .05, r * 1.25, Math.PI * 1.15, Math.PI * 1.45);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = r * .12; ctx.stroke();
  },
});

defHat('halo', {
  name: 'Halo', order: 31,
  draw(ctx, f, h) {
    const r = h.r, bob = Math.sin(hatT() * 3 + f.id) * r * .12;
    glow(ctx, '#ffd84a', 14 * h.scale, () => hatEllipse(ctx, 0, -r * 1.75 + bob, r * .95, r * .3, null, '#ffe66b', r * .22));
  },
});

defHat('blaze', {
  name: 'Blaze', order: 32,
  draw(ctx, f, h) {
    const r = h.r, t = hatT();
    glow(ctx, '#ff5a1e', 12 * h.scale, () => {
      for (let k = 0; k < 5; k++) {
        const x = (k - 2) * r * .38, ht = r * (.9 + .45 * Math.sin(t * 12 + k * 1.7 + f.id)), sway = Math.sin(t * 7 + k) * r * .15;
        for (const [w, col, s] of [[.32, '#ff6a1e', 1], [.18, '#ffd84a', .62]]) {
          ctx.beginPath(); ctx.moveTo(x - r * w, -r * .7);
          ctx.quadraticCurveTo(x - r * w, -r * .7 - ht * s * .6, x + sway, -r * .7 - ht * s);
          ctx.quadraticCurveTo(x + r * w, -r * .7 - ht * s * .6, x + r * w, -r * .7); ctx.closePath();
          ctx.fillStyle = col; ctx.fill();
        }
      }
    });
  },
});

defHat('crown', {
  name: 'Crown', order: 33,
  draw(ctx, f, h) {
    const r = h.r, y = -r * .7;
    poly(ctx, [[-r * .9, y], [-r * .9, y - r * .8], [-r * .45, y - r * .35], [0, y - r * 1.05], [r * .45, y - r * .35], [r * .9, y - r * .8], [r * .9, y]],
      '#ffd84a', '#a8801a', 1.5 * h.scale);
    circle(ctx, 0, y - r * .25, r * .14, '#ff5ad1');
  },
});

// ---------- colour packs (four fighter colours each, all free) ----------
const COLOR_PACKS = [
  { key: 'neon', name: 'Neon Classic', colors: DEFAULT_COLORS.slice() },
  { key: 'sunset', name: 'Sunset', colors: ['#ff6b6b', '#ffa94d', '#ffd43b', '#f783ac'] },
  { key: 'ocean', name: 'Deep Ocean', colors: ['#3bc9db', '#4dabf7', '#38d9a9', '#91a7ff'] },
  { key: 'toxic', name: 'Toxic', colors: ['#a9e34b', '#69db7c', '#d8f55a', '#20c997'] },
  { key: 'candy', name: 'Candy Floss', colors: ['#ff9ff3', '#feca57', '#ff6b9d', '#c56cf0'] },
  { key: 'ember', name: 'Ember', colors: ['#ff4a1c', '#ff7b00', '#ffb703', '#e63946'] },
  { key: 'frost', name: 'Frostbite', colors: ['#e3fafc', '#a5d8ff', '#d0bfff', '#99e9f2'] },
  { key: 'royal', name: 'Royal', colors: ['#ffd84a', '#b197fc', '#e599f7', '#f8f9fa'] },
  { key: 'mono', name: 'Chrome', colors: ['#ced4da', '#adb5bd', '#f1f3f5', '#8ce0ff'] },
];

// ---------- settings (preferences shown on the Settings screen) ----------
const SETTING_DEFAULTS = {
  rounds: 5, hpMul: 1, speed: 1, items: 'normal', killcam: true, shake: true, particles: 'high', dmgNumbers: true,
  master: .9, sfx: 1, music: .6,
};
const ITEM_RATES = { off: 0, low: .5, normal: 1, high: 2 };
const PARTICLE_MULS = { low: .35, medium: .65, high: 1 };
const SETTING_CHOICES = { hpMul: [.5, .75, 1, 1.5, 2], speed: [.75, 1, 1.25, 1.5], items: Object.keys(ITEM_RATES), particles: Object.keys(PARTICLE_MULS) };
const SETTING_RANGES = { rounds: [1, 9, true], master: [0, 1], sfx: [0, 1], music: [0, 1] };
// Puts every setting back to something valid: the right kind of value, one of the offered choices, inside its range.
// A wrong 'speed' string would otherwise freeze every match.
function cleanSettings() {
  for (const k in SETTING_DEFAULTS) {
    const d = SETTING_DEFAULTS[k], v = SETTINGS[k], ch = SETTING_CHOICES[k], rg = SETTING_RANGES[k];
    if (ch) { if (!ch.includes(v)) SETTINGS[k] = d; }
    else if (rg) { const n = numOr(v, d); SETTINGS[k] = clamp(rg[2] ? Math.round(n) : n, rg[0], rg[1]); }
    else if (typeof d !== typeof v || (typeof d === 'number' && !Number.isFinite(v))) SETTINGS[k] = d;
  }
}
const SETTINGS = Object.assign({}, SETTING_DEFAULTS, store.getObj('settings'));
cleanSettings();

function saveSettings() { store.set('settings', SETTINGS); applySettings(); }
// Pushes the settings into the engine's knobs (effects, audio). Safe to call any time.
function applySettings() {
  if (typeof FX !== 'undefined') {
    FX.shakeMul = SETTINGS.shake ? 1 : 0;
    FX.partMul = PARTICLE_MULS[SETTINGS.particles] || 1;
    FX.dmgNumbers = !!SETTINGS.dmgNumbers;
  }
  if (typeof AUDIO_MIX !== 'undefined') {
    Object.assign(AUDIO_MIX, { master: SETTINGS.master, sfx: SETTINGS.sfx, music: SETTINGS.music });
    if (typeof applyAudioMix === 'function') applyAudioMix();
  }
}

// ---------- v4 save migration ----------
// v4 dropped coins, the shop, the 100-level track and the daily/weekly quests. A v3 save loses exactly those fields
// (and its 'tasks' key); trophies, stats, ranked, campaign, codex, presets and settings stay as they were.
// null = the whole key goes. 94-savecode strips imported codes the same way.
const SAVE_V3_DROPS = { profile: ['coins', 'earned', 'hats', 'packs', 'stats.purchases'], prog: ['xp', 'own', 'seen'], tasks: null };
// Deletes a field, or one level down for 'a.b'. True if it was there.
function saveDropField(o, path) {
  const [a, b] = path.split('.'), host = b ? o[a] : o, k = b || a;
  return !!host && typeof host === 'object' && k in host && delete host[k];
}
// Strips the v3-only parts from a { 'stickclash.v2.<key>': json } map in place. Returns how many keys changed.
function saveStripV3(keys) {
  let changed = 0;
  for (const short in SAVE_V3_DROPS) {
    const full = STORE_PREFIX + short, fields = SAVE_V3_DROPS[short];
    if (!(full in keys)) continue;
    if (!fields) { delete keys[full]; changed++; continue; }
    let v = null;
    try { v = JSON.parse(keys[full]); } catch (e) { continue; }       // a broken save is left to the typed loaders
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    if (fields.map(f => saveDropField(v, f)).some(Boolean)) { keys[full] = JSON.stringify(v); changed++; }
  }
  return changed;
}
// Runs once at load, before the profile and progress are read: rewrites the stored keys that held v3-only parts.
function saveMigrateV4() {
  try {
    const keys = {};
    for (const short in SAVE_V3_DROPS) { const raw = localStorage.getItem(STORE_PREFIX + short); if (raw != null) keys[STORE_PREFIX + short] = raw; }
    const before = Object.assign({}, keys);
    if (!saveStripV3(keys)) return false;
    for (const k in before) { if (!(k in keys)) localStorage.removeItem(k); else if (keys[k] !== before[k]) localStorage.setItem(k, keys[k]); }
    return true;
  } catch (e) { return false; }   // no storage (private mode): nothing to migrate
}
const SAVE_MIGRATED = saveMigrateV4();

// ---------- profile: lifetime stats and trophies ----------
const PROFILE = loadProfile();
let profileDirty = false;

function loadProfile() {
  const p = store.getObj('profile'), obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const statDefaults = {
    matches: 0, wins: 0, losses: 0, roundsPlayed: 0, roundsWon: 0, kos: 0, ringouts: 0, dmg: 0, hits: 0, headHits: 0,
    projHits: 0, bigHit: 0, bestCombo: 0, skills: 0, orbs: 0, jumps: 0, dashes: 0, shots: 0, playTime: 0,
    pvpWins: 0, tourneys: 0, bestWave: 0, cpuWins: {}, weaponUse: {}, weaponWins: {}, catWins: {}, mapWins: {}, modeWins: {},
  };
  // Each counter keeps the kind of value it starts as (a number, or a map); anything else in a save is dropped.
  const saved = obj(p.stats), stats = {};
  for (const k in statDefaults) {
    const d = statDefaults[k], v = saved[k];
    stats[k] = typeof d === 'number' ? numOr(v, d) : obj(v);
  }
  for (const k in saved) if (!(k in stats) && (typeof saved[k] === 'number' ? Number.isFinite(saved[k]) : obj(saved[k]) === saved[k])) stats[k] = saved[k];
  return { ach: obj(p.ach), flags: obj(p.flags), stats };
}
function saveProfile() { profileDirty = false; store.set('profile', PROFILE); }
function markProfile() { profileDirty = true; }
onFlush(() => { if (profileDirty) saveProfile(); });   // written on pagehide and on visibilitychange -> hidden (flushSaves, 99-main)

// ---------- achievements ----------
// defAchievement(key, { name, desc, icon, need, progress(stats, profile) -> number }). Unlocks at progress >= need.
// Every trophy is earned by playing (v4 replaced the shop, hat and coin ones with play-based ones).
const ACHIEVEMENTS = {};
function defAchievement(key, def) {
  ACHIEVEMENTS[key] = Object.assign({ key, icon: '★', need: 1, order: Object.keys(ACHIEVEMENTS).length }, def);
  return ACHIEVEMENTS[key];
}
const achFlag = name => s => PROFILE.flags[name] ? 1 : 0;
const achCount = o => Object.keys(o || {}).length;
// Highest CPU level (the last key of AI_LEVELS, so a new "insane" level is picked up automatically).
const hardestDiff = () => { const k = Object.keys(AI_LEVELS); return k[k.length - 1]; };

// CPU wins only (2-player wins have Couch Champion); an unlocked trophy always stays.
defAchievement('first-win', { name: 'First Blood', icon: '🏆', desc: 'Win your first match against the CPU.', progress: s => Object.values(s.cpuWins).reduce((a, n) => a + (+n || 0), 0) });
defAchievement('combo-10', { name: 'Combo Machine', icon: '⚡', desc: 'Land a 10-hit combo.', need: 10, progress: s => s.bestCombo });
defAchievement('combo-5', { name: 'Chain Reaction', icon: '➰', desc: 'Land a 5-hit combo.', need: 5, progress: s => s.bestCombo });
defAchievement('arsenal', { name: 'Arsenal', icon: '⚔', desc: 'Win a round with every weapon category.',
  need: () => new Set(listOf(WEAPONS).map(w => w.cat)).size, progress: s => achCount(s.catWins) });
defAchievement('weapon-10', { name: 'Weapon Collector', icon: '🗡', desc: 'Win rounds with 10 different weapons.', need: 10, progress: s => achCount(s.weaponWins) });
defAchievement('beat-hardest', { name: 'Unstoppable', icon: '💀', desc: 'Win a match against the toughest CPU level.',
  progress: s => s.cpuWins[hardestDiff()] || 0 });
defAchievement('beat-hard', { name: 'Hard Boiled', icon: '🔥', desc: 'Win a match against a Hard CPU.', progress: s => s.cpuWins.hard || 0 });
defAchievement('tournament', { name: 'Champion', icon: '👑', desc: 'Clear a tournament.', progress: s => s.tourneys });
defAchievement('waves-10', { name: 'Last One Standing', icon: '🌊', desc: 'Survive 10 waves.', need: 10, progress: s => s.bestWave });
defAchievement('flawless', { name: 'Flawless', icon: '💎', desc: 'Win a round without taking any damage.', progress: achFlag('flawless') });
defAchievement('shutout', { name: 'Shutout', icon: '🧱', desc: 'Win a match of 3+ rounds without losing a round.', progress: achFlag('shutout') });
defAchievement('speedy', { name: 'Blink and Miss It', icon: '⏱', desc: 'Win a round by K.O. in under 5 seconds.', progress: achFlag('speedy') });
defAchievement('close-call', { name: 'Close Call', icon: '❤', desc: 'Win a round with 10 HP or less left.', progress: achFlag('closeCall') });
defAchievement('comeback', { name: 'Comeback Kid', icon: '↺', desc: 'Win a match after trailing by 2 rounds.', progress: achFlag('comeback') });
defAchievement('ringout-10', { name: 'Ring Master', icon: '🌀', desc: 'Score 10 ring-out K.O.s.', need: 10, progress: s => s.ringouts });
defAchievement('ko-50', { name: 'Knockout Artist', icon: '🥊', desc: 'Score 50 K.O.s.', need: 50, progress: s => s.kos });
defAchievement('head-25', { name: 'Headhunter', icon: '🎯', desc: 'Land 25 head hits.', need: 25, progress: s => s.headHits });
defAchievement('big-hit', { name: 'Heavy Hitter', icon: '💥', desc: 'Deal 25 damage with a single hit.', need: 25, progress: s => s.bigHit });
defAchievement('sharpshooter', { name: 'Sharpshooter', icon: '🏹', desc: 'Land 100 projectile hits.', need: 100, progress: s => s.projHits });
defAchievement('skills-100', { name: 'Spellslinger', icon: '✦', desc: 'Use skills 100 times.', need: 100, progress: s => s.skills });
defAchievement('orbs-30', { name: 'Orb Hoarder', icon: '◉', desc: 'Grab 30 power-up orbs.', need: 30, progress: s => s.orbs });
defAchievement('maps-8', { name: 'Globetrotter', icon: '🗺', desc: 'Win a round on 8 different arenas.',
  need: () => Math.min(8, listOf(MAPS).length), progress: s => achCount(s.mapWins) });
defAchievement('pvp', { name: 'Couch Champion', icon: '🎮', desc: 'Win a 2-player match.', progress: s => s.pvpWins });
defAchievement('matches-25', { name: 'Regular', icon: '📅', desc: 'Play 25 matches.', need: 25, progress: s => s.matches });
defAchievement('rounds-100', { name: 'Veteran', icon: '🎖', desc: 'Win 100 rounds.', need: 100, progress: s => s.roundsWon });
defAchievement('wins-25', { name: 'Seasoned', icon: '🥇', desc: 'Win 25 matches.', need: 25, progress: s => s.wins });
defAchievement('combo-15', { name: 'Unbreakable', icon: '🌪', desc: 'Land a 15-hit combo.', need: 15, progress: s => s.bestCombo });
defAchievement('weapon-25', { name: 'Armoury', icon: '🛡', desc: 'Win rounds with 25 different weapons.', need: 25, progress: s => achCount(s.weaponWins) });
defAchievement('modes-5', { name: 'All-Rounder', icon: '🎲', desc: 'Win a match in 5 different modes.', need: 5, progress: s => achCount(s.modeWins) });
defAchievement('maps-16', { name: 'World Tour', icon: '🧭', desc: 'Win a round on 16 different arenas.',
  need: () => Math.min(16, listOf(MAPS).length), progress: s => achCount(s.mapWins) });

const achNeed = a => typeof a.need === 'function' ? a.need() : a.need;
const achProgress = a => { try { return a.progress(PROFILE.stats, PROFILE) || 0; } catch (e) { report(e, 'achievement ' + a.key); return 0; } };
const achDone = key => !!PROFILE.ach[key];

function unlockAchievement(key) {
  const a = ACHIEVEMENTS[key];
  if (!a || achDone(key)) return false;
  PROFILE.ach[key] = Date.now();
  if (MATCH_TRACK.active) MATCH_TRACK.unlocked.push(key);
  saveProfile();
  emit('achievement', a);
  return true;
}
function checkAchievements() {
  for (const a of Object.values(ACHIEVEMENTS)) if (!achDone(a.key) && achProgress(a) >= achNeed(a)) unlockAchievement(a.key);
}
// At boot: trophies a save already qualifies for (new ones in v4, or stats carried over) unlock at once, and a migrated
// v3 save is told where its coins went.
on('boot', () => {
  checkAchievements();
  if (SAVE_MIGRATED && typeof toast === 'function') toast('Everything is unlocked', 'Every hat, colour and look is now free. Trophies and Ranked carry on.', '🎁', '#5dff9a');
});

// ---------- tracking (only real, human-driven matches count) ----------
// MATCH_TRACK: per-match extras the results screen shows (best combo, biggest hit per roster slot, new trophies) and
// `result` ({ won }) once recordMatch has counted the match.
const MATCH_TRACK = { active: false, combo: [], bigHit: [], taken: [], unlocked: [], result: null, trailed: false };
const isRealPlayer = f => !!f && f.ctrl === 'human' && !f.autopilot && !f.summon;
const trackingOn = () => !G_STATE.demo && !G_STATE.sim;
const statsOn = () => MATCH_TRACK.active && !G_STATE.sim && !G_STATE.demo;   // this match counts toward lifetime stats
const rosterSlot = f => f && (f.summon && f.owner ? f.owner.id : f.id);
const rosterHumanTeams = () => [...new Set(G_STATE.roster.filter(r => r.ctrl === 'human').map(r => r.team))];
const rosterHasCpu = () => G_STATE.roster.some(r => r.ctrl !== 'human');

function bumpStat(key, n = 1) { PROFILE.stats[key] = (PROFILE.stats[key] || 0) + n; markProfile(); }
function bumpMap(key, sub) { const m = PROFILE.stats[key]; m[sub] = (m[sub] || 0) + 1; markProfile(); }
function maxStat(key, v) { if (v > (PROFILE.stats[key] || 0)) { PROFILE.stats[key] = v; markProfile(); return true; } return false; }

on('matchStart', () => {
  // Practice modes (mode.practice, or the training dummy) count toward nothing, so trophies can't be farmed there.
  const practice = G_STATE.mode && (G_STATE.mode.practice || G_STATE.mode.key === 'training');
  Object.assign(MATCH_TRACK, { active: trackingOn() && !practice, combo: [], bigHit: [], unlocked: [], result: null, trailed: false });
  applySettings();
});

// The Settings "Health" multiplier for this match (1 when it doesn't apply: the demo, or a mode that carries health over).
function matchHpMul() {
  const hpMul = G_STATE.cfg && G_STATE.cfg.hpMul;
  const run = (G_STATE.info && G_STATE.info.run) || {};
  return G_STATE.demo || !(hpMul > 0) || 'hp' in run ? 1 : hpMul;
}
// Scales one fighter's health by it. Called at each round start and by the respawn helpers (70 KOTH, 71 party modes),
// so a fighter that respawns mid-round gets the same health bar as at the start.
function applyMatchHp(f) {
  const m = matchHpMul();
  if (m === 1 || f.summon || f.matchHpDone) return;
  f.matchHpDone = true;                            // once per fighter: a mode may respawn someone inside onRoundStart
  const frac = f.hp / f.maxHp;                     // keep whatever share of health the mode gave this fighter
  f.maxHp = Math.round(f.maxHp * m); f.hp = f.hpShow = Math.max(1, Math.round(f.maxHp * frac));
}
on('roundStart', () => {
  MATCH_TRACK.taken = [];
  for (const f of F) applyMatchHp(f);
});

on('damage', (B, amt, o) => {
  if (!trackingOn()) return;                    // per-match numbers (results screen) for every real match
  const A = o && o.src && o.src !== B ? o.src : null, kind = (o && o.kind) || 'melee';
  const direct = kind !== 'status' && kind !== 'hazard' && kind !== 'ringout';
  MATCH_TRACK.taken[B.id] = (MATCH_TRACK.taken[B.id] || 0) + amt;
  if (!A) return;
  const slot = rosterSlot(A);
  MATCH_TRACK.combo[slot] = Math.max(MATCH_TRACK.combo[slot] || 0, A.combo || 0);
  if (direct) MATCH_TRACK.bigHit[slot] = Math.max(MATCH_TRACK.bigHit[slot] || 0, amt);
  if (!statsOn() || !isRealPlayer(A)) return;
  bumpStat('dmg', amt);
  if (direct) {
    bumpStat('hits');
    if (o.head) bumpStat('headHits');
    if (kind === 'proj') bumpStat('projHits');
    const better = maxStat('bigHit', amt) | maxStat('bestCombo', A.combo || 0);
    if (better || PROFILE.stats.hits % 10 === 0) checkAchievements();
  }
});

on('ko', (V, K, o) => {
  if (!statsOn() || !isRealPlayer(K) || V === K || V.summon) return;
  bumpStat('kos');
  if (o && o.kind === 'ringout') bumpStat('ringouts');
  checkAchievements();
});
on('skill', f => { if (statsOn() && isRealPlayer(f)) bumpStat('skills'); });
on('orb', f => { if (statsOn() && isRealPlayer(f)) bumpStat('orbs'); });
on('jump', f => { if (statsOn() && isRealPlayer(f)) bumpStat('jumps'); });
on('dash', f => { if (statsOn() && isRealPlayer(f)) bumpStat('dashes'); });
on('fire', f => { if (statsOn() && isRealPlayer(f)) bumpStat('shots'); });

on('roundEnd', (winner, reason) => {
  if (!statsOn()) return;
  const players = F.filter(isRealPlayer);
  if (!players.length) return;
  bumpStat('roundsPlayed');
  bumpStat('playTime', G_STATE.roundT);
  for (const f of players) bumpMap('weaponUse', f.wkey);
  const winners = players.filter(f => f.team === winner);
  if (winners.length) roundWon(winners, reason);
  const ht = rosterHumanTeams()[0], foe = Math.max(...G_STATE.score.filter((_, t) => t !== ht));
  if (rosterHumanTeams().length === 1 && foe - G_STATE.score[ht] >= 2) MATCH_TRACK.trailed = true;
  checkAchievements();
  saveProfile();
});

function roundWon(winners, reason) {
  bumpStat('roundsWon');
  for (const f of winners) { bumpMap('weaponWins', f.wkey); bumpMap('catWins', f.w.cat); }
  if (MAP) bumpMap('mapWins', MAP.key);
  if (winners.every(f => !MATCH_TRACK.taken[f.id])) PROFILE.flags.flawless = 1;
  if (reason === 'ko' && G_STATE.roundT < 5) PROFILE.flags.speedy = 1;
  if (winners.some(f => f.alive && f.hp <= 10)) PROFILE.flags.closeCall = 1;
}

on('matchOver', () => recordMatch());

// Records a finished match in the lifetime stats once (the results screen and matchOver both ask, whichever comes
// first) and returns { won }, or null when it doesn't count (the demo, practice, autopilot tests, no human).
// Modes may help by returning { won, tournament, waves } from results(); otherwise the score and the mode's run state
// (G_STATE.info.run: survival's `cleared` waves) decide.
function recordMatch() {
  if (MATCH_TRACK.result || !MATCH_TRACK.active || G_STATE.cfg.autopilot) return MATCH_TRACK.result;
  const humans = rosterHumanTeams();
  if (!humans.length) return null;
  const res = G_STATE.result || {}, sc = G_STATE.score, run = (G_STATE.info && G_STATE.info.run) || {};
  const waves = Number.isFinite(res.waves) ? res.waves : Number.isFinite(run.cleared) ? run.cleared : null;
  const top = Math.max(...sc), winTeam = sc.filter(s => s === top).length === 1 ? sc.indexOf(top) : -1;
  const won = typeof res.won === 'boolean' ? res.won : waves == null && humans.includes(winTeam);
  bumpStat('matches');
  if (won) matchWon(humans);
  else bumpStat('losses');
  if (won && (res.tournament || /tourn/i.test(G_STATE.mode.key))) bumpStat('tourneys');
  if (waves != null) maxStat('bestWave', waves);
  MATCH_TRACK.result = { won };
  checkAchievements();
  saveProfile();
  return MATCH_TRACK.result;
}

function matchWon(humans) {
  const sc = G_STATE.score, diffs = Object.keys(AI_LEVELS), mode = G_STATE.mode;
  bumpStat('wins');
  if (!mode.hidden) bumpMap('modeWins', mode.key);           // the quest modes (campaign, challenges) are hidden
  if (rosterHasCpu()) bumpMap('cpuWins', diffs[Math.max(0, diffs.indexOf(G_STATE.cfg.diff || 'normal'))] || 'normal');
  else bumpStat('pvpWins');
  if (G_STATE.log.length >= 3 && sc.every((s, t) => humans.includes(t) || s === 0)) PROFILE.flags.shutout = 1;
  if (MATCH_TRACK.trailed) PROFILE.flags.comeback = 1;
}
