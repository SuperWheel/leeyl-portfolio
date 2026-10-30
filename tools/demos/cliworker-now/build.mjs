// Builds projects/cliworker-now/demo/ from the CLI Worker Now plugin's real client
// components (read-only source checkout) plus a small static DSH shell and mock remote.
//
//   CWN_SRC=/path/to/cliworker-now node build.mjs
//
// The plugin checkout is never written to: esbuild reads sources and node_modules there
// and writes only to the portfolio demo directory and this folder's .cache/ (git-ignored).
import { build } from 'esbuild'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const SRC = resolve(process.env.CWN_SRC || `${process.env.HOME}/AI-Project/DeepSeekHarness/cliworker-now`)
const OUT = join(repo, 'projects/cliworker-now/demo')
const modules = join(SRC, 'node_modules')
if (!existsSync(join(SRC, 'src/client/panel.tsx')) || !existsSync(modules))
  throw new Error(`CWN_SRC does not look like an installed cliworker-now checkout: ${SRC}`)

// ---- Host theme tokens: lifted verbatim from @deepseek-ai/dsh-client-ui-theme ----
function themeCss() {
  const file = join(modules, '@deepseek-ai/dsh-client-ui-theme/lib/client.js')
  const text = readFileSync(file, 'utf8')
  const names = ['base', 'corner_shape', 'design_platform', 'focus', 'scrollbar', 'gradient_shadow_text', 'shiki']
  return names
    .map((name) => {
      const match = text.match(new RegExp(`var ${name}_css_default = ("(?:[^"\\\\]|\\\\.)*");`))
      if (!match) throw new Error(`theme sheet ${name} not found in ${file}`)
      return `/* dsh-client-ui-theme: ${name}.css */\n${vm.runInNewContext(match[1])}`
    })
    .join('\n')
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// The plugin's brand PNGs are 1000+ px masters; the demo inlines 96 px copies (macOS `sips`) as
// data URLs, falling back to the portfolio's existing 64 px icons on other systems.
const iconCache = join(here, '.cache/icons')
mkdirSync(iconCache, { recursive: true })
function smallIcon(original) {
  const name = basename(original)
  const target = join(iconCache, name)
  if (!existsSync(target)) {
    const resized = spawnSync('sips', ['-Z', '96', original, '--out', target], { stdio: 'ignore' })
    if (resized.status !== 0) copyFileSync(existsSync(join(repo, 'projects/cliworker-now/icons', name)) ? join(repo, 'projects/cliworker-now/icons', name) : original, target)
  }
  return target
}

// ---- Host shell styles: the DSH packages' own CSS-module sheets and class maps ----
// Each host package ships its CSS as string constants next to `X_module_css_default`
// class maps. The demo's static shell reuses those exact sheets and class names.
export const HOST_PACKAGES = [
  'dsh-client-ui-layout', 'dsh-client-ui-sidebar', 'dsh-client-ui-workspace', 'dsh-client-ui-chat',
  'dsh-client-ui-conversation', 'dsh-client-ui-model-selection', 'dsh-client-ui-permission-presets',
  'dsh-client-ui-message-feedback', 'dsh-client-ui-jobs', 'dsh-client-ui-subagent', 'dsh-client-ui-sidebar-right',
]
function hostPackageDir(name) {
  const direct = join(modules, '@deepseek-ai', name)
  if (existsSync(join(direct, 'package.json'))) return direct
  const store = join(modules, '.pnpm')
  const entry = readdirSync(store).filter((d) => d.startsWith(`@deepseek-ai+${name}@`)).sort().reverse()
    .map((d) => join(store, d, 'node_modules/@deepseek-ai', name)).find((d) => existsSync(join(d, 'package.json')))
  if (!entry) throw new Error(`host package ${name} not found under ${modules}`)
  return entry
}
function hostStyles() {
  const classes = {}, sheets = [], versions = {}
  for (const name of HOST_PACKAGES) {
    const dir = hostPackageDir(name)
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    versions[name] = { version: pkg.version, license: pkg.license }
    const text = readFileSync(join(dir, 'lib/client.js'), 'utf8')
    for (const m of text.matchAll(/(?:const|var) (?:css(?:\$\d+)?|[A-Za-z0-9_]+_css_default) = ("(?:[^"\\]|\\.)*");/g)) {
      const css = vm.runInNewContext(m[1])
      if (typeof css === 'string' && css.includes('{')) sheets.push(css)
    }
    for (const m of text.matchAll(/var ([A-Za-z0-9_$]+)_module_css_default = (\{[^}]*\});/g))
      classes[m[1]] = { ...classes[m[1]], ...vm.runInNewContext(`(${m[2]})`) }
    sheets.unshift(`/* @deepseek-ai/${name}@${pkg.version} */`)
  }
  return { classes, css: sheets.join('\n'), versions }
}
const host = hostStyles()
mkdirSync(join(here, '.cache'), { recursive: true })
writeFileSync(join(here, '.cache/host-packages.json'), JSON.stringify(host.versions, null, 2))
writeFileSync(join(here, '.cache/host-classes.json'), JSON.stringify(host.classes, null, 1))
const hostModulesPlugin = {
  name: 'host-modules',
  setup(b) {
    b.onResolve({ filter: /^host:classes$/ }, () => ({ path: 'host-classes', namespace: 'host' }))
    b.onLoad({ filter: /.*/, namespace: 'host' }, () => ({ contents: JSON.stringify(host.classes), loader: 'json' }))
  },
}

