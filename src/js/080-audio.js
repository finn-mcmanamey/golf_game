/* ================= audio ================= */
const AU={ctx:null,on:VS.getItem('voxellinks.sound')!=='0',noise:null,master:null,voices:0,last:{},hidden:false,susT:0,out(){return this.master||this.ctx.destination},voice(o){this.voices++;o.onended=()=>{this.voices--}},
  init(){if(this.ctx)return;try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();const n=this.ctx.sampleRate,b=this.ctx.createBuffer(1,n,n),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;this.noise=b;this.master=this.ctx.createGain();this.master.gain.value=this.on?1:0;this.master.connect(this.ctx.destination)}catch(e){}},
  env(g,t,a,d,v){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.001,t+a+d)},
  tone(f0,f1,d,v,type='sine',t0=0){const c=this.ctx;if(!c||c.state!=='running'||this.voices>=AUDIO_VOICES)return;const t=c.currentTime+t0,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+d);this.env(g,t,.004,d,v);o.connect(g).connect(AU.out());AU.voice(o);o.start(t);o.stop(t+d+.05)},
  hiss(fc,q,d,v,t0=0,type='bandpass'){const c=this.ctx;if(!c||c.state!=='running'||this.voices>=AUDIO_VOICES)return;const t=c.currentTime+t0,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noise;f.type=type;f.frequency.value=fc;f.Q.value=q;this.env(g,t,.005,d,v);s.connect(f).connect(g).connect(AU.out());AU.voice(s);s.start(t);s.stop(t+d+.05)},
  play(k,v=1){if(!this.on||!this.ctx)return;if(this.ctx.state!=='running'){if(!this.hidden)this.ctx.resume().catch(()=>{});return}const now=this.ctx.currentTime;if(now-(this.last[k]??-1)<AUDIO_DEDUP)return;this.last[k]=now;v=clamp(v,0,1);
    switch(k){
      case'hit':this.contact(FX.q,v);break;
      case'putt':this.tone(1500,900,.03,.35*v);this.hiss(3000,1,.02,.15*v);break;
      case'bounce':this.tone(170,60,.08,.35*v);this.hiss(400,.7,.05,.15*v,0,'lowpass');break;
      case'tap':this.tone(220,90,.04,.12*v);break;
      case'tree':this.hiss(1800,.5,.22,.35,0,'lowpass');break;
      case'pin':this.tone(2400,1800,.12,.3);this.tone(1200,1150,.2,.15);break;
      case'lip':this.tone(900,500,.05,.25);break;
      case'cup':for(let i=0;i<3;i++)this.tone(1400-i*250,700,.05,.3,'sine',i*.06);this.tone(330,140,.25,.5,'triangle',.16);this.hiss(700,1,.2,.2,.18,'lowpass');break;
      case'splash':this.hiss(900,.6,.4,.6,0,'lowpass');this.tone(240,80,.3,.25);break;
      case'ui':this.tone(800,1000,.04,.12);break;
      case'good':[523,659,784,1047].forEach((f,i)=>this.tone(f,f,.22,.22,'triangle',i*.1));break;
      case'great':[659,784,1047,1319,1568].forEach((f,i)=>this.tone(f,f,.28,.22,'square',i*.09));break;
      case'bad':this.tone(330,330,.25,.2,'triangle');this.tone(262,262,.35,.2,'triangle',.22);break
      case'fat':this.tone(120,55,.12,.45);this.hiss(300,.6,.14,.35,0,'lowpass');break
      case'thin':this.tone(2600,1900,.03,.3,'square');this.hiss(4200,1.2,.03,.2);break
      case'gimme':this.tone(1300,900,.06,.18);this.tone(900,700,.12,.12,'sine',.08);break
      case'thud':this.tone(160,70,.07,.25);this.hiss(500,.7,.05,.12,0,'lowpass');break
      case'beat':this.tone(62,40,.11,.5*v);this.tone(58,38,.09,.32*v,'sine',.17);break
      case'gull':this.tone(1900,1150,.22,.05,'sawtooth',.25);this.tone(1750,1050,.28,.045,'sawtooth',.55);break}}};
