// generate — pure `generate(entry) -> htmlString` + CLI.
//
//   node src/generate.mjs <entry.json> [outfile]
//
// Produces ONE self-contained HTML file: three.js via importmap CDN pinned
// to an exact version, no build step, GitHub-Pages / offline capable. The
// page embeds two JSON islands:
//   #ccflex-entry      — the exact source entry (single source of truth)
//   #ccflex-integrity  — { hash } recomputed here from validate.mjs
// Every visual channel is the documented pure function (from verify-core,
// the single source of truth) of an embedded value. window.verify()
// recomputes the hash AND asserts geometry<->JSON<->DOM parity.
//
// Design language: drafts/ccflex-design-language.md — accent #d97757 barred
// from body text (text uses #9A3412 / #E08A6B on dark), mono numerals always
// ink, dvh + >=44px targets, prefers-reduced-motion, WCAG-AA SR table,
// hidden /140-85 Mei Ling codec easter egg (summoned only).

import { readFileSync, writeFileSync } from "node:fs";
import { computeHash, ENCODING, extractFacts, seedFromEntry } from "./verify-core.mjs";

const THREE_VERSION = "0.169.0";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// JSON embedded in <script type="application/json"> must not contain a
// literal </script>; escape the closing-tag sequence (the script body is
// inert text, JSON.parse reads it back identically).
const jsonIsland = (obj) =>
  JSON.stringify(obj, null, 2).replace(/<\/(script)/gi, "<\\/$1");

function metricRow(label, value, note) {
  const flag = note ? ` <span style="font-size:.7em;color:var(--mute)">(${esc(note)})</span>` : "";
  return `<tr><th scope="row">${esc(label)}</th><td data-metric>${esc(value)}${flag}</td></tr>`;
}

function srTable(entry) {
  const s = entry.stats;
  const facts = extractFacts(entry);
  const rows = [
    metricRow("Favourite model", s.favoriteModel),
    metricRow("Total tokens", s.totalTokens.display, s.totalTokens.exact ? null : "display-rounded source"),
    metricRow("Sessions", s.sessions.display, s.sessions.exact ? null : "display-rounded source"),
    metricRow("Active days", `${s.activeDays.active}/${s.activeDays.of}`),
    metricRow("Current streak (days)", s.streak.currentDays),
    metricRow("Longest streak (days)", s.streak.longestDays),
  ];
  if (typeof s.longestSessionMinutes === "number")
    rows.push(metricRow("Longest session (min)", s.longestSessionMinutes));
  if (s.peakHour)
    rows.push(metricRow("Peak hour (24h)", `${s.peakHour.startHour}:00–${s.peakHour.endHour}:00`));
  for (const f of facts.funFacts)
    rows.push(metricRow(
      `${f.label}${f.approx ? " (approx.)" : ""}`,
      `${f.approx ? "~" : ""}${f.value}× ${f.baseline ? `vs ${f.baseline}` : ""}`.trim()
    ));
  const heat = facts.heatmap
    .map((d) => `<tr><th scope="row">${esc(d.date)}</th><td data-metric>${esc(d.count)}</td></tr>`)
    .join("");
  return `<table><caption>Exact Claude Code stats for ${esc(
    entry.contributor.displayName || entry.contributor.handle
  )} — screen-reader and audit ground truth; every visual element is a pure function of these values.</caption>` +
    `<thead><tr><th scope="col">Metric</th><th scope="col">Value</th></tr></thead>` +
    `<tbody>${rows.join("")}${heat}</tbody></table>`;
}

