import {readFile} from 'node:fs/promises';
import path from 'node:path';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export async function loadKoreanNames(root){
 const {names}=JSON.parse(await readFile(path.join(root,'data/korean-names.json'),'utf8'));
 for(const [ja,n] of Object.entries(names)){
  if(!n.ko||!['game-capture-reference','player-record','pending'].includes(n.status)||!n.source?.startsWith('https://')||!Array.isArray(n.aliases))throw Error(`Invalid Korean name evidence: ${ja}`);
 }
 const find=ja=>{if(!names[ja])throw Error(`Korean name mapping missing: ${ja}`);return names[ja]};
 const nameHtml=ja=>{const n=find(ja);return `<span class="localized-name" data-name-status="${n.status}" data-name-ja="${esc(ja)}" title="${esc(ja+(n.note?' · '+n.note:''))}">${esc(n.ko)}${n.status==='pending'?'<small class="name-status">한국판 표기 확인 중</small>':''}<span class="ko-original" lang="ja">${esc(ja)}</span></span>`};
 const placeHtml=raw=>raw.split(' / ').map(s=>s.endsWith('の市場')?nameHtml(s.slice(0,-3))+' 시장':nameHtml(s)).join(' / ');
 const searchName=raw=>raw.split(' / ').map(s=>{const market=s.endsWith('の市場'),ja=market?s.slice(0,-3):s,n=find(ja);return[raw,n.ko,...n.aliases,market?n.ko+' 시장':''].join(' ')}).join(' ');
 return {names,find,nameHtml,placeHtml,searchName};
}
