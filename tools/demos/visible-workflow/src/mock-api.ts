// In-browser replacement for the `/__workflow` methods of scripts/preview-server.ts.
// State lives in memory and, when the browser allows it, in localStorage.
import type { ModelChoice, RolePreset, ToolChoice, Workflow, WorkflowAPI, WorkflowDraft, WorkflowTemplate } from '@vw-source/src/shared/types.ts'
import { newId } from '@vw-source/src/shared/types.ts'
import { allNodes, assertGraph, graphIssues, parseWorkflow, presetSchema } from '@vw-source/src/shared/workflow-validation.ts'
import { renumberWorkflow } from '@vw-source/src/shared/numbering.ts'
import { workflowDefinitionContent } from '@vw-source/src/shared/workflow-content.ts'
import { exportWorkflowJson, importWorkflowJson, parseWorkflowPackage } from '@vw-source/src/shared/workflow-format.ts'
import { createWorkflowThumbnail } from '@vw-source/src/shared/workflow-thumbnail.ts'
import { selectWorkflowTemplateNodes } from '@vw-source/src/shared/workflow-template-selection.ts'
import { parseWorkflowImportOptions, type WorkflowReadiness, type WorkflowReadinessIssue } from '@vw-source/src/shared/workflow-import.ts'
import { unavailableSecretBoundaryReport } from '@vw-source/src/shared/secret-boundary.ts'
import { DEFAULT_HTTP_CACHE_SETTINGS, httpCacheSettingsSchema, type HttpCacheSettings } from '@vw-source/src/shared/http-cache-settings.ts'
import { BUILTIN_TOOLS } from '@vw-source/src/shared/builtin-tools.ts'
import { workflowVisibleInWorkspace } from '@vw-source/src/shared/workflow-scope.ts'
import { prepareWorkflowImport } from '@vw-source/src/host/workflow-import.ts'
import { MockRuntime } from './mock-runtime.ts'
import { WORKSPACE_ROOT } from './vfs.ts'
import { WORKSPACES, booleanBranch, seedPresets, seedWorkflows, textTemplate, FLOW_IDS } from './seed.ts'

const STORAGE_KEY = 'visible-workflow-demo:v2'
export const DEMO_NOTICE = '演示环境不连接 DeepSeekHarness 与 Agent：此操作只在真实插件中可用，演示页面不会发送任何内容。'
const unsupported = (what: string) => async () => { throw new Error(`演示环境暂不支持${what}。${DEMO_NOTICE}`) }
const clone = <T,>(value: T): T => structuredClone(value)
const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required }) as ToolChoice['inputSchema']
const NATIVE_TOOLS: ToolChoice[] = [
  { id: 'native:read', name: 'read', description: '读取工作区内的文本文件，返回逐行内容。', providerId: 'native:harness', providerName: 'Harness 已注册工具', category: 'plugin', available: true, inputSchema: objectSchema({ file_path: { type: 'string', description: '工作区相对路径' }, offset: { type: 'number' }, limit: { type: 'number' } }, ['file_path']) },
  { id: 'native:write', name: 'write', description: '把文本写入工作区内的文件（演示环境写入内存）。', providerId: 'native:harness', providerName: 'Harness 已注册工具', category: 'plugin', available: true, inputSchema: objectSchema({ file_path: { type: 'string', description: '工作区相对路径' }, content: { type: 'string', description: '完整文件内容' } }, ['file_path', 'content']) },
  { id: 'native:glob', name: 'glob', description: '按模式列出工作区文件。', providerId: 'native:harness', providerName: 'Harness 已注册工具', category: 'plugin', available: true, inputSchema: objectSchema({ pattern: { type: 'string' } }, ['pattern']) },
]
const MODELS: ModelChoice[] = [{ provider: 'demo', model: 'demo-model', label: '演示模型（不连接服务）', efforts: [{ id: 'standard', label: '标准' }, { id: 'deep', label: '深入' }] }]

