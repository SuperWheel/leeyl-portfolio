/**
 * 财务分析系统 · 静态演示构建配置
 *
 * 复用源仓库的真实 Vue 前端（frontend/src，只读导入），只做三处构建期替换：
 *  1. src/api/http.ts 里的 `import axios from 'axios'` → 本目录 src/axios-demo.ts
 *     （给 axios 默认挂上浏览器内 mock adapter，http.ts 原文与拦截器保持不变）；
 *  2. src/router/index.ts 的 createWebHistory → createWebHashHistory（子路径可刷新）；
 *  3. 源码里的第三方裸导入一律从本目录 node_modules 解析（不读写源仓库 node_modules）。
 * 构建缓存在 .cache/（已被根 .gitignore 忽略），产物输出到 projects/financial-analysis/demo/。
 */
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = path.resolve(
  process.env.FA_SOURCE_DIR || `${process.env.HOME}/Project/Web_Financial_Analyse`
)
const FE_SRC = path.join(SOURCE_DIR, 'frontend', 'src')
const OUT_DIR = path.resolve(HERE, '../../../projects/financial-analysis/demo')

if (!existsSync(path.join(FE_SRC, 'main.ts'))) {
  throw new Error(`找不到源仓库前端入口：${FE_SRC}/main.ts（用 FA_SOURCE_DIR 指定源仓库）`)
}

const HTTP_TS = path.join(FE_SRC, 'api', 'http.ts')
const ROUTER_TS = path.join(FE_SRC, 'router', 'index.ts')
const RESOLVE_ANCHOR = path.join(HERE, 'src', 'main.ts')

function isBare(id: string): boolean {
  return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('@/') && !id.startsWith('\0') && !/^[a-zA-Z]:/.test(id)
}

function demoSourceBridge(): Plugin {
  return {
    name: 'fa-demo-source-bridge',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer) return null
      const imp = importer.split('?')[0]
      if (!imp.startsWith(FE_SRC + path.sep)) return null
      if (source === 'axios' && imp === HTTP_TS) {
        return path.join(HERE, 'src', 'axios-demo.ts')
      }
      if (isBare(source)) {
        // 源码的第三方依赖从本目录 node_modules 解析，保证单一副本、且不碰源仓库
        return this.resolve(source, RESOLVE_ANCHOR, { ...options, skipSelf: true })
      }
      return null
    },
    transform(code, id) {
      if (id.split('?')[0] !== ROUTER_TS) return null
      if (!code.includes('createWebHistory')) {
        throw new Error('router/index.ts 未找到 createWebHistory，源码结构已变化，请检查替换规则')
      }
      return { code: code.replace(/\bcreateWebHistory\b/g, 'createWebHashHistory'), map: null }
    },
  }
}

/** 记录实际打进产物的第三方包，供 scripts/gen-licenses.mjs 生成 LICENSES.md */
function recordBundledPackages(): Plugin {
  return {
    name: 'fa-demo-record-packages',
    apply: 'build',
    generateBundle(_opts, bundle) {
      // 包名 → 包目录（取路径中最后一段 node_modules/<包>，兼容嵌套安装）
      const pkgs = new Map<string, string>()
      const add = (id: string) => {
        const m = id.match(/^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\/(?!.*node_modules\/)/)
        if (m) pkgs.set(m[2], m[1])
      }
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        for (const id of Object.keys(chunk.modules)) add(id.replace(/^\0/, '').split('?')[0])
      }
      // element-plus/dist/index.css 以 CSS 资源形式打包
      add(path.join(HERE, 'node_modules', 'element-plus', 'dist', 'index.css'))
      mkdirSync(path.join(HERE, '.cache'), { recursive: true })
      const list = [...pkgs].sort(([a], [b]) => a.localeCompare(b)).map(([name, dir]) => ({ name, dir }))
      writeFileSync(path.join(HERE, '.cache', 'bundled-packages.json'), JSON.stringify(list, null, 1))
    },
  }
}

export default defineConfig({
  root: HERE,
  base: './',
  cacheDir: path.join(HERE, '.cache', 'vite'),
  publicDir: false,
  plugins: [demoSourceBridge(), vue(), recordBundledPackages()],
  resolve: {
    alias: { '@': FE_SRC },
    dedupe: ['vue', 'element-plus', 'echarts', 'vue-echarts', 'pinia', 'vue-router', 'axios'],
  },
  define: {
    __FA_DEMO_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  server: {
    host: '127.0.0.1',
    port: 8741,
    fs: { allow: [HERE, FE_SRC] },
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    assetsDir: 'assets',
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(echarts|zrender|tslib)\//.test(id)) return 'echarts'
          if (id.includes('node_modules/element-plus') || id.includes('node_modules/@element-plus')) return 'element-plus'
          if (id.includes('node_modules/')) return 'vendor'
          return undefined
        },
      },
    },
  },
})