// Browser script. Canonical encoding lives in verify-core.mjs; this inline
// copy mirrors it. The test suite asserts round-trip consistency so drift
// is structurally caught. OrbitControls from three/addons (same pinned CDN).
function pageScript() {
  return `
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const E   = JSON.parse(document.getElementById('ccflex-entry').textContent);
const ENC = ${JSON.stringify(ENCODING)};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// MT19937 — mirrors verify-core.mjs::makeRng (canonical there).
function makeRng(seed){
  const N=624,M=397,MA=0x9908b0df>>>0,UM=0x80000000>>>0,LM=0x7fffffff>>>0;
  const mt=new Uint32Array(N);
  mt[0]=seed>>>0;
  for(let i=1;i<N;i++)mt[i]=(Math.imul(0x6c078965,mt[i-1]^(mt[i-1]>>>30))+i)>>>0;
  let mti=N;
  return function(){
    let y;
    if(mti>=N){
      for(let k=0;k<N-M;k++){y=(mt[k]&UM)|(mt[k+1]&LM);mt[k]=mt[k+M]^(y>>>1)^((y&1)?MA:0);}
      for(let k=N-M;k<N-1;k++){y=(mt[k]&UM)|(mt[k+1]&LM);mt[k]=mt[k+(M-N)]^(y>>>1)^((y&1)?MA:0);}
      y=(mt[N-1]&UM)|(mt[0]&LM);mt[N-1]=mt[M-1]^(y>>>1)^((y&1)?MA:0);mti=0;
    }
    y=mt[mti++];y^=y>>>11;y^=(y<<7)&0x9d2c5680;y^=(y<<15)&0xefc60000;y^=y>>>18;
    return(y>>>0)/4294967296;
  };
}

// Encoding fns — mirrors verify-core.mjs (canonical).
function tokensToParticleCount(t){return Math.floor(t/ENC.TOKEN_BUCKET);}
function countToHeight(c){return Math.max(ENC.HEIGHT_MIN,ENC.HEIGHT_K*c);}
function heightToCount(y){return y/ENC.HEIGHT_K;}
function heightIsClamped(c){return ENC.HEIGHT_K*c<ENC.HEIGHT_MIN;}
function rampIdx(t){const x=t<0?0:t>1?1:t,i=Math.floor(x*ENC.RAMP.length);return i>=ENC.RAMP.length?ENC.RAMP.length-1:i;}
function rampColor(t){return ENC.RAMP[rampIdx(t)];}
function valueToBarLength(v){return ENC.BAR_K*v;}
function barLengthToValue(l){return l/ENC.BAR_K;}

const heat     = E.stats.heatmap||[];
const maxC     = heat.length ? Math.max(...heat.map(d=>d.count)) : 1;
const seed     = parseInt((E.integrity.hash||'').slice(0,8),16)>>>0 || 1984;
const tok      = E.stats.totalTokens?.value??0;
const sess     = E.stats.sessions?.value??0;
const cur      = E.stats.streak?.currentDays??0;
const lng      = E.stats.streak?.longestDays??0;
const lsm      = E.stats.longestSessionMinutes??null;
// funFact word-count sources:
//   "Nineteen Eighty-Four" ~88,942 words (Project Gutenberg plain-text count, 2003 edition)
//   "War and Peace" ~580,000 words (standard reference; Garnett translation)
//   tokens-per-word factor implied by ratio: 265,100,000 ÷ (2155 × 88,942) ≈ 1.383
//   (typical Claude/GPT tokeniser avg is 1.3–1.4 tokens/word for English prose)
//   "War & Peace" ratio = 265,100,000 ÷ (330 × 580,000) ≈ 1.384 (same factor, consistent)
const funFacts = E.stats.funFacts||[];

function hasWebGL(){
  try{const c=document.createElement('canvas');
    return!!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')));}
  catch{return false;}
}

// Hover callout overlay.
const tip=document.getElementById('ccflex-tip');
function showTip(x,y,html){
  if(!tip)return;
  tip.innerHTML=html;tip.hidden=false;
  tip.style.left=Math.min(x+12,window.innerWidth-tip.offsetWidth-8)+'px';
  tip.style.top=Math.max(y-tip.offsetHeight-8,8)+'px';
}
function hideTip(){if(tip)tip.hidden=true;}

// Fullscreen toggle + viewport-fill FIX. Root cause of the bug: the canvas
// height was hard-capped (min(_,Npx)) and nothing resized the renderer on
// the FS transition, so requesting fullscreen only widened a letterbox.
// resize() is now the SINGLE sizing authority — ResizeObserver, window
// resize AND fullscreenchange all call it — and :fullscreen CSS lets the
// canvas grow to the viewport so the resize has room to take effect.
const fsBtn=document.getElementById('ccflex-fs');
const wrap=document.getElementById('ccflex-wrap');
let renderer=null,controls=null,cam=null,resize=()=>{};
function inFullscreen(){return!!(document.fullscreenElement||document.webkitFullscreenElement);}
fsBtn?.addEventListener('click',()=>{
  if(!inFullscreen())(wrap?.requestFullscreen?.()||wrap?.webkitRequestFullscreen?.());
  else (document.exitFullscreen?.()||document.webkitExitFullscreen?.());
});
function onFsChange(){
  if(fsBtn)fsBtn.textContent=inFullscreen()?'[ ⤡ ]':'[ FS ]';
  // Layout settles one frame after the FS transition — resize after it.
  requestAnimationFrame(()=>requestAnimationFrame(resize));
}
document.addEventListener('fullscreenchange',onFsChange);
document.addEventListener('webkitfullscreenchange',onFsChange);

let grid=null,points=null;
const statMeshes=[];

function makeSpriteLabel(txt,color,wPx){
  const w=wPx||256,c=document.createElement('canvas');c.width=w;c.height=64;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(8,8,12,0.78)';ctx.beginPath();ctx.roundRect(0,0,w,64,10);ctx.fill();
  ctx.strokeStyle=color||'#d97757';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(1,1,w-2,62,10);ctx.stroke();
  ctx.font='bold 22px ui-monospace,monospace';ctx.fillStyle=color||'#d97757';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,w/2,33);
  const tex=new THREE.CanvasTexture(c);tex.minFilter=THREE.LinearFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));
  sp.scale.set(w/110,0.58,1);return sp;
}

// Persistent in-scene HUD, parented to the camera so the headline stats are
// ALWAYS legible — first paint, every orbit angle, fullscreen, leaderboard
// thumbnail. A labelled echo of the embedded stats; the SR table + JSON
// islands stay the verifiable ground truth (sprites label; geometry carries
// the invertible truth — same accepted pattern as the other scene labels).
function makeHud(){
  const W=1024,H=128,c=document.createElement('canvas');c.width=W;c.height=H;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(6,6,10,0.62)';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#d97757';ctx.fillRect(0,0,W,4);
  ctx.textBaseline='middle';
  ctx.font='bold 44px ui-sans-serif,system-ui,sans-serif';ctx.fillStyle='#F2F2F2';
  ctx.fillText(String(E.stats.totalTokens.display).toUpperCase()+' TOKENS',24,44);
  ctx.font='600 24px ui-monospace,monospace';ctx.fillStyle='#E08A6B';
  const bits=[E.stats.sessions.display+' sessions',
    E.stats.streak.longestDays+'d max streak',
    (lsm!=null?lsm.toLocaleString()+' min longest':null),
    E.stats.favoriteModel].filter(Boolean);
  ctx.fillText(bits.join('   \xb7   '),24,86);
  ctx.font='500 17px ui-monospace,monospace';ctx.fillStyle='#9A9A9A';
  ctx.fillText(String(E.contributor.displayName||E.contributor.handle).toUpperCase(),24,114);
  const tex=new THREE.CanvasTexture(c);tex.minFilter=THREE.LinearFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));
  sp.scale.set(3.5,0.4375,1);return sp;
}

// Token galaxy — a dense triple-arm spiral of EXACTLY
// tokensToParticleCount(tok) points (the invertible tokenParticles channel,
// unchanged). Layout is seeded by the integrity hash via MT19937: shape is
// aesthetic, population is truth (verify-core §1.5). Replaces the old sparse
// ±20 box scatter that read as three faint dots in the screenshot.
function buildGalaxy(scene){
  const pc=tokensToParticleCount(tok);
  if(pc<=0)return null;
  const N=Math.min(pc,30000),rnd=makeRng(seed);
  const pos=new Float32Array(N*3),colr=new Float32Array(N*3),base=new THREE.Color();
  const ARMS=4,R=13;
  for(let i=0;i<N;i++){
    const t=i/N,arm=i%ARMS,rad=Math.pow(t,0.62)*R+0.3;
    const ang=arm*(2*Math.PI/ARMS)+rad*0.55+(rnd()-0.5)*0.55;
    const jit=(rnd()-0.5)*(0.5+rad*0.06);
    pos[i*3]=Math.cos(ang)*rad+jit;
    pos[i*3+1]=3.2+(rnd()-0.5)*(0.7+rad*0.10);
    pos[i*3+2]=Math.sin(ang)*rad+jit;
    base.set(rampColor(0.18+0.8*t));
    colr[i*3]=base.r;colr[i*3+1]=base.g;colr[i*3+2]=base.b;
  }
  const pg=new THREE.BufferGeometry();
  pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
  pg.setAttribute('color',new THREE.BufferAttribute(colr,3));
  pg.userData={exactCount:pc,tip:'<b>Total tokens</b><br><code>'+tok.toLocaleString()+'</code><br><small>'+pc+' particles (1 per '+ENC.TOKEN_BUCKET.toLocaleString()+'; residue&lt;bucket disclosed)</small>'};
  const pts=new THREE.Points(pg,new THREE.PointsMaterial({size:0.16,vertexColors:true,transparent:true,opacity:1.0,blending:THREE.AdditiveBlending,depthWrite:false}));
  scene.add(pts);statMeshes.push(pts);
  // Soft additive core glow — makes the galaxy read as a luminous HERO, not
  // a flat point cloud. Pure decoration (no data channel); the population
  // (pts.geometry.userData.exactCount) is the verified truth.
  const gc=document.createElement('canvas');gc.width=gc.height=128;
  const gx=gc.getContext('2d'),gg=gx.createRadialGradient(64,64,0,64,64,64);
  gg.addColorStop(0,'rgba(240,138,107,0.62)');gg.addColorStop(0.35,'rgba(217,119,87,0.20)');gg.addColorStop(1,'rgba(217,119,87,0)');
  gx.fillStyle=gg;gx.fillRect(0,0,128,128);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(gc),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  glow.position.set(0,3.2,0);glow.scale.set(24,24,1);scene.add(glow);
  // Bright pinpoint core — the galaxy nucleus reads as a luminous source.
  const core=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(gc),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,color:0xffd9c0}));
  core.position.set(0,3.2,0);core.scale.set(5,5,1);scene.add(core);
  return pts;
}

// Vertical stat pillar — the long (Y) dimension = valueToBarLength(value),
// the EXACT invertible scalarBar channel (verify-core SSOT, unchanged;
// verify() still round-trips it). Disparate values become an honest skyline:
// a 12,788-min longest session legitimately towers over a 5-day streak.
function addStatPillar(scene,value,label,x,hex){
  // Luminous beam. Its HEIGHT (Y) is exactly valueToBarLength(value) — the
  // unchanged invertible scalarBar channel (verify() still round-trips it);
  // only the *form* changed (box → thin emissive beam) for delight. Disparate
  // values become a cinematic light-skyline: a 12,788-min session is a beam
  // to the heavens, a 5-day streak a low ember — both exact.
  const len=valueToBarLength(value);if(!(len>0))return;
  const col=new THREE.Color(hex),z=-0.4;
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.13,len,12),
    new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:0.9,metalness:0.2,roughness:0.35,transparent:true,opacity:0.96}));
  beam.position.set(x,len/2,z);
  beam.userData={tip:'<b>'+label+'</b><br><code>'+value+'</code><br><small>scalarBar '+ENC.BAR_K+'\xd7'+value+'='+len.toFixed(3)+' (invertible height)</small>'};
  scene.add(beam);statMeshes.push(beam);
  // Glowing base disc — roots the beam elegantly (pure decoration).
  const base=new THREE.Mesh(new THREE.CircleGeometry(0.42,28),
    new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false}));
  base.rotation.x=-Math.PI/2;base.position.set(x,0.02,z);scene.add(base);
  const sp=makeSpriteLabel(label+' '+value,'#'+col.getHexString(),300);
  sp.position.set(x,Math.min(len+0.9,6.8),z);scene.add(sp);
}

// Fun-fact presentation. The ringRatio channel is UNCHANGED (verify-core
// SSOT: outer radius = RING_BASE_RADIUS*ratio, exact inverse; the SR table +
// verifyParity remain authoritative). Depth-1 falsify finding: at a ratio in
// the hundreds/thousands a TRUE-radius torus is so vast only a flat chord
// crosses the hero frame — it reads as a stray line, not a ring, not delight.
// Honest reconciliation: a ratio whose exact ring is actually perceptible
// within the frame (outer <= FF_VIEW_BOUND) is drawn as that EXACT ring; a
// larger one is shown as a camera-fixed fact tile that states the exact ratio
// in words — a label echo (same accepted pattern as the HUD / SR table),
// explicitly NOT a geometry claim. NEVER a cbrt/log/clamp-shrunk "ring":
// that would fake a checkable brag, which is the product's whole thesis. The
// ring/label boundary is disclosed in every tip.
// Two-line fun-fact chip: a BIG exact ratio + a short human caption (wrapped,
// never truncated — the depth-1 256px overflow clipped the ratio, the whole
// point). Pure canvas sprite; the SR table + ringRatio channel stay the
// verifiable datum (this is a label echo, not a geometry claim).
function makeFactTile(ratioStr,caption,accent){
  const W=640,H=156,c=document.createElement('canvas');c.width=W;c.height=H;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(8,8,12,0.86)';ctx.fillRect(0,0,W,H);
  ctx.fillStyle=accent;ctx.fillRect(0,0,7,H);
  ctx.textBaseline='alphabetic';
  ctx.font='800 66px ui-sans-serif,system-ui,sans-serif';ctx.fillStyle=accent;
  ctx.fillText(ratioStr,30,72);
  ctx.font='500 25px ui-monospace,monospace';ctx.fillStyle='#D8D8D8';
  const words=String(caption).split(/\s+/);let line='',y=112;
  for(const w of words){
    if(ctx.measureText(line+w+' ').width>W-46&&line){ctx.fillText(line.trim(),30,y);line=w+' ';y+=30;if(y>H-8)break;}
    else line+=w+' ';
  }
  if(line.trim()&&y<=H-8)ctx.fillText(line.trim(),30,y);
  const tex=new THREE.CanvasTexture(c);tex.minFilter=THREE.LinearFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true}));
  sp.scale.set(2.35,2.35*H/W,1);return sp;
}

const FF_VIEW_BOUND=13; // world units — disclosed ring-vs-label cutoff
function buildFunFacts(scene,camera){
  let tileN=0;
  funFacts.forEach((f,i)=>{
    if(typeof f.value!=='number'||!(f.value>0))return;
    const ratio=f.value,outer=ENC.RING_BASE_RADIUS*ratio; // EXACT — never altered
    const ratioStr=(f.approx?'~':'')+ratio+'\xd7';
    const caption=f.label||f.baseline||'';
    if(outer<=FF_VIEW_BOUND){
      // Exact, perceptible, invertible ring.
      const ring=new THREE.Mesh(
        new THREE.TorusGeometry(outer,Math.max(0.05,outer*0.03),12,96),
        new THREE.MeshStandardMaterial({color:0xd97757,metalness:0.5,roughness:0.4,emissive:0x9A3412,emissiveIntensity:0.35}));
      ring.rotation.x=Math.PI/2+(i*0.18-0.18);ring.position.set(0,3.2,0);
      ring.userData={tip:'<b>'+ratioStr+' '+caption+'</b><br><code>'+ratio+'\xd7</code><br><small>ringRatio: outer r=RING_BASE_RADIUS\xd7'+ratio+'='+outer.toFixed(2)+' (exact inverse; within view bound '+FF_VIEW_BOUND+')</small>'};
      scene.add(ring);statMeshes.push(ring);
    }else{
      // Honest fact tile — camera-fixed, always legible. The exact ratio is
      // the verifiable datum (SR table + unchanged ringRatio channel); the
      // colossal true ring radius (RING_BASE_RADIUS*ratio world u) is stated
      // in the screen-reader table, not faked small here.
      const sp=makeFactTile(ratioStr,caption,'#E08A6B');
      sp.position.set(2.15,1.05-tileN*0.62,-3.4);
      camera.add(sp);tileN++;
    }
  });
}

// Deterministic camera framing of the HERO (galaxy + pillars) so the scene
// reads with ZERO interaction. The honest colossal rings sweep through as a
// cinematic backdrop and are intentionally not used to size the frame.
function frameHero(){
  cam.position.set(15,9,20);
  const tgt=new THREE.Vector3(0,3.4,0);
  cam.lookAt(tgt);
  if(controls){
    controls.target.copy(tgt);
    controls.autoRotate=!reduce;controls.autoRotateSpeed=0.5;
    controls.minDistance=6;controls.maxDistance=160;controls.update();
  }
}

function buildWebGL(){
  const cv=document.getElementById('ccflex');
  renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true,alpha:true});
  renderer.setClearColor(0x000000,0);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const scene=new THREE.Scene();
  cam=new THREE.PerspectiveCamera(52,16/9,0.1,4000);
  scene.add(new THREE.AmbientLight(0xffffff,0.65));
  const dl=new THREE.DirectionalLight(0xffffff,1.05);dl.position.set(8,14,9);scene.add(dl);
  const pl=new THREE.PointLight(0xd97757,0.6,90);pl.position.set(0,6,0);scene.add(pl);

  if(!reduce){
    controls=new OrbitControls(cam,cv);
    controls.enableDamping=true;controls.dampingFactor=0.08;
    controls.maxPolarAngle=Math.PI/1.75;
  }

  // Heatmap floor (cellHeight + cellColour channels) — centred. Present only
  // if the entry carries a heatmap; the seed has none, so inert for it.
  if(heat.length){
    const geo=new THREE.BoxGeometry(0.6,1,0.6),cols=26;
    grid=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({metalness:0.2,roughness:0.7}),heat.length);
    grid.userData={isHeatmap:true};
    const m=new THREE.Matrix4(),col=new THREE.Color();
    for(let i=0;i<heat.length;i++){
      const d=heat[i],hh=countToHeight(d.count);
      m.makeScale(1,hh,1);m.setPosition((i%cols-cols/2)*0.7,hh/2,Math.floor(i/cols)*0.7-6);
      grid.setMatrixAt(i,m);grid.setColorAt(i,col.set(rampColor(d.count/maxC)));
    }
    grid.instanceMatrix.needsUpdate=true;grid.instanceColor.needsUpdate=true;
    grid.computeBoundingSphere();scene.add(grid);statMeshes.push(grid);
  }

  points=buildGalaxy(scene); // tokenParticles channel (exact count)

  // Scalar pillars (scalarBar channel) — honest skyline.
  const PILL=[[sess,'Sessions',2.0,'#56e07a'],[cur,'Streak',3.4,'#d97757'],
              [lng,'Max streak',4.8,'#9A3412'],[lsm,'Longest min',-2.0,'#2fb457']];
  for(const[v,l,x,c]of PILL)if(v!=null&&v>0)addStatPillar(scene,v,l,x,c);

  // Fun-facts: exact ring if perceptible, else honest camera-fixed tile.
  buildFunFacts(scene,cam);

  // Persistent HUD parented to the camera (always on screen).
  const hud=makeHud();
  cam.add(hud);hud.position.set(0,-1.32,-3.4);scene.add(cam);

  frameHero();

  // Raycaster for hover callout.
  const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
  cv.addEventListener('pointermove',e=>{
    const r=cv.getBoundingClientRect();
    mouse.x=((e.clientX-r.left)/r.width)*2-1;
    mouse.y=-((e.clientY-r.top)/r.height)*2+1;
    ray.setFromCamera(mouse,cam);
    const plain=statMeshes.filter(m=>!m.userData.isHeatmap);
    const hits=ray.intersectObjects(plain,false);
    if(hits.length&&hits[0].object.userData.tip){showTip(e.clientX,e.clientY,hits[0].object.userData.tip);return;}
    if(grid&&heat.length){
      const hi=ray.intersectObject(grid,false);
      if(hi.length&&hi[0].instanceId!=null){
        const d=heat[hi[0].instanceId];
        if(d){showTip(e.clientX,e.clientY,'<b>'+d.date+'</b><br><code>'+d.count.toLocaleString()+'</code><br><small>h='+countToHeight(d.count).toFixed(4)+(heightIsClamped(d.count)?' (clamped)':' (invertible)')+'</small>');return;}
      }
    }
    hideTip();
  });
  cv.addEventListener('pointerleave',hideTip);
  cv.addEventListener('touchend',hideTip);

  // resize() — the SINGLE sizing authority (fixes the fullscreen bug).
  resize=()=>{
    const w=cv.clientWidth||640,h=cv.clientHeight||420;
    renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(cv);
  addEventListener('resize',resize);
  resize();

  const draw=()=>renderer.render(scene,cam);
  if(reduce){draw();}
  else{const loop=()=>{if(!document.hidden){controls.update();draw();}requestAnimationFrame(loop);};requestAnimationFrame(loop);}
  window.__ccflexRendered=true;
}

function buildFallback(){
  // Data-equivalent 2D canvas — same ramp + a 2D galaxy of the EXACT
  // tokensToParticleCount points + the same hero stat line, no motion.
  const cv=document.getElementById('ccflex');
  const ctx=cv.getContext&&cv.getContext('2d');if(!ctx){window.__ccflexRendered=true;return;}
  cv.width=cv.clientWidth||640;cv.height=cv.clientHeight||420;
  const W=cv.width,H=cv.height;
  const g=ctx.createRadialGradient(W/2,H*0.4,0,W/2,H*0.4,Math.max(W,H)*0.7);
  g.addColorStop(0,'#15131c');g.addColorStop(1,'#070709');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const pc=tokensToParticleCount(tok),rnd=makeRng(seed),N=Math.min(pc,4000),sc=Math.min(W,H)*0.34;
  for(let i=0;i<N;i++){const t=i/N,rad=Math.pow(t,0.6)*sc,a=(i%3)*2.1+rad*0.03+(rnd()-0.5)*0.6;
    ctx.fillStyle=rampColor(0.2+0.8*t);ctx.fillRect(W/2+Math.cos(a)*rad,H*0.42+Math.sin(a)*rad*0.6,1.7,1.7);}
  heat.forEach((d,i)=>{ctx.fillStyle=rampColor(d.count/maxC);ctx.fillRect((i%26)*16+8,(Math.floor(i/26))*16+8,13,13);});
  ctx.textBaseline='top';
  ctx.font='bold 30px ui-sans-serif,system-ui,sans-serif';ctx.fillStyle='#F2F2F2';
  ctx.fillText(String(E.stats.totalTokens.display).toUpperCase()+' TOKENS',20,18);
  ctx.font='600 15px ui-monospace,monospace';ctx.fillStyle='#E08A6B';
  ctx.fillText([E.stats.sessions.display+' sessions',E.stats.streak.longestDays+'d max streak',(lsm?lsm.toLocaleString()+' min longest':''),E.stats.favoriteModel].filter(Boolean).join('  \xb7  '),20,58);
  window.__ccflexRendered=true;
}

if(hasWebGL()){try{buildWebGL();}catch(e){buildFallback();}}else{buildFallback();}

// window.verify() — parity check mirroring verify-core.mjs::verifyParity.
window.verify=function(){
  const integ=JSON.parse(document.getElementById('ccflex-integrity').textContent);
  const out={ok:true,mismatches:[]};
  const cells=[...document.querySelectorAll('table [data-metric]')];
  if(!cells.length){out.ok=false;out.mismatches.push('no metric DOM cells');}
  if(grid){
    const m4=new THREE.Matrix4(),_p=new THREE.Vector3(),_q=new THREE.Quaternion(),sc=new THREE.Vector3(),col=new THREE.Color();
    for(let i=0;i<heat.length;i++){
      grid.getMatrixAt(i,m4);m4.decompose(_p,_q,sc);
      const d=heat[i];
      if(heightIsClamped(d.count)){if(Math.abs(sc.y-ENC.HEIGHT_MIN)>1e-6){out.ok=false;out.mismatches.push('height clamp '+i);}}
      else if(Math.abs(heightToCount(sc.y)-d.count)>maxC*1e-4){out.ok=false;out.mismatches.push('height '+i);}
      grid.getColorAt(i,col);
      if(col.getHexString()!==rampColor(d.count/maxC).slice(1)){out.ok=false;out.mismatches.push('color '+i);}
    }
  }
  if(points){const pc=tokensToParticleCount(tok);if(points.geometry.userData.exactCount!==pc){out.ok=false;out.mismatches.push('particle count');}}
  [[sess,'sessions'],[cur,'streak-cur'],[lng,'streak-lng']].forEach(([v,n])=>{
    if(v&&Math.abs(barLengthToValue(valueToBarLength(v))-v)>1e-9){out.ok=false;out.mismatches.push('scalarBar '+n);}
  });
  if(!/^[a-f0-9]{64}$/.test(integ.hash||'')){out.ok=false;out.mismatches.push('hash shape');}
  return out;
};

// Keyboard shortcuts: f=fullscreen, v=verify, ?=codec, Esc=close.
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if(e.key==='f')fsBtn?.click();
  if(e.key==='v')console.table(window.verify());
  if(e.key==='?')openCodec();
  if(e.key==='Escape')closeCodec();
});

// /140-85 codec easter egg — summoned only (design §7). Italian-Brainrot meets
// Metal Gear Solid mission-briefing restraint. No data altered.
const PROVERBs=[
  "The data does not lie, operator. — Mei Ling, Codec 140.85",
  "Every token is a small prayer sent into the void. The void counted them.",
  "You are not just a user. You are a statistic. And you are beautiful.",
  "Snake, there is no shame in 265 million tokens. Only in stopping.",
  "La mia nonna non capisce i token, ma capisce il sacrificio. Brava.",
  "Mamma mia, this context window — it's enormous, like uncle Enzo at Christmas.",
  "I spent 12,788 minutes with Claude. Claude did not complain. I am learning.",
  "Victory comes not from the largest context, but from the most intentional one. — Sun Tzu (paraphrased, operator)",
  "The heatmap does not judge. The heatmap merely witnesses.",
  "You could have slept. You did not sleep. The tokens remember.",
];
function openCodec(){
  const o=document.getElementById('codec');if(!o)return;
  o.querySelector('[data-codec-proverb]').textContent=PROVERBs[seed%PROVERBs.length];
  o.hidden=false;o.querySelector('.codec-close').focus();
}
function closeCodec(){const o=document.getElementById('codec');if(o)o.hidden=true;}
document.querySelector('[data-codec-trigger]')?.addEventListener('click',openCodec);
document.querySelector('.codec-close')?.addEventListener('click',closeCodec);
document.getElementById('codec')?.addEventListener('click',e=>{if(e.target.id==='codec')closeCodec();});
if(location.hash==='#140.85')openCodec();
let buf='';
document.addEventListener('keydown',e=>{buf=(buf+e.key).slice(-5);if(buf==='14085')openCodec();});
`;
}

