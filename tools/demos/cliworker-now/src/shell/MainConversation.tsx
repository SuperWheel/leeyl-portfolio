// The parent DSH conversation (dsh-client-ui-conversation / chat markup and classes). Dispatching from
// here creates a Worker in the mock Host, exactly what the plugin's cliworker_start tool would do.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Button,
  Tooltip,
  StateDot,
  IconChevronDownOutlineRegular,
  IconChevronRightOutlineRegular,
  IconEllipsisOutlineRegular,
  IconQueueOutlineRegular,
  IconSparkleRegular,
  PermissionIconReadOnlyRegular,
  PermissionIconWorkspaceWriteRegular,
  PermissionIconAutoReviewRegular,
  PermissionIconFullAccessRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { BrandIcon } from 'cwn-src/client/icons.tsx'
import type { CliId, Worker } from 'cwn-src/shared/types.ts'
import { CLI_LABELS } from 'cwn-src/shared/types.ts'
import { CATALOGS, DISPATCHES, type Dispatch } from '../mock/data.ts'
import { store, subscribe, dispatch } from '../mock/store.ts'
import { C, Markdown, ProcessLine, TurnActions, UserBubble, stamp, useStoreRevision, usePopover, useStickToBottom } from './common.tsx'
import { Composer, StatsDock, type PermissionOption } from './Composer.tsx'
import { MAIN_TITLE } from './Sidebar.tsx'
import { OpenInIcon, WorkflowIcon } from './icons.tsx'

type Item =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'trigger'; time: string; content: string }
  | { id: string; kind: 'assistant'; text: string; seconds: number; tokens: string; time: string; steps: string[] }
  | { id: string; kind: 'pending'; label: string }

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const REPORT = `核查完成，子智能体结果汇报如下：

## 任务状态：✅ 完成（completed）

| 项目 | 详情 |
| --- | --- |
| **Worker** | \`codex-1\`（只读审阅，结果写回本对话） |
| **运行 ID** | \`run-demo-0003-a7f2\` |
| **任务内容** | 对照人物状态表核查第 3 章的时间线与持有物 |
| **结果** | 发现 **2 处**矛盾，均附原文位置与最小修复 ✅ |

**说明**：两处矛盾分别在第 12 段（钥匙已在第 2 章交出）和第 31 段（到站时间与出发时间冲突）。Worker 未修改任何文件；与 \`codex-3\` 的文风抽查结论互不冲突，可以一并进入修订。`

const SEED: Item[] = [
  { id: 'u1', kind: 'user', text: '用 CLI Worker 派 Codex 只读审阅第 3 章的前后矛盾，再让 Pi 规划第 4 章节拍，结果都回到这里。' },
  {
    id: 'a1', kind: 'assistant', seconds: 9, tokens: '23.6K tok', time: stamp(ago(97)),
    steps: ['cliworker_start · codex · 逻辑审校员', 'cliworker_start · pi · 剧情节拍规划师'],
    text: '已派遣 **codex-1**（第 3 章前后矛盾核查）和 **pi-2**（第 4 章节拍规划），两者都在后台运行，可以在右侧 CLI Worker 面板查看进度。',
  },
  { id: 't1', kind: 'trigger', time: stamp(ago(55)), content: 'codex-1 · 第 3 章前后矛盾核查 → 已完成\npi-2 · 第 4 章节拍规划 → 已完成' },
  { id: 'a2', kind: 'assistant', seconds: 18, tokens: '156K tok', time: stamp(ago(54)), steps: ['cliworker_status · codex-1', 'cliworker_result · codex-1', 'cliworker_result · pi-2'], text: REPORT },
]

const PERMISSIONS: PermissionOption[] = [
  { value: 'read-only', name: '仅可查看', description: '只读取文件和运行只读命令；修改前会先询问。', icon: <PermissionIconReadOnlyRegular size={14} /> },
  { value: 'workspace-write', name: '工作区内修改', description: '可在当前工作区内修改文件；工作区外的操作先询问。', icon: <PermissionIconWorkspaceWriteRegular size={14} /> },
  { value: 'auto', name: '自动审查', description: '无沙箱运行；每次原生工具调用前由同一模型进行实验性审查。', icon: <PermissionIconAutoReviewRegular size={14} /> },
  { value: 'full', name: '完全权限', description: '减少确认步骤，可以直接执行更多操作。仅建议在你信任当前任务时使用。', icon: <PermissionIconFullAccessRegular size={14} /> },
]
const MAIN_MODELS = [
  { id: 'glm-5.3-flash', label: 'GLM-5.3-Flash' },
  { id: 'glm-5.3', label: 'GLM-5.3' },
  { id: 'deepseek-v4', label: 'DeepSeek-V4' },
]
const MAIN_EFFORTS = [
  { id: 'low', label: 'Low' },
  { id: 'high', label: 'High' },
  { id: 'max', label: 'Max' },
]

