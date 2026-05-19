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

// Fullscreen toggle.
const fsBtn=document.getElementById('ccflex-fs');
const wrap=document.getElementById('ccflex-wrap');
fsBtn?.addEventListener('click',()=>{
  if(!document.fullscreenElement)wrap?.requestFullscreen?.();
  else document.exitFullscreen?.();
});
document.addEventListener('fullscreenchange',()=>{
  if(fsBtn)fsBtn.textContent=document.fullscreenElement?'[⤢]':'[⤡]';
});

let grid=null,points=null,renderer=null,controls=null;
const statMeshes=[];

function makeSpriteLabel(txt,color){
  const c=document.createElement('canvas');c.width=256;c.height=64;
  const ctx=c.getContext('2d');
  ctx.fillStyle='rgba(0,0,0,0.72)';ctx.roundRect(0,0,256,64,8);ctx.fill();
  ctx.font='bold 20px monospace';ctx.fillStyle=color||'#d97757';
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,128,32);
  const tex=new THREE.CanvasTexture(c);
  const mat=new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true});
  const sp=new THREE.Sprite(mat);sp.scale.set(2.4,0.6,1);return sp;
}

function addStatBar(scene,value,label,posX,posZ,hexColor){
  const bLen=valueToBarLength(value);
  const geo=new THREE.BoxGeometry(bLen,0.18,0.18);
  const col=new THREE.Color(hexColor);
  const mat=new THREE.MeshStandardMaterial({color:col,metalness:0.3,roughness:0.6});
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(posX+bLen/2,0.09,posZ);
  mesh.userData={tip:'<b>'+label+'</b><br><code>'+value+'</code><br><small>scalarBar: BAR_K\xd7'+value+'='+bLen.toFixed(3)+'</small>'};
  scene.add(mesh);statMeshes.push(mesh);
  const sp=makeSpriteLabel(label+': '+value,'#'+col.getHexString());
  sp.position.set(posX+bLen/2,0.6,posZ);scene.add(sp);
}

function addRingPair(scene,ratio,label,cx,cz){
  const inner=ENC.RING_BASE_RADIUS,outer=inner*ratio;
  [inner,outer].forEach((r,idx)=>{
    const geo=new THREE.TorusGeometry(r,0.06,8,48);
    const mat=new THREE.MeshStandardMaterial({color:idx===0?0x56e07a:0xd97757,metalness:0.4,roughness:0.5});
    const mesh=new THREE.Mesh(geo,mat);
    mesh.rotation.x=Math.PI/2;mesh.position.set(cx,0.06,cz);
    mesh.userData={tip:'<b>'+label+'</b><br><code>'+ratio+'\xd7</code><br><small>ringRatio: outer r='+outer.toFixed(2)+'</small>'};
    scene.add(mesh);statMeshes.push(mesh);
  });
  const sp=makeSpriteLabel(label,null);
  sp.position.set(cx,outer+0.8,cz);scene.add(sp);
}

