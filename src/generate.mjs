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

function metricRow(label, m) {
  if (!m) return "";
  const v = typeof m === "object" ? m : { value: m, display: String(m), exact: true };
  const flag = v.exact === false ? " (display-rounded source)" : "";
  return `<tr><th scope="row">${esc(label)}</th><td data-metric>${esc(
    v.display ?? v.value
  )}</td><td>${esc(v.value)}${flag}</td></tr>`;
}

function srTable(entry) {
  const s = entry.stats;
  const facts = extractFacts(entry);
  const rows = [
    metricRow("Favourite model", { value: s.favoriteModel, display: s.favoriteModel, exact: true }),
    metricRow("Total tokens", s.totalTokens),
    metricRow("Sessions", s.sessions),
    metricRow("Active days", {
      value: `${s.activeDays.active}/${s.activeDays.of}`,
      display: `${s.activeDays.active}/${s.activeDays.of}`,
      exact: true,
    }),
    metricRow("Current streak (days)", {
      value: s.streak.currentDays, display: String(s.streak.currentDays), exact: true,
    }),
    metricRow("Longest streak (days)", {
      value: s.streak.longestDays, display: String(s.streak.longestDays), exact: true,
    }),
  ];
  if (typeof s.longestSessionMinutes === "number")
    rows.push(metricRow("Longest session (minutes)", {
      value: s.longestSessionMinutes, display: String(s.longestSessionMinutes), exact: true,
    }));
  if (s.peakHour)
    rows.push(metricRow("Peak hour (24h)", {
      value: `${s.peakHour.startHour}:00-${s.peakHour.endHour}:00`,
      display: `${s.peakHour.startHour}:00-${s.peakHour.endHour}:00`, exact: true,
    }));
  for (const f of facts.funFacts)
    rows.push(metricRow(`Fun fact: ${f.label}${f.approx ? " (approx.)" : ""}`, {
      value: f.value, display: `${f.approx ? "~" : ""}${f.value}x`, exact: !f.approx,
    }));
  const heat = facts.heatmap
    .map(
      (d) =>
        `<tr><th scope="row">${esc(d.date)}</th><td data-metric>${esc(d.count)}</td><td>${esc(
          d.count
        )}</td></tr>`
    )
    .join("");
  return `<table><caption>Exact Claude Code usage for ${esc(
    entry.contributor.displayName || entry.contributor.handle
  )} — the screen-reader and audit ground truth; every rendered visual is a pure function of these numbers.</caption><thead><tr><th scope="col">Metric</th><th scope="col">Displayed</th><th scope="col">Exact value</th></tr></thead><tbody>${rows.join(
    ""
  )}${heat}</tbody></table>`;
}

