const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),site=JSON.parse(fs.readFileSync(path.join(root,'data/site.json'),'utf8'));
const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
(async()=>{
 let server,browser;const results=[],test=(name,pass,detail)=>{results.push({name,pass,detail});if(!pass)console.log('FAIL',name,detail)};
 try{
  let url=process.env.GUIDE_TEST_URL;
  if(!url){
   server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(dist,pathname==='/'?'index.html':pathname.slice(1));if(!file.startsWith(dist+path.sep))throw Error('invalid path');const body=await fsp.readFile(file);const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.woff':'font/woff'};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}});
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/';
  }
  browser=await chromium.launch({executablePath:process.env.GUIDE_BROWSER_PATH||undefined,headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(url+'#part3');await page.waitForFunction(()=>!!window.guide);
  test('Public web guide returns HTTP 200',response.status()===200);
  test('No download controls or legacy links',await page.locator('[download],a[href*="offline.html"]').count()===0);
  test('Header shows creator and blog',await page.locator('header .creator-link').innerText().then(t=>t.includes(site.creatorName))&&await page.locator('header .creator-link').getAttribute('href')===site.authorBlogUrl);
  test('Footer shows creator and blog',await page.locator('footer .creator-link').innerText().then(t=>t.includes(site.creatorName))&&await page.locator('footer .creator-link').getAttribute('href')===site.authorBlogUrl);
  test('Canonical original guide link retained',await page.locator('footer .guide-original').getAttribute('href')===site.guideUrl);
  test('Version and date retained',await page.locator('header small').innerText().then(t=>t.includes('v'+site.version)&&t.includes(site.updatedAt)));
  test('Author metadata populated',await page.locator('meta[name="author"]').getAttribute('content')===site.creatorName);
  const infoResponse=await context.request.get(new URL('build-info.json',url).href),info=await infoResponse.json();
  test('Deployed metadata is web-only',info.version===site.version&&info.distribution==='web-only'&&info.downloadsEnabled===false&&!('offlineBytes' in info));
  for(const suffix of ['offline.html','offline.html?v=1.3.1']){const r=await context.request.get(new URL(suffix,url).href);test('Old download returns 404: '+suffix,r.status()===404,{status:r.status()})}
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});test('Attribution layout fits '+width+'px',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'v'+site.version+'-web-only-'+(process.env.GUIDE_TEST_URL?'live':'local')+'.png')});
  test('No JavaScript errors',errors.length===0,errors);
 }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve))}
 fs.writeFileSync(path.join(out,process.env.GUIDE_TEST_URL?'publication-live-tests.json':'publication-tests.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({tests:results.length,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass)}));if(results.some(x=>!x.pass))process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
