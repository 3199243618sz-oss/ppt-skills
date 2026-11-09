/* Explicit browser download checks. Run only when validating PPTX export. */
const {chromium}=require('playwright');
const JSZip=require('jszip');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const output=path.resolve('qa/pptx');
const report={downloads:[],checks:[],errors:[]};
fs.mkdirSync(output,{recursive:true});
const compact=value=>String(value).normalize('NFC').replace(/[\s\u200b-\u200d\ufeff]+/gu,'');
const targets=['http:','https:'];
function ownerOf(relationships){
 if(relationships==='_rels/.rels')return '';
 return relationships.replace(/(^|\/)\_rels\//,'$1').replace(/\.rels$/,'');
}
function internalTarget(owner,target){
 const decoded=decodeURIComponent(target.split('#')[0]);
 return path.posix.normalize(decoded.startsWith('/')?decoded.slice(1):path.posix.join(path.posix.dirname(owner),decoded));
}
async function inspectPptx(bytes,page,expected,label){
 const zip=await JSZip.loadAsync(bytes);
 for(const name of ['[Content_Types].xml','_rels/.rels','ppt/presentation.xml','ppt/_rels/presentation.xml.rels'])assert.ok(zip.file(name),`${label}: missing ${name}`);
 const xml=[];
 for(const [name,file] of Object.entries(zip.files))if(!file.dir&&/\.(?:xml|rels)$/.test(name))xml.push({name,text:await file.async('string')});
 const parsed=await page.evaluate(entries=>entries.map(({name,text})=>{
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror'))return {name,error:doc.querySelector('parsererror').textContent.slice(0,220)};
  const elements=[...doc.getElementsByTagName('*')],byName=name=>elements.filter(el=>el.localName===name);
  const relationshipNamespace='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return {name,
   relationships:byName('Relationship').map(el=>({id:el.getAttribute('Id'),target:el.getAttribute('Target'),external:el.getAttribute('TargetMode')==='External'})),
   slideIds:byName('sldId').map(el=>el.getAttributeNS(relationshipNamespace,'id')),
   texts:byName('t').map(el=>el.textContent),
   shapeIds:byName('cNvPr').map(el=>el.getAttribute('id')),
   editableShapes:byName('sp').filter(el=>[...el.getElementsByTagName('*')].some(child=>child.localName==='t'&&child.textContent.trim())).length,
   references:elements.flatMap(el=>['id','embed','link'].map(name=>el.getAttributeNS(relationshipNamespace,name)).filter(Boolean))
  };
 }),xml);
 const byName=new Map(parsed.map(part=>[part.name,part]));
 for(const part of parsed){
  assert.ok(!part.error,`${label}: malformed ${part.name}: ${part.error}`);
  if(!part.name.endsWith('.rels'))continue;
  const owner=ownerOf(part.name),ids=part.relationships.map(r=>r.id);
  assert.equal(new Set(ids).size,ids.length,`${label}: duplicate relationship IDs in ${part.name}`);
  for(const relation of part.relationships)if(!relation.external){
   const target=internalTarget(owner,relation.target);
   assert.ok(!target.startsWith('../')&&zip.file(target),`${label}: missing relationship target ${part.name} -> ${target}`);
  }
  if(owner&&byName.has(owner))for(const reference of byName.get(owner).references)assert.ok(ids.includes(reference),`${label}: missing relationship ${reference} in ${owner}`);
 }
 const presentation=byName.get('ppt/presentation.xml');
 const relationships=byName.get('ppt/_rels/presentation.xml.rels').relationships;
 const ordered=presentation.slideIds.map(id=>{
  const relation=relationships.find(r=>r.id===id);assert.ok(relation,`${label}: missing slide relationship ${id}`);
  return byName.get(internalTarget('ppt/presentation.xml',relation.target));
 });
 assert.equal(ordered.length,expected.length,`${label}: exported page count`);
 const slides=ordered.map((part,index)=>{
  assert.ok(part,`${label}: missing slide part ${index+1}`);
  assert.ok(part.texts.some(text=>text.trim()),`${label}: slide ${index+1} has no text`);
  assert.ok(part.editableShapes>0,`${label}: slide ${index+1} must contain editable text shapes`);
  assert.equal(new Set(part.shapeIds).size,part.shapeIds.length,`${label}: duplicate cNvPr IDs on slide ${index+1}`);
  const actual=compact(part.texts.join(' ')),wanted=compact(expected[index].title);
  assert.ok(wanted&&actual.includes(wanted),`${label}: unexpected page order or missing title on slide ${index+1}: ${expected[index].title}`);
  return {page:index+1,id:expected[index].id,title:expected[index].title,editableShapes:part.editableShapes,shapeCount:part.shapeIds.length};
 });
 return {label,pageCount:ordered.length,bytes:bytes.length,xmlParts:xml.length,slides};
}
async function snapshot(page){
 return page.evaluate(()=>({
  language:DeckI18n.language,hash:location.hash,
  active:document.querySelector('#deck>.slide.active')?.dataset.slideId,
  storage:Object.fromEntries(['-position-v1','-language-v1','-hidden-pages-v1'].map(suffix=>[suffix,localStorage.getItem(DeckConfig.id+suffix)]))
 }));
}
async function expectedSlides(page,language){
 return page.locator('#deck>.slide:not(.is-skipped)').evaluateAll((slides,language)=>slides.map(slide=>{
  // Closing pages intentionally show a bilingual greeting instead of data-title.
  const heading=slide.querySelector('h1,h2'),fixed=Boolean(heading?.closest('[data-no-translate]'));
  const source=fixed?heading.textContent:(slide.dataset.title||heading?.textContent||'');
  return {id:slide.dataset.slideId,title:fixed?source:language==='en'?DeckI18n.english(source):source};
 }),language);
}
async function showControls(page){
 const viewport=page.viewportSize();
 await page.mouse.move(viewport.width/2,viewport.height-12);
 await page.waitForFunction(()=>document.body.classList.contains('controls-visible'));
}
async function openExport(page){
 if(await page.locator('#pptx-dialog').evaluate(el=>el.open))return;
 await showControls(page);
 await page.locator('#export-pptx').click();
 await page.waitForFunction(()=>document.getElementById('pptx-dialog').open);
}
async function closeExport(page){
 if(await page.locator('#pptx-dialog').evaluate(el=>el.open))await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.getElementById('pptx-dialog').open);
}
function clickAndWaitForDownload(page,language){
 return new Promise((resolve,reject)=>{
  let settled=false,pollTimer;
  const finish=(error,download)=>{
   if(settled)return;
   settled=true;clearTimeout(deadline);clearTimeout(pollTimer);
   page.off('download',onDownload);page.off('close',onClose);
   error?reject(error):resolve(download);
  };
  const onDownload=download=>finish(null,download);
  const onClose=()=>finish(new Error('Page closed while exporting '+language+' PPTX'));
  const deadline=setTimeout(()=>finish(new Error('Timed out waiting for '+language+' PPTX download')),180000);
  const inspect=async()=>{
   if(settled)return;
   try{
    const error=await page.locator('#pptx-status').evaluate(status=>status.classList.contains('is-error')?status.textContent.trim():null);
    if(settled)return;
    if(error){finish(new Error('PPTX '+language+' export failed: '+error));return;}
    pollTimer=setTimeout(inspect,200);
   }catch(error){finish(error);}
  };
  page.on('download',onDownload);page.on('close',onClose);
  // Install the listener before clicking, but poll only after the new attempt
  // starts: a retry must not consume the previous attempt's error message.
  Promise.resolve().then(()=>page.locator(`[data-pptx-language="${language}"]`).click())
   .then(()=>{if(!settled)inspect();}).catch(error=>finish(error));
 });
}
async function downloadChoice(page,language,prefix){
 await openExport(page);
 const before=await snapshot(page);
 const download=await clickAndWaitForDownload(page,language);
 const suggested=download.suggestedFilename();
 const file=path.join(output,prefix+'-'+path.basename(suggested).replace(/[^\p{L}\p{N}._-]/gu,'_'));
 await download.saveAs(file);
 assert.equal(await download.failure(),null,`${prefix}: browser download failed`);
 await page.waitForFunction(language=>!document.querySelector(`[data-pptx-language="${language}"]`).disabled,language,{timeout:180000});
 await closeExport(page);
 assert.deepEqual(await snapshot(page),before,`${prefix}: export changed presentation state`);
 return {file,suggested,bytes:fs.readFileSync(file)};
}
async function checkToolbar(page,language){
 await page.evaluate(language=>DeckI18n.setLanguage(language),language);
 await showControls(page);
 const issues=await page.locator('#controls').evaluate(controls=>{
  const rect=controls.getBoundingClientRect(),issues=[];
  if(rect.left<-.5||rect.right>innerWidth+.5)issues.push('toolbar outside viewport');
  const visible=[...controls.querySelectorAll('button')].filter(el=>getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width);
  for(const button of visible){
   const box=button.getBoundingClientRect();
   if(box.left<rect.left-.5||box.right>rect.right+.5||box.top<rect.top-.5||box.bottom>rect.bottom+.5)issues.push('button outside toolbar: '+button.id);
   if(button.scrollWidth>button.clientWidth+2)issues.push('button content clipped: '+button.id);
  }
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){
   const a=visible[i].getBoundingClientRect(),b=visible[j].getBoundingClientRect();
   if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)issues.push('overlapping buttons: '+visible[i].id+'/'+visible[j].id);
  }
  return issues;
 });
 assert.deepEqual(issues,[],`390px ${language} toolbar`);
 await page.screenshot({path:path.join(output,`controls-${language}-mobile.png`)});
 report.checks.push(`390px ${language} toolbar bounds`);
}
(async()=>{
 let browser;
 try{
  const url=process.env.DECK_URL||'http://127.0.0.1:8798/index.html';
  const entry=new URL(url),origin=entry.origin;entry.searchParams.set('lang','zh');entry.hash='slide=1';
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true,reducedMotion:'reduce'});
  const outside=[];
  await context.route(url=>targets.includes(url.protocol)&&url.origin!==origin,route=>{outside.push(route.request().url());return route.abort('blockedbyclient');});
  const page=await context.newPage(),pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto(entry.toString(),{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>window.DeckPptx&&window.PptxGenJS);
  const initial=await snapshot(page);
  const expectedZh=await expectedSlides(page,'zh'),expectedEn=await expectedSlides(page,'en');
  assert.ok(expectedZh.length>0);
  const zh=await downloadChoice(page,'zh','full-zh');
  assert.match(zh.suggested,/\.pptx$/i);
  report.downloads.push({...await inspectPptx(zh.bytes,page,expectedZh,'full Chinese'),file:zh.file});
  // All page resources are loaded; a second export must work without the network.
  await context.setOffline(true);
  const en=await downloadChoice(page,'en','offline-en');
  assert.match(en.suggested,/\.pptx$/i);
  report.downloads.push({...await inspectPptx(en.bytes,page,expectedEn,'offline full English'),file:en.file});
  await context.setOffline(false);
  report.checks.push('Chinese and English real button downloads','offline export after resources load','presentation language/hash/storage unchanged');
  assert.deepEqual(await snapshot(page),initial,'Full-deck exports changed presentation state');

  // Use the real visibility UI, retaining only first/middle/last pages.
  const ids=await page.locator('#deck>.slide').evaluateAll(slides=>slides.map(slide=>slide.dataset.slideId));
  const keep=new Set([0,Math.floor((ids.length-1)/2),ids.length-1]);
  await page.keyboard.press('g');await page.locator('#overview-manage').click();
  for(let i=0;i<ids.length;i++)if(!keep.has(i))await page.locator(`#overview-grid [data-index="${i}"]`).click();
  await page.locator('#overview-save').click();
  const selectedZh=await expectedSlides(page,'zh'),selectedEn=await expectedSlides(page,'en');
  assert.deepEqual(selectedZh.map(slide=>slide.id),ids.filter((_,index)=>keep.has(index)));
  const both=await downloadChoice(page,'both','selected-both');
  assert.match(both.suggested,/\.zip$/i);
  const combined=await JSZip.loadAsync(both.bytes),parts=Object.values(combined.files).filter(file=>!file.dir&&/\.pptx$/i.test(file.name));
  assert.equal(parts.length,2,'Both-language ZIP contains exactly two PPTX files');
  for(const language of ['zh','en']){
   const part=parts.find(file=>new RegExp('(?:^|[-_.])'+language+'\\.pptx$','i').test(path.posix.basename(file.name)));
   assert.ok(part,`Both-language ZIP is missing ${language}.pptx`);
   const bytes=await part.async('nodebuffer'),file=path.join(output,`selected-${language}.pptx`);fs.writeFileSync(file,bytes);
   report.downloads.push({...await inspectPptx(bytes,page,language==='zh'?selectedZh:selectedEn,'selected '+language),file,archive:both.file});
  }
  report.checks.push('Hidden slides excluded in original order','Both-language single ZIP download');

  await page.setViewportSize({width:390,height:844});
  for(const language of ['zh','en'])await checkToolbar(page,language);
  await page.setViewportSize({width:1366,height:768});

  // Fail serialization once, then retry through the same UI without reloading.
  await openExport(page);
  const beforeFailure=await snapshot(page);
  await page.evaluate(()=>{
   const prototype=window.PptxGenJS.prototype,original=prototype.write;
   if(typeof original!=='function')throw Error('PptxGenJS write method is unavailable');
   prototype.write=function(...args){prototype.write=original;return Promise.reject(new Error('simulated write failure'));};
  });
  await page.locator('[data-pptx-language="zh"]').click();
  await page.waitForFunction(()=>/失败|failed|simulated write failure/i.test(document.getElementById('pptx-status').textContent),{},{timeout:180000});
  assert.equal(await page.locator('[data-pptx-language="zh"]').isEnabled(),true,'Export button is enabled after failure');
  assert.equal(await page.locator('#pptx-dialog').evaluate(el=>el.open),true,'Export failure keeps dialog open');
  assert.deepEqual(await snapshot(page),beforeFailure,'Failed export changed presentation state');
  const retry=await downloadChoice(page,'zh','retry-zh');
  report.downloads.push({...await inspectPptx(retry.bytes,page,selectedZh,'retry after serialization failure'),file:retry.file});
  report.checks.push('Failure keeps dialog usable; subsequent real download succeeds');
  assert.deepEqual(pageErrors,[],'Unexpected browser runtime errors');assert.deepEqual(outside,[],'Export must not request external services');
  report.checks.push('No external requests or uncaught browser errors');report.status='PASS';
  fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`PASS: editable PPTX downloads, ${expectedZh.length} slides, both languages, selected pages, offline export, OOXML relationships/IDs, failure retry and 390px controls`);
 }catch(error){
  report.status='FAIL';report.errors.push(error.stack||error.message);
  fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2)+'\n');
  console.error(error);process.exitCode=1;
 }finally{if(browser)await browser.close();}
})();
