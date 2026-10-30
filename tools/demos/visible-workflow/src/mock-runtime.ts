// Browser-side stand-in for the host WorkflowRuntime. It follows the host's
// run/record contract (status, executions, waiting fields, ports) closely
// enough for the real client UI, but executes only deterministic demo logic:
// no model, Agent, network or disk access. Tools act on the in-memory workspace.
import type { InputField, JsonValue, NodeExecution, Workflow, WorkflowNode, WorkflowRecoveryPlan, WorkflowRun } from '@vw-source/src/shared/types.ts'
import { renderDataTemplate } from '@vw-source/src/host/template.ts'
import { evaluateLogicGate } from '@vw-source/src/shared/logic-gates.ts'
import { createSystemVariables } from '@vw-source/src/shared/workflow-variables.ts'
import { vfs } from './vfs.ts'

type Data = Record<string, JsonValue>
interface Scope { values: Map<string, Data>; input: Data; environment: Data; system: Data; variables: Data }
const ACTIVE = ['running', 'waiting', 'paused', 'pausing', 'budget_waiting']
const now = () => new Date().toISOString()
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const stringify = (value: JsonValue | undefined): string => value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value)
const clone = <T,>(value: T): T => structuredClone(value)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
class HumanPause extends Error {}

function pathValue(value: JsonValue, path: string[]): JsonValue {
  for (const part of path) {
    if (['__proto__', 'prototype', 'constructor'].includes(part) || value === null || typeof value !== 'object' || !own(value, part)) throw new Error(`变量字段 ${path.join('.')} 不存在`)
    value = (value as Data)[part]!
  }
  return value
}
function reference(name: string, scope: Scope): JsonValue {
  const key = name.trim().replace(/^\{\{\s*|\s*\}\}$/g, ''), [head, ...rest] = key.split('.')
  if (head === 'input') return pathValue(scope.input, rest)
  if (head === 'env') return pathValue(scope.environment, rest)
  if (head === 'sys') return pathValue(scope.system, rest)
  if (head === 'vars') return pathValue(scope.variables, rest)
  const data = scope.values.get(head!)
  if (!data) throw new Error(`节点变量 ${key} 不存在或尚未产生结果（可能被条件跳过），请使用稳定节点 ID`)
  if (!rest.length) return data
  if (rest[0] === 'json' && !own(data, 'json')) return pathValue(data, rest.slice(1))
  return pathValue(data, rest)
}
function render(source: string, scope: Scope): string {
  const result = source.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, key: string) => stringify(reference(key, scope)))
  if (/\{\{|\}\}/.test(source.replace(/\{\{\s*[^{}]+?\s*\}\}/g, ''))) throw new Error('模板变量括号不完整')
  return result
}
function resolve(value: JsonValue, scope: Scope): JsonValue {
  if (typeof value === 'string') { const exact = value.match(/^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/); return exact ? clone(reference(exact[1]!, scope)) : render(value, scope) }
  if (Array.isArray(value)) return value.map(item => resolve(item, scope))
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, scope)]))
  return value
}
const mapping = (input: Data | undefined, scope: Scope): Data => Object.fromEntries(Object.entries(input ?? {}).map(([k, v]) => [k, resolve(v, scope)]))
function matches(condition: { variable: string; operator: string; value?: string }, scope: Scope): boolean {
  const left = reference(condition.variable, scope)
  let right: JsonValue = resolve(condition.value ?? '', scope)
  if (typeof left === 'number' && typeof right === 'string' && right.trim() !== '') right = Number(right)
  if (typeof left === 'boolean' && typeof right === 'string' && ['true', 'false'].includes(right)) right = right === 'true'
  const empty = left === null || left === '' || (Array.isArray(left) && left.length === 0)
  switch (condition.operator) {
    case 'empty': return empty
    case 'not_empty': return !empty
    case 'equals': return JSON.stringify(left) === JSON.stringify(right)
    case 'not_equals': return JSON.stringify(left) !== JSON.stringify(right)
    case 'contains': return Array.isArray(left) ? left.some(x => JSON.stringify(x) === JSON.stringify(right)) : typeof left === 'string' && left.includes(stringify(right))
    case 'not_contains': return !matches({ ...condition, operator: 'contains' }, scope)
    case 'starts_with': return typeof left === 'string' && left.startsWith(stringify(right))
    case 'ends_with': return typeof left === 'string' && left.endsWith(stringify(right))
    default:
      if (typeof left !== 'number' || typeof right !== 'number') throw new Error('数值比较要求左右两侧都是数字')
      return condition.operator === 'gt' ? left > right : condition.operator === 'gte' ? left >= right : condition.operator === 'lt' ? left < right : left <= right
  }
}
function typedInputs(fields: InputField[], raw: Record<string, string>): Data {
  const data: Data = {}
  for (const f of fields) {
    const value = raw[f.name] ?? f.defaultValue ?? ''
    if (value === '') { data[f.name] = ''; continue }
    switch (f.type ?? 'text') {
      case 'number': { const n = Number(value); if (!Number.isFinite(n)) throw new Error(`字段 ${f.label || f.name} 必须是数字`); data[f.name] = n; break }
      case 'boolean': if (value !== 'true' && value !== 'false') throw new Error(`字段 ${f.label || f.name} 必须是 true 或 false`); data[f.name] = value === 'true'; break
      case 'json': case 'file': case 'files': try { data[f.name] = JSON.parse(value) } catch { throw new Error(`字段 ${f.label || f.name} 不是有效 JSON`) } break
      default: data[f.name] = value
    }
  }
  return data
}
function sample(type: string, name: string): JsonValue {
  return type === 'number' ? 0 : type === 'boolean' ? false : type === 'array' ? [] : type === 'object' ? {} : `示例 ${name}`
}
const DEMO_MODEL_NOTE = '【演示输出】浏览器演示不连接模型或 Agent，这里给出固定示例文本，用于查看节点输入输出与后续连线的运行方式。'

