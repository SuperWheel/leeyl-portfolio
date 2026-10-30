/**
 * 浏览器内存“后端”：按源仓库 backend/app/services/* 的逻辑移植
 * （企业 / 三表 CRUD、比率计算、多期对比矩阵、年报导入任务、Excel 导入）。
 * 只存在于当前页面内存中，刷新即恢复初始示例数据。
 */
import meta from './backendMeta.json'
import {
  FIELD_KEYS,
  FILING_ONLY_PROFILES,
  PROFILES,
  buildProfilePeriods,
  type Fields,
  type Kind,
  type PeriodRecord,
  type SampleCompanyProfile,
} from './sampleData'

export class HttpError extends Error {
  constructor(public status: number, public detail: string) {
    super(detail)
  }
}

const KINDS: Kind[] = ['balance', 'income', 'cashflow']
const KIND_LABEL: Record<Kind, string> = { balance: '资产负债表', income: '利润表', cashflow: '现金流量表' }

interface Company {
  id: number
  name: string
  code: string | null
  industry: string | null
  created_at: string
  updated_at: string
}

interface StatementRow {
  id: number
  company_id: number
  year: number
  period_type: 'annual' | 'quarterly'
  quarter: number | null
  [k: string]: number | string | null
}

const nowIso = () => new Date().toISOString().replace('Z', '')

const state = {
  companies: [] as Company[],
  statements: { balance: [], income: [], cashflow: [] } as Record<Kind, StatementRow[]>,
  jobs: [] as Record<string, unknown>[],
  seq: { company: 0, statement: 0, job: 0 },
}

function seed() {
  const t0 = '2026-07-18T21:30:00'
  for (const p of PROFILES) {
    const c: Company = { id: ++state.seq.company, name: p.name, code: p.code, industry: p.industry, created_at: t0, updated_at: t0 }
    state.companies.push(c)
    for (const rec of buildProfilePeriods(p)) writePeriod(c.id, rec, true)
  }
}

function writePeriod(companyId: number, rec: PeriodRecord, overwrite: boolean) {
  for (const kind of KINDS) {
    const fields = rec.data[kind]
    if (!fields) continue
    const existing = findByPeriod(kind, companyId, rec.year, rec.period_type, rec.quarter)
    if (existing) {
      if (overwrite) Object.assign(existing, fields)
    } else {
      state.statements[kind].push({
        id: ++state.seq.statement,
        company_id: companyId,
        year: rec.year,
        period_type: rec.period_type,
        quarter: rec.quarter,
        ...emptyFields(kind),
        ...fields,
      })
    }
  }
}

function emptyFields(kind: Kind): Fields {
  const out: Fields = {}
  for (const k of FIELD_KEYS[kind]) out[k] = null
  return out
}

// ---------------------------------------------------------------------------
// 企业
// ---------------------------------------------------------------------------

export function listCompanies() {
  return [...state.companies].sort((a, b) => a.id - b.id)
}

export function getCompany(id: number): Company {
  const c = state.companies.find((x) => x.id === id)
  if (!c) throw new HttpError(404, `企业 id=${id} 不存在`)
  return c
}

export function createCompany(body: { name?: string; code?: string | null; industry?: string | null }): Company {
  const name = (body.name || '').trim()
  if (!name) throw new HttpError(422, '企业名称不能为空')
  const code = body.code ? String(body.code).trim() || null : null
  if (code && state.companies.some((c) => c.code === code)) {
    throw new HttpError(409, `企业代码 code='${code}' 已存在`)
  }
  const t = nowIso()
  const c: Company = { id: ++state.seq.company, name, code, industry: body.industry?.trim() || null, created_at: t, updated_at: t }
  state.companies.push(c)
  return c
}

export function updateCompany(id: number, body: Partial<Company>) {
  const c = getCompany(id)
  if (body.code && state.companies.some((x) => x.code === body.code && x.id !== id)) {
    throw new HttpError(409, '企业代码冲突')
  }
  Object.assign(c, pick(body, ['name', 'code', 'industry']), { updated_at: nowIso() })
  return c
}

export function deleteCompany(id: number) {
  getCompany(id)
  state.companies = state.companies.filter((c) => c.id !== id)
  for (const k of KINDS) state.statements[k] = state.statements[k].filter((r) => r.company_id !== id)
}

function pick<T extends object>(o: T, keys: string[]): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const k of keys) if (k in o) out[k] = (o as Record<string, unknown>)[k]
  return out as Partial<T>
}

// ---------------------------------------------------------------------------
// 三大报表（statement_service）
// ---------------------------------------------------------------------------

function ensurePeriodRules(year: number, periodType: string, quarter: number | null | undefined) {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) throw new HttpError(422, '年份须在 1990–2100 之间')
  if (periodType !== 'annual' && periodType !== 'quarterly') throw new HttpError(422, 'period_type 须为 annual 或 quarterly')
  if (periodType === 'annual' && quarter != null) throw new HttpError(422, '年报（annual）的 quarter 必须为空')
  if (periodType === 'quarterly') {
    if (quarter == null) throw new HttpError(422, '季报（quarterly）必须指定 quarter（1-4）')
    if (![1, 2, 3, 4].includes(quarter)) throw new HttpError(422, '季度必须是 [1, 2, 3, 4] 之一')
  }
}

