# 浏览器导出可编辑 PPTX

底部工具栏的 **⇩ PPTX** 打开导出窗口：中文版、英文版、中英文各一份。双语选项下载一个 ZIP，包含两份 PPTX，避免浏览器拦截多个自动下载。生成完成后保留再次下载链接。默认只导出目录中保留的页面，顺序与原稿一致。

导出在本机浏览器中进行，无 CDN、上传接口、模型 API 或服务端渲染。正式发布项目沿用现有访问控制；增加按钮本身不授权发布。单文件 HTML 会内嵌库和资源。多文件页面离线时，已加载资源可复用；尚未加载的图片仍需要能读取。

## 可编辑范围

- 标题、正文、页脚、章节文字为 PowerPoint 文本框，支持修改文字、字体和颜色。
- 卡片背景、边框、分隔线、表格单元格及常规 DOM 图示由原生图形与文本组成，可逐项编辑；表格不是 PowerPoint 原生整表组件。
- Logo、插图、SVG、Canvas 和包含图片/渐变的背景为图片对象，可移动或替换。
- 画布保持 16:9。按浏览器实际换行生成文本框，便于保留原有布局；大幅改写后可能需要调整文本框大小或换行。
- 中文字体使用 Microsoft YaHei，英文字体使用 Arial。字体不嵌入文件，打开设备缺少字体时由办公软件替换，可能改变字形和排版。
- 动画、悬停效果、网页交互、视频播放及嵌入网页不写入 PPTX；流程按完整静态内容导出。自定义图形应在导出后的文件中检查。

## 实现约定

`content/shell.html` 以 defer 顺序加载 `js/pptxgenjs.js`、`js/pptx-export.js`。保持现有 `js/[a-z0-9-]+.js` 命名，离线与发布构建可自动收集，避免依赖外部脚本 URL。

`DeckI18n.cloneForLanguage(source, language)` 从原始双语记录创建副本。导出在固定1600×900离屏 iframe 排版，避免改变原稿语言、页面位置、播放状态或本地屏蔽设置。PPTX 几何坐标按 120px/英寸转换，CSS 字号按同一比例转为磅。

`window.DeckPptx.export({language:'zh'|'en'|'both', download:false, onProgress})` 返回 `[{language, fileName, blob, pageCount}]`。省略 download 或设为 true 时触发下载；双语以 ZIP 下载。默认语言是当前界面语言。失败必须释放运行状态，保留重试入口，不把空文件当成功。

## 验证

运行 `npm run build`、`npm test`，再以本地 HTTP 服务运行 `npm run test:pptx`。该专用检查真实点击按钮、接收下载并验证 PPTX 包、页数、文本对象、关系目标与形状 ID；覆盖两种语言、双语 ZIP、屏蔽页、离线状态、失败重试和手机控件。

至少在一种支持 PPTX 的办公软件中打开文件，抽查封面、中文长段落、英文表格、流程和复杂图示。软件读取成功与 PowerPoint 实机测试是不同证据，未实际使用 PowerPoint 时应如实说明。

依赖：PptxGenJS 4.0.1 浏览器 bundle（含 JSZip），按 MIT 条款内置；许可证位于模板 docs/。来源与版本见 ASSETS.md。API 依据 [PptxGenJS 文本](https://gitbrent.github.io/PptxGenJS/docs/api-text/)、[图形](https://gitbrent.github.io/PptxGenJS/docs/api-shapes/)及[保存](https://gitbrent.github.io/PptxGenJS/docs/usage-saving/)文档。
