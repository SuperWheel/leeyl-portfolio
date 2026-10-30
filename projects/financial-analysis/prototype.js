// 财务分析系统 · 交互原型（示意）
// 按项目 README 中的真实界面截图与前端源码（Vue3 + Element Plus + ECharts）还原「比率分析」与「年报导入」两页。
// 不连接真实功能；“示例公司A”的全部报表数字、映射统计均为虚构示例。
// 比率口径、视图配置、信号阈值、变动语义和界面文案取自项目源码。
(function () {
  'use strict';

  var app = document.getElementById('fa-app');
  if (!app) return;

  var motion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(motion && motion.matches); }

  /* ---------------- 示例数据（虚构，单位：亿元） ---------------- */
  var YEARS = [2022, 2023, 2024, 2025];
  var CUR = 2025;
  var PREV = 2024;
  var FS = {
    2022: { rev: 80, cost: 50, op: 9.0, ni: 7.2, nip: 6.8, ca: 60, inv: 14, cash: 22, cl: 36, tl: 55, ta: 120, te: 65, tep: 60, ocf: 9.6 },
    2023: { rev: 92, cost: 56, op: 11.0, ni: 8.8, nip: 8.3, ca: 66, inv: 15, cash: 25, cl: 38, tl: 58, ta: 132, te: 74, tep: 68, ocf: 12.0 },
    2024: { rev: 101, cost: 60, op: 12.6, ni: 10.1, nip: 9.5, ca: 70, inv: 17, cash: 24, cl: 42, tl: 66, ta: 145, te: 79, tep: 73, ocf: 11.2 },
    2025: { rev: 115, cost: 67, op: 15.2, ni: 12.3, nip: 11.6, ca: 78, inv: 24, cash: 20, cl: 44, tl: 70, ta: 158, te: 88, tep: 81, ocf: 15.5 }
  };

  /* ---------------- 13 项比率：名称、分组、口径与阈值（来自源码） ---------------- */
  function div(a, b) { return (a == null || b == null || Math.abs(b) < 1e-12) ? null : a / b; }
  var RATIOS = [
    { key: 'current_ratio', name: '流动比率', group: '偿债能力', unit: 'ratio', desc: '流动资产合计 / 流动负债合计',
      rule: { prefer: 'higher', good: 1.5, risk: 1.0 }, calc: function (f) { return div(f.ca, f.cl); } },
    { key: 'quick_ratio', name: '速动比率', group: '偿债能力', unit: 'ratio', desc: '(流动资产合计 − 存货) / 流动负债合计',
      rule: { prefer: 'higher', good: 1.0, risk: 0.8 }, calc: function (f) { return div(f.ca - f.inv, f.cl); } },
    { key: 'cash_ratio', name: '现金比率', group: '偿债能力', unit: 'ratio', desc: '货币资金 / 流动负债合计',
      rule: { prefer: 'higher', good: 0.5, risk: 0.2 }, calc: function (f) { return div(f.cash, f.cl); } },
    { key: 'debt_to_asset', name: '资产负债率', group: '偿债能力', unit: 'percent', desc: '负债合计 / 资产总计',
      rule: { prefer: 'band', band: [0.2, 0.65], risk: 0.75 }, calc: function (f) { return div(f.tl, f.ta); } },
    { key: 'equity_ratio', name: '权益比率', group: '偿债能力', unit: 'percent', desc: '所有者权益合计 / 资产总计',
      rule: { prefer: 'band', band: [0.25, 0.8] }, calc: function (f) { return div(f.te, f.ta); } },
    { key: 'debt_to_equity', name: '产权比率', group: '偿债能力', unit: 'ratio', desc: '负债合计 / 所有者权益合计',
      rule: { prefer: 'lower', good: 1.0, risk: 2.0 }, calc: function (f) { return div(f.tl, f.te); } },
    { key: 'gross_margin', name: '毛利率', group: '盈利能力', unit: 'percent', desc: '(营业收入 − 营业成本) / 营业收入',
      rule: { prefer: 'higher', good: 0.25, risk: 0.1 }, calc: function (f) { return div(f.rev - f.cost, f.rev); } },
    { key: 'operating_margin', name: '营业利润率', group: '盈利能力', unit: 'percent', desc: '营业利润 / 营业收入',
      rule: { prefer: 'higher', good: 0.08, risk: 0.0 }, calc: function (f) { return div(f.op, f.rev); } },
    { key: 'net_margin', name: '净利率', group: '盈利能力', unit: 'percent', desc: '净利润 / 营业收入',
      rule: { prefer: 'higher', good: 0.05, risk: 0.0 }, calc: function (f) { return div(f.ni, f.rev); } },
    { key: 'roe', name: '净资产收益率(ROE)', group: '盈利能力', unit: 'percent', desc: '归母净利 / 归母权益，缺省则 净利 / 权益合计',
      rule: { prefer: 'higher', good: 0.1, risk: 0.0 },
      calc: function (f) { return (f.nip != null && f.tep != null) ? div(f.nip, f.tep) : div(f.ni, f.te); } },
    { key: 'roa', name: '总资产收益率(ROA)', group: '盈利能力', unit: 'percent', desc: '净利润 / 资产总计',
      rule: { prefer: 'higher', good: 0.05, risk: 0.0 }, calc: function (f) { return div(f.ni, f.ta); } },
    { key: 'asset_turnover', name: '总资产周转率', group: '营运能力', unit: 'ratio', desc: '营业收入 / 资产总计',
      rule: { prefer: 'higher', good: 0.5, risk: 0.2 }, calc: function (f) { return div(f.rev, f.ta); } },
    { key: 'ocfr', name: '经营现金流/营收', group: '现金流', unit: 'percent', desc: '经营活动现金流量净额 / 营业收入',
      rule: { prefer: 'higher', good: 0.05, risk: 0.0 }, calc: function (f) { return div(f.ocf, f.rev); } }
  ];
  var BY_KEY = {};
  RATIOS.forEach(function (r) {
    r.values = {};
    YEARS.forEach(function (y) { r.values[y] = r.calc(FS[y]); });
    BY_KEY[r.key] = r;
  });

  /* ---------------- 三类视图（来自源码 ROLE_PROFILES；tab = defaultTrendTab，all = expandAll） ---------------- */
  var ROLES = {
    manager: { label: '管理层', blurb: '关注偿债、流动性与经营现金流，快速识别经营风险',
      kpis: ['current_ratio', 'quick_ratio', 'cash_ratio', 'debt_to_asset', 'ocfr', 'operating_margin'], tab: 'ops_cash', all: false },
    investor: { label: '投资人', blurb: '关注回报、利润率与杠杆，把握盈利质量与股东收益',
      kpis: ['roe', 'roa', 'gross_margin', 'net_margin', 'debt_to_asset', 'asset_turnover'], tab: 'profit', all: false },
    pro: { label: '专业全量', blurb: '完整 13 项指标、公式与口径，适合复核与深入分析',
      kpis: ['roe', 'net_margin', 'gross_margin', 'debt_to_asset', 'current_ratio', 'ocfr'], tab: 'profit', all: true }
  };

  /* ---------------- 规则：信号、变动、格式化 ---------------- */
  function signal(r, v) {
    if (v == null) return { level: 'na', label: '暂无' };
    var rule = r.rule;
    if (rule.prefer === 'band') {
      if (v >= rule.band[0] && v <= rule.band[1]) return { level: 'good', label: '稳健' };
      if (rule.risk != null && v > rule.risk) return { level: 'risk', label: '偏高风险' };
      if (v < rule.band[0]) return { level: 'watch', label: '偏低关注' };
      return { level: 'watch', label: '偏离关注' };
    }
    if (rule.prefer === 'higher') {
      if (v >= rule.good) return { level: 'good', label: '较好' };
      if (v < rule.risk) return { level: 'risk', label: '偏弱' };
      return { level: 'watch', label: '一般' };
    }
    if (v <= rule.good) return { level: 'good', label: '可控' };
    if (v >= rule.risk) return { level: 'risk', label: '偏高' };
    return { level: 'watch', label: '关注' };
  }

  function fmt(r, v) {
    if (v == null) return '—';
    return r.unit === 'percent' ? (v * 100).toFixed(2) + '%' : v.toFixed(2);
  }

  // 按报告期匹配去年同期：本期 2025 年报，对照 2024 年报
  function change(r) {
    var cur = r.values[CUR], prev = r.values[PREV];
    if (cur == null || prev == null) return { meaning: 'na', label: '—', delta: '—', rel: '' };
    var d = cur - prev;
    var dir = Math.abs(d) < 1e-9 ? 'flat' : (d > 0 ? 'up' : 'down');
    var delta = dir === 'flat' ? '持平' : (r.unit === 'percent'
      ? (d > 0 ? '+' : '') + (d * 100).toFixed(1) + 'pp'
      : (d > 0 ? '+' : '') + d.toFixed(2) + '×');
    var rel = (dir === 'flat' || Math.abs(prev) < 1e-6) ? '' : '(' + (d > 0 ? '+' : '') + (d / Math.abs(prev) * 100).toFixed(1) + '%)';
    var improved = null;
    if (r.rule.prefer === 'higher') improved = d > 0;
    else if (r.rule.prefer === 'lower') improved = d < 0;
    var meaning, label;
    if (dir === 'flat') { meaning = 'flat'; label = '持平'; }
    else if (improved === true) { meaning = 'improve'; label = '改善'; }
    else if (improved === false) { meaning = 'worse'; label = '需关注'; }
    else { meaning = 'flat'; label = dir === 'up' ? '上升' : '下降'; } // 区间型指标只标方向
    return { meaning: meaning, label: label, delta: delta, rel: rel, dir: dir };
  }

  function arrow(dir) { return dir === 'up' ? '↑' : (dir === 'down' ? '↓' : '→'); }
  function yoyClass(r, c) {
    if (c.dir === 'flat' || c.meaning === 'na') return 'yoy-flat';
    if (c.meaning === 'improve') return 'yoy-up';
    if (c.meaning === 'worse') return 'yoy-down';
    return 'yoy-flat';
  }
  function meaningClass(c) {
    return c.meaning === 'improve' ? 'meaning-improve' : (c.meaning === 'worse' ? 'meaning-watch' : 'meaning-flat');
  }
  var TAG = { good: 'is-success', watch: 'is-warning', risk: 'is-danger', na: 'is-info', neutral: 'is-info' };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  /* 趋势分组（源码 TREND_TABS / DEFAULT_TREND_SELECTION） */
  var TREND_TABS = {
    profit: { keys: ['gross_margin', 'operating_margin', 'net_margin', 'roe', 'roa'], def: ['gross_margin', 'net_margin'] },
    solvency: { keys: ['current_ratio', 'quick_ratio', 'cash_ratio', 'debt_to_asset', 'debt_to_equity'], def: ['current_ratio', 'debt_to_asset'] },
    ops_cash: { keys: ['asset_turnover', 'ocfr'], def: ['asset_turnover', 'ocfr'] }
  };
  var PALETTE = ['--fa-s1', '--fa-s2', '--fa-s3', '--fa-s4', '--fa-s5']; // ECharts 默认色板

  var $ = function (id) { return document.getElementById(id); };
  var state = { page: 'analysis', role: 'investor', highlight: null, tab: 'profit', keys: TREND_TABS.profit.def.slice(), showAll: false };

  /* ---------------- 通用：ElMessage 与 v-loading ---------------- */
  var msgEl = $('fa-message');
  var msgTimer = null;
  function message(text, type) {
    msgEl.textContent = text;
    msgEl.className = 'el-message is-show' + (type && type !== 'success' ? ' is-' + type : '');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { msgEl.classList.remove('is-show'); }, 2600);
  }
  var loadingEl = $('fa-loading');
  var loadTimer = null;
  function withLoading(text, ms, done) {
    $('fa-loading-text').textContent = text;
    loadingEl.hidden = false;
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () { loadingEl.hidden = true; done(); }, reduced() ? 150 : ms);
  }
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-msg]');
    if (b) message(b.dataset.msg, 'info');
  });

  /* ---------------- 菜单与页面 ---------------- */
  var TITLES = { dashboard: '仪表盘', statements: '三大报表', import: '年报导入', analysis: '比率分析', compare: '多期对比' };
  var menuItems = app.querySelectorAll('.fa-menu-item');
  var pages = app.querySelectorAll('[data-view]');
  function go(page) {
    state.page = page;
    menuItems.forEach(function (m) {
      var on = m.dataset.page === page;
      m.classList.toggle('is-active', on);
      if (on) m.setAttribute('aria-current', 'page'); else m.removeAttribute('aria-current');
    });
    var view = (page === 'analysis' || page === 'import') ? page : 'other';
    pages.forEach(function (p) { p.hidden = p.dataset.view !== view; });
    $('fa-header-title').textContent = TITLES[page];
    if (view === 'other') $('fa-other-text').textContent = '示意原型只还原「比率分析」与「年报导入」两页，「' + TITLES[page] + '」未展开';
    if (view === 'analysis') renderTrend();
  }
  menuItems.forEach(function (m) { m.addEventListener('click', function () { go(m.dataset.page); }); });

  /* ================= 比率分析 ================= */
  function renderSummary() {
    var role = ROLES[state.role];
    $('fa-summary-sub').textContent = role.blurb + ' · 规则阈值仅供参考，非投资建议';
    var v = function (k) { return fmt(BY_KEY[k], BY_KEY[k].values[CUR]); };
    var lv = function (k) { return signal(BY_KEY[k], BY_KEY[k].values[CUR]).level; };
    var lines = [];
    lines.push(((lv('roe') === 'good' || lv('net_margin') === 'good') ? '盈利能力整体较好' : '盈利能力中性') +
      '：毛利率 ' + v('gross_margin') + '，净利率 ' + v('net_margin') + '，ROE ' + v('roe') + '。');
    lines.push(((lv('debt_to_asset') === 'risk' || lv('current_ratio') === 'risk') ? '偿债与杠杆需关注' : '偿债结构相对稳健') +
      '：资产负债率 ' + v('debt_to_asset') + '，流动比率 ' + v('current_ratio') + '。');
    var oc = change(BY_KEY.ocfr);
    lines.push('经营现金流/营收 ' + v('ocfr') + (oc.meaning === 'improve' ? '；较上期改善。' : (oc.meaning === 'worse' ? '；较上期走弱。' : '，现金流与收入匹配尚可。')));
    lines.push('数据完整度：13/13 项可计算。');
    $('fa-summary-lines').innerHTML = lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
  }

  function renderKpis() {
    var role = ROLES[state.role];
    $('fa-kpis').innerHTML = role.kpis.map(function (k, i) {
      var r = BY_KEY[k], cur = r.values[CUR], prev = r.values[PREV];
      var s = signal(r, cur), c = change(r);
      var variant = k === 'roe' ? '<span class="fa-kpi-variant">口径 net_profit_parent / total_equity_parent</span>' : '';
      return '<button type="button" class="fa-kpi sig-' + s.level + '" data-kpi="' + k + '" style="--i:' + i + '"' +
        ' aria-pressed="' + (state.highlight === k) + '" aria-describedby="fa-tip-' + k + '">' +
        '<span class="fa-kpi-top"><span class="fa-kpi-name">' + esc(r.name) + '</span>' +
        '<span class="el-tag is-small ' + TAG[s.level] + '">' + s.label + '</span></span>' +
        '<span class="fa-kpi-value">' + fmt(r, cur) + '</span>' +
        '<span class="fa-kpi-transition">' + fmt(r, prev) + ' → ' + fmt(r, cur) + '</span>' +
        '<span class="fa-kpi-yoy ' + yoyClass(r, c) + '"><span>' + arrow(c.dir) + '</span>' +
        '<span class="' + meaningClass(c) + '">' + c.label + '</span><span>' + c.delta + '</span>' +
        (c.rel ? '<span class="fa-kpi-rel">' + c.rel + '</span>' : '') + '</span>' + variant +
        '<span class="fa-tip" role="tooltip" id="fa-tip-' + k + '">' + esc(r.group) + ' · ' + esc(r.desc) + '</span>' +
        '</button>';
    }).join('');
  }

  // 按幅度排序的改善 / 需关注 Top 3（源码 rankMovers）
  function movers() {
    var rows = ROLES[state.role].kpis.map(function (k) {
      var r = BY_KEY[k], c = change(r);
      var d = r.values[CUR] - r.values[PREV];
      return { r: r, c: c, mag: Math.abs(r.unit === 'percent' ? d * 100 : d) };
    });
    function top(meaning) {
      var list = rows.filter(function (x) { return x.c.meaning === meaning; }).sort(function (a, b) { return b.mag - a.mag; }).slice(0, 3);
      var max = list.length ? list[0].mag : 1;
      list.forEach(function (x) { x.bar = Math.max(8, Math.round(x.mag / (max || 1) * 100)); });
      return list;
    }
    return { improve: top('improve'), watch: top('worse'), rows: rows };
  }

  var donutData = [];
  function renderCompare() {
    var m = movers();
    var groups = { improve: [], watch: [], flat: [] };
    m.rows.forEach(function (x) {
      if (x.c.meaning === 'improve') groups.improve.push(x);
      else if (x.c.meaning === 'worse') groups.watch.push(x);
      else groups.flat.push(x);
    });
    donutData = [
      { key: 'improve', name: '改善', color: '--fa-success', items: groups.improve },
      { key: 'watch', name: '需关注', color: '--fa-danger', items: groups.watch },
      { key: 'flat', name: '持平', color: '--fa-text-5', items: groups.flat }
    ].filter(function (d) { return d.items.length; });
    drawDonut(m.rows.length);

    $('fa-stat-chips').innerHTML = [['improve', '改善'], ['watch', '需关注'], ['flat', '持平']].map(function (p) {
      return '<div class="fa-stat-chip ' + p[0] + '"><span class="fa-stat-num">' + groups[p[0]].length + '</span><span class="fa-stat-label">' + p[1] + '</span></div>';
    }).join('');

    function card(x, kind) {
      return '<button type="button" class="fa-focus-card ' + kind + (state.highlight === x.r.key ? ' active' : '') + '" data-focus="' + x.r.key + '">' +
        '<span class="fa-focus-top"><span class="fa-focus-name">' + esc(x.r.name) + '</span><span class="fa-focus-badge ' + kind + '">' + x.c.delta + '</span></span>' +
        '<span class="fa-dumbbell"><span class="fa-db-val prev">' + fmt(x.r, x.r.values[PREV]) + '</span>' +
        '<span class="fa-db-track"><span class="fa-db-line ' + kind + '"></span><span class="fa-db-dot prev"></span><span class="fa-db-dot curr ' + kind + '"></span></span>' +
        '<span class="fa-db-val curr">' + fmt(x.r, x.r.values[CUR]) + '</span></span>' +
        '<span class="fa-focus-bar"><span class="' + kind + '" style="width:' + x.bar + '%"></span></span>' +
        '<span class="el-tag is-small is-plain ' + TAG[signal(x.r, x.r.values[CUR]).level] + '">' + signal(x.r, x.r.values[CUR]).label + '</span>' +
        '</button>';
    }
    $('fa-focus').innerHTML =
      '<div class="fa-focus-col"><div class="fa-focus-col-title improve">改善 Top</div>' +
      (m.improve.length ? m.improve.map(function (x) { return card(x, 'improve'); }).join('') : '<div class="fa-focus-empty">暂无改善项</div>') + '</div>' +
      '<div class="fa-focus-col"><div class="fa-focus-col-title watch">需关注 Top</div>' +
      (m.watch.length ? m.watch.map(function (x) { return card(x, 'watch'); }).join('') : '<div class="fa-focus-empty">暂无需关注项</div>') + '</div>';
  }

  // ECharts 环图：radius ['42%','72%']、扇区白色描边、外侧标签“名称\n数量”
  function drawDonut(total) {
    var svg = $('fa-donut');
    var W = 260, H = 200, cx = W / 2, cy = H * 0.48, R = Math.min(W, H) / 2;
    var ro = R * 0.72, ri = R * 0.42;
    var h = '', a0 = -Math.PI / 2;
    function pt(r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
    donutData.forEach(function (d, i) {
      var a1 = a0 + Math.PI * 2 * d.items.length / total;
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      var path;
      if (d.items.length === total) {
        path = 'M' + (cx - ro) + ',' + cy + 'a' + ro + ',' + ro + ' 0 1,0 ' + (2 * ro) + ',0a' + ro + ',' + ro + ' 0 1,0 ' + (-2 * ro) + ',0' +
          'M' + (cx - ri) + ',' + cy + 'a' + ri + ',' + ri + ' 0 1,1 ' + (2 * ri) + ',0a' + ri + ',' + ri + ' 0 1,1 ' + (-2 * ri) + ',0Z';
      } else {
        var p1 = pt(ro, a0), p2 = pt(ro, a1), p3 = pt(ri, a1), p4 = pt(ri, a0);
        path = 'M' + p1.join(',') + 'A' + ro + ',' + ro + ' 0 ' + large + ',1 ' + p2.join(',') +
          'L' + p3.join(',') + 'A' + ri + ',' + ri + ' 0 ' + large + ',0 ' + p4.join(',') + 'Z';
      }
      h += '<path class="seg" tabindex="0" data-i="' + i + '" fill="var(' + d.color + ')" fill-rule="evenodd" d="' + path + '"><title>' + d.name + '</title></path>';
      var am = (a0 + a1) / 2;
      var e1 = pt(ro + 4, am), e2 = pt(ro + 14, am);
      var right = Math.cos(am) >= 0;
      var e3 = [e2[0] + (right ? 8 : -8), e2[1]];
      h += '<polyline class="lbl-line" stroke="var(' + d.color + ')" points="' + e1.join(',') + ' ' + e2.join(',') + ' ' + e3.join(',') + '"/>';
      h += '<text class="lbl" x="' + (e3[0] + (right ? 3 : -3)) + '" y="' + (e3[1] - 3) + '" text-anchor="' + (right ? 'start' : 'end') + '">' + d.name +
        '<tspan x="' + (e3[0] + (right ? 3 : -3)) + '" dy="15">' + d.items.length + '</tspan></text>';
      a0 = a1;
    });
    h += '<text class="c-num" x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle">' + total + '</text>';
    h += '<text class="c-lbl" x="' + cx + '" y="' + (cy + 22) + '" text-anchor="middle">核心指标</text>';
    svg.innerHTML = h;
    svg.setAttribute('aria-label', '变动结构：' + donutData.map(function (d) { return d.name + ' ' + d.items.length + ' 项'; }).join('，'));
  }
  var donutTip = $('fa-donut-tip');
  function showDonutTip(el) {
    var d = donutData[Number(el.getAttribute('data-i'))];
    if (!d) return;
    var total = donutData.reduce(function (s, x) { return s + x.items.length; }, 0);
    donutTip.innerHTML = '<b>' + d.name + '：' + d.items.length + ' 项（' + Math.round(d.items.length / total * 100) + '%）</b>' +
      d.items.map(function (x) {
        return '<div>· ' + esc(x.r.name) + ' <span style="color:var(--fa-text-3)">' + x.c.delta + '</span><br><small>' +
          fmt(x.r, x.r.values[PREV]) + ' → ' + fmt(x.r, x.r.values[CUR]) + ' · ' + signal(x.r, x.r.values[CUR]).label + '</small></div>';
      }).join('');
    donutTip.hidden = false;
  }
  var donutSvg = $('fa-donut');
  donutSvg.addEventListener('mouseover', function (e) { if (e.target.classList.contains('seg')) showDonutTip(e.target); });
  donutSvg.addEventListener('focusin', function (e) { if (e.target.classList.contains('seg')) showDonutTip(e.target); });
  donutSvg.addEventListener('mouseleave', function () { donutTip.hidden = true; });
  donutSvg.addEventListener('focusout', function () { donutTip.hidden = true; });

  /* 趋势分析：ECharts 折线（smooth、空心圆点、图例在底部；单位混合时启用右轴） */
  function renderTrendControls() {
    app.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tab === state.tab)); });
    $('fa-trend-checks').innerHTML = TREND_TABS[state.tab].keys.map(function (k) {
      var r = BY_KEY[k];
      return '<label class="fa-check"><input type="checkbox" value="' + k + '"' + (state.keys.indexOf(k) >= 0 ? ' checked' : '') + '>' +
        '<span>' + esc(r.name) + ' <small>(' + (r.unit === 'percent' ? '%' : '倍') + ')</small></span></label>';
    }).join('');
  }
  function niceTicks(lo, hi) {
    if (lo === hi) { lo -= 1; hi += 1; }
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    [1, 2, 2.5, 5, 10].some(function (m) { if (span / (step * m) <= 5) { step *= m; return true; } return false; });
    var a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t = [];
    for (var v = a; v <= b + step / 2; v += step) t.push(Number(v.toFixed(6)));
    return t;
  }
  function smoothPath(pts) {
    if (pts.length < 2) return '';
    var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, k = 0.18;
      var c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
      var c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
      d += 'C' + c1[0].toFixed(1) + ',' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ',' + c2[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }
  function renderTrend(animate) {
    var svg = $('fa-trend');
    if (!svg.clientWidth) return;
    var W = Math.max(300, Math.min(900, Math.round(svg.clientWidth)));
    var H = W < 420 ? 240 : 270;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var keys = state.keys.filter(function (k) { return TREND_TABS[state.tab].keys.indexOf(k) >= 0; });
    if (!keys.length) {
      svg.innerHTML = '<text class="axis-text" x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle">请至少勾选一个对比指标</text>';
      return;
    }
    var series = keys.map(function (k, i) {
      var r = BY_KEY[k];
      return { r: r, color: PALETTE[TREND_TABS[state.tab].keys.indexOf(k) % PALETTE.length],
        vals: YEARS.map(function (y) { return r.unit === 'percent' ? r.values[y] * 100 : r.values[y]; }) };
    });
    var mixed = series.some(function (s) { return s.r.unit === 'percent'; }) && series.some(function (s) { return s.r.unit === 'ratio'; });
    var L = 52, R = mixed ? 46 : 20, T = 30, B = 56;
    function axisFor(unit) {
      var vs = [];
      series.forEach(function (s) { if (!mixed || s.r.unit === unit) vs = vs.concat(s.vals); });
      var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.1 || 1;
      var t = niceTicks(lo - pad, hi + pad);
      return { t: t, lo: t[0], hi: t[t.length - 1] };
    }
    var left = axisFor(mixed ? 'percent' : series[0].r.unit);
    var right = mixed ? axisFor('ratio') : null;
    var x = function (i) { return L + i * (W - L - R) / (YEARS.length - 1); };
    var y = function (v, ax) { return T + (ax.hi - v) / (ax.hi - ax.lo) * (H - T - B); };
    var leftUnitPct = mixed || series[0].r.unit === 'percent';
    var h = '';
    left.t.forEach(function (v) {
      var gy = y(v, left).toFixed(1);
      h += '<line class="split" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '"/>';
      h += '<text class="axis-text" x="' + (L - 8) + '" y="' + gy + '" dy="4" text-anchor="end">' + (+v.toFixed(2)) + (leftUnitPct ? '%' : '') + '</text>';
    });
    if (right) right.t.forEach(function (v) {
      h += '<text class="axis-text" x="' + (W - R + 8) + '" y="' + y(v, right).toFixed(1) + '" dy="4">' + (+v.toFixed(2)) + '</text>';
    });
    h += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/>';
    YEARS.forEach(function (yr, i) {
      h += '<line class="axis" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + (H - B) + '" y2="' + (H - B + 5) + '"/>';
      h += '<text class="axis-text" x="' + x(i) + '" y="' + (H - B + 20) + '" text-anchor="middle">' + yr + ' 年报</text>';
    });
    series.forEach(function (s) {
      var ax = (mixed && s.r.unit === 'ratio') ? right : left;
      var pts = s.vals.map(function (v, i) { return [x(i), y(v, ax)]; });
      h += '<path class="series" stroke="var(' + s.color + ')" d="' + smoothPath(pts) + '"/>';
      pts.forEach(function (p) { h += '<circle class="sym" stroke="var(' + s.color + ')" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3"/>'; });
    });
    // 图例（底部居中）
    var items = series.map(function (s) { return { s: s, w: 34 + s.r.name.length * 12.5 }; });
    var total = items.reduce(function (a, b) { return a + b.w; }, 0);
    var lx = Math.max(4, (W - total) / 2), ly = H - 10;
    items.forEach(function (it) {
      h += '<line stroke="var(' + it.s.color + ')" stroke-width="2" x1="' + lx + '" x2="' + (lx + 24) + '" y1="' + (ly - 4) + '" y2="' + (ly - 4) + '"/>';
      h += '<circle class="sym" stroke="var(' + it.s.color + ')" cx="' + (lx + 12) + '" cy="' + (ly - 4) + '" r="4"/>';
      h += '<text class="legend-text" x="' + (lx + 29) + '" y="' + ly + '">' + esc(it.s.r.name) + '</text>';
      lx += it.w + 10;
    });
    svg.innerHTML = h;
    svg.setAttribute('aria-label', '趋势分析：' + series.map(function (s) {
      return s.r.name + ' ' + YEARS.map(function (yr) { return yr + ' 年报 ' + fmt(s.r, s.r.values[yr]); }).join('、');
    }).join('；'));
    if (animate && !reduced()) {
      svg.querySelectorAll('.series').forEach(function (p) {
        var len = p.getTotalLength();
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.getBoundingClientRect();
        p.style.transition = 'stroke-dashoffset .6s ease';
        p.style.strokeDashoffset = '0';
      });
    }
  }

  function renderAll() {
    var box = $('fa-all'), btn = $('fa-all-toggle');
    box.hidden = !state.showAll;
    btn.textContent = state.showAll ? '收起全部指标' : '展开全部指标与公式';
    btn.setAttribute('aria-expanded', String(state.showAll));
    if (!state.showAll) return;
    box.innerHTML = ['偿债能力', '盈利能力', '营运能力', '现金流'].map(function (g) {
      return '<div class="fa-group"><h3 class="fa-group-title">' + g + '</h3><div class="el-table-wrap"><table class="el-table is-stripe">' +
        '<thead><tr><th>指标</th><th>数值</th><th>状态</th><th>说明</th></tr></thead><tbody>' +
        RATIOS.filter(function (r) { return r.group === g; }).map(function (r) {
          var s = signal(r, r.values[CUR]);
          return '<tr><td>' + esc(r.name) + '</td><td>' + fmt(r, r.values[CUR]) + '</td>' +
            '<td><span class="el-tag is-small is-plain ' + TAG[s.level] + '">' + s.label + '</span></td>' +
            '<td class="is-wrap"><span class="fa-table-desc">' + esc(r.desc) + '</span></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }).join('');
  }
  $('fa-all-toggle').addEventListener('click', function () { state.showAll = !state.showAll; renderAll(); });

  function renderAnalysis(animate) {
    renderSummary(); renderKpis(); renderCompare(); renderTrendControls(); renderTrend(animate); renderAll();
  }

  // 视图切换：沿用源码 onRoleChange —— 重置趋势分组与默认勾选，专业全量展开全部指标
  var body = $('fa-body'), switchTimer = null;
  app.querySelectorAll('[data-role]').forEach(function (b) {
    b.addEventListener('click', function () {
      var role = b.dataset.role;
      if (role === state.role) return;
      state.role = role;
      state.tab = ROLES[role].tab;
      state.keys = TREND_TABS[state.tab].def.slice();
      state.showAll = ROLES[role].all;
      state.highlight = null;
      app.querySelectorAll('[data-role]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.role === role)); });
      clearTimeout(switchTimer);
      if (reduced()) { renderAnalysis(false); return; }
      body.classList.add('is-leaving');
      switchTimer = setTimeout(function () { renderAnalysis(true); body.classList.remove('is-leaving'); }, 180);
    });
  });

  // 点击指标卡 / 重点变动卡：高亮同一指标（源码 focusMetric，再次点击取消）
  function focusMetric(key) {
    state.highlight = state.highlight === key ? null : key;
    app.querySelectorAll('[data-kpi]').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.kpi === state.highlight)); });
    app.querySelectorAll('[data-focus]').forEach(function (c) { c.classList.toggle('active', c.dataset.focus === state.highlight); });
  }
  $('fa-kpis').addEventListener('click', function (e) { var c = e.target.closest('[data-kpi]'); if (c) focusMetric(c.dataset.kpi); });
  $('fa-focus').addEventListener('click', function (e) { var c = e.target.closest('[data-focus]'); if (c) focusMetric(c.dataset.focus); });

  $('fa-trend-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (!b || b.dataset.tab === state.tab) return;
    state.tab = b.dataset.tab;
    state.keys = TREND_TABS[state.tab].def.slice();
    renderTrendControls(); renderTrend(true);
  });
  $('fa-trend-checks').addEventListener('change', function () {
    state.keys = Array.prototype.map.call($('fa-trend-checks').querySelectorAll('input:checked'), function (i) { return i.value; });
    renderTrend(true);
  });

  /* ================= 年报导入 ================= */
  var itabs = app.querySelectorAll('[data-itab]');
  var ipanes = app.querySelectorAll('[data-ipane]');
  function setITab(name) {
    itabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.itab === name)); t.tabIndex = t.dataset.itab === name ? 0 : -1; });
    ipanes.forEach(function (p) { p.hidden = p.dataset.ipane !== name; });
  }
  itabs.forEach(function (t) {
    t.addEventListener('click', function () { setITab(t.dataset.itab); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var list = Array.prototype.slice.call(itabs), i = list.indexOf(t);
      var n = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
      setITab(n.dataset.itab); n.focus();
    });
  });
  setITab('fetch');

  // 在线拉取
  var year = 2025;
  app.querySelectorAll('[data-year]').forEach(function (b) {
    b.addEventListener('click', function () {
      year = Math.max(2015, Math.min(2025, year + Number(b.dataset.year)));
      $('fa-fetch-year').textContent = year;
    });
  });
  $('fa-fetch-search').addEventListener('click', function () {
    if (!$('fa-fetch-q').value.trim()) { message('请填写证券代码或公司名称', 'warning'); return; }
    withLoading('', 900, function () {
      $('fa-candidate-body').innerHTML = '<tr><td class="is-check"><span class="el-checkbox is-checked" aria-hidden="true"></span></td><td>' + year +
        '</td><td>A00001</td><td>示例公司A</td><td>示例公司A：' + year + '年年度报告</td><td>' + (year + 1) + '-03-28</td></tr>';
      $('fa-candidates').hidden = false;
      message('找到 1 份候选（覆盖 ' + year + ' 年），已默认全选');
    });
  });
  $('fa-fetch-import').addEventListener('click', function () {
    withLoading('', 1300, function () {
      message('下载解析完成：成功 1 · 失败 0');
      setITab('pdf');
      setStep(1);
    });
  });

  // Excel 模板导入
  $('fa-excel-upload').addEventListener('click', function () {
    withLoading('', 900, function () {
      $('fa-excel-preview').hidden = false;
      message('解析完成，请确认预览后入库');
    });
  });

  // 年报 PDF 导入：el-steps + el-upload + 映射质量
  var UNMAPPED = [
    { kind: '资产负债表', label: '其他非流动金融资产（续）', amount: '3,260,000.00', page: 98, reason: '无别名匹配' },
    { kind: '利润表', label: '其中：对联营企业和合营企业的投资收益', amount: '1,180,000.00', page: 103, reason: '多科目歧义' },
    { kind: '现金流量表', label: '收到其他与经营活动有关的现金', amount: '2,450,000.00', page: 107, reason: '匹配分过低' }
  ];
  function renderUnmapped(kind) {
    $('fa-unmapped-body').innerHTML = UNMAPPED.filter(function (u) { return kind === 'all' || u.kind === kind; }).map(function (u) {
      return '<tr><td>' + u.kind + '</td><td>' + esc(u.label) + '</td><td class="is-right">' + u.amount + '</td><td class="is-center">' + u.page +
        '</td><td><span class="el-tag is-small is-info is-plain">' + u.reason + '</span></td></tr>';
    }).join('');
    app.querySelectorAll('[data-kind]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.kind === kind)); });
  }
  $('fa-unmapped-filter').addEventListener('click', function (e) { var b = e.target.closest('[data-kind]'); if (b) renderUnmapped(b.dataset.kind); });

  var CHECK = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function setStep(step) {
    app.querySelectorAll('#fa-steps .el-step').forEach(function (li, i) {
      // 与 el-steps :active="step" finish-status="success" 一致：之前的步骤完成，当前步骤为进行中
      li.classList.toggle('is-success', i < step);
      li.classList.toggle('is-process', i === step);
      li.querySelector('.el-step__icon').innerHTML = i < step ? CHECK : String(i + 1);
    });
    $('fa-pdf-upload').hidden = step !== 0;
    $('fa-pdf-review').hidden = step === 0;
    var committed = step === 2;
    var alert = $('fa-review-alert');
    alert.className = 'el-alert ' + (committed ? 'is-success' : 'is-info');
    $('fa-review-status').textContent = '状态：' + (committed ? 'committed' : 'review') + ' · 需人工核对后入库 · 覆盖 96%';
    $('fa-save').disabled = committed;
    $('fa-commit').disabled = committed;
    $('fa-goto-statements').hidden = !committed;
    if (step === 1) renderUnmapped('all');
  }
  setStep(0);
  $('fa-pdf-dragger').addEventListener('click', function () {
    withLoading('', 1300, function () { setStep(1); message('已解析，请核对后确认入库'); });
  });
  $('fa-save').addEventListener('click', function () { message('已更新'); });
  $('fa-commit').addEventListener('click', function () {
    withLoading('', 800, function () { setStep(2); message('已入库 · 2025 年报（示意，未写入数据）'); });
  });

  /* ---------------- 初始渲染 ---------------- */
  renderAnalysis(false);
  var resizeTimer = null, lastW = $('fa-trend').clientWidth;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var w = $('fa-trend').clientWidth;
      if (Math.abs(w - lastW) < 8) return;
      lastW = w; renderTrend(false);
    }, 150);
  });
})();
