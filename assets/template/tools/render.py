"""Generate a bilingual deck from content/deck.json. No external dependencies."""
from pathlib import Path
import html,json,math,re,uuid
ROOT=Path(__file__).resolve().parent.parent
D=json.loads((ROOT/'content/deck.json').read_text(encoding='utf-8'))
translations={
 '导出可编辑 PPTX':'Export editable PPTX',
 '导出 PPTX':'Export PPTX',
 '关闭导出':'Close export',
 '文字和常规图形可编辑；图片和复杂效果保留为图像。':'Text and standard shapes are editable; images and complex effects remain images.',
 '中文版':'Chinese',
 '英文版':'English',
 '中英文各一份（ZIP）':'Chinese + English (ZIP)',
 '再次下载':'Download again',
 '文件已生成。若下载未开始，请点击下载链接。':'File is ready. If the download did not start, use the download link.',
 '导出失败，请重试。':'Export failed. Please try again.',
 '正在导出，请稍候。':'An export is in progress. Please wait.',
 '导出组件未加载，请刷新后重试。':'The export component did not load. Refresh and try again.',
 '图片无法读取，请确认资源已加载后重试。':'An image could not be read. Wait for it to load and try again.',
 '样式无法读取，请从演示原地址打开后重试。':'Styles could not be read. Open the presentation at its original address and try again.',

 '屏蔽页面':'Hide slides',
 '恢复全部':'Restore all',
 '取消':'Cancel',
 '保存':'Save',
 '不演示':'Hidden',
 '勾选不演示的页面，再保存':'Select slides to hide, then save',
 '至少保留一页用于演示':'Keep at least one slide in the presentation',
 '仅当前浏览器生效':'Applies only to this browser',
 '已屏蔽':'Hidden',
 '已保存页面屏蔽设置':'Slide visibility settings saved',
 '浏览器无法保存设置，本次会话仍会生效':'Settings could not be saved in this browser; they still apply to this session',
 '已屏蔽，请在目录中恢复后演示':'Hidden. Restore this slide in the overview to present it',

 '开场':'Opening','演示控制':'Presentation controls','上一页':'Previous slide','下一页':'Next slide',
 '上一页 · ← / Page Up':'Previous slide · ← / Page Up','下一页 · → / 空格':'Next slide · → / Space',
 '打开目录 · G':'Open overview · G','目录':'Overview','目录 · G':'Overview · G','全屏':'Fullscreen',
 '全屏 · F':'Fullscreen · F','退出全屏':'Exit fullscreen','演示章节':'Presentation chapters',
 '切换到英文':'Switch to English','演示目录':'Presentation overview','关闭目录':'Close overview',
 '点击页面直接跳转':'Click a slide to jump','Esc 关闭':'Esc to close',
 '自动演示':'Auto presentation','暂停':'Pause','继续':'Continue','重播':'Replay','完整示意':'Show all',
 '当前浏览器不支持网页全屏，可使用浏览器的全屏功能。':'Use your browser fullscreen mode.',
 '全屏未能开启，可使用浏览器的全屏功能。':'Use your browser fullscreen mode.'
}
def source(value):
 if isinstance(value,dict):
  if set(value)!= {'zh','en'} or not all(isinstance(value[k],str) for k in value): raise ValueError('Bilingual text requires {zh: string, en: string}')
  zh,en=value['zh'],value['en']
  if zh in translations and translations[zh]!=en:raise ValueError('Conflicting translation: '+zh)
  translations[zh]=en;return zh
 if not isinstance(value,str):raise ValueError('Text requires a string or zh/en object')
 return value

def text(value):return html.escape(source(value),quote=True)
def items(values,tag='span'):return ''.join(f'<{tag}>{text(v)}</{tag}>' for v in values)
def bounded(values,low,high,label):
 if not low<=len(values)<=high:raise ValueError(f'{label} must contain {low}–{high} items; split dense content into another slide')
 return values

