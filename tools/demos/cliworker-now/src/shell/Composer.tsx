// The DSH InputBar (card, permission + model triggers, send button, stats dock) rebuilt with the
// host package's own class names. Menus use the primitives Menu exactly as the host composer does.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Menu,
  MenuSurface,
  MenuGroup,
  IconCheckOutlineRegular,
  Tooltip,
  IconPlusOutlineMedium,
  IconChevronDownOutlineRegular,
  IconChevronRightOutlineRegular,
  IconGaugeOutlineRegular,
  IconDatabaseOutlineRegular,
  type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { C } from './common.tsx'

export interface PermissionOption {
  value: string
  name: string
  description: string
  icon: ReactNode
}
export interface ModelState {
  model: string
  modelLabel: string
  effort: string
  effortLabel: string
  models: { id: string; label: string }[]
  efforts: { id: string; label: string }[]
  provider: string
}

function SendArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 13.5V2.8M3.2 7.4 8 2.6l4.8 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PermissionTrigger({ options, value, onChange, iconOnly }: {
  options: PermissionOption[]
  value: string
  onChange: (value: string) => void
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const P = C.PermissionSelect!
  const current = options.find((o) => o.value === value) ?? options[0]!
  const items: MenuEntry[] = options.map((option) => ({
    id: option.value,
    icon: option.icon,
    label: (
      <Tooltip label={option.description} side="right" portal maxWidth={240}>
        <span className={P.optionLabelText ?? ''}>{option.name}</span>
      </Tooltip>
    ),
  }))
  return (
    <Menu
      open={open}
      onClose={() => setOpen(false)}
      side="top"
      portal
      items={items}
      selectedId={current.value}
      onSelect={(id) => {
        onChange(id)
        setOpen(false)
      }}
      anchor={
        <Tooltip label={`访问模式，当前：${current.name}`} side="top" portal disabled={open}>
          <button
            type="button"
            className={P.trigger}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`访问模式，当前：${current.name}`}
            data-demo="permission"
            onClick={() => setOpen(!open)}
          >
            <span className={P.triggerIcon}>{current.icon}</span>
            {!iconOnly && <span className={P.triggerLabel}>{current.name}</span>}
            <span className={`${P.chevron} ${open ? P.chevronOpen : ''}`}>
              <IconChevronDownOutlineRegular size={12} />
            </span>
          </button>
        </Tooltip>
      }
    />
  )
}

