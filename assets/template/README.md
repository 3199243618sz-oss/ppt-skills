# 华为产品演示模板

这是独立的 HTML 演示项目。默认内容是占位示例，所有产品结论、指标、价格与容量都需要填写。可直接生成离线文件；在线发布为独立的可选步骤。

## 只改内容

编辑 `content/deck.json`，然后执行：

```sh
npm run build
python3 -m http.server 8798 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8798/`，英文地址加 `?lang=en`，指定页加 `#slide=2`。

- `content/deck.json`：产品、章节、各页内容；双语文字使用 `{"zh":"中文","en":"English"}`。
- `css/`：画布、组件和英文样式。
- `js/`：翻页、目录、全屏、双语和轻量流程动效。
- `content/shell.html`：公共 HTML 骨架；增加自定义页面时使用 `custom` 类型和独立片段。
- `index.html`、`js/config.js`、`js/translations.js` 是生成文件；请修改内容文件再生成。
- 默认 build 仅生成多文件网页。用户明确要求后才使用导出命令；单文件 HTML 内嵌样式、图片和脚本，可直接打开。

支持 cover/cards/metrics/architecture/comparison/table/workflow/image/custom/closing。closing 提供纯白 Thank You、双语愿景与较大 Huawei Logo。不要把业务文案写进公共控制器；新增复杂布局时增加组件或 custom 片段。

## 检查

Node.js 20+、Python 3；普通生成和构建不需要安装运行依赖。Windows 可把命令中的 `python3` 改为本机的 `python`。

```sh
npm test
# 浏览器检查需要安装 Playwright 及浏览器，或使用已有 Chromium
npm install --no-save playwright
npx playwright install chromium
DECK_URL=http://127.0.0.1:8798/index.html npm run test:browser
```

可设置 `BROWSER_EXECUTABLE` 指向已有 Chromium。浏览器检查覆盖双语、三种视口、目录、翻页、动效暂停/完整展示、离页停止、减少动态效果和打印。逐页中英截图输出到 `qa/slides/`，全稿总览为 `qa/contact-zh.png` 和 `qa/contact-en.png`；浏览器检查验证打印样式但不生成 PDF。

## 一键导出

制作完成后提示用户也可以导出单文件 HTML 或 PDF；除非用户明确要求，否则不运行以下命令。仅导出用户指定格式。

```sh
npm run export:html
npm run export:pdf -- --lang zh
npm run export:pdf -- --lang en
npm run export -- --lang both
```

加 `--slides "1,3-5,thank-you"` 可按页码、范围或稳定 ID 选页，按参数顺序去重输出且不改原稿，HTML/PDF 都支持。

文件写入 dist/exports/；`--output-dir "目标目录"` 可改变位置。HTML 保留交互与双语切换；PDF 是指定语言的静态全页内容，忽略日常浏览器中的屏蔽设置。PDF 首次需安装 Playwright 与 Chromium（同浏览器检查），脚本自动启动并关闭本地预览服务，无需 Agent 重写代码。`node tools/export.cjs --help` 查看参数；可使用 BROWSER_EXECUTABLE 指定已有 Chromium，PYTHON_EXECUTABLE 指定 Python。

`npm run build`、默认 npm test 和浏览器检查不导出单文件 HTML/PDF，也不构建 Cloudflare 目录。`npm run test:export:html` 与 `npm run test:export` 为显式导出验证命令。仅明确要求发布时执行下面的平台命令；普通内容和样式更新不需要修改部署适配器。平台构建检查另用 npm run test:deployment。

## Cloudflare

`deploy/cloudflare/wrangler.json` 必须使用新项目的 Worker 名称；默认无自定义域名。

```sh
npx wrangler login
npm run build:cloudflare
npx wrangler secret put ACCESS_PIN --config deploy/cloudflare/wrangler.json
npx wrangler deploy --config deploy/cloudflare/wrangler.json
```

已有授权可直接复用当前登录，无需重复登录。以上命令的 PIN 交互输入，不写入网页、内容文件或 Git。缺少 `ACCESS_PIN` 时站点返回 503；登录后签名 Cookie 有效 24 小时。PIN 更新使旧 Cookie 失效。所有静态资源都经过 Worker 检查。

本地 Worker 预览：在 `deploy/cloudflare/.dev.vars` 设置本地 `ACCESS_PIN`，再运行 `npm run dev:cloudflare`。`.dev.vars` 被 Git 忽略。本地静态预览和离线 HTML 无服务端 PIN；不要把离线文件视为受保护的发布渠道。

## Sites

`npm run build:sites` 输出 `deploy/chatgpt-sites/dist/server/index.js`，包含 PIN 处理和内嵌网页。实际发布需当前环境的 Sites 工具和新项目的托管配置，并设置 `ACCESS_PIN`。构建脚本不登录、不发布，也不生成虚构的托管清单。

## 选择演示页面

在目录点击“屏蔽页面”，勾选不演示的页面后保存。选择只影响当前浏览器的当前演示项目，刷新后保留；支持取消、恢复全部，至少保留一页。导航和打印跳过屏蔽页，正文仍可编辑。页面 id 由生成器自动补全，也可在 deck.json 显式指定；已有 id 在改标题或排序时保持不变。

`npm run test:visibility` 检查目录选择和项目隔离，需要 Playwright 与本地预览地址。

## 可编辑 PPTX

在浏览器中点击底部 **⇩ PPTX**，选择中文版、英文版或中英文各一份（ZIP）。遵循已保存的屏蔽页设置。文字与常规图形可编辑；图片、SVG 和复杂背景保留为图片。中文使用 Microsoft YaHei、英文使用 Arial，字体不嵌入，办公软件可能替换缺少的字体。网页动效与交互不导出。

导出在浏览器本地运行，库已随项目提供。修改导出功能后执行 `npm run test:pptx`，检查真实下载和 OOXML 结构；这项测试会生成 QA 用 PPTX。
