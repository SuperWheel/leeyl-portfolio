/**
 * 演示用示例数据（全部虚构，非任何真实公司财报）。
 *
 * 每个“示例公司”只给出少量驱动值（单位：亿元），再按固定比例 + 确定性抖动
 * 展开为 cas-simplified-v2 全部科目，并保证：
 *   资产总计 = 负债合计 + 所有者权益合计；各小计 = 明细之和；
 *   营业利润 / 利润总额 / 净利润 逐级勾稽；现金流三项净额之和 = 现金净增加额。
 * 示例公司A 的驱动值与作品集项目页原型保持一致。
 */
import meta from './backendMeta.json'

export type Kind = 'balance' | 'income' | 'cashflow'
export type Fields = Record<string, number | null>

export interface Drivers {
  rev: number
  cost: number
  op: number
  ni: number
  nip: number
  ca: number
  inv: number
  cash: number
  cl: number
  tl: number
  ta: number
  te: number
  tep: number
  ocf: number
}

export interface SampleCompanyProfile {
  key: string
  name: string
  code: string
  industry: string
  /** 股本（亿元，常量） */
  paidIn: number
  capitalReserve: number
  seed: number
  years: Record<number, Drivers>
  /** 需要生成季报（年初至今累计）的年份 */
  quarterlyYears?: number[]
  /** 故意留空的科目，展示“完整度 < 13/13”的效果 */
  omit?: Partial<Record<number, Partial<Record<Kind, string[] | 'all'>>>>
}

const YI = 1e8

