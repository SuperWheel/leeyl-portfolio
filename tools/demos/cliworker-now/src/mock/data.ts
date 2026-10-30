// Sample data only. Names, sessions and replies are invented for the portfolio demo.
import type { CliId, ModelChoice, RolePreset, Worker, TimelineItem, Effort } from 'cwn-src/shared/types.ts'
import { CLI_IDS } from 'cwn-src/shared/types.ts'

export const PARENT = 'demo-parent-session'

/** Catalog per CLI, as the Host's catalogForCli would report it. */
export const CATALOGS: Record<CliId, ModelChoice[]> = {
  antigravity: [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', efforts: ['low', 'medium', 'high'] },
    { id: 'gemini-3.8-pro', label: 'Gemini 3.8 Pro', efforts: ['low', 'high'] },
  ],
  codex: [
    { id: 'gpt-6-luna', label: 'GPT-6-Luna', efforts: ['low', 'medium', 'high', 'xhigh'] },
    { id: 'gpt-6-sol', label: 'GPT-6-Sol', efforts: ['low', 'medium', 'high', 'xhigh'] },
    { id: 'gpt-6-mini', label: 'GPT-6-Mini', efforts: ['low', 'medium', 'high'] },
  ],
  claude: [
    { id: 'claude-sonnet', label: 'Sonnet', efforts: ['low', 'medium', 'high', 'max'] },
    { id: 'claude-opus', label: 'Opus', efforts: ['low', 'medium', 'high', 'max'] },
  ],
  kimi: [{ id: 'kimi-k3', label: 'Kimi K3', efforts: ['default'] }],
  mimo: [{ id: 'mimo-v2.6-flash', label: 'MiMo V2.6 Flash', efforts: ['low', 'high'] }],
  zcode: [
    { id: 'glm-5.3-flash', label: 'GLM-5.3-Flash', efforts: ['low', 'high', 'max'] },
    { id: 'glm-5.3', label: 'GLM-5.3', efforts: ['low', 'high', 'max'] },
  ],
  grok: [{ id: 'grok-4.6', label: 'Grok 4.6', efforts: ['low', 'high'] }],
  omp: [{ id: 'glm-5.3-flash', label: 'GLM-5.3-Flash', efforts: ['low', 'medium', 'high'] }],
  pi: [
    { id: 'glm-5.3-flash', label: 'GLM-5.3-Flash', efforts: ['low', 'medium', 'high'] },
    { id: 'glm-5.3', label: 'GLM-5.3', efforts: ['low', 'medium', 'high'] },
  ],
  hermes: [{ id: 'hermes-5', label: 'Hermes 5', efforts: ['default'] }],
  opencode: [{ id: 'glm-5.3-flash', label: 'GLM-5.3-Flash', efforts: ['default'] }],
  qoder: [{ id: 'qoder-auto', label: 'Auto', efforts: ['default'] }],
  qodercn: [{ id: 'qoder-auto', label: 'Auto', efforts: ['default'] }],
  harness: [],
}

export const DEFAULT_PREFS: Record<string, { model: string; effort: Effort }> = Object.fromEntries(
  CLI_IDS.map((cli) => [cli, { model: CATALOGS[cli][0]!.id, effort: CATALOGS[cli][0]!.efforts![0]! }]),
)

