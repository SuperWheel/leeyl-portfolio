// What DSH shows inside the CLI Worker sidebar once a Worker is opened: the Worker's own native
// conversation (DSH ChatView + InputBar). The plugin's Panel supplies the header and task menu.
import {
  PermissionIconReadOnlyRegular,
  PermissionIconWorkspaceWriteRegular,
  PermissionIconFullAccessRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { Worker, WorkerLevel } from 'cwn-src/shared/types.ts'
import { effortLabel, CLI_LABELS } from 'cwn-src/shared/types.ts'
import { cliLevelOptions } from 'cwn-src/shared/worker-permissions.ts'
import { CATALOGS } from '../mock/data.ts'
import { store, findWorker, followup } from '../mock/store.ts'
import { api } from '../mock/api.ts'
import { PARENT } from '../mock/data.ts'
import { C, Markdown, ProcessLine, TurnActions, UserBubble, stamp, useStoreRevision, useStickToBottom } from './common.tsx'
import { Composer, StatsDock, type PermissionOption } from './Composer.tsx'

const LEVEL_ICONS: Record<WorkerLevel, JSX.Element> = {
  ask: <PermissionIconReadOnlyRegular size={14} />,
  auto: <PermissionIconWorkspaceWriteRegular size={14} />,
  full: <PermissionIconFullAccessRegular size={14} />,
}

const parseTokens = (text: string) => parseFloat(text) * (text.includes('M') ? 1000 : 1)

export function NativeConversation({ worker: initial }: { worker: Worker }) {
  useStoreRevision()
  const worker = findWorker(initial.id) ?? initial
  const turns = store.turns[worker.id] ?? []
  const cli = worker.preference.cli ?? 'codex'
  const { ref: scroll, stick } = useStickToBottom<HTMLDivElement>()

  const options: PermissionOption[] = cliLevelOptions(cli).map((o) => ({ ...o, icon: LEVEL_ICONS[o.value] }))
  const catalog = CATALOGS[cli]
  const model = catalog.find((m) => m.id === worker.preference.model) ?? catalog[0]!
  const effort = worker.preference.effort ?? model.efforts?.[0] ?? 'default'
  const busy = worker.status === 'queued' || worker.status === 'running'
  const totalTokens = turns.reduce((sum, t) => sum + parseTokens(t.tokens), 0)
  const percent = Math.min(64, 4 + Math.round(totalTokens / 14))

  const configure = (next: { model?: string; effort?: string }) => {
    const target = catalog.find((m) => m.id === (next.model ?? model.id)) ?? model
    const nextEffort = next.effort ?? (target.efforts?.includes(effort as never) ? effort : target.efforts?.[0] ?? 'default')
    void api.cliworker.configureWorker(PARENT, worker.id, JSON.stringify({ cli, model: target.id, effort: nextEffort }))
  }

  return (
    <div className="cwn-harness-conversation" data-cliworker-native-sidebar={worker.id}>
      <div data-conversation-content="" className={`${C.ConversationRoot!.root} demo-native`} data-phase="active">
        <div className={`${C.ConversationRoot!.body} demo-native-body`}>
          <div className={C.ConversationRoot!.scrollBody}>
            <div className={C.ChatView!.frame}>
              <div className={C.ChatView!.root}>
                <div className={`${C.ChatView!.scroll} demo-chat-scroll`} ref={scroll}>
                  <div className={`${C.ChatView!.column} demo-column`}>
                    {turns.map((turn) => (
                      <div key={turn.id} className="demo-turn">
                        <UserBubble text={turn.prompt} time={stamp(turn.promptTime)} />
                        {turn.state === 'queued' ? (
                          <ProcessLine label="排队中，等待 CLI 接收…" busy />
                        ) : turn.state === 'running' ? (
                          <>
                            <ProcessLine label={<span className="demo-shimmer">正在回复…</span>} busy />
                            {turn.reply && (
                              <div className={C.AssistantMarkdown!.root}>
                                <div className={C.AssistantMarkdown!.body}>
                                  <Markdown text={turn.reply} streaming />
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <ProcessLine
                              label={<>已完成，用时 <span className={C.TurnProcessNodeView!.durationNumber}>{turn.seconds}</span> 秒</>}
                              steps={[`读取任务上下文（${worker.agentName}）`, '调用原生工具 · 只读', '整理结论并写回本对话']}
                            />
                            <div className={C.AssistantMarkdown!.root}>
                              <div className={C.AssistantMarkdown!.body}>
                                <Markdown text={turn.reply} />
                              </div>
                              <div className={C.AssistantMarkdown!.actions}>
                                <TurnActions text={turn.reply} tokens={turn.tokens} time={stamp(turn.promptTime)} />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={C.ConversationRoot!.composerSeat}>
            <Composer
              busy={busy}
              onSend={(text) => {
                stick.current = true
                followup(worker.id, text)
              }}
              permission={{
                options,
                value: worker.level ?? 'auto',
                onChange: (value) => void api.cliworker.configureWorkerPermission(PARENT, worker.id, value),
              }}
              model={{
                state: {
                  model: model.id,
                  modelLabel: model.label,
                  effort,
                  effortLabel: effortLabel(effort),
                  models: catalog.map((m) => ({ id: m.id, label: m.label })),
                  efforts: (model.efforts ?? ['default']).map((e) => ({ id: e, label: effortLabel(e) })),
                  provider: CLI_LABELS[cli],
                },
                onModel: (id) => configure({ model: id }),
                onEffort: (id) => configure({ effort: id }),
              }}
              dock={
                <StatsDock
                  steps={`${turns.length} 轮 ${turns.length * 3} 步`}
                  tokens={`${Math.round(totalTokens * 1.4)}K tok · 缓存命中 71%`}
                  percent={percent}
                />
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