function guessJob(text: string): Dispatch {
  const known = DISPATCHES.find((d) => d.label === text)
  if (known) return known
  const lower = text.toLowerCase()
  const cli: CliId = /\bpi\b|规划|节拍/.test(lower) ? 'pi' : /claude|草稿|写/.test(lower) ? 'claude' : 'codex'
  const title = text.replace(/^(请|让|用)\s*(codex|pi|claude( code)?)?\s*/i, '').slice(0, 18) || '示例任务'
  return {
    cli,
    label: text,
    title,
    prompt: text,
    reply: `已完成「${title}」。这是演示环境的示例回复：结论与证据已写回本对话，未修改任何文件。`,
  }
}

function TriggerCard({ time, content }: { time: string; content: string }) {
  const [open, setOpen] = useState(false)
  const T = C.TurnTriggerNodeView!
  return (
    <div className={T.root}>
      <button type="button" className={T.header} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={T.icon}>
          <IconQueueOutlineRegular size={15} />
        </span>
        <span className={T.title}>后台任务状态更新</span>
        <span className={T.time}>{time}</span>
        <IconChevronDownOutlineRegular size={14} className={open ? T.openChevron : T.chevron} />
      </button>
      {open && (
        <div className={T.body}>
          <p className={T.explanation}>CLI Worker 在子智能体状态变化时把结果送回主对话：</p>
          <div className={T.content}>{content}</div>
        </div>
      )}
    </div>
  )
}

function tokensOf(worker: Worker) {
  const turns = store.turns[worker.id] ?? []
  const total = turns.reduce((sum, t) => sum + parseFloat(t.tokens), 0)
  return total ? `${total.toFixed(1)}K` : '—'
}
function durationOf(worker: Worker) {
  const turns = store.turns[worker.id] ?? []
  const s = turns.reduce((sum, t) => sum + t.seconds, 0)
  return s ? `${s}s` : '—'
}

