// In-memory stand-in for the CLI Worker Host. Everything lives in this page; nothing is sent anywhere.
import type { CliId, Effort, Worker, WorkerLevel } from 'cwn-src/shared/types.ts'
import { CLI_IDS } from 'cwn-src/shared/types.ts'
import { DEFAULT_PREFS, PRESETS, seed, makeWorker, type NativeTurn, type Dispatch } from './data.ts'

type Listener = () => void

export const store = {
  revision: 1,
  workers: [] as Worker[],
  archived: [] as Worker[],
  turns: {} as Record<string, NativeTurn[]>,
  presets: PRESETS.map((p) => ({ ...p })),
  enabled: Object.fromEntries(CLI_IDS.map((id) => [id, true])) as Record<CliId, boolean>,
  defaults: { ...DEFAULT_PREFS } as Record<string, { model: string; effort: Effort }>,
  general: {
    maxConcurrent: 5,
    defaultMaxConcurrent: 2,
    language: 'follow' as 'follow' | 'zh' | 'en',
    isolatedParallelWrites: true,
    askBeforeDispatch: true,
    taskTimeLimitMs: 1_800_000,
    defaultTaskTimeLimitMs: 1_800_000,
    idleTimeLimitMs: 0,
  },
  runningMode: { pi: 'steer', omp: 'steer' } as Record<string, string>,
  listeners: new Set<Listener>(),
}
for (const { worker, turns } of seed()) {
  store.workers.push(worker)
  store.turns[worker.id] = turns
}

export function subscribe(listener: Listener) {
  store.listeners.add(listener)
  return () => {
    store.listeners.delete(listener)
  }
}
export function emit() {
  store.revision += 1
  for (const listener of [...store.listeners]) listener()
}
export const findWorker = (id: string) => store.workers.find((w) => w.id === id) ?? store.archived.find((w) => w.id === id)

export function updateWorker(id: string, patch: Partial<Worker>) {
  const worker = findWorker(id)
  if (!worker) return
  Object.assign(worker, patch, { updatedAt: new Date().toISOString() })
  emit()
}

export function setLevel(id: string, level: WorkerLevel) {
  updateWorker(id, { level })
}

const timers = new Map<string, Set<ReturnType<typeof setTimeout>>>()
const later = (owner: string, ms: number, fn: () => void) => {
  const own = timers.get(owner) ?? new Set()
  timers.set(owner, own)
  const handle = setTimeout(() => {
    own.delete(handle)
    fn()
  }, ms)
  own.add(handle)
}

/** Simulated run: queued → running (reply streams in) → completed. */
function runTurn(worker: Worker, turn: NativeTurn, queuedFor = 900) {
  worker.status = 'queued'
  turn.state = 'queued'
  emit()
  later(worker.id, queuedFor, () => {
    worker.status = 'running'
    turn.state = 'running'
    emit()
    const full = turn.reply
    turn.reply = ''
    const chunks = Math.max(14, Math.ceil(full.length / 10))
    let index = 0
    const started = Date.now()
    const step = () => {
      index += 1
      turn.reply = full.slice(0, Math.ceil((full.length * index) / chunks))
      if (index < chunks) {
        emit()
        later(worker.id, 200, step)
        return
      }
      turn.seconds = Math.max(3, Math.round((Date.now() - started) / 1000) + 4)
      turn.state = 'done'
      worker.status = 'completed'
      worker.lastResult = full
      worker.updatedAt = new Date().toISOString()
      emit()
    }
    later(worker.id, 700, step)
  })
}

let dispatched = 0
export function dispatch(job: Dispatch): Worker {
  const count = store.workers.filter((w) => w.preference.cli === job.cli).length + store.archived.filter((w) => w.preference.cli === job.cli).length
  const worker = makeWorker(job.cli, count + 1, job.title, job.role, 0, 'queued')
  worker.id = `wnew${++dispatched}${job.cli}`
  worker.conversationId = `native-${worker.id}`
  worker.harnessConversation = { ...worker.harnessConversation!, sessionId: `child-${worker.id}` }
  const def = store.defaults[job.cli]
  if (def) worker.preference = { cli: job.cli, model: def.model, effort: def.effort }
  const turn: NativeTurn = {
    id: `${worker.id}-1`,
    prompt: job.prompt,
    promptTime: new Date().toISOString(),
    reply: job.reply,
    seconds: 0,
    tokens: `${(12 + Math.random() * 40).toFixed(1)}K tok`,
    state: 'queued',
  }
  store.workers.push(worker)
  store.turns[worker.id] = [turn]
  runTurn(worker, turn, 1400)
  return worker
}

const REPLIES = [
  '收到。我按同一会话继续：已对照上一轮结论复查相关段落，没有发现新的冲突，原建议保持不变。',
  '好的，已按要求补充：新增两处原文引用作为证据，并把建议压缩为一句可直接替换的改写。',
  '已完成。这一轮只读不改，结论已同步到本对话，主对话可以直接引用。',
]
let replyIndex = 0
/** A follow-up sent from the Worker's own conversation gets an example reply. */
export function followup(workerId: string, prompt: string) {
  const worker = findWorker(workerId)
  if (!worker) return
  const turn: NativeTurn = {
    id: `${workerId}-${Date.now()}`,
    prompt,
    promptTime: new Date().toISOString(),
    reply: REPLIES[replyIndex++ % REPLIES.length]!,
    seconds: 0,
    tokens: `${(8 + Math.random() * 20).toFixed(1)}K tok`,
    state: 'queued',
  }
  ;(store.turns[workerId] ??= []).push(turn)
  worker.runId = `run-${workerId}-${store.turns[workerId]!.length}`
  runTurn(worker, turn, 500)
}

export function stopWorker(workerId: string) {
  const worker = findWorker(workerId)
  if (!worker) return
  for (const handle of timers.get(workerId) ?? []) clearTimeout(handle)
  timers.delete(workerId)
  const last = store.turns[workerId]?.at(-1)
  if (last && last.state !== 'done') {
    last.state = 'done'
    last.reply = last.reply || '（已停止）'
  }
  worker.status = 'interrupted'
  worker.interruptionReason = 'user'
  emit()
}

export function archive(id: string) {
  const index = store.workers.findIndex((w) => w.id === id)
  if (index < 0) return
  const [worker] = store.workers.splice(index, 1)
  worker!.archivedAt = new Date().toISOString()
  store.archived.unshift(worker!)
  emit()
}
export function restore(id: string) {
  const index = store.archived.findIndex((w) => w.id === id)
  if (index < 0) return
  const [worker] = store.archived.splice(index, 1)
  delete worker!.archivedAt
  store.workers.push(worker!)
  emit()
}
