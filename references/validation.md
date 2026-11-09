# 检查与交付

在新项目目录运行。基础运行不需要 npm 安装；浏览器检查需要 Playwright 和浏览器。

```sh
npm run build
npm test
python3 -m http.server 8798 --bind 127.0.0.1
# 另一个终端；端口被占用时选新端口并设置 DECK_URL
NODE_PATH=/path/to/existing/node_modules BROWSER_EXECUTABLE=/usr/bin/chromium \
DECK_URL=http://127.0.0.1:8798/index.html node tests/browser-check.cjs
```

没有已有 Playwright 时，`npm install --no-save playwright` 和 `npx playwright install chromium`，然后 `npm run test:browser`。Linux 的 NODE_PATH/BROWSER_EXECUTABLE 写法仅示例，Windows 使用其环境变量语法。

- 检查每页中文和英文，1600×1000、1366×768、390×844 视口；这里视口尺寸不是画布尺寸，画布始终 1600×900。
- 检查内容框宽度、实际文字边界和距页脚至少 8px。长英文卡片内部尤其需要截图人工查看；脚本不能代替所有视觉判断。
- 目录页数与实际 slides 相同，目录点击正确跳转，语言往返还原标题，页码和章节按实际内容生成。
- 工作流程支持播放/暂停/重播/完整示意，离开页面停止，打印和减少动态效果模式没有进行中的高亮。
- PIN 的匿名静态资源访问、错误 PIN、外站 Origin、合法 Cookie、篡改 Cookie、过期 Cookie和缺失 Secret 都有测试。
- 只有用户明确要求导出后，才检查离线 HTML：CSS/JS/图片内嵌、双语和公共交互可用。常规浏览器检查仅验证打印状态，不调用 PDF 输出。
- 仅在需要发布或修改部署适配器时运行 `npm run test:deployment`，检查 Cloudflare 构建只复制静态资源，不暴露 worker、源码目录、测试或 Secret。
- 可选高级组件加入后，针对新增结构补充检查，特别是 SVG 长词、隐藏面板、缩略图和打印完整态。

默认交付预览网页、项目源文件、内容输入、内部来源记录和验证说明；末尾提示可以导出单文件 HTML、PDF 或可编辑 PPTX。只有用户明确要求后才执行对应导出，不能将提示视为授权。PDF 不保留交互。skill 包仅内置 PPTX 所需的开源浏览器库及许可证，不包含账号配置、OAuth、Cloudflare account_id、访问 PIN、API Key、浏览器 Cookie 或原站点配置。

页面选择检查：`npm run test:visibility`，同样需要 Playwright、本地 HTTP 服务和 DECK_URL。覆盖本地保存、刷新、双语往返、手机控件、取消与恢复、最少一页、目录/章节/直接链接、打印及同源项目隔离。

仅在明确要求导出或验证导出能力时，运行 `npm run test:export:html` 检查 HTML；需要 PDF 时安装 Playwright 和 Chromium 并执行 `npm run test:export`，验证单文件 HTML、中文和英文 PDF 页数与内容配置一致。不需要人工修改导出脚本，也不生成 Cloudflare 产物。

浏览器检查会保存 `qa/slides/zh-01.png`、`qa/slides/en-01.png` 等逐页截图，以及 `qa/contact-zh.png`、`qa/contact-en.png` 全稿总览图。截图使用完整静态状态，隐藏浮动控件；不因此生成 HTML 或 PDF 导出文件。


设计质量补充：浏览器检查同时输出`qa/design-metrics.json`，记录当前可见页面的标题行数、正文固色对比度以及画布/实际视口字号。低于4.5:1的正文样本、超过两行的标题进入人工审阅；透明图片背景、脚注、小标签等不作为正文统一断言，也不声称这是完整无障碍认证。检查覆盖列表和自定义文本的容器右边界；完整示意或播放结束时仅保留一个重播入口。

对于新布局，重点看spotlight主论点是否够短、行式说明的标题与正文是否对齐、表格列宽是否符合信息长度；以上构图判断参考[taste在演示中的适用方式](taste-for-slides.md)。

PPTX 导出能力修改后，使用本地服务运行 `npm run test:pptx`（需已有 Playwright、JSZip 与浏览器），验证真实按钮下载、中英文、双语 ZIP、屏蔽页顺序、断网、失败重试、390px 工具栏、OOXML 关系及每页形状 ID 唯一性。此测试明确生成 QA 用 PPTX，默认 npm test 不包含它。打开生成文件，检查中文字体、表格和自定义图示；文本与形状对象存在不等于排版完全一致。细节见 [PPTX 导出](pptx-export.md)。
