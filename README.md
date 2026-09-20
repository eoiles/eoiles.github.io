# eoiles — 文字的另一种形状

一个完全在浏览器本地运行的文字 ↔ Unicode 盲文编码工具。默认恢复历史 `287f510` 的 remap 协议，保留点阵意象、深色与浅青色气质，并提供完整浅色主题。

## 本地运行

建议 Node.js 22 LTS，npm。已在 Node.js 20.17.0 上验证构建。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址。首次页面为空，不自动聚焦，不唤起键盘。

```sh
npm test                  # 40 项协议测试，无需浏览器
npm run build             # 类型检查 + 品牌图标生成 + 静态构建
npm run preview           # 预览 dist，默认 http://127.0.0.1:4173
npx playwright install chromium webkit
npm run test:e2e           # 桌面 Chromium、移动 Chromium、iPhone 视口 WebKit
```

已安装 Chrome 时，可以设置环境变量 `PW_CHANNEL=chrome`，省略 Chromium 下载。`PLAYWRIGHT_BROWSERS_PATH` 可指定浏览器缓存目录。截图和录屏是可选测试，设置 `EOILES_CAPTURE` 为目标绝对目录后运行；默认跳过。

## 使用

- 在「原文」输入，编码即时出现在结果区（桌面右侧、手机下方）；默认显示可编辑编码，也可直接粘贴点阵还原，以最近实际编辑的一侧为准。
- 「编码／点阵／黑白格」在同一个结果区原位切换，保持区域高度，不改变编码；可视化下的「编辑 / 粘贴编码」返回文本并聚焦输入。每个单元固定 2 列 × 4 行，两个单元组成一个 UTF-16 码元；窄屏按整个码元换行。
- 「复制编码」复制完整 Unicode 字符串，包括不可见的 U+2800。「导出」菜单提供完整 SVG 和 PNG 图像，独立于编码文本。
- 清空、示例载入、格式变更和主动清理空白均可撤销。输入框也保留浏览器原生的编辑与选择行为。
- 错误时保留当前编码、上次有效原文及预览，指出第几个 UTF-16 位置出错；修正后自动继续。
- 「编码方式」默认收起，提供「自然顺序」和「Unicode 原生」。点击立即生效：最近编辑原文则保留原文重新编码，最近编辑编码则保留编码重新解释；说明就地标明保留哪一侧，可以撤销。两种协议范围相同，不能自动识别，需要手动选择。
- 「怎么读」默认收起。没有输入时可试读 A / 中 / 😀，不写入编辑区；有内容时直接选字或用前后按钮浏览。emoji、组合字符和 ZWJ 序列保持为一个可见选项，必要时分组查看。自然顺序向下再向右；Unicode 原生按真实位权从高位读到低位，编号、箭头与二进制高亮一起更新。播放必须主动触发。
- 「转换原理」只展示简短流程和 5 行 Python 概念示意，以 A 展示文字、二进制、实空点和还原。完整实现保留在仓库，页面不展示提交编号、实现文件路径或大段源码。

## 隐私与边界

无后端、分析服务、第三方字体、CDN 运行时或网络转换。文字只存在内存，不写入 localStorage、sessionStorage、URL 或日志。仅 `eoiles.preferences` 保存主题、格式、结果视图、显示样式和网格。刷新清空文字。

界面统计中的「字符」按字素簇计算，包括空白字符；悬停统计可查看 UTF-16 码元数。一个码元固定对应两个盲文字符。原文超过 12,000 码元时省略字素统计，明确显示「未计数」，转换不受影响。

- 预览最多显示前 **256 个盲文字符**，界面明确标出总量；复制始终完整。
- SVG / PNG 保留完整数据及前后全白单元，固定按最多 16 个码元一行排布。图像与当前预览的视觉换行不必相同。
- PNG 以 2 倍尺寸导出，限制为 3,200 万像素及单边 16,000 像素。超限提示改用 SVG。
- 完整图像超过 100,000 个盲文字符时明确拒绝导出，**不生成截断文件**；仍可复制全部编码。
- 大型转换与图像构建在 Worker 执行，结果带版本号；旧转换不会覆盖新输入。转换 Worker 不可用时按块让出主线程。大型图像 Worker 不可用时明确提示，基本转换和复制继续工作。
- 文本框显示会把 CR/CRLF 统一成换行；内存模型保存粘贴或解码所得的原始 CR/CRLF，未编辑部分不被重写。
- 剪贴板被拒绝时显示完整内容的手动复制区，不调用隐式选择或自动夺取输入焦点。

这是一种文字编码实验，**不是自然语言盲文翻译，也不是加密**。

## 静态部署 / GitHub Pages

仓库为 `eoiles/eoiles.github.io`，根站点路径使用 Vite 默认的 `/`。构建产物在 `dist/`，可部署到任意静态 HTTPS 主机。

1. 将这些源文件提交并推送至 `master`（仓库当前默认分支）或 `main`。
2. GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. `.github/workflows/deploy.yml` 会执行 `npm ci`、协议测试、生产构建，再上传并部署 `dist`。也可手动触发工作流。
4. 确认工作流成功后访问 https://eoiles.github.io/ 。

推送后在仓库的 Actions 中检查部署结果；只有构建和部署均成功，线上站点才完成更新。

保留 `/` 与 `/index.html` 入口；原站没有应用路由。旧 Axure 辅助页面与运行时已删除，不再加载绝对定位画布或 jQuery。Git 历史仍完整保留旧站源码。

部署机制参考 [Vite 官方 GitHub Pages 指南](https://vite.dev/guide/static-deploy.html#github-pages)。Vite preview 只用于预览；线上发布 `dist/`。

## 代码地图

| 文件 | 职责 |
| --- | --- |
| `src/concept.py` | 仅供页面展示的 5 行 Python 概念示意，不参与浏览器转换 |
| `src/core.js` | 可独立阅读的 remap 核心；没有 DOM、校验或依赖 |
| `src/protocol.js` | 原生兼容格式、输入验证、真实 Unicode 点位、主动空白清理 |
| `src/conversion.ts` / `src/worker.ts` | 转换调度数据与字素统计 |
| `src/text-model.ts` | 文本框与原始 CRLF 字符串之间的最小编辑协调 |
| `src/render.ts` | 确定性的 SVG 坐标、完整画布、PNG 栅格化 |
| `src/image-export.ts` / `src/export-worker.ts` | 大型导出后台处理与边界反馈 |
| `src/reading.ts` / `src/reading.css` | 两种格式的阅读顺序、选字、Python 示意着色与紧凑教学布局 |
| `src/main.ts` | 双向编辑状态、撤销、偏好、焦点、反馈与主动教学 |
| `src/style.css` / `src/workspace.css` | 基础控件、双主题与桌面/手机工作台布局 |
| `src/motion.ts` / `src/motion.css` | 可中断的面板过渡、交互反馈、光感与减少动态偏好 |
| `scripts/generate-brand.mjs` | 用实际 `enc('e')` 生成 favicon；站内品牌也直接调用 `enc` |
| `tests/` | 独立协议断言、浏览器回归、无障碍检查与可选媒体记录 |

更多见 [核心修改说明](docs/core-changes.md)、[体验设计说明](docs/design.md) 与 [实际验证记录](docs/verification.md)。
