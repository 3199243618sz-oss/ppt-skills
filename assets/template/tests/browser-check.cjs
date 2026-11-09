/* npm i --no-save playwright; BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:browser */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {contactSheet}=require('../tools/contact-sheet.cjs');
// Measure only the active slide. Geometry is a gate; title rhythm and solid-color
// contrast are reported for a human review, not treated as website styling rules.
function inspectSlide(slide){
 const failures=[],warnings=[],headings=[],contrastSamples=[];
 const deck=document.querySelector('#deck'),slideRect=slide.getBoundingClientRect();
 const scale=deck.getBoundingClientRect().width/1600,tolerance=Math.max(1,2*scale);
 const footer=slide.querySelector('.slide-footer'),body=slide.querySelector('.kit-body');
 const visible=el=>{
  if(!el.getClientRects().length)return false;
  for(let p=el;p;p=p.parentElement){const cs=getComputedStyle(p);if(cs.display==='none'||cs.visibility==='hidden'||cs.visibility==='collapse'||Number(cs.opacity)===0)return false;}
  return true;
 };
 const excerpt=value=>value.replace(/\s+/g,' ').trim().slice(0,120);
 if(footer&&body&&visible(body)&&body.getBoundingClientRect().bottom>footer.getBoundingClientRect().top-8*scale)failures.push('body overlaps footer');
 const parseColor=value=>{
  const m=value.match(/^rgba?\(([^)]+)\)$/);if(!m)return null;
  const channels=m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return channels.length>=3&&channels.every(Number.isFinite)?[...channels.slice(0,3),channels[3]??1]:null;
 };
 const background=el=>{
  const layers=[];
  for(let p=el;p;p=p.parentElement){
   const cs=getComputedStyle(p);if(cs.backgroundImage!=='none')return null;
   const c=parseColor(cs.backgroundColor);if(c&&c[3]>0)layers.push(c);
   if(c&&c[3]>=1)break;
  }
  let base=[255,255,255];
  for(const c of layers.reverse())base=base.map((v,i)=>c[i]*c[3]+v*(1-c[3]));
  return base;
 };
 const luminance=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const blockFor=el=>{
  for(let p=el;p&&p!==slide;p=p.parentElement){
   const display=getComputedStyle(p).display;
   if(['block','flow-root','flex','grid','inline-block','inline-flex','inline-grid','list-item','table-cell'].includes(display))return p;
  }
  return slide;
 };
 // Keep the original explicit clipping check as well as text-node geometry:
 // a fixed-height paragraph can clip vertically without crossing the footer.
 for(const el of slide.querySelectorAll('h1,h2,h3,p,li,.kit-layer span,.kit-table td,.kit-table th,.kit-metrics b,.kit-note')){
  if(!visible(el))continue;
  const cs=getComputedStyle(el);
  if(el.scrollWidth>el.clientWidth+2||(el.scrollHeight>el.clientHeight+2&&cs.overflowY!=='visible'))failures.push('text overflow: '+excerpt(el.textContent));
 }
 const walker=document.createTreeWalker(slide,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode,el=node.parentElement,label=excerpt(node.nodeValue);
  if(!label||!el||!visible(el)||el.closest('script,style,template'))continue;
  if(document.documentElement.lang==='en'&&!el.closest('[data-no-translate]')&&/[\u3400-\u9fff]/.test(node.nodeValue))failures.push('untranslated text: '+label);
  if(el.closest('.slide-header,.slide-footer,.kit-toolbar,button'))continue;
  const range=document.createRange();range.selectNodeContents(node);
  const rects=[...range.getClientRects()].filter(r=>r.width&&r.height);if(!rects.length)continue;
  const container=blockFor(el),box=container.getBoundingClientRect(),cs=getComputedStyle(container);
  const right=box.right-(parseFloat(cs.paddingRight)||0)*scale-(parseFloat(cs.borderRightWidth)||0)*scale;
  for(const rect of rects){
   if(rect.right>slideRect.right+tolerance||rect.left<slideRect.left-tolerance)failures.push('text outside slide: '+label);
   if(rect.right>right+tolerance)failures.push('text outside content block: '+label);
   if(footer&&rect.bottom>footer.getBoundingClientRect().top-8*scale)failures.push('text crosses footer: '+label);
  }
  const style=getComputedStyle(el),fontSize=parseFloat(style.fontSize);
  // Tiny labels, controls and footers are not primary prose. Image backgrounds
  // require visual review and intentionally do not receive a guessed ratio.
  if(el.closest('.kit-body')&&!el.closest('h1,h2,h3,h4,h5,h6')&&fontSize>=18){
   const fg=parseColor(style.color),bg=background(el);
   if(fg&&bg){
    const ink=bg.map((v,i)=>fg[i]*fg[3]+v*(1-fg[3]));
    const values=[luminance(ink),luminance(bg)].sort((a,b)=>b-a);
    contrastSamples.push({text:label,ratio:Number(((values[0]+.05)/(values[1]+.05)).toFixed(2)),canvasFontPx:fontSize,renderedFontPx:Number((fontSize*scale).toFixed(2))});
   }
  }
 }
 for(const heading of slide.querySelectorAll('h1,h2')){
  if(!visible(heading)||heading.closest('[data-no-translate]'))continue;
  const lineHeight=parseFloat(getComputedStyle(heading).lineHeight);
  const lines=Number.isFinite(lineHeight)?Math.max(1,Math.round(heading.clientHeight/lineHeight)):null;
  const entry={text:excerpt(heading.textContent),lines};headings.push(entry);
  if(lines>2)warnings.push('heading exceeds two lines: '+entry.text);
 }
 const lowContrast=contrastSamples.filter(x=>x.ratio<4.5);
 if(lowContrast.length)warnings.push(`${lowContrast.length} primary text samples below 4.5:1; review reading contrast`);
 return {id:slide.dataset.slideId,failures:[...new Set(failures)],warnings,headings,bodyContrast:{minimum:contrastSamples.length?Math.min(...contrastSamples.map(x=>x.ratio)):null,measuredSamples:contrastSamples.length,below45:lowContrast}};
}
const designMetrics=[];
function writeDesignMetrics(){
 fs.writeFileSync('qa/design-metrics.json',JSON.stringify({notes:['Active-slide text geometry is checked at each viewport.','Heading line count and 4.5:1 contrast are review signals, not claims of accessibility certification.','Contrast uses computed solid colors; it excludes image backgrounds, temporary animation opacity, small labels and footers.','Font sizes include both the 1600x900 canvas size and the scaled viewport size.'],slides:designMetrics},null,2)+'\n');
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.DECK_URL||'http://127.0.0.1:8798/index.html';
 fs.mkdirSync('qa',{recursive:true});
 await page.goto(url);await page.evaluate(()=>document.fonts.ready);
 const count=await page.locator('#deck > .slide').count();assert.ok(count>0);
 for(const viewport of [{width:1600,height:1000},{width:1366,height:768},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const lang of ['zh','en']){
   await page.evaluate(lang=>DeckI18n.setLanguage(lang),lang);
   for(let i=1;i<=count;i++){
    await page.evaluate(i=>{location.hash='#slide='+i},i);await page.waitForTimeout(60);
    const inspection=await page.locator('#deck > .slide.active').evaluate(inspectSlide);
    designMetrics.push({viewport,language:lang,slide:i,...inspection});
    if(inspection.failures.length)writeDesignMetrics();
    assert.deepEqual(inspection.failures,[],`${viewport.width}/${lang}/slide ${i}`);
   }
  }
 }
 writeDesignMetrics();
 await page.setViewportSize({width:1600,height:1000});
 // English -> Chinese roundtrip must restore the title, then directory links must still work.
 await page.evaluate(()=>{location.hash='#slide=1';DeckI18n.setLanguage('zh')});await page.waitForTimeout(60);
 const original=await page.locator('#deck > .slide.active h1').textContent();
 await page.evaluate(()=>DeckI18n.setLanguage('en'));await page.evaluate(()=>DeckI18n.setLanguage('zh'));
 assert.equal(await page.locator('#deck > .slide.active h1').textContent(),original);
 await page.keyboard.press('g');assert.equal(await page.locator('#overview-dialog').evaluate(x=>x.open),true);
 assert.equal(await page.locator('.thumbnail').count(),count);await page.locator('.thumbnail').last().click();
 assert.equal(await page.locator('#overview-dialog').evaluate(x=>x.open),false);
 const workflow=page.locator('#deck > .slide').filter({has:page.locator('[data-flow-step]')}).first();
 if(await workflow.count()){
  const index=await workflow.evaluate(x=>[...x.parentElement.children].indexOf(x)+1);
  await page.evaluate(index=>{location.hash='#slide='+index},index);await page.waitForTimeout(60);
  await page.locator('#deck > .slide.active [data-flow-replay]').click();
  assert.equal(await page.locator('#deck > .slide.active [data-flow-play]').isVisible(),true);
  assert.equal(await page.locator('#deck > .slide.active .flow-current').count(),1);
  await page.waitForTimeout(2500);assert.equal(await page.locator('#deck > .slide.active .flow-current').getAttribute('data-flow-step'),'1');
  await page.locator('#deck > .slide.active [data-flow-play]').click();
  const paused=await page.locator('#deck > .slide.active .flow-current').getAttribute('data-flow-step');
  await page.waitForTimeout(2500);assert.equal(await page.locator('#deck > .slide.active .flow-current').getAttribute('data-flow-step'),paused);
  await page.locator('#deck > .slide.active [data-flow-all]').click();assert.equal(await page.locator('#deck > .slide.active .flow-current').count(),0);
  assert.equal(await page.locator('#deck > .slide.active [data-flow-play]').isVisible(),false);
  assert.equal(await page.locator('#deck > .slide.active [data-flow-replay]').isVisible(),true);
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#deck > .slide.active [data-flow-replay]').click();assert.equal(await page.locator('#deck > .slide.active .flow-current').count(),0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#deck > .slide.active [data-flow-replay]').click();
  await page.keyboard.press('Home');await page.waitForTimeout(2500);assert.equal(await workflow.locator('.flow-current').count(),0);
 }
 await page.setViewportSize({width:1600,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addStyleTag({content:'#controls,dialog,.toast{visibility:hidden!important}'});
 fs.mkdirSync('qa/slides',{recursive:true});
 for(const lang of ['zh','en']){
  await page.evaluate(lang=>DeckI18n.setLanguage(lang),lang);
  const shots=[];
  for(let i=1;i<=count;i++){
   await page.evaluate(i=>{location.hash='#slide='+i},i);await page.waitForTimeout(60);
   const image=await page.locator('#deck').screenshot({path:`qa/slides/${lang}-${String(i).padStart(2,'0')}.png`});
   shots.push({image,title:await page.locator('#deck>.active').evaluate(s=>window.DeckI18n?.t(s.dataset.title)||s.dataset.title)});
  }
  await contactSheet(browser,shots,`qa/contact-${lang}.png`);
 }
 await page.emulateMedia({media:'print'});await page.waitForTimeout(100);
 assert.equal(await page.locator('#deck .flow-current').count(),0);
 // Verify print state without creating a PDF; use test:export only when export is requested.
 assert.deepEqual(errors,[]);await browser.close();console.log(`PASS: ${count} slides, 2 languages, 3 viewports, navigation, motion, reduced motion and print`);
})().catch(e=>{console.error(e);process.exit(1)});