export const PRESETS: RolePreset[] = [
  { id: 'commercial', name: '商业审稿人', summary: '围绕章首承接、承诺兑现、节拍推进和章末吸引力，给出有证据的留存建议。', builtin: true,
    prompt: '你是小说商业审稿人，属于编辑岗。只报告商业证据、读者影响和建议，不修改正文、正典、章纲或审校队列。逻辑自洽与文风问题分别交给对应审校角色；这里只讨论其对目标读者继续阅读的直接影响。\n\n【入口与范围】\n读取目标章全文一次、作品定位，以及上一锁定章的接口或章末钩子。优先复用上游证据包；没有时按实际资料组织证据，不重复扫描整库。日常检查仅覆盖目标章和必要接口；按明确风险补查承诺、钩子或单元入口，只有跨章风险或作者明确要求全审时才扩大范围。审前最多询问四个真正缺口：章型、目标读者、关注信号、授权。\n\n【输出】\n按“证据—读者影响—建议”三栏给出不超过五条结论，每条注明原文位置。' },
  { id: 'logic', name: '逻辑审校员', summary: '核对人物认知、状态资源、因果动机与时空连续性，定位漏洞并提出最小修复。', builtin: true,
    prompt: '你是逻辑审校员。按人物认知、状态资源、因果动机、时空连续、规则体系和视角六类检查目标章，只报告有原文证据的问题，并给出改动最小的修复建议。' },
  { id: 'style', name: '文风审校员', summary: '结合小说语境和作品风格，检查模板腔、怪比喻、对白同质化与文风漂移。', builtin: true,
    prompt: '你是文风审校员。以作品既有风格和前章先例为准，标出模板腔、怪比喻、对白同质化与文风漂移；保留误报放行规则，不自动改稿。' },
  { id: 'revise', name: '正文修订师', summary: '按作者授权与审查问题清单微创改稿，保留快照、差异记录和定向回归。', builtin: true,
    prompt: '你是正文修订师。只执行作者授权的问题条目，每处修改保留修改前快照、差异清单和定向回归检查。' },
  { id: 'beats', name: '剧情节点设计师', summary: '先建立入口、选择与出口的状态契约，再设计有因果、有代价的剧情节点。', builtin: true,
    prompt: '你是剧情节点设计师。先给一页状态契约（入口状态、关键选择、出口状态），确认后再展开节点设计。' },
  { id: 'structure', name: '剧情结构规划师', summary: '将剧情单元拆成因果相连的节点链，先给紧凑总览，再展开当前关键节点。', builtin: true,
    prompt: '你是剧情结构规划师。先给单元契约和紧凑节点链，按因果与状态变化拆分，再展开当前关键节点。' },
  { id: 'writer', name: '小说主笔', summary: '依据已确认剧情和最小场景资料写作草稿，严格守住人物认知、状态与风格边界。', builtin: true,
    prompt: '你是小说主笔。依据已确认设计写草稿，不覆盖待审、锁定或已发布正文。' },
]

const CAPS = { send: true, queue: true, steer: true, stop: true, model: true, permission: true, plan: true,
  attachments: true, fork: true, forkEarlier: true, goal: true, feedback: true, skills: true, tools: true }

let serial = 0
export function makeWorker(cli: CliId, n: number, title: string, roleId: string | undefined, minutesAgo: number,
  status: Worker['status'] = 'completed'): Worker {
  const prefs = DEFAULT_PREFS[cli]!
  const role = PRESETS.find((p) => p.id === roleId)
  const id = `w${String(++serial).padStart(3, '0')}${cli.slice(0, 3)}${n}`
  const time = new Date(Date.now() - minutesAgo * 60_000).toISOString()
  return {
    id,
    parentSessionId: PARENT,
    project: 'novel-workspace',
    title,
    agentName: `${cli}-${n}`,
    agentNameOrigin: 'auto',
    preference: { cli, model: prefs.model, effort: prefs.effort },
    mode: 'accept-edits',
    level: 'auto',
    conversationId: `native-${id}`,
    status,
    createdAt: time,
    updatedAt: time,
    runId: `run-${id}-1`,
    ...(role ? { role: { presetId: role.id, name: role.name, summary: role.summary, prompt: role.prompt } } : {}),
    harnessConversation: {
      sessionId: `child-${id}`,
      parentSessionId: PARENT,
      mode: 'continuable',
      capabilities: CAPS,
      reasons: { steer: '通过当前 CLI 的原生引导通道发送，以原生接收回执为准' },
    },
  }
}

/** One native turn of a Worker's own conversation (what the DSH child session shows). */
export interface NativeTurn {
  id: string
  prompt: string
  promptTime: string
  reply: string
  seconds: number
  tokens: string
  state: 'queued' | 'running' | 'done'
}

export interface SeedWorker {
  worker: Worker
  turns: NativeTurn[]
}

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString()
const turn = (prompt: string, reply: string, seconds: number, tokens: string, minutesAgo: number): NativeTurn => ({
  id: `t${++serial}`, prompt, promptTime: at(minutesAgo), reply, seconds, tokens, state: 'done',
})

