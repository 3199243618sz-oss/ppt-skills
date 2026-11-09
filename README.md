# Huawei Product Slides

**制作华为风格 HTML 产品演示的 Agent Skill。** 你提供产品内容，Agent 负责组织章节、选择版式、生成中英双语页面、配置轻量动效、检查排版并构建交付文件。

适用于产品介绍、技术架构、方案对比、套餐说明、业务案例和 Demo 分享。

本仓库基于 [Leon00x/huawei-product-slides](https://github.com/Leon00x/huawei-product-slides)，加入内容驱动版式优化和可编辑中英文 PPTX 导出。原版在线体验不代表本仓库的最新功能；素材来源保留在 [ASSETS.md](ASSETS.md)。

[原版在线体验：封面＋空白页](https://huawei-product-slides-demo.leonguo08.workers.dev/) · [致谢页预览图](demo/thank-you-preview.png)

## 能做出什么

| 产物 | 使用方式 |
| --- | --- |
| 交互式 HTML 演示 | 浏览器打开，支持翻页、目录、语言切换与全屏 |
| 离线单文件 HTML | 图片、样式和脚本内嵌，可保存后直接打开 |
| 可编辑 PPTX | 底部按钮导出中文、英文，或包含两份文件的双语 ZIP |
| PDF | 脚本一键导出中文、英文或两份 PDF，保留完整静态内容 |
| 可编辑项目源码 | 内容、组件、样式和部署配置分别维护 |
| 在线演示站点 | 使用 Cloudflare Workers 或 Sites ESM Worker 发布 |

## 功能

- **内容驱动版式**：重点论述、行式说明和短卡片按关系选择；正文对比度增强，强调色由内容指定，表格支持按文本分配列宽。

- **品牌与排版**：华为 Logo、白底与红色强调、16:9 画布、统一页头页脚；可选择云山、金沙和山景封面。
- **十一类页面**：封面、卡片、指标、分层架构、双列对比、表格、流程、图片、自定义页面、重点论述及致谢页。
- **中英双语**：一键切换、英文独立样式、语言偏好记忆，支持双语目录和控件。
- **演示操作**：键盘翻页、手机滑动、全屏、章节跳转、缩略图目录、页码链接和阅读位置记忆。
- **屏蔽页面**：目录中选择不演示的页面并保存，翻页和章节跳转自动跳过；支持取消与恢复全部。设置按演示项目保存在当前浏览器，至少保留一页。
- **轻量动效**：流程自动高亮、暂停、重播和完整显示；离页停止，打印与减少动态效果时完整展示。
- **可选交互组件**：手动场景切换、输入/缓存输入/输出价格表等通用组件。
- **访问保护**：在线产品项目使用服务端 PIN 校验与登录 Cookie，保护网页和静态资源。
- **一键导出**：浏览器按钮生成可编辑中英 PPTX；CLI 生成单文件 HTML 和中英 PDF；支持指定输出目录，无需 Agent 逐次修改脚本。
- **全稿预览**：浏览器检查生成每页中英文截图和两张全稿总览图，方便审阅整体排版。
- **质量检查**：双语文字溢出、正文与页脚间距、目录跳转、动效、离线资源和访问控制测试。

自定义图示和业务 Demo 可按当前项目扩展。基础 Skill 不内置特定产品的 API 控制台、模型服务或代理；部署需要对应平台授权。

## 安装

将整个仓库放入 Agent 支持的技能目录，保留 `SKILL.md` 和相对目录结构。

Codex 用户级安装示例：

```sh
git clone https://github.com/3199243618sz-oss/ppt-skills.git ~/.agents/skills/huawei-product-slides
```

也可安装到项目的 `.agents/skills/huawei-product-slides/`。重新载入会话后，确认 `$huawei-product-slides` 可见。

## 使用 Skill

直接向 Agent 提供内容即可：

> 使用 $huawei-product-slides，为产品 X 制作企业客户介绍。包含定位、三项优势、架构、套餐和一个业务案例。中英双语，封面用云山。

可以继续提出页面调整、动画、图片或部署要求。Agent 根据内容生成项目，并执行排版和交互检查。

## 手动创建项目

需要 Node.js 20+ 和 Python 3。基础生成与构建无需安装 npm 依赖。

在技能仓库目录执行：

```sh
python3 scripts/init.py /path/to/my-product-deck \
  --id my-product-deck \
  --title '产品 X 介绍' \
  --title-en 'Product X briefing' \
  --starter blank

cd /path/to/my-product-deck
npm run build
npm test
```

| 起始模板 | 内容 |
| --- | --- |
| `--starter blank` | 封面＋空白内容页，适合从自己的内容开始 |
| `--starter examples` | 六页组件示例，适合了解布局与流程组件 |

主要编辑 `content/deck.json`，填入页面标题、正文及双语文本；自定义页面使用 `content/*.html`。生成器负责页码、目录、语言字典和页面骨架。字段与组件示例见 [内容与组件](references/content-and-components.md)。

本地预览：

```sh
python3 -m http.server 8798 --bind 127.0.0.1
```

然后在浏览器打开 `http://127.0.0.1:8798/index.html`。

## 选择本次演示的页面

1. 打开目录，点击 **屏蔽页面**。
2. 勾选不演示的页面，点击 **保存**。
3. 需要恢复时，再进入该模式取消勾选，或点击 **恢复全部**后保存。

刷新后仍保留选择。取消、Esc 或关闭目录会放弃未保存的修改。屏蔽页保留在目录里，可随时恢复；当前浏览器打印/PDF 也会跳过它们。

选择存于浏览器本地，以项目 ID 隔离。页面有稳定 ID，调整顺序或修改标题不会改变屏蔽对象。设置不跨浏览器、设备或域名同步。

## 构建与发布

| 命令 | 输出 |
| --- | --- |
| `npm run build` | 生成用于预览的多文件网页，不导出、不生成部署产物 |
| `npm run build:offline` | `dist/offline/presentation.html` |
| `npm run build:cloudflare` | `deploy/cloudflare/dist/public/` |
| `npm run build:sites` | Sites ESM Worker |
| `npm run deploy:cloudflare` | 发布当前项目到 Cloudflare |
| `npm run test:browser` | 浏览器检查与截图，需要 Playwright 和浏览器 |

Cloudflare 项目需要配置平台授权和 `ACCESS_PIN`。离线文件与纯静态预览可直接打开。详细步骤见 [部署流程](references/deployment.md) 和 [检查与交付](references/validation.md)。

## 一键导出，无需 Agent 改代码

制作完成后，可使用底部 PPTX 按钮导出中文、英文或双语 ZIP，文字和常规图形可编辑，图片保持为图片。详细范围见 [PPTX 导出](references/pptx-export.md)。

Agent 也会提示可以导出 PDF 或单文件 HTML。**只有用户明确要求导出时才执行**，默认不生成这两类文件。用户只要求一种格式时，仅导出该格式。

在生成的产品项目目录运行：

```sh
npm run export:html                    # 单个可离线打开的 HTML
npm run export:pdf -- --lang zh         # 中文 PDF
npm run export:pdf -- --lang en         # 英文 PDF
npm run export -- --lang both           # HTML + 中文 PDF + 英文 PDF
```

选页导出可加 `--slides "1,3-5,thank-you"`，支持页码、范围和稳定页面 ID，按参数顺序输出并去重；HTML 和 PDF 均适用，不改原稿。

默认输出到 `dist/exports/`；可加 `--output-dir "目标目录"`。PDF 第一次需要安装浏览器依赖：

```sh
npm install --no-save playwright
npx playwright install chromium
```

后续只更新内容、执行命令即可。HTML 不需要这些 npm 依赖；PDF 导出自动起停本地服务、完整显示动效内容，并按 16:9 分页。HTML 保留双语切换与交互，PDF 是静态内容。已有 Chromium 可用 `--browser-executable` 或 `BROWSER_EXECUTABLE` 指定。

默认 `npm run build`、`npm test` 和浏览器检查只生成或检查预览网页，不导出单文件 HTML/PDF，也不生成部署产物。导出检查通过显式的 `test:export:html`、`test:export` 执行。部署模板在初始化时提供；日常内容修改无需改动 deploy/。明确需要发布时才执行对应平台的打包和部署命令。

## Demo 与目录结构

`demo/index.html` 是可直接打开的两页离线演示；`demo/thank-you.html` 为独立的通用致谢页预览。致谢页以纯白左右布局同时呈现中英文，可直接复用 `assets/starters/thank-you.json` 中的页面配置。重新生成：

```sh
python3 scripts/build-demo.py
```

```text
huawei-product-slides/
├── SKILL.md               Agent 制作流程
├── README.md              安装、功能与使用方法
├── references/            设计、内容、部署与验证说明
├── scripts/               项目初始化、Demo 构建与源码审计
├── assets/
│   ├── template/          完整演示项目模板
│   ├── starters/          起始页面配置
│   └── recipes/           可选交互组件
└── demo/                  可直接打开的演示与预览部署配置
```
