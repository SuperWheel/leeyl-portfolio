/**
 * 读取构建时记录的 .cache/bundled-packages.json（vite build 生成），
 * 为每个打进产物的第三方包写出版本、许可证、版权行与许可全文，
 * 输出到 projects/financial-analysis/demo/LICENSES.md。
 * 用法：npm run build && npm run licenses
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.resolve(HERE, '../../../projects/financial-analysis/demo/LICENSES.md')
const list = JSON.parse(readFileSync(path.join(HERE, '.cache/bundled-packages.json'), 'utf8'))

const MIT = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

function authorName(a) {
  if (!a) return null
  if (typeof a === 'string') return a.replace(/\s*<[^>]*>/, '').replace(/\s*\([^)]*\)/, '').trim()
  return a.name || null
}

function licenseFiles(dir) {
  return readdirSync(dir)
    .filter((f) => /^(licen[cs]e|copying|notice|copyrightnotice)(\.|$)/i.test(f))
    .sort((a, b) => (/notice/i.test(a) ? 1 : 0) - (/notice/i.test(b) ? 1 : 0))
}

const sections = []
const rows = []
for (const { name, dir } of list) {
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || '见下文'
  const files = licenseFiles(dir)
  let body = files.map((f) => {
    const text = readFileSync(path.join(dir, f), 'utf8').trim()
    return files.length > 1 ? `--- ${f} ---\n${text}` : text
  }).join('\n\n')
  let note = ''
  if (!body) {
    const holder = authorName(pkg.author) || name
    if (license === 'MIT') {
      body = MIT(holder)
      note = '（该包未随附 LICENSE 文件，以下按 package.json 声明的 MIT 许可与作者补全）'
    } else {
      body = `License: ${license}`
    }
  }
  const copyright = [
    ...new Set(
      body
        .split('\n')
        .map((l) => l.replace(/^[#\s*]+/, '').trim())
        .filter((l) => /^(copyright\b|\(c\)\s*\d|©)/i.test(l) && !/^copyright\s+(license|notice|owner|holder|statement|and|\[yyyy\])/i.test(l))
    ),
  ].slice(0, 4)
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || pkg.homepage || ''
  rows.push(`| ${name} | ${pkg.version} | ${license} | ${copyright[0] ? copyright[0].replace(/\|/g, '\\|') : authorName(pkg.author) || '—'} |`)
  sections.push(`## ${name}@${pkg.version}\n\n- 许可证：${license}\n- 来源：${repo.replace(/^git\+/, '') || '—'}\n${copyright.length ? copyright.map((c) => `- ${c}`).join('\n') + '\n' : ''}${note ? `\n${note}\n` : ''}\n\`\`\`text\n${body}\n\`\`\``)
}

const md = `# 第三方许可 · 财务分析系统演示

本目录（\`projects/financial-analysis/demo/\`）是「财务分析系统」前端的静态演示构建产物，包含两部分代码：

1. **应用代码**：来自作者本人的项目 Web_Financial_Analyse（Vue 3 前端：页面、组件、组合式函数与样式），以及本作品集仓库 \`tools/demos/financial-analysis/\` 下的演示外壳与浏览器内 mock（示例数据、接口模拟）。源仓库未附开源许可证（README 标注为本地使用），版权归作者本人所有，此处仅作作品展示，不授予额外许可。
2. **第三方开源依赖**：下表列出构建时实际打包进 \`assets/\` 的全部 npm 包（由构建插件按模块来源自动统计），其后附各自的许可全文与版权声明。

演示中出现的企业（示例公司A–D）及全部金额、比率、映射统计均为虚构示例数据。

| 包 | 版本 | 许可证 | 版权 |
| --- | --- | --- | --- |
${rows.join('\n')}

${sections.join('\n\n')}
`
writeFileSync(OUT, md)
console.log('wrote', OUT, `${(md.length / 1024).toFixed(1)} KB`, `${list.length} packages`)
if (!existsSync(OUT)) process.exit(1)
