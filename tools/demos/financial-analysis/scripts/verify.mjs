/**
 * 脚本化走一遍演示的主要流程，截图并检查控制台错误与外部请求。
 * 先在仓库根目录起静态服务：python3 -m http.server 8760 --directory <作品集仓库>
 * 用法：node scripts/verify.mjs [baseUrl] [截图目录]
 *   baseUrl 默认 http://127.0.0.1:8760/projects/financial-analysis/demo/
 * 环境变量 CHROME_PATH 可指定 Chrome 可执行文件。
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:8760/projects/financial-analysis/demo/'
const OUT = path.resolve(process.argv[3] || path.join(tmpdir(), 'fa-demo-shots'))
mkdirSync(OUT, { recursive: true })
const origin = new URL(BASE).origin

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  userDataDir: process.env.CHROME_PROFILE || mkdtempSync(path.join(tmpdir(), 'fa-demo-chrome-')),
  args: ['--window-size=1280,820', '--no-first-run', '--no-default-browser-check'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 820 })

const problems = []
const external = []
page.on('console', (m) => {
  if (['error', 'warn', 'warning', 'assert'].includes(m.type())) problems.push(`[console.${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`))
page.on('request', (r) => {
  const u = r.url()
  if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u)
})
page.on('requestfailed', (r) => problems.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`))
page.on('response', (r) => {
  if (r.status() >= 400) problems.push(`[http ${r.status()}] ${r.url()}`)
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let n = 0
async function shot(name) {
  const file = path.join(OUT, `${String(++n).padStart(2, '0')}-${name}.png`)
  await sleep(1500) // 等 ECharts 入场动画结束
  await page.screenshot({ path: file })
  console.log('shot', file)
}
async function idle(ms = 1300) {
  await sleep(ms)
  await page.waitForFunction(() => !document.querySelector('.el-loading-mask:not([style*="display: none"])'), { timeout: 15000 }).catch(() => {})
  await sleep(250)
}
/** 点击可见、文字完全匹配的元素（按钮 / radio / tab / 菜单） */
async function click(text, scope = 'button, .el-radio-button__inner, .el-tabs__item, .el-menu-item, .el-check-tag, label, span, div') {
  const ok = await page.evaluate(
    (text, scope) => {
      const els = [...document.querySelectorAll(scope)].filter((e) => {
        const r = e.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && e.textContent.replace(/\s+/g, ' ').trim() === text
      })
      const el = els[els.length - 1]
      if (!el) return false
      el.scrollIntoView({ block: 'center' })
      el.click()
      return true
    },
    text,
    scope
  )
  if (!ok) throw new Error(`找不到可点击元素：${text}`)
}
async function go(hash) {
  await page.goto(BASE + hash, { waitUntil: 'networkidle0' })
  await idle(900)
}
async function text() {
  return page.evaluate(() => document.body.innerText)
}
function expect(cond, msg) {
  if (!cond) problems.push(`[assert] ${msg}`)
  else console.log('ok  ', msg)
}

// 1 仪表盘
await go('#/dashboard')
expect((await text()).includes('示例公司A'), '仪表盘列出示例企业')
await shot('dashboard')

// 2 比率分析：三类视图 + KPI 点击
await go('#/analysis')
let t = await text()
expect(/完整度 13\/13/.test(t), '比率分析 2025 年报完整度 13/13')
await shot('analysis-investor')
await click('管理层')
await idle()
await shot('analysis-management')
await click('专业全量')
await idle()
await shot('analysis-professional')
await page.evaluate(() => window.scrollTo(0, 0))
const kpi = await page.$('.kpi-card, [class*="kpi"]')
if (kpi) {
  await kpi.click()
  await idle(300)
}
// 滚到趋势图，悬停一下图表
await page.evaluate(() => {
  const c = [...document.querySelectorAll('canvas')].pop()
  c?.scrollIntoView({ block: 'center' })
})
await sleep(400)
const canvases = await page.$$('canvas')
if (canvases.length) {
  const box = await canvases[canvases.length - 1].boundingBox()
  if (box) await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5)
}
await sleep(500)
await shot('analysis-chart-hover')

// 切换企业（示例公司C 2025 年报；2023 缺现金流量表）
await page.evaluate(() => window.scrollTo(0, 0))

