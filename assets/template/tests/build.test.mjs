import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,access,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
const python=process.env.PYTHON_EXECUTABLE||'python3';
execFileSync(python,['tools/render.py']);
test('local build includes page content and isolated storage without deployment output',async()=>{
 const data=JSON.parse(await readFile('content/deck.json','utf8'));
 const html=await readFile('index.html','utf8');
 assert.equal([...html.matchAll(/<section class="slide /g)].length,data.slides.length);
 for(const m of html.matchAll(/(?:src|href)="((?:assets|js|css)\/[^"]+)"/g))await access(m[1]);
 const config=await readFile('js/config.js','utf8');assert.ok(config.includes(data.id));
});
test('export CLI offers help and rejects unsupported languages',()=>{
 const help=execFileSync(process.execPath,['tools/export.cjs','--help'],{encoding:'utf8'});
 assert.match(help,/html\|pdf\|all/);
 assert.throws(()=>execFileSync(process.execPath,['tools/export.cjs','pdf','--lang','invalid'],{stdio:'pipe'}),error=>/--lang must be/.test(String(error.stderr)));
});

async function identityFixture(data={id:'identity-check',title:{zh:'标识检查',en:'Identity check'},slides:[{type:'cover',title:{zh:'页面一',en:'Page one'}},{type:'cover',title:{zh:'页面二',en:'Page two'}}]}) {
 const root=await mkdtemp(path.join(tmpdir(),'slide-identities-'));
 for(const dir of ['tools','content','js'])await mkdir(path.join(root,dir));
 await writeFile(path.join(root,'tools/render.py'),await readFile('tools/render.py'));
 await writeFile(path.join(root,'content/shell.html'),await readFile('content/shell.html'));
 await writeFile(path.join(root,'content/deck.json'),JSON.stringify(data));
 return {root,run:()=>execFileSync(python,['tools/render.py'],{cwd:root,stdio:'pipe'})};
}
test('generated page identities survive title changes, reordering and insertion',async()=>{
 const fixture=await identityFixture();
 try{
  fixture.run();const content=path.join(fixture.root,'content/deck.json');const data=JSON.parse(await readFile(content));
  const original=data.slides.map(s=>s.id);assert.equal(new Set(original).size,2);
  data.slides[0].title={zh:'新标题',en:'New title'};
  data.slides.reverse();data.slides.splice(1,0,{type:'cover',title:{zh:'新增页面',en:'Inserted page'}});
  await writeFile(content,JSON.stringify(data));fixture.run();
  const changed=JSON.parse(await readFile(content));
  assert.equal(changed.slides[0].id,original[1]);assert.equal(changed.slides[2].id,original[0]);
  assert.ok(changed.slides[1].id&&!original.includes(changed.slides[1].id));
  const html=await readFile(path.join(fixture.root,'index.html'),'utf8');
  for(const slide of changed.slides)assert.ok(html.includes('data-slide-id="'+slide.id+'"'));
 }finally{await rm(fixture.root,{recursive:true,force:true});}
});
test('duplicate page identities are rejected before rendering an ambiguous selection',async()=>{
 const fixture=await identityFixture();
 try{
  const content=path.join(fixture.root,'content/deck.json');const data=JSON.parse(await readFile(content));
  data.slides.forEach(s=>{s.id='same-page'});await writeFile(content,JSON.stringify(data));
  assert.throws(fixture.run,error=>/Duplicate slide id/.test(String(error.stderr)));
 }finally{await rm(fixture.root,{recursive:true,force:true});}
});


function contentFixture(slides) {
 return identityFixture({id:'content-check',title:'Layout validation',slides});
}
function exampleCard() {return {title:{zh:'能力标题',en:'Capability title'},body:{zh:'正文说明',en:'Supporting text'}};}
test('card layouts preserve bilingual escaped content and use explicit numbering and emphasis',async()=>{
 const card=exampleCard();
 const fixture=await contentFixture([
  {id:'default-cards',type:'cards',title:'Columns',cards:[card,card]},
  {id:'row-cards',type:'cards',title:'Rows',layout:'rows',numbered:true,eyebrow:{zh:'实际分类',en:'Meaningful category'},cards:[{...card,emphasis:true},{title:{zh:'<img src=x onerror=alert(1)>',en:'Literal markup'},body:'A & B'}]}
 ]);
 try{
  fixture.run();const html=await readFile(path.join(fixture.root,'index.html'),'utf8');
  const sections=[...html.matchAll(/<section class="slide [\s\S]*?<\/section>/g)].map(m=>m[0]);
  assert.ok(sections[0].includes('class="kit-cards"'));
  assert.ok(!sections[0].includes('class="kit-index"'));
  assert.ok(!sections[0].includes('class="eyebrow"'));
  assert.ok(sections[1].includes('class="kit-card-rows"'));
  assert.ok(sections[1].includes('class="kit-card-row is-emphasis"'));
  assert.equal([...sections[1].matchAll(/class="kit-index"/g)].length,2);
  assert.ok(sections[1].includes('class="eyebrow">实际分类'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('A &amp; B'));
  const context={window:{}};runInNewContext(await readFile(path.join(fixture.root,'js/translations.js'),'utf8'),context);
  assert.equal(context.window.DeckEnglish['能力标题'],'Capability title');
  assert.equal(context.window.DeckEnglish['<img src=x onerror=alert(1)>'],'Literal markup');
 }finally{await rm(fixture.root,{recursive:true,force:true});}
});
test('spotlight and weighted tables render their content without an empty eyebrow',async()=>{
 const fixture=await contentFixture([
  {id:'spotlight',type:'spotlight',title:'One conclusion',eyebrow:{zh:'',en:''},lead:{title:{zh:'核心判断',en:'Core conclusion'},body:'<strong>literal</strong>'},points:[exampleCard(),exampleCard()]},
  {id:'weighted-table',type:'table',title:'Weighted columns',headers:['A','B','C'],rows:[['one','two','three']],columnWidths:[20,47.5,32.5]},
  {id:'default-table',type:'table',title:'Default columns',headers:['A','B'],rows:[['one','two']]},
  {id:'compare',type:'comparison',title:'Compared',columns:[{title:'Left',summary:'Summary A',bullets:['Point A']},{kicker:{zh:'',en:''},title:'Right',summary:'Summary B',bullets:['Point B']}]}
 ]);
 try{
  fixture.run();const html=await readFile(path.join(fixture.root,'index.html'),'utf8');
  assert.ok(html.includes('class="kit-spotlight"'));
  assert.ok(html.includes('class="kit-spotlight-lead"><h3>核心判断</h3>'));
  assert.ok(html.includes('class="kit-spotlight-points"><article>'));
  assert.ok(html.includes('&lt;strong&gt;literal&lt;/strong&gt;'));
  assert.ok(!html.includes('<strong>literal</strong>'));
  const slideHtml=[...html.matchAll(/<section class="slide [\s\S]*?<\/section>/g)].map(m=>m[0]).join('');
  assert.ok(!slideHtml.includes('class="eyebrow"'));
  assert.ok(html.includes('<colgroup><col style="width:20%"><col style="width:47.5%"><col style="width:32.5%"></colgroup>'));
  assert.equal([...html.matchAll(/<colgroup>/g)].length,1);
  assert.ok(!html.includes('class="kit-index"'));
  const context={window:{}};runInNewContext(await readFile(path.join(fixture.root,'js/translations.js'),'utf8'),context);
  assert.equal(context.window.DeckEnglish['核心判断'],'Core conclusion');
 }finally{await rm(fixture.root,{recursive:true,force:true});}
});
test('invalid layout, emphasis, spotlight and column-width input is rejected',async()=>{
 const cards={id:'invalid',type:'cards',title:'Invalid input',cards:[exampleCard(),exampleCard()]};
 const table={id:'invalid',type:'table',title:'Invalid input',headers:['A','B','C'],rows:[['one','two','three']]};
 const spotlight={id:'invalid',type:'spotlight',title:'Invalid input',lead:exampleCard(),points:[exampleCard(),exampleCard()]};
 const cases=[
  [{...cards,layout:'diagonal'},/cards layout must be columns or rows/],
  [{...cards,layout:null},/cards layout must be columns or rows/],
  [{...cards,numbered:'true'},/cards numbered must be a boolean/],
  [{...cards,cards:[{...exampleCard(),emphasis:'true'},exampleCard()]},/card emphasis must be a boolean/],
  [{...spotlight,lead:{title:'Missing body'}},/spotlight lead requires title and body/],
  [{...spotlight,points:'not a list'},/spotlight points must be a list/],
  [{...spotlight,points:[exampleCard()]},/spotlight points must contain 2–4 items/],
  [{...spotlight,points:[{},exampleCard()]},/each spotlight point requires title and body/],
  ...[null,'20,50,30',[],[50,50]].map(columnWidths=>[{...table,columnWidths},/table columnWidths must be a list matching the header count/]),
  ...[[20,30,49],[0,50,50],[-1,50,51],['20',50,30],[true,49,50],[null,50,50]].map(columnWidths=>[{...table,columnWidths},/table columnWidths must contain positive finite numbers totaling 100/])
 ];
 const fixture=await contentFixture([cards]);
 try{
  const file=path.join(fixture.root,'content/deck.json');
  for(const [slide,errorPattern] of cases){
   await writeFile(file,JSON.stringify({id:'content-check',title:'Invalid',slides:[slide]}));
   assert.throws(fixture.run,error=>errorPattern.test(String(error.stderr)));
  }
  for(const literal of ['NaN','Infinity','-Infinity']){
   const data={id:'content-check',title:'Invalid',slides:[{...table,columnWidths:['non-finite',50,50]}]};
   await writeFile(file,JSON.stringify(data).replace('"non-finite"',literal));
   assert.throws(fixture.run,error=>/table columnWidths must contain positive finite numbers totaling 100/.test(String(error.stderr)));
  }
 }finally{await rm(fixture.root,{recursive:true,force:true});}
});
