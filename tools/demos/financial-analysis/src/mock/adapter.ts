/**
 * axios 自定义 adapter：把前端对 /api/* 的请求在浏览器内路由到 mock 服务（db.ts），
 * 不发出任何网络请求。错误按 FastAPI 约定返回 {detail} + HTTP 状态码，
 * 由源码 api/http.ts 的拦截器原样提示。
 */
import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import * as db from './db'
import { HttpError } from './db'
import type { Kind } from './sampleData'

type Params = Record<string, unknown>
type Handler = (ctx: { m: RegExpMatchArray; params: Params; body: any; form: FormData | null }) => unknown | Promise<unknown>

interface Route {
  method: string
  re: RegExp
  handler: Handler
  /** 模拟耗时（毫秒），解析/下载类接口更长，界面上能看到真实的 loading 过程 */
  delay?: [number, number]
}

const KIND_BY_PATH: Record<string, Kind> = {
  'balance-sheets': 'balance',
  'income-statements': 'income',
  'cash-flow-statements': 'cashflow',
}

const num = (v: unknown) => Number(v)
const yearsParam = (v: unknown): number[] | null => {
  if (v === undefined || v === null || v === '') return null
  const out: number[] = []
  for (const part of String(v).split(',')) {
    const s = part.trim()
    if (!s) continue
    const n = Number(s)
    if (!Number.isInteger(n)) throw new HttpError(422, `years 含非法值: ${s}`)
    out.push(n)
  }
  return out.length ? out : null
}
const file = (form: FormData | null) => {
  const f = form?.get('file')
  return f instanceof File ? f : null
}

class BlobResult {
  constructor(public blob: Blob, public filename: string) {}
}

