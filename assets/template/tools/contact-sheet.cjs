const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function contactSheet(browser,slides,target){
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 try{
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#eef0f3;font:15px Arial,sans-serif}.contact-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:start}figure{margin:0;background:#fff;border:1px solid #ddd;border-radius:4px;overflow:hidden}img{display:block;width:100%;height:auto}figcaption{padding:12px;line-height:1.4;overflow-wrap:anywhere}b{color:#c7000b;margin-right:12px}</style></head><body><div class="contact-grid">${slides.map((s,i)=>`<figure><img src="data:image/png;base64,${s.image.toString('base64')}"><figcaption><b>${String(i+1).padStart(2,'0')}</b>${escape(s.title)}</figcaption></figure>`).join('')}</div></body></html>`,{waitUntil:'load'});
  const clipped=await page.locator('figure').evaluateAll(items=>items.some(f=>f.querySelector('figcaption').getBoundingClientRect().bottom>f.getBoundingClientRect().bottom+1));
  if(clipped)throw Error('Contact-sheet caption was clipped.');
  await page.screenshot({path:target,fullPage:true});
 }finally{await page.close();}
}
module.exports={contactSheet};
