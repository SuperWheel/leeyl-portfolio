# CLI Worker Now 演示构建

生成 `projects/cliworker-now/demo/`：项目页 iframe 里的静态交互演示。右侧面板、设置弹窗、角色预设、
模型与权限菜单等直接来自插件 `src/client` 的真实 React 组件；宿主 DeepSeek Harness 的外壳
（左侧栏、主对话、输入框、顶栏）按宿主包自带的 CSS 与类名重建。插件需要的宿主接口
（`ctx.remote.cliworker` 与 `$stream`）由 `src/mock/` 在内存里模拟，数据全部是示例，页面不发任何网络请求。

## 重新构建

需要 Node 20+，以及一份已经 `pnpm install` 过的插件源码（只读，构建不会写入其中任何文件）。

```sh
cd tools/demos/cliworker-now
npm ci --cache .cache/npm            # 只装到本目录 node_modules
CWN_SRC=/path/to/cliworker-now node build.mjs
```

`CWN_SRC` 缺省为 `~/AI-Project/DeepSeekHarness/cliworker-now`。构建会：

- 用 esbuild 打包 `src/main.tsx` → `demo/app.js`、`demo/app.css`（React 只取插件 checkout 里的那一份）；
- 从 `@deepseek-ai/dsh-client-ui-theme` 抽出主题变量 → `demo/theme.css`；
- 从各宿主包 `lib/client.js` 抽出 CSS 模块和类名映射 → `demo/host.css` 与虚拟模块 `host:classes`；
- 把插件的 CLI 图标缩成 96 px（macOS `sips`）后以 data URL 内嵌；
- 生成 `demo/LICENSES.md`，license 字段不在允许列表内的包会让构建失败；
- 检查产物里没有本机路径、用户名或邮箱。

缓存与中间文件都在本目录 `.cache/`，与 `node_modules/` 一起被根 `.gitignore` 忽略。

## 验证

```sh
node verify.mjs [截图目录]           # 缺省写到 .cache/shots
```

脚本在 8900–8999 中找一个空闲端口，用 `python3 -m http.server` 以 `/leeyl-portfolio/` 子路径
（与 GitHub Pages 相同）提供仓库，再用 headless Chrome（`CHROME` 可覆盖路径）逐个点开列表、详情、
任务选项、访问模式、模型菜单、设置各页、已删除、分组折叠、筛选、主对话派遣全过程，以及 760×520
小窗口与项目页 iframe。出现控制台错误、失败请求或任何外部请求时以非零状态退出，结束时关闭服务器。

## 结构

| 路径 | 作用 |
| --- | --- |
| `src/main.tsx` | 入口；直接打开时把自己放进按比例缩放的 iframe，被嵌入时直接渲染 |
| `src/plugin-styles.ts` | 按插件 `index.tsx` 的方式注入插件样式 |
| `src/mock/` | 示例数据、内存 Host（排队 → 运行 → 完成）、远端接口模拟 |
| `src/shell/` | DSH 外壳：侧栏、主对话、输入框、右侧栏标签条、Worker 原生对话 |
