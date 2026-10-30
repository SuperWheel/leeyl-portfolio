// Demo library: three runnable example workflows plus the plugin's built-in templates.
import { makeWorkflow, newId, type RolePreset, type Workflow, type WorkspaceChoice } from '@vw-source/src/shared/types.ts'
import { renumberWorkflow } from '@vw-source/src/shared/numbering.ts'
import r7 from './seed/r7-order-summary.json'

export const WORKSPACE_ID = 'demo-workspace'
export const WORKSPACES: WorkspaceChoice[] = [{ id: WORKSPACE_ID, name: '示例工作区' }]
export const FLOW_IDS = { r7: 'r7-order-summary', text: 'desktop-text-processing', branch: 'boolean-branch-demo' } as const

function textProcessing(): Workflow {
  const input = 'b1f0c3a2-5d7e-4c11-9a8b-1e2f3a4b5c61', template = '8463b139-2f5a-4e0b-8d6c-7a9b0c1d2e3f', output = 'c9d8e7f6-a5b4-4c3d-8e2f-1a0b9c8d7e6f', clock = 'd4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70'
  return {
    id: FLOW_IDS.text, workspaceId: WORKSPACE_ID, title: '桌面验收 · 文本处理', description: '输入一段文字，按模板生成结果；无需模型即可运行。', revision: 27,
    createdAt: '2026-10-17T01:41:00.000Z', updatedAt: '2026-10-17T09:41:00.000Z',
    nodes: [
      { id: input, number: 'a-1', kind: 'input', title: '接收文本', x: 90, y: 180, fixed: false, config: { fields: [{ name: 'text', label: '输入文本', required: true }] } },
      { id: template, number: 'a-2', kind: 'template', title: '整理结果', x: 425, y: 180, fixed: false, config: { text: '处理结果\n\n{{input.text}}' } },
      { id: output, number: 'a-3', kind: 'output', title: '输出结果', x: 760, y: 180, fixed: false, config: { text: `{{${template}.text}}`, outputName: 'result' } },
      { id: clock, number: 'u-1', kind: 'tool', title: '当前时间', x: 228, y: 745, fixed: false, config: { toolId: 'builtin:time.now', inputs: { timezone: 'Asia/Shanghai' } } },
    ],
    edges: [{ id: newId(), source: input, target: template }, { id: newId(), source: template, target: output }],
    notes: [{ id: 'e1a2b3c4-d5e6-4f70-8192-a3b4c5d6e7f8', text: '文本处理说明\n输入文字后，模板节点整理为最终结果。\n连接后便签跟随节点移动。', x: 410, y: 303, width: 280, height: 180, color: 'yellow', anchorNodeId: template }],
    editor: { viewport: { x: 121, y: -80, scale: 0.94 }, scopePath: [] },
  }
}

/** Same construction as the host's built-in boolean branch template. */
export function booleanBranch(workspaceId: string, title = '布尔分支模板'): Workflow {
  const flow = makeWorkflow(workspaceId, title, true), input = flow.nodes[0]!, middle = flow.nodes[1]!, output = flow.nodes[2]!
  input.config.fields = [{ name: 'approved', label: '是否通过', required: true, type: 'boolean' }]
  middle.kind = 'if'; middle.title = '判断布尔值'; middle.config = { logicGate: { operator: 'IF', inputs: [{ value: '{{input.approved}}' }] } }
  output.title = '通过结果'; output.config = { text: '已通过', outputName: 'approved' }; flow.edges[1]!.port = 'true'
  const rejected = { ...structuredClone(output), id: newId(), title: '未通过结果', y: 400, config: { text: '未通过', outputName: 'rejected' } }
  flow.nodes.push(rejected); flow.edges.push({ id: newId(), source: middle.id, target: rejected.id, port: 'false' })
  flow.description = '严格 Boolean 条件分支，分别输出通过或未通过。'
  return flow
}
export function textTemplate(workspaceId: string): Workflow {
  const flow = makeWorkflow(workspaceId, '文本整理模板', true)
  flow.description = '输入文本，经模板整理后输出。无需模型或外部工具。'
  return flow
}

export function seedWorkflows(): Workflow[] {
  const branch = booleanBranch(WORKSPACE_ID, '布尔分支示例')
  branch.id = FLOW_IDS.branch; branch.revision = 2; branch.createdAt = '2026-10-17T08:43:00.000Z'; branch.updatedAt = '2026-10-17T08:43:00.000Z'
  branch.editor = { viewport: { x: 60, y: 40, scale: 1 }, scopePath: [] }
  return [r7 as unknown as Workflow, textProcessing(), branch].map(flow => renumberWorkflow(flow))
}
export const seedPresets = (): RolePreset[] => [
  { id: 'preset-reviewer', name: '验收审阅', summary: '逐项核对产物与验收条件', prompt: '你是验收审阅助手。逐项对照验收条件检查产物，只报告与条件不符之处，不改写原文。', revision: 1, scope: 'global' },
]