const routes: Route[] = [
  { method: 'get', re: /^\/api\/health$/, handler: () => ({ status: 'ok' }) },

  // 企业
  { method: 'get', re: /^\/api\/companies$/, handler: () => db.listCompanies() },
  { method: 'post', re: /^\/api\/companies$/, handler: ({ body }) => db.createCompany(body || {}) },
  { method: 'get', re: /^\/api\/companies\/(\d+)$/, handler: ({ m }) => db.getCompany(num(m[1])) },
  { method: 'patch', re: /^\/api\/companies\/(\d+)$/, handler: ({ m, body }) => db.updateCompany(num(m[1]), body || {}) },
  { method: 'delete', re: /^\/api\/companies\/(\d+)$/, handler: ({ m }) => db.deleteCompany(num(m[1])) },

  // 三大报表
  {
    method: 'get',
    re: /^\/api\/companies\/(\d+)\/(balance-sheets|income-statements|cash-flow-statements)$/,
    handler: ({ m, params }) =>
      db.listStatements(KIND_BY_PATH[m[2]], num(m[1]), {
        year: params.year != null && params.year !== '' ? num(params.year) : undefined,
        period_type: params.period_type ? String(params.period_type) : undefined,
      }),
  },
  {
    method: 'post',
    re: /^\/api\/companies\/(\d+)\/(balance-sheets|income-statements|cash-flow-statements)$/,
    handler: ({ m, body }) => db.createStatement(KIND_BY_PATH[m[2]], num(m[1]), body || {}),
  },
  {
    method: 'get',
    re: /^\/api\/companies\/(\d+)\/(balance-sheets|income-statements|cash-flow-statements)\/(\d+)$/,
    handler: ({ m }) => db.getStatement(KIND_BY_PATH[m[2]], num(m[1]), num(m[3])),
  },
  {
    method: 'patch',
    re: /^\/api\/companies\/(\d+)\/(balance-sheets|income-statements|cash-flow-statements)\/(\d+)$/,
    handler: ({ m, body }) => db.updateStatement(KIND_BY_PATH[m[2]], num(m[1]), num(m[3]), body || {}),
  },
  {
    method: 'delete',
    re: /^\/api\/companies\/(\d+)\/(balance-sheets|income-statements|cash-flow-statements)\/(\d+)$/,
    handler: ({ m }) => db.deleteStatement(KIND_BY_PATH[m[2]], num(m[1]), num(m[3])),
  },

  // 比率
  { method: 'get', re: /^\/api\/companies\/(\d+)\/ratio-periods$/, handler: ({ m }) => db.listRatioPeriods(num(m[1])) },
  {
    method: 'get',
    re: /^\/api\/companies\/(\d+)\/ratios$/,
    handler: ({ m, params }) => {
      if (params.year == null || params.year === '') throw new HttpError(422, 'year 必填')
      const pt = String(params.period_type || 'annual')
      const q = params.quarter == null || params.quarter === '' ? null : num(params.quarter)
      if (pt === 'quarterly' && q == null) throw new HttpError(422, '季报须指定 quarter')
      return db.computePeriodRatios(num(m[1]), num(params.year), pt, q)
    },
  },
  {
    method: 'get',
    re: /^\/api\/companies\/(\d+)\/ratios\/history$/,
    handler: ({ m, params }) =>
      db.computeRatioHistory(
        num(m[1]),
        String(params.period_type || 'annual'),
        params.keys ? String(params.keys).split(',').map((s) => s.trim()).filter(Boolean) : undefined
      ),
  },

  // 多期对比
  { method: 'get', re: /^\/api\/companies\/(\d+)\/compare-periods$/, handler: ({ m }) => db.listRatioPeriods(num(m[1])) },
  {
    method: 'get',
    re: /^\/api\/companies\/(\d+)\/compare$/,
    handler: ({ m, params }) =>
      db.buildCompareMatrix(num(m[1]), String(params.statement_type || ''), String(params.period_type || 'annual'), yearsParam(params.years)),
  },

  // 导出 / 模板（演示版输出 CSV）
  {
    method: 'get',
    re: /^\/api\/companies\/(\d+)\/export\.xlsx$/,
    delay: [400, 700],
    handler: ({ m, params }) => {
      const id = num(m[1])
      const pt = String(params.period_type || 'annual')
      const csv = db.exportCsv(id, pt, yearsParam(params.years))
      return new BlobResult(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${db.companyName(id)}_财务数据_${pt === 'annual' ? '年报' : '季报'}（演示版·示例数据）.csv`)
    },
  },
  {
    method: 'get',
    re: /^\/api\/excel\/template\.xlsx$/,
    delay: [300, 500],
    handler: ({ params }) => {
      const pt = String(params.period_type || 'annual')
      const csv = db.exportCsv(null, pt, yearsParam(params.years))
      return new BlobResult(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `财务三表模板（演示版）.csv`)
    },
  },

  // Excel 导入
  { method: 'post', re: /^\/api\/companies\/(\d+)\/excel\/preview$/, delay: [700, 1100], handler: ({ m, form }) => db.previewExcel(num(m[1]), file(form)) },
  {
    method: 'post',
    re: /^\/api\/companies\/(\d+)\/excel\/import$/,
    delay: [700, 1100],
    handler: ({ m, form }) => db.commitExcel(num(m[1]), file(form), String(form?.get('overwrite') ?? 'true') !== 'false'),
  },

  // 在线拉取（示例公告库）
  { method: 'get', re: /^\/api\/imports\/fetch\/cninfo\/securities$/, delay: [500, 900], handler: ({ params }) => db.searchSecurities(String(params.q || '')) },
  {
    method: 'get',
    re: /^\/api\/imports\/fetch\/cninfo\/search$/,
    delay: [500, 900],
    handler: ({ params }) => db.searchAnnualYears(String(params.q || ''), [num(params.year)]),
  },
  {
    method: 'post',
    re: /^\/api\/imports\/fetch\/cninfo\/search-years$/,
    delay: [600, 1000],
    handler: ({ body }) => db.searchAnnualYears(String(body?.q || ''), (body?.years || []).map(num)),
  },
  { method: 'post', re: /^\/api\/imports\/fetch\/cninfo\/download$/, delay: [900, 1400], handler: ({ body }) => db.downloadCninfo(body || {}) },
  { method: 'post', re: /^\/api\/imports\/fetch\/from-url$/, delay: [1000, 1500], handler: ({ body }) => db.fetchFromUrl(body || {}) },

  // 年报 PDF 导入任务
  { method: 'post', re: /^\/api\/imports\/filings$/, delay: [1200, 1800], handler: ({ form }) => db.uploadFiling(file(form)) },
  { method: 'get', re: /^\/api\/imports\/filings$/, handler: () => db.listJobs() },
  { method: 'get', re: /^\/api\/imports\/filings\/(\d+)$/, handler: ({ m }) => db.getJob(num(m[1])) },
  { method: 'patch', re: /^\/api\/imports\/filings\/(\d+)$/, handler: ({ m, body }) => db.updateJob(num(m[1]), body || {}) },
  { method: 'post', re: /^\/api\/imports\/filings\/(\d+)\/commit$/, delay: [500, 800], handler: ({ m, body }) => db.commitJob(num(m[1]), body || {}) },
  { method: 'delete', re: /^\/api\/imports\/filings\/(\d+)$/, handler: ({ m }) => db.deleteJob(num(m[1])) },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function parseBody(data: unknown): { body: any; form: FormData | null } {
  if (data instanceof FormData) return { body: null, form: data }
  if (typeof data === 'string' && data) {
    try {
      return { body: JSON.parse(data), form: null }
    } catch {
      return { body: data, form: null }
    }
  }
  return { body: data ?? null, form: null }
}

function contentDisposition(name: string) {
  return `attachment; filename="export.csv"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toLowerCase()
  const rawUrl = (config.baseURL || '') + (config.url || '')
  const url = new URL(rawUrl, 'http://demo.invalid')
  const params: Params = { ...Object.fromEntries(url.searchParams), ...(config.params || {}) }
  const { body, form } = parseBody(config.data)

  const route = routes.find((r) => r.method === method && r.re.test(url.pathname))
  const [lo, hi] = route?.delay ?? [80, 220]
  await sleep(lo + Math.random() * (hi - lo))

  const respond = (status: number, data: unknown, headers: Record<string, string> = {}): AxiosResponse => ({
    data,
    status,
    statusText: String(status),
    headers: AxiosHeaders.from({ 'content-type': 'application/json', ...headers }),
    config,
    request: { responseURL: url.pathname, demo: true },
  })

  let response: AxiosResponse
  if (!route) {
    response = respond(404, { detail: 'Not Found' })
  } else {
    try {
      const out = await route.handler({ m: url.pathname.match(route.re)!, params, body, form })
      if (out instanceof BlobResult) {
        response = respond(200, out.blob, {
          'content-type': out.blob.type,
          'content-disposition': contentDisposition(out.filename),
        })
      } else if (out === undefined) {
        response = respond(204, '')
      } else {
        // 深拷贝：前端会直接 v-model 修改返回对象，不能改到“数据库”
        response = respond(method === 'post' && /\/api\/companies(\/\d+\/[a-z-]+)?$/.test(url.pathname) ? 201 : 200, JSON.parse(JSON.stringify(out)))
      }
    } catch (e) {
      if (e instanceof HttpError) response = respond(e.status, { detail: e.detail })
      else {
        console.warn('[demo mock] 未预期错误', e)
        response = respond(500, { detail: '演示数据处理出错' })
      }
    }
  }

  if (response.status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${response.status}`,
      response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      response.request,
      response
    )
  }
  return response
}
