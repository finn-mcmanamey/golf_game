/* ================= minimap ================= */
const mapC=$('map'),mctx=mapC.getContext('2d');let mapImg=null,mapS=1,mapOx=0,mapOy=0;
function buildMap(){const c=document.createElement('canvas');c.width=W.cols;c.height=W.rows;const x=c.getContext('2d'),im=x.createImageData(W.cols,W.rows),d=im.data;
  for(let j=0;j<W.rows;j++)for(let i=0;i<W.cols;i++){const T=W.ty[j*W.cols+i],cl=W.pal&&W.pal[T]||SURF[T].col,k=(j*W.cols+i)*4,v=T===7?(W.waterCol||[.2,.45,.8]):cl;d[k]=v[0]*255;d[k+1]=v[1]*255;d[k+2]=v[2]*255;d[k+3]=255}
  x.putImageData(im,0,0);mapImg=c;const s=Math.min(140/W.cols,140/W.rows);mapS=s;mapOx=(140-W.cols*s)/2;mapOy=(140-W.rows*s)/2}
function drawMap(){if(!mapImg)return;mctx.setTransform(1,0,0,1,0,0);mctx.clearRect(0,0,140,140);mctx.imageSmoothingEnabled=false;const k=mapS/CS;
  mctx.setTransform(-k,0,0,-k,mapOx+W.cols*mapS+W.ox*k,mapOy+W.rows*mapS+W.oz*k);mctx.drawImage(mapImg,W.ox,W.oz,W.cols*CS,W.rows*CS);mctx.setTransform(1,0,0,1,0,0);
  const px=x=>mapOx+(W.cols-(x-W.ox)/CS)*mapS,py=z=>mapOy+(W.rows-(z-W.oz)/CS)*mapS;
  if(S.mode==='aim'){const c=curClub();mctx.strokeStyle=TK('white',.65);mctx.setLineDash([2,2]);mctx.beginPath();mctx.moveTo(px(PB.x),py(PB.z));
    if(c.putter){const L=c.total*S.previewPow*S.previewPow;mctx.lineTo(px(PB.x+MM.sin(S.yaw)*L),py(PB.z+MM.cos(S.yaw)*L))}else{const P=predictShot(true);if(P)for(let i=0;i<P.path.length;i+=2)mctx.lineTo(px(P.path[i]),py(P.path[i+1]))}mctx.stroke();mctx.setLineDash([])}
  if(S.range){const c=curClub().id;mctx.fillStyle=TK('gold300',.85);for(const q of S.range.shots)if(q.c===c)mctx.fillRect(px(q.x)-1.5,py(q.z)-1.5,3,3)}
  mctx.fillStyle=TK('gold300');mctx.beginPath();mctx.arc(px(W.pin.x),py(W.pin.z),2.5,0,TAU);mctx.fill();if(SETS.cb&&W.cv>=3){mctx.font='bold 10px system-ui,sans-serif';mctx.fillText(PIN_LETTER[W.setup|0],px(W.pin.x)+4,py(W.pin.z)+4)}
  if(S.ghost&&GB.st!=='holed'){mctx.fillStyle=TK('blue300',.9);mctx.beginPath();mctx.arc(px(GB.x),py(GB.z),2.2,0,TAU);mctx.fill()}if(S.hs)S.hs.P.forEach((p,i)=>{if(i===S.hs.cur)return;const b=hsBall(p);if(b.done)return;mctx.fillStyle='rgb('+LOOK.ball[lookGet(p.look,'ball')].map(v=>v*255|0)+')';mctx.beginPath();mctx.arc(px(b.x),py(b.z),2.2,0,TAU);mctx.fill()});for(const x of S.xg||[])if(x.ball.st!=='holed'){mctx.fillStyle='rgb('+x.col.map(v=>v*255|0)+')';mctx.beginPath();mctx.arc(px(x.ball.x),py(x.ball.z),2.2,0,TAU);mctx.fill()}
  mctx.fillStyle=TK('white');mctx.beginPath();mctx.arc(px(PB.x),py(PB.z),2.5,0,TAU);mctx.fill();mctx.strokeStyle=TK('black');mctx.lineWidth=1;mctx.stroke()}
VL.feature({id:'core.view',kind:'view',deps:['core.sim'],f:['F-040','F-042']});
