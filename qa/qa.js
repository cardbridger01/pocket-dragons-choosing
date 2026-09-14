/* Pocket Dragons — QA harness.  Node 18+, `npm i jsdom`.  Run: node qa.js */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const DIR=process.argv[2]||path.join(__dirname,'..');
const HTML=fs.readFileSync(path.join(DIR,'index.html'),'utf8');
let pass=0,fail=0;
const ok=(c,m)=>{c?(pass++,console.log('  PASS  '+m)):(fail++,console.log('  FAIL  '+m));};
const head=t=>console.log('\n'+t);

/* ---------- 1. static graph ---------- */
head('Graph structure');
const sc=HTML.match(/<script>([\s\S]*?)<\/script>/g);
ok(sc.length===1,'exactly one <script> block (no monkeypatch)');
const js=sc[0].replace(/^<script>|<\/script>$/g,'');
(0,eval)(js.match(/const types = \{[\s\S]*?\n\};/)[0].replace('const types =','globalThis.types ='));
(0,eval)(js.match(/const scenes = \{[\s\S]*?\n\};/)[0].replace('const scenes =','globalThis.scenes ='));
const {types,scenes}=globalThis,keys=Object.keys(types);
ok(Object.keys(scenes).length===14,'14 scenes');
ok(keys.length===16,'16 egg types');
ok(!/scene\s*=\s*0/.test(js),'no stray `scene = 0` implicit global');
ok(!/originalPocketReveal/.test(js),'no reveal monkeypatch');
ok(!/of 8|\/\s*8\s*\*\s*100/.test(js),'no hardcoded 8-step denominator');

const col={},cyc=[];
(function dfs(n,st){col[n]=1;st.push(n);for(const c of scenes[n].choices){const x=c[3];if(x==='reveal')continue;
 if(col[x]===1)cyc.push(st.slice(st.indexOf(x)).concat(x).join('->'));else if(!col[x])dfs(x,st);}col[n]=2;st.pop();})('start',[]);
ok(cyc.length===0,'no cycles'+(cyc.length?': '+cyc:''));

const bad=[];const reach=new Set(['start']),q=['start'];
while(q.length){const n=q.pop();for(const c of scenes[n].choices){const x=c[3];
 if(x==='reveal')continue; if(!scenes[x]){bad.push(n+'->'+x);continue;}
 if(!reach.has(x)){reach.add(x);q.push(x);}}}
ok(!bad.length,'no dead links'+(bad.length?': '+bad:''));
ok(Object.keys(scenes).every(n=>reach.has(n)),'every scene reachable');
for(const[id,s]of Object.entries(scenes)){
  ok(fs.existsSync(path.join(DIR,s.img)),`asset exists: ${s.img} (${id})`);
  ok(typeof s.alt==='string'&&s.alt.length>15,`scene ${id} has descriptive alt text`);
}
const assets=new Set([...Object.values(scenes).map(s=>s.img),...keys.map(k=>types[k].img)]);
for(const k of keys) ok(fs.existsSync(path.join(DIR,types[k].img)),`egg asset exists: ${types[k].img}`);
const onDisk=fs.readdirSync(DIR).filter(f=>/\.(webp|png|jpg|mp4)$/i.test(f));
const orphan=onDisk.filter(f=>!assets.has(f)&&!HTML.includes(f));
ok(!orphan.length,'no unreferenced media in deploy'+(orphan.length?': '+orphan:''));

/* ---------- 2. every path ---------- */
head('Path enumeration');
const paths=[];
(function w(n,acc,sco){for(const c of scenes[n].choices){const s2={...sco};
 for(const[k,v]of Object.entries(c[2]))s2[k]=(s2[k]||0)+v;
 if(c[3]==='reveal'){paths.push({len:acc.length+1,s:s2});continue;} w(c[3],acc.concat(n),s2);}})('start',[],{});
