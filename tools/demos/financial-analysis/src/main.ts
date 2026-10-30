/**
 * 演示入口：先装 mock，再执行源仓库真实的 frontend/src/main.ts（原样挂载 App、路由、Pinia、Element Plus）。
 */
import './demo.css'
import '@/main'
import { mountDemoBadge } from './demoBadge'

mountDemoBadge()
