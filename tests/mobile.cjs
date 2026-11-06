const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');const expectedVersion=JSON.parse(require('node:fs').readFileSync(path.join(root,'data/site.json'),'utf8')).version;const out=process.env.GUIDE_TEST_OUTPUT||path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.GUIDE_BROWSER_PATH||undefined,headless:true,args:['--disable-gpu']});
 const results=[];const test=(name,pass,detail)=>{results.push({name,pass,detail});if(!pass)console.log('FAIL',name,detail)};
 const url=name=>process.env.GUIDE_TEST_URL||'file:///'+path.resolve(name).replaceAll('\\','/');
 for(const build of ['index.html']){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url(path.join(root,'dist')+'/'+build));
  test(build+': initialized and correct version',await p.evaluate(()=>!!window.guide)&&await p.locator('header small').innerText().then(t=>t.includes('v'+expectedVersion)));
  test(build+': no download UI',await p.locator('[download],a[href*="offline.html"]').count()===0);
  test(build+': creator and blog links',await p.locator('header a[href="https://blog.naver.com/leeoppaoppa"]').count()===1&&await p.locator('header a[href="https://blog.naver.com/leeoppaoppa/224466296404"]').count()===1);
  test(build+': original first-part roster retained',await p.locator('#tier-board .static-unit').count()===50);
  await p.locator('#hero-search').fill('사도');await p.locator('#hero-search').press('Enter');
  test(build+': localized first-part class search',await p.locator('#find-count').innerText().then(t=>!t.includes('없음'))&&await p.locator('#tier-board details[open]').count()===1);
  await p.locator('#hero-search').fill('와테스');await p.locator('#hero-search').press('Enter');
  test(build+': legacy class search retained',await p.locator('#find-count').innerText().then(t=>!t.includes('없음')));
  await p.locator('[data-part-button="3"]').tap();
  test(build+': third part toggles by touch',await p.locator('#part3').isVisible()&&!await p.locator('#part1').isVisible());
  await p.locator('#nav3 a[href="#p3-atlas"]').tap();
  test(build+': 63 portraits with no placeholder',await p.locator('#p3-board>details>summary img').count()===63&&await p.locator('.no-portrait').count()===0);
  test(build+': fallback is clearly identified',await p.locator('#p3-u817240>summary img').count()===1&&await p.locator('#p3-u817240 .detail-panel').textContent().then(t=>t.includes('기본 컷 · 3부 외형 확인 중')));
  const iconCheck=await p.evaluate(()=>{const steps=[...document.querySelectorAll('.class-step')];return{steps:steps.length,missing:steps.filter(x=>!x.querySelector('.class-icon')||!x.style.getPropertyValue('--class-color')).length}});
  test(build+': every class step has an icon and color',iconCheck.steps>100&&iconCheck.missing===0,iconCheck);
  test(build+': sword and mage colors follow original icons',await p.evaluate(()=>{const colors=[...document.querySelectorAll('.class-step[data-class]')];const get=ja=>colors.find(x=>x.dataset.class===ja).style.getPropertyValue('--class-color');return get('ソードマスター')==='#784838'&&get('シドー')==='#783828'&&get('シャーマン')==='#583858'}));
  test(build+': recommendation tables include icons',await p.locator('#classes .class-chip img').count()>30);
  const images=await p.evaluate(async()=>{const imgs=[...document.images];imgs.forEach(i=>i.loading='eager');const failed=[];await Promise.all(imgs.map(async i=>{try{await i.decode()}catch{failed.push(i.alt)}}));return{count:imgs.length,failed}});
  test(build+': all portraits and class icons decode',!images.failed.length,images);
  test(build+': editorial status reports removed from guide body',await p.evaluate(()=>!(/이전 답변|앞선 답변|첨부 화면|이번 검토|보존했습니다|유지했습니다|별도 컷 없음|복흥/.test(document.querySelector('main').textContent))));
  await p.locator('#p3-search').fill('소드 마스터');
  test(build+': third-part localized class search',await p.locator('.p3-unit:visible').count()>0);
  await p.locator('#p3-clear').click();
  await p.locator('#search').fill('포획');
  test(build+': guide search hides unrelated map section',!await p.locator('#p3-map').isVisible());
  await p.locator('#nav3 a[href="#p3-map"]').tap();
  await p.waitForFunction(()=>document.querySelector('#search').value==='');
  test(build+': shortcut reveals a search-hidden section',await p.locator('#p3-map').isVisible());
  await p.locator('#search').fill('포획');await p.locator('#nav3 a[href="#p3-map"]').tap();
  test(build+': repeating same shortcut works',await p.locator('#search').inputValue()===''&&await p.locator('#p3-map').isVisible());
  await p.locator('#nav3 a[href="#p3-check"]').tap();await p.locator('#p3-tasks input').first().check();await p.reload();
  test(build+': third checklist saved',await p.locator('#p3-tasks input').first().isChecked());
  await p.locator('[data-part-button="1"]').tap();
  test(build+': checklist remains separate',!await p.locator('#tasks input').first().isChecked());
  for(const width of [320,360,390,430,768]){
   await p.setViewportSize({width,height:844});
   for(const part of ['1','3']){
    await p.locator(`[data-part-button="${part}"]`).tap();
    const id=part==='1'?'#hero-all__u816415':'#p3-u816415';
    if(await p.locator(id).getAttribute('open')===null)await p.locator(id+'>summary').click();
    const size=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    test(`${build}: open class cards fit ${width}px part ${part}`,size.scroll<=size.width,size);
   }
  }
  await p.setViewportSize({width:390,height:844});
  await p.locator('[data-part-button="3"]').tap();
  await p.locator('#p3-u816415 .class-path').scrollIntoViewIfNeeded();
  await p.screenshot({path:out+'/v'+expectedVersion+'-'+build.split('.')[0]+'-classes.png'});
  await p.locator('#nav3 a[href="#p3-atlas"]').tap();await p.locator('#p3-search').fill('클라프카');
  await p.locator('#p3-u817240>summary').tap();await p.locator('#p3-u817240').scrollIntoViewIfNeeded();
  await p.screenshot({path:out+'/v'+expectedVersion+'-'+build.split('.')[0]+'-portrait.png'});
  await p.goto(url(path.join(root,'dist')+'/'+build)+'#p3-u816440');
  test(build+': direct character link opens correct part',await p.locator('#part3').isVisible()&&await p.locator('#p3-u816440').getAttribute('open')!==null);
  await p.goto(url(path.join(root,'dist')+'/'+build)+'#%FF');
  test(build+': malformed hash does not break startup',await p.evaluate(()=>!!window.guide));
  test(build+': no JS errors',errors.length===0,errors);
  await ctx.close();
 }
 const ctx=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();await p.goto(url(path.join(root,'dist/index.html')));await p.locator('[data-part-button="3"]').tap();test('No-JS tab falls back to native anchor',await p.evaluate(()=>location.hash==='#part3')&&await p.locator('#part3').isVisible());
 await browser.close();fs.writeFileSync(path.join(out,'mobile-tests.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({tests:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass)}));if(results.some(r=>!r.pass))process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
