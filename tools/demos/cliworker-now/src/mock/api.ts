// Minimal shim of the plugin's remote API (`ctx.remote.cliworker` + `$stream`), served from memory.
// Shapes follow the plugin's shared types and its own test fixtures; nothing here does I/O.
import type { API, Snapshot } from 'cwn-src/client/workers.ts'
import type { AccountStatus } from 'cwn-src/shared/accounts.ts'
import { CLI_IDS, CLI_LABELS, type CliId, type Preference, type RolePreset } from 'cwn-src/shared/types.ts'
import { cliLevelOptions } from 'cwn-src/shared/worker-permissions.ts'
import { CATALOGS, LEGACY_TIMELINE } from './data.ts'
import { store, subscribe, findWorker, updateWorker, archive, restore, stopWorker, emit } from './store.ts'

const ok = <T>(value: T) => ({ ok: true as const, value })
const json = (value: unknown) => ok(JSON.stringify(value))
const fail = (message: string) => ({ ok: false as const, error: { message, code: 'demo' } })
const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))

/** Calls the demo does not model; recorded so the verification script can list them. */
export const unmodelled: string[] = []
;(window as unknown as { __cwnUnmodelled: string[] }).__cwnUnmodelled = unmodelled

function snapshot(selected: string): Snapshot {
  const worker = selected ? findWorker(selected) : undefined
  return {
    language: store.general.language,
    workers: store.workers.map((w) => ({ ...w })),
    archivedWorkers: store.archived.map((w) => ({ ...w })),
    ...(worker ? { selected: { ...worker } } : {}),
    timeline: worker ? LEGACY_TIMELINE(worker) : [],
    revision: store.revision,
    truncated: false,
    runningMessageMode: 'queue',
    ...(worker ? { selectedBusy: worker.status === 'queued' || worker.status === 'running' } : {}),
  } as Snapshot
}

/** Async iterable of snapshot JSON, re-emitted on every store change (the Host's watch stream). */
class Stream {
  private dirty = true
  private wake?: () => void
  private closed = false
  private release: () => void
  constructor(private selected: string) {
    this.release = subscribe(() => {
      this.dirty = true
      this.wake?.()
    })
  }
  async dispose() {
    this.closed = true
    this.release()
    this.wake?.()
  }
  async *[Symbol.asyncIterator]() {
    while (!this.closed) {
      if (this.dirty) {
        this.dirty = false
        yield { value: JSON.stringify(snapshot(this.selected)), accept: () => {} }
      } else await new Promise<void>((resolve) => (this.wake = resolve))
    }
  }
}

