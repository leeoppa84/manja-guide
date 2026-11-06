const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'data/site.json'),'utf8')).version;
const names=JSON.parse(fs.readFileSync(path.join(root,'data/korean-names.json'),'utf8')).names;
const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.GUIDE_BROWSER_PATH||undefined,headless:true});
 const results=[],test=(name,pass,detail)=>{results.push({name,pass,detail});if(!pass)console.log('FAIL',name,detail)};
 const cases=process.env.GUIDE_TEST_URL?[process.env.GUIDE_TEST_URL]:['index.html'];
 for(const name of cases){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const url=name.startsWith('https:')?name:pathToFileURL(path.join(root,'dist',name)).href;
  await p.goto(url+'#p3-restoration');await p.waitForFunction(()=>!!window.guide);
  test(name+': current version',await p.locator('header small').innerText().then(t=>t.includes('v'+version)));
  const headings=await p.locator('.restoration-card h3').allInnerTexts();
  test(name+': all 47 place headings display Korean',headings.length===47&&headings.every(s=>/[가-힣]/.test(s)&&!/[ぁ-ヿ]/.test(s)));
  const materials=await p.locator('.material-card>summary').allInnerTexts();
  test(name+': all 55 material labels display Korean',materials.length===55&&materials.every(s=>/[가-힣]/.test(s)&&!/[ぁ-ヿ]/.test(s)));
  test(name+': originals hidden by default',await p.locator('#p3-restoration .ko-original:visible').count()===0);
  const checks=[['파란 긴지',2],['아오긴지',2],['アオギンジ',2]];
  for(const [query,count] of checks){await p.locator('#p3-resource-search').fill(query);test(name+': material search '+query,await p.locator('.field-resource:visible').count()===count)}
  for(const query of ['네이피어 숲','네이피아 숲','ネイピアの森']){await p.locator('#p3-resource-search').fill(query);test(name+': location search '+query,await p.locator('.field-resource:visible').count()>1)}
  await p.locator('#p3-resource-clear').click();
  await p.locator('#p3-original-names').check();test(name+': Japanese comparison switch',await p.locator('#p3-restoration .ko-original:visible').count()>100);
  await p.locator('#p3-original-names').uncheck();test(name+': comparison switch returns to Korean',await p.locator('#p3-restoration .ko-original:visible').count()===0);
  const pending=await p.locator('[data-name-ja="ミザンガ"]').first().innerText();
  test(name+': disputed ingredient stays visibly pending',pending.includes('미장가')&&pending.includes('한국판 표기 확인 중')&&names['ミザンガ'].status==='pending');
  test(name+': provisional place not promoted to confirmed',await p.locator('[data-name-ja="砂の抜け道"]').first().innerText().then(t=>t.includes('한국판 표기 확인 중'))&&names['砂の抜け道'].status==='pending');
  const acq=await p.locator('.acquisition').allInnerTexts();test(name+': acquisition prose displays Korean',acq.every(s=>!/[ぁ-ヿ]/.test(s)));
  await p.locator('#search').fill('아오긴지');test(name+': whole-guide search accepts old alias',await p.locator('#p3-restoration').isVisible());await p.locator('#guide-clear').click();
  for(const width of [320,390,768]){await p.setViewportSize({width,height:844});const fit=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);test(name+': Korean resource cards fit '+width+'px',fit)}
  await p.setViewportSize({width:390,height:844});await p.locator('#p3-resource-search').fill('파란 긴지');await p.locator('.restoration-card:visible').first().scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'v'+version+'-korean-'+(name.startsWith('https:')?'live':name.split('.')[0])+'.png')});
  test(name+': no JS errors',errors.length===0,errors);await ctx.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,process.env.GUIDE_TEST_URL?'korean-names-live-tests.json':'korean-names-tests.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({tests:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass)}));if(results.some(x=>!x.pass))process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
