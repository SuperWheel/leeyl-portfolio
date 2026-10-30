// Builds the static Visible Workflow demo from the plugin's real client source.
// The plugin repository is only read: vite runs from its installed node_modules,
// while every cache and output file is written inside the portfolio repository.
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const portfolio = resolve(here, '../../..')
const source = resolve(process.env.VW_SOURCE || `${process.env.HOME}/AI-Project/DeepSeekHarness/dsh-visible-dynamic-workflows`)
const outDir = resolve(portfolio, 'projects/visible-workflow/demo')
const cacheDir = resolve(here, '.cache')
if (!existsSync(join(source, 'src/client/app.tsx'))) throw new Error(`插件源码不存在：${source}（可用 VW_SOURCE 指定）`)

const require = createRequire(join(source, 'package.json'))
const { build } = await import(pathToFileURL(require.resolve('vite')).href)

// Same extraction as scripts/preview-server.ts: the native DSH theme CSS strings.
const themeSource = readFileSync(join(source, 'node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js'), 'utf8')
const theme = ['base', 'design_platform', 'focus', 'scrollbar'].map(name => {
  const match = themeSource.match(new RegExp(`var ${name}_css_default = ("(?:[^"\\\\]|\\\\.)*");`))
  if (!match) throw new Error(`Native theme asset missing: ${name}`)
  return JSON.parse(match[1])
}).join('\n')
mkdirSync(cacheDir, { recursive: true })
writeFileSync(join(cacheDir, 'native-theme.css'), theme)