def body(slide):
 kind=slide['type']
 if kind=='cards':
  cards=bounded(slide['cards'],2,4,'cards')
  layout=slide.get('layout','columns'); numbered=slide.get('numbered',False)
  if layout not in ('columns','rows'):raise ValueError('cards layout must be columns or rows')
  if not isinstance(numbered,bool):raise ValueError('cards numbered must be a boolean')
  container='kit-card-rows' if layout=='rows' else 'kit-cards'
  card_class='kit-card-row' if layout=='rows' else 'kit-card'
  rendered=[]
  for i,c in enumerate(cards):
   emphasis=c.get('emphasis',False)
   if not isinstance(emphasis,bool):raise ValueError('card emphasis must be a boolean')
   cls=card_class+(' is-emphasis' if emphasis else '')
   number=f'<span class="kit-index">{i+1:02}</span>' if numbered else ''
   rendered.append(f'<article class="{cls}">{number}<h3>{text(c["title"])}</h3><p>{text(c["body"])}</p></article>')
  return f'<div class="{container}">'+''.join(rendered)+'</div>'
 if kind=='spotlight':
  lead=slide.get('lead'); points=slide.get('points')
  if not isinstance(lead,dict) or not {'title','body'}<=lead.keys():raise ValueError('spotlight lead requires title and body')
  if not isinstance(points,list):raise ValueError('spotlight points must be a list')
  bounded(points,2,4,'spotlight points')
  for point in points:
   if not isinstance(point,dict) or not {'title','body'}<=point.keys():raise ValueError('each spotlight point requires title and body')
  return '<div class="kit-spotlight"><div class="kit-spotlight-lead"><h3>'+text(lead['title'])+'</h3><p>'+text(lead['body'])+'</p></div><div class="kit-spotlight-points">'+''.join('<article><h3>'+text(point['title'])+'</h3><p>'+text(point['body'])+'</p></article>' for point in points)+'</div></div>'
 if kind=='metrics':
  metrics=bounded(slide['metrics'],2,4,'metrics')
  return '<div class="kit-metrics">'+''.join(f'<article><b>{text(c["value"])}</b><h3>{text(c["label"])}</h3><p>{text(c.get("body",""))}</p></article>' for c in metrics)+'</div>'
 if kind=='architecture':
  layers=bounded(slide['layers'],3,5,'layers')
  return '<div class="kit-layers">'+''.join('<div class="kit-layer"><h3>'+text(c['label'])+'</h3><div>'+items(bounded(c['items'],1,4,'layer items'))+'</div></div>' for c in layers)+'</div>'
 if kind=='comparison':
  columns=bounded(slide['columns'],2,2,'comparison columns')
  rendered=[]
  for c in columns:
   label=text(c.get('kicker','')); kicker='<span class="kit-index">'+label+'</span>' if label.strip() else ''
   rendered.append('<article>'+kicker+'<h3>'+text(c['title'])+'</h3><p>'+text(c['summary'])+'</p><ul>'+items(bounded(c['bullets'],1,4,'comparison bullets'),'li')+'</ul></article>')
  return '<div class="kit-compare">'+''.join(rendered)+'</div>'
 if kind=='table':
  headers=bounded(slide['headers'],2,6,'table columns'); rows=bounded(slide['rows'],1,6,'table rows')
  for row in rows:
   if len(row)!=len(headers):raise ValueError('Every table row must match the header count')
  colgroup=''
  if 'columnWidths' in slide:
   widths=slide['columnWidths']
   if not isinstance(widths,list) or len(widths)!=len(headers):raise ValueError('table columnWidths must be a list matching the header count')
   if not all(type(width) in (int,float) and 0<width<=100 and math.isfinite(width) for width in widths) or not math.isclose(sum(widths),100,rel_tol=0,abs_tol=1e-9):raise ValueError('table columnWidths must contain positive finite numbers totaling 100')
   colgroup='<colgroup>'+''.join(f'<col style="width:{width:g}%">' for width in widths)+'</colgroup>'
  note=('<div class="kit-note">'+text(slide['note'])+'</div>') if slide.get('note') else ''
  return '<table class="kit-table">'+colgroup+'<thead><tr>'+items(headers,'th')+'</tr></thead><tbody>'+''.join('<tr>'+items(row,'td')+'</tr>' for row in rows)+'</tbody></table>'+note
 if kind=='workflow':
  steps=bounded(slide['steps'],3,5,'workflow steps')
  return '<div class="kit-toolbar"><span data-flow-status>自动演示</span><div><button data-flow-play>暂停</button><button data-flow-replay>重播</button><button data-flow-all>完整示意</button></div></div><div class="kit-flow">'+''.join(f'<article data-flow-step="{i}"><span class="kit-index">{i+1:02}</span><h3>{text(c["title"])}</h3><p>{text(c["body"])}</p></article>' for i,c in enumerate(steps))+'</div><div class="kit-note">'+text(slide.get('result',''))+'</div>'
 if kind=='image':
  path=slide['image']
  if not re.fullmatch(r'assets/[A-Za-z0-9_-]+\.(png|jpg|jpeg|svg|webp)',path):raise ValueError('Image must be a local assets/file.ext')
  if not (ROOT/path).is_file():raise ValueError('Missing image: '+path)
  return '<div class="kit-image"><img src="'+text(path)+'" alt="'+text(slide.get('alt',''))+'"><aside><h3>'+text(slide['caption'])+'</h3><p>'+text(slide.get('body',''))+'</p></aside></div>'
 if kind=='custom':
  # The agent owns these local HTML fragments. Keep input strings out of executable code.
  fragment=slide['fragment']
  if not re.fullmatch(r'content/[A-Za-z0-9_-]+\.html',fragment):raise ValueError('Custom fragment must be content/name.html')
  for zh,en in slide.get('translations',{}).items():source({'zh':zh,'en':en})
  return (ROOT/fragment).read_text(encoding='utf-8')
 raise ValueError('Unknown slide type: '+kind)

