# 李依伦 · 作品集

个人产品作品集网站，展示三个项目，每个项目页附带一个可交互的界面示意原型：

| 作品 | 简介 | 项目主页 |
| --- | --- | --- |
| [CLI Worker Now](projects/cliworker-now/) | DeepSeek Harness 多智能体协作插件，在主对话里派遣 13 种 AI CLI 分工协作 | [GitHub](https://github.com/SuperWheel/dsh-cliworker-now) |
| [Visible Workflow](projects/visible-workflow/) | 让 Agent 先试做、跑通后再拆成可视化工作流的插件 | [GitHub](https://github.com/SuperWheel/dsh-visible-workflows) |
| [财务分析系统](projects/financial-analysis/) | 年报导入、标准科目映射与分角色财务分析看板 | [GitHub](https://github.com/SuperWheel/Web_Financial_Analyse) |

## 本地预览

纯静态页面，无需构建。直接双击 `index.html`，或在仓库根目录运行：

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。

## 结构

```
index.html              首页
assets/css/site.css     共用样式（颜色变量、深浅色）
assets/js/site.js       主题切换与淡入动画
projects/<项目>/        项目子页：index.html、prototype.css、prototype.js
```

原型只还原界面与交互，不连接真实功能；财务分析系统原型中的数据为示例。
