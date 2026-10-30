// Scripted check of the built demo: loads it at 1280×820, walks the main
// interactions and saves screenshots. Usage:
//   node verify.mjs [baseUrl] [outDir]
// Needs puppeteer-core (PUPPETEER_CORE=<path to its package dir>) and Chrome (CHROME=...).
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const base = process.argv[2] || 'http://127.0.0.1:8846/projects/visible-workflow/demo/'
const out = resolve(process.argv[3] || join(here, '.cache/verify'))
mkdirSync(out, { recursive: true })
const candidates = [process.env.PUPPETEER_CORE, join(here, 'node_modules/puppeteer-core'), join(here, '../cliworker-now/node_modules/puppeteer-core')].filter(Boolean)
const pkg = candidates.find(dir => existsSync(join(dir, 'package.json')))
if (!pkg) throw new Error('未找到 puppeteer-core，请设置 PUPPETEER_CORE')
const puppeteer = (await import(pathToFileURL(createRequire(join(pkg, 'package.json')).resolve('puppeteer-core')).href)).default
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', userDataDir: process.env.CHROME_PROFILE || join(out, 'profile'), args: ['--window-size=1280,820', '--no-first-run', '--no-default-browser-check'],
})
const problems = [], requests = []
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 820, deviceScaleFactor: 2 })
page.on('console', message => { if (['error', 'warning'].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`) })
page.on('pageerror', error => problems.push(`pageerror: ${error.message}`))
page.on('request', request => requests.push(request.url()))
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const shot = async name => { await page.screenshot({ path: join(out, `${name}.png`) }); console.log('screenshot', name) }
const click = async (selector, label) => { const handle = await page.waitForSelector(selector, { timeout: 5000 }); await handle.click(); if (label) console.log('click', label) }
const clickText = async (text, scope = 'button') => {
  const ok = await page.evaluate((text, scope) => { const el = [...document.querySelectorAll(scope)].find(node => node.textContent?.trim() === text || node.getAttribute('aria-label') === text); if (!el) return false; el.click(); return true }, text, scope)
  if (!ok) throw new Error(`未找到：${text}`); console.log('click', text)
}

const clickNode = async title => {
  const box = await page.evaluate(title => { const el = [...document.querySelectorAll('.vdw-node')].find(node => node.textContent?.includes(title)); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 24 } }, title)
  if (!box) throw new Error(`未找到节点：${title}`); await page.mouse.click(box.x, box.y); console.log('node', title)
}
const clickLabel = async label => { await click(`[aria-label="${label}"]`, label) }
await page.goto(base + '#reset', { waitUntil: 'networkidle0' }); await wait(800)
await page.goto(base + '#r7', { waitUntil: 'networkidle0' }); await wait(900)
await shot('01-canvas-r7')
await clickNode('解析订单 JSON'); await wait(600); await shot('02-code-config')
await clickNode('读取订单文件'); await wait(600); await shot('03-tool-config')
await clickNode('人工核对验收结果'); await wait(600); await shot('04-human-config')
await page.keyboard.press('Escape'); await wait(300)
// Execute: inputs form, then the human step.
await clickText('执行'); await wait(900); await shot('05-run-inputs')
await clickText('提交并继续'); await wait(9500); await shot('06-run-human')
await clickText('确认核对通过'); await wait(2500); await shot('07-run-done')
await page.evaluate(() => { const row = [...document.querySelectorAll('summary,button')].find(el => /^a-4/.test(el.textContent?.trim() || '')); row?.click() })
await wait(600); await shot('08-run-node-io')
// Hand to Agent dialog.
await clickText('交给 Agent'); await wait(700)
await page.keyboard.type('把汇总改为按金额降序输出。'); await wait(200); await shot('09-ask-agent')
await clickText('提交到聊天草稿'); await wait(800); await shot('10-ask-agent-submitted')
// Text-processing flow with note + readiness notice.
await page.evaluate(() => { location.hash = 'text' }); await wait(1200); await shot('11-canvas-text')
await clickNode('接收文本'); await wait(600); await shot('12-input-config')
await clickNode('整理结果'); await wait(600); await shot('13-template-config')
await page.keyboard.press('Escape'); await wait(300)
await clickText('运行记录'); await wait(700); await shot('14-run-records')
await clickText('执行'); await wait(900); await shot('15-run-blocked'); await page.keyboard.press('Escape'); await wait(400)
await clickLabel('添加节点'); await wait(600); await shot('16-add-node'); await page.keyboard.press('Escape'); await wait(300)
await clickLabel('工作流模板'); await wait(800); await shot('17-templates'); await page.keyboard.press('Escape'); await wait(300)
await clickLabel('高级设置'); await wait(700); await shot('18-advanced'); await page.keyboard.press('Escape'); await wait(300)
await click('[aria-label^="工作流信息"]', '工作流信息'); await wait(700); await shot('19-workflow-info'); await page.keyboard.press('Escape'); await wait(300)
await page.goto(base + '#branch', { waitUntil: 'networkidle0' }); await wait(900); await shot('20-canvas-branch')
await page.evaluate(() => { location.hash = 'home' }); await wait(1200); await shot('21-home')
await page.setViewport({ width: 760, height: 620, deviceScaleFactor: 2 }); await page.goto(base + '#r7', { waitUntil: 'networkidle0' }); await wait(900); await shot('22-narrow')
await page.setViewport({ width: 390, height: 700, deviceScaleFactor: 2 }); await page.reload({ waitUntil: 'networkidle0' }); await wait(900); await shot('23-phone')
const external = requests.filter(url => !url.startsWith(new URL(base).origin) && !url.startsWith('data:'))
console.log('external requests:', external.length ? external : 'none')
console.log('console problems:', problems.length ? problems : 'none')
await browser.close()
if (problems.length || external.length) process.exitCode = 1