if not re.fullmatch(r'[a-z][a-z0-9-]{2,62}',D['id']):raise ValueError('id must be a unique lowercase project slug, 3–63 characters')
if not D.get('slides'):raise ValueError('At least one slide is required')

# Persist generated identities so a page remains the same after rename, reorder or insertion.
assigned_ids=False
seen_ids=set()
for slide in D['slides']:
 if 'id' not in slide:
  slide['id']='slide-'+uuid.uuid4().hex[:12];assigned_ids=True
 slide_id=slide['id']
 if not isinstance(slide_id,str) or not re.fullmatch(r'[a-z][a-z0-9-]{0,62}',slide_id):raise ValueError('Slide id must be a stable lowercase slug')
 if slide_id in seen_ids:raise ValueError('Duplicate slide id: '+slide_id)
 seen_ids.add(slide_id)

chapters=[]
for c in D.get('chapters',[]):chapters.append({'label':source(c['label']),'section':source(c['section'])})
if len(chapters)>5:raise ValueError('Use at most five navigation chapters')
slides=[]
for i,s in enumerate(D['slides']):
 title=text(s['title']); section=text(s.get('section','开场')); n=f'{i+1:02}'
 header=f'<header class="slide-header"><img class="brand" src="assets/huawei-logo.png" alt="HUAWEI"><span>{text(D.get("brandLabel","HUAWEI CLOUD"))}</span></header>'
 if s['type']=='cover':
  backgrounds={'原山景':'assets/mountains.jpg','云山':'assets/yunshan.png','金沙':'assets/jinsha.png'}
  background=s.get('background','原山景')
  if background not in backgrounds:raise ValueError('Unknown cover background: '+background)
  image=backgrounds[background]
  content=header+f'<div class="cover-landscape" style="background-image:linear-gradient(180deg,#f7f9fc 0%,#f7f9fcbd 18%,#f7f9fc00 43%),url(&quot;{image}&quot;)"></div><div class="cover-copy"><div class="eyebrow"><span class="red-rule"></span>{text(s.get("eyebrow","PRODUCT BRIEFING"))}</div><h1>{title}</h1><p class="cover-subtitle">{text(s.get("subtitle",""))}</p><div class="cover-line"></div><p class="cover-english">{text(s.get("tagline","HUAWEI CLOUD"))}</p></div><div class="cover-bottom"><span>PRODUCT BRIEFING</span><span>{text(D.get("brandLabel","HUAWEI CLOUD"))}</span></div>'
  cls='cover'
 elif s['type']=='closing':
  thanks=s.get('thanks',{'zh':'','en':'Thank You'})
  vision=s.get('vision',{'zh':'把数字世界带入每个人、每个家庭、\n每个组织，构建万物互联的智能世界。','en':'Bring digital to every person, home and organization\nfor a fully connected, intelligent world.'})
  for value in [thanks,vision]:
   if not isinstance(value,dict) or set(value)!={'zh','en'} or not all(isinstance(v,str) for v in value.values()):raise ValueError('Closing copy requires simultaneous zh/en strings')
  logo=s.get('logo','assets/huawei-logo.png')
  if not isinstance(logo,str) or not re.fullmatch(r'assets/[A-Za-z0-9_-]+\.(png|jpg|jpeg|svg|webp)',logo) or not (ROOT/logo).is_file():raise ValueError('Closing logo must be an existing local assets/file.ext')
  motion=s.get('motion','fade')
  if motion not in {'fade','none'}:raise ValueError('Closing motion must be fade or none')
  secondary=f'<p lang="zh-CN">{text(thanks["zh"])}</p>' if thanks['zh'] else ''
  vision_label=f'<div class="closing-vision-label">{text(s["visionLabel"])}</div>' if s.get('visionLabel') else ''
  content=f'<div class="closing-layout" data-no-translate data-closing-motion="{motion}"><div class="closing-greeting"><h1 lang="en">{text(thanks["en"])}</h1>{secondary}</div><div class="closing-vision">{vision_label}<p class="closing-vision-zh" lang="zh-CN">{text(vision["zh"])}</p><p class="closing-vision-en" lang="en">{text(vision["en"])}</p><img class="closing-logo" src="{text(logo)}" alt="{text(s.get("logoAlt","HUAWEI"))}"></div></div>'
  cls='closing-slide'
 else:
  label=text(s.get('eyebrow','')); eyebrow=f'<div class="eyebrow">{label}</div>' if label.strip() else ''
  content=header+f'<div class="heading">{eyebrow}<h2>{title}</h2><p>{text(s.get("subtitle",""))}</p></div><div class="kit-body">'+body(s)+'</div>'+f'<footer class="slide-footer"><span>{text(s.get("footer",D.get("footer","HUAWEI CLOUD")))}</span><span>{n}</span></footer>'
  cls='kit-slide'
 slides.append(f'<section class="slide {cls}{" active" if i==0 else ""}" data-slide-id="{text(s["id"])}" data-title="{title}" data-section="{section}" aria-label="第 {i+1} 页：{title}">{content}</section>')
# All source strings were registered before exporting translations.
config={'id':D['id'],'chapters':chapters}
(ROOT/'js/config.js').write_text('window.DeckConfig = '+json.dumps(config,ensure_ascii=False)+';\n',encoding='utf-8')
(ROOT/'js/translations.js').write_text('window.DeckEnglish = '+json.dumps(translations,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
shell=(ROOT/'content/shell.html').read_text(encoding='utf-8').replace('{{TITLE}}',text(D['title'])).replace('{{SLIDES}}','\n'.join(slides))
# Document title may itself be bilingual.
(ROOT/'js/translations.js').write_text('window.DeckEnglish = '+json.dumps(translations,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(ROOT/'index.html').write_text(shell,encoding='utf-8')
if assigned_ids:(ROOT/'content/deck.json').write_text(json.dumps(D,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Generated {len(slides)} slides for {D["id"]}')
