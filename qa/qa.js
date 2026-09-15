/* Pocket Dragons QA harness.  Node 18+, `npm i jsdom`.  Run: node qa.js */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const DIR=process.argv[2]||path.join(__dirname,'..');
const HTML=fs.readFileSync(path.join(DIR,'index.html'),'utf8');
let pass=0,fail=0;const warnings=[];
const CI=!!process.env.GITHUB_ACTIONS;
const ok=(c,m)=>{
  if(c){pass++;console.log('  PASS  '+m);}
  else{fail++;console.log('  FAIL  '+m);if(CI)console.log('::error::'+m);}
};
// Hygiene, not correctness. Reported loudly, but it does not break the build.
// A stale file left in the repo is not the same as the page being wrong.
const warn=(c,m)=>{
  if(c){pass++;console.log('  PASS  '+m);}
  else{warnings.push(m);console.log('  WARN  '+m);if(CI)console.log('::warning::'+m);}
};
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
ok(/const AMP = 1\.5/.test(js),'climax amplifier present');
ok(/const families = \{/.test(js),'climax family map present');

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
for(const k of keys){
  const base=types[k].img.replace(/\.[a-z0-9]+$/i,'');
  ok(base.toLowerCase()===types[k].name.toLowerCase(),
     `display name matches asset filename: ${types[k].name} <-> ${types[k].img}`);
  ok(k.toLowerCase()===types[k].name.toLowerCase(),
     `type key matches display name: ${k} <-> ${types[k].name}`);
}
const stubHTML=fs.existsSync(path.join(DIR,'r'))
  ? fs.readdirSync(path.join(DIR,'r')).filter(f=>f.endsWith('.html'))
      .map(f=>fs.readFileSync(path.join(DIR,'r',f),'utf8')).join('\n')
  : '';
const allText=HTML+'\n'+stubHTML;
const onDisk=[...fs.readdirSync(DIR).filter(f=>/\.(webp|png|jpg|mp4)$/i.test(f)),
  ...(fs.existsSync(path.join(DIR,'r'))?fs.readdirSync(path.join(DIR,'r'))
      .filter(f=>/\.(webp|png|jpg|mp4)$/i.test(f)).map(f=>'r/'+f):[])];
const orphan=onDisk.filter(f=>!assets.has(f)&&!allText.includes(f.split('/').pop()));
warn(!orphan.length, orphan.length
  ? `${orphan.length} unreferenced media file(s) still in the repo. Delete them to shrink the deploy: ${orphan.join(', ')}`
  : 'no unreferenced media in deploy');

/* ---------- 2. every path ---------- */
head('Path enumeration and scoring model');
const famFor=label=>{const l=label.toLowerCase();
  for(const k of Object.keys(globalThis.families||{})) if(l.includes(k.toLowerCase())) return globalThis.families[k];
  return null;};
(0,eval)(js.match(/const families = \{[\s\S]*?\n\};/)[0].replace('const families =','globalThis.families ='));
const paths=[];
(function w(n,acc,sco){for(const c of scenes[n].choices){
  const s2={...sco};
  const fam=(n==='feeling'||n==='final')?famFor(c[0]):null;
  if(fam) for(const t of fam) s2[t]=(s2[t]||0)*1.5;
  for(const[k,v]of Object.entries(c[2])) s2[k]=(s2[k]||0)+v;
  if(c[3]==='reveal'){paths.push({len:acc.length+1,s:s2});continue;}
  w(c[3],acc.concat(n),s2);}})('start',[],{});
const lens=paths.map(p=>p.len);
ok(paths.length>0,`${paths.length} complete paths, all reaching the reveal`);
ok(Math.min(...lens)>=5&&Math.max(...lens)<=8,`path length bounded ${Math.min(...lens)}-${Math.max(...lens)}`);

const win={};keys.forEach(k=>win[k]=0);let ties=0,gapSum=0;
for(const p of paths){
  const r=keys.map(k=>({k,v:p.s[k]||0})).sort((a,b)=>b.v-a.v||a.k.localeCompare(b.k));
  win[r[0].k]++; gapSum+=r[0].v-r[1].v; if(r[0].v===r[1].v) ties++;
}
const tieRate=ties/paths.length*100, avgGap=gapSum/paths.length;
ok(tieRate<10,`exact #1/#2 ties ${tieRate.toFixed(1)}% (was 28.2% before the amplifier)`);
ok(avgGap>2.5,`average winning margin ${avgGap.toFixed(2)} points (was 1.26)`);
const fr=keys.map(k=>win[k]/paths.length*100).sort((a,b)=>b-a);
ok(fr[0]/fr[15]<1.7,`egg reveal spread ${(fr[0]/fr[15]).toFixed(2)}:1`);
ok(keys.every(k=>win[k]>0),'every one of the 16 eggs can win');

// every egg must be amplifiable in BOTH climax scenes, or it is structurally handicapped
const feelFams=['Delight','Anger','Longing','Calm'].flatMap(f=>globalThis.families[f]);
const finFams=['curiosity','connection','freedom','stillness'].flatMap(f=>globalThis.families[f]);
ok(keys.every(k=>feelFams.includes(k)),'every egg can be amplified by a feeling choice');
ok(keys.every(k=>finFams.includes(k)),'every egg can be amplified by a final choice');

/* ---------- 3. live DOM, played twice ---------- */
head('Runtime: two consecutive playthroughs');
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

// attribution identity: per-choice contributions must sum to the ranking score
{
  const H=W.eval('history'), R=W.eval('ranking()');
  let worst=0;
  for(const r of R){
    let sum=0; for(const h of H) sum+=(h.gave[r.k]||0);
    worst=Math.max(worst,Math.abs(sum-r.v));
  }
  ok(worst<1e-9,`attribution is exact (max deviation ${worst})`);
  ok(D.querySelectorAll('.trace-row').length>=1,'reveal shows which choices built the egg');
  ok(!!$('.why h3'),'reveal has a "Why <egg>" section');
  const blends=[...D.querySelectorAll('.pct')].map(e=>parseInt(e.textContent));
  ok(blends.reduce((a,b)=>a+b,0)===100,`top-three figures sum to exactly 100 (${blends.join('+')})`);
  ok(D.querySelectorAll('#scores .score').length===16,'sidebar shows all 16 eggs, not just six');
}

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

head('Sharing and attribution');
{
  const a=$('.share');
  ok(!!a,'reveal has a share button');
  ok(a && /^https:\/\/x\.com\/intent\/post\?/.test(a.href),'share targets the X post intent');
  ok(a && a.target==='_blank' && /noopener/.test(a.rel),'share opens safely in a new tab');
  if(a){
    const u=new URL(a.href);
    const text=u.searchParams.get('text')||'';
    ok(text.length>0 && text.length<=240,`tweet text fits (${text.length} chars)`);
    // http is legitimate here: the harness serves over localhost. What matters is
    // that the link is absolute, not that it is TLS in a test rig.
    const back=u.searchParams.get('url')||'';
    ok(/^https?:\/\/[^/]+/.test(back),'share carries an absolute link back to the site ('+back+')');
  }
  const off=$('.official a');
  ok(!!off,'reveal links to the official site');
  ok(off && /^https:\/\/pocketdragons\.io/.test(off.href),'official link points at pocketdragons.io');
  ok(off && off.target==='_blank' && /noopener/.test(off.rel),'official link opens safely');
  ok(!!$('.rights'),'image rights notice present');
  ok($('.rights').textContent.includes('PocketDragons.io'),'rights notice credits PocketDragons.io');
}
// link-preview tags are read from static HTML by the crawler, so they must be absolute
{
  const meta=k=>{const m=D.querySelector('meta[property="'+k+'"], meta[name="'+k+'"]');return m?m.content:'';};
  for(const k of ['og:title','og:description','og:url','og:image','twitter:card','twitter:image'])
    ok(!!meta(k),'link-preview tag present: '+k);
  ok(/^https:\/\//.test(meta('og:image')),'og:image is an absolute URL (relative ones do not render on X)');
  ok(/^https:\/\//.test(meta('og:url')),'og:url is an absolute URL');
  ok(meta('twitter:card')==='summary_large_image','card type renders the large image');
  const host=u=>{try{return new URL(u).origin}catch(e){return null}};
  ok(host(meta('og:image'))===host(meta('og:url')),'og:image and og:url share one origin');
  const img=meta('og:image').split('/').pop();
  ok(fs.existsSync(path.join(DIR,img)),'share card image exists in the deploy: '+img);
}

head('Per-result share stubs');
{
  const dir=path.join(DIR,'r');
  ok(fs.existsSync(dir),'/r/ share-stub directory exists');
  if(fs.existsSync(dir)){
    let missing=[],badImg=[],noRedirect=[];
    for(const k of keys){
      const slug=types[k].name.toLowerCase().replace(/[^a-z0-9]/g,'');
      const page=path.join(dir,slug+'.html'), card=path.join(dir,'card-'+slug+'.jpg');
      if(!fs.existsSync(page)||!fs.existsSync(card)){missing.push(slug);continue;}
      const h=fs.readFileSync(page,'utf8');
      const m=h.match(/property="og:image" content="([^"]+)"/);
      if(!m||!m[1].endsWith('/r/card-'+slug+'.jpg')||!/^https:\/\//.test(m[1])) badImg.push(slug);
      if(!/location\.replace|http-equiv="refresh"/.test(h)) noRedirect.push(slug);
    }
    ok(!missing.length,'every egg has a stub page and a card'+(missing.length?': missing '+missing:''));
    ok(!badImg.length,'every stub points at its own absolute card image'+(badImg.length?': '+badImg:''));
    ok(!noRedirect.length,'every stub sends a human on to the game'+(noRedirect.length?': '+noRedirect:''));
    const origins=new Set();
    for(const k of keys){
      const slug=types[k].name.toLowerCase().replace(/[^a-z0-9]/g,'');
      const f=path.join(dir,slug+'.html');
      if(!fs.existsSync(f))continue;
      const m=fs.readFileSync(f,'utf8').match(/property="og:image" content="(https:\/\/[^/]+)/);
      if(m)origins.add(m[1]);
    }
    const rootOrigin=(HTML.match(/property="og:image" content="(https:\/\/[^/]+)/)||[])[1];
    ok(origins.size===1&&[...origins][0]===rootOrigin,
      'stub cards and the home page agree on one origin'+(origins.size!==1?': '+[...origins]:''));
  }
}
// the share button must point at the stub for the egg actually shown
{
  const egg=$('.eggcard b').textContent.replace(/^\d+\.\s*/,'');
  const slug=egg.toLowerCase().replace(/[^a-z0-9]/g,'');
  const u=new URL($('.share').href).searchParams.get('url')||'';
  ok(u.endsWith('/r/'+slug+'.html'),`share links to this result's stub (${egg} -> ${u.split('/').pop()})`);
  ok(!!$('#shareSlot .share'),'share button sits in the sidebar');
}

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

console.log(`\n${pass} passed, ${fail} failed, ${warnings.length} warning(s)`);
if(warnings.length){
  console.log('\nWarnings (these do NOT fail the build):');
  warnings.forEach(w=>console.log('  · '+w));
}
if(fail) console.log('\nThe page itself is broken. Fix before deploying.');
process.exit(fail?1:0);