export const FIELD_KEYS: Record<Kind, string[]> = {
  balance: meta.BALANCE_SHEET_GROUPS.flatMap((g) => g.fields.map((f) => f.key)),
  income: meta.INCOME_STATEMENT_GROUPS.flatMap((g) => g.fields.map((f) => f.key)),
  cashflow: meta.CASH_FLOW_GROUPS.flatMap((g) => g.fields.map((f) => f.key)),
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 按权重把 total 拆成若干份（最后一项为补差），权重带 ±jit 抖动 */
function split(total: number, weights: Record<string, number>, rnd: () => number, jit = 0.12) {
  const keys = Object.keys(weights)
  const w = keys.map((k) => weights[k] * (1 + (rnd() * 2 - 1) * jit))
  const sum = w.reduce((s, x) => s + x, 0)
  const out: Record<string, number> = {}
  let acc = 0
  keys.forEach((k, i) => {
    if (i === keys.length - 1) {
      out[k] = total - acc
    } else {
      const v = (total * w[i]) / sum
      out[k] = v
      acc += v
    }
  })
  return out
}

function cents(yuan: number, rnd: () => number): number {
  // 加上随机“零头”，金额看起来像真实报表；保留 2 位小数
  const v = Math.round(yuan / 1000) * 1000 + Math.floor(rnd() * 99999) / 100
  return Math.round(v * 100) / 100
}

function toYuan(obj: Record<string, number>, rnd: () => number): Fields {
  const out: Fields = {}
  for (const [k, v] of Object.entries(obj)) out[k] = cents(v * YI, rnd)
  return out
}

/** 合计 = 明细之和（在“元”层面重新求和，避免零头导致不平） */
function sumOf(f: Fields, keys: string[], signs?: Record<string, number>): number {
  let s = 0
  for (const k of keys) s += (f[k] ?? 0) * (signs?.[k] ?? 1)
  return Math.round(s * 100) / 100
}

export interface PeriodStatements {
  balance: Fields
  income: Fields
  cashflow: Fields
}

/**
 * 由驱动值展开三张表。prevCash 用于让现金净增加额与货币资金变动对齐。
 * flowScale：季报年初至今累计时 < 1。
 */
export function expandDrivers(
  p: SampleCompanyProfile,
  d: Drivers,
  prevCash: number | null,
  seed: number
): PeriodStatements {
  const rnd = mulberry32(seed)

  // ---------------- 资产负债表 ----------------
  const caRest = split(
    d.ca - d.cash - d.inv,
    {
      trading_financial_assets: 0.17,
      notes_receivable: 0.06,
      accounts_receivable: 0.47,
      prepayments: 0.06,
      other_receivables: 0.05,
      other_current_assets: 0.19,
    },
    rnd
  )
  const nca = split(
    d.ta - d.ca,
    {
      long_term_equity_investments: 0.07,
      other_equity_instruments_investment: 0.03,
      other_non_current_financial_assets: 0.02,
      investment_property: 0.012,
      fixed_assets: 0.42,
      construction_in_progress: 0.08,
      right_of_use_assets: 0.04,
      intangible_assets: 0.12,
      goodwill: 0.05,
      deferred_tax_assets: 0.05,
      other_non_current_assets: 0.06,
    },
    rnd
  )
  const clp = split(
    d.cl,
    {
      short_term_borrowings: 0.12,
      notes_payable: 0.14,
      accounts_payable: 0.36,
      contract_liabilities: 0.09,
      employee_benefits_payable: 0.07,
      taxes_payable: 0.04,
      other_payables: 0.07,
      non_current_liab_due_one_year: 0.05,
      other_current_liabilities: 0.06,
    },
    rnd
  )
  const nclp = split(
    d.tl - d.cl,
    {
      long_term_borrowings: 0.45,
      bonds_payable: 0.15,
      lease_liabilities: 0.1,
      deferred_income: 0.12,
      deferred_tax_liabilities: 0.06,
      other_non_current_liabilities: 0.12,
    },
    rnd
  )
  const minority = d.te - d.tep
  const treasury = p.paidIn * 0.04
  const oci = d.tep * 0.008 * (0.6 + rnd() * 0.8)
  const surplus = p.paidIn * 0.5
  const retained = d.tep - p.paidIn - p.capitalReserve + treasury - oci - surplus

  const bs = toYuan(
    {
      monetary_funds: d.cash,
      ...caRest,
      inventories: d.inv,
      ...nca,
      ...clp,
      ...nclp,
      paid_in_capital: p.paidIn,
      capital_reserve: p.capitalReserve,
      treasury_stock: treasury,
      other_comprehensive_income_equity: oci,
      surplus_reserve: surplus,
      retained_earnings: retained,
      minority_interest: minority,
    },
    rnd
  )
  bs.paid_in_capital = Math.round(p.paidIn * YI)
  const caKeys = [
    'monetary_funds',
    'trading_financial_assets',
    'notes_receivable',
    'accounts_receivable',
    'prepayments',
    'other_receivables',
    'inventories',
    'other_current_assets',
  ]
  const ncaKeys = Object.keys(nca)
  bs.total_current_assets = sumOf(bs, caKeys)
  bs.total_non_current_assets = sumOf(bs, ncaKeys)
  bs.total_assets = sumOf(bs, ['total_current_assets', 'total_non_current_assets'])
  bs.total_current_liabilities = sumOf(bs, Object.keys(clp))
  bs.total_non_current_liabilities = sumOf(bs, Object.keys(nclp))
  bs.total_liabilities = sumOf(bs, ['total_current_liabilities', 'total_non_current_liabilities'])
  // 权益合计按“资产 − 负债”倒挤，未分配利润做补差，保证勾稽平衡
  bs.total_equity = Math.round((bs.total_assets - bs.total_liabilities) * 100) / 100
  bs.total_equity_parent = Math.round(((bs.total_equity ?? 0) - (bs.minority_interest ?? 0)) * 100) / 100
  bs.retained_earnings =
    Math.round(
      ((bs.total_equity_parent ?? 0) -
        sumOf(bs, ['paid_in_capital', 'capital_reserve', 'other_comprehensive_income_equity', 'surplus_reserve']) +
        (bs.treasury_stock ?? 0)) *
        100
    ) / 100

  // ---------------- 利润表 ----------------
  const r = d.rev
  const j = (x: number) => x * (1 + (rnd() * 2 - 1) * 0.1)
  const inc: Record<string, number> = {
    operating_revenue: r,
    operating_cost: d.cost,
    taxes_and_surcharges: j(0.0085 * r),
    admin_expenses: j(0.048 * r),
    rd_expenses: j(0.058 * r),
    financial_expenses: j(0.004 * r),
    interest_income: j(0.0032 * r),
    other_income: j(0.011 * r),
    investment_income: j(0.006 * r),
    fair_value_change_income: j(0.0018 * r) * (rnd() > 0.3 ? 1 : -1),
    credit_impairment_loss: -j(0.0032 * r),
    asset_impairment_loss: -j(0.0041 * r),
    asset_disposal_income: j(0.0004 * r),
  }
  // 销售费用倒挤，使营业利润 = 驱动值
  inc.selling_expenses =
    r -
    d.cost -
    inc.taxes_and_surcharges -
    inc.admin_expenses -
    inc.rd_expenses -
    inc.financial_expenses +
    inc.other_income +
    inc.investment_income +
    inc.fair_value_change_income +
    inc.credit_impairment_loss +
    inc.asset_impairment_loss +
    inc.asset_disposal_income -
    d.op
  inc.non_operating_income = j(0.0016 * r)
  inc.non_operating_expense = j(0.0011 * r)
  inc.other_comprehensive_income = j(0.0012 * r) * (rnd() > 0.4 ? 1 : -1)
  const is = toYuan(inc, rnd)
  is.operating_profit = sumOf(
    is,
    [
      'operating_revenue',
      'operating_cost',
      'taxes_and_surcharges',
      'selling_expenses',
      'admin_expenses',
      'rd_expenses',
      'financial_expenses',
      'other_income',
      'investment_income',
      'fair_value_change_income',
      'credit_impairment_loss',
      'asset_impairment_loss',
      'asset_disposal_income',
    ],
    {
      operating_cost: -1,
      taxes_and_surcharges: -1,
      selling_expenses: -1,
      admin_expenses: -1,
      rd_expenses: -1,
      financial_expenses: -1,
    }
  )
  is.total_profit = sumOf(is, ['operating_profit', 'non_operating_income', 'non_operating_expense'], {
    non_operating_expense: -1,
  })
  is.net_profit = cents(d.ni * YI, rnd)
  is.income_tax_expense = Math.round(((is.total_profit ?? 0) - is.net_profit) * 100) / 100
  is.net_profit_parent = cents(d.nip * YI, rnd)
  is.net_profit_minority = Math.round((is.net_profit - is.net_profit_parent) * 100) / 100
  is.total_comprehensive_income = sumOf(is, ['net_profit', 'other_comprehensive_income'])

  // ---------------- 现金流量表 ----------------
  const cfo: Record<string, number> = {
    cash_from_sales: j(1.06 * r),
    tax_refunds_received: j(0.009 * r),
    other_cash_received_operating: j(0.012 * r),
    cash_paid_for_goods: j(0.9 * d.cost),
    cash_paid_to_employees: j(0.088 * r),
    taxes_paid: j(0.036 * r),
  }
  cfo.other_cash_paid_operating =
    cfo.cash_from_sales +
    cfo.tax_refunds_received +
    cfo.other_cash_received_operating -
    cfo.cash_paid_for_goods -
    cfo.cash_paid_to_employees -
    cfo.taxes_paid -
    d.ocf
  const netInv = -j(0.062 * r)
  const cfi: Record<string, number> = {
    cash_from_investments: j(0.15 * r),
    cash_from_investment_income: j(0.004 * r),
    cash_from_asset_disposal: j(0.0012 * r),
    cash_paid_for_assets: j(0.071 * r),
  }
  cfi.cash_paid_for_investments =
    cfi.cash_from_investments + cfi.cash_from_investment_income + cfi.cash_from_asset_disposal - cfi.cash_paid_for_assets - netInv
  const netIncrease = prevCash == null ? j(0.02 * r) : d.cash - prevCash
  const netFin = netIncrease - d.ocf - netInv
  const cff: Record<string, number> = {
    cash_from_financing: j(0.1 * r),
    cash_paid_for_debt: j(0.075 * r),
  }
  cff.cash_paid_for_dividends = cff.cash_from_financing - cff.cash_paid_for_debt - netFin
  if (cff.cash_paid_for_dividends < 0) {
    cff.cash_from_financing -= cff.cash_paid_for_dividends - j(0.01 * r)
    cff.cash_paid_for_dividends = cff.cash_from_financing - cff.cash_paid_for_debt - netFin
  }
  const cf = toYuan({ ...cfo, ...cfi, ...cff }, rnd)
  cf.net_cash_flow_operating = sumOf(
    cf,
    [
      'cash_from_sales',
      'tax_refunds_received',
      'other_cash_received_operating',
      'cash_paid_for_goods',
      'cash_paid_to_employees',
      'taxes_paid',
      'other_cash_paid_operating',
    ],
    { cash_paid_for_goods: -1, cash_paid_to_employees: -1, taxes_paid: -1, other_cash_paid_operating: -1 }
  )
  cf.net_cash_flow_investing = sumOf(
    cf,
    [
      'cash_from_investments',
      'cash_from_investment_income',
      'cash_from_asset_disposal',
      'cash_paid_for_assets',
      'cash_paid_for_investments',
    ],
    { cash_paid_for_assets: -1, cash_paid_for_investments: -1 }
  )
  cf.net_cash_flow_financing = sumOf(cf, ['cash_from_financing', 'cash_paid_for_debt', 'cash_paid_for_dividends'], {
    cash_paid_for_debt: -1,
    cash_paid_for_dividends: -1,
  })
  cf.net_increase_in_cash = sumOf(cf, ['net_cash_flow_operating', 'net_cash_flow_investing', 'net_cash_flow_financing'])

  const order = (kind: Kind, src: Fields): Fields => {
    const out: Fields = {}
    for (const k of FIELD_KEYS[kind]) out[k] = src[k] ?? null
    return out
  }
  return { balance: order('balance', bs), income: order('income', is), cashflow: order('cashflow', cf) }
}

// ---------------------------------------------------------------------------
// 示例公司（虚构）
// ---------------------------------------------------------------------------

export const PROFILES: SampleCompanyProfile[] = [
  {
    key: 'A',
    name: '示例公司A',
    code: 'EXA001',
    industry: '智能制造（示例）',
    paidIn: 5.8,
    capitalReserve: 21.5,
    seed: 101,
    years: {
      2022: { rev: 80, cost: 50, op: 9.0, ni: 7.2, nip: 6.8, ca: 60, inv: 14, cash: 22, cl: 36, tl: 55, ta: 120, te: 65, tep: 60, ocf: 9.6 },
      2023: { rev: 92, cost: 56, op: 11.0, ni: 8.8, nip: 8.3, ca: 66, inv: 15, cash: 25, cl: 38, tl: 58, ta: 132, te: 74, tep: 68, ocf: 12.0 },
      2024: { rev: 101, cost: 60, op: 12.6, ni: 10.1, nip: 9.5, ca: 70, inv: 17, cash: 24, cl: 42, tl: 66, ta: 145, te: 79, tep: 73, ocf: 11.2 },
      2025: { rev: 115, cost: 67, op: 15.2, ni: 12.3, nip: 11.6, ca: 78, inv: 24, cash: 20, cl: 44, tl: 70, ta: 158, te: 88, tep: 81, ocf: 15.5 },
    },
  },
  {
    key: 'B',
    name: '示例公司B',
    code: 'EXB002',
    industry: '消费品（示例）',
    paidIn: 12.6,
    capitalReserve: 8.3,
    seed: 202,
    quarterlyYears: [2024, 2025],
    years: {
      2021: { rev: 210, cost: 92, op: 52, ni: 40.5, nip: 39.8, ca: 260, inv: 48, cash: 150, cl: 92, tl: 108, ta: 360, te: 252, tep: 246, ocf: 51 },
      2022: { rev: 228, cost: 101, op: 56, ni: 43.2, nip: 42.4, ca: 282, inv: 52, cash: 162, cl: 98, tl: 115, ta: 391, te: 276, tep: 269, ocf: 49 },
      2023: { rev: 241, cost: 109, op: 57.5, ni: 44.6, nip: 43.7, ca: 300, inv: 58, cash: 171, cl: 104, tl: 121, ta: 418, te: 297, tep: 289, ocf: 55 },
      2024: { rev: 236, cost: 110, op: 51.3, ni: 39.9, nip: 39.0, ca: 306, inv: 66, cash: 160, cl: 101, tl: 118, ta: 428, te: 310, tep: 301, ocf: 44 },
      2025: { rev: 249, cost: 114, op: 55.8, ni: 43.0, nip: 42.1, ca: 321, inv: 63, cash: 176, cl: 106, tl: 124, ta: 449, te: 325, tep: 316, ocf: 53 },
    },
  },
  {
    key: 'C',
    name: '示例公司C',
    code: 'EXC003',
    industry: '新能源（示例）',
    paidIn: 3.2,
    capitalReserve: 30.1,
    seed: 303,
    years: {
      2023: { rev: 46, cost: 37.5, op: 1.9, ni: 1.5, nip: 1.6, ca: 58, inv: 19, cash: 14, cl: 41, tl: 62, ta: 96, te: 34, tep: 33, ocf: -2.4 },
      2024: { rev: 61, cost: 49.2, op: 3.1, ni: 2.6, nip: 2.6, ca: 71, inv: 24, cash: 12, cl: 52, tl: 79, ta: 117, te: 38, tep: 36.5, ocf: 1.8 },
      2025: { rev: 74, cost: 58.9, op: 4.6, ni: 3.7, nip: 3.6, ca: 80, inv: 27, cash: 13, cl: 60, tl: 88, ta: 130, te: 42, tep: 40.2, ocf: 4.9 },
    },
    // 2023 年只录了资产负债表与利润表，展示“完整度 12/13”
    omit: { 2023: { cashflow: 'all' } },
  },
]

/** 只出现在“在线拉取”示例公告库里、尚未入库的示例公司 */
export const FILING_ONLY_PROFILES: SampleCompanyProfile[] = [
  {
    key: 'D',
    name: '示例公司D',
    code: 'EXD004',
    industry: '电子元件（示例）',
    paidIn: 4.1,
    capitalReserve: 15.7,
    seed: 404,
    years: {
      2021: { rev: 33, cost: 24.1, op: 3.0, ni: 2.6, nip: 2.5, ca: 30, inv: 8, cash: 9.5, cl: 17, tl: 24, ta: 55, te: 31, tep: 30, ocf: 3.4 },
      2022: { rev: 38, cost: 27.6, op: 3.6, ni: 3.1, nip: 3.0, ca: 34, inv: 9.4, cash: 10.2, cl: 19, tl: 27, ta: 61, te: 34, tep: 33, ocf: 4.1 },
      2023: { rev: 36, cost: 27.0, op: 2.4, ni: 2.1, nip: 2.0, ca: 33, inv: 10.6, cash: 8.1, cl: 19.5, tl: 28, ta: 63, te: 35, tep: 34, ocf: 2.2 },
      2024: { rev: 42, cost: 30.4, op: 3.9, ni: 3.3, nip: 3.2, ca: 38, inv: 11.2, cash: 10.9, cl: 21, tl: 30, ta: 69, te: 39, tep: 38, ocf: 4.8 },
      2025: { rev: 47, cost: 33.5, op: 4.6, ni: 3.9, nip: 3.8, ca: 42, inv: 12.0, cash: 12.5, cl: 23, tl: 33, ta: 76, te: 43, tep: 41.8, ocf: 5.6 },
    },
  },
]

/** 驱动值确定性微调（±amp），让金额不呈整数亿；保持 资产 = 负债 + 权益 */
function jitterDrivers(d: Drivers, seed: number, amp = 0.012): Drivers {
  const rnd = mulberry32(seed)
  const j = (x: number) => x * (1 + (rnd() * 2 - 1) * amp)
  const ta = j(d.ta)
  const tl = j(d.tl)
  const te = ta - tl
  const minority = (d.te - d.tep) * (1 + (rnd() * 2 - 1) * 0.05)
  const rev = j(d.rev)
  return {
    rev,
    cost: d.cost * (rev / d.rev) * (1 + (rnd() * 2 - 1) * amp * 0.6),
    op: j(d.op),
    ni: j(d.ni),
    nip: 0,
    ca: j(d.ca),
    inv: j(d.inv),
    cash: j(d.cash),
    cl: j(d.cl),
    tl,
    ta,
    te,
    tep: te - minority,
    ocf: j(d.ocf),
  }
}

function withParent(j: Drivers, d: Drivers): Drivers {
  return { ...j, nip: j.ni * (d.nip / d.ni) }
}

function lerpDrivers(a: Drivers, b: Drivers, t: number, flowShare: number): Drivers {
  const l = (x: number, y: number) => x + (y - x) * t
  return {
    rev: b.rev * flowShare,
    cost: b.cost * flowShare,
    op: b.op * flowShare,
    ni: b.ni * flowShare,
    nip: b.nip * flowShare,
    ocf: b.ocf * flowShare * 0.8,
    ca: l(a.ca, b.ca),
    inv: l(a.inv, b.inv),
    cash: l(a.cash, b.cash),
    cl: l(a.cl, b.cl),
    tl: l(a.tl, b.tl),
    ta: l(a.ta, b.ta),
    te: l(a.te, b.te),
    tep: l(a.tep, b.tep),
  }
}

export interface PeriodRecord {
  year: number
  period_type: 'annual' | 'quarterly'
  quarter: number | null
  data: PeriodStatements
}

/** 展开一家示例公司的全部报告期 */
export function buildProfilePeriods(p: SampleCompanyProfile): PeriodRecord[] {
  const out: PeriodRecord[] = []
  const years = Object.keys(p.years)
    .map(Number)
    .sort((a, b) => a - b)
  let prevCash: number | null = null
  for (const y of years) {
    const d = withParent(jitterDrivers(p.years[y], p.seed * 7 + y), p.years[y])
    const data = expandDrivers(p, d, prevCash, p.seed * 10000 + y)
    const omit = p.omit?.[y]
    if (omit) {
      for (const [kind, keys] of Object.entries(omit) as [Kind, string[] | 'all'][]) {
        if (keys === 'all') (data as Partial<PeriodStatements>)[kind] = undefined as never
        else for (const k of keys) data[kind][k] = null
      }
    }
    out.push({ year: y, period_type: 'annual', quarter: null, data })
    prevCash = d.cash
  }
  for (const y of p.quarterlyYears ?? []) {
    const prev = p.years[y - 1]
    const cur = p.years[y]
    if (!prev || !cur) continue
    const shares = [0.22, 0.47, 0.73]
    shares.forEach((share, i) => {
      const q = i + 1
      const base = lerpDrivers(prev, cur, q / 4, share)
      const d = withParent(jitterDrivers(base, p.seed * 7 + y * 10 + q, 0.025), base)
      const data = expandDrivers(p, d, prev.cash, p.seed * 10000 + y * 10 + q)
      out.push({ year: y, period_type: 'quarterly', quarter: q, data })
    })
  }
  return out
}

export const SAMPLE_NOTICE = '演示模式 · 全部企业与金额均为虚构示例数据'
