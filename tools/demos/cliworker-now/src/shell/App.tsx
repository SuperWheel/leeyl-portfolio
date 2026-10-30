// Static DSH desktop shell around the real CLI Worker Now Panel.
import { useState } from 'react'
import {
  Tooltip,
  IconPanelLeftOutlineRegular,
  IconCloseOutlineRegular,
  IconPlusOutlineRegular,
  IconCompareSplitOutlineRegular,
  IconFullscreenOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { Panel } from 'cwn-src/client/panel.tsx'
import type { Worker } from 'cwn-src/shared/types.ts'
import { api } from '../mock/api.ts'
import { PARENT } from '../mock/data.ts'
import { C } from './common.tsx'
import { Sidebar } from './Sidebar.tsx'
import { MainConversation } from './MainConversation.tsx'
import { NativeConversation } from './NativeConversation.tsx'
import { WorkflowIcon } from './icons.tsx'

function TabStrip({ tab, onTab, onClose, onFull, full }: {
  tab: 'cliworker' | 'workflow'
  onTab: (tab: 'cliworker' | 'workflow') => void
  onClose: () => void
  onFull: () => void
  full: boolean
}) {
  const icon = C.SidebarRight!.iconButton
  return (
    <div className="demo-dock-strip" data-demo="dock-strip">
      <div className="demo-dock-tabs" role="tablist">
        <div className={`demo-dock-tab ${tab === 'cliworker' ? 'is-active' : ''}`} role="tab" aria-selected={tab === 'cliworker'} onClick={() => onTab('cliworker')}>
          <span className="demo-dock-tab-label">CLI Worker</span>
          <button type="button" className="demo-dock-tab-close" aria-label="关闭 CLI Worker" onClick={(e) => { e.stopPropagation(); onClose() }}>
            <IconCloseOutlineRegular size={12} />
          </button>
        </div>
        <div className={`demo-dock-tab ${tab === 'workflow' ? 'is-active' : ''}`} role="tab" aria-selected={tab === 'workflow'} onClick={() => onTab('workflow')}>
          <span className="demo-dock-tab-label">工作流</span>
        </div>
        <Tooltip label="新建标签页（演示中不可用）" side="bottom" portal>
          <button type="button" className={`${icon} demo-dock-add`} aria-label="新建标签页">
            <IconPlusOutlineRegular size={15} />
          </button>
        </Tooltip>
      </div>
      <div className="demo-dock-actions">
        <Tooltip label="分栏（演示中不可用）" side="bottom" portal>
          <button type="button" className={icon} aria-label="分栏">
            <IconCompareSplitOutlineRegular size={15} />
          </button>
        </Tooltip>
        <Tooltip label={full ? '退出全屏' : '全屏'} side="bottom" portal>
          <button type="button" className={icon} aria-label="全屏" aria-pressed={full} onClick={onFull}>
            <IconFullscreenOutlineRegular size={15} />
          </button>
        </Tooltip>
        <Tooltip label="收起右侧栏" side="bottom" align="end" portal>
          <button type="button" className={icon} aria-label="收起右侧栏" onClick={onClose}>
            <span className={C.SidebarRight!.collapseGlyph}>
              <IconPanelLeftOutlineRegular size={15} />
            </span>
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

export function App() {
  const A = C.AppFrame!
  const [sidebar, setSidebar] = useState(true)
  const [right, setRight] = useState(true)
  const [full, setFull] = useState(false)
  const [tab, setTab] = useState<'cliworker' | 'workflow'>('cliworker')
  const [active, setActive] = useState<string>()

  const openPanel = () => {
    setRight(true)
    setTab('cliworker')
  }
  const openWorker = (worker: Worker) => {
    openPanel()
    setActive(undefined)
    requestAnimationFrame(() => setActive(worker.harnessConversation?.sessionId))
  }

  const columns = full
    ? `${sidebar ? 280 : 0}px 0px minmax(0,1fr)`
    : `${sidebar ? 280 : 0}px minmax(400px,1fr) minmax(0,${right ? 572 : 0}px)`

  return (
    <div className="demo-window">
      <div
        className={A.frame}
        data-animating=""
        data-sidebar-collapsed={sidebar ? undefined : ''}
        style={{ gridTemplateColumns: columns }}
      >
        <div className={A.sidebarCol}>{sidebar && <Sidebar onToggle={() => setSidebar(false)} />}</div>
        <div className={A.centerCol}>
          <MainConversation onOpenWorker={openWorker} onOpenPanel={openPanel} panelOpen={right} />
        </div>
        <div className={`${A.rightbarCol} demo-rightbar`} data-open={right || undefined}>
          {right && (
            <div className="demo-rightbar-inner">
              <TabStrip
                tab={tab}
                onTab={setTab}
                onClose={() => {
                  setRight(false)
                  setFull(false)
                }}
                onFull={() => setFull(!full)}
                full={full}
              />
              <div className="demo-rightbar-body" hidden={tab !== 'cliworker'}>
                <Panel
                  api={api}
                  sessionId={PARENT}
                  activeHarnessSessionId={active}
                  renderHarnessConversation={(worker) => <NativeConversation key={worker.id} worker={worker} />}
                />
              </div>
              {tab === 'workflow' && (
                <div className="demo-rightbar-body demo-placeholder">
                  <WorkflowIcon size={28} />
                  <p>工作流插件不在本演示范围内。</p>
                  <button type="button" className="demo-chip" onClick={() => setTab('cliworker')}>
                    返回 CLI Worker
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {!sidebar && (
          <div className={A.leadingSeat}>
            <div className={C.HeaderLeadingControls!.controls}>
              <Tooltip label="展开侧栏" side="bottom" portal>
                <button type="button" className={C.HeaderLeadingControls!.iconButton} aria-label="展开侧栏" onClick={() => setSidebar(true)}>
                  <IconPanelLeftOutlineRegular size={16} />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
      <div className="demo-traffic" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