// 3 多期对比：报表切换、季报、表格筛选
await go('#/compare')
t = await text()
expect(t.includes('资产总计') && t.includes('2025 年报'), '多期对比显示资产负债表 KPI')
await shot('compare-balance')
await click('利润表')
await idle()
await shot('compare-income')
// 切到示例公司B（含 2024–2025 季报）再看季报
await (await page.$('.el-select')).click()
await sleep(400)
await click('示例公司B', '.el-select-dropdown__item, .el-select-dropdown__item span')
await idle(1200)
await click('季报')
await idle(1500)
expect((await text()).includes('2025 Q3'), '季报期间可选（示例公司B 2025 Q3）')
await shot('compare-quarterly')
await click('年报')
await idle()
await page.evaluate(() => {
  const input = [...document.querySelectorAll('input')].find((i) => /筛选/.test(i.placeholder || ''))
  input?.scrollIntoView({ block: 'center' })
})
const filter = await page.evaluateHandle(() => [...document.querySelectorAll('input')].find((i) => /筛选/.test(i.placeholder || '')))
if (filter.asElement()) {
  await filter.asElement().type('利润')
  await idle(400)
  await shot('compare-table-filter')
} else problems.push('[assert] 多期对比未找到表格筛选输入框')

// 4 年报导入：在线拉取 → 识别核对 → 批量入库
await go('#/import')
await shot('import-fetch')
const q = await page.evaluateHandle(() => [...document.querySelectorAll('input')].find((i) => /代码或名称/.test(i.placeholder || '')))
await q.asElement().type('示例公司D')
const yearsInput = await page.evaluateHandle(() => [...document.querySelectorAll('input')].find((i) => /年份：/.test(i.placeholder || '')))
await yearsInput.asElement().click({ clickCount: 3 })
await yearsInput.asElement().type('2023-2025')
await click('检索')
await idle(2500)
t = await text()
expect(t.includes('示例公司D：2025年年度报告（示例）'), '检索到示例公告候选')
await shot('import-candidates')
await click('导入勾选（3）')
await idle(5500)
t = await text()
expect(t.includes('映射质量') && t.includes('核心科目覆盖'), '进入识别与核对（映射质量）')
await shot('import-review')
await page.evaluate(() => document.querySelector('.unmapped-block')?.scrollIntoView({ block: 'start' }))
await sleep(300)
await shot('import-review-unmapped')
await click('批量确认入库（3）')
await sleep(700)
// 覆盖率偏低确认框（若出现）
const confirmBtn = await page.evaluate(() => !!document.querySelector('.el-message-box'))
if (confirmBtn) {
  await click('仍要入库')
}
await idle(3500)
t = await text()
expect(t.includes('入库完成') || t.includes('已入库 3'), '批量入库完成')
await shot('import-committed')

// 5 三大报表：新入库企业可见
await go('#/statements')
await shot('statements-balance')
await click('利润表')
await idle()
await shot('statements-income')
await click('编辑')
await idle(800)
await shot('statements-edit-dialog')
await click('取消')
await idle(300)

// 6 Excel 模板导入（示例文件）
await go('#/import')
await click('Excel 模板导入')
await idle(300)
await page.evaluate(() => document.querySelector('.el-select')?.scrollIntoView({ block: 'center' }))
const excelSelect = await page.evaluateHandle(() =>
  [...document.querySelectorAll('.el-select')].find((s) => s.getBoundingClientRect().width > 0 && s.textContent.includes('选择企业'))
)
if (excelSelect.asElement()) {
  await excelSelect.asElement().click()
  await sleep(400)
  await click('示例公司B', '.el-select-dropdown__item, .el-select-dropdown__item span')
  await sleep(300)
}
await click('使用示例 Excel', '.fa-demo-sample button')
await idle(1800)
expect((await text()).includes('将更新'), 'Excel 示例文件预览')
await shot('import-excel-preview')

// 7 PDF 上传（示例文件）
await click('年报 PDF 导入')
await idle(300)
await click('使用示例 PDF', '.fa-demo-sample button')
await idle(2500)
expect((await text()).includes('示例公司D_2025年年度报告（示例）.pdf'), 'PDF 示例文件进入核对')
await shot('import-pdf-review')

// 8 子路径刷新
await page.goto(BASE + '#/compare', { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await idle(900)
expect((await text()).includes('多期对比'), 'hash 路由刷新后仍在多期对比')

// 9 窄 iframe
await page.setViewport({ width: 760, height: 820 })
await go('#/analysis')
await shot('narrow-analysis')
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
expect(overflow <= 0, `窄视窗无整页横向滚动（溢出 ${overflow}px）`)

await browser.close()
console.log('\n外部请求：', external.length ? external : '无')
console.log('问题：', problems.length ? '\n' + problems.join('\n') : '无')
process.exit(problems.length || external.length ? 1 : 0)