function buildWebGL(){
  const cv=document.getElementById('ccflex');
  renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const w=cv.clientWidth||640,h=cv.clientHeight||420;
  renderer.setSize(w,h,false);
  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(50,w/h,0.1,1000);
  cam.position.set(12,10,20);cam.lookAt(5,2,4);
  scene.add(new THREE.AmbientLight(0xffffff,0.6));
  const dl=new THREE.DirectionalLight(0xffffff,1.0);dl.position.set(8,12,8);scene.add(dl);

  if(!reduce){
    controls=new OrbitControls(cam,cv);
    controls.enableDamping=true;controls.dampingFactor=0.08;
    controls.maxPolarAngle=Math.PI/1.8;
    controls.target.set(5,2,4);controls.update();
  }

  // Heatmap bars (cellHeight + cellColour channels).
  if(heat.length){
    const geo=new THREE.BoxGeometry(0.85,1,0.85);
    grid=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial(),heat.length);
    grid.userData={isHeatmap:true};
    const m=new THREE.Matrix4(),col=new THREE.Color();
    for(let i=0;i<heat.length;i++){
      const d=heat[i],hh=countToHeight(d.count);
      m.makeScale(1,hh,1);m.setPosition((i%26)*1.0,hh/2,Math.floor(i/26)*1.0);
      grid.setMatrixAt(i,m);grid.setColorAt(i,col.set(rampColor(d.count/maxC)));
    }
    grid.instanceMatrix.needsUpdate=true;grid.instanceColor.needsUpdate=true;
    grid.computeBoundingSphere();scene.add(grid);statMeshes.push(grid);
  }

  // Particle field (tokenParticles channel).
  const pc=tokensToParticleCount(tok);
  if(pc>0){
    const N=Math.min(pc,30000),rnd=makeRng(seed);
    const pos=new Float32Array(N*3);
    for(let i=0;i<N;i++){pos[i*3]=(rnd()-0.5)*40;pos[i*3+1]=rnd()*22;pos[i*3+2]=(rnd()-0.5)*40;}
    const pg=new THREE.BufferGeometry();
    pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
    pg.userData={exactCount:pc,tip:'<b>Total tokens</b><br><code>'+tok.toLocaleString()+'</code><br><small>'+pc+' particles (1 per '+ENC.TOKEN_BUCKET.toLocaleString()+')</small>'};
    points=new THREE.Points(pg,new THREE.PointsMaterial({color:0xd97757,size:0.06}));
    scene.add(points);
  }

  // Scalar stat bars (scalarBar channel) — offset behind heatmap.
  const bz=-3;
  if(sess>0) addStatBar(scene,sess,'Sessions',0,bz,'#56e07a');
  if(cur>0)  addStatBar(scene,cur,'Streak',0,bz-1.4,'#d97757');
  if(lng>0)  addStatBar(scene,lng,'Max streak',0,bz-2.8,'#9A3412');
  if(lsm!=null&&lsm>0) addStatBar(scene,lsm,'Session min',0,bz-4.2,'#2fb457');

  // Fun-fact rings (ringRatio channel).
  funFacts.forEach((f,i)=>{
    if(typeof f.value==='number'&&f.value>0){
      addRingPair(scene,f.value,(f.approx?'~':'')+f.value+'\xd7 vs '+(f.baseline||'?'),28+i*7,4);
    }
  });

  // Raycaster for hover callout.
  const ray=new THREE.Raycaster();
  const mouse=new THREE.Vector2();
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

  new ResizeObserver(()=>{
    const nw=cv.clientWidth,nh=cv.clientHeight;
    renderer.setSize(nw,nh,false);cam.aspect=nw/nh;cam.updateProjectionMatrix();
  }).observe(cv);

  const draw=()=>renderer.render(scene,cam);
  if(reduce){draw();}
  else{const loop=()=>{if(!document.hidden){controls.update();draw();}requestAnimationFrame(loop);};requestAnimationFrame(loop);}
  window.__ccflexRendered=true;
}

function buildFallback(){
  // Data-equivalent 2D canvas — identical ramp + stat labels, no motion.
  const cv=document.getElementById('ccflex');
  const ctx=cv.getContext('2d');if(!ctx){window.__ccflexRendered=true;return;}
  cv.width=cv.clientWidth||640;cv.height=cv.clientHeight||420;
  const W=cv.width,H=cv.height;
  ctx.fillStyle='#161616';ctx.fillRect(0,0,W,H);
  heat.forEach((d,i)=>{ctx.fillStyle=rampColor(d.count/maxC);ctx.fillRect((i%26)*22+8,(Math.floor(i/26))*22+8,18,18);});
  ctx.font='bold 13px monospace';ctx.textBaseline='top';
  [tok?'tokens: '+E.stats.totalTokens.display:null,sess?'sessions: '+sess:null,cur?'streak: '+cur+'d':null,lsm?'longest: '+lsm+'min':null]
    .filter(Boolean).forEach((s,i)=>{ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(8,H-28-i*22,200,20);ctx.fillStyle='#d97757';ctx.fillText(s,12,H-26-i*22);});
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

// /140-85 codec easter egg — summoned only (design §7).
const PROVERBs=[
  "Victory comes from finding opportunities in problems. — Sun Tzu",
  "The data does not lie, operator. — Mei Ling",
  "A wave is just water remembering the shore.",
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
#ccflex-wrap{position:relative;width:100%;margin:24px 0;}
canvas#ccflex{display:block;width:100%;height:min(60dvh,420px);min-height:320px;border:1px solid var(--line);background:transparent;}
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
  <p class="lbl">tokens${entry.stats.totalTokens.exact ? "" : " (display-rounded source)"}</p>

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
  <p>I counted your tokens. All of them. Engine: three.js@${THREE_VERSION}, pinned.</p>
  <button type="button" data-codec-trigger aria-label="Open codec call">140.85</button>
</footer>
</div>

<div id="codec" role="dialog" aria-modal="true" aria-label="Codec call — session transmission" hidden>
  <div class="codec-panel">
    <button type="button" class="codec-close" aria-label="Close codec">[ X ]</button>
    <p class="lbl">FREQ 140.85 · CALLER MEI LING</p>
    <p class="lbl">SUBJECT</p><p>${esc(entry.contributor.handle || "OPERATOR")}</p>
    <p class="lbl">SESSIONS</p><p>${esc(entry.stats.sessions.value)}</p>
    <p class="lbl">STREAK</p><p>${esc(entry.stats.streak.currentDays)}</p>
    <p class="lbl">TRANSMISSION</p><p data-codec-proverb>—</p>
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
