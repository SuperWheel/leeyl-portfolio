// Static demo entry: the plugin's real WorkflowApp/WorkflowStore with an in-browser host.
import { createRoot } from 'react-dom/client'
import { WorkflowApp, type AnnotationBridge, type WorkflowNavigation } from '@vw-source/src/client/app.tsx'
import { WorkflowStore } from '@vw-source/src/client/store.ts'
import { styles } from '@vw-source/src/client/styles.ts'
import { annotationEditorStyles } from '@vw-source/src/client/annotation-editor.tsx'
import { hostQuestionStyles } from '@vw-source/src/client/host-question-style.ts'
import { installWorkflowMotion } from '@vw-source/src/client/workflow-motion.ts'
import '@vw-cache/native-theme.css'
import './demo.css'
import { createMockApi, DEMO_NOTICE } from './mock-api.ts'
import { FLOW_IDS } from './seed.ts'

const style = document.createElement('style'); style.textContent = styles + annotationEditorStyles + hostQuestionStyles; document.head.appendChild(style)
window.addEventListener('pagehide', installWorkflowMotion(document), { once: true })

const { api } = createMockApi()
const store = new WorkflowStore(api)
const SESSION = 'demo-session'
// The host's neutral status notice (same component the plugin uses for catalog notices).
let noticeTimer: ReturnType<typeof setTimeout> | undefined
const notice = (what: string) => {
  const text = `${what}。${DEMO_NOTICE}`
  store.update({ libraryWarning: text })
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { if (store.getSnapshot().libraryWarning === text) store.update({ libraryWarning: undefined }) }, 8000)
}
// Stand-in for the native chat bridge. The real dialogs open; submitting only shows the demo boundary.
const chat: AnnotationBridge = {
  async stageAnnotation() { notice('注释未提交到对话') },
  async deleteAnnotation() { notice('对话中的注释未改动') },
  async insertGenerateRequest() { notice('需求未交给 Agent'); return true },
  getGenerateRequest: () => undefined,
  async insertWorkflow() { notice('工作流未插入对话') },
  getAnnotations: () => [],
  subscribe: () => () => {},
}
const navigation: WorkflowNavigation = {
  toFull() {}, toSide() {},
  openChat() {},
  openSettings: () => notice('未打开 DeepSeekHarness 设置'),
  getSessionId: () => SESSION,
  sessions: () => [{ id: SESSION, title: '演示对话' }],
  createSession: async () => SESSION,
}
createRoot(document.getElementById('root')!).render(<div className="vw-demo-pane"><WorkflowApp store={store} mode="full" navigation={navigation} chat={chat}/></div>)

// #home shows the workflow list; #text / #branch / #r7 open a sample canvas (default #r7).
const target = () => { const hash = location.hash.replace(/^#/, '').split('&'); return hash.includes('home') ? undefined : hash.includes('text') ? FLOW_IDS.text : hash.includes('branch') ? FLOW_IDS.branch : FLOW_IDS.r7 }
const show = () => { const id = target(); return id ? store.open(id) : store.flush().then(() => store.update({ page: 'library' })) }
void store.load().then(show).catch(error => store.update({ error: String(error) }))
window.addEventListener('hashchange', () => { void Promise.resolve().then(show).catch(error => store.update({ error: String(error) })) })
