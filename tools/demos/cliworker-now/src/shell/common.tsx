// Shared bits of the static DSH shell: store hook, time formatting, small host-style widgets.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import H from 'host:classes'
import {
  IconCopyOutlineRegular,
  IconCheckOutlineRegular,
  IconLikeOutlineRegular,
  IconLikeFillRegular,
  IconDislikeOutlineRegular,
  IconDislikeFillRegular,
  IconBranchOutlineRegular,
  IconDatabaseOutlineRegular,
  IconChevronDownOutlineRegular,
  Tooltip,
  MarkdownText,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { store, subscribe } from '../mock/store.ts'

export type Classes = Record<string, Record<string, string>>
export const C = H as unknown as Classes

/** Re-render on every mock store change. */
export function useStoreRevision() {
  return useSyncExternalStore(subscribe, () => store.revision)
}

const pad = (n: number) => String(n).padStart(2, '0')
/** DSH message timestamp: 10 月 28 日 23:09 */
export function stamp(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const markdownLabels = { code: { copyLabel: '复制', copiedLabel: '已复制' }, footnotes: '脚注' }

export function Markdown({ text, streaming }: { text: string; streaming?: boolean }) {
  return <MarkdownText text={text} streaming={streaming} labels={markdownLabels} />
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.append(area)
    area.select()
    try {
      document.execCommand('copy')
    } catch {
      /* clipboard unavailable: the check mark still confirms the click */
    }
    area.remove()
  }
}

/** Copy button with the brief check-mark confirmation DSH shows. */
export function CopyAction({ text, label = '复制' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <Tooltip label={done ? '已复制' : label} side="bottom" portal>
      <button
        type="button"
        className={C.MessageIconActions!.action}
        aria-label={label}
        onClick={() => {
          void copyText(text)
          setDone(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setDone(false), 1400)
        }}
      >
        {done ? <IconCheckOutlineRegular /> : <IconCopyOutlineRegular />}
      </button>
    </Tooltip>
  )
}

/** Assistant turn footer: copy, like, dislike, share, usage, time. */
export function TurnActions({ text, tokens, time }: { text: string; tokens: string; time: string }) {
  const [vote, setVote] = useState<'' | 'up' | 'down'>('')
  const A = C.MessageIconActions!
  return (
    <div className={A.actions}>
      <CopyAction text={text} />
      <Tooltip label={vote === 'up' ? '取消点赞' : '点赞'} side="bottom" portal>
        <button type="button" className={A.action} aria-pressed={vote === 'up'} onClick={() => setVote(vote === 'up' ? '' : 'up')}>
          {vote === 'up' ? <IconLikeFillRegular /> : <IconLikeOutlineRegular />}
        </button>
      </Tooltip>
      <Tooltip label={vote === 'down' ? '取消点踩' : '点踩'} side="bottom" portal>
        <button type="button" className={A.action} aria-pressed={vote === 'down'} onClick={() => setVote(vote === 'down' ? '' : 'down')}>
          {vote === 'down' ? <IconDislikeFillRegular /> : <IconDislikeOutlineRegular />}
        </button>
      </Tooltip>
      <Tooltip label="分享（演示中不可用）" side="bottom" portal>
        <button type="button" className={A.action} data-unavailable="" aria-label="分享">
          <IconBranchOutlineRegular />
        </button>
      </Tooltip>
      <span className={A.endInfo}>
        <span className={C.TurnUsagePanel!.root}>
          <Tooltip label={`本轮用量 ${tokens}（示例数据）`} side="bottom" portal>
            <button type="button" className={C.TurnUsagePanel!.trigger}>
              <IconDatabaseOutlineRegular />
              <span className={C.TurnUsagePanel!.label}>用量 {tokens}</span>
            </button>
          </Tooltip>
        </span>
        <span className={A.timeEnd}>{time}</span>
      </span>
    </div>
  )
}

/** "已完成，用时 N 秒" disclosure; opens to a short process list. */
export function ProcessLine({ label, steps, busy }: { label: ReactNode; steps?: string[]; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const P = C.TurnProcessNodeView!
  return (
    <div className="demo-process">
      <button
        type="button"
        className={P.root}
        data-open={open || undefined}
        disabled={busy || !steps?.length}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className={P.label}>{label}</span>
        {!busy && steps?.length ? <IconChevronDownOutlineRegular className={P.chevron} /> : null}
      </button>
      {open && steps && (
        <ul className="demo-process-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** User message bubble with optional time + copy row (DSH child sessions show it). */
export function UserBubble({ text, time }: { text: string; time?: string }) {
  const M = C.MessageItem!
  const A = C.MessageIconActions!
  return (
    <div className={M.userRow} data-chat-flow-kind="user">
      <div className={M.userStack}>
        <div className={M.bubble}>{text}</div>
      </div>
      {time && (
        <div className={A.actions} data-clock="start">
          <span className={A.timeStart}>{time}</span>
          <CopyAction text={text} />
        </div>
      )}
    </div>
  )
}

/** Small anchored popover that closes on outside click / Escape. */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (event: PointerEvent) => {
      const target = event.target as Node
      if (!ref.current?.contains(target) && !menu.current?.contains(target)) setOpen(false)
    }
    const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return { open, setOpen, ref, menu }
}

/** Keep a scroll container pinned to its end while content grows (streaming, async Markdown). */
export function useStickToBottom<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const stick = useRef(true)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const toEnd = () => {
      if (stick.current) el.scrollTop = el.scrollHeight
    }
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    }
    const observer = new ResizeObserver(toEnd)
    for (const child of Array.from(el.children)) observer.observe(child)
    const mutations = new MutationObserver(() => {
      for (const child of Array.from(el.children)) observer.observe(child)
      toEnd()
    })
    mutations.observe(el, { childList: true, subtree: true, characterData: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    toEnd()
    return () => {
      observer.disconnect()
      mutations.disconnect()
      el.removeEventListener('scroll', onScroll)
    }
  }, [])
  return { ref, stick }
}
