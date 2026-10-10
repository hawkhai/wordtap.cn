// Optional browser acceptance runner; normal builds do not require Playwright.
import path from 'node:path';
const { chromium } = await import(process.env.WORDTAP_PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.WORDTAP_TEST_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const output = process.env.WORDTAP_TEST_OUTPUT || 'tmp/web-sync';
fs.mkdirSync(output, {recursive:true});
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: process.env.WORDTAP_CHROMIUM_EXECUTABLE, headless: true });
let activePage;
try {
 const context = await browser.newContext();
 await context.addInitScript(() => {
  const NativeWebSocket = window.WebSocket;
  window.WebSocket = class extends NativeWebSocket {
   constructor(url, protocols) {
    super(url, protocols);
    if(protocols === 'vite-hmr') window.__wordtapHmrSocket = this;
   }
  };
 });
 const page = await context.newPage();
 activePage = page;
 const pageErrors = [];
 page.on('pageerror', error => pageErrors.push(error.stack));
 await page.goto(base+'/tools/learning-data.browser.html');
 await page.locator('#run').click();
 await page.waitForFunction(() => ['passed','failed'].includes(document.body.dataset.result), null, {timeout:30000});
 const migration = await page.locator('#result').innerText(); console.log(migration);
 if (await page.locator('body').getAttribute('data-result') !== 'passed') throw new Error('Migration failed');
 for (const width of [1440,390,360,767,768,769]) {
  await page.setViewportSize({width,height:900});
  await page.goto(base+'/'); await page.waitForTimeout(1200);
  const layout = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth, body:document.body.scrollWidth, settings:[...document.querySelectorAll('details')].map(x=>({open:x.open, text:x.querySelector('summary')?.textContent}))}));
  console.log('LAYOUT',JSON.stringify(layout));
  if (Math.max(layout.scroll,layout.body)>width) throw new Error('Overflow '+width);
  await page.screenshot({path:path.join(output,'layout-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/');
 console.log('BUTTONS',JSON.stringify(await page.getByRole('button').allTextContents()));
 console.log('TEXTAREAS',await page.locator('textarea').count());
 await page.getByRole('link',{name:'资料提交与收录',exact:true}).click();
 await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
 if(await page.locator('dialog[open]').count()) throw new Error('Modal did not close');
 await page.getByRole('link',{name:'网站功能建议',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
 console.log('PASS dialogs Escape');
 await page.locator('textarea.study-input').fill('Hello world. Go now! 中文说明。');
 await page.getByRole('button',{name:'文章跟打',exact:true}).click();
 await page.locator('#article-typing-input').waitFor();
 if(await page.locator('#article-typing-input').evaluate(el=>el!==document.activeElement)) throw new Error('Typing focus missing');
 await page.locator('#article-typing-input').fill('HELLO, WORLD!!');
 await page.getByText('第 1 / 2 句',{exact:true}).waitFor();
 await page.locator('#article-typing-input').press('Enter');
 await page.getByText('第 2 / 2 句',{exact:true}).waitFor();
 await page.locator('#article-typing-input').fill('G');
 await page.getByRole('button',{name:'退出跟打',exact:true}).click();
 await page.getByRole('button',{name:'文章跟打',exact:true}).click();
 if(await page.locator('#article-typing-input').inputValue()!=='G') throw new Error('Typing draft lost');
 await page.locator('#article-typing-input').fill('X');
 if(await page.locator('#article-typing-input').getAttribute('aria-invalid')!=='true') throw new Error('Error not located');
 await page.locator('#article-typing-input').dispatchEvent('compositionstart');
 await page.locator('#article-typing-input').press('Enter');
 await page.getByText('第 2 / 2 句',{exact:true}).waitFor();
 await page.locator('#article-typing-input').dispatchEvent('compositionend',{data:'X'});
 await page.locator('#article-typing-input').fill('GO NOW!');await page.locator('#article-typing-input').press('Enter');
 await page.getByText('已完成这篇文章的跟打',{exact:true}).waitFor();
 await page.getByRole('button',{name:'退出跟打',exact:true}).click();
 await page.getByLabel('显示音标',{exact:true}).check();
 await page.waitForTimeout(1500);
 await page.reload();await page.waitForTimeout(700);
 if(!await page.getByLabel('显示音标',{exact:true}).isChecked()) throw new Error('Phonetic preference lost');
 console.log('PASS typing uppercase, confirmation, resume, error, composition; phonetics saved');
 await page.getByRole('button',{name:'英语词汇',exact:true}).click();
 await page.getByLabel('选择词库',{exact:true}).selectOption('evpep3');
 await page.getByLabel('搜索当前词库的单词或单元编号',{exact:true}).fill('strawberry');
 const lesson=page.locator('[data-course-dropdown="english-vocabulary"] [data-lesson-id]').first();
 await lesson.waitFor();const lessonId=await lesson.getAttribute('data-lesson-id');await lesson.click();
 await page.waitForTimeout(500);
 await page.getByRole('button',{name:'英语词汇',exact:true}).click();
 const marked=page.locator('[data-course-dropdown="english-vocabulary"] [aria-current="true"]');await marked.waitFor();
 if(await marked.getAttribute('data-lesson-id')!==lessonId) throw new Error('Selected marker wrong');
 await page.reload();await page.getByRole('button',{name:'英语词汇',exact:true}).click();
 if(await page.getByLabel('选择词库',{exact:true}).inputValue()!=='evpep3') throw new Error('Vocabulary group lost');
 await page.getByLabel('搜索当前词库的单词或单元编号',{exact:true}).fill('strawberry');await lesson.waitFor();await lesson.click();
 await page.getByRole('button',{name:'文章跟打',exact:true}).click();await page.locator('#article-typing-input').waitFor();
 const reference=await page.getByLabel('跟打原句',{exact:true}).innerText();
 if(/音标：|英语词汇 ·/.test(reference)) throw new Error('Vocabulary typing practiced metadata');
 console.log('PASS vocabulary search, restored group, chosen marker and examples: '+reference);
 await page.setViewportSize({width:360,height:800});await page.reload();await page.waitForTimeout(500);
 if(await page.evaluate(()=>document.documentElement.scrollWidth)>360)throw new Error('Loaded vocabulary overflow');
 await page.screenshot({path:path.join(output,'vocabulary-360.png'),fullPage:true});
 await page.locator('textarea.study-input').fill('pneumonoultramicroscopicsilicovolcanoconiosis. 中文说明！');
 await page.getByLabel('显示音标',{exact:true}).check();await page.waitForTimeout(700);
 if(await page.evaluate(()=>document.documentElement.scrollWidth)>360)throw new Error('Long phonetic word overflow');
 console.log('PASS long phonetic word on 360px');
 await page.screenshot({path:path.join(output,'phonetics-360.png'),fullPage:false});
 await page.setViewportSize({width:1440,height:900}); await page.goto(base+'/');
 await page.getByRole('button',{name:'考试学习',exact:true}).click();
 await page.getByLabel('考试分类',{exact:true}).selectOption('e1');
 await page.getByLabel('搜索试卷',{exact:true}).fill('1980');
 const paper = page.locator('.exam-paper-row').first();
 await paper.getByRole('button',{name:'开始学习',exact:true}).click();
 await page.locator('.study-word').first().click();
 await page.waitForFunction(async()=> {
  const store=await import(new URL('src/shared/stores/historyStore.ts',location.href.split('?')[0]).href);
  return (await store.listStudyHistory()).some(word=>Boolean(word.meaning));
 });
 await page.getByRole('button',{name:'考试学习',exact:true}).click();
 await page.getByRole('button',{name:'考试生词',exact:true}).click();
 await page.locator('.exam-word-item').first().waitFor();
 await page.getByRole('button',{name:'认识',exact:true}).first().click();
 await page.getByLabel('复习状态',{exact:true}).selectOption('known');
 await page.locator('.exam-word-item').first().waitFor();
 await page.getByRole('button',{name:'真题与进度',exact:true}).click();
 await page.getByLabel('考试分类',{exact:true}).selectOption('e1');
 await page.getByLabel('搜索试卷',{exact:true}).fill('1980');
 await page.locator('.exam-paper-row').first().getByRole('button',{name:'标记完成',exact:true}).click();
 await page.locator('.exam-paper-row [data-status="completed"]').first().waitFor();
 await page.reload();
 await page.getByLabel('搜索试卷',{exact:true}).fill('1980');
 await page.locator('.exam-paper-row [data-status="completed"]').first().waitFor();
 await page.getByRole('button',{name:'开始学习',exact:true}).first().click();
 await page.locator('textarea.study-input').fill('Export this current article.');
 await page.getByRole('button',{name:'考试学习',exact:true}).click();
 const downloaded = page.waitForEvent('download');
 await page.getByRole('button',{name:'导出学习数据',exact:true}).click();
 const backup = JSON.parse(fs.readFileSync(await (await downloaded).path(),'utf8'));
 for(const key of ['words','texts','examProgress','examWords','articleTyping']) if(!backup[key]?.length) throw new Error('UI backup missing '+key);
 if(!backup.texts.some(article=>article.text==='Export this current article.')) throw new Error('Export lost the current edit');
 await page.locator('input[type="file"]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('.exam-data-feedback').filter({hasText:'导入'}).waitFor();
 console.log('PASS dictionary click, exam words/progress/review, current-edit export and UI backup import');
 const routes = ['/nce/', '/nce/nce1-001/', '/english-vocabulary/', '/english-vocabulary/books/evjunior/', '/english-vocabulary/evjunior-001/', '/exam/', '/install/gateway/', '/install/windows/'];
 for (const width of [1440,390,360]) {
  await page.setViewportSize({width,height:900});
  for (const route of routes) {
   const response = await page.goto(base+route);
   if(response.status()!==200) throw new Error('Deep route failed: '+route);
   if(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)>innerWidth)) throw new Error('Static page overflow: '+route+' at '+width);
   if(route.startsWith('/install/')) {
    const href = await page.locator('a.install-action-primary').getAttribute('href');
    if(!href.startsWith('https://wordtap.cn/downloads/')) throw new Error('Installer must use official origin');
   }
  }
 }
 if((await page.goto(base+'/english-vocabulary/books/not-found/')).status()!==404) throw new Error('Unknown book was not a 404');
 if((await page.goto(base+'/nce/not-found/')).status()!==404) throw new Error('Unknown lesson was not a 404');
 console.log('PASS current-data deep routes, official installer links and static layouts');
 await page.goto(base+'/');
 await page.waitForFunction(()=>window.__wordtapHmrSocket?.readyState===1);
 const socket = await page.evaluate(()=>({url:window.__wordtapHmrSocket.url,state:window.__wordtapHmrSocket.readyState}));
 if(new URL(socket.url).port!==new URL(base).port || socket.state!==1) throw new Error('HMR uses the wrong port');
 console.log('PASS actual-port HMR WebSocket');
 // A fresh browser profile exercises the shipped worker on a secure localhost
 // subdomain. No production cache, learning database or browser profile is used.
 const cacheContext = await browser.newContext();
 const cachePage = await cacheContext.newPage();
 const cacheUrl = new URL(process.env.WORDTAP_CACHE_TEST_URL || base);
 if(['localhost','127.0.0.1'].includes(cacheUrl.hostname)) cacheUrl.hostname='wordtap.localhost';
 await cachePage.goto(cacheUrl.origin+'/');
 await cachePage.evaluate(async()=> {await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
 await cachePage.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const cachedPath='/nce/lessons/nce1/001.json';
 await cachePage.evaluate(async file=> {const cache=await caches.open('wordtap-v7');await cache.put(file,new Response(JSON.stringify({text:'old cached lesson'}),{headers:{'Content-Type':'application/json'}}));},cachedPath);
 const fresh=await cachePage.evaluate(async file=>(await fetch(file)).text(),cachedPath);
 if(JSON.parse(fresh).text==='old cached lesson')throw new Error('Online course cache remained stale');
 await cachePage.waitForFunction(async file=>(await (await caches.match(file)).text())!=='{"text":"old cached lesson"}',cachedPath);
 await cacheContext.setOffline(true);
 const offline=await cachePage.evaluate(async file=>(await fetch(file)).text(),cachedPath);
 if(offline!==fresh)throw new Error('Offline cached lesson differs');
 await cacheContext.close();
 console.log('PASS real service worker: old cache -> online release -> offline cached release');
 if(pageErrors.length) throw new Error('Browser errors: '+pageErrors.join('\n'));
 fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify({migration,widths:[1440,390,360,767,768,769],dialogs:true, typing:true, composition:true, phoneticsPreference:true, vocabularySearch:true, vocabularyResume:true, vocabularyTyping:true, phoneticsLongWord:true, serviceWorkerOnlineOffline:true, dictionaryLookup:true, examProgress:true, examWordReview:true, currentEditExport:true, uiBackupImport:true, deepRoutes:routes, staticWidths:[1440,390,360], officialDownloads:true, actualPortHmr:true, pageErrors},null,2));
} catch(error) {
 fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify({passed:false,error:String(error),url:activePage?.url()},null,2));
 await activePage?.screenshot({path:path.join(output,'failure.png'),fullPage:false});
 throw error;
} finally {await browser.close();}
