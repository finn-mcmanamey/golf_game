/* ===== drawing a frame: sky, scenery, boats, then water over the submerged blades ===== */

const R = {
  sceneBuf: gl && gl.createBuffer(), sceneRanges: [],
  boatBuf: gl && gl.createBuffer(), boatMb: new MeshBuilder(30000),
  ghostBuf: gl && gl.createBuffer(), ghostMb: new MeshBuilder(4000),
  waterBuf: gl && gl.createBuffer(), skyBuf: gl && gl.createBuffer(),
  L: null, dpr: 1, quality: settings.quality,
};
const QUALITY_LABELS = ['Fast', 'Balanced', 'Sharp'];

function setScene(course, cls) {
  const { mb, L } = buildScene(course, cls);
  R.sceneRanges = mb.upload(R.sceneBuf, gl.STATIC_DRAW);
  R.L = L;
  R.fogK = course.kind === 'erg' ? 0.002 : 0.0019 + (course.timeOfDay < 0.15 ? 0.0025 : 0) + (course.rain ? 0.003 : 0);
  if (course.rain) {
    // Rain: a grey, flatter sky and light.
    const grey = (c, k) => c.map(v => lerp(v, 0.55, k));
    Object.assign(L, { sky: grey(L.sky, 0.6), horizon: grey(L.horizon, 0.5), sunCol: grey(L.sunCol, 0.55), cloud: 0.95 });
  }
  // Water: one big quad under everything; the banks cover its edges.
  const x0 = -2000, x1 = course.distance + 2000, z = 2000;
  gl.bindBuffer(gl.ARRAY_BUFFER, R.waterBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, 0, -z, x1, 0, -z, x1, 0, z, x0, 0, -z, x1, 0, z, x0, 0, z]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, R.skyBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  puddles.length = 0;
}

