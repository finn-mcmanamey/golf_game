/* ===== boats and crews, rebuilt every frame from the race state =====
   The bow is at boat.x. Rowers face the stern, so on the drive their blades sweep from bow-side to stern-side. */

const CLUB_COLOURS = [
  { hull: 0xf4f1e8, shirt: 0xd8352a, blade: [0xd8352a, 0xffffff] },
  { hull: 0x2b2f38, shirt: 0x2a5db0, blade: [0x2a5db0, 0xf2c230] },
  { hull: 0xf2c230, shirt: 0x1f3d72, blade: [0x1f3d72, 0xffffff] },
  { hull: 0xffffff, shirt: 0x3aa35a, blade: [0x3aa35a, 0x111111] },
  { hull: 0xd9e4f0, shirt: 0x7a2a8a, blade: [0x7a2a8a, 0xffffff] },
  { hull: 0x30343c, shirt: 0xff8a2a, blade: [0xff8a2a, 0x111111] },
  { hull: 0xe6e0d0, shirt: 0x0f8a8a, blade: [0xffffff, 0x0f8a8a] },
];
const PLAYER_COLOURS = { hull: 0xfbfbf6, shirt: 0xffd23a, blade: [0xffd23a, 0x1a1a1a] };
const SKIN = [0xe0b590, 0xc68a62, 0x8d5a3a, 0xf0c8a8];

const visualState = new WeakMap();   // per-boat drawing memory (blade height, last phase): never part of the race
const puddles = [];                  // swirls left on the water where blades came out

function coloursFor(boat) {
  if (boat === race?.player || boat.isGhost) return PLAYER_COLOURS;
  let h = 0; for (const ch of boat.crewName) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return CLUB_COLOURS[Math.abs(h) % CLUB_COLOURS.length];
}

// Seat layout: where each oarlock pin sits along the boat, and which side(s) it rows.
function stationsFor(boat) {
  const c = BOAT_CLASSES[boat.cls], n = c.crew, sp = c.sculls ? 1.4 : 1.3;
  const mid = -c.length / 2 + (c.cox ? 0.6 : 0);
  return Array.from({ length: n }, (_, i) => ({
    u: mid - (n - 1) * sp / 2 + i * sp,
    sides: c.sculls ? [-1, 1] : [i % 2 ? 1 : -1],
  }));
}

function drawBoat(mb, boat, dtFrame, time) {
  const c = BOAT_CLASSES[boat.cls], col = coloursFor(boat);
  let vs = visualState.get(boat);
  if (!vs) { vs = { bladeY: 0.15, phase: boat.phase, skin: SKIN[(boat.lane * 7 + boat.crewName.length) % SKIN.length] }; visualState.set(boat, vs) }

  const q = pose(boat);
  const cy = Math.cos(q.yaw), sy = Math.sin(q.yaw), bob = Math.sin(time * 2 + boat.lane) * 0.015;
  // Boat-local (u along the boat towards the bow, y up, w to starboard) to world.
  const P = (u, y, w) => [q.x + cy * u - sy * w, y + bob, q.z + sy * u + cy * w];
  const F = [cy, 0, sy], S = [-sy, 0, cy], UP = [0, 1, 0];
  const piece = (a, b, w, h, colour) => mb.beam(P(...a), P(...b), w, h, colour);

  // Hull: slices that taper towards bow and stern.
  const hullW = c.crew === 1 ? 0.32 : c.crew === 2 ? 0.4 : 0.56, hullCol = hex(col.hull);
  const N = 14;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N, tm = (t0 + t1) / 2;
    const w = hullW * Math.pow(Math.max(0.02, 1 - Math.pow(2 * tm - 1, 2)), 0.55);
    const u0 = -c.length * (1 - t0), u1 = -c.length * (1 - t1);
    const centre = P((u0 + u1) / 2, 0.08, 0);
    mb.cuboid(centre, scale3(F, (u1 - u0) / 2), scale3(UP, 0.1), scale3(S, w / 2), [...shade(hullCol, 0.82), ...hullCol]);
  }
  mb.box(...P(0.05, 0.16, 0), 0.12, 0.12, 0.12, [1, 1, 1]);   // bow ball

  // Blade height follows the stroke: buried on the drive, lifted and feathered on the recovery.
  const target = boat.phase === 'drive' && q.h < 0.995 ? -0.16 : boat.phase === 'front' ? 0.1 : boat.phase === 'crab' ? -0.3 : 0.32;
  vs.bladeY += (target - vs.bladeY) * Math.min(1, dtFrame * 16);
  const released = vs.phase === 'drive' && boat.phase !== 'drive';
  vs.phase = boat.phase;

  const sculls = c.sculls, Li = sculls ? 0.88 : 1.15, Lo = sculls ? 2.0 : 2.55, pinW = sculls ? 0.8 : 0.86, pinY = 0.42;
  const shirt = hex(col.shirt), skin = hex(vs.skin), shorts = hex(0x1d2330);
  const bladeCols = col.blade.map(hex);

  // Stations run stern to bow; the stroke (seat 0) sets the time and the others follow with their lag.
  for (const [si, st] of stationsFor(boat).entries()) {
    const seatH = clamp(q.h - (boat.lag[si] || 0) * (boat.phase === 'drive' ? TUNE.driveSpeed : boat.recSpeed || 1), 0, 1);
    const theta = lerp(1.0, -0.72, seatH) + (boat.phase === 'crab' ? -0.3 : 0);
    const legT = smooth(0, 0.62, seatH), backT = smooth(0.25, 0.85, seatH);
    const handles = [];
    for (const side of st.sides) {
      const pin = [st.u, pinY, side * pinW];
      const blade = [st.u + Lo * Math.sin(theta), vs.bladeY, side * (pinW + Lo * Math.cos(theta))];
      const handle = [st.u - Li * Math.sin(theta), pinY - (vs.bladeY - pinY) * Li / Lo, side * (pinW - Li * Math.cos(theta))];
      piece([st.u, 0.18, side * hullW * 0.4], pin, 0.04, 0.04, [0.75, 0.75, 0.78]);   // rigger
      piece(handle, blade, 0.045, 0.045, [0.92, 0.92, 0.92]);                          // shaft
      const bDir = norm3(sub3(blade, pin)), bladeStart = add3(blade, scale3(bDir, -0.45));
      // Blade: flat and vertical on the drive, feathered flat on the recovery.
      const feather = boat.phase === 'drive' || boat.phase === 'front' ? 0 : 1;
      mb.beam(P(...bladeStart), P(...add3(blade, scale3(bDir, 0.05))), feather ? 0.22 : 0.05, feather ? 0.05 : 0.22, bladeCols[0]);
      mb.beam(P(...add3(bladeStart, scale3(bDir, 0.18))), P(...add3(bladeStart, scale3(bDir, 0.3))), feather ? 0.23 : 0.06, feather ? 0.06 : 0.23, bladeCols[1]);
      handles.push(handle);
      if (released && (si === 0 || boat === race?.player)) addPuddle(P(...blade));
    }
    drawRower(mb, P, piece, st.u, legT, backT, handles, sculls, shirt, skin, shorts);
  }
  if (c.cox) drawCox(mb, P, piece, -c.length + 1.1, shirt, skin, time, boat);
}