// Trim what the demo never renders: other shiki grammars (3 MB) and KaTeX (no math in the samples).
const SHIKI_KEEP = new Set(['json', 'shellscript', 'typescript'])
const trimPlugin = {
  name: 'demo-trim',
  setup(b) {
    b.onResolve({ filter: /^@shikijs\/langs\/[^/]+$/ }, (args) =>
      SHIKI_KEEP.has(args.path.split('/').pop()) ? undefined : { path: args.path, namespace: 'stub-lang' })
    b.onLoad({ filter: /.*/, namespace: 'stub-lang' }, () => ({ contents: 'export default []', loader: 'js' }))
    b.onResolve({ filter: /^katex$/ }, () => ({ path: 'katex', namespace: 'stub-katex' }))
    b.onLoad({ filter: /.*/, namespace: 'stub-katex' }, () => ({
      contents: 'const esc=(s)=>String(s).replace(/[&<>]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]);export default{renderToString:(s)=>"<code>"+esc(s)+"</code>"}',
      loader: 'js',
    }))
    b.onResolve({ filter: /^katex\/dist\/.*\.css$/ }, () => ({ path: 'katex.css', namespace: 'stub-css' }))
    b.onLoad({ filter: /.*/, namespace: 'stub-css' }, () => ({ contents: '', loader: 'css' }))
    b.onLoad({ filter: /src\/client\/assets\/[^/]+\.png$/ }, (args) => ({ contents: readFileSync(smallIcon(args.path)), loader: 'dataurl' }))
  },
}

const result = await build({
  entryPoints: { app: join(here, 'src/main.tsx') },
  outdir: OUT,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome110', 'safari16', 'firefox115'],
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  metafile: true,
  // Own files resolve packages from the plugin checkout so a single React copy is used.
  // The primitives package expects its third-party deps to be supplied by the app bundle;
  // they are installed here (tools/node_modules), never in the plugin checkout.
  nodePaths: [modules, join(here, 'node_modules')],
  alias: {
    'cwn-src': join(SRC, 'src'),
    '@deepseek-ai/dsh-util-code-language': hostPackageDir('dsh-util-code-language'),
    '@deepseek-ai/dsh-util-workspace-path': hostPackageDir('dsh-util-workspace-path'),
  },
  loader: { '.png': 'file', '.woff2': 'file' },
  assetNames: 'assets/[name]',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  absWorkingDir: here,
  plugins: [hostModulesPlugin, trimPlugin],
})