/** dsh-client-ui-model-selection's drill-down menu: root cells → model or effort pane. */
function ModelTrigger({ state, onModel, onEffort }: {
  state: ModelState
  onModel: (id: string) => void
  onEffort: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<'root' | 'model' | 'effort'>('root')
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const M = C.ModelSelect!
  const close = () => {
    setOpen(false)
    setPane('root')
  }
  useLayoutEffect(() => {
    if (!open) return setPos(null)
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect()
      const el = menu.current
      if (!rect || !el) return
      const lw = el.offsetWidth
      const lh = el.offsetHeight
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      setPos({
        left: Math.min(Math.max(rect.right - lw, 12), vw - lw - 12),
        top: Math.min(Math.max(rect.top - 8 - lh, 12), vh - lh - 12),
      })
    }
    place()
    const observer = new ResizeObserver(place)
    if (menu.current) observer.observe(menu.current)
    const down = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', key)
    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('keydown', key)
    }
  }, [open, pane])
  const option = (id: string, label: string, selected: boolean, choose: () => void) => (
    <button
      key={id}
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      className={`${M.option} ${selected ? M.selected : ''}`}
      onClick={() => {
        choose()
        close()
      }}
    >
      <span className={M.optionCopy}>
        <span className={M.modelName}>{label}</span>
      </span>
      <span className={M.check}>{selected ? <IconCheckOutlineRegular /> : null}</span>
    </button>
  )
  return (
    <div className={M.root}>
      <button
        ref={trigger}
        type="button"
        className={M.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${state.modelLabel} · ${state.effortLabel}`}
        data-demo="model"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className={M.triggerLabel}>{state.modelLabel}</span>
        <span className={M.triggerEffort}>{state.effortLabel}</span>
        <IconChevronDownOutlineRegular className={`${M.chevron} ${open ? M.chevronOpen : ''}`} />
      </button>
      {open &&
        createPortal(
          <MenuSurface
            ref={menu}
            className={M.menu}
            style={pos ?? { left: -9999, top: -9999 }}
            role="menu"
            aria-label="模型与推理等级"
          >
            {pane === 'root' && (
              <>
                <button type="button" role="menuitem" className={M.cell} onClick={() => setPane('model')}>
                  <span className={M.cellLabel}>模型</span>
                  <span className={M.cellValue}>{state.modelLabel}</span>
                  <IconChevronRightOutlineRegular className={M.cellChevron} />
                </button>
                <button type="button" role="menuitem" className={M.cell} onClick={() => setPane('effort')}>
                  <span className={M.cellLabel}>推理等级</span>
                  <span className={M.cellValue}>{state.effortLabel}</span>
                  <IconChevronRightOutlineRegular className={M.cellChevron} />
                </button>
              </>
            )}
            {pane === 'model' && (
              <div className={`${M.groups} scrollable`} role="menu" aria-label="模型">
                <MenuGroup label={state.provider}>
                  {state.models.map((m) => option(m.id, m.label, m.id === state.model, () => onModel(m.id)))}
                </MenuGroup>
              </div>
            )}
            {pane === 'effort' && state.efforts.map((e) => option(e.id, e.label, e.id === state.effort, () => onEffort(e.id)))}
          </MenuSurface>,
          document.body,
        )}
    </div>
  )
}

export function ContextRing({ percent }: { percent: number }) {
  const K = C.ContextMeter!
  const r = 5.5
  const len = 2 * Math.PI * r
  return (
    <Tooltip label={`上下文已用 ${percent}%（示例数据）`} side="top" portal>
      <button type="button" className={K.trigger}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
          <circle className={K.track} cx="7" cy="7" r={r} />
          <circle className={K.fill} cx="7" cy="7" r={r} strokeDasharray={`${(len * percent) / 100} ${len}`} />
        </svg>
        <span className={K.percent}>{percent}%</span>
      </button>
    </Tooltip>
  )
}

export function StatsDock({ steps, tokens, percent }: { steps: string; tokens: string; percent: number }) {
  const S = C.StatsPills!
  return (
    <div className={C.InputBar!.dock}>
      <span className={S.anchor}>
        <span className={S.pill}>
          <IconGaugeOutlineRegular />
          <span className={S.label}>{steps}</span>
        </span>
      </span>
      <span className={S.anchor}>
        <span className={S.pill}>
          <IconDatabaseOutlineRegular />
          <span className={S.label}>{tokens}</span>
        </span>
      </span>
      <ContextRing percent={percent} />
    </div>
  )
}

export function Composer({ placeholder = '发消息或创建任务，/ 调用指令，@ 文件或对话', onSend, permission, model, iconOnlyPermission, dock, above, busy }: {
  placeholder?: string
  onSend: (text: string) => void
  permission: { options: PermissionOption[]; value: string; onChange: (value: string) => void }
  model: { state: ModelState; onModel: (id: string) => void; onEffort: (id: string) => void }
  iconOnlyPermission?: boolean
  dock: ReactNode
  above?: ReactNode
  busy?: boolean
}) {
  const I = C.InputBar!
  const [text, setText] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.max(36, el.scrollHeight)}px`
  }, [text])
  const send = () => {
    const value = text.trim()
    if (!value) return
    onSend(value)
    setText('')
  }
  return (
    <div className={I.root}>
      {above}
      <div className={I.card}>
        <div className={I.scroll}>
          <div className={I.grow}>
            <textarea
              ref={area}
              className={`${I.input} demo-input`}
              value={text}
              rows={1}
              aria-label={placeholder}
              placeholder={placeholder}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  send()
                }
              }}
            />
          </div>
        </div>
        <div className={I.row}>
          <div className={I.tools}>
            <Tooltip label="添加文件或图片（演示中不可用）" side="top" portal>
              <button type="button" className={I.add} aria-label="添加">
                <IconPlusOutlineMedium size={14} />
              </button>
            </Tooltip>
            <div className={I.modes}>
              <PermissionTrigger {...permission} iconOnly={iconOnlyPermission} />
            </div>
          </div>
          <div className={I.trailing}>
            <div className={I.standardControls}>
              <ModelTrigger {...model} />
            </div>
            <Tooltip label={busy ? '回复中，发送将排队' : '发送'} side="top" portal>
              <button type="button" className={I.primary} aria-label="发送" disabled={!text.trim()} onClick={send} data-demo="send">
                <SendArrow />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
      {dock}
    </div>
  )
}

export { IconChevronRightOutlineRegular }
