// 财务分析系统 · 交互原型（示意）
// 只还原「比率分析」页的界面与交互，不连接真实功能。
// “示例公司A”的全部报表数字均为虚构示例；比率口径、视图配置与信号阈值取自项目源码。
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

  /* ---------------- 三类视图（来自源码 ROLE_PROFILES） ---------------- */
  var ROLES = {
    manager: { label: '管理层', blurb: '关注偿债、流动性与经营现金流，快速识别经营风险',
      kpis: ['current_ratio', 'quick_ratio', 'cash_ratio', 'debt_to_asset', 'ocfr', 'operating_margin'], all: false },
    investor: { label: '投资人', blurb: '关注回报、利润率与杠杆，把握盈利质量与股东收益',
      kpis: ['roe', 'roa', 'gross_margin', 'net_margin', 'debt_to_asset', 'asset_turnover'], all: false },
    pro: { label: '专业全量', blurb: '完整 13 项指标、公式与口径，适合复核与深入分析',
      kpis: ['roe', 'net_margin', 'gross_margin', 'debt_to_asset', 'current_ratio', 'ocfr'], all: true }
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

  function arrow(c) { return c.dir === 'up' ? '↑' : (c.dir === 'down' ? '↓' : '→'); }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  /* ---------------- 页面元素 ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  var body = $('fa-body');
  var kpiBox = $('fa-kpis');
  var trendSvg = $('fa-trend');
  var donutSvg = $('fa-donut');
  var legend = $('fa-legend');
  var allBox = $('fa-all');
  var allGroups = $('fa-all-groups');
  var toastEl = $('fa-toast');
  var roleButtons = app.querySelectorAll('[data-role]');

  var state = { role: 'investor', trendKey: 'roe' };

  /* ---------------- 渲染：健康摘要 ---------------- */
  function renderSummary() {
    var role = ROLES[state.role];
    $('fa-summary-blurb').textContent = role.blurb + ' · 规则阈值仅供参考，非投资建议';

    var v = function (k) { return fmt(BY_KEY[k], BY_KEY[k].values[CUR]); };
    var lv = function (k) { return signal(BY_KEY[k], BY_KEY[k].values[CUR]).level; };
    var lines = [];
    var profitTone = (lv('roe') === 'good' || lv('net_margin') === 'good') ? '盈利能力整体较好' : '盈利能力中性';
    lines.push(profitTone + '：毛利率 ' + v('gross_margin') + '，净利率 ' + v('net_margin') + '，ROE ' + v('roe') + '。');
    var debtTone = (lv('debt_to_asset') === 'risk' || lv('current_ratio') === 'risk') ? '偿债与杠杆需关注' : '偿债结构相对稳健';
    lines.push(debtTone + '：资产负债率 ' + v('debt_to_asset') + '，流动比率 ' + v('current_ratio') + '。');
    var oc = change(BY_KEY.ocfr);
    lines.push('经营现金流/营收 ' + v('ocfr') + (oc.meaning === 'improve' ? '；较上期改善。' : (oc.meaning === 'worse' ? '；较上期走弱。' : '。')));
    lines.push('数据完整度：13/13 项可计算。');

    var goods = 0, risks = 0, watches = [];
    role.kpis.forEach(function (k) {
      var s = signal(BY_KEY[k], BY_KEY[k].values[CUR]);
      if (s.level === 'good') goods++;
      else if (s.level === 'risk') risks++;
      else if (s.level === 'watch') watches.push(BY_KEY[k].name);
    });
    if (watches.length) lines.push('关注项：' + watches.join('、') + '。');
    $('fa-summary-lines').innerHTML = lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');

    var badge = $('fa-summary-badge');
    var overall = risks >= 2 ? 'risk' : (risks === 1 ? 'watch' : (goods >= 2 ? 'good' : 'watch'));
    badge.textContent = { good: '整体稳健', watch: '需要关注', risk: '风险偏高' }[overall];
    badge.className = 'fa-badge' + (overall === 'good' ? '' : ' is-' + overall);
  }

  /* ---------------- 渲染：指标卡 ---------------- */
  function renderKpis() {
    var role = ROLES[state.role];
    kpiBox.innerHTML = role.kpis.map(function (k, i) {
      var r = BY_KEY[k];
      var cur = r.values[CUR], prev = r.values[PREV];
      var s = signal(r, cur);
      var c = change(r);
      var cls = c.meaning === 'improve' ? 'is-improve' : (c.meaning === 'worse' ? 'is-worse' : 'is-flat');
      var tipId = 'fa-tip-' + k;
      return '<button type="button" class="fa-kpi is-' + s.level + '" data-kpi="' + k + '" style="--i:' + i + '"' +
        ' aria-pressed="' + (k === state.trendKey) + '" aria-describedby="' + tipId + '">' +
        '<span class="fa-kpi-head"><span class="fa-kpi-name">' + esc(r.name) + '</span>' +
        '<span class="fa-tag' + (s.level === 'good' ? '' : ' is-' + s.level) + '">' + s.label + '</span></span>' +
        '<span class="fa-kpi-value">' + fmt(r, cur) + '</span>' +
        '<span class="fa-kpi-trans">' + fmt(r, prev) + ' → ' + fmt(r, cur) + '</span>' +
        '<span class="fa-kpi-delta ' + cls + '">' + arrow(c) + ' ' + c.label + ' ' + c.delta + ' <em>' + c.rel + '</em></span>' +
        '<span class="fa-tip" role="tooltip" id="' + tipId + '"><b>口径 · ' + esc(r.group) + '</b>' + esc(r.desc) + '</span>' +
        '</button>';
    }).join('');
  }

  /* ---------------- 渲染：趋势折线（内联 SVG） ---------------- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function renderTrend(animate) {
    var r = BY_KEY[state.trendKey];
    $('fa-trend-title').textContent = r.name + ' · 近 4 期趋势';
    $('fa-trend-formula').textContent = '口径：' + r.desc;

    // 视图宽度随容器变化，保证窄屏下刻度文字不被缩小
    var W = Math.max(260, Math.min(520, Math.round(trendSvg.clientWidth) || 360));
    var H = 190, L = 44, R = 16, T = 22, B = 30;
    trendSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var vals = YEARS.map(function (y) { return r.values[y]; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var pad = (max - min) * 0.35 || Math.abs(max) * 0.1 || 0.1;
    var lo = min - pad, hi = max + pad;
    var IN = 18; // 首末点内缩，避免与纵轴刻度重叠
    var x = function (i) { return L + IN + i * (W - L - R - IN * 2) / (YEARS.length - 1); };
    var y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
    var tick = function (v) { return r.unit === 'percent' ? (v * 100).toFixed(1) + '%' : v.toFixed(2); };

    var h = '';
    for (var g = 0; g < 4; g++) {
      var gv = lo + (hi - lo) * g / 3;
      var gy = y(gv).toFixed(1);
      h += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '"/>';
      h += '<text class="axis-text" x="' + (L - 6) + '" y="' + gy + '" dy="3.5" text-anchor="end">' + tick(gv) + '</text>';
    }
    var pts = vals.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
    var area = 'M' + x(0).toFixed(1) + ',' + (H - B) + ' L' + pts.join(' L') + ' L' + x(YEARS.length - 1).toFixed(1) + ',' + (H - B) + ' Z';
    h += '<path class="area" d="' + area + '"/>';
    h += '<path class="line" d="M' + pts.join(' L') + '"/>';
    YEARS.forEach(function (yr, i) {
      var isCur = yr === CUR;
      var px = x(i).toFixed(1), py = y(vals[i]).toFixed(1);
      h += '<circle class="pt' + (isCur ? ' is-cur' : '') + '" cx="' + px + '" cy="' + py + '" r="' + (isCur ? 4.5 : 3.5) + '"/>';
      h += '<text class="pt-label' + (isCur ? ' is-cur' : '') + '" x="' + px + '" y="' + (py - 9) + '" text-anchor="middle">' + fmt(r, vals[i]) + '</text>';
      h += '<text class="axis-text" x="' + px + '" y="' + (H - 10) + '" text-anchor="middle">' + yr + ' 年报' + '</text>';
      if (yr === PREV) h += '<text class="prev-mark" x="' + px + '" y="' + (H - 0.5) + '" text-anchor="middle">去年同期</text>';
    });
    trendSvg.innerHTML = h;
    trendSvg.setAttribute('aria-label', r.name + '近 4 期趋势：' + YEARS.map(function (yr, i) { return yr + ' 年报 ' + fmt(r, vals[i]); }).join('，'));

    if (animate && !reduced()) {
      var line = trendSvg.querySelector('.line');
      if (line && line.getTotalLength) {
        var len = line.getTotalLength();
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = len;
        line.getBoundingClientRect();
        line.style.transition = 'stroke-dashoffset .6s ease';
        line.style.strokeDashoffset = '0';
      }
    }
  }

  /* ---------------- 渲染：变动结构环图 ---------------- */
  function renderDonut() {
    var role = ROLES[state.role];
    var groups = { improve: [], worse: [], flat: [] };
    role.kpis.forEach(function (k) {
      var c = change(BY_KEY[k]);
      if (groups[c.meaning]) groups[c.meaning].push(BY_KEY[k].name);
    });
    var total = role.kpis.length;
    var C = 2 * Math.PI * 44;
    var h = '<circle class="track" cx="60" cy="60" r="44"/>';
    var offset = 0;
    [['improve', 'is-improve'], ['worse', 'is-worse'], ['flat', 'is-flat']].forEach(function (p) {
      var n = groups[p[0]].length;
      if (!n) return;
      var len = C * n / total;
      var gap = total > n ? 2 : 0;
      h += '<circle class="seg ' + p[1] + '" cx="60" cy="60" r="44" transform="rotate(-90 60 60)"' +
        ' stroke-dasharray="' + Math.max(len - gap, 0).toFixed(2) + ' ' + C.toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-offset).toFixed(2) + '"/>';
      offset += len;
    });
    h += '<text class="center-num" x="60" y="62" text-anchor="middle">' + total + '</text>';
    h += '<text class="center-label" x="60" y="78" text-anchor="middle">核心指标</text>';
    donutSvg.innerHTML = h;
    donutSvg.setAttribute('aria-label', '较上期变动结构：改善 ' + groups.improve.length + ' 项，需关注 ' + groups.worse.length + ' 项，持平或仅标方向 ' + groups.flat.length + ' 项');

    var rows = [['improve', '改善'], ['worse', '需关注'], ['flat', '持平 / 区间型']];
    legend.innerHTML = rows.map(function (p) {
      var list = groups[p[0]];
      return '<li><i class="is-' + p[0] + '"></i><span>' + p[1] + '</span><b>' + list.length + '</b>' +
        (list.length ? '<small>' + esc(list.join('、')) + '</small>' : '') + '</li>';
    }).join('');
  }

  /* ---------------- 渲染：专业视图全部指标 ---------------- */
  function renderAll() {
    var role = ROLES[state.role];
    allBox.hidden = !role.all;
    if (!role.all) return;
    var order = ['偿债能力', '盈利能力', '营运能力', '现金流'];
    allGroups.innerHTML = order.map(function (gName) {
      var items = RATIOS.filter(function (r) { return r.group === gName; });
      return '<div class="fa-group"><p class="fa-group-name">' + gName + ' · ' + items.length + ' 项</p>' +
        items.map(function (r) {
          var c = change(r);
          var cls = c.meaning === 'improve' ? 'is-improve' : (c.meaning === 'worse' ? 'is-worse' : 'is-flat');
          return '<div class="fa-row"><span class="fa-row-name">' + esc(r.name) + '<small>' + esc(r.desc) + '</small></span>' +
            '<span class="fa-row-val">' + fmt(r, r.values[CUR]) + '</span>' +
            '<span class="fa-row-delta ' + cls + '">' + arrow(c) + ' ' + c.delta + '</span></div>';
        }).join('') + '</div>';
    }).join('');
  }

  function renderAllParts(animateTrend) {
    renderSummary();
    renderKpis();
    renderTrend(animateTrend);
    renderDonut();
    renderAll();
  }

  /* ---------------- 交互：视图切换（带过渡） ---------------- */
  var switchTimer = null;
  function setRole(role) {
    if (role === state.role || !ROLES[role]) return;
    state.role = role;
    state.trendKey = ROLES[role].kpis[0];
    roleButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.role === role)); });
    clearTimeout(switchTimer);
    if (reduced()) { renderAllParts(false); return; }
    body.classList.add('is-leaving');
    switchTimer = setTimeout(function () {
      renderAllParts(true);
      body.classList.remove('is-leaving');
    }, 180);
  }
  roleButtons.forEach(function (b) {
    b.addEventListener('click', function () { setRole(b.dataset.role); });
  });

  // 点击指标卡：切换趋势图指标
  kpiBox.addEventListener('click', function (e) {
    var card = e.target.closest('[data-kpi]');
    if (!card || card.dataset.kpi === state.trendKey) return;
    state.trendKey = card.dataset.kpi;
    kpiBox.querySelectorAll('[data-kpi]').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.kpi === state.trendKey));
    });
    renderTrend(true);
  });

  /* ---------------- 提示条 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-show'); }, 2600);
  }
  app.querySelectorAll('[data-nav]').forEach(function (b) {
    if (b.hasAttribute('data-open-import')) return;
    b.addEventListener('click', function () {
      toast('示意原型只还原「比率分析」页，「' + b.dataset.nav + '」未展开');
    });
  });

  /* ---------------- 导入年报对话框 ---------------- */
  var overlay = $('fa-overlay');
  var dialog = overlay.querySelector('.fa-dialog');
  var panes = overlay.querySelectorAll('[data-pane]');
  var steps = overlay.querySelectorAll('.fa-steps li');
  var detail = $('fa-source-detail');
  var lastFocus = null;
  var progressTimer = null;

  var SOURCES = {
    pdf: {
      detail: '示例文件：示例公司A_2025年年度报告.pdf（拖拽或点击上传 A 股年报 PDF）',
      stages: ['读取 PDF 文本', '定位三大报表页码（含续页）', '抽取原文科目与金额', '按映射规则匹配标准科目', '生成映射质量报告'],
      total: 112, mapped: 109, coverage: '96%',
      review: [
        { sheet: '资产负债表', item: '其他非流动金融资产', page: 'p.98', why: '续页表头缺失，需确认所属报表与列' },
        { sheet: '利润表', item: '其中：对联营企业和合营企业的投资收益', page: 'p.103', why: '「其中」明细项，需确认是否单独映射' },
        { sheet: '现金流量表', item: '收到其他与经营活动有关的现金', page: 'p.107', why: '金额未识别，保留缺失原因' }
      ]
    },
    excel: {
      detail: '示例文件：示例公司A_三大报表模板.xlsx（按标准模板填写）',
      stages: ['读取模板工作表', '校验模板字段与期间', '按映射规则匹配标准科目', '生成映射质量报告'],
      total: 96, mapped: 95, coverage: '100%',
      review: [
        { sheet: '利润表', item: '其他综合收益的税后净额', page: 'B42', why: '单元格为空，保留缺失原因' }
      ]
    },
    cninfo: {
      detail: '检索：示例公司A · 2025 年度报告（支持证券代码或公司名称；下载后人工核对，不自动入库）',
      stages: ['检索巨潮资讯公告', '下载年度报告全文 PDF', '定位三大报表页码（含续页）', '按映射规则匹配标准科目', '生成映射质量报告'],
      total: 112, mapped: 110, coverage: '97%',
      review: [
        { sheet: '资产负债表', item: '其他非流动金融资产', page: 'p.98', why: '续页表头缺失，需确认所属报表与列' },
        { sheet: '利润表', item: '其中：对联营企业和合营企业的投资收益', page: 'p.103', why: '「其中」明细项，需确认是否单独映射' }
      ]
    }
  };

  function currentSource() {
    var el = overlay.querySelector('input[name="fa-source"]:checked');
    return el ? el.value : 'pdf';
  }
  function updateDetail() { detail.textContent = SOURCES[currentSource()].detail; }
  overlay.querySelectorAll('input[name="fa-source"]').forEach(function (r) {
    r.addEventListener('change', updateDetail);
  });

  function showPane(name) {
    panes.forEach(function (p) { p.hidden = p.dataset.pane !== name; });
    var stepIndex = { choose: 1, progress: 2, result: 2 }[name];
    steps.forEach(function (li) {
      var n = Number(li.dataset.step);
      li.classList.toggle('is-current', n === stepIndex);
      li.classList.toggle('is-done', n < stepIndex);
    });
  }

  function focusables() {
    return Array.prototype.filter.call(
      dialog.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])'),
      function (el) { return !el.disabled && el.offsetParent !== null; }
    );
  }

  function openDialog(trigger) {
    lastFocus = trigger || document.activeElement;
    showPane('choose');
    updateDetail();
    overlay.hidden = false;
    var first = overlay.querySelector('input[name="fa-source"]:checked');
    (first || dialog).focus();
    // 窄屏时确保对话框在可视范围内
    var rect = app.getBoundingClientRect();
    if (rect.top < 0 || rect.top > window.innerHeight * 0.6) {
      app.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
    }
  }

  function closeDialog() {
    if (overlay.hidden) return;
    clearInterval(progressTimer);
    overlay.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  app.querySelectorAll('[data-open-import]').forEach(function (b) {
    b.addEventListener('click', function () { openDialog(b); });
  });
  overlay.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', closeDialog);
  });
  // 点击对话框外部（遮罩或页面其他位置）关闭
  document.addEventListener('mousedown', function (e) {
    if (!overlay.hidden && !dialog.contains(e.target)) closeDialog();
  });
  // Esc 关闭；Tab 焦点留在对话框内
  document.addEventListener('keydown', function (e) {
    if (overlay.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return; }
    if (e.key !== 'Tab') return;
    var list = focusables();
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  $('fa-start').addEventListener('click', function () {
    var src = SOURCES[currentSource()];
    var fill = $('fa-progress-fill');
    var bar = $('fa-progressbar');
    var stageText = $('fa-progress-stage');
    var pctText = $('fa-progress-pct');
    var list = $('fa-stage-list');
    list.innerHTML = src.stages.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var items = list.querySelectorAll('li');
    showPane('progress');
    var cancelBtn = overlay.querySelector('[data-pane="progress"] [data-close]');
    if (cancelBtn) cancelBtn.focus();

    var pct = 0;
    var step = reduced() ? 10 : 2;
    var tick = function () {
      pct = Math.min(100, pct + step);
      var idx = Math.min(src.stages.length - 1, Math.floor(pct / (100 / src.stages.length)));
      fill.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', String(pct));
      pctText.textContent = pct + '%';
      stageText.textContent = pct < 100 ? src.stages[idx] + '…' : '识别完成';
      items.forEach(function (li, i) {
        li.classList.toggle('is-done', i < idx || pct >= 100);
        li.classList.toggle('is-doing', i === idx && pct < 100);
      });
      if (pct >= 100) {
        clearInterval(progressTimer);
        setTimeout(function () { if (!overlay.hidden) showResult(src); }, reduced() ? 0 : 350);
      }
    };
    fill.style.width = '0%';
    clearInterval(progressTimer);
    progressTimer = setInterval(tick, 45);
  });

  function showResult(src) {
    var n = src.review.length;
    $('fa-result-title').innerHTML = '已映射到标准科目 ' + src.mapped + ' 项，<b>' + n + ' 项需人工复核</b>';
    $('fa-quality').innerHTML =
      '<div><strong>' + src.total + '</strong><span>识别原文科目</span></div>' +
      '<div><strong>' + src.coverage + '</strong><span>核心科目覆盖</span></div>' +
      '<div><strong>' + n + '</strong><span>待复核</span></div>';
    $('fa-review').innerHTML = src.review.map(function (r) {
      return '<li><strong>' + esc(r.item) + '</strong><span class="pg">' + esc(r.sheet) + ' · ' + esc(r.page) + '</span>' +
        '<span class="why">' + esc(r.why) + '</span></li>';
    }).join('');
    showPane('result');
    $('fa-go-review').focus();
  }

  $('fa-go-review').addEventListener('click', function () {
    closeDialog();
    toast('示意：复核与入库需在真实系统中完成，此处不写入数据');
  });

  /* ---------------- 初始渲染 ---------------- */
  renderAllParts(false);

  var resizeTimer = null;
  var lastW = trendSvg.clientWidth;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (Math.abs(trendSvg.clientWidth - lastW) < 8) return;
      lastW = trendSvg.clientWidth;
      renderTrend(false);
    }, 150);
  });
})();