/** Suggested values shown in the "补充运行所需信息" form; the visitor can change them. */
const INPUT_HINTS: Record<string, string> = { orderFilePath: 'data/orders.json', outputDir: 'reports', text: '今天完成了作品集的交互演示，明天整理说明文档。', approved: 'true' }

export class MockRuntime {
  private runs: WorkflowRun[] = []
  private driving = new Set<string>()
  constructor(private readonly onChange: () => void = () => {}) {}
  list(workflowId?: string): WorkflowRun[] { return clone(this.runs.filter(run => !workflowId || run.workflowId === workflowId)) }
  all(): WorkflowRun[] { return this.runs }
  get(id: string): WorkflowRun { const run = this.runs.find(item => item.id === id); if (!run) throw new Error('运行记录不存在'); return run }
  hasActive(workflowId: string): boolean { return this.runs.some(run => run.workflowId === workflowId && ACTIVE.includes(run.status)) }

  start(graph: Workflow, rawInputs: Record<string, string>, options: { sessionId?: string; sourceRunId?: string; startedAt?: string; instant?: boolean; reuse?: NodeExecution[] } = {}): WorkflowRun {
    if (!options.instant && this.hasActive(graph.id)) throw new Error('此工作流已有未结束的运行，请查看或取消后再启动')
    const id = crypto.randomUUID(), startedAt = options.startedAt ?? now(), fields = graph.nodes.find(n => n.kind === 'input')?.config.fields ?? []
    const inputs: Record<string, string> = {}
    for (const field of fields) inputs[field.name] = own(rawInputs, field.name) ? rawInputs[field.name]! : field.defaultValue ?? ''
    const environment: Data = Object.fromEntries((graph.environmentVariables ?? []).flatMap(v => v.type !== 'secret' && v.value !== undefined ? [[v.id, v.value as JsonValue]] : []))
    const run: WorkflowRun = {
      engine: { name: 'graphon', version: 'browser-demo', protocol: 1 }, id, workflowId: graph.id, workspaceId: graph.workspaceId, workflowTitle: graph.title,
      sourceRevision: graph.revision, graph: clone(graph), activeRevision: 1, status: 'waiting', inputs, outputs: {}, startedAt, rolePrompts: {}, environment,
      systemVariables: createSystemVariables({ workflowId: graph.id, runId: id, workspaceId: graph.workspaceId, startedAt, sessionId: options.sessionId }),
      ...(options.sourceRunId ? { sourceRunId: options.sourceRunId } : {}),
      executions: graph.nodes.map(node => ({ runRevision: 1, nodeId: node.id, executionId: node.id, number: node.number, title: node.title, status: 'pending' as const, model: node.config.model, effort: node.config.effort, rolePrompt: '' })),
      usage: { spentTokens: 0, reservedTokens: 0, unknownTokens: 0, unknownCalls: 0, agentTasks: 0, calls: 0, allocations: {} },
      compatibilityWarnings: [],
    }
    for (const prior of options.reuse ?? []) {
      const record = run.executions.find(item => item.nodeId === prior.nodeId)
      if (record && prior.status === 'success') Object.assign(record, clone(prior), { reusedFromRunId: options.sourceRunId, runRevision: 1 })
    }
    this.runs.unshift(run)
    this.checkInputs(run)
    if (!run.missingFields?.length) options.instant ? this.drainInstant(run) : void this.drive(run)
    this.onChange()
    return clone(run)
  }
  private checkInputs(run: WorkflowRun) {
    const fields = run.graph.nodes.find(n => n.kind === 'input')?.config.fields ?? []
    const missing = fields.filter(f => f.required && !run.inputs[f.name]?.trim())
    if (missing.length) { run.status = 'waiting'; run.missingFields = missing.map(f => ({ ...f, ...(INPUT_HINTS[f.name] && f.defaultValue === undefined ? { defaultValue: INPUT_HINTS[f.name] } : {}) })) }
    else { run.status = 'running'; delete run.missingFields }
  }
  answer(id: string, raw: Record<string, string>): WorkflowRun {
    const run = this.get(id)
    if (run.status !== 'waiting') throw new Error('本次运行已不再等待输入，请刷新运行状态')
    if (run.waitingNodeId) {
      const node = run.graph.nodes.find(n => n.id === run.waitingNodeId)!, fields = run.missingFields ?? node.config.fields ?? []
      const action = raw.__action ?? (node.config.actions?.length === 1 ? node.config.actions[0]!.id : undefined)
      const actions = node.config.actions ?? [{ id: 'continue', label: '继续' }]
      if (!action || !actions.some(a => a.id === action)) throw new Error('请选择有效的人工操作')
      const input = { ...raw }; delete input.__action
      const missing = fields.filter(f => f.required && !input[f.name]?.trim())
      if (missing.length) throw new Error(`请填写：${missing.map(f => f.label || f.name).join('、')}`)
      const record = run.executions.find(e => (e.executionId ?? e.nodeId) === run.waitingExecutionId)!
      record.data = { ...typedInputs(fields, input), __action_id: action, __action_value: actions.find(a => a.id === action)!.label, __rendered_content: run.humanPrompt ?? '' }
      record.data.text = JSON.stringify(record.data); record.output = stringify(record.data.text); record.selectedPort = action; record.status = 'success'; record.endedAt = now()
      this.clearWaiting(run); run.status = 'running'; void this.drive(run)
    } else {
      run.inputs = { ...run.inputs, ...raw }
      this.checkInputs(run)
      if (!run.missingFields?.length) void this.drive(run)
    }
    this.onChange()
    return clone(run)
  }
  private clearWaiting(run: WorkflowRun) { delete run.waitingNodeId; delete run.waitingExecutionId; delete run.humanActions; delete run.humanPrompt; delete run.missingFields; delete run.waitingSince }
  cancel(id: string): WorkflowRun {
    const run = this.get(id)
    if (!ACTIVE.includes(run.status)) return clone(run)
    for (const record of run.executions) if (['running', 'waiting'].includes(record.status)) { record.status = 'cancelled'; record.endedAt = now() }
    this.clearWaiting(run); run.status = 'cancelled'; run.endedAt = now(); run.error = '运行已取消'
    this.onChange(); return clone(run)
  }
  pause(id: string): WorkflowRun { const run = this.get(id); if (run.status === 'running') run.status = 'pausing'; this.onChange(); return clone(run) }
  resume(id: string): WorkflowRun { const run = this.get(id); if (['paused', 'pausing'].includes(run.status)) { run.status = 'running'; void this.drive(run) } this.onChange(); return clone(run) }
  recoveryPlan(id: string): WorkflowRecoveryPlan {
    const run = this.get(id), allowed = ['failed', 'cancelled', 'interrupted'].includes(run.status)
    return {
      sourceRunId: run.id, planDigest: `demo-${run.id}`, allowed, blockedReasons: allowed ? [] : ['只有失败、取消或中断的运行可以恢复'], invalidNodeIds: [],
      items: run.executions.map(record => ({ executionId: record.executionId ?? record.nodeId, nodeId: record.nodeId, title: record.title, action: record.status === 'success' ? 'reuse' as const : 'rerun' as const, reason: record.status === 'success' ? '已成功，复用历史结果' : '未完成，重新执行' })),
    }
  }
  recover(id: string, sessionId?: string): WorkflowRun {
    const source = this.get(id)
    if (!['failed', 'cancelled', 'interrupted'].includes(source.status)) throw new Error('只有失败、取消或中断的运行可以恢复')
    return this.start(source.graph, source.inputs, { sessionId, sourceRunId: source.id, reuse: source.executions })
  }
  rerun(id: string, sessionId?: string): WorkflowRun { const source = this.get(id); return this.start(source.graph, source.inputs, { sessionId, sourceRunId: source.id }) }