/** "N 个子智能体" header lineage (dsh-client-ui-subagent SubagentHeaderLineage). */
function Lineage({ onOpenWorker }: { onOpenWorker: (worker: Worker) => void }) {
  useStoreRevision()
  const L = C.SubagentHeaderLineage!
  const { open, setOpen, ref, menu } = usePopover()
  const trigger = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    if (!open || !trigger.current) return
    const r = trigger.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: r.left - 4 })
  }, [open])
  const workers = store.workers
  const running = workers.filter((w) => w.status === 'running' || w.status === 'queued').length
  const model = (w: Worker) => CATALOGS[w.preference.cli ?? 'codex'].find((m) => m.id === w.preference.model)?.label ?? w.preference.model
  return (
    <div className={`${L.root} demo-lineage`} ref={ref}>
      <button
        ref={trigger}
        type="button"
        className={L.trigger}
        aria-haspopup="tree"
        aria-expanded={open}
        data-demo="lineage"
        onClick={() => setOpen(!open)}
      >
        {running > 0 && (
          <span className={L.activitySlot}>
            <StateDot state="ongoing" />
          </span>
        )}
        <span>{workers.length} 个子智能体</span>
        <IconChevronDownOutlineRegular className={open ? L.triggerOpen : undefined} />
      </button>
      {open &&
        createPortal(
          <div className={`${L.menu} demo-lineage-menu`} style={pos} ref={menu}>
            <div className={L.menuBody} role="tree">
              {workers.map((w) => (
                <div key={w.id} className={L.node}>
                  <div
                    role="treeitem"
                    tabIndex={0}
                    className={L.row}
                    onClick={() => {
                      onOpenWorker(w)
                      setOpen(false)
                    }}
                  >
                    <span className={L.disclosureSpace} />
                    <div className={L.clickarea}>
                      <span className={L.rowActivitySlot}>
                        <StateDot state={w.status === 'running' || w.status === 'queued' ? 'ongoing' : w.status === 'completed' ? 'done' : 'idle'} />
                      </span>
                      <span className={L.content}>
                        <span className={L.label}>{w.title}</span>
                        <span className={L.summary}>
                          {w.agentName} · {CLI_LABELS[w.preference.cli ?? 'codex']} · {model(w)}
                        </span>
                      </span>
                      <span className={L.metrics}>
                        <span className={L.metricToken}>{tokensOf(w)}</span>
                        <span className={L.metricDuration}>{durationOf(w)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export function MainConversation({ onOpenWorker, onOpenPanel, panelOpen }: {
  onOpenWorker: (worker: Worker) => void
  onOpenPanel: () => void
  panelOpen: boolean
}) {
  const R = C.ConversationRoot!
  const [items, setItems] = useState<Item[]>(SEED)
  const [tab, setTab] = useState<'chat' | 'trace'>('chat')
  const [permission, setPermission] = useState('workspace-write')
  const [mainModel, setMainModel] = useState({ model: 'glm-5.3-flash', effort: 'max' })
  const watched = useRef(new Map<string, Dispatch>())
  const { ref: scroll, stick } = useStickToBottom<HTMLDivElement>()
  const serial = useRef(0)
  const nextId = () => `m${++serial.current}`

  useLayoutEffect(() => {
    stick.current = true
    const el = scroll.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items.length, tab])

  // Report finished Workers back into this conversation, like the plugin's status trigger.
  useEffect(
    () =>
      subscribe(() => {
        for (const [id, job] of watched.current) {
          const worker = store.workers.find((w) => w.id === id)
          if (!worker || worker.status !== 'completed') continue
          watched.current.delete(id)
          const now = new Date().toISOString()
          setItems((old) => [
            ...old,
            { id: nextId(), kind: 'trigger', time: stamp(now), content: `${worker.agentName} · ${worker.title} → 已完成` },
            {
              id: nextId(), kind: 'assistant', seconds: 4, tokens: '12.8K tok', time: stamp(now),
              steps: [`cliworker_result · ${worker.agentName}`],
              text: `**${worker.agentName}** 已完成「${worker.title}」：\n\n${job.reply}`,
            },
          ])
        }
      }),
    [],
  )

  const send = (text: string, job = guessJob(text)) => {
    const pending = nextId()
    setTab('chat')
    setItems((old) => [...old, { id: nextId(), kind: 'user', text }, { id: pending, kind: 'pending', label: '正在调用 cliworker_start…' }])
    onOpenPanel()
    setTimeout(() => {
      const worker = dispatch(job)
      watched.current.set(worker.id, job)
      setItems((old) =>
        old.map((item) =>
          item.id === pending
            ? {
                id: pending, kind: 'assistant', seconds: 2, tokens: '6.4K tok', time: stamp(new Date().toISOString()),
                steps: [`cliworker_start · ${job.cli}${job.role ? ' · 角色预设' : ''}`],
                text: `已通过 CLI Worker 派遣 **${worker.agentName}**（${CLI_LABELS[job.cli]}）：${job.title}。它在后台运行，进度见右侧面板，完成后结果会回到本对话。`,
              }
            : item,
        ),
      )
    }, 900)
  }

  const modelLabel = MAIN_MODELS.find((m) => m.id === mainModel.model)!.label
  const effortLabel = MAIN_EFFORTS.find((e) => e.id === mainModel.effort)!.label

  const chips: ReactNode = (
    <div className="demo-dispatch" role="group" aria-label="示例指令">
      <IconSparkleRegular size={13} />
      {DISPATCHES.map((job) => (
        <button key={job.label} type="button" className="demo-chip" data-demo={`dispatch-${job.cli}`} onClick={() => send(job.label, job)}>
          {job.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className={R.root} data-phase="active" data-demo="main">
      <div className={R.header}>
        <div className={R.titleRow}>
          <div className={R.titleCluster}>
            <nav className={R.crumbs} aria-label="会话层级">
              <span className={R.crumbSeg}>
                <span className={`${R.crumb} ${R.crumbCurrent}`}>{MAIN_TITLE}</span>
                <Lineage onOpenWorker={onOpenWorker} />
              </span>
            </nav>
            <div className={R.headerActions} />
          </div>
          <div className={R.headerUtilities}>
            <Tooltip label="打开 CLI Worker" side="bottom" portal>
              <Button
                variant="ghost"
                size="sm"
                aria-label="打开 CLI Worker"
                className={`cwn-entry ${panelOpen ? 'demo-entry-active' : ''}`}
                icon={<BrandIcon size={16} />}
                onClick={onOpenPanel}
              />
            </Tooltip>
            <Tooltip label="工作流（演示中未启用）" side="bottom" portal>
              <button type="button" className="demo-header-icon" aria-label="工作流">
                <WorkflowIcon />
              </button>
            </Tooltip>
            <span className="demo-open-in">
              <Tooltip label="在访达中打开（演示中不可用）" side="bottom" portal>
                <button type="button" aria-label="在访达中打开">
                  <OpenInIcon />
                </button>
              </Tooltip>
              <button type="button" aria-label="选择打开方式">
                <IconChevronDownOutlineRegular size={12} />
              </button>
            </span>
          </div>
          <div className={R.headerCorner}>
            <button type="button" className="demo-header-icon" aria-label="更多操作">
              <IconEllipsisOutlineRegular size={16} />
            </button>
          </div>
        </div>
        <div className={R.tabs}>
          <div className={R.viewTabs} role="tablist">
            {(['chat', 'trace'] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`${R.tab} ${tab === id ? R.tabActive : ''}`}
                onClick={() => setTab(id)}
              >
                <span className={R.tabLabel}>{id === 'chat' ? '对话' : '轨迹'}</span>
              </button>
            ))}
          </div>
          <span className={R.viewsMoreAnchor}>
            <button type="button" className={`${R.viewsMore} demo-views-more`} aria-label="更多视图">
              <IconEllipsisOutlineRegular size={13} />
            </button>
          </span>
        </div>
      </div>
      <div className={R.body}>
        <div className={R.scrollBody}>
          <div className={C.ChatView!.frame}>
            <div className={C.ChatView!.root}>
              <div className={`${C.ChatView!.scroll} demo-chat-scroll`} ref={scroll}>
                <div className={`${C.ChatView!.column} demo-column`}>
                  {tab === 'trace' ? (
                    <div className="demo-trace">
                      {items.flatMap((item) => (item.kind === 'assistant' ? item.steps : [])).map((step, i) => (
                        <div key={i} className="demo-trace-row">
                          <IconChevronRightOutlineRegular size={12} />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    items.map((item) =>
                      item.kind === 'user' ? (
                        <div key={item.id} className="demo-turn">
                          <UserBubble text={item.text} />
                        </div>
                      ) : item.kind === 'trigger' ? (
                        <div key={item.id} className="demo-flow">
                          <TriggerCard time={item.time} content={item.content} />
                        </div>
                      ) : item.kind === 'pending' ? (
                        <div key={item.id} className="demo-flow">
                          <ProcessLine label={<span className="demo-shimmer">{item.label}</span>} busy />
                        </div>
                      ) : (
                        <div key={item.id} className="demo-flow">
                          <ProcessLine
                            label={<>已完成，用时 <span className={C.TurnProcessNodeView!.durationNumber}>{item.seconds}</span> 秒</>}
                            steps={item.steps}
                          />
                          <div className={C.AssistantMarkdown!.root}>
                            <div className={C.AssistantMarkdown!.body}>
                              <Markdown text={item.text} />
                            </div>
                            <div className={C.AssistantMarkdown!.actions}>
                              <TurnActions text={item.text} tokens={item.tokens} time={item.time} />
                            </div>
                          </div>
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={R.composerSeat}>
          <Composer
            onSend={(text) => send(text)}
            iconOnlyPermission
            above={chips}
            permission={{ options: PERMISSIONS, value: permission, onChange: setPermission }}
            model={{
              state: { model: mainModel.model, modelLabel, effort: mainModel.effort, effortLabel, models: MAIN_MODELS, efforts: MAIN_EFFORTS, provider: '模型服务' },
              onModel: (model) => setMainModel({ ...mainModel, model }),
              onEffort: (effort) => setMainModel({ ...mainModel, effort }),
            }}
            dock={<StatsDock steps="12 轮 38 步 · 26 分钟" tokens="1.6M tok · 缓存命中 82%" percent={8} />}
          />
        </div>
      </div>
    </div>
  )
}