// ---- LICENSES.md: every package whose code or CSS ships in the demo, with its own license text ----
const ALLOWED = new Set(['MIT', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'Apache-2.0', 'CC0-1.0'])
function packageRoot(file) {
  const i = file.lastIndexOf('node_modules/')
  if (i < 0) return undefined
  const rest = file.slice(i + 13).split('/')
  return file.slice(0, i + 13) + rest.slice(0, rest[0].startsWith('@') ? 2 : 1).join('/')
}
function licenseText(dir) {
  const name = readdirSync(dir).find((f) => /^(licen[sc]e|copying)(\.(md|txt))?$/i.test(f))
  if (!name) throw new Error(`no license file in ${dir}`)
  return readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n').trim()
}
function licenses(metafile) {
  const dirs = new Set()
  for (const output of Object.values(metafile.outputs))
    for (const input of Object.keys(output.inputs ?? {})) {
      const root = packageRoot(resolve(here, input))
      if (root) dirs.add(root)
    }
  dirs.add(join(modules, '@deepseek-ai/dsh-client-ui-theme'))
  for (const name of HOST_PACKAGES) dirs.add(hostPackageDir(name))
  const entries = [...dirs].map((dir) => {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    if (!ALLOWED.has(pkg.license)) throw new Error(`unreviewed license ${JSON.stringify(pkg.license)} for ${pkg.name}; not bundling it`)
    return { id: `${pkg.name}@${pkg.version}`, license: pkg.license, text: licenseText(dir) }
  })
  const plugin = JSON.parse(readFileSync(join(SRC, 'package.json'), 'utf8'))
  if (plugin.license !== 'MIT') throw new Error(`plugin license is ${plugin.license}`)
  const groups = new Map()
  for (const e of entries.sort((a, b) => a.id.localeCompare(b.id))) {
    const group = groups.get(e.text) ?? { license: e.license, ids: [] }
    group.ids.push(e.id)
    groups.set(e.text, group)
  }
  const sections = [...groups].map(([text, g]) => `### ${g.license} — ${g.ids.join(', ')}\n\n\`\`\`text\n${text}\n\`\`\`\n`)
  return `# 第三方许可

本演示（\`index.html\`、\`app.js\`、\`app.css\`、\`host.css\`、\`theme.css\`）打包或改编了以下开源代码，均按各自许可证再分发。
此文件由 \`tools/demos/cliworker-now/build.mjs\` 生成：构建时逐个核对 \`package.json\` 的 license 字段，未在允许列表（${[...ALLOWED].join('、')}）内的包会使构建失败而不会被打包。

- **CLI Worker Now 插件**（${plugin.name}@${plugin.version}，MIT）：\`app.js\` 中的面板、设置、预设、模型与权限菜单等组件及注入样式直接取自插件 \`src/client\` 与 \`src/shared\`，内嵌的各 CLI 图标为插件 \`src/client/assets\` 的缩小副本。
- **DeepSeek Harness 宿主包**（@deepseek-ai/*，MIT）：\`theme.css\` 取自 dsh-client-ui-theme；\`host.css\` 为布局、侧栏、工作区、对话、模型选择、权限、子智能体等宿主包自带的 CSS 原样拼接；\`app.js\` 打包了 dsh-client-ui-primitives 组件与图标。
- 演示外壳（\`tools/demos/cliworker-now/src\`）与全部示例数据为本仓库自写。
- 图标中出现的 DeepSeek、Codex、Claude Code 等名称与标识属于各自权利人；许可证只覆盖代码，不授予商标权。

## CLI Worker Now

\`\`\`text
${readFileSync(join(SRC, 'LICENSE'), 'utf8').trim()}
\`\`\`

## 打包的依赖（${entries.length} 个包）

${sections.join('\n')}`
}

// Single HTML page: theme tokens first, then the bundle's own CSS (plugin + primitives + shell).
const html = `<!doctype html>
<html lang="zh-CN" data-platform="darwin">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>CLI Worker Now 演示</title>
<meta name="description" content="CLI Worker Now 在 DeepSeek Harness 桌面端中的静态交互演示，所有数据均为示例。">
<link rel="stylesheet" href="theme.css">
<link rel="stylesheet" href="host.css">
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`
writeFileSync(join(OUT, 'index.html'), html)
writeFileSync(join(OUT, 'theme.css'), themeCss() + '\n')
writeFileSync(join(OUT, 'host.css'), host.css + '\n')
writeFileSync(join(OUT, 'LICENSES.md'), licenses(result.metafile))

const files = readdirSync(OUT, { recursive: true })
  .map((name) => String(name))
  .filter((name) => statSync(join(OUT, name)).isFile())
for (const name of files.sort()) console.log(`${(statSync(join(OUT, name)).size / 1024).toFixed(1).padStart(8)} KB  ${name}`)
const leaked = files.filter((name) => /\.(js|css|html)$/.test(name)).filter((name) => /\/Users\/|leeyl|@gmail/.test(readFileSync(join(OUT, name), 'utf8')))
if (leaked.length) throw new Error(`personal paths leaked into: ${leaked.join(', ')}`)
writeFileSync(join(here, '.cache/meta.json'), JSON.stringify(result.metafile))