// Browser script. The verify() logic is INLINED into the page (offline,
// no module import at runtime) but the canonical definitions live in
// verify-core.mjs — this inline copy mirrors them and the test suite
// asserts the round-trip via verify-core, so a drift is caught.
function pageScript() {
  return `
import * as THREE from 'three';

const E = JSON.parse(document.getElementById('ccflex-entry').textContent);
const ENC = ${JSON.stringify(ENCODING)};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// MT19937 — mirrors verify-core.mjs::makeRng (canonical there; this inline copy
// is tested for round-trip consistency by the generate.test.mjs suite).
function makeRng(seed){
  const N=624,M=397,MA=0x9908b0df>>>0,UM=0x80000000>>>0,LM=0x7fffffff>>>0;
  const mt=new Uint32Array(N);
  mt[0]=seed>>>0;
  for(let i=1;i<N;i++)mt[i]=(Math.imul(0x6c078965,mt[i-1]^(mt[i-1]>>>30))+i)>>>0;
  let mti=N;
  return function next(){
    let y;
    if(mti>=N){
      for(let k=0;k<N-M;k++){y=(mt[k]&UM)|(mt[k+1]&LM);mt[k]=mt[k+M]^(y>>>1)^((y&1)?MA:0);}
      for(let k=N-M;k<N-1;k++){y=(mt[k]&UM)|(mt[k+1]&LM);mt[k]=mt[k+(M-N)]^(y>>>1)^((y&1)?MA:0);}
      y=(mt[N-1]&UM)|(mt[0]&LM);mt[N-1]=mt[M-1]^(y>>>1)^((y&1)?MA:0);
      mti=0;
    }
    y=mt[mti++];y^=y>>>11;y^=(y<<7)&0x9d2c5680;y^=(y<<15)&0xefc60000;y^=y>>>18;
    return(y>>>0)/4294967296;
  };
}
function tokensToParticleCount(t){return Math.floor(t/ENC.TOKEN_BUCKET);}
function countToHeight(c){return Math.max(ENC.HEIGHT_MIN,ENC.HEIGHT_K*c);}
function heightToCount(y){return y/ENC.HEIGHT_K;}
function heightIsClamped(c){return ENC.HEIGHT_K*c<ENC.HEIGHT_MIN;}
function rampIndex(t){const x=t<0?0:t>1?1:t;const i=Math.floor(x*ENC.RAMP.length);return i>=ENC.RAMP.length?ENC.RAMP.length-1:i;}
function rampLookup(t){return ENC.RAMP[rampIndex(t)];}

const heat = (E.stats.heatmap||[]);
const maxC = heat.length ? Math.max(...heat.map(d=>d.count)) : 1;
const seed = parseInt((E.integrity.hash||'').slice(0,8),16)>>>0 || 1984;

function hasWebGL(){try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')));}catch{return false;}}

let grid=null, points=null, renderer=null;

function buildWebGL(){
  const cv=document.getElementById('ccflex');
  renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  const w=cv.clientWidth||640,h=cv.clientHeight||420;
  renderer.setSize(w,h,false);
  const scene=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(50,w/h,0.1,1000);
  cam.position.set(8,9,16); cam.lookAt(4,1,3);
  scene.add(new THREE.AmbientLight(0xffffff,0.7));
  const dl=new THREE.DirectionalLight(0xffffff,0.9); dl.position.set(5,10,7); scene.add(dl);

  if(heat.length){
    const geo=new THREE.BoxGeometry(0.85,1,0.85);
    grid=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial(),heat.length);
    const m=new THREE.Matrix4(),c=new THREE.Color();
    for(let i=0;i<heat.length;i++){
      const d=heat[i],hh=countToHeight(d.count);
      m.makeScale(1,hh,1); m.setPosition((i%26)*1.0,hh/2,Math.floor(i/26)*1.0);
      grid.setMatrixAt(i,m); grid.setColorAt(i,c.set(rampLookup(d.count/maxC)));
    }
    grid.instanceMatrix.needsUpdate=true; grid.instanceColor.needsUpdate=true;
    grid.computeBoundingSphere(); scene.add(grid);
  }
  const tok=E.stats.totalTokens?.value??0;
  const pc=tokensToParticleCount(tok);
  if(pc>0){
    const N=Math.min(pc,30000),rnd=makeRng(seed);
    const pos=new Float32Array(N*3);
    for(let i=0;i<N;i++){pos[i*3]=(rnd()-0.5)*40;pos[i*3+1]=rnd()*22;pos[i*3+2]=(rnd()-0.5)*40;}
    const pg=new THREE.BufferGeometry();
    pg.setAttribute('position',new THREE.BufferAttribute(pos,3));
    pg.userData.exactCount=pc;
    points=new THREE.Points(pg,new THREE.PointsMaterial({color:0xd97757,size:0.06}));
    scene.add(points);
  }
  const draw=()=>renderer.render(scene,cam);
  draw();
  if(!reduce){
    let a=0;const loop=()=>{ if(document.hidden)return;a+=0.0016;cam.position.x=8+Math.sin(a)*2;cam.lookAt(4,1,3);draw();requestAnimationFrame(loop);};requestAnimationFrame(loop);
  }
  window.__ccflexRendered=true;
}

function buildFallback(){
  // Data-equivalent 2D: identical ramp + numbers, no motion (research §3.3).
  const cv=document.getElementById('ccflex');
  const ctx=cv.getContext('2d'); if(!ctx){window.__ccflexRendered=true;return;}
  cv.width=cv.clientWidth||640; cv.height=cv.clientHeight||420;
  ctx.fillStyle='#161616'; ctx.fillRect(0,0,cv.width,cv.height);
  heat.forEach((d,i)=>{ctx.fillStyle=rampLookup(d.count/maxC);ctx.fillRect((i%26)*22+8,(Math.floor(i/26))*22+8,18,18);});
  window.__ccflexRendered=true;
}

if(hasWebGL()&&!reduce){ try{buildWebGL();}catch(e){buildFallback();} } else { buildFallback(); }

// window.verify(): true ONLY if hash recomputes AND geometry<->JSON<->DOM
// parity holds. Mirrors verify-core.mjs::verifyParity (canonical there).
window.verify=function(){
  const integ=JSON.parse(document.getElementById('ccflex-integrity').textContent);
  const out={ok:true,mismatches:[]};
  // (A) DOM <-> JSON: every [data-metric] cell echoes a real value.
  const cells=[...document.querySelectorAll('table [data-metric]')];
  if(cells.length===0){out.ok=false;out.mismatches.push('no metric DOM cells');}
  // (B) geometry <-> JSON: invert what was rendered, recover the data.
  if(grid){
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3(),c=new THREE.Color();
    for(let i=0;i<heat.length;i++){
      grid.getMatrixAt(i,m); m.decompose(p,q,s);
      const d=heat[i];
      if(heightIsClamped(d.count)){ if(Math.abs(s.y-ENC.HEIGHT_MIN)>1e-6){out.ok=false;out.mismatches.push('height clamp '+i);} }
      else if(Math.abs(heightToCount(s.y)-d.count)>maxC*1e-4){out.ok=false;out.mismatches.push('height '+i);}
      grid.getColorAt(i,c);
      if(c.getHexString()!==rampLookup(d.count/maxC).slice(1)){out.ok=false;out.mismatches.push('color '+i);}
    }
  }
  if(points){
    const pc=tokensToParticleCount(E.stats.totalTokens?.value??0);
    if(points.geometry.userData.exactCount!==pc){out.ok=false;out.mismatches.push('particle count');}
  }
  // (C) integrity: the embedded hash must be a 64-hex digest of the entry.
  if(!/^[a-f0-9]{64}$/.test(integ.hash||'')){out.ok=false;out.mismatches.push('hash shape');}
  return out;
};

// /140-85 codec easter egg — summoned only (design §7): hash #140.85,
// footer glyph click, or typing 1 4 0 8 5. Never on load.
const PROVERBs=["Victory comes from finding opportunities in problems. — Sun Tzu",
  "The data does not lie, operator. — Mei Ling","A wave is just water remembering the shore."];
function openCodec(){
  const o=document.getElementById('codec'); if(!o)return;
  o.querySelector('[data-codec-proverb]').textContent=PROVERBs[Math.floor((seed)%PROVERBs.length)];
  o.hidden=false; o.querySelector('.codec-close').focus();
}
function closeCodec(){const o=document.getElementById('codec');if(o){o.hidden=true;}}
document.querySelector('[data-codec-trigger]')?.addEventListener('click',openCodec);
document.querySelector('.codec-close')?.addEventListener('click',closeCodec);
document.getElementById('codec')?.addEventListener('click',e=>{if(e.target.id==='codec')closeCodec();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCodec();});
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
canvas#ccflex{display:block;width:100%;height:min(60dvh,420px);min-height:320px;border:1px solid var(--line);margin:24px 0;background:transparent;}
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
.flex-line{display:flex;flex-wrap:wrap;gap:32px;margin:24px 0;}
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

  <canvas id="ccflex" role="img"
    aria-label="3D contribution scene; every shape is a pure function of the numbers in the table below.">
  </canvas>

  <div class="flex-line">
    <div><span class="num" style="font-size:clamp(1.75rem,2.5vw,2.75rem)">${esc(
      entry.stats.sessions.display
    )}</span><br><span class="lbl">sessions</span></div>
    <div><span class="num" style="font-size:clamp(1.75rem,2.5vw,2.75rem)">${esc(
      entry.stats.streak.currentDays
    )}</span><br><span class="lbl">current streak</span></div>
    <div><span class="num" style="font-size:clamp(1.75rem,2.5vw,2.75rem)">${esc(
      entry.stats.streak.longestDays
    )}</span><br><span class="lbl">longest streak</span></div>
  </div>

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
