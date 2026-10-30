// Drives the built demo in headless Chrome and saves one screenshot per scene.
//
//   node verify.mjs [outDir]
//
// Serves the portfolio from a temporary folder as /leeyl-portfolio/ (the GitHub Pages
// subpath) on a free port in 8900–8999, fails on console errors or any request that leaves
// that origin, and stops the server at the end. CHROME overrides the browser path.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const out = resolve(process.argv[2] || join(here, '.cache/shots'))
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(out, { recursive: true })

const free = (port) =>
  new Promise((ok) => {
    const probe = createServer().once('error', () => ok(false)).once('listening', () => probe.close(() => ok(true)))
    probe.listen(port, '127.0.0.1')
  })
let port = 0
for (let p = 8900; p < 9000 && !port; p++) if (await free(p)) port = p
if (!port) throw new Error('no free port in 8900–8999')

const root = mkdtempSync(join(tmpdir(), 'cwn-demo-'))
symlinkSync(repo, join(root, 'leeyl-portfolio'))
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', root], { stdio: 'ignore' })
const origin = `http://127.0.0.1:${port}`
const base = `${origin}/leeyl-portfolio/projects/cliworker-now/demo/`
for (let i = 0; i < 50; i++) {
  if (!(await free(port))) break
  await new Promise((r) => setTimeout(r, 100))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const problems = []
const profile = mkdtempSync(join(tmpdir(), 'cwn-chrome-'))
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', userDataDir: profile, args: ['--no-first-run', '--hide-scrollbars'] })

async function open(url, width = 1280, height = 820, scale = 2) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: scale })
  page.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && problems.push(`console: ${m.text()} @ ${url}`))
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`))
  page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('/favicon.ico') && problems.push(`HTTP ${r.status()}: ${r.url()}`))
  page.on('request', (r) => !r.url().startsWith(origin) && !r.url().startsWith('data:') && problems.push(`external: ${r.url()}`))
  await page.goto(url, { waitUntil: 'networkidle0' })
  await sleep(500)
  return page
}
/** The demo app runs inside the page's self-hosted, scale-to-fit iframe. */
const appOf = (page) => page.frames().find((f) => f !== page.mainFrame() && f.url().includes('frame=1')) ?? page.mainFrame()
/** Click the first element matching `selector` whose text or aria-label contains `text`. */
async function click(app, selector, text) {
  const done = await app.evaluate(
    (selector, text) => {
      const el = [...document.querySelectorAll(selector)].find(
        (e) => !text || (e.getAttribute('aria-label') ?? '').includes(text) || (e.textContent ?? '').includes(text),
      )
      if (!el) return false
      el.scrollIntoView({ block: 'nearest' })
      el.click()
      return true
    },
    selector,
    text,
  )
  if (!done) throw new Error(`nothing to click: ${selector} ${text ?? ''}`)
  await sleep(350)
}
async function hover(app, selector) {
  await app.hover(selector)
  await sleep(350)
}
const shot = async (page, name) => {
  await page.mouse.move(2, 600)
  await sleep(150)
  await page.screenshot({ path: join(out, `${name}.png`) })
  console.log(`saved ${name}.png`)
}

try {
  let page = await open(base)
  let app = appOf(page)
  if (app === page.mainFrame()) throw new Error('top-level page did not host the scaled frame')
  await shot(page, '01-list')
  await click(app, '[data-demo=lineage]')
  await shot(page, '01b-lineage-menu')
  await page.keyboard.press('Escape')
  await page.mouse.click(700, 400)

  await click(app, '[data-open-worker-id]')
  await sleep(600)
  await shot(page, '02-detail')
  await click(app, '.cwn-actions > summary')
  await shot(page, '03-task-options')
  await click(app, '.cwn-actions > summary')
  await click(app, '.cwn [data-demo=permission]')
  await shot(page, '04-access-menu')
  await click(app, '[role=menuitem]', '询问')
  await click(app, '.cwn [data-demo=model]')
  await hover(app, '[role=menuitem]')
  await shot(page, '05-model-menu')
  await page.keyboard.press('Escape')
  await page.mouse.click(1000, 300)
  await app.type('.cwn .demo-input', '把结论压缩成一句话')
  await page.keyboard.press('Enter')
  await sleep(1600)
  await shot(page, '05b-followup-running')
  await sleep(2600)
  await shot(page, '05c-followup-done')

  await click(app, '.cwn-back')
  await click(app, '.cwn-settings-button')
  await sleep(500)
  await shot(page, '07-settings-general')
  await click(app, '.cwn-settings-nav button', '智能体设置')
  await sleep(300)
  await shot(page, '08-settings-presets')
  await click(app, '.cwn-role-card button', '商业审稿人')
  await shot(page, '09-preset-edit')
  await click(app, '.cwn-settings-cli-item', 'Codex')
  await sleep(700)
  await shot(page, '06-settings-codex')
  await click(app, '.cwn-settings-cli-item', 'Pi')
  await sleep(700)
  await shot(page, '10-settings-pi')
  await click(app, '.cwn-settings-pane button', '账号')
  await sleep(300)
  await shot(page, '11-pi-account')
  await page.keyboard.press('Escape')
  await sleep(300)
  await click(app, 'button[aria-label="高级设置"]')
  await sleep(500)
  await shot(page, '12-pi-advanced')
  await page.keyboard.press('Escape')
  await sleep(400)

  await click(app, '.cwn-archive-toggle')
  await shot(page, '13-deleted-empty')
  await click(app, '.cwn-archive-toggle')
  await click(app, '.cwn-cli-heading')
  await sleep(300)
  await shot(page, '14-group-collapsed')
  await click(app, '.cwn-cli-heading')
  await click(app, '.cwn-filters button', '进行中')
  await shot(page, '15-filter-running')
  await click(app, '.cwn-filters button', '全部')

  await click(app, '[data-demo=dispatch-codex]')
  await sleep(1200)
  await shot(page, '16-dispatch-queued')
  await sleep(1900)
  await shot(page, '17-dispatch-running')
  await sleep(4500)
  await shot(page, '18-dispatch-done')
  const unmodelled = await app.evaluate(() => window.__cwnUnmodelled)
  if (unmodelled?.length) console.log('unmodelled host calls:', unmodelled.join(', '))
  await page.close()

  // A narrower frame scales the whole window down instead of reflowing it.
  page = await open(base, 760, 520, 1)
  app = appOf(page)
  await shot(page, '19-narrow-760')
  // Anchored menus must still line up with their triggers while the page is zoomed.
  await click(app, '[data-open-worker-id]')
  await sleep(500)
  await click(app, '.cwn [data-demo=permission]')
  await shot(page, '19b-narrow-access-menu')
  await page.keyboard.press('Escape')
  await click(app, '.cwn [data-demo=model]')
  await shot(page, '19c-narrow-model-menu')
  await page.keyboard.press('Escape')
  await click(app, '[data-demo=lineage]')
  await shot(page, '19d-narrow-lineage')
  await page.close()
  // The project page embeds the demo in an iframe.
  page = await open(`${origin}/leeyl-portfolio/projects/cliworker-now/`, 1280, 900, 1)
  await sleep(800)
  await shot(page, '20-project-page')
  await page.close()
} finally {
  await browser.close()
  server.kill()
  rmSync(root, { recursive: true, force: true })
  rmSync(profile, { recursive: true, force: true })
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`ok: no console errors or external requests (port ${port})`)
