# 财务分析系统 · 静态交互演示构建

把源仓库 **Web_Financial_Analyse** 的真实 Vue 3 前端（Element Plus + ECharts）原样打包成纯静态页面，后端接口在浏览器内用 mock 模拟，输出到作品集的 `projects/financial-analysis/demo/`。项目页用 iframe 按 1280×820 嵌入该页面。

- 页面、组件、样式、交互逻辑全部来自源仓库 `frontend/src`，构建时只读导入，不复制、不修改。
- 示例公司 A–D 及全部金额、比率、映射统计都是虚构的示例数据；页面右上角常驻「演示模式 · 示例数据」标记。
- 产物零外部请求（无 CDN、无网络字体，图标为 Element Plus 内置 SVG），只用相对路径。路由改为 hash 模式，所以放在 GitHub Pages 子路径下也能刷新。

## 重建

```bash
cd tools/demos/financial-analysis
export FA_SOURCE_DIR=~/Project/Web_Financial_Analyse   # 可省略，默认就是这个路径
npm ci                     # 依赖装在本目录 node_modules（已被根 .gitignore 忽略）
npm run build              # vite build → ../../../projects/financial-analysis/demo/，并生成 LICENSES.md
```

后端科目分组、13 项比率定义或核心科目有变化时，先从源仓库同步一次元数据（只读）：

```bash
npm run extract-meta       # python3 -I scripts/extract_backend_meta.py → src/mock/backendMeta.json
```

本地预览与验证：

```bash
python3 -m http.server 8760 --directory <作品集仓库根目录>
# 浏览器打开 http://127.0.0.1:8760/projects/financial-analysis/demo/
npm run verify -- http://127.0.0.1:8760/projects/financial-analysis/demo/ /tmp/fa-shots
```

`verify` 用 puppeteer-core 驱动本机 Chrome（`CHROME_PATH` 可改路径），依次走完仪表盘、三类视图切换、多期对比（报表 / 季报 / 表格筛选）、在线拉取 → 识别核对 → 批量入库、三大报表编辑、Excel 与 PDF 示例文件导入、hash 刷新和窄视窗检查，并在出现控制台报错或外部请求时以非零状态退出。

## 工作方式

`vite.config.ts` 的 `root` 是本目录，`@` 指向 `$FA_SOURCE_DIR/frontend/src`。只做三处构建期替换：

| 位置 | 处理 |
| --- | --- |
| `src/api/http.ts` 的 `import axios from 'axios'` | 改为导入 `src/axios-demo.ts`：给 axios 默认配置挂上 mock adapter；`http.ts` 原文与错误拦截器照常执行 |
| `src/router/index.ts` | `createWebHistory` 替换为 `createWebHashHistory`（找不到时构建直接报错，提示源码结构已变） |
| 源码里的第三方裸导入（vue、element-plus、echarts…） | 一律从本目录 `node_modules` 解析，保证单一副本，也不读写源仓库的 `node_modules` |

构建缓存放在 `.cache/`（被根 `.gitignore` 忽略）。`src/main.ts` 先加载演示外壳样式，再执行源仓库的 `main.ts`。外壳只加了两样东西：右上角的演示标记，以及上传区下方的「使用示例 PDF / Excel」按钮（把一个占位文件交给源码里的 `el-upload`，后面走的是真实的上传 → 识别 → 核对流程）。

依赖版本与源仓库当前安装版本一致（`package.json` 中直接依赖写死版本，传递依赖用 `overrides` 对齐）。

## mock 覆盖的接口

逻辑按源仓库 `backend/app/services/*` 移植到 `src/mock/db.ts`，数据只存在页面内存里，刷新就恢复初始示例：

- 企业：`GET/POST /api/companies`，`GET/PATCH/DELETE /api/companies/{id}`（代码重复返回 409，删除级联报表）
- 三大报表：`balance-sheets` / `income-statements` / `cash-flow-statements` 的列表、创建、详情、更新、删除（报告期规则、同期冲突 409）
- 比率：`ratio-periods`、`ratios`（13 项公式、缺字段 / 分母为 0 的 reason、ROE 归母口径）、`ratios/history`
- 多期对比：`compare-periods`、`compare`（金额、环比、结构占比）
- 在线拉取（示例公告库，不联网）：`cninfo/securities`、`cninfo/search`、`cninfo/search-years`、`cninfo/download`、`from-url`
- 年报 PDF 导入任务：`POST/GET /api/imports/filings`，`GET/PATCH/DELETE /api/imports/filings/{id}`，`POST .../commit`（覆盖率、置信度、填入模式按 `validate.py` 计算；入库时按名称或代码自动建企业）
- Excel：`excel/template.xlsx`、`companies/{id}/excel/preview`、`companies/{id}/excel/import`
- 导出：`companies/{id}/export.xlsx`

演示版不解析上传文件的内容（返回示例年报的识别结果，并在问题列表里注明）。模板与导出下载的是 CSV（UTF-8 BOM，可用 Excel 打开），不是 `.xlsx` 工作簿。

## 示例数据

`src/mock/sampleData.ts` 给每家示例公司写了少量驱动值（单位：亿元），再展开成 cas-simplified-v2 的全部 92 个科目，并保证勾稽关系成立：资产 = 负债 + 权益，各小计等于明细之和，利润逐级相符，现金流三项净额之和等于现金净增加额。

- 示例公司A：2022–2025 年报；驱动值与项目页原型一致（是比率分析、多期对比默认选中的企业）
- 示例公司B：2021–2025 年报，以及 2024、2025 年 Q1–Q3 季报
- 示例公司C：2023–2025 年报，其中 2023 年没有现金流量表（完整度 12/13）
- 示例公司D：只存在于「在线拉取」的示例公告库里，导入后才建档

## 注意

- 不在源仓库里写任何文件（包括 `node_modules/.vite` 和 `dist`）。
- 每次 `npm run build` 会清空并重写 `projects/financial-analysis/demo/`（包括 `LICENSES.md`）。
