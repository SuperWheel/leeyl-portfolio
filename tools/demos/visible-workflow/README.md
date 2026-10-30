# Visible Workflow 静态演示 · 构建说明

这个目录用来构建 `projects/visible-workflow/demo/`，也就是作品集页面 iframe 里嵌入的静态演示。演示直接复用插件的真实前端组件（`WorkflowApp`、画布、配置面板、运行详情等）。原本走 `/__workflow` 的接口换成了浏览器内的 mock，数据和运行都在页面内完成，不会发出网络请求。

## 重新构建

```sh
# 插件源码仓库（只读）；未设置时使用 build.mjs 中的默认路径
export VW_SOURCE=/path/to/dsh-visible-dynamic-workflows
node build.mjs
```

- 需要 Node 22 及以上版本。插件仓库要先执行过 `pnpm install`。构建用的 vite 从插件仓库的 `node_modules` 加载，以 `configFile: false` 的方式调用。
- 构建不会往插件仓库写任何文件：缓存放在本目录的 `.cache/`（已加入 gitignore），产物输出到 `projects/visible-workflow/demo/`，每次构建会先清空该目录。
- 主题 CSS 按 preview-server 的同一套正则，从 `@deepseek-ai/dsh-client-ui-theme/lib/client.js` 中提取，写入 `.cache/native-theme.css` 后一起打包。
- 构建时会收集产物里每个第三方包的 `package.json` 许可字段，生成 `demo/LICENSES.md`。遇到不属于宽松许可（MIT、ISC、BSD、Apache-2.0 等）或许可不明的包，构建以退出码 1 失败。
- 设置 `VW_ANALYZE=1` 可以打印体积最大的模块。

## 验证

```sh
python3 -m http.server 8846 --directory <作品集仓库根目录>
CHROME_PROFILE=/tmp/vw-chrome node verify.mjs http://127.0.0.1:8846/projects/visible-workflow/demo/ /tmp/vw-verify
```

`verify.mjs` 用 puppeteer-core 驱动本机 Chrome，在 1280×820 下依次截图：画布、节点配置、执行、人工介入、运行完成、节点输入输出、交给 Agent、运行记录、添加节点、模板、高级设置、工作流信息、首页，以及窄屏和手机宽度。最后报告外部请求和控制台错误，两者有任意一项时以退出码 1 结束。

可用的环境变量：

| 变量 | 含义 | 默认值 |
|:---|:---|:---|
| `PUPPETEER_CORE` | puppeteer-core 包所在目录 | 依次查找本目录和 `../cliworker-now/node_modules` |
| `CHROME` | Chrome 可执行文件路径 | macOS 默认安装路径 |
| `CHROME_PROFILE` | Chrome 用户数据目录 | 输出目录下的 `profile` |

## 演示地址参数

| hash | 作用 |
|:---|:---|
| `#r7`（默认） | 打开「R7 订单汇总验收」画布（11 个节点） |
| `#text` | 打开「桌面验收 · 文本处理」画布，含便签和待处理提示 |
| `#branch` | 打开「布尔分支示例」画布 |
| `#home` | 打开工作流首页列表 |
| `#reset` | 清除 localStorage 中的演示进度，恢复初始数据 |

演示中的编辑和运行记录会尽量保存到 localStorage（键 `visible-workflow-demo:v2`）。存储不可用时只保留在内存中。

## 代码结构

- `src/main.tsx`：入口。负责创建 `WorkflowStore`、模拟聊天桥接和导航，以及 hash 路由。凡是需要连接 DeepSeekHarness 或 Agent 的操作，都只显示一条提示，8 秒后自动消失。
- `src/mock-api.ts`：模拟 `/__workflow` 的各个接口，包括工作流增删改查、预设、模型与工具、执行、草稿、导入、模板、配置检查等。未支持的接口会返回带说明的拒绝。
- `src/mock-runtime.ts`：逐节点推进的运行时。复用插件自身的模板渲染、逻辑门和系统变量模块，为每个节点生成示例输入输出，并实现人工介入、暂停、继续、取消、恢复和重跑。
- `src/vfs.ts`：内存虚拟文件系统，提供示例订单数据，供读取、写入、glob 等节点使用。
- `src/seed.ts`、`src/seed/r7-order-summary.json`：三条示例工作流和一个角色预设。全部是虚构数据。
- `src/shims/`：浏览器替身。
  - `dsh-util-code-language`：插件依赖中缺少这个包。
  - `katex`：用转义后的 `<code>` 显示公式，避免打包 KaTeX 及其字体。
  - `node:path`、`node:fs/promises`：让插件自己的导入预检逻辑在浏览器里跑在虚拟文件系统上。
  - `simple-icons`：构建时生成占位图标，以控制体积。
- 打包时把 `node_modules` 中除 CSS 以外的模块都标记为无副作用，以缩小体积。Shiki 的各语言语法保持懒加载分块，所以产物里有较多小 js 文件。
