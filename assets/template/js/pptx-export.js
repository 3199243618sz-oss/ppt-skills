/* Editable PPTX from a fixed-size, localized copy of the rendered slide DOM. */
(function () {
  'use strict';
  const PX = 120, PT = 72 / PX;
  const skip = 'script,style,button,input,textarea,select,iframe,video,audio,.kit-toolbar,[data-pptx-exclude]';
  let exporting = false;
  const t = value => window.DeckI18n?.t(value) || value;
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const styles = el => el.ownerDocument.defaultView.getComputedStyle(el);
  const rect = el => { const r = el.getBoundingClientRect(); return {x:r.left/PX,y:r.top/PX,w:r.width/PX,h:r.height/PX}; };
  function color(value) {
    const match = value.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null;
    const c = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (c.length < 3 || c.some(v => !Number.isFinite(v))) return null;
    return {color:c.slice(0,3).map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),transparency:Math.round((1-(c[3]??1))*100)};
  }
  function visible(el) {
    if (!el.getClientRects().length || el.closest(skip)) return false;
    for (let p=el; p; p=p.parentElement) {
      const s=styles(p);
      if (s.display==='none' || s.visibility==='hidden' || Number(s.opacity)===0) return false;
    }
    return true;
  }
  function loadImage(url) {
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img); img.onerror=()=>reject(Error(t('图片无法读取，请确认资源已加载后重试。')));
      img.src=url;
    });
  }
  const dataCache=new Map();
  async function imageData(url) {
    if (url.startsWith('data:')) return url;
    if (!dataCache.has(url)) dataCache.set(url,(async()=>{
      const img=await loadImage(url),canvas=document.createElement('canvas');
      canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
      canvas.getContext('2d').drawImage(img,0,0);
      return canvas.toDataURL('image/png');
    })().catch(error=>{dataCache.delete(url);throw error;}));
    return dataCache.get(url);
  }
  async function svgPng(svg,width,height) {
    const img=await loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);
    canvas.getContext('2d').drawImage(img,0,0,width,height);
    return canvas.toDataURL('image/png');
  }
  async function backgroundImage(el,s) {
    let background=s.backgroundImage;
    const matches=[...background.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
    for (const match of matches) background=background.replace(match[0],`url("${await imageData(new URL(match[1],document.baseURI).href)}")`);
    const box=el.getBoundingClientRect(),div=document.createElementNS('http://www.w3.org/1999/xhtml','div');
    div.setAttribute('style',`width:${box.width}px;height:${box.height}px;background-image:${background};background-size:${s.backgroundSize};background-position:${s.backgroundPosition};background-repeat:${s.backgroundRepeat};background-color:${s.backgroundColor};`);
    return svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(div)}</foreignObject></svg>`,box.width,box.height);
  }
  function materializePseudos(slide) {
    for (const el of [slide,...slide.querySelectorAll('*')]) {
      if (el.closest(skip)) continue;
      for (const which of ['::before','::after']) {
        const s=el.ownerDocument.defaultView.getComputedStyle(el,which);
        if (s.content==='none' || s.content==='normal' || s.display==='none') continue;
        const part=el.ownerDocument.createElement('span');
        for (const key of s) part.style.setProperty(key,s.getPropertyValue(key));
        part.style.setProperty('animation','none');part.style.setProperty('transition','none');
        part.textContent=s.content.replace(/^['"]|['"]$/g,'');
        part.dataset.pptxPseudo='true';
        if (which==='::before') el.prepend(part); else el.append(part);
      }
    }
    const suppress=slide.ownerDocument.createElement('style');
    suppress.textContent='*::before,*::after{content:none!important}';
    slide.ownerDocument.head.append(suppress);
    return suppress;
  }
  async function createFrame(language) {
    const frame=document.createElement('iframe');
    frame.title='PPTX export';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
    frame.style.cssText='position:fixed;left:-24000px;top:0;width:1600px;height:900px;border:0;pointer-events:none';
    document.body.append(frame);
    try {
      const doc=frame.contentDocument;
      doc.documentElement.lang=language==='en'?'en':'zh-CN';
      doc.body.className=language==='en'?'english-deck':'';
      const css=[];
      for (const sheet of document.styleSheets) {
        try { css.push([...sheet.cssRules].map(rule=>rule.cssText).join('\n')); }
        catch { throw Error(t('样式无法读取，请从演示原地址打开后重试。')); }
      }
      const base=doc.createElement('base');base.href=document.baseURI;doc.head.append(base);
      const style=doc.createElement('style');
      style.textContent=css.join('\n')+'\nhtml,body{margin:0!important;width:1600px!important;height:900px!important;overflow:hidden!important}#deck{position:relative!important;width:1600px!important;height:900px!important;transform:none!important;box-shadow:none!important}.slide{display:block!important;position:absolute!important;inset:0!important;width:1600px!important;height:900px!important;animation:none!important}.is-concealed{visibility:visible!important;opacity:1!important;transform:none!important}.kit-toolbar{visibility:hidden!important}*,*::before,*::after{animation:none!important;transition:none!important}.kit-flow article{border-top:3px solid #c7000b!important}';
      doc.head.append(style);
      const deck=doc.createElement('div');deck.id='deck';doc.body.append(deck);
      await doc.fonts.ready;
      return {frame,doc,deck};
    } catch(error) {frame.remove();throw error;}
  }
  function addBox(pptSlide,el) {
    const s=styles(el),r=rect(el);
    if (r.w<=0 || r.h<=0) return;
    const fill=color(s.backgroundColor);
    if (fill && fill.transparency<100) {
      const radius=parseFloat(s.borderRadius)||0;
      pptSlide.addShape(radius>0?'roundRect':'rect',{...r,fill,line:{transparency:100},radius:radius/PX,rectRadius:Math.min(.5,radius/PX)});
    }
    for (const [side,x,y,w,h] of [
      ['Top',r.x,r.y,r.w,0],['Bottom',r.x,r.y+r.h,r.w,0],
      ['Left',r.x,r.y,0,r.h],['Right',r.x+r.w,r.y,0,r.h]
    ]) {
      const width=parseFloat(s['border'+side+'Width']),ink=color(s['border'+side+'Color']);
      if (width>0 && ink && ink.transparency<100 && s['border'+side+'Style']!=='none') pptSlide.addShape('line',{x,y,w,h,line:{...ink,width:width*PT,dashType:s['border'+side+'Style']==='dashed'?'dash':'solid'}});
    }
  }
  function textLines(node) {
    const range=node.ownerDocument.createRange(),lines=[];
    const segments=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(node.nodeValue)].map(x=>({text:x.segment,index:x.index})):Array.from(node.nodeValue).map((text,index)=>({text,index}));
    let lastSpace=false;
    for (const {text,index} of segments) {
      range.setStart(node,index);range.setEnd(node,index+text.length);
      const r=range.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const space=/^\s+$/.test(text);
      if (space && lastSpace) continue;
      lastSpace=space;
      let line=lines.at(-1);
      if (!line || Math.abs(line.top-r.top)>2) {line={text:'',left:r.left,right:r.right,top:r.top,height:r.height};lines.push(line);}
      line.text+=space?' ':text;line.left=Math.min(line.left,r.left);line.right=Math.max(line.right,r.right);
    }
    return lines.map(line=>({...line,text:line.text.trim()})).filter(line=>line.text);
  }
  function addText(pptSlide,node) {
    if (!node.nodeValue.trim() || !visible(node.parentElement)) return;
    const el=node.parentElement,s=styles(el),lines=textLines(node);
    if (!lines.length) return;
    const size=parseFloat(s.fontSize),step=lines.length>1?lines[1].top-lines[0].top:parseFloat(s.lineHeight)||size*1.2;
    const left=Math.min(...lines.map(x=>x.left)),right=Math.max(...lines.map(x=>x.right));
    const lang=el.ownerDocument.documentElement.lang;
    const fontFace=/Arial/i.test(s.fontFamily)?'Arial':lang==='en'?'Arial':'Microsoft YaHei';
    const options={x:left/PX,y:(lines[0].top-(step-lines[0].height)/2)/PX,w:(right-left+4)/PX,h:(step*lines.length)/PX,fontFace,fontSize:size*PT,bold:Number(s.fontWeight)>=600,italic:s.fontStyle==='italic',color:color(s.color)?.color||'222326',margin:0,breakLine:false,paraSpaceAfter:0,paraSpaceBefore:0,lineSpacing:step*PT,valign:'mid',align:['center','right'].includes(s.textAlign)?s.textAlign:'left',wrap:false,fit:'shrink',lang:lang==='en'?'en-US':'zh-CN'};
    if (s.letterSpacing!=='normal') options.charSpacing=parseFloat(s.letterSpacing)*PT;
    if (s.textDecorationLine.includes('underline')) options.underline=true;
    pptSlide.addText(lines.map(line=>line.text).join('\n'),options);
    if (el.tagName==='LI' && s.listStyleType!=='none') pptSlide.addShape('ellipse',{x:options.x-.13,y:options.y+step/PX*.4,w:.035,h:.035,line:{transparency:100},fill:{color:options.color}});
  }
  async function addElement(pptSlide,el) {
    if (!visible(el)) return;
    const s=styles(el),r=rect(el);
    addBox(pptSlide,el);
    if (s.backgroundImage!=='none' && r.w>0 && r.h>0) pptSlide.addImage({data:await backgroundImage(el,s),...r});
    if (el.tagName==='IMG') {
      const data=await imageData(el.currentSrc||el.src);
      const image=await loadImage(data),nw=image.naturalWidth,nh=image.naturalHeight;
      let box=r;
      if (s.objectFit==='contain') {
        const scale=Math.min(r.w/nw,r.h/nh),w=nw*scale,h=nh*scale;
        box={x:r.x+(r.w-w)/2,y:r.y+(r.h-h)/2,w,h};
      }
      pptSlide.addImage({data,...box,altText:el.alt||'Image'});return;
    }
    if (el.tagName.toLowerCase()==='svg') {
      const clone=el.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
      const originals=[el,...el.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
      originals.forEach((item,i)=>{const st=styles(item);for(const key of ['fill','stroke','stroke-width','font-family','font-size','font-weight'])copies[i].style.setProperty(key,st.getPropertyValue(key));});
      pptSlide.addImage({data:await svgPng(new XMLSerializer().serializeToString(clone),r.w*PX,r.h*PX),...r,altText:el.getAttribute('aria-label')||'Diagram'});return;
    }
    if (el.tagName==='CANVAS') {pptSlide.addImage({data:el.toDataURL('image/png'),...r});return;}
    // Positioned brand headers can appear before their backdrop in DOM order.
    const children=[...el.childNodes].map((node,index)=>({node,index,z:node.nodeType===1?parseInt(styles(node).zIndex,10)||0:0})).sort((a,b)=>a.z-b.z||a.index-b.index);
    for (const {node:child} of children) {
      if (child.nodeType===3) addText(pptSlide,child);
      else if (child.nodeType===1) await addElement(pptSlide,child);
    }
  }
  function downloadBlob(blob,fileName) {
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  async function deliver(files) {
    if (files.length===1) return {blob:files[0].blob,fileName:files[0].fileName};
    const zip=new window.JSZip();for (const file of files) zip.file(file.fileName,await file.blob.arrayBuffer());
    return {blob:await zip.generateAsync({type:'blob',compression:'DEFLATE'}),fileName:window.DeckConfig.id+'-zh-en.zip'};
  }
  async function exportPptx({language=window.DeckI18n?.language||'zh',download=true,onProgress=()=>{}}={}) {
    if (!['zh','en','both'].includes(language)) throw Error('Language must be zh, en or both.');
    if (exporting) throw Error(t('正在导出，请稍候。'));
    if (!window.PptxGenJS) throw Error(t('导出组件未加载，请刷新后重试。'));
    const sources=[...document.querySelectorAll('#deck > .slide:not(.is-skipped)')];
    if (!sources.length) throw Error(t('至少保留一页用于演示'));
    exporting=true;
    try {
      await document.fonts.ready;
      const files=[];
      for (const lang of language==='both'?['zh','en']:[language]) {
        const context=await createFrame(lang);
        try {
          const pptx=new window.PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='';pptx.subject='Editable presentation export';pptx.title=document.title;pptx.company='';pptx.lang=lang==='en'?'en-US':'zh-CN';
          pptx.theme={headFontFace:lang==='en'?'Arial':'Microsoft YaHei',bodyFontFace:lang==='en'?'Arial':'Microsoft YaHei',lang:pptx.lang};
          for (let index=0;index<sources.length;index++) {
            onProgress({language:lang,index:index+1,total:sources.length});
            const copy=window.DeckI18n.cloneForLanguage(sources[index],lang);
            copy.classList.remove('is-skipped','active');copy.removeAttribute('inert');copy.removeAttribute('aria-hidden');
            window.DeckCompleteScenePreview?.(copy);
            const sourceImages=[...sources[index].querySelectorAll('img')];
            await Promise.all([...copy.querySelectorAll('img')].map(async(img,i)=>{
              const original=sourceImages[i];
              let data;
              if(original.complete && original.naturalWidth){
                const canvas=document.createElement('canvas');canvas.width=original.naturalWidth;canvas.height=original.naturalHeight;
                canvas.getContext('2d').drawImage(original,0,0);data=canvas.toDataURL('image/png');
              }else data=await imageData(original.currentSrc||original.src);
              img.removeAttribute('srcset');img.src=data;
            }));
            context.deck.replaceChildren(copy);
            await context.doc.fonts.ready;
            await Promise.all([...copy.querySelectorAll('img')].map(img=>img.decode().catch(()=>{throw Error(t('图片无法读取，请确认资源已加载后重试。'));})));
            // Canvas content is not cloned by cloneNode.
            sources[index].querySelectorAll('canvas').forEach((canvas,i)=>{const target=copy.querySelectorAll('canvas')[i];target.getContext('2d').drawImage(canvas,0,0);});
            const pseudoStyle=materializePseudos(copy),slide=pptx.addSlide();
            slide.background={color:'FFFFFF'};
            await addElement(slide,copy);
            slide.addNotes(`Source slide ${index+1}: ${sources[index].dataset.slideId||''}\nEditable text and standard shapes. Images, SVG and decorative backgrounds remain images. Interactive controls and animation are omitted.`);
            pseudoStyle.remove();await tick();
          }
          const blob=await pptx.write({outputType:'blob',compression:true});
          files.push({language:lang,fileName:window.DeckConfig.id+'-'+lang+'.pptx',blob,pageCount:sources.length});
        } finally {context.frame.remove();}
      }
      if (download) {const file=await deliver(files);downloadBlob(file.blob,file.fileName);}
      return files;
    } finally {exporting=false;}
  }
  window.DeckPptx={export:exportPptx};
  const button=document.getElementById('export-pptx'),dialog=document.getElementById('pptx-dialog');
  if (!button || !dialog) return;
  const status=document.getElementById('pptx-status'),links=document.getElementById('pptx-downloads'),close=document.getElementById('pptx-close');
  let busy=false,urls=[];
  function setBusy(value) {busy=value;dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('[data-pptx-language]').forEach(b=>b.disabled=value);close.disabled=value;}
  button.addEventListener('click',()=>{
    const n=document.querySelectorAll('#deck > .slide:not(.is-skipped)').length;
    document.getElementById('pptx-page-count').textContent=window.DeckI18n.language==='en'?`${n} slides · Hidden slides are excluded`:`${n} 页 · 不导出已屏蔽页面`;
    dialog.showModal();dialog.querySelector(`[data-pptx-language="${window.DeckI18n.language}"]`).focus();
  });
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('close',()=>button.focus());
  dialog.querySelectorAll('[data-pptx-language]').forEach(choice=>choice.addEventListener('click',async()=>{
    if (busy) return;
    setBusy(true);status.classList.remove('is-error');links.replaceChildren();urls.forEach(URL.revokeObjectURL);urls=[];
    try {
      const files=await window.DeckPptx.export({language:choice.dataset.pptxLanguage,download:false,onProgress:({language,index,total})=>{status.textContent=window.DeckI18n.language==='en'?`Preparing ${language.toUpperCase()}: ${index} / ${total}`:`正在生成${language==='zh'?'中文':'英文'}版：${index} / ${total}`;}});
      const file=await deliver(files),url=URL.createObjectURL(file.blob);urls.push(url);
      const link=document.createElement('a');link.href=url;link.download=file.fileName;link.textContent=t('再次下载');links.append(link);link.click();
      status.textContent=t('文件已生成。若下载未开始，请点击下载链接。');
    } catch(error) {status.classList.add('is-error');status.textContent=t('导出失败，请重试。')+' '+error.message;}
    finally {setBusy(false);}
  }));
})();
