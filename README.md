# 李依伦 · 作品集

个人产品作品集网站，展示三个项目，每个项目页附带一个可交互的界面示意原型：

| 作品 | 简介 | 项目主页 |
| --- | --- | --- |
| [CLI Worker Now](projects/cliworker-now/) | DeepSeek Harness 多智能体协作插件，在主对话里派遣 13 种 AI CLI 分工协作 | [GitHub](https://github.com/SuperWheel/dsh-cliworker-now) |
| [Visible Workflow](projects/visible-workflow/) | 让 Agent 先试做、跑通后再拆成可视化工作流的插件 | [GitHub](https://github.com/SuperWheel/dsh-visible-workflows) |
| [财务分析系统](projects/financial-analysis/) | 年报导入、标准科目映射与分角色财务分析看板 | [GitHub](https://github.com/SuperWheel/Web_Financial_Analyse) |

## 本地预览

纯静态页面，在仓库根目录运行：

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。交互演示用 iframe 嵌入，需要通过本地服务打开，不能直接双击文件。

## 结构

```
index.html                  首页
assets/css/site.css         共用样式（颜色变量、深浅色）
assets/js/site.js           主题切换、淡入动画、演示缩放
assets/img/                 作品封面（从演示截取）与站点图标
projects/<项目>/index.html   项目介绍页
projects/<项目>/demo/        交互演示的构建产物（含 LICENSES.md）
tools/demos/<项目>/          演示的构建脚本与浏览器内示例数据
```

## 交互演示

三个演示都直接用项目真实的前端代码构建，只把后端或宿主接口换成浏览器内的示例数据，不发任何网络请求：

- CLI Worker Now：插件真实的 React 组件，DeepSeek Harness 外壳用宿主界面包自带的样式搭建。
- Visible Workflow：插件真实的 `WorkflowApp`，运行时在浏览器内逐节点模拟。
- 财务分析系统：项目真实的 Vue 前端，接口由浏览器内的 mock 返回示例公司数据。

重新构建方法见各 `tools/demos/<项目>/README.md`。打包进来的第三方代码许可见各 `demo/LICENSES.md`。DeepSeek 及各 CLI 的名称与图标归各自所有者。
