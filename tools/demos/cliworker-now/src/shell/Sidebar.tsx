// DSH left sidebar (dsh-client-ui-sidebar + dsh-client-ui-workspace markup and classes).
// Workspace and session names are neutral samples.
import { useState } from 'react'
import {
  FishLogo,
  BrandWordmark,
  Tooltip,
  IconPanelLeftOutlineRegular,
  IconNewChatOutlineMedium,
  IconPluginPinwheelOutlineRegular,
  IconClockOutlineRegular,
  IconAppsAddOutlineRegular,
  IconSearchOutlineRegular,
  IconSlidersTwoOutlineRegular,
  IconProjectAddOutlineRegular,
  IconFolderCloseRegular,
  IconFolderOpenRegular,
  IconChevronRightOutlineRegular,
  IconEllipsisOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { C } from './common.tsx'
import { WorkflowIcon } from './icons.tsx'

export const MAIN_TITLE = '雾港第 3 章联合审校'

interface Session { title: string; time: string; current?: boolean }
interface Group { id: string; folder?: string; open: boolean; sessions: Session[]; more?: number }

const GROUPS: Group[] = [
  { id: 'recent', open: true, sessions: [{ title: MAIN_TITLE, time: '刚刚', current: true }], more: 8 },
  { id: 'short', folder: '短篇集-校对', open: false, sessions: [{ title: '统一第 2 篇的称谓', time: '2天' }] },
  {
    id: 'novel',
    folder: '雾港-第二卷',
    open: true,
    sessions: [
      { title: '整理人物关系表', time: '5小时' },
      { title: '统一地名与称谓写法', time: '6小时' },
      { title: '第 2 章节奏调整', time: '7小时' },
      { title: '补写第 5 章过渡段', time: '7小时' },
      { title: '伏笔清单核对', time: '7小时' },
    ],
    more: 12,
  },
  { id: 'demo', folder: 'CLI Worker 演示', open: true, sessions: [{ title: '通过 CLI Worker 派遣示例任务', time: '23天' }] },
  { id: 'default', folder: '默认工作区', open: false, sessions: [{ title: '新会话', time: '1月' }] },
]

export function Sidebar({ onToggle }: { onToggle: () => void }) {
  const S = C.SidebarRoot!
  const R = C.Rows!
  const W = C.WorkspaceBrowser!
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(GROUPS.map((g) => [g.id, g.open])))
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [panel, setPanel] = useState('')
  const nav = [
    { id: 'plugins', icon: <IconPluginPinwheelOutlineRegular size={16} />, title: '插件' },
    { id: 'automation', icon: <IconClockOutlineRegular size={16} />, title: '自动化任务' },
    { id: 'workflow', icon: <WorkflowIcon />, title: '工作流' },
    { id: 'more', icon: <IconAppsAddOutlineRegular size={16} />, title: '更多' },
  ]
  return (
    <div className={`${S.root} ${S.wide ?? ''}`} data-demo="sidebar">
      <div className={S.topStrip}>
        <Tooltip label="收起侧栏" side="bottom" portal>
          <button type="button" className={`${S.iconButton} ${S.toggle ?? ''}`} aria-label="收起侧栏" onClick={onToggle}>
            <IconPanelLeftOutlineRegular size={16} />
          </button>
        </Tooltip>
      </div>
      <div className={S.logoRow}>
        <span className={S.brand}>
          <span className={S.brandIdentity} aria-label="DeepSeek Harness">
            <span className={S.brandMark}>
              <FishLogo size={24} />
            </span>
            <span className={S.brandName}>
              <BrandWordmark includeMark={false} />
            </span>
          </span>
        </span>
      </div>
      <button type="button" className={S.newSession}>
        <span className={S.newSessionLabelMask}>
          <span className={S.newSessionContent}>
            <IconNewChatOutlineMedium size={14} />
            <span className={S.newSessionLabel}>新会话</span>
          </span>
        </span>
      </button>
      <nav className={S.panelList}>
        {nav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${S.panelRow} ${panel === item.id ? S.panelActive : ''}`}
            onClick={() => setPanel(panel === item.id ? '' : item.id)}
          >
            <span className={S.panelGlyph}>{item.icon}</span>
            <span className={S.panelTitle}>{item.title}</span>
          </button>
        ))}
      </nav>
      <div className={S.regionArea}>
        <div className={W.root}>
          <div className={W.sectionHeader}>
            <span className={W.sectionLabel} style={{ flex: 1, maxWidth: 'none' }}>
              工作区
            </span>
            <div className={W.headerActions}>
              <button type="button" className={W.iconButton} aria-label="搜索会话">
                <IconSearchOutlineRegular size={16} />
              </button>
              <button type="button" className={W.iconButton} aria-label="视图选项">
                <IconSlidersTwoOutlineRegular size={16} />
              </button>
              <button type="button" className={W.iconButton} aria-label="新建工作区">
                <IconProjectAddOutlineRegular size={16} />
              </button>
            </div>
          </div>
          <div className={W.listArea}>
            <div className={`${W.list} demo-session-list`}>
              {GROUPS.map((group) => {
                const isOpen = open[group.id]
                const showAll = expanded[group.id]
                return (
                  <div key={group.id} className={W.groupSection}>
                    {group.folder && (
                      <div
                        className={R.projectRow}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isOpen}
                        onClick={() => setOpen({ ...open, [group.id]: !isOpen })}
                      >
                        <span className={`${R.slot} ${R.folder}`}>
                          {isOpen ? <IconFolderOpenRegular size={16} /> : <IconFolderCloseRegular size={16} />}
                        </span>
                        <span className={`${R.slot} ${R.chevron}`}>
                          <IconChevronRightOutlineRegular size={12} className={`${R.arrow} ${isOpen ? R.arrowOpen : ''}`} />
                        </span>
                        <span className={R.projectText}>
                          <span className={R.title}>{group.folder}</span>
                        </span>
                      </div>
                    )}
                    {isOpen && (
                      <>
                        {group.sessions.map((session) => (
                          <div
                            key={session.title}
                            className={`${R.sessionRow} ${session.current ? R.selected : ''}`}
                           
                            aria-current={session.current || undefined}
                          >
                            <span className={R.slot} />
                            <span className={R.title}>{session.title}</span>
                            <span className={R.time}>{session.time}</span>
                          </div>
                        ))}
                        {showAll &&
                          Array.from({ length: Math.min(group.more ?? 0, 4) }, (_, i) => (
                            <div key={i} className={R.sessionRow}>
                              <span className={R.slot} />
                              <span className={R.title}>{`较早的示例会话 ${i + 1}`}</span>
                              <span className={R.time}>{`${i + 2}周`}</span>
                            </div>
                          ))}
                        {group.more ? (
                          <button
                            type="button"
                            className={W.sessionOverflowButton}
                           
                            onClick={() => setExpanded({ ...expanded, [group.id]: !showAll })}
                          >
                            {showAll ? '收起' : `展开其余 ${group.more} 个会话`}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className={S.footArea}>
        <div className={S.footerActions}>
          <button type="button" className={`${S.panelRow} demo-more-row`}>
            <span className={S.panelGlyph}>
              <IconEllipsisOutlineRegular size={16} />
            </span>
            <span className={S.panelTitle}>更多</span>
          </button>
        </div>
      </div>
    </div>
  )
}