function findByPeriod(kind: Kind, companyId: number, year: number, periodType: string, quarter: number | null, excludeId?: number) {
  return state.statements[kind].find(
    (r) =>
      r.company_id === companyId &&
      r.year === year &&
      r.period_type === periodType &&
      (r.quarter ?? null) === (quarter ?? null) &&
      r.id !== excludeId
  )
}

export function listStatements(kind: Kind, companyId: number, opts: { year?: number; period_type?: string } = {}) {
  getCompany(companyId)
  return state.statements[kind]
    .filter((r) => r.company_id === companyId)
    .filter((r) => opts.year == null || r.year === opts.year)
    .filter((r) => opts.period_type == null || r.period_type === opts.period_type)
    .sort(
      (a, b) =>
        b.year - a.year ||
        a.period_type.localeCompare(b.period_type) ||
        (a.quarter ?? -1) - (b.quarter ?? -1)
    )
}

function cleanAmounts(kind: Kind, body: Record<string, unknown>): Fields {
  const out: Fields = {}
  for (const k of FIELD_KEYS[kind]) {
    if (!(k in body)) continue
    const v = body[k]
    if (v === null || v === undefined || v === '') out[k] = null
    else {
      const n = Number(v)
      if (Number.isNaN(n)) throw new HttpError(422, `${k} 须为数字`)
      out[k] = Math.round(n * 100) / 100
    }
  }
  return out
}

export function createStatement(kind: Kind, companyId: number, body: Record<string, unknown>) {
  getCompany(companyId)
  const year = Number(body.year)
  const periodType = String(body.period_type || 'annual')
  const quarter = body.quarter == null ? null : Number(body.quarter)
  ensurePeriodRules(year, periodType, quarter)
  if (findByPeriod(kind, companyId, year, periodType, quarter)) {
    throw new HttpError(409, `该企业 ${year} 年 ${periodType}` + (quarter ? ` Q${quarter}` : ' 年报') + ' 报表已存在')
  }
  const row: StatementRow = {
    id: ++state.seq.statement,
    company_id: companyId,
    year,
    period_type: periodType as StatementRow['period_type'],
    quarter,
    ...emptyFields(kind),
    ...cleanAmounts(kind, body),
  }
  state.statements[kind].push(row)
  return row
}

export function getStatement(kind: Kind, companyId: number, id: number) {
  getCompany(companyId)
  const row = state.statements[kind].find((r) => r.id === id)
  if (!row || row.company_id !== companyId) throw new HttpError(404, `报表 id=${id} 不存在`)
  return row
}

export function updateStatement(kind: Kind, companyId: number, id: number, body: Record<string, unknown>) {
  const row = getStatement(kind, companyId, id)
  const year = 'year' in body ? Number(body.year) : row.year
  const periodType = 'period_type' in body ? String(body.period_type) : row.period_type
  let quarter = 'quarter' in body ? (body.quarter == null ? null : Number(body.quarter)) : row.quarter
  if (periodType === 'annual') quarter = null
  ensurePeriodRules(year, periodType, quarter)
  if (findByPeriod(kind, companyId, year, periodType, quarter, id)) throw new HttpError(409, '目标报告期已存在其他报表')
  Object.assign(row, cleanAmounts(kind, body), { year, period_type: periodType, quarter })
  return row
}

export function deleteStatement(kind: Kind, companyId: number, id: number) {
  getStatement(kind, companyId, id)
  state.statements[kind] = state.statements[kind].filter((r) => r.id !== id)
}

// ---------------------------------------------------------------------------
// 比率（ratio_service.py 逐行移植）
// ---------------------------------------------------------------------------

interface PeriodKey {
  year: number
  period_type: string
  quarter: number | null
}

export function listRatioPeriods(companyId: number) {
  getCompany(companyId)
  const seen = new Map<string, Record<string, unknown>>()
  for (const kind of KINDS) {
    for (const r of listStatements(kind, companyId)) {
      const key = `${r.year}|${r.period_type}|${r.quarter ?? ''}`
      let item = seen.get(key)
      if (!item) {
        item = { year: r.year, period_type: r.period_type, quarter: r.quarter ?? null, has_balance: false, has_income: false, has_cashflow: false }
        seen.set(key, item)
      }
      item[`has_${kind}`] = true
    }
  }
  const periods = [...seen.values()] as (PeriodKey & Record<string, unknown>)[]
  const sortKey = (p: PeriodKey) => [p.year, p.period_type === 'annual' ? 0 : 1, p.quarter ?? 0]
  periods.sort((a, b) => {
    const ka = sortKey(a)
    const kb = sortKey(b)
    for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
    return 0
  })
  return periods
}

