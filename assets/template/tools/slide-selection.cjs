/* One-based page numbers, ascending ranges or stable page IDs; input order wins. */
function selectSlides(slides,spec){
 if(typeof spec!=='string'||!spec.trim())throw Error('--slides requires page numbers or IDs.');
 const indices=[],seen=new Set();
 const add=index=>{if(index<0||index>=slides.length)throw Error('Page out of range: '+(index+1));if(!seen.has(index)){seen.add(index);indices.push(index);}};
 for(const value of spec.split(',')){
  const token=value.trim();let match;
  if(/^\d+$/.test(token))add(Number(token)-1);
  else if((match=token.match(/^(\d+)-(\d+)$/))){
   const start=Number(match[1]),end=Number(match[2]);
   if(start<1||end<start||end>slides.length)throw Error('Invalid page range: '+token);
   for(let n=start;n<=end;n++)add(n-1);
  }else{
   const index=slides.findIndex(s=>s.id===token);
   if(!token||index<0)throw Error('Unknown slide: '+token);
   add(index);
  }
 }
 return indices.map(i=>slides[i]);
}
module.exports={selectSlides};