  // ---- execution ----------------------------------------------------------
  private scope(run: WorkflowRun): Scope {
    const values = new Map<string, Data>()
    for (const record of run.executions) if (record.status === 'success' && record.data) values.set(record.nodeId, record.data)
    const fields = run.graph.nodes.find(n => n.kind === 'input')?.config.fields ?? []
    return { values, input: typedInputs(fields, run.inputs), environment: (run.environment ?? {}) as Data, system: (run.systemVariables ?? {}) as Data, variables: {} }
  }
  /** Next node whose predecessors have all settled; nodes without an active incoming port are skipped. */
  private next(run: WorkflowRun): WorkflowNode | undefined {
    const graph = run.graph, byId = new Map(run.executions.map(record => [record.nodeId, record]))
    const settled = (id: string) => ['success', 'skipped', 'failed', 'cancelled'].includes(byId.get(id)?.status ?? '')
    const reachable = new Set<string>(graph.nodes.filter(n => n.kind === 'input').map(n => n.id))
    for (let changed = true; changed;) { changed = false; for (const edge of graph.edges) if (reachable.has(edge.source) && !reachable.has(edge.target)) { reachable.add(edge.target); changed = true } }
    for (let changed = true; changed;) {
      changed = false
      for (const node of graph.nodes) {
        const record = byId.get(node.id)!
        if (record.status !== 'pending') continue
        if (!reachable.has(node.id)) { record.status = 'skipped'; changed = true; continue }
        const incoming = graph.edges.filter(edge => edge.target === node.id)
        if (node.kind === 'input' && !incoming.length) return node
        if (!incoming.every(edge => settled(edge.source))) continue
        const active = incoming.some(edge => {
          const source = byId.get(edge.source)!
          if (source.status !== 'success') return false
          if (!source.selectedPort) return true
          const ports = [source.selectedPort, ...(graph.nodes.find(n => n.id === edge.source)?.kind === 'human' && source.selectedPort !== 'timeout' ? ['default'] : [])]
          return ports.includes(edge.port ?? 'default') || (edge.port === undefined && ports.includes(source.selectedPort))
        })
        if (active) return node
        record.status = 'skipped'; changed = true
      }
    }
    return undefined
  }
  private finish(run: WorkflowRun) {
    if (run.executions.some(record => record.status === 'failed')) { run.status = 'failed'; run.error = run.executions.find(record => record.status === 'failed')?.error }
    else run.status = 'success'
    for (const record of run.executions) if (record.status === 'pending') record.status = 'skipped'
    run.endedAt = now()
  }
  /** Executes one node synchronously; returns false when the run stops or waits. */
  private step(run: WorkflowRun, node: WorkflowNode): boolean {
    const record = run.executions.find(item => item.nodeId === node.id)!
    record.startedAt ??= now(); record.status = 'running'
    try {
      const data = this.execute(node, record, run, this.scope(run))
      record.data = data; record.output = record.output ?? stringify((data.text as JsonValue) ?? data); record.status = 'success'; record.endedAt = now()
      if (node.kind === 'output') run.outputs[node.config.outputName || 'result'] = stringify(data.text)
      return true
    } catch (error) {
      if (error instanceof HumanPause) return false
      record.status = 'failed'; record.error = error instanceof Error ? error.message : String(error); record.endedAt = now()
      this.finish(run); return false
    }
  }
  /** Historical seed runs: execute immediately, then lay timestamps out as a short real run. */
  private drainInstant(run: WorkflowRun) {
    for (let node = this.next(run); node && run.status === 'running'; node = this.next(run)) if (!this.step(run, node)) break
    if (run.status === 'running') this.finish(run)
    let at = Date.parse(run.startedAt) + 40
    for (const record of run.executions) {
      if (!record.startedAt) continue
      const span = 120 + Math.round(Math.random() * 260)
      record.startedAt = new Date(at).toISOString(); at += span; record.endedAt = new Date(at).toISOString(); at += 15
    }
    if (run.endedAt) run.endedAt = new Date(at + 30).toISOString()
  }
  private async drive(run: WorkflowRun) {
    if (this.driving.has(run.id)) return
    this.driving.add(run.id)
    try {
      while (run.status === 'running') {
        const node = this.next(run)
        if (!node) { this.finish(run); break }
        const record = run.executions.find(item => item.nodeId === node.id)!
        record.status = 'running'; record.startedAt = now(); this.onChange()
        await sleep(node.kind === 'input' || node.kind === 'output' ? 380 : node.kind === 'tool' || node.kind === 'code' ? 700 + Math.random() * 400 : 520 + Math.random() * 300)
        if (run.status === 'cancelled') break
        const proceed = this.step(run, node)
        if (run.status === 'pausing') { run.status = 'paused'; break }
        this.onChange()
        if (!proceed) break
      }
    } finally { this.driving.delete(run.id); this.onChange() }
  }
  private execute(node: WorkflowNode, record: NodeExecution, run: WorkflowRun, scope: Scope): Data {
    const c = node.config
    switch (node.kind) {
      case 'input': {
        const data = typedInputs(c.fields ?? [], run.inputs)
        record.input = JSON.stringify(run.inputs); record.output = JSON.stringify(data); return data
      }
      case 'template': case 'output': {
        const inputs = mapping(c.inputs, scope), local = { ...scope, input: { ...scope.input, ...inputs } }
        const text = node.kind === 'template'
          ? renderDataTemplate(c.text ?? '', name => { const [key, ...path] = name.split('.'); return own(inputs, key!) ? pathValue(inputs[key!]!, path) : reference(name, local) })
          : render(c.text ?? '', local)
        record.input = text; record.output = text; return { text }
      }
      case 'code': {
        const inputs = mapping(c.inputs, scope)
        record.input = JSON.stringify(inputs, null, 2)
        let result: JsonValue
        if ((c.language ?? 'javascript') === 'javascript') {
          // Visitor-editable demo code runs in the visitor's own page, like a console.
          const fn = new Function('inputs', `"use strict";\n${c.code ?? ''}\n;return typeof main === 'function' ? main(inputs) : undefined`)
          result = JSON.parse(JSON.stringify(fn(clone(inputs)) ?? null))
        } else result = Object.fromEntries((c.outputSchema ?? []).map(field => [field.name, sample(field.type, field.name)]))
        if (result === null || typeof result !== 'object' || Array.isArray(result)) throw new Error('代码必须返回对象，例如 return { result: ... }')
        for (const field of c.outputSchema ?? []) if (field.required !== false && !own(result, field.name)) throw new Error(`代码输出缺少必填字段 ${field.name}`)
        record.output = JSON.stringify(result, null, 2)
        return result as Data
      }
      case 'tool': return this.tool(c.toolId ?? '', mapping(c.inputs, scope), record)
      case 'if': {
        if (c.logicGate) {
          const gate = evaluateLogicGate(c.logicGate, value => resolve(value, scope)), port = gate.result ? 'true' : 'false'
          record.input = JSON.stringify({ operator: c.logicGate.operator, inputs: gate.inputs, operands: gate.operands }); record.selectedPort = port
          return { text: port, result: gate.result, branch: port, inputs: gate.inputs, operands: gate.operands }
        }
        let port = 'false'
        if (c.cases?.length) { for (const branch of c.cases) if (branch.logic === 'or' ? branch.conditions.some(v => matches(v, scope)) : branch.conditions.every(v => matches(v, scope))) { port = branch.id; break } }
        else port = matches({ variable: c.variable!, operator: c.operator ?? 'not_empty', value: c.value }, scope) ? 'true' : 'false'
        record.input = JSON.stringify(c.cases ?? { variable: c.variable, operator: c.operator, value: c.value }); record.selectedPort = port
        return { text: port, result: port === 'true', branch: port }
      }
      case 'human': {
        record.status = 'waiting'; run.status = 'waiting'; run.waitingNodeId = node.id; run.waitingExecutionId = record.executionId ?? record.nodeId
        run.humanPrompt = render(c.prompt ?? '', scope); run.humanActions = c.actions?.length ? c.actions : [{ id: 'continue', label: '继续' }]
        run.missingFields = (c.fields ?? []).map(field => ({ ...field, ...(field.defaultValue !== undefined ? { defaultValue: render(field.defaultValue, scope) } : {}) }))
        run.waitingSince = now(); record.input = run.humanPrompt
        throw new HumanPause()
      }
      case 'llm': case 'agent': case 'extractor': case 'classifier': {
        const prompt = render(c.prompt ?? c.query ?? '', { ...scope, input: { ...scope.input, ...mapping(c.inputs, scope) } })
        record.input = prompt
        run.usage!.calls += 1; run.usage!.unknownCalls += 1; if (node.kind === 'agent') run.usage!.agentTasks += 1
        if (node.kind === 'classifier') { const chosen = c.classes?.[0]; record.selectedPort = chosen?.id; return { text: chosen?.label ?? '', class_name: chosen?.label ?? '', class_id: chosen?.id ?? '' } }
        if (node.kind === 'extractor') { const values = Object.fromEntries((c.parameters ?? []).map(field => [field.name, sample(field.type, field.name)])); return { ...values, text: JSON.stringify(values) } }
        const schema = Object.fromEntries((c.outputSchema ?? []).map(field => [field.name, field.type === 'string' ? DEMO_MODEL_NOTE : sample(field.type, field.name)]))
        return { text: DEMO_MODEL_NOTE, ...schema }
      }
      case 'http': {
        const url = render(c.url ?? '', scope); record.input = JSON.stringify({ method: c.method ?? 'GET', url }, null, 2)
        const body = `演示环境不发起网络请求：${c.method ?? 'GET'} ${url}`
        return { status_code: 200, headers: {}, body, text: body }
      }
      case 'knowledge': return { result: [], text: '演示环境未连接知识库，检索结果为空。' }
      case 'document': { const source = render(c.source ?? '', scope); let text = ''; try { text = vfs.read(source) } catch { text = '演示环境未找到该文档，返回空文本。' } return { text } }
      case 'list': {
        let value: JsonValue = reference(c.listSource ?? '', scope)
        if (typeof value === 'string') value = JSON.parse(value)
        if (!Array.isArray(value)) throw new Error('列表来源必须为数组')
        let result = value
        if (c.sort) result = [...result].sort((a, b) => (a! < b! ? -1 : a! > b! ? 1 : 0) * (c.sort === 'desc' ? -1 : 1))
        if (c.limit !== undefined) result = result.slice(0, c.limit)
        return { text: JSON.stringify(result), result, first_record: result[0] ?? null, last_record: result.at(-1) ?? null, json: result }
      }
      case 'aggregator': {
        for (const group of c.groups ?? []) for (const variable of group.variables) { try { const value = reference(variable, scope); if (value !== null && value !== '') return { output: value, text: stringify(value) } } catch { /* skipped branch */ } }
        return { output: null, text: '' }
      }
      case 'assigner': return { text: '演示环境已记录变量赋值', assignments: (c.assignments ?? []).map(item => item.name) }
      default: return { text: '演示环境未执行此容器节点的内部流程', output: [] }
    }
  }
  private tool(id: string, inputs: Data, record: NodeExecution): Data {
    record.input = JSON.stringify(inputs, null, 2)
    const text = (key: string) => typeof inputs[key] === 'string' ? inputs[key] as string : stringify(inputs[key])
    switch (id) {
      case 'native:read': {
        const path = text('file_path'), content = vfs.read(path), lines = content.replace(/\n$/, '').split('\n')
        const value = { path, offset: 1, totalLines: lines.length, lines: lines.map((line, index) => ({ number: index + 1, text: line })) }
        record.output = content
        return { value, text: content }
      }
      case 'native:write': {
        const path = vfs.write(text('file_path'), text('content'))
        const value = { path, bytes: new TextEncoder().encode(text('content')).length }
        return { value, text: `已写入 ${path}（${value.bytes} 字节）` }
      }
      case 'native:glob': { const files = vfs.list(); return { value: files, text: files.join('\n') } }
      case 'builtin:time.now': { const zone = text('timezone') || 'Asia/Shanghai', date = new Date(); const local = date.toLocaleString('zh-CN', { timeZone: zone, hour12: false }); return { iso: date.toISOString(), timezone: zone, local, text: local } }
      case 'builtin:time.timestamp': { const ms = Date.now(); return { seconds: Math.floor(ms / 1000), milliseconds: ms, text: String(Math.floor(ms / 1000)) } }
      case 'builtin:json.parse': { const value = JSON.parse(text('text')); return { value, text: JSON.stringify(value) } }
      case 'builtin:json.stringify': { const value = inputs.pretty ? JSON.stringify(inputs.value, null, 2) : JSON.stringify(inputs.value); return { text: value } }
      case 'builtin:json.select': { const value = pathValue(inputs.value!, text('path').split('.').filter(Boolean)); return { value, text: stringify(value) } }
      case 'builtin:file.stat': { const content = vfs.read(text('path')); return { bytes: new TextEncoder().encode(content).length, lines: content.split('\n').length, text: `${content.length} 字符` } }
      default: return { value: null, text: `演示环境未连接工具 ${id}，返回示例结果。` }
    }
  }
}