function resize() {
  R.dpr = Math.min(window.devicePixelRatio || 1, R.quality > 1 ? 2 : 1.5) * (R.quality < 1 ? 0.7 : 1);
  const w = Math.round(innerWidth * R.dpr), h = Math.round(innerHeight * R.dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
}

function setLightUniforms(u, L) {
  gl.uniform3fv(u.uEye, cam.eye);
  gl.uniform3fv(u.uSun, L.sun);
  gl.uniform3fv(u.uSunCol, L.sunCol);
  gl.uniform3fv(u.uSky, L.sky);
  gl.uniform3fv(u.uHorizon, L.horizon);
  if (u.uGround) gl.uniform3fv(u.uGround, L.ground);
  gl.uniform1f(u.uFogK, R.fogK);
}

function renderFrame(race, time, dtFrame) {
  resize();
  const L = R.L, aspect = canvas.width / canvas.height;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(...L.horizon, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const view = M4.lookAt(cam.eye, cam.at, [0, 1, 0]);
  const vp = M4.mul(M4.perspective(cam.fov, aspect, 0.1, 3000), view.m);

  // Sky first, behind everything.
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(SKY.p);
  gl.bindBuffer(gl.ARRAY_BUFFER, R.skyBuf);
  gl.enableVertexAttribArray(SKY.a.aP);
  gl.vertexAttribPointer(SKY.a.aP, 2, gl.FLOAT, false, 0, 0);
  const tanY = Math.tan(cam.fov / 2);
  gl.uniform3fv(SKY.u.uR, view.r); gl.uniform3fv(SKY.u.uU, view.u); gl.uniform3fv(SKY.u.uF, view.f);
  gl.uniform2f(SKY.u.uTan, tanY * aspect, tanY);
  gl.uniform3fv(SKY.u.uSun, L.sun); gl.uniform3fv(SKY.u.uSunCol, L.sunCol);
  gl.uniform3fv(SKY.u.uSky, L.sky); gl.uniform3fv(SKY.u.uHorizon, L.horizon);
  gl.uniform1f(SKY.u.uT, time); gl.uniform1f(SKY.u.uCloud, L.cloud); gl.uniform1f(SKY.u.uStars, L.stars || 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.disableVertexAttribArray(SKY.a.aP);

  // Scenery and boats.
  gl.enable(gl.DEPTH_TEST);
  gl.useProgram(LIT.p);
  gl.uniformMatrix4fv(LIT.u.uVP, false, vp);
  setLightUniforms(LIT.u, L);
  gl.uniform1f(LIT.u.uAlpha, 1);
  gl.uniform1f(LIT.u.uMirror, 1);
  bindLitAttribs(R.sceneBuf);
  // Only slices of scenery within sight; beyond this the fog has swallowed them anyway.
  const sight = race.course.kind === 'erg' ? 1e4 : R.quality === 0 ? 550 : 800, lo = Math.min(cam.eye[0], cam.at[0]) - sight, hi = Math.max(cam.eye[0], cam.at[0]) + sight;
  R.drawn = 0;
  for (const c of R.sceneRanges) if (c.x1 > lo && c.x0 < hi) { gl.drawArrays(gl.TRIANGLES, c.first, c.count); R.drawn += c.count }

  const mb = R.boatMb;
  mb.reset();
  const indoors = race.course.kind === 'erg';
  if (indoors) { for (const b of race.boats) drawErg(mb, b, time); drawErgScreen(mb, race) }
  else for (const b of race.boats) if (Math.abs(b.x - cam.at[0]) < 700) drawBoat(mb, b, dtFrame, time);
  if (race.course.kind === 'showroom') drawMedalWall(mb, time);
  else if (!indoors) drawFx(mb, dtFrame, time, race.course);
  const n = mb.upload(R.boatBuf, gl.DYNAMIC_DRAW);
  bindLitAttribs(R.boatBuf);
  gl.drawArrays(gl.TRIANGLES, 0, n);

  // Reflections: the boats and nearby banks again, upside down under the surface, seen through the water.
  const reflect = !indoors && R.quality > 0 && cam.eye[1] > 0.2;
  if (reflect) {
    gl.uniform1f(LIT.u.uMirror, -1);
    gl.uniform1f(LIT.u.uAlpha, 1);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    bindLitAttribs(R.sceneBuf);
    const near = R.quality > 1 ? 450 : 260, lo2 = cam.at[0] - near, hi2 = cam.at[0] + near;
    for (const c of R.sceneRanges) if (c.x1 > lo2 && c.x0 < hi2) gl.drawArrays(gl.TRIANGLES, c.first, c.count);
    gl.uniform1f(LIT.u.uMirror, 1);
  }

  // Water over the top hides the parts of blades below the surface and tints the reflections.
  if (reflect) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA) }
  if (!indoors) drawWater(race, vp, time, dtFrame, reflect);
  gl.disable(gl.BLEND);

  // The ghost is see-through, so it goes last.
  if (race.ghost && !indoors) {
    R.ghostMb.reset();
    drawBoat(R.ghostMb, race.ghost, dtFrame, time);
    const gn = R.ghostMb.upload(R.ghostBuf, gl.DYNAMIC_DRAW);
    gl.useProgram(LIT.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(LIT.u.uAlpha, 0.38);
    gl.uniform1f(LIT.u.uMirror, 1);
    bindLitAttribs(R.ghostBuf);
    gl.drawArrays(gl.TRIANGLES, 0, gn);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  for (const a of [LIT.a.aP, LIT.a.aN, LIT.a.aC]) gl.disableVertexAttribArray(a);
}

const boatUniform = new Float32Array(32), puddleUniform = new Float32Array(96);

function drawWater(race, vp, time, dtFrame, reflect) {
  const u = WATER.u, L = R.L;
  gl.useProgram(WATER.p);
  gl.uniformMatrix4fv(u.uVP, false, vp);
  setLightUniforms(u, L);
  gl.uniform3fv(u.uDeep, L.deep);
  gl.uniform3fv(u.uBank, L.bank);
  gl.uniform1f(u.uBankZ, race.course.bends ? 1e4 : BANK_Z);
  gl.uniform1f(u.uReflect, reflect ? 1 : 0);
  gl.uniform1f(u.uT, time);
  gl.uniform1f(u.uWind, Math.min(1.5, race.course.wind.speed / 3));
  const w = race.course.wind, wl = Math.hypot(w.along, w.cross) || 1;
  gl.uniform2f(u.uWindDir, w.along / wl, w.cross / wl);
  boatUniform.fill(0);
  race.boats.slice(0, 8).forEach((b, i) => {
    const q = pose(b);
    boatUniform.set([q.x, q.z, Math.min(1, b.v / 5.5), BOAT_CLASSES[b.cls].length], i * 4);
  });
  // The umpire's launch leaves a wake too.
  if (race.boats.length < 8 && race.course.kind !== 'showroom') {
    const lz = riverZ(race.course, launch.x) + (race.course.bends || race.boats.length === 2 ? 0 : LANE_W * 0.5);
    boatUniform.set([launch.x + 3.5, lz, Math.min(1, Math.abs(launch.v) / 5), 7], race.boats.length * 4);
  }
  gl.uniform4fv(u.uBoats, boatUniform);
  for (const p of puddles) p.age += dtFrame;
  while (puddles.length && puddles[0].age > 7) puddles.shift();
  puddleUniform.fill(0);
  const near = R.quality === 0 ? [] : puddles.filter(p => Math.abs(p.x - cam.at[0]) < 120).slice(-24);
  near.forEach((p, i) => puddleUniform.set([p.x, p.z, p.age, Math.max(0, 1 - p.age / 7)], i * 4));
  gl.uniform4fv(u.uPuddles, puddleUniform);
  gl.bindBuffer(gl.ARRAY_BUFFER, R.waterBuf);
  gl.enableVertexAttribArray(WATER.a.aP);
  gl.vertexAttribPointer(WATER.a.aP, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disableVertexAttribArray(WATER.a.aP);
}