const lens=paths.map(p=>p.len);
ok(paths.length>0,`${paths.length} complete paths, all reaching the reveal`);
ok(Math.min(...lens)>=5&&Math.max(...lens)<=8,`path length bounded ${Math.min(...lens)}-${Math.max(...lens)}`);
const win={};keys.forEach(k=>win[k]=0);
for(const p of paths){const r=keys.map(k=>({k,v:p.s[k]||0})).sort((a,b)=>b.v-a.v);win[r[0].k]++;}
const fr=keys.map(k=>win[k]/paths.length*100).sort((a,b)=>b-a);
const ratio=fr[0]/fr[fr.length-1];
ok(ratio<1.6,`egg reveal spread ${ratio.toFixed(2)}:1 (target under 1.6:1)`);
ok(keys.every(k=>win[k]>0),'every one of the 16 eggs can win');

/* ---------- 3. live DOM, played twice ---------- */
head('Runtime — two consecutive playthroughs');
const errs=[];
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'http://localhost/',
  beforeParse(w){w.confirm=()=>true;w.onerror=(...a)=>errs.push(a.join(' '));}});
const W=dom.window,D=W.document,$=s=>D.querySelector(s);
const click=e=>e.dispatchEvent(new W.MouseEvent('click',{bubbles:true}));
const pctNow=()=>parseInt($('#percent').textContent);

function play(tag){
  const seen=[];let guard=0;
  while(D.querySelectorAll('.choice').length&&guard++<20){
    seen.push(pctNow());
    click(D.querySelectorAll('.choice')[0]);
  }
  const mono=seen.every((v,i)=>i===0||v>=seen[i-1]);
  ok(mono,`${tag}: progress is monotonic (${seen.join(' → ')} → 100)`);
  ok(pctNow()===100,`${tag}: meter lands on exactly 100%`);
  ok(D.querySelectorAll('.eggcard').length===3,`${tag}: three eggs revealed`);
  ok($('#scores').classList.contains('hidden')===false,`${tag}: resonance panel unsealed`);
  return seen.length;
}
ok($('#scores').classList.contains('hidden'),'run 1: affinities sealed at start');
ok(!!$('.eggmini img'),'run 1: sidebar egg image present at start');
const n1=play('run 1');
ok($('.eggmini img').getAttribute('alt').includes('egg'),'run 1: sidebar shows the winning egg');

click($('#showJourney'));
ok(D.querySelectorAll('.review-row').length===n1,`journey review lists all ${n1} choices`);
click($('#backReveal'));
ok(D.querySelectorAll('.eggcard').length===3,'return to reveal works');

click($('#again'));
ok(!!$('.eggmini img'),'run 2: SIDEBAR EGG IMAGE RESTORED after restart');
ok($('#eggCardTitle').textContent==='It has not chosen a name.','run 2: sidebar copy reset');
ok($('#scores').classList.contains('hidden'),'run 2: affinities re-sealed');
ok(pctNow()===0,'run 2: meter reset to 0%');
ok($('.scene h2')!==null,'run 2: first scene rendered');
ok(D.querySelectorAll('.review-row').length===0,'run 2: previous journey cleared');
play('run 2');

head('Accessibility');
ok($('#play').getAttribute('aria-live')==='polite','play region is a live region');
ok($('#bar').getAttribute('role')==='progressbar','progress bar exposes role');
ok($('#bar').getAttribute('aria-valuenow')==='100','progress bar reports its value');
ok(!!D.querySelector('.skip'),'skip link present');
ok([...D.querySelectorAll('img')].every(i=>i.alt&&i.alt.length>3),'all images have alt text');
ok(D.querySelectorAll('h1').length===1,'exactly one h1');
const ids=[...D.querySelectorAll('[id]')].map(e=>e.id);
ok(new Set(ids).size===ids.length,'no duplicate element ids');

head('JS errors');
ok(errs.length===0,'no uncaught errors'+(errs.length?': '+errs:''));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
