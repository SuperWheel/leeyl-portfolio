import { createRoot } from 'react-dom/client'
import { installPluginStyles } from './plugin-styles.ts'
import { App } from './shell/App.tsx'
import './shell/shell.css'

const DESIGN_W = 1280
const DESIGN_H = 820

/**
 * Opened directly in a browser tab, the page hosts itself in an iframe laid out at no less than
 * 1280×820 and scales that frame down to fit. The app inside always sees a full-size viewport, so
 * anchored menus (portals measured with getBoundingClientRect) stay exact in every browser.
 * Embedded (the project page's iframe) or with ?frame, it renders directly.
 */
function mountScaledFrame() {
  document.body.classList.add('demo-host')
  const frame = document.createElement('iframe')
  frame.className = 'demo-host-frame'
  frame.title = document.title
  const url = new URL(location.href)
  url.searchParams.set('frame', '1')
  frame.src = url.pathname + url.search + url.hash
  const fit = () => {
    const w = window.innerWidth || DESIGN_W
    const h = window.innerHeight || DESIGN_H
    const scale = Math.min(1, w / DESIGN_W, h / DESIGN_H)
    frame.style.width = `${w / scale}px`
    frame.style.height = `${h / scale}px`
    frame.style.transform = scale === 1 ? '' : `scale(${scale})`
  }
  fit()
  window.addEventListener('resize', fit)
  document.body.append(frame)
}

const embedded = window.self !== window.top || new URLSearchParams(location.search).has('frame')
if (!embedded) mountScaledFrame()
else {
  installPluginStyles()
  document.body.setAttribute('data-dsh-demo', '')
  createRoot(document.getElementById('root')!).render(<App />)
}
