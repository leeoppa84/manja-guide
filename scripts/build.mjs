import {readFile,writeFile,mkdir,cp,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');
const json=async p=>JSON.parse(await read(p));
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const text=s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const [site,first,third,sourceGroups,changes,order1,order3,classes]=await Promise.all(['data/site.json','data/part1/characters.json','data/part3/characters.json','data/sources.json','data/changelog.json','data/part1/sections.json','data/part3/sections.json','data/classes.json'].map(json));
function assert(ok,message){if(!ok)throw Error(message)}
assert(datePattern.test(site.updatedAt),'site.updatedAt must be YYYY-MM-DD');
assert(typeof site.version==='string'&&site.version.length>0,'Site version required');
const sourceIds=new Set(sourceGroups.flatMap(g=>g.items.map(s=>s.id)));
const hashes={1:new Set(),3:new Set()};
const firstPortraits=new Map(first.map(c=>[c.id,c.portrait]));
for(const [part,characters] of [[1,first],[3,third]]){
 const ids=new Set();
 for(const c of characters){
  assert(/^\d+$/.test(c.id),'Invalid character ID');assert(c.part===part,`Wrong part on ${c.id}`);assert(!ids.has(c.id),`Duplicate character ${part}/${c.id}`);ids.add(c.id);
  for(const key of ['id','name','ja','updatedAt','verification'])assert(typeof c[key]==='string'&&c[key].trim(),`${part}/${c.id}: ${key} required`);
  assert(datePattern.test(c.updatedAt),`${c.name}: invalid updatedAt`);
  assert(Array.isArray(c.observations),`${c.name}: observations must be an array`);
  for(const n of c.observations){assert(datePattern.test(n.date)&&typeof n.text==='string'&&n.text.trim(),`${c.name}: observation date/text required`);assert(['personal','confirmed','pending'].includes(n.status),`${c.name}: observation status must be personal/confirmed/pending`)}
  if(part===3){
   for(const key of ['role','sourceRank','evaluation','setup','mapTip','identityStatus'])assert(typeof c[key]==='string'&&c[key].trim(),`${c.name}: ${key} required`);
   assert(['SS','S','A','B','C','D','미확인'].includes(c.sourceRank),`${c.name}: invalid sourceRank`);
   assert(typeof c.portrait==='string'&&c.portrait,`${c.name}: portrait required`);
   assert(c.jobs?.length>0,`${c.name}: at least one job candidate required`);
   for(const job of c.jobs)for(const key of ['stage','name','ja','requirements'])assert(typeof job[key]==='string'&&job[key].trim(),`${c.name}: job ${key} required`);
   for(const ref of c.sources??[])assert(sourceIds.has(ref),`${c.name}: unknown source ${ref}`);
  }
  if(c.portrait){
   const unchanged=part===3&&c.portraitKind==='unchanged';
   if(part===3&&c.portraitKind==='base-fallback')assert(c.identityStatus.includes('3부 전용 이미지 미확인')&&/^https:\/\/img\.game8\.jp\//.test(c.portraitSource||''),`${c.name}: base portrait evidence required`);
   if(unchanged){
    assert(c.identityStatus.includes('외형 불변 목록')&&/^https:\/\/img\.game8\.jp\//.test(c.portraitSource||''),`${c.name}: unchanged portrait evidence required`);
    if(c.portrait.startsWith('assets/part1/'))assert(c.portrait===firstPortraits.get(c.id),`${c.name}: reused portrait must match the same character`);
    else assert(c.portrait.startsWith('assets/part3/'),`${c.name}: cross-part portrait path`);
   }else assert(c.portrait.startsWith(`assets/part${part}/`),`${c.name}: cross-part portrait path`);
   const absolute=path.resolve(root,c.portrait);assert(absolute.startsWith(root+path.sep),`${c.name}: unsafe asset path`);
   const b=await readFile(absolute),hash=createHash('sha256').update(b).digest('hex');
   if(part===3&&!unchanged)assert(!hashes[1].has(hash),`${c.name}: changed portrait cannot reuse a first-part image`);
   hashes[part].add(hash);
  }
 }
}
for(const g of sourceGroups)for(const ref of g.items){assert(/^https:\/\//.test(ref.url),`HTTPS source required: ${ref.id}`);assert(ref.status,'Source status required')}
for(const log of changes)assert(log.version&&datePattern.test(log.date)&&Array.isArray(log.changes),'Invalid changelog entry');
const observationHtml=c=>c.observations.length?'<h4>플레이 관찰 기록</h4>'+c.observations.map(n=>`<div class="observation"><span class="pill">${esc(n.date)} · ${esc(n.chapter||'진행 구간 미기재')} · ${esc(n.difficulty||'난이도 미기재')} · ${esc(({personal:'개인 플레이 기록',confirmed:'확인됨',pending:'추가 확인 필요'})[n.status])}</span><p>${esc(n.text)}</p></div>`).join(''):'';
const byId=new Map(first.map(c=>[c.id,c]));
const classByJa=new Map(classes.map(c=>[c.ja,c]));
assert(classByJa.size===classes.length,'Duplicate class icon names');
const classByName=new Map(classes.flatMap(c=>(c.aliases||[]).map(name=>[name,c])));
for(const c of classes){
 assert(/^assets\/jobs\/class-\d+\.webp$/.test(c.path)&&/^#[0-9a-f]{6}$/.test(c.color)&&/^#[0-9a-f]{6}$/.test(c.surface),`Invalid class icon: ${c.ja}`);
 await stat(path.join(root,c.path));
}
function classStyle(c){return `--class-color:${c.color};--class-surface:${c.surface}`}
const classLabel=(name,ja)=>ja==='シドー'?'사도':ja==='ウァテス'?'바테스':name;
function classTitle(name,ja){const c=classByJa.get(ja);assert(c,`Class icon missing: ${ja}`);const label=classLabel(name,ja);return `<span class="class-title"><img class="class-icon" src="${esc(c.path)}" alt="${esc(label)} 병과 아이콘" width="40" height="40" loading="lazy"><b>${esc(label)}</b></span>`}
function decorateClassSteps(html){return html.replace(/<div class="class-step">([\s\S]*?)<\/div>/g,(full,body)=>{
 const ja=body.match(/<span class="ja">([^<]+)<\/span>/)?.[1],name=body.match(/<b>([^<]+)<\/b>/)?.[1];
 assert(ja&&name, 'Class step is missing its name');const c=classByJa.get(ja);assert(c,`Class icon missing: ${ja}`);
 return `<div class="class-step" data-class="${esc(ja)}" style="${classStyle(c)}">${body.replace(/<b>[^<]+<\/b>/,()=>classTitle(name,ja))}</div>`;
})}
function decorateClassCells(html){return html.replace(/<td>([^<>]+)<\/td>/g,(full,body)=>{
 const parts=body.split(/( \/ )/);let found=false;
 const result=parts.map(name=>{const c=classByName.get(name);if(!c)return name;found=true;const label=classLabel(name,c.ja);return `<span class="class-chip" style="${classStyle(c)}"><img class="class-icon" src="${esc(c.path)}" width="28" height="28" alt="${esc(label)} 병과 아이콘" loading="lazy">${esc(label)}</span>`}).join('');
 return found?`<td>${result}</td>`:full;
})}
function renderFirst(id,scope){const c=byId.get(id);assert(c,`Unknown first-part character ${id}`);assert(/^[a-z0-9]+$/.test(scope),'Invalid roster scope');let detail=c.detailHtml.replaceAll('detail-all__','detail-'+scope+'__').replaceAll('hero-all__','hero-'+scope+'__');const updated=`<p class="muted character-updated">수정 ${esc(c.updatedAt)}</p>${observationHtml(c)}`;detail=decorateClassSteps(detail.replace('</h3>',()=>'</h3>'+updated));const search=text(c.summaryHtml+' '+detail+' '+c.ja+' '+(c.searchAliases||[]).join(' ')+' '+classes.filter(j=>c.detailHtml.includes(j.ja)).flatMap(j=>j.aliases).join(' ')).toLocaleLowerCase();return `<details class="static-unit" id="hero-${scope}__u${id}" data-first-tier="${esc(c.tier)}" data-hero-key="u${id}" data-scope="${scope}" data-search="${esc(search)}">${c.summaryHtml}${detail}</details>`}
function renderThird(c){
 const fallback=c.portraitKind==='base-fallback';
 const portraitLabel=fallback?'기본 초상화':c.portraitKind==='unchanged'?'기본 초상화':'3부 초상화';
 const portrait=`<img src="${esc(c.portrait)}" alt="${esc(c.name)} · ${portraitLabel}" width="100" height="100" loading="lazy">`;
 const search=[c.name,c.ja,c.role,...(c.searchAliases||[]),...c.jobs.flatMap(j=>[j.name,j.ja,...(classByJa.get(j.ja)?.aliases||[])])].join(' ').toLocaleLowerCase();
 const notes=[fallback?'기본 컷 · 3부 외형 확인 중':'',c.identityStatus.includes('한국판 공식 표기 미확인')||c.identityStatus.includes('한국판 표기 미확인')?'이름 표기 확인 중':''].filter(Boolean);
 return `<details class="static-unit p3-unit" id="p3-u${c.id}" data-role="${esc(c.role)}" data-rank="${esc(c.sourceRank)}" data-core="${!!c.core}" data-search="${esc(search)}"><summary class="unit-tile"><span class="portrait-frame">${portrait}</span><span class="u-name">${esc(c.name)}</span><span class="native-close-hint">다시 누르면 접힘</span></summary><div class="detail-panel"><div class="unit-head"><div><h3>${esc(c.name)}</h3><span class="unit-ja">${esc(c.ja.split(' · ')[0])}</span></div></div><div class="unit-badges"><span>3부 · ${esc(c.role)}</span><span>${c.core?'핵심 후보':'역할별 후보'}</span><span>종합 평가 ${esc(c.sourceRank)}</span></div>${notes.length?`<p class="muted">${notes.map(esc).join(' · ')}</p>`:''}<h4>평가와 역할</h4><p>${esc(c.evaluation)}</p><h4>추천 병과와 전직 조건</h4><div class="class-path">${c.jobs.map(j=>`<div class="class-step"><span class="step-kind">${esc(j.stage)}</span><b>${esc(j.name)}</b><span class="ja">${esc(j.ja)}</span><p class="req">${esc(j.requirements)}</p></div>`).join('')}</div><p class="muted">신장직은 요구 기술 외에 해금 조건과 전용 증표도 필요합니다.</p><h4>장비·세팅</h4><p>${esc(c.setup)}</p><h4>전투·원정 운용</h4><p>${esc(c.mapTip)}</p>${observationHtml(c)}</div></details>`
}
async function renderSections(order,part){let output='';for(const file of order){assert(file.startsWith(`content/part${part}/`)&&!file.includes('..'),'Content path crosses parts');output+=await read(file)+'\n'}return output.replace(/<!--UNIT1:(\d+):([a-z0-9]+)-->/g,(_,id,scope)=>renderFirst(id,scope)).replace('<!--CHARACTERS3-->',()=>third.map(renderThird).join('\n'))}
const sourceHtml=(await read('content/sources.html')).replace(/<!--SOURCES:(\d+)-->/g,(_,i)=>'<ul>'+sourceGroups[Number(i)].items.map(ref=>`<li><a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.label)}</a>${ref.lastChecked?` <small>확인 ${esc(ref.lastChecked)}</small>`:''}</li>`).join('')+'</ul>');
const changelog=`<section id="updates"><h2>업데이트 기록</h2><p class="muted">현재 버전 ${esc(site.version)} · 수정 ${esc(site.updatedAt)}${site.gameVersion?' · 게임 '+esc(site.gameVersion):''}</p>${changes.map(c=>`<details><summary>${esc(c.date)} · v${esc(c.version)} · ${esc(c.part)}</summary><div><ul>${c.changes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></details>`).join('')}</section>`;
const [partOne,partThree]=await Promise.all([renderSections(order1,1),renderSections(order3,3)]);
let output=(await read('content/template.html')).replace(/<title>[^<]*<\/title>/,`<title>${esc(site.title)}</title>`).replaceAll('{{ASSET_VERSION}}',encodeURIComponent(site.version)).replace('{{UPDATED_LABEL}}',`v${esc(site.version)} · 수정 ${esc(site.updatedAt)}`).replace('<!--PART1-->',()=>partOne).replace('<!--PART3-->',()=>partThree).replace('<!--BIBLIOGRAPHY-->',()=>sourceHtml).replace('<!--CHANGELOG-->',()=>changelog);
output=decorateClassCells(decorateClassSteps(output));
assert(!/<!--(?:UNIT1|CHARACTERS3|PART[13]|SOURCES|BIBLIOGRAPHY|CHANGELOG)/.test(output),'Unrendered source placeholder');
const ids=[...output.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert(ids.length===new Set(ids).size,'Duplicate output IDs');
for(const m of output.matchAll(/href="#([^"]+)"/g))assert(ids.includes(m[1]),`Missing anchor target ${m[1]}`);
const dist=path.join(root,'dist');await mkdir(dist,{recursive:true});await cp(path.join(root,'assets'),path.join(dist,'assets'),{recursive:true});await writeFile(path.join(dist,'index.html'),output);await writeFile(path.join(dist,'.nojekyll'),'');
let css=await read('assets/shared/guide.css');const js=await read('assets/shared/guide.js');
for(const m of [...css.matchAll(/url\((\.\.\/shared\/[^)]+)\)/g)]){const file='assets/shared/'+path.basename(m[1]);const b=await readFile(path.join(root,file));css=css.replaceAll(m[1],'data:font/woff;base64,'+b.toString('base64'))}
// Callback replacements preserve literal $$ and other replacement-pattern characters in source code.
new Script(js,{filename:'guide.js'});
let offline=output.replace(/<link[^>]*href="assets\/shared\/guide.css(?:\?[^\"]*)?"[^>]*>/,()=>'<style>'+css+'</style>').replace(/<script[^>]*src="assets\/shared\/guide.js(?:\?[^\"]*)?"[^>]*><\/script>/,()=>'<script>'+js+'</script>');
const inlineScript=offline.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(inlineScript===js,'Offline JavaScript differs from source');
new Script(inlineScript,{filename:'offline.html'});
offline=offline.replace(/<a download="manja_guide_v[^"]+\.html" href="offline\.html\?v=[^"]+">[^<]*<\/a>/,'<span>오프라인 저장본</span>');
const assets=[...new Set([...offline.matchAll(/src="(assets\/(?:part[13]|jobs)\/[^\"]+)"/g)].map(m=>m[1]))];
for(const file of assets){const b=await readFile(path.join(root,file));const ext=path.extname(file).slice(1);offline=offline.replaceAll('src="'+file+'"','src="data:image/'+(ext==='jpg'?'jpeg':ext)+';base64,'+b.toString('base64')+'"')}
await writeFile(path.join(dist,'offline.html'),offline);
await writeFile(path.join(dist,'build-info.json'),JSON.stringify({version:site.version,updatedAt:site.updatedAt,part1:first.length,part3:third.length,thirdPortraits:third.filter(c=>c.portrait).length,indexBytes:Buffer.byteLength(output),offlineBytes:Buffer.byteLength(offline)},null,2));
console.log(JSON.stringify({validation:'passed',version:site.version,part1:first.length,part3:third.length,thirdPortraits:third.filter(c=>c.portrait).length,indexBytes:Buffer.byteLength(output),offlineBytes:Buffer.byteLength(offline)}));