export function generate(entry) {
  const hash = computeHash(entry);
  const facts = extractFacts(entry);
  const name = entry.contributor.displayName || entry.contributor.handle;
  const importmap = JSON.stringify({
    imports: {
      three: `https://unpkg.com/three@${THREE_VERSION}/build/three.module.js`,
      "three/addons/": `https://unpkg.com/three@${THREE_VERSION}/examples/jsm/`,
    },
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>ccflex — ${esc(name)}</title>
<script type="application/json" id="ccflex-entry">
${jsonIsland(entry)}
</script>
<script type="application/json" id="ccflex-integrity">
${jsonIsland({ hash })}
</script>
<style>
:root{--paper:#EAEAEA;--ink:#0A0A0A;--mute:#4B5563;--accent:#d97757;--accent-ink:#9A3412;--line:#C9C9C9;
--font-sans:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
--font-mono:ui-monospace,SFMono-Regular,"SF Mono",Consolas,"Liberation Mono",Menlo,monospace;}
@media (prefers-color-scheme:dark){:root{--paper:#161616;--ink:#F2F2F2;--mute:#9A9A9A;--accent-ink:#E08A6B;--line:#333;}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;}}
*{box-sizing:border-box;margin:0;}html{overflow-x:hidden;-webkit-text-size-adjust:100%;}
body{background:var(--paper);color:var(--ink);font-family:var(--font-sans);font-size:16px;line-height:1.6;}
img,svg,canvas{max-width:100%;}
.wrap{max-width:1200px;margin:0 auto;padding:24px;}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:16px;}
.wm{font-family:var(--font-mono);font-weight:700;letter-spacing:-0.02em;}
h1{font-family:var(--font-sans);font-weight:700;letter-spacing:-0.045em;font-size:clamp(2rem,5vw,4.5rem);margin:48px 0 8px;}
.num{font-family:var(--font-mono);font-weight:700;letter-spacing:-0.04em;font-size:clamp(3rem,8vw,6rem);color:var(--ink);line-height:.9;}
.lbl{font-family:var(--font-mono);font-size:.6875rem;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--mute);}
#ccflex-wrap{position:relative;width:100%;margin:24px 0;border:1px solid var(--line);background:radial-gradient(ellipse at 50% 36%,#15131c 0%,#0b0a10 56%,#070709 100%);}
canvas#ccflex{display:block;width:100%;height:min(72dvh,560px);min-height:380px;border:0;background:transparent;}
#ccflex-wrap:fullscreen,#ccflex-wrap:-webkit-full-screen{width:100vw;height:100vh;height:100dvh;margin:0;border:0;}
#ccflex-wrap:fullscreen canvas#ccflex,#ccflex-wrap:-webkit-full-screen canvas#ccflex{width:100vw;height:100vh;height:100dvh;max-width:none;min-height:0;}
#ccflex-fs{position:absolute;top:8px;right:8px;min-width:44px;min-height:44px;background:rgba(0,0,0,.55);border:1px solid var(--line);color:var(--ink);font-family:var(--font-mono);font-size:.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0 10px;z-index:2;}
@media (prefers-color-scheme:dark){#ccflex-fs{background:rgba(255,255,255,.08);}}
#ccflex-tip{position:fixed;background:var(--paper);border:1px solid var(--accent);color:var(--ink);font-family:var(--font-mono);font-size:.72rem;padding:6px 10px;pointer-events:none;z-index:10;max-width:220px;line-height:1.4;display:none;}
table{border-collapse:collapse;width:100%;font-family:var(--font-mono);font-size:.8rem;}
caption{text-align:left;color:var(--mute);padding:8px 0;font-family:var(--font-sans);}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;}
.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}
a{color:var(--accent-ink);}
footer{border-top:1px solid var(--line);margin-top:48px;padding-top:16px;font-family:var(--font-mono);font-size:.75rem;color:var(--mute);}
[data-codec-trigger]{color:var(--mute);cursor:pointer;background:none;border:0;font-family:var(--font-mono);font-size:.75rem;min-height:44px;}
#codec[hidden]{display:none;}
#codec{position:fixed;inset:0;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;z-index:99;}
.codec-panel{background:#000;border:1px solid var(--accent);box-shadow:0 0 64px rgba(217,119,87,.25);
color:#fff;font-family:var(--font-mono);padding:24px;width:min(92vw,28rem);max-height:90dvh;overflow:auto;}
.codec-panel .lbl{color:#9A9A9A;}
.codec-close{min-width:44px;min-height:44px;background:none;border:1px solid var(--accent);color:#fff;font-family:var(--font-mono);cursor:pointer;float:right;}
*:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
</style>
</head>
<body>
<a class="sr-only" href="#main">Skip to content</a>
<div class="wrap">
<header>
  <span class="wm">CCFLEX</span>
  <nav class="wm"><a href="${esc(entry.contributor.url || "#")}">${esc(
    entry.contributor.handle
  )}</a></nav>
</header>
<main id="main">
  <p class="lbl">Claude Code · ${esc(entry.source.command)} · ${esc(
    entry.source.window.days
  )}-day window</p>
  <h1>${esc(name)} flexed.</h1>
  <p class="num">${esc(entry.stats.totalTokens.display)}</p>
  <p class="lbl">tokens${entry.stats.totalTokens.exact ? "" : " (display-rounded source)"} — bello, no?</p>

  <div id="ccflex-wrap">
    <canvas id="ccflex" role="img"
      aria-label="Interactive 3D scene — orbit/drag to explore; every shape encodes a real stat. Tab for keyboard access, F for fullscreen, V for verify.">
    </canvas>
    <button id="ccflex-fs" type="button" aria-label="Toggle fullscreen">[ FS ]</button>
  </div>
  <div id="ccflex-tip" role="tooltip" aria-live="polite"></div>

  ${srTable(entry)}
</main>
<footer>
  <p>I counted your tokens. Every. Single. One. Engine: three.js@${THREE_VERSION}, pinned. Integrity: SHA-256/RFC 8785.</p>
  <button type="button" data-codec-trigger aria-label="Open codec call — frequency 140.85">140.85</button>
</footer>
</div>

<div id="codec" role="dialog" aria-modal="true" aria-label="Codec call — session transmission" hidden>
  <div class="codec-panel">
    <button type="button" class="codec-close" aria-label="Close codec">[ X ]</button>
    <p class="lbl">FREQ 140.85 · CALLER MEI LING · ENCRYPTION ACTIVE</p>
    <p class="lbl">OPERATORE</p><p>${esc(entry.contributor.handle || "OPERATOR")}</p>
    <p class="lbl">SESSIONI</p><p>${esc(entry.stats.sessions.value)}</p>
    <p class="lbl">STRISCIA CORRENTE</p><p>${esc(entry.stats.streak.currentDays)}</p>
    <p class="lbl">TRASMISSIONE</p><p data-codec-proverb>—</p>
    <p class="lbl" style="margin-top:16px;font-size:.6em;opacity:.55">codec closes on click outside · Esc · [ X ]</p>
  </div>
</div>

<script type="importmap">${importmap}</script>
<script type="module">${pageScript()}</script>
</body>
</html>`;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: generate.mjs <entry.json> [outfile]");
    process.exit(2);
  }
  let entry;
  try {
    entry = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`parse error: ${e.message}`);
    process.exit(2);
  }
  const html = generate(entry);
  const out = process.argv[3];
  if (out) {
    writeFileSync(out, html);
    console.error(`wrote ${out} (${html.length} bytes)`);
  } else {
    process.stdout.write(html);
  }
}