export function seed(): SeedWorker[] {
  serial = 0
  return [
    {
      worker: makeWorker('codex', 1, '第 3 章前后矛盾核查', 'logic', 96),
      turns: [
        turn('请读取 `chapters/03.md` 和人物状态表，按逻辑审校员的六类检查找出前后矛盾，只报告有原文证据的问题，不要改稿。',
          '已完成第 3 章逻辑核查，共发现 **2 处**需要处理的矛盾：\n\n| 位置 | 类型 | 问题 | 最小修复 |\n| --- | --- | --- | --- |\n| 第 12 段 | 状态资源 | 林舟在第 2 章已交出钥匙，此处又“摸了摸口袋里的钥匙” | 改为“摸了摸空了的口袋” |\n| 第 31 段 | 时空连续 | 前文写“黄昏出发”，到站时却是“正午” | 到站时间改为“入夜” |\n\n其余四类（认知、因果、规则、视角）未发现问题。',
          40, '64.2K tok', 95),
        turn('把第 12 段的修复建议展开成两种写法，保持原有语气。',
          '两种写法：\n\n1. 他下意识去摸口袋，指尖只碰到一层薄薄的布料——钥匙早在三天前就交出去了。\n2. 他摸了摸口袋，空的。他这才想起，钥匙已经不在自己身上。\n\n第 1 种保留了动作的迟滞感，更贴近本章的节奏。',
          21, '18.6K tok', 60),
      ],
    },
    {
      worker: makeWorker('codex', 2, '章末钩子留存评估', 'commercial', 92),
      turns: [turn('评估第 3 章章末钩子对目标读者的留存影响。', '章末钩子**有效**：悬念落在“信是谁写的”，与第 4 章开头直接衔接。建议把最后一句的解释性旁白删去，让悬念停在动作上。', 33, '41.0K tok', 91)],
    },
    {
      worker: makeWorker('codex', 3, '文风漂移抽查', 'style', 88),
      turns: [turn('抽查第 1–3 章的文风是否漂移。', '抽查 3 章共 18 段：第 3 章对白偏书面，有 3 处“然而”式转折与前两章口语化风格不一致，其余未见漂移。', 52, '57.9K tok', 87)],
    },
    {
      worker: makeWorker('codex', 4, '修订授权问题清单', 'revise', 70),
      turns: [turn('整理作者已授权修改的问题清单。', '已整理 5 条授权问题，均附原文位置与修改边界；未授权的 2 条保留在待定区，不进入修订。', 27, '22.4K tok', 69)],
    },
    {
      worker: makeWorker('codex', 5, '人物状态表整理', undefined, 64),
      turns: [turn('根据前 3 章整理主要人物状态表。', '已生成 6 名人物的状态表（位置、持有物、已知信息、关系变化），并标出 1 处与第 2 章不一致的持有物记录。', 46, '35.7K tok', 63)],
    },
    {
      worker: makeWorker('pi', 1, '剧情节点链草案', 'structure', 58),
      turns: [turn('为第 4–6 章给出紧凑的剧情节点链。', '节点链（7 个节点）：抵达 → 发现信件 → 误认寄信人 → 对峙 → 真相半揭 → 代价 → 新目标。每个节点均标注入口与出口状态。', 38, '29.1K tok', 57)],
    },
    {
      worker: makeWorker('pi', 2, '第 4 章节拍规划', 'beats', 50),
      turns: [turn('先给第 4 章的状态契约。', '第 4 章状态契约：入口——林舟手握信件、不信任同伴；关键选择——是否当面质问；出口——质问失败、关系降温，但获得寄信地址。', 29, '24.8K tok', 49)],
    },
  ]
}

export const LEGACY_TIMELINE = (worker: Worker): TimelineItem[] => [
  { id: `${worker.id}-h1`, kind: 'user', text: '（挂接原生对话前的一条旧记录）检查本章是否存在人物称呼不一致。', time: worker.createdAt },
  { id: `${worker.id}-h2`, kind: 'assistant', text: '称呼一致：全章均使用“林舟”，未发现混用。', time: worker.createdAt },
]

/** Example dispatches offered above the main composer. */
export interface Dispatch {
  cli: CliId
  label: string
  title: string
  role?: string
  prompt: string
  reply: string
}
export const DISPATCHES: Dispatch[] = [
  { cli: 'codex', label: '让 Codex 审阅第 3 章的前后矛盾', title: '审阅第 3 章的前后矛盾', role: 'logic',
    prompt: '审阅 `chapters/03.md` 的前后矛盾，只报告有原文证据的问题。',
    reply: '审阅完成：第 3 章发现 **1 处**时空矛盾——第 31 段“正午到站”与前文“黄昏出发”冲突，建议改为“入夜”。其余检查项未发现问题。' },
  { cli: 'pi', label: '让 Pi 规划第 5 章节拍', title: '规划第 5 章节拍', role: 'beats',
    prompt: '给出第 5 章的状态契约和 5 个以内的节拍。',
    reply: '第 5 章共 4 个节拍：对峙 → 真相半揭 → 付出代价 → 新目标。入口与出口状态已写入契约。' },
  { cli: 'claude', label: '让 Claude Code 写第 4 章草稿', title: '写第 4 章草稿', role: 'writer',
    prompt: '依据已确认的第 4 章节拍写一版草稿，不覆盖已锁定正文。',
    reply: '草稿已写入 `drafts/04.md`（约 3,200 字），未改动已锁定章节；请在主对话确认后再进入审校。' },
]