const accounts: Partial<Record<CliId, Partial<AccountStatus>>> = {
  codex: { state: 'authenticated', authMethod: 'oauth', accountLabel: 'demo@example.com', summary: '已登录', verification: 'cli' },
  claude: { state: 'authenticated', authMethod: 'oauth', accountLabel: 'writer@example.com', summary: '已登录' },
  pi: { state: 'authenticated', authMethod: 'api', summary: '已配置', logins: [{ providerLabel: 'zai.cn', authMethod: 'api', id: 'zai', source: 'plugin' }] },
  omp: { state: 'authenticated', authMethod: 'api', summary: '已配置', logins: [{ providerLabel: 'zai.cn', authMethod: 'api', id: 'zai', source: 'plugin' }] },
  zcode: { state: 'authenticated', authMethod: 'api', summary: '已配置', logins: [{ providerLabel: 'zai.cn', authMethod: 'api', id: 'zai' }] },
  kimi: { state: 'authenticated', authMethod: 'oauth', accountLabel: 'reader@example.com', summary: '已登录' },
  opencode: { state: 'authenticated', authMethod: 'api', summary: '已配置', logins: [{ providerLabel: 'zai.cn', authMethod: 'api', id: 'zai' }] },
  hermes: { state: 'authenticated', authMethod: 'api', summary: '已配置', logins: [{ providerLabel: 'DeepSeek', authMethod: 'api', id: 'deepseek' }] },
}
const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic' }, { id: 'openai', label: 'OpenAI' }, { id: 'github-copilot', label: 'GitHub Copilot' },
  { id: 'kimi-coding', label: 'Kimi For Coding' }, { id: 'openrouter', label: 'OpenRouter' }, { id: 'deepseek', label: 'DeepSeek' },
  { id: 'zai', label: 'zai.cn', signedIn: true, multi: true },
]
function accountStatus(cli: CliId): AccountStatus {
  const multi = ['opencode', 'pi', 'kimi', 'zcode', 'hermes', 'omp'].includes(cli)
  return {
    cli,
    installed: true,
    state: 'authenticated',
    authMethod: 'oauth',
    accountLabel: undefined,
    summary: '已登录',
    ...accounts[cli],
    actions: [
      { id: 'login', label: multi ? '添加账号' : '登录 / 切换账号', description: `在 ${CLI_LABELS[cli]} 中登录另一个账号`, ...(multi ? { providers: PROVIDERS } : {}) },
      { id: 'logout', label: '退出登录', description: '退出当前账号' },
      { id: 'manage', label: '账号终端', description: '打开此 CLI 的账号终端' },
    ],
  } as AccountStatus
}
export function permissionState(id: string) {
  const worker = findWorker(id)
  const cli = (worker?.preference.cli ?? 'codex') as CliId
  return { currentValue: worker?.level ?? 'auto', options: cliLevelOptions(cli), plan: { supported: false, active: false }, writable: true }
}
const catalog = (cli: CliId) => ({ cli, models: CATALOGS[cli], preference: { cli, ...store.defaults[cli] } })
const demoOnly = '演示环境不会启动真实的 CLI 登录或终端；账号状态均为示例。'