function drawRower(mb, P, piece, pinU, legT, backT, handles, sculls, shirt, skin, shorts) {
  const seatU = pinU + lerp(0.08, 0.78, legT);
  const hip = [seatU, 0.36, 0], foot = [pinU - 0.62, 0.2, 0];
  // Knee: two equal leg bones, bent upwards when the hip is close to the feet.
  const d = Math.abs(hip[0] - foot[0]), bone = 0.5, rise = Math.sqrt(Math.max(0, bone * bone - d * d / 4));
  const knee = [(hip[0] + foot[0]) / 2, 0.3 + rise, 0];
  for (const w of [-0.11, 0.11]) {
    piece([hip[0], hip[1], w], [knee[0], knee[1], w], 0.14, 0.14, shorts);
    piece([knee[0], knee[1], w], [foot[0], foot[1], w], 0.11, 0.11, skin);
  }
  const lean = lerp(-0.5, 0.42, backT);
  const shoulder = [hip[0] + Math.sin(lean) * 0.6, hip[1] + Math.cos(lean) * 0.6, 0];
  piece(hip, shoulder, 0.36, 0.24, shirt);
  const headC = [shoulder[0] + Math.sin(lean) * 0.2, shoulder[1] + Math.cos(lean) * 0.2, 0];
  piece(add3(headC, [0, -0.1, 0]), add3(headC, [0, 0.12, 0]), 0.2, 0.22, skin);
  // Arms reach from each shoulder to a handle (both hands on one handle when sweeping).
  for (const [k, w] of [[0, -0.2], [1, 0.2]].values()) {
    const hand = sculls ? handles[k] : add3(handles[0], [0, 0, (k ? 0.1 : -0.1)]);
    const sh = [shoulder[0], shoulder[1] - 0.06, w];
    const elbow = [(sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2 - 0.08, (sh[2] + hand[2]) / 2];
    piece(sh, elbow, 0.1, 0.1, shirt);
    piece(elbow, hand, 0.09, 0.09, skin);
  }
}

function drawCox(mb, P, piece, u, shirt, skin, time, boat) {
  // The cox sits low in the stern facing the bow, and leans into calls on the push.
  const lean = 0.25 + (boat.lastBits & IN.PUSH ? Math.sin(time * 9) * 0.12 : 0);
  const hip = [u, 0.24, 0], sh = [u + Math.sin(lean) * 0.5, 0.24 + Math.cos(lean) * 0.5, 0];
  piece(hip, sh, 0.34, 0.22, shade(shirt, 0.7));
  piece(add3(sh, [0.05, 0.02, 0]), add3(sh, [0.08, 0.24, 0]), 0.2, 0.22, skin);
}

function addPuddle(p) {
  puddles.push({ x: p[0], z: p[2], age: 0 });
  if (puddles.length > 48) puddles.shift();
}