// Host-provided UI libraries are dev dependencies of the plugin; resolve them like the preview does.
mkdirSync(cacheDir, { recursive: true })
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const nativeEntry = require.resolve('@deepseek-ai/dsh-client-ui-primitives')
const nativeRequire = createRequire(nativeEntry)
const nativeSource = readFileSync(nativeEntry, 'utf8')
// Brand icons are only drawn by primitives' web-link block, which the workflow UI
// never renders. Empty placeholders keep the (CC0) simple-icons data out of the bundle.
const iconNames = [...new Set([...nativeSource.matchAll(/^import \{([^}]*)\} from "simple-icons"/gm)].flatMap(m => m[1].split(',').map(name => name.trim()).filter(Boolean)))]
writeFileSync(join(cacheDir, 'simple-icons-placeholder.mjs'), '// Generated placeholders; no simple-icons data is bundled.\n' + iconNames.map(name => `export const ${name} = ${JSON.stringify({ title: name.slice(2), slug: name.slice(2).toLowerCase(), hex: '000000', path: '', svg: '' })};`).join('\n') + '\n')
const shims = {
  '@deepseek-ai/dsh-util-code-language': join(here, 'src/shims/dsh-util-code-language.ts'),
  'simple-icons': join(cacheDir, 'simple-icons-placeholder.mjs'),
  katex: join(here, 'src/shims/katex.ts'),
  'katex/dist/katex.min.css': join(here, 'src/shims/empty.css'),
}
const pnpmStore = join(source, 'node_modules/.pnpm')
const resolveNative = name => {
  if (shims[name]) return shims[name]
  try { return require.resolve(name) } catch {}
  try { return nativeRequire.resolve(name) } catch {}
  // pnpm keeps transitive packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>.
  const flat = name.replace('/', '+')
  for (const entry of readdirSync(pnpmStore)) if (entry.startsWith(flat + '@')) {
    const dir = join(pnpmStore, entry, 'node_modules', name)
    if (existsSync(join(dir, 'package.json'))) return createRequire(join(dir, 'package.json')).resolve(name)
  }
  throw new Error(`无法解析宿主 UI 依赖：${name}`)
}
const imports = [...nativeSource.matchAll(/^import .*? from "([^".][^"]+)"/gm)].map(m => m[1])
const aliases = [...new Set(imports)].filter(name => !name.startsWith('react')).map(name => ({ find: new RegExp(`^${escape(name)}$`), replacement: resolveNative(name) }))
for (const name of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'zod']) aliases.push({ find: new RegExp(`^${escape(name)}$`), replacement: require.resolve(name) })
for (const [name, file] of Object.entries(shims)) if (!aliases.some(alias => alias.find.test(name))) aliases.push({ find: new RegExp(`^${escape(name)}$`), replacement: file })
// Host import checks run against the in-memory demo workspace.
aliases.push({ find: /^node:path$/, replacement: join(here, 'src/shims/node-path.ts') })
aliases.push({ find: /^node:fs\/promises$/, replacement: join(here, 'src/shims/node-fs-promises.ts') })
aliases.push({ find: /^@vw-source\//, replacement: source + '/' })
aliases.push({ find: /^@vw-cache\//, replacement: cacheDir + '/' })

// Collect every bundled package so LICENSES.md matches the real bundle content.
const packages = new Map()
function packageOf(id) {
  const clean = id.replace(/\0/g, '').split('?')[0]
  if (!clean.startsWith('/')) return
  let dir = dirname(clean)
  while (dir.length > 1) {
    const file = join(dir, 'package.json')
    if (existsSync(file)) {
      try { const pkg = JSON.parse(readFileSync(file, 'utf8')); if (pkg.name && pkg.version) return { dir, pkg } } catch {}
    }
    dir = dirname(dir)
  }
}
const licensePlugin = {
  name: 'vw-license-collector',
  generateBundle(_options, bundle) {
    if (process.env.VW_ANALYZE) for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) console.log(Object.entries(chunk.modules).map(([id, m]) => [m.renderedLength, id]).sort((a, b) => b[0] - a[0]).slice(0, 25).map(([n, id]) => `${(n / 1024).toFixed(0).padStart(6)} KiB ${id.replace(source, '<src>')}`).join('\n'))
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk') continue
      for (const id of Object.keys(chunk.modules)) {
        if (id.startsWith(here)) continue
        const found = packageOf(id)
        if (!found) continue
        const key = `${found.pkg.name}@${found.pkg.version}`
        if (!packages.has(key)) packages.set(key, found)
      }
    }
  },
}

rmSync(outDir, { recursive: true, force: true })
await build({
  configFile: false,
  root: here,
  base: './',
  cacheDir,
  logLevel: 'warn',
  publicDir: false,
  mode: 'production',
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  resolve: { dedupe: ['react', 'react-dom'], alias: aliases },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  server: { fs: { allow: [here, source] } },
  build: {
    outDir,
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 8000,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: join(here, 'index.html'),
      // Host UI libraries are ESM without "sideEffects" metadata. Treat them as
      // side-effect free so unused exports (KaTeX, brand icons, extra shiki
      // grammars) are not shipped; CSS modules referenced by used components stay.
      treeshake: { moduleSideEffects: (id, external) => !external && !/[\\/]node_modules[\\/]/.test(id) || /\.css($|\?)/.test(id) && !/katex/.test(id) },
    },
  },
  plugins: [licensePlugin],
})

// LICENSES.md: refuse anything whose license is not verified as MIT-compatible below.
const allowed = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'CC0-1.0', '0BSD'])
const rows = [...packages.values()].sort((a, b) => a.pkg.name.localeCompare(b.pkg.name))
const problems = []
let md = '# 第三方许可\n\n本演示由 Visible Workflow 插件的真实前端源码在浏览器内构建，服务端接口替换为本地模拟。以下为打包进 `assets/` 的全部软件包及其许可文本（由构建脚本根据实际打包模块自动生成）。\n\n'
md += '| 包 | 版本 | 许可 |\n|:--|:--|:--|\n'
for (const { pkg } of rows) md += `| ${pkg.name} | ${pkg.version} | ${pkg.license || '未声明'} |\n`
md += '\n'
for (const { dir, pkg } of rows) {
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type
  if (!allowed.has(license)) problems.push(`${pkg.name}@${pkg.version}: ${license}`)
  const file = readdirSync(dir).find(name => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(name))
  let text = file ? readFileSync(join(dir, file), 'utf8').trim() : ''
  if (!text && pkg.name === 'dsh-visible-dynamic-workflows') text = readFileSync(join(source, 'LICENSE'), 'utf8').trim()
  if (!text) problems.push(`${pkg.name}@${pkg.version}: 缺少许可文本`)
  md += `## ${pkg.name}@${pkg.version}\n\n许可：${license}\n\n\`\`\`text\n${text}\n\`\`\`\n\n`
}
writeFileSync(join(outDir, 'LICENSES.md'), md)
const files = []
const walk = dir => { for (const name of readdirSync(dir)) { const p = join(dir, name); statSync(p).isDirectory() ? walk(p) : files.push([relative(outDir, p), statSync(p).size]) } }
walk(outDir)
for (const [file, size] of files) console.log(`${file.padEnd(48)} ${(size / 1024).toFixed(1).padStart(9)} KiB`)
console.log(`bundled packages: ${rows.length}`)
if (problems.length) { console.error('许可核实未通过：\n' + problems.join('\n')); process.exitCode = 1 }