interface TemplateRecord { metadata: WorkflowTemplate; packageJson: string; archived?: boolean }
interface Persisted { workflows: Workflow[]; presets: RolePreset[]; templates: TemplateRecord[]; cache: HttpCacheSettings }
function load(): Persisted | undefined {
  try {
    if (location.hash.includes('reset')) { localStorage.removeItem(STORAGE_KEY); return undefined }
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return undefined
    const value = JSON.parse(raw) as Persisted
    return Array.isArray(value.workflows) && value.workflows.length ? value : undefined
  } catch { return undefined }
}
function builtinTemplates(): TemplateRecord[] {
  return [textTemplate('template'), booleanBranch('template')].map((flow, index) => ({ metadata: { id: index ? 'builtin-boolean-branch' : 'builtin-text', scope: 'builtin', title: flow.title, description: flow.description, revision: 1, createdAt: '2026-10-16T00:00:00.000Z', updatedAt: '2026-10-16T00:00:00.000Z' }, packageJson: exportWorkflowJson(flow) }))
}

export function createMockApi() {
  const saved = load()
  let workflows: Workflow[] = saved?.workflows ?? seedWorkflows()
  let presets: RolePreset[] = saved?.presets ?? seedPresets()
  let personal: TemplateRecord[] = saved?.templates ?? []
  let cache: HttpCacheSettings = saved?.cache ?? { ...DEFAULT_HTTP_CACHE_SETTINGS }
  const builtin = builtinTemplates(), drafts = new Map<string, WorkflowDraft>(), runtime = new MockRuntime()
  const persist = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ workflows, presets, templates: personal, cache })) } catch { /* storage unavailable: keep in memory */ } }

  // A completed historical run so the run list and node I/O are populated on first view.
  const text = workflows.find(flow => flow.id === FLOW_IDS.text)
  if (text) {
    const snapshot = clone(text); snapshot.nodes = snapshot.nodes.filter(node => node.number !== 'u-1')
    runtime.start(snapshot, { text: '今天完成了作品集的交互演示，明天整理说明文档。' }, { instant: true, startedAt: new Date(Date.now() - 2 * 3600_000).toISOString() })
  }

  const get = (id: string) => { const flow = workflows.find(item => item.id === id && !item.archived); if (!flow) throw new Error('工作流不存在或已归档'); return flow }
  const tools = (workspaceId = ''): ToolChoice[] => [...BUILTIN_TOOLS, ...NATIVE_TOOLS, ...workflows.filter(flow => !flow.archived && (!workspaceId || workflowVisibleInWorkspace(flow, workspaceId))).map(flow => {
    const fields = flow.nodes.find(n => n.kind === 'input')?.config.fields ?? [], human = allNodes(flow).some(n => n.kind === 'human')
    return { id: `workflow:${flow.id}`, name: flow.title, description: flow.description || '在当前工作区执行此流程定义。', providerId: 'workflows', providerName: '工作流', category: 'workflow' as const, available: !human, ...(human ? { unavailableReason: '包含人工介入，请从画布独立运行' } : {}), inputSchema: objectSchema(Object.fromEntries(fields.map(f => [f.name, { type: f.type === 'number' ? 'number' : f.type === 'boolean' ? 'boolean' : 'string', description: f.label }])), fields.filter(f => f.required && f.defaultValue === undefined).map(f => f.name)) }
  })]
  const save = (value: unknown, expected: number): Workflow => {
    const flow = parseWorkflow(value); assertGraph(flow)
    if (flow.archived) throw new Error('请使用归档操作，不得通过普通保存更改归档状态')
    const prior = workflows.find(item => item.id === flow.id)
    if ((prior?.revision ?? 0) !== expected || (!prior && expected !== 0)) throw new Error('工作流已被修改，请刷新后再保存，避免覆盖其他修改')
    if (prior?.archived) throw new Error('工作流已归档，请先恢复')
    const normalized = renumberWorkflow(flow)
    const viewOnly = prior && workflowDefinitionContent(prior) === workflowDefinitionContent(normalized), stamp = new Date().toISOString()
    const next: Workflow = { ...normalized, revision: viewOnly ? prior.revision : expected + 1, createdAt: prior?.createdAt ?? stamp, updatedAt: viewOnly ? prior.updatedAt : stamp }
    workflows = [...workflows.filter(item => item.id !== next.id), next]; persist(); return clone(next)
  }
  const importBundle = (value: unknown, roles: unknown[], overwrite?: { workflowId: string; expectedRevision: number }): Workflow => {
    const flow = parseWorkflow(value); flow.scope = 'workspace'; assertGraph(flow)
    const prior = overwrite ? workflows.find(item => item.id === overwrite.workflowId) : undefined
    if (overwrite && (!prior || prior.revision !== overwrite.expectedRevision)) throw new Error('工作流已被修改，请刷新版本后重新检查导入，导入草稿不会被覆盖')
    presets = [...presets, ...roles.map(role => presetSchema.parse(role)).map(role => ({ ...role, revision: 1 }))]
    const stamp = new Date().toISOString(), next: Workflow = { ...renumberWorkflow(flow), id: prior?.id ?? flow.id, revision: (prior?.revision ?? 0) + 1, createdAt: prior?.createdAt ?? stamp, updatedAt: stamp }
    workflows = [...workflows.filter(item => item.id !== next.id), next]; persist(); return clone(next)
  }
  const catalog = (workspaceId: string) => ({ models: MODELS, tools: tools(workspaceId), workflows: workflows.filter(flow => !flow.archived), presets })
  const templateMeta = (record: TemplateRecord): WorkflowTemplate => ({ ...clone(record.metadata), thumbnail: createWorkflowThumbnail(parseWorkflowPackage(record.packageJson, { historical: true }).workflow) })
  const template = (id: string) => { const record = [...builtin, ...personal].find(item => item.metadata.id === id && !item.archived); if (!record) throw new Error('模板不存在或已归档'); return record }
  const editableTemplate = (id: string, revision: number) => {
    if (builtin.some(item => item.metadata.id === id)) throw new Error('内置模板只读，请创建工作区副本或保存为个人模板')
    const record = personal.find(item => item.metadata.id === id && !item.archived)
    if (!record) throw new Error('个人模板不存在'); if (record.metadata.revision !== revision) throw new Error('模板已被修改，请刷新后重试')
    return record
  }
  const readiness = (flow: Workflow): WorkflowReadiness => {
    const issues: WorkflowReadinessIssue[] = [], seen = new Set<string>()
    const add = (nodeId: string | undefined, kind: WorkflowReadinessIssue['kind'], message: string, extra: Partial<WorkflowReadinessIssue> = {}) => {
      const id = JSON.stringify([flow.id, nodeId, kind, extra.dependencyId ?? extra.field ?? '', message]); if (seen.has(id)) return; seen.add(id)
      issues.push({ id, ...(nodeId ? { nodeId } : {}), workflowId: flow.id, kind, message, action: kind === 'environment' || kind === 'secret' ? 'environment' : kind === 'configuration' ? 'node' : 'dependency', ...extra })
    }
    for (const issue of graphIssues(flow, true, true).filter(issue => !issue.message.startsWith('必需环境变量 ') && !['请选择此节点的模型', '请配置 DSH 默认模型或选择文档解析模型'].includes(issue.message))) add(issue.nodeId, 'configuration', issue.message)
    for (const variable of flow.environmentVariables ?? []) {
      if (variable.type === 'secret') { if (variable.required) add(undefined, 'secret', `Secret「${variable.name}」尚未配置，请打开受保护凭据管理窗口`, { dependencyId: variable.id, field: 'environmentVariables' }) }
      else if (variable.required && variable.value === undefined) add(undefined, 'environment', `环境变量「${variable.name}」缺少值，请填写`, { dependencyId: variable.id, field: 'environmentVariables' })
    }
    const available = tools(flow.workspaceId)
    for (const node of allNodes(flow)) for (const id of new Set([node.config.toolId, ...(node.config.tools ?? [])].filter((id): id is string => !!id))) {
      const tool = available.find(item => item.id === id && item.available)
      if (!tool) { add(node.id, 'tool', `工具 ${id} 在当前工作区不可用${id.startsWith('native:') ? '或缺少对话权限' : ''}，请连接、授权或重新选择`, { dependencyId: id, field: node.config.toolId === id ? 'toolId' : 'tools' }); continue }
      if (node.config.toolId === id) for (const field of Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []) if (typeof field === 'string' && !Object.hasOwn(node.config.inputs ?? {}, field)) add(node.id, 'configuration', `工具参数「${field}」为必填项`, { dependencyId: id, field: `inputs.${field}` })
    }
    return { workflowId: flow.id, revision: flow.revision, canRun: issues.length === 0, issues }
  }

  const methods: WorkflowAPI = {
    secretBoundary: async () => unavailableSecretBoundaryReport({ credentials: 'missing', sandbox: 'missing', toolGuard: 'missing', broker: 'missing' }),
    inspectReadiness: async flow => readiness(parseWorkflow(flow)),
    list: async (workspaceId: string) => ({ workflows: clone(workflows.filter(flow => !flow.archived && (!workspaceId || workflowVisibleInWorkspace(flow, workspaceId)))), presets: clone(presets), runs: runtime.list().filter(run => !workspaceId || run.workspaceId === workspaceId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), workspaces: clone(WORKSPACES) }),
    get: async id => clone(get(id)),
    save: async (json, revision) => save(JSON.parse(json), revision),
    remove: async (id, revision) => {
      const flow = get(id); if (flow.revision !== revision) throw new Error('工作流版本已变化，请刷新后再删除')
      if (runtime.hasActive(id)) throw new Error('请先取消此工作流的当前运行')
      workflows = workflows.map(item => item.id === id ? { ...item, archived: true, revision: item.revision + 1, updatedAt: new Date().toISOString() } : item); persist()
    },
    archived: async workspaceId => clone(workflows.filter(flow => flow.archived && (!workspaceId || flow.workspaceId === workspaceId))),
    restore: async id => { const prior = workflows.find(flow => flow.id === id && flow.archived); if (!prior) throw new Error('归档工作流不存在'); const next = { ...prior, archived: false, revision: prior.revision + 1, updatedAt: new Date().toISOString() }; workflows = workflows.map(flow => flow.id === id ? next : flow); persist(); return clone(next) },
    httpCacheSettings: async () => clone(cache),
    saveHttpCacheSettings: async json => { cache = httpCacheSettingsSchema.parse(JSON.parse(json)); persist(); return clone(cache) },
    presets: async () => clone(presets),
    savePreset: async json => {
      const preset = presetSchema.parse(JSON.parse(json)), prior = presets.find(item => item.id === preset.id)
      if ((prior?.revision ?? 0) !== preset.revision) throw new Error('预设已被修改，请刷新后再保存')
      presets = [...presets.filter(item => item.id !== preset.id), { ...preset, revision: preset.revision + 1 }]; persist(); return clone(presets)
    },
    deletePreset: async id => { if (workflows.some(flow => allNodes(flow).some(node => node.config.rolePresetId === id))) throw new Error('此预设仍被工作流使用，请先在节点配置中取消选择'); presets = presets.filter(item => item.id !== id); persist(); return clone(presets) },
    models: async () => clone(MODELS),
    tools: async workspaceId => clone(tools(workspaceId)),
    importSwagger: unsupported('导入 Swagger 工具'),
    start: async (id, inputs, sessionId) => {
      const report = readiness(get(id)); if (!report.canRun) throw new Error(`工作流还有 ${report.issues.length} 项待处理配置，不能运行`)
      return runtime.start(get(id), JSON.parse(inputs), { sessionId })
    },
    answer: async (id, inputs) => runtime.answer(id, JSON.parse(inputs)),
    run: async id => clone(runtime.get(id)),
    cancel: async id => runtime.cancel(id),
    pause: async id => runtime.pause(id),
    resume: async id => runtime.resume(id),
    recoveryPlan: async id => runtime.recoveryPlan(id),
    recover: async (id, sessionId) => runtime.recover(id, sessionId),
    rerun: async (id, sessionId) => runtime.rerun(id, sessionId),
    stopNode: unsupported('单独停止子 Agent'),
    agentProcess: async () => ({ status: 'unavailable', canSteer: false, unavailableReason: DEMO_NOTICE, events: [], messages: [] }),
    followupAgent: unsupported('补充 Agent 指令'),
    confirmRepairOutput: unsupported('确认模型修复'),
    acceptRepairOutput: unsupported('人工修正 Agent 输出'),
    previewRunRevision: unsupported('运行中修订'),
    applyRunRevision: unsupported('运行中修订'),
    proposals: async () => [],
    propose: unsupported('提交修改提案'),
    resolveProposal: unsupported('处理修改提案'),
    drafts: async (workflowId, sessionId) => clone([...drafts.values()].filter(draft => draft.workflowId === workflowId && (draft.sessionId ?? '') === (sessionId ?? ''))),
    saveDraft: async (json, revision) => {
      const draft = JSON.parse(json) as WorkflowDraft, id = draft.id || newId(), prior = drafts.get(id)
      if ((prior?.revision ?? 0) !== revision) throw new Error('草稿已在别处更新，请刷新后重试')
      const next = { ...draft, id, revision: revision + 1, updatedAt: new Date().toISOString() }; drafts.set(id, next); return clone(next)
    },
    removeDraft: async id => { drafts.delete(id) },
    previewImport: async (json, workspaceId, options = {}) => (await prepareWorkflowImport(json, workspaceId, parseWorkflowImportOptions(options), catalog(workspaceId), WORKSPACE_ROOT)).preview,
    importPackage: async (json, workspaceId, options = {}) => {
      const parsed = parseWorkflowImportOptions(options), value = await prepareWorkflowImport(json, workspaceId, parsed, catalog(workspaceId), WORKSPACE_ROOT)
      if (!value.preview.canImport || !value.workflow || !value.presets) throw new Error('依赖尚未完成映射，请在宿主中检查导入')
      return importBundle(value.workflow, value.presets, parsed.overwrite)
    },
    exportArchive: unsupported('导出压缩包，请改用 JSON 导出'),
    previewArchive: unsupported('导入压缩包，请改用 JSON 导入'),
    importArchive: unsupported('导入压缩包，请改用 JSON 导入'),
    openSecretManager: unsupported('受保护凭据管理'),
    templates: async () => [...builtin, ...personal.filter(item => !item.archived)].map(templateMeta),
    archivedTemplates: async () => personal.filter(item => item.archived).map(templateMeta),
    saveTemplate: async (id, title, selection) => {
      const source = get(id), flow = selection === undefined ? clone(source) : selectWorkflowTemplateNodes(source, selection)
      assertGraph(flow); flow.title = title.trim() || flow.title
      const stamp = new Date().toISOString(), record: TemplateRecord = { metadata: { id: `personal-${newId()}`, scope: 'personal', title: flow.title, description: flow.description, revision: 1, createdAt: stamp, updatedAt: stamp }, packageJson: exportWorkflowJson(flow, { presets }) }
      personal = [...personal, record]; persist(); return templateMeta(record)
    },
    renameTemplate: async (id, title, revision) => { const record = editableTemplate(id, revision); record.metadata = { ...record.metadata, title: title.trim(), revision: revision + 1, updatedAt: new Date().toISOString() }; persist(); return templateMeta(record) },
    removeTemplate: async (id, revision) => { const record = editableTemplate(id, revision); record.archived = true; record.metadata = { ...record.metadata, revision: revision + 1 }; persist() },
    restoreTemplate: async (id, revision) => { const record = personal.find(item => item.metadata.id === id && item.archived); if (!record || record.metadata.revision !== revision) throw new Error('模板不存在或已被修改'); record.archived = false; record.metadata = { ...record.metadata, revision: revision + 1 }; persist(); return templateMeta(record) },
    useTemplate: async (id, workspaceId) => { const imported = importWorkflowJson(template(id).packageJson, workspaceId); return importBundle(imported.workflow, imported.presets) },
  }
  // Same shape as the preview's Proxy: any method the demo host does not provide rejects with a notice.
  const api = new Proxy(methods, { get: (target, key) => typeof key === 'string' && key !== 'then' && !(key in target) ? unsupported(`「${key}」`) : Reflect.get(target, key) })
  return { api, runtime }
}
