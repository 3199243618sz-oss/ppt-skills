# 素材与代码来源

基础代码与素材来自本次用户提供的 Leon00x/huaweiaislides 工作区（2026-10-07），已分离出通用模板。此文件是内部来源记录，不输出在客户幻灯片。

| 素材 | 保存位置 | 用途 |
| --- | --- | --- |
| huawei-logo.png | assets/template/assets/ | 华为原图 Logo，保留比例 |
| yunshan.png | assets/template/assets/ | 云山：第一轮生成图二，层叠山脊与云海 |
| jinsha.png | assets/template/assets/ | 金沙：第一轮生成图四，沙丘与远山 |
| mountains.jpg | assets/template/assets/ | 原演示山景封面 |

未新增对这些素材的授权声明。跨品牌使用时替换相应品牌资产和名称。包内不包含原站点凭据、访问 PIN 或 API Key。

云山和金沙为本次会话生成的封面素材；原始生成图保留在工作区，包内使用稳定文件名。

只保留 Logo、云山、金沙和原山景。旧业务截图、产品图标和项目二维码不随通用 skill 交付。

PPTX 浏览器导出使用 [PptxGenJS](https://github.com/gitbrent/PptxGenJS) 4.0.1 的 `pptxgen.bundle.js`，包含 [JSZip](https://github.com/Stuk/jszip) 3.10.1；保存为 `assets/template/js/pptxgenjs.js`。仅移除未随包提供的 sourcemap 引用。PptxGenJS 采用 MIT 许可证，JSZip 按其 MIT 选项分发；对应许可证在模板 docs/ 下保留。PPTX 转换逻辑为本任务新增通用代码，不包含本次安全产品内容或账号数据。