const methods: Record<string, (...args: any[]) => unknown> = {
  watch: (_session: string, selected: string) => ({ selected }),
  catalogForWorker: async (_s: string, id: string) => {
    const worker = findWorker(id)
    await wait(60)
    return worker ? json(catalog(worker.preference.cli!)) : fail('找不到此智能体')
  },
  configureWorker: async (_s: string, id: string, raw: string) => {
    const next = JSON.parse(raw) as Preference
    await wait(150)
    updateWorker(id, { preference: next })
    return json(next)
  },
  permissionForWorker: async (_s: string, id: string) => json(permissionState(id)),
  configureWorkerPermission: async (_s: string, id: string, setting: string) => {
    const level = (setting.startsWith('{') ? (JSON.parse(setting) as { level?: string }).level : setting) ?? 'auto'
    await wait(80)
    updateWorker(id, { level: level as never })
    return json(findWorker(id))
  },
  renameWorker: async (_s: string, id: string, name: string) => {
    await wait()
    updateWorker(id, { agentName: name, agentNameOrigin: 'custom' })
    return ok(undefined)
  },
  renameWorkerTitle: async (_s: string, id: string, title: string) => {
    await wait()
    updateWorker(id, { title })
    return ok(undefined)
  },
  deleteWorker: async (_s: string, id: string) => {
    await wait()
    archive(id)
    return ok(undefined)
  },
  restoreWorker: async (_s: string, id: string) => {
    await wait()
    restore(id)
    return ok(undefined)
  },
  stop: async (_s: string, id: string) => {
    stopWorker(id)
    return json({ runId: findWorker(id)?.runId })
  },
  history: async (_s: string, id: string) => {
    const worker = findWorker(id)!
    const items = LEGACY_TIMELINE(worker)
    return json({ workerId: id, items, start: 0, end: items.length, total: items.length, hasOlder: false, hasNewer: false })
  },
  cliSettings: async () => json({ enabled: store.enabled }),
  setCliEnabled: async (_s: string, cli: CliId, next: boolean) => {
    await wait(200)
    store.enabled = { ...store.enabled, [cli]: next }
    emit()
    return json({ enabled: store.enabled })
  },
  accountStatus: async (_s: string, cli: CliId) => {
    await wait(100 + CLI_IDS.indexOf(cli as never) * 15)
    return json(accountStatus(cli))
  },
  catalogForCli: async (_s: string, cli: CliId) => {
    await wait(80)
    return json(catalog(cli))
  },
  refreshCatalogForCli: async (_s: string, cli: CliId) => {
    await wait(400)
    return json(catalog(cli))
  },
  configure: async (_s: string, raw: string) => {
    const next = JSON.parse(raw) as Preference
    if (next.cli) store.defaults[next.cli] = { model: next.model, effort: next.effort }
    await wait(100)
    return json(next)
  },
  cliExecutablePath: async (_s: string, cli: CliId) => json({ cli, path: `/usr/local/bin/${cli}`, source: 'auto', available: true }),
  refreshCliExecutablePath: async (_s: string, cli: CliId, path: string, action: string) =>
    json({ cli, path: action === 'manual' ? path : `/usr/local/bin/${cli}`, source: action === 'manual' ? 'manual' : 'auto', available: true }),
  runningMessageSettings: async (_s: string, cli: CliId) =>
    json({ cli, mode: store.runningMode[cli] ?? 'queue', canSteer: true }),
  saveRunningMessageMode: async (_s: string, cli: CliId, mode: string) => {
    store.runningMode[cli] = mode
    await wait(100)
    return json({ cli, mode, canSteer: true })
  },
  generalSettings: async () => json(store.general),
  saveGeneralSettings: async (_s: string, raw: string) => {
    Object.assign(store.general, JSON.parse(raw))
    await wait(150)
    return json(store.general)
  },
  rolePresets: async () => {
    await wait(100)
    return json(store.presets)
  },
  saveRolePreset: async (_s: string, raw: string) => {
    const request = JSON.parse(raw) as Partial<RolePreset>
    await wait(150)
    const existing = request.id ? store.presets.find((p) => p.id === request.id) : undefined
    if (existing) Object.assign(existing, { name: request.name, summary: request.summary, prompt: request.prompt })
    else store.presets.push({ id: `custom-${Date.now()}`, name: request.name ?? '', summary: request.summary ?? '', prompt: request.prompt ?? '' })
    return json(store.presets)
  },
  deleteRolePreset: async (_s: string, id: string) => {
    store.presets = store.presets.filter((p) => p.id !== id)
    await wait(100)
    return json(store.presets)
  },
  accountStart: async () => fail(demoOnly),
  accountStartForSource: async () => fail(demoOnly),
  accountStartForProvider: async () => fail(demoOnly),
  accountStartWith: async () => fail(demoOnly),
  accountRespond: async () => fail(demoOnly),
  accountStop: async () => ok(true),
  accountWrite: async () => ok(true),
  accountResize: async () => ok(true),
  accountWatch: () => ({}),
  ensureHarnessConversation: async (_p: string, id: string) => json(findWorker(id)?.harnessConversation),
}

const cliworker = new Proxy(methods, {
  get(target, name: string) {
    if (name in target) return target[name]
    if (typeof name !== 'string' || name === 'then') return undefined
    return async () => {
      if (!unmodelled.includes(name)) unmodelled.push(name)
      return fail('演示环境未模拟此操作')
    }
  },
  has: (target, name) => typeof name === 'string' && name !== 'then',
})

export const api = {
  $stream: ({ open }: { open: (signal: AbortSignal) => unknown }) => {
    const controller = new AbortController()
    const source = open(controller.signal) as { selected?: string }
    const stream = new Stream(source?.selected ?? '')
    const dispose = stream.dispose.bind(stream)
    stream.dispose = async () => {
      controller.abort()
      await dispose()
    }
    return stream
  },
  cliworker,
} as unknown as API
