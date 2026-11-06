const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'data/part3/field-guide.json'),'utf8'));
const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.GUIDE_BROWSER_PATH||undefined,headless:true});
 const results=[],test=(name,pass,detail)=>{results.push({name,pass,detail});if(!pass)console.log('FAIL',name,detail)};
 const cases=process.env.GUIDE_TEST_URL?[process.env.GUIDE_TEST_URL]:['index.html'];
 for(const name of cases){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=name.startsWith('https:')?name:pathToFileURL(path.join(root,'dist',name)).href;
  await page.goto(url+'#p3-mounts');
  await page.waitForFunction(()=>!!window.guide);
  test(name+': new mount shortcut opens part 3',await page.locator('#part3').isVisible()&&await page.locator('#p3-mounts').isVisible());
  test(name+': all four mounts have family game icons',await page.locator('.mount-card .mount-family-icon').count()===4);
  test(name+': all matching jobs have class icons',await page.locator('.mount-match .class-chip img').count()===8);
  await page.locator('#nav3 a[href="#p3-restoration"]').tap();
  test(name+': restoration and material totals',await page.locator('.restoration-card').count()===47&&await page.locator('.material-card').count()===55);
  const aurora=data.restoration.find(r=>r.place.includes('アウロラ')),feronia=data.restoration.find(r=>r.place.includes('フェロニア'));
  test(name+': larger disputed material counts render',await page.locator('#p3-'+aurora.id+' .material-count').innerText()==='×3'&&await page.locator('#p3-'+feronia.id+' .material-count').innerText()==='×5');
  await page.locator('#p3-resource-kind').selectOption('temple');
  test(name+': temple filter shows seven locations',await page.locator('.field-resource:visible').count()===7);
  await page.locator('#p3-resource-clear').click();await page.locator('#p3-resource-search').fill('아오긴지');
  test(name+': Korean resource search matches site and material',await page.locator('.restoration-card:visible').count()===1&&await page.locator('.material-card:visible').count()===1);
  await page.locator('#p3-resource-search').fill('ネイピア');
  test(name+': acquisition-place search works',await page.locator('.field-resource:visible').count()>1);
  await page.locator('#p3-resource-search').fill('no-such-material-xyz');
  test(name+': no-match message',await page.locator('#p3-resource-empty').isVisible()&&await page.locator('.field-resource:visible').count()===0);
  await page.locator('#p3-resource-clear').click();
  test(name+': reset restores all 102 entries',await page.locator('.field-resource:visible').count()===102);
  await page.locator('#nav3 a[href="#p3-teams"]').tap();
  for(const count of [2,3,4]){
   await page.locator(`[data-squad-count="${count}"]`).tap();
   const panel=page.locator(`[data-squad-plan="${count}"]`);
   test(name+': '+count+' squads switch and show leaders',await page.locator('.squad-plan:visible').count()===1&&await panel.locator('.squad-card').count()===count&&await panel.locator('.squad-leader').count()===count&&await panel.locator('.squad-members li').count()===count*8);
  }
  await page.locator('#p3-search').fill('클라프카');
  const leader=page.locator('[data-squad-plan="4"] .squad-card a').first();
  const target=await leader.getAttribute('href');
  await leader.tap();await page.waitForFunction(id=>{const el=document.querySelector(id);return !el.hidden&&el.open},target);
  test(name+': leader portrait opens filtered-out character',await page.locator(target).isVisible()&&await page.locator('#p3-search').inputValue()==='');
  await page.goto(url+'#p3-squads-4');
  test(name+': direct four-squad link selects panel',await page.locator('[data-squad-plan="4"]').isVisible()&&await page.locator('[data-squad-count="4"]').getAttribute('aria-pressed')==='true');
  const decoded=await page.evaluate(async()=>{const images=[...document.querySelectorAll('#p3-mounts img,#p3-restoration img,#p3-teams img,#p3-special .field-shot img')];let failed=[];await Promise.all(images.map(async i=>{i.loading='eager';try{await i.decode()}catch{failed.push(i.alt)}}));return{total:images.length,failed}});
  test(name+': all added images decode',decoded.failed.length===0,decoded);
  for(const width of [320,360,390,430,768]){
   await page.setViewportSize({width,height:844});
   const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   test(name+': new guide fits '+width+'px',dimensions.scroll<=dimensions.width,dimensions);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#nav3 a[href="#p3-mounts"]').tap();await page.locator('.mount-card').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'v1.3.0-mounts-'+(name.startsWith('https:')?'live':name.split('.')[0])+'.png')});
  await page.locator('#nav3 a[href="#p3-teams"]').tap();await page.locator('[data-squad-count="4"]').tap();await page.locator('[data-squad-plan="4"] .squad-card').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'v1.3.0-squads-'+(name.startsWith('https:')?'live':name.split('.')[0])+'.png')});
  test(name+': no JavaScript errors',errors.length===0,errors);
  await ctx.close();
 }
 if(!process.env.GUIDE_TEST_URL){const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const p=await nojs.newPage();await p.goto(pathToFileURL(path.join(root,'dist/index.html')).href+'#p3-teams');test('No-JS web guide exposes all three squad plans',await p.locator('.squad-plan:visible').count()===3);await nojs.close();}
 await browser.close();fs.writeFileSync(path.join(out,'field-guide-tests.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({tests:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass)}));if(results.some(x=>!x.pass))process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