function money(row: StatementRow | undefined, field: string): number | null {
  if (!row) return null
  const v = row[field]
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function div(num: number | null, den: number | null): [number | null, string | null] {
  if (num === null || den === null) return [null, 'missing_fields']
  if (den === 0) return [null, 'zero_denominator']
  return [num / den, null]
}

const RATIO_META = Object.fromEntries(meta.RATIO_DEFINITIONS.map((m) => [m.key, m]))

export function computePeriodRatios(companyId: number, year: number, periodType: string, quarter: number | null) {
  getCompany(companyId)
  if (periodType === 'annual') quarter = null
  const match = (kind: Kind) =>
    listStatements(kind, companyId, { year, period_type: periodType }).find((r) => (r.quarter ?? null) === (quarter ?? null))
  const bs = match('balance')
  const inc = match('income')
  const cf = match('cashflow')

  const tca = money(bs, 'total_current_assets')
  const tcl = money(bs, 'total_current_liabilities')
  const inv = money(bs, 'inventories')
  const cash = money(bs, 'monetary_funds')
  const ta = money(bs, 'total_assets')
  const tl = money(bs, 'total_liabilities')
  const te = money(bs, 'total_equity')
  const teP = money(bs, 'total_equity_parent')
  const rev = money(inc, 'operating_revenue')
  const cost = money(inc, 'operating_cost')
  const op = money(inc, 'operating_profit')
  const np = money(inc, 'net_profit')
  const npP = money(inc, 'net_profit_parent')
  const cfo = money(cf, 'net_cash_flow_operating')

  const results: Record<string, unknown>[] = []
  const push = (key: string, value: number | null, formula: string, missing: string[], reason: string | null, extras?: Record<string, unknown>) => {
    const m = RATIO_META[key]
    results.push({
      key,
      name: m.name,
      group: m.group,
      unit: m.unit,
      description: m.description,
      formula,
      value: value === null ? null : Math.round(value * 1e6) / 1e6,
      missing,
      reason,
      ...(extras || {}),
    })
  }
  const need = (pairs: [number | null, string][]) => pairs.filter(([v]) => v === null).map(([, k]) => k)

  let m = need([[tca, 'total_current_assets'], [tcl, 'total_current_liabilities']])
  push('current_ratio', div(tca, tcl)[0], 'total_current_assets / total_current_liabilities', m, div(tca, tcl)[1])

  const quickNum = tca === null ? null : tca - (inv ?? 0)
  m = need([[tca, 'total_current_assets'], [tcl, 'total_current_liabilities']])
  push('quick_ratio', div(quickNum, tcl)[0], '(total_current_assets - inventories) / total_current_liabilities', m, div(quickNum, tcl)[1])

  m = need([[cash, 'monetary_funds'], [tcl, 'total_current_liabilities']])
  push('cash_ratio', div(cash, tcl)[0], 'monetary_funds / total_current_liabilities', m, div(cash, tcl)[1])

  m = need([[tl, 'total_liabilities'], [ta, 'total_assets']])
  push('debt_to_asset', div(tl, ta)[0], 'total_liabilities / total_assets', m, div(tl, ta)[1])

  m = need([[te, 'total_equity'], [ta, 'total_assets']])
  push('equity_ratio', div(te, ta)[0], 'total_equity / total_assets', m, div(te, ta)[1])

  m = need([[tl, 'total_liabilities'], [te, 'total_equity']])
  push('debt_to_equity', div(tl, te)[0], 'total_liabilities / total_equity', m, div(tl, te)[1])

  m = need([[rev, 'operating_revenue'], [cost, 'operating_cost']])
  const gross = rev !== null && cost !== null ? rev - cost : null
  push('gross_margin', div(gross, rev)[0], '(operating_revenue - operating_cost) / operating_revenue', m, div(gross, rev)[1])

  m = need([[op, 'operating_profit'], [rev, 'operating_revenue']])
  push('operating_margin', div(op, rev)[0], 'operating_profit / operating_revenue', m, div(op, rev)[1])

  m = need([[np, 'net_profit'], [rev, 'operating_revenue']])
  push('net_margin', div(np, rev)[0], 'net_profit / operating_revenue', m, div(np, rev)[1])

  let roeNum: number | null
  let roeDen: number | null
  let variant = 'net_profit / total_equity'
  m = []
  if (npP !== null && teP !== null && teP !== 0) {
    roeNum = npP
    roeDen = teP
    variant = 'net_profit_parent / total_equity_parent'
  } else {
    m = need([[np, 'net_profit'], [te, 'total_equity']])
    roeNum = np
    roeDen = te
  }
  push('roe', div(roeNum, roeDen)[0], variant, m, div(roeNum, roeDen)[1], { variant })

  m = need([[np, 'net_profit'], [ta, 'total_assets']])
  push('roa', div(np, ta)[0], 'net_profit / total_assets', m, div(np, ta)[1])

  m = need([[rev, 'operating_revenue'], [ta, 'total_assets']])
  push('asset_turnover', div(rev, ta)[0], 'operating_revenue / total_assets', m, div(rev, ta)[1])

  m = need([[cfo, 'net_cash_flow_operating'], [rev, 'operating_revenue']])
  push('ocfr', div(cfo, rev)[0], 'net_cash_flow_operating / operating_revenue', m, div(cfo, rev)[1])

  const available = results.filter((r) => r.value !== null).length
  return {
    company_id: companyId,
    period: { year, period_type: periodType, quarter },
    sources: {
      balance_sheet_id: bs?.id ?? null,
      income_statement_id: inc?.id ?? null,
      cash_flow_statement_id: cf?.id ?? null,
    },
    ratios: results,
    summary: { total: results.length, available, unavailable: results.length - available },
  }
}

export function computeRatioHistory(companyId: number, periodType: string, keys?: string[]) {
  const periods = listRatioPeriods(companyId).filter((p) => p.period_type === periodType)
  const wanted = keys?.length ? keys : meta.RATIO_DEFINITIONS.map((d) => d.key)
  const series: Record<string, Record<string, unknown>[]> = Object.fromEntries(wanted.map((k) => [k, []]))
  const points: unknown[] = []
  for (const p of periods) {
    const snap = computePeriodRatios(companyId, p.year, p.period_type, p.quarter)
    points.push(snap.period)
    const byKey = Object.fromEntries(snap.ratios.map((r) => [r.key as string, r]))
    for (const k of wanted) {
      const item = byKey[k]
      series[k].push({ ...snap.period, value: item ? item.value : null, reason: item ? item.reason : 'unknown' })
    }
  }
  return {
    company_id: companyId,
    period_type: periodType,
    periods: points,
    series: Object.fromEntries(
      Object.entries(series).map(([k, pts]) => [
        k,
        { key: k, name: RATIO_META[k]?.name ?? k, group: RATIO_META[k]?.group ?? null, unit: RATIO_META[k]?.unit ?? null, points: pts },
      ])
    ),
  }
}

// ---------------------------------------------------------------------------
// 多期对比（compare_service.py 移植）
// ---------------------------------------------------------------------------

const STATEMENT_CONFIG: Record<Kind, { groups: typeof meta.BALANCE_SHEET_GROUPS; base: string | null; baseLabel: string | null }> = {
  balance: { groups: meta.BALANCE_SHEET_GROUPS, base: 'total_assets', baseLabel: '资产总计' },
  income: { groups: meta.INCOME_STATEMENT_GROUPS, base: 'operating_revenue', baseLabel: '营业收入' },
  cashflow: { groups: meta.CASH_FLOW_GROUPS, base: null, baseLabel: null },
}

export function buildCompareMatrix(companyId: number, statementType: string, periodType: string, years: number[] | null) {
  getCompany(companyId)
  if (!(statementType in STATEMENT_CONFIG)) throw new HttpError(422, 'statement_type 须为 balance、income 或 cashflow')
  if (periodType !== 'annual' && periodType !== 'quarterly') throw new HttpError(422, 'period_type 须为 annual 或 quarterly')
  const cfg = STATEMENT_CONFIG[statementType as Kind]
  const yearSet = years ? new Set(years) : null
  const rows = listStatements(statementType as Kind, companyId)
    .filter((r) => r.period_type === periodType && (!yearSet || yearSet.has(r.year)))
    .sort((a, b) => a.year - b.year || (a.quarter ?? 0) - (b.quarter ?? 0))
  const periods = rows.map((r) => ({
    year: r.year,
    period_type: r.period_type,
    quarter: r.quarter ?? null,
    label: r.period_type === 'annual' ? `${r.year} 年报` : `${r.year} Q${r.quarter}`,
    statement_id: r.id,
  }))
  const bases = rows.map((r) => (cfg.base ? money(r, cfg.base) : null))
  const groups = cfg.groups.map((g) => ({
    key: g.key,
    label: g.label,
    rows: g.fields.map((f) => {
      const values = rows.map((r) => money(r, f.key))
      const deltas = values.map((v, i) => (i === 0 || v === null || values[i - 1] === null ? null : v - (values[i - 1] as number)))
      const deltaPcts = values.map((v, i) => {
        const prev = i > 0 ? values[i - 1] : null
        if (i === 0 || v === null || prev === null || prev === 0) return null
        return (v - prev) / Math.abs(prev)
      })
      const structure = values.map((v, i) => (cfg.base && v !== null && bases[i] ? v / (bases[i] as number) : null))
      return { key: f.key, label: f.label, values, deltas, delta_pcts: deltaPcts, structure_pcts: structure }
    }),
  }))
  return {
    company_id: companyId,
    statement_type: statementType,
    period_type: periodType,
    base_field: cfg.base,
    base_label: cfg.baseLabel,
    periods,
    groups,
  }
}

// ---------------------------------------------------------------------------
// 在线拉取（示例公告库）与年报导入任务
// ---------------------------------------------------------------------------

const ALL_FILING_PROFILES: SampleCompanyProfile[] = [...PROFILES, ...FILING_ONLY_PROFILES]
const periodCache = new Map<string, PeriodRecord[]>()
function profilePeriods(p: SampleCompanyProfile) {
  if (!periodCache.has(p.key)) periodCache.set(p.key, buildProfilePeriods(p))
  return periodCache.get(p.key)!
}

function security(p: SampleCompanyProfile) {
  return { code: p.code, name: p.name, org_id: `demo-org-${p.key}`, category: 'A股（示例）', type: 'demo', column: 'demo', industry: p.industry }
}

export function searchSecurities(q: string) {
  const s = q.trim()
  if (!s) throw new HttpError(422, '请提供 q 或 code（代码/名称）')
  const hit = ALL_FILING_PROFILES.filter(
    (p) => p.code.toLowerCase() === s.toLowerCase() || p.name.includes(s) || s.includes(p.name)
  )
  // 示例公告库里没有命中时列出全部示例证券，方便演示继续
  return (hit.length ? hit : ALL_FILING_PROFILES).map(security)
}

function profileByQuery(q: string) {
  const s = q.trim()
  return ALL_FILING_PROFILES.find((p) => p.code === s || p.name === s) || ALL_FILING_PROFILES.find((p) => p.name.includes(s) || s.includes(p.name))
}

export function searchAnnualYears(q: string, years: number[]) {
  const p = profileByQuery(q)
  if (!q.trim()) throw new HttpError(422, '请提供 q 或 code（代码/名称）')
  if (!p) return []
  const annual = new Set(profilePeriods(p).filter((r) => r.period_type === 'annual').map((r) => r.year))
  return [...years]
    .sort((a, b) => b - a)
    .filter((y) => annual.has(y))
    .map((y) => ({
      source: 'cninfo-demo',
      code: p.code,
      name: p.name,
      org_id: `demo-org-${p.key}`,
      year: y,
      title: `${p.name}：${y}年年度报告（示例）`,
      announce_date: `${y + 1}-04-${String(18 + (y % 7)).padStart(2, '0')}`,
      announcement_id: `demo-${p.code}-${y}`,
      adjunct_url: `demo/${p.code}/${y}.pdf`,
      pdf_url: `demo://cninfo/${p.code}/${y}.pdf`,
    }))
}

const UNMAPPED_TEMPLATES: { statement: Kind; label: string; base: 'rev' | 'ta'; ratio: number; reason: string; page: number }[] = [
  { statement: 'balance', label: '应收款项融资', base: 'ta', ratio: 0.011, reason: 'no_alias_match', page: 0 },
  { statement: 'balance', label: '合同资产', base: 'ta', ratio: 0.008, reason: 'no_alias_match', page: 0 },
  { statement: 'balance', label: '一年内到期的非流动资产', base: 'ta', ratio: 0.004, reason: 'ambiguous', page: 0 },
  { statement: 'balance', label: '长期待摊费用', base: 'ta', ratio: 0.003, reason: 'no_alias_match', page: 1 },
  { statement: 'balance', label: '其中：应付利息', base: 'ta', ratio: 0.0006, reason: 'low_score', page: 1 },
  { statement: 'income', label: '营业总成本', base: 'rev', ratio: 0.88, reason: 'skip_total_cost', page: 3 },
  { statement: 'income', label: '其中：利息费用', base: 'rev', ratio: 0.006, reason: 'ambiguous', page: 3 },
  { statement: 'income', label: '（一）持续经营净利润', base: 'rev', ratio: 0.1, reason: 'no_alias_match', page: 4 },
  { statement: 'income', label: '基本每股收益（元/股）', base: 'rev', ratio: 0, reason: 'no_alias_match', page: 4 },
  { statement: 'cashflow', label: '收到其他与投资活动有关的现金', base: 'rev', ratio: 0.009, reason: 'no_alias_match', page: 6 },
  { statement: 'cashflow', label: '汇率变动对现金及现金等价物的影响', base: 'rev', ratio: 0.0012, reason: 'no_alias_match', page: 7 },
  { statement: 'cashflow', label: '期末现金及现金等价物余额', base: 'rev', ratio: 0.19, reason: 'low_score', page: 7 },
]

/** 每个年度的“识别难度”，决定漏识别的科目、问题清单与置信度 */
function mappingPlan(year: number) {
  const r = year % 4
  if (r === 1) {
    return {
      drop: { balance: ['paid_in_capital', 'other_non_current_financial_assets', 'investment_property', 'treasury_stock'], income: ['interest_income', 'net_profit_minority'], cashflow: ['tax_refunds_received'] } as Record<Kind, string[]>,
      unitConfidence: 0.35,
      extractability: 0.91,
      unmappedCount: 12,
    }
  }
  if (r === 3) {
    return {
      drop: { balance: ['other_non_current_financial_assets', 'goodwill'], income: ['interest_income'], cashflow: [] } as Record<Kind, string[]>,
      unitConfidence: 0.92,
      extractability: 0.97,
      unmappedCount: 9,
    }
  }
  return {
    drop: { balance: ['other_non_current_financial_assets'], income: [], cashflow: [] } as Record<Kind, string[]>,
    unitConfidence: 0.95,
    extractability: 0.98,
    unmappedCount: 7,
  }
}

function buildJob(opts: {
  profile: SampleCompanyProfile
  year: number
  sourceType: string
  filename: string
  companyId: number | null
  extraIssues?: string[]
}) {
  const { profile, year } = opts
  const rec = profilePeriods(profile).find((r) => r.year === year && r.period_type === 'annual')
  if (!rec) throw new HttpError(404, `示例公告库中没有 ${profile.name} ${year} 年年报`)
  const plan = mappingPlan(year)
  const pageBase = 88 + (year % 5) * 3
  const statements: Record<string, Record<string, number>> = {}
  const mappedDetail: Record<string, unknown[]> = {}
  const coverage: Record<string, unknown> = {}
  const disclosure: unknown[] = []
  let confSum = 0
  let confN = 0
  let coreHit = 0
  let coreTotal = 0
  for (const kind of KINDS) {
    const data = rec.data[kind]
    if (!data) continue
    const fields: Record<string, number> = {}
    const detail: unknown[] = []
    let line = 0
    for (const [k, v] of Object.entries(data)) {
      if (v === null || plan.drop[kind].includes(k)) continue
      fields[k] = v
      const conf = Math.round((0.86 + ((k.length * 7 + year) % 14) / 100) * 100) / 100
      confSum += conf
      confN += 1
      const label = labelOf(kind, k)
      detail.push({ field: k, amount: v, confidence: conf, source_label: label, source_page: pageBase + kind.length % 3, rule: conf > 0.95 ? 'exact_alias' : 'fuzzy_alias' })
      disclosure.push({ statement: kind, line_no: ++line, label_raw: label, label_norm: label, amount: v, page_no: pageBase, role: 'item', mapped_to: k, map_rule: 'exact_alias', map_confidence: conf, include_in_aggregate: true })
    }
    statements[kind] = fields
    mappedDetail[kind] = detail
    const core = (meta.CORE_FIELDS as Record<string, string[]>)[kind] || []
    const hit = core.filter((f) => f in fields).length
    coreHit += hit
    coreTotal += core.length
    coverage[kind] = { core_total: core.length, core_hit: hit, mapped_fields: Object.keys(fields).length, coverage: core.length ? hit / core.length : 0 }
  }
  const d = profile.years[year]
  const unmapped = UNMAPPED_TEMPLATES.slice(0, plan.unmappedCount).map((u) => ({
    statement: u.statement,
    label: u.label,
    amount: u.ratio
      ? Math.round((u.base === 'rev' ? d.rev : d.ta) * u.ratio * (1 + ((u.label.length * 13 + year) % 9) / 100) * 1e6) * 100 + ((u.label.length * 3137 + year * 71) % 999999) / 100
      : 0.42 + (year % 5) / 10,
    page: pageBase + u.page,
    reason: u.reason,
  }))

  // validate.py：硬条件、软勾稽与置信度
  const issues: string[] = []
  if (coreHit < 6) issues.push(`核心字段命中不足（${coreHit}/${coreTotal}）`)
  if (plan.unitConfidence < 0.4) issues.push('金额单位不确定，请人工确认')
  const coverageRate = coreTotal ? coreHit / coreTotal : 0
  const meanC = confN ? confSum / confN : 0
  const locateScore = 0.94
  const C = Math.max(0, Math.min(1, 0.25 * plan.extractability + 0.25 * locateScore + 0.3 * meanC + 0.2 * coverageRate))
  const fillMode = C >= 0.8 && coverageRate === 1 ? 'AUTO_COMMIT_CANDIDATE' : C >= 0.55 ? 'REVIEW_REQUIRED' : 'REJECT_OR_MANUAL'
  if (opts.extraIssues) issues.push(...opts.extraIssues)

  const t = nowIso()
  const job = {
    id: ++state.seq.job,
    source_type: opts.sourceType,
    original_filename: opts.filename,
    status: 'review',
    company_hint: profile.name,
    company_code_hint: profile.code,
    company_id: opts.companyId,
    report_year: year,
    period_type: 'annual',
    quarter: null,
    accounting_standard: 'CAS',
    unit_scale: 1,
    scope: 'consolidated',
    confidence: Math.round(C * 10000) / 10000,
    fill_mode: fillMode,
    error_message: null,
    coverage,
    issues,
    unmapped,
    disclosure_lines: disclosure,
    draft: {
      statements,
      mapped_detail: mappedDetail,
      disclosure_lines: disclosure,
      company_hint: profile.name,
      company_code_hint: profile.code,
      report_year: year,
      period_type: 'annual',
      quarter: null,
      unit_scale: 1,
      accounting_standard: 'CAS',
      scope: 'consolidated',
      coa_version: meta.COA_VERSION,
      confidence: Math.round(C * 10000) / 10000,
      fill_mode: fillMode,
      issues,
      coverage,
    },
    raw_extract: Object.fromEntries(
      KINDS.map((k, i) => [k, { channel: 'pdfplumber-table（示例）', row_count: Object.keys(statements[k] || {}).length + 6, header_years: [year, year - 1], start_page: pageBase + i * 3 }])
    ),
    commit_result: null,
    created_at: t,
    updated_at: t,
  }
  state.jobs.push(job)
  return job
}

function labelOf(kind: Kind, key: string) {
  const groups = STATEMENT_CONFIG[kind].groups
  for (const g of groups) for (const f of g.fields) if (f.key === key) return f.label
  return key
}

export function downloadCninfo(body: { pdf_url?: string; code?: string; year?: number; name?: string; company_id?: number | null }) {
  const p = ALL_FILING_PROFILES.find((x) => x.code === body.code) || profileByQuery(body.name || '')
  if (!p || !body.year) throw new HttpError(404, '示例公告库中没有该年报')
  return buildJob({ profile: p, year: Number(body.year), sourceType: 'pdf_cninfo', filename: `${p.code}_${body.year}_年度报告（示例）.pdf`, companyId: body.company_id ?? null })
}

function guessFromText(text: string) {
  const years = [...text.matchAll(/(20\d{2})/g)].map((m) => Number(m[1]))
  const p = ALL_FILING_PROFILES.find((x) => text.includes(x.code) || text.includes(x.name)) || FILING_ONLY_PROFILES[0]
  const annual = profilePeriods(p).filter((r) => r.period_type === 'annual').map((r) => r.year)
  const year = years.find((y) => annual.includes(y)) ?? Math.max(...annual)
  return { p, year }
}

export function uploadFiling(file: File | null) {
  if (!file) throw new HttpError(422, '缺少文件')
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new HttpError(400, '一期仅支持 PDF 文件')
  if (file.size > 40 * 1024 * 1024) throw new HttpError(400, '文件过大（>40MB）')
  const { p, year } = guessFromText(file.name)
  return buildJob({
    profile: p,
    year,
    sourceType: 'pdf_upload',
    filename: file.name,
    companyId: null,
    extraIssues: file.name.includes('示例') ? undefined : ['演示模式：未读取上传文件内容，以下为示例年报的识别结果'],
  })
}

export function fetchFromUrl(body: { url?: string; company_id?: number | null }) {
  const url = (body.url || '').trim()
  if (!/^https?:\/\//i.test(url) && !url.startsWith('demo://')) throw new HttpError(422, 'URL 须以 http:// 或 https:// 开头')
  const { p, year } = guessFromText(url)
  const name = decodeURIComponent(url.split('/').pop() || 'filing.pdf')
  return buildJob({
    profile: p,
    year,
    sourceType: 'pdf_url',
    filename: name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`,
    companyId: body.company_id ?? null,
    extraIssues: ['演示模式：未联网下载该链接，以下为示例年报的识别结果'],
  })
}

export function listJobs() {
  return [...state.jobs].sort((a, b) => (b.id as number) - (a.id as number)).slice(0, 50)
}

export function getJob(id: number) {
  const j = state.jobs.find((x) => x.id === id)
  if (!j) throw new HttpError(404, `导入任务 id=${id} 不存在`)
  return j
}

export function updateJob(id: number, body: Record<string, unknown>) {
  const job = getJob(id) as Record<string, any>
  if (job.status === 'committed') throw new HttpError(400, '任务已入库，不能修改')
  if (body.company_id != null) {
    getCompany(Number(body.company_id))
    job.company_id = Number(body.company_id)
  }
  if (body.company_hint != null) job.company_hint = body.company_hint
  if (body.company_code_hint != null) job.company_code_hint = body.company_code_hint
  if (body.report_year != null) job.report_year = Number(body.report_year)
  if (body.period_type != null) job.period_type = body.period_type
  if (body.quarter != null || body.period_type === 'annual') job.quarter = body.period_type === 'annual' ? null : body.quarter
  if (body.statements != null) {
    const clean: Record<string, Record<string, number>> = {}
    for (const [kind, fields] of Object.entries(body.statements as Record<string, Record<string, unknown>>)) {
      clean[kind] = {}
      for (const [k, v] of Object.entries(fields || {})) if (v !== null && v !== undefined) clean[kind][k] = Number(v)
    }
    job.draft = { ...job.draft, statements: clean, report_year: job.report_year, period_type: job.period_type, quarter: job.quarter }
  }
  job.updated_at = nowIso()
  return job
}

export function commitJob(id: number, body: { company_id?: number | null; overwrite?: boolean }) {
  const job = getJob(id) as Record<string, any>
  if (job.status === 'committed') return job
  const statements = (job.draft?.statements || {}) as Record<string, Record<string, number>>
  const year = job.report_year || job.draft?.report_year
  const periodType = job.period_type || 'annual'
  const quarter = periodType === 'annual' ? null : job.quarter
  if (!year) throw new HttpError(400, '缺少报告年份，请先在预览中设置')
  const overwrite = body.overwrite !== false
  let cid: number | null = body.company_id ?? job.company_id ?? null
  if (cid == null) {
    const name = job.company_hint || String(job.original_filename).replace(/\.pdf$/i, '')
    const existing = state.companies.find((c) => c.name === name || (job.company_code_hint && c.code === job.company_code_hint))
    cid = existing ? existing.id : createCompany({ name, code: job.company_code_hint, industry: ALL_FILING_PROFILES.find((p) => p.code === job.company_code_hint)?.industry ?? null }).id
  } else getCompany(cid)
  job.company_id = cid
  const ids: Record<string, number> = {}
  for (const kind of KINDS) {
    if (!(kind in statements)) continue
    const fields = cleanAmounts(kind, statements[kind])
    const existed = findByPeriod(kind, cid, Number(year), periodType, quarter)
    if (!existed) {
      ids[kind] = createStatement(kind, cid, { year: Number(year), period_type: periodType, quarter, ...fields }).id
    } else {
      ids[kind] = existed.id
      if (overwrite) Object.assign(existed, fields)
    }
  }
  job.status = 'committed'
  job.commit_result = { statement_ids: ids, company_id: cid, disclosure_lines_written: (job.draft?.disclosure_lines || []).length, coa_version: meta.COA_VERSION }
  job.error_message = null
  job.updated_at = nowIso()
  return job
}

export function deleteJob(id: number) {
  getJob(id)
  state.jobs = state.jobs.filter((j) => j.id !== id)
}

// ---------------------------------------------------------------------------
// Excel 模板导入（excel_import_service.py 的预览 / 入库语义；文件内容在演示中不解析）
// ---------------------------------------------------------------------------

function excelDataset(companyId: number): PeriodRecord[] {
  const c = getCompany(companyId)
  const p = ALL_FILING_PROFILES.find((x) => x.code === c.code)
  if (p) return profilePeriods(p).filter((r) => r.period_type === 'annual').slice(-3)
  // 用户在演示里新建的企业：按示例公司D的结构生成一套示例数值
  const base = FILING_ONLY_PROFILES[0]
  const scale = 0.6 + (companyId % 5) * 0.2
  const scaled: SampleCompanyProfile = {
    ...base,
    key: `U${companyId}`,
    seed: 900 + companyId,
    paidIn: base.paidIn * scale,
    capitalReserve: base.capitalReserve * scale,
    years: Object.fromEntries(
      Object.entries(base.years).slice(-3).map(([y, d]) => [y, Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v * scale]))])
    ) as SampleCompanyProfile['years'],
  }
  return buildProfilePeriods(scaled)
}

function checkExcelFile(file: File | null) {
  if (!file || !file.size) throw new HttpError(422, '空文件')
  if (!/\.xlsx$/i.test(file.name)) throw new HttpError(422, '请上传 .xlsx 文件（演示版同样只接受 .xlsx）')
}

export function previewExcel(companyId: number, file: File | null) {
  checkExcelFile(file)
  getCompany(companyId)
  const recs = excelDataset(companyId)
  const periods = recs.map((r) => ({ year: r.year, period_type: 'annual', quarter: null, label: `${r.year} 年报` }))
  const willCreate: string[] = []
  const willUpdate: string[] = []
  const sheets = KINDS.map((kind) => {
    for (const r of recs) {
      const tag = `${KIND_LABEL[kind]}/${r.year} 年报`
      ;(findByPeriod(kind, companyId, r.year, 'annual', null) ? willUpdate : willCreate).push(tag)
    }
    return {
      statement_type: kind,
      label: KIND_LABEL[kind],
      periods,
      non_null_fields: recs.reduce((s, r) => s + Object.values(r.data[kind] || {}).filter((v) => v !== null).length, 0),
      rows_with_code: FIELD_KEYS[kind].length,
    }
  })
  return {
    company_id: companyId,
    period_type: 'annual',
    periods,
    sheets,
    warnings: ['演示模式：未读取上传文件内容，按示例数据生成预览', '忽略未知工作表：财务比率'],
    will_create: willCreate,
    will_update: willUpdate,
    will_skip_empty: [],
  }
}

export function commitExcel(companyId: number, file: File | null, overwrite: boolean) {
  checkExcelFile(file)
  getCompany(companyId)
  const created: string[] = []
  const updated: string[] = []
  const skipped: string[] = []
  const ids: Record<string, number> = {}
  for (const r of excelDataset(companyId)) {
    for (const kind of KINDS) {
      const fields = r.data[kind]
      const tag = `${KIND_LABEL[kind]}/${r.year} 年报`
      if (!fields) {
        skipped.push(tag + '（空）')
        continue
      }
      const existed = findByPeriod(kind, companyId, r.year, 'annual', null)
      if (!existed) {
        ids[tag] = createStatement(kind, companyId, { year: r.year, period_type: 'annual', quarter: null, ...fields }).id
        created.push(tag)
      } else if (!overwrite) {
        skipped.push(tag + '（已存在，overwrite=false）')
      } else {
        Object.assign(existed, fields)
        ids[tag] = existed.id
        updated.push(tag)
      }
    }
  }
  return { company_id: companyId, created, updated, skipped, warnings: ['演示模式：未读取上传文件内容，按示例数据入库'], statement_ids: ids }
}

// ---------------------------------------------------------------------------
// 导出（演示版生成 CSV，真实系统生成 .xlsx 工作簿）
// ---------------------------------------------------------------------------

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCsv(companyId: number | null, periodType: string, years: number[] | null) {
  const lines: string[] = []
  lines.push(csvCell('说明') + ',' + csvCell('演示版导出：全部数据为虚构示例；真实系统导出 .xlsx 工作簿（说明 + 三表 + 财务比率）'))
  if (companyId == null) {
    // 空模板
    const ys = years?.length ? years : [2023, 2024, 2025]
    for (const kind of KINDS) {
      lines.push('')
      lines.push([KIND_LABEL[kind], ...ys.map((y) => `${y} ${periodType === 'annual' ? '年报' : 'Q4'}`)].map(csvCell).join(','))
      lines.push(['科目代码', '科目名称'].map(csvCell).join(','))
      for (const g of STATEMENT_CONFIG[kind].groups) for (const f of g.fields) lines.push([f.key, f.label].map(csvCell).join(','))
    }
  } else {
    const c = getCompany(companyId)
    lines.push(csvCell('企业') + ',' + csvCell(c.name))
    for (const kind of KINDS) {
      const m = buildCompareMatrix(companyId, kind, periodType, years)
      lines.push('')
      lines.push([KIND_LABEL[kind], '', ...m.periods.map((p) => p.label)].map(csvCell).join(','))
      lines.push(['科目代码', '科目名称', ...m.periods.map(() => '金额（元）')].map(csvCell).join(','))
      for (const g of m.groups) for (const r of g.rows) lines.push([r.key, r.label, ...r.values].map(csvCell).join(','))
    }
    const periods = listRatioPeriods(companyId).filter((p) => p.period_type === periodType && (!years || years.includes(p.year)))
    lines.push('')
    lines.push(['财务比率', '', ...periods.map((p) => (p.period_type === 'annual' ? `${p.year} 年报` : `${p.year} Q${p.quarter}`))].map(csvCell).join(','))
    const snaps = periods.map((p) => computePeriodRatios(companyId, p.year, p.period_type, p.quarter))
    for (const d of meta.RATIO_DEFINITIONS) {
      lines.push([d.key, d.name, ...snaps.map((s) => s.ratios.find((r) => r.key === d.key)?.value ?? '')].map(csvCell).join(','))
    }
  }
  return '﻿' + lines.join('\r\n')
}

export function companyName(id: number) {
  return getCompany(id).name
}

seed()
