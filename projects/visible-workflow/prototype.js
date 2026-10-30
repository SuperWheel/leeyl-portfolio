// Visible Workflow 子页 · 交互原型
// 只还原界面与交互：试做 → 生成流程骨架 → 节点配置与注释 → 修改提案（接受 / 拒绝）→ 示意执行。
// 不连接任何真实功能，不发起网络请求。
(function () {
  'use strict';

  var app = document.getElementById('vw-app');
  if (!app) return;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    canvas: $('vw-canvas'), wrap: $('vw-canvas-wrap'), sizer: $('vw-sizer'), board: $('vw-board'),
    edges: $('vw-edges'), edgeLayer: $('vw-edge-layer'), nodes: $('vw-nodes'), empty: $('vw-empty'),
    count: $('vw-count'), save: $('vw-save'), agent: $('vw-agent'), run: $('vw-run'), back: $('vw-back'),
    chip: $('vw-note-chip'), dock: $('vw-dock'), toast: $('vw-toast'),
    zoomIn: $('vw-zoom-in'), zoomOut: $('vw-zoom-out'), zoomFit: $('vw-zoom-fit'), zoomValue: $('vw-zoom-value'),
    pop: $('vw-pop'), popClose: $('vw-pop-close'), popMeta: $('vw-pop-meta'), popFields: $('vw-pop-fields'),
    noteInput: $('vw-note-input'), noteSave: $('vw-note-save'), noteCancel: $('vw-note-cancel')
  };

  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function wait(ms) { return reduceMQ.matches ? Math.min(ms, 120) : ms; }

  // ---------- 文案与图标（标签取自插件源码） ----------
  var KIND = { input: '用户输入', http: 'HTTP 请求', tool: '工具', llm: '大语言模型', code: '代码执行', output: '输出' };
  var ICON = {
    input: '<path d="M2.5 8h7M7 5l3 3-3 3"/><path d="M10.5 3h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2"/>',
    http: '<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c1.6 1.6 2.2 3.4 2.2 5.5S9.6 11.9 8 13.5C6.4 11.9 5.8 10.1 5.8 8S6.4 4.1 8 2.5Z"/>',
    tool: '<path d="M10 2.5a3.2 3.2 0 0 0-3 4.3L2.8 11a1.5 1.5 0 0 0 2.1 2.1L9.2 9a3.2 3.2 0 0 0 4.3-3l-2 .6-1.6-1.6.6-2Z"/>',
    llm: '<path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8l4.2-1.3Z"/>',
    code: '<path d="M5.5 4.5 2.5 8l3 3.5M10.5 4.5l3 3.5-3 3.5"/>',
    output: '<path d="M6 3H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1H6M7 8h6.5M10.5 5l3 3-3 3"/>',
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    check: '<path d="m3.5 8.5 3 3 6-7"/>',
    note: '<path d="M3 3.5h10v7H7l-3 2.5v-2.5H3z"/>',
    undo: '<path d="M3.5 6.5h6a3 3 0 0 1 0 6h-4M6 4 3.5 6.5 6 9"/>'
  };
  function svg(name, cls) { return '<svg viewBox="0 0 16 16" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + ICON[name] + '</svg>'; }
  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  var REQUEST = '抓取这个网页，提取正文后整理成摘要。以后同类网页也照这样处理。';
  var TRIAL_STEPS = [
    { html: '读取输入 <code>url</code>', sub: '你提供的网页地址' },
    { html: '第 1 次工具调用 · <code>workflow_http_request</code>', sub: '抓取网页' },
    { html: '第 2 次工具调用 · <code>workflow_html_extract_text</code>', sub: '提取正文' },
    { html: '模型整理摘要', sub: '模型跟随 DSH' },
    { html: '核对产出 <code>summary</code>', sub: '结果不为空，试做跑通' }
  ];

  function baseNodes() {
    return [
      { id: 'input', kind: 'input', title: '接收网址', sub: 'url', fixed: true,
        fields: [['输入字段', 'url · 文本 · 必填']] },
      { id: 'fetch', kind: 'http', title: '抓取网页', sub: 'GET',
        fields: [['请求方法', 'GET'], ['URL', '{{input.url}}']] },
      { id: 'extract', kind: 'tool', title: '提取正文', sub: 'html.extract_text',
        fields: [['工具', 'builtin:html.extract_text'], ['输入', { ref: 'fetch', part: '响应正文' }]] },
      { id: 'summary', kind: 'llm', title: '生成摘要', sub: '跟随 DSH',
        fields: [['模型', '跟随 DSH'], ['任务提示词', '把正文整理成摘要']] },
      { id: 'out', kind: 'output', title: '输出摘要', sub: 'summary',
        fields: [['输出名', 'summary'], ['模板', { ref: 'summary', part: '文本' }]] }
    ];
  }
  var CHECK_NODE = { id: 'check', kind: 'code', title: '检查字段', sub: 'JavaScript',
    fields: [['语言', 'JavaScript'], ['检查', '摘要非空且恰好 3 条'], ['输入', { ref: 'summary', part: '文本' }]] };

  // ---------- 状态 ----------
  var state;
  var timers = [];
  var nodeEls = {};
  var zoom = 1;
  var popFor = null;

  function freshState() {
    return {
      phase: 'idle',      // idle | trial | build | ready | thinking | notice | review | accepted | rejected
      trialDone: 0,       // 已完成的试做步骤数
      nodes: baseNodes(),
      visible: 0,         // 已出现在画布上的节点数
      revision: 0,
      notes: {},          // 节点 ID → 注释文字（保留插入顺序）
      noteOrder: [],
      updated: {},        // 接受提案后高亮的节点
      status: {},         // 示意运行时的节点状态
      running: false,
      ranOnce: false
    };
  }

  function later(fn, ms) { var id = setTimeout(fn, wait(ms)); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function numberOf(id) {
    for (var i = 0; i < state.nodes.length; i++) if (state.nodes[i].id === id) return 'a-' + (i + 1);
    return '';
  }
  function nodeById(id) {
    for (var i = 0; i < state.nodes.length; i++) if (state.nodes[i].id === id) return state.nodes[i];
    return null;
  }
  function fieldText(value) {
    if (typeof value === 'string') return value;
    var ref = nodeById(value.ref);
    return numberOf(value.ref) + ' ' + (ref ? ref.title : '') + ' · ' + value.part;
  }

  // ---------- 布局 ----------
  var NODE_W = 160, NODE_H = 68, GAP_X = 36, GAP_Y = 44, PAD = 20;

  function layout() {
    var avail = els.canvas.clientWidth || 600;
    var cols = avail >= 540 ? 3 : 2;
    NODE_W = cols === 3 ? 160 : 140;      // 窄屏两列时收窄节点，保证文字可读
    GAP_X = cols === 3 ? 36 : 28;
    app.style.setProperty('--vw-node-w', NODE_W + 'px');
    app.style.setProperty('--vw-node-h', NODE_H + 'px');
    var count = Math.max(state.nodes.length, 5);
    var rows = Math.ceil(count / cols);
    var pos = {};
    state.nodes.forEach(function (node, i) {
      var row = Math.floor(i / cols);
      var idx = i % cols;
      var col = row % 2 === 0 ? idx : cols - 1 - idx;   // 蛇形排布，换行处上下相接
      pos[node.id] = { x: PAD + col * (NODE_W + GAP_X), y: PAD + row * (NODE_H + GAP_Y) };
    });
    var W = PAD * 2 + cols * NODE_W + (cols - 1) * GAP_X;
    var H = PAD * 2 + rows * NODE_H + (rows - 1) * GAP_Y;
    return { pos: pos, W: W, H: H, avail: avail };
  }

  function edgePath(a, b) {
    var sameRow = Math.abs(a.y - b.y) < 1;
    if (sameRow) {
      var sy = a.y + NODE_H / 2;
      if (b.x > a.x) {
        var x1 = a.x + NODE_W, x2 = b.x - 2, mid = (x1 + x2) / 2;
        return 'M' + x1 + ' ' + sy + ' C' + mid + ' ' + sy + ' ' + mid + ' ' + sy + ' ' + x2 + ' ' + sy;
      }
      var lx1 = a.x, lx2 = b.x + NODE_W + 2, lmid = (lx1 + lx2) / 2;
      return 'M' + lx1 + ' ' + sy + ' C' + lmid + ' ' + sy + ' ' + lmid + ' ' + sy + ' ' + lx2 + ' ' + sy;
    }
    var cx1 = a.x + NODE_W / 2, cx2 = b.x + NODE_W / 2, y1 = a.y + NODE_H, y2 = b.y - 2, my = (y1 + y2) / 2;
    return 'M' + cx1 + ' ' + y1 + ' C' + cx1 + ' ' + my + ' ' + cx2 + ' ' + my + ' ' + cx2 + ' ' + y2;
  }

  // ---------- 渲染：画布 ----------
  function nodeInner(node) {
    var no = numberOf(node.id);
    var tag = '';
    var st = state.status[node.id];
    if (st === 'running') tag = '<span class="vw-tag" data-tone="run">运行中</span>';
    else if (st === 'success') tag = '<span class="vw-tag" data-tone="ok">已完成</span>';
    else if ((state.phase === 'notice' || state.phase === 'review') && node.id === 'summary') tag = '<span class="vw-tag" data-tone="warn">待确认</span>';
    else if (state.updated[node.id]) tag = '<span class="vw-tag" data-tone="run">' + (node.id === 'check' ? '新增' : '已更新') + '</span>';
    var pinIndex = state.noteOrder.indexOf(node.id);
    return '<span class="vw-node-top">' +
        '<span class="vw-badge" data-kind="' + node.kind + '">' + svg(node.kind) + '</span>' +
        '<span class="vw-node-title"><span class="vw-node-no">' + no + ' · </span>' + esc(node.title) + '</span>' +
        (node.fixed ? svg('lock', 'vw-lock') : '') +
      '</span>' +
      '<span class="vw-node-sub"><span>' + KIND[node.kind] + ' · ' + esc(node.sub) + '</span>' + tag + '</span>' +
      (pinIndex >= 0 ? '<span class="vw-pin" aria-hidden="true">' + (pinIndex + 1) + '</span>' : '');
  }

  function nodeLabel(node) {
    var parts = [numberOf(node.id) + ' ' + node.title, KIND[node.kind]];
    if (node.fixed) parts.push('固定节点');
    if (state.notes[node.id]) parts.push('有 1 条注释');
    return parts.join('，') + '。打开节点配置';
  }

  function renderCanvas() {
    var L = layout();
    var fit = Math.min(1, (L.avail - 16) / L.W);
    var scale = Math.max(0.4, fit * zoom);
    els.board.style.width = L.W + 'px';
    els.board.style.height = L.H + 'px';
    els.board.style.transform = 'scale(' + scale + ')';
    els.sizer.style.width = Math.round(L.W * scale) + 'px';
    els.sizer.style.height = Math.round(L.H * scale) + 'px';
    var spare = els.canvas.clientHeight - L.H * scale;
    els.sizer.style.marginTop = Math.max(8, Math.floor(spare / 2)) + 'px';
    els.sizer.style.marginBottom = '8px';
    els.edges.setAttribute('width', L.W);
    els.edges.setAttribute('height', L.H);
    els.edges.setAttribute('viewBox', '0 0 ' + L.W + ' ' + L.H);
    els.zoomValue.textContent = Math.round(scale * 100) + '%';

    var shown = state.nodes.slice(0, state.visible);
    var keep = {};
    shown.forEach(function (node) {
      keep[node.id] = true;
      var el = nodeEls[node.id];
      if (!el) {
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'vw-node is-entering';
        el.dataset.id = node.id;
        el.addEventListener('click', function () { openPop(node.id); });
        els.nodes.appendChild(el);
        nodeEls[node.id] = el;
        void el.offsetWidth;
        setTimeout(function () { el.classList.remove('is-entering'); }, 20);
      }
      var p = L.pos[node.id];
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.innerHTML = nodeInner(node);
      el.setAttribute('aria-label', nodeLabel(node));
      el.classList.toggle('is-selected', popFor === node.id);
      el.classList.toggle('is-pending', (state.phase === 'notice' || state.phase === 'review') && node.id === 'summary');
      el.classList.toggle('is-updated', !!state.updated[node.id]);
    });
    Object.keys(nodeEls).forEach(function (id) {
      if (!keep[id]) { nodeEls[id].remove(); delete nodeEls[id]; }
    });

    // 连线：按节点顺序首尾相连
    var existing = {};
    Array.prototype.forEach.call(els.edgeLayer.querySelectorAll('path'), function (path) { existing[path.dataset.key] = path; });
    var want = {};
    for (var i = 0; i + 1 < shown.length; i++) {
      var a = shown[i], b = shown[i + 1], key = a.id + '>' + b.id;
      want[key] = true;
      var path = existing[key];
      if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'vw-edge');
        path.setAttribute('marker-end', 'url(#vw-arrow)');
        path.setAttribute('pathLength', '1');
        path.dataset.key = key;
        path.style.strokeDasharray = '1';
        path.style.strokeDashoffset = '1';
        els.edgeLayer.appendChild(path);
        (function (p) { setTimeout(function () { p.style.strokeDashoffset = '0'; }, 20); })(path);
      }
      path.setAttribute('d', edgePath(L.pos[a.id], L.pos[b.id]));
      path.classList.toggle('is-hot', !!(state.updated[a.id] && state.updated[b.id]) || (b.id === 'check' && state.updated.check) || (a.id === 'check' && state.updated.check));
    }
    Object.keys(existing).forEach(function (key) { if (!want[key]) existing[key].remove(); });

    els.empty.hidden = state.visible > 0 || state.phase === 'trial';
    if (state.phase === 'trial') {
      els.empty.hidden = false;
      els.empty.querySelector('p').textContent = 'Agent 正在真实试做，跑通后再拆成流程…';
    } else if (state.visible === 0) {
      els.empty.querySelector('p').textContent = '还没有流程。先让 Agent 把任务真实做一遍。';
    }
  }

  function renderHead() {
    if (state.phase === 'build') {
      els.save.textContent = '正在生成…';
      els.save.classList.remove('is-saved');
    } else if (state.revision > 0) {
      els.save.textContent = '已保存 · v' + state.revision;
      els.save.classList.add('is-saved');
    } else {
      els.save.textContent = '尚未创建';
      els.save.classList.remove('is-saved');
    }
    var built = state.revision > 0;
    els.agent.disabled = !built || state.running || state.phase === 'thinking';
    els.run.disabled = !built || state.running;
    var n = state.noteOrder.length;
    els.chip.hidden = n === 0;
    els.chip.textContent = n + ' 条注释';

    var runText = state.running ? '运行中' : (state.ranOnce ? '已完成' : '尚未运行');
    els.count.textContent = state.visible + ' 个节点 · ' + runText;
  }

  // ---------- 渲染：右侧栏 ----------
  function trialList(limit, activeIndex) {
    var html = '<ol class="vw-steps">';
    for (var i = 0; i < limit; i++) {
      var step = TRIAL_STEPS[i];
      var done = i < state.trialDone;
      var run = i === activeIndex;
      html += '<li class="vw-step ' + (done ? 'is-done' : (run ? 'is-run' : '')) + '">' +
        '<span class="vw-step-dot">' + (done ? svg('check') : '') + '</span>' +
        '<span>' + step.html + '<small>' + step.sub + (done ? '' : (run ? ' · 运行中' : '')) + '</small></span></li>';
    }
    return html + '</ol>';
  }

  function notesQuote() {
    var n = state.noteOrder.length;
    if (!n) return '';
    var first = state.notes[state.noteOrder[0]];
    return '<p class="vw-muted">依据 ' + n + ' 条注释：「' + esc(first) + '」' + (n > 1 ? ' 等' : '') + '</p>';
  }

  function renderDock() {
    var p = state.phase;
    var html = '<div class="vw-dock-head"><h3>任务与修改</h3>' +
      (p !== 'idle' ? '<button type="button" class="vw-text-btn" data-act="reset">重新演示</button>' : '') + '</div>';

    // 1. 主对话中的需求
    html += '<section class="vw-card"><span class="vw-label">主对话 · 你的需求</span><p class="vw-bubble">' + REQUEST + '</p>';
    if (p === 'idle') {
      html += '<p class="vw-muted">先试后建：Agent 先用当前会话工具真实做一遍，跑通后再由试做记录拆成流程。</p>' +
        '<button type="button" class="vw-btn vw-btn-primary vw-btn-block" data-act="trial">让 Agent 试做</button>';
    }
    html += '</section>';

    // 2. 试做记录
    if (p === 'trial') {
      html += '<section class="vw-card"><span class="vw-label">试做记录</span>' + trialList(Math.min(state.trialDone + 1, TRIAL_STEPS.length), state.trialDone) + '</section>';
    } else if (p !== 'idle') {
      html += '<section class="vw-card"><details><summary class="vw-label">试做记录 · ' + TRIAL_STEPS.length + ' 步全部跑通</summary>' + trialList(TRIAL_STEPS.length, -1) + '</details></section>';
    }

    // 3. 当前阶段
    if (p === 'build') {
      html += '<section class="vw-card"><div class="vw-thinking"><i aria-hidden="true"></i>由试做记录生成流程骨架（' + state.visible + '/' + state.nodes.length + '）</div></section>';
    } else if (p === 'ready') {
      html += '<section class="vw-card"><p>流程已创建并保存为 v1。点击节点可查看配置、添加注释；需要调整时点「交给 Agent」。</p>' +
        '<p class="vw-muted">a-1 已固定，Agent 不会自动修改它。</p></section>';
    } else if (p === 'thinking') {
      html += '<section class="vw-card"><div class="vw-thinking"><i aria-hidden="true"></i>Agent 正在生成修改提案…</div>' + notesQuote() + '</section>';
    } else if (p === 'notice') {
      html += '<section class="vw-card vw-proposal" id="vw-focus-target" tabindex="-1">' +
        '<div class="vw-proposal-head"><span class="vw-proposal-badge">' + svg('note') + '修改请求</span><span class="vw-proposal-count">1 项待确认</span></div>' +
        '<p>Agent 提交了修改，等待你确认。</p>' +
        '<div class="vw-actions"><button type="button" class="vw-btn vw-btn-primary vw-btn-sm" data-act="review">查看修改</button></div></section>';
    } else if (p === 'review') {
      html += '<section class="vw-card vw-proposal" id="vw-focus-target" tabindex="-1" aria-label="查看修改提案">' +
        '<div class="vw-proposal-head"><span class="vw-proposal-badge">' + svg('note') + '查看修改提案</span><span class="vw-proposal-count">提案基础 v1 · 当前 v1</span></div>' +
        '<p>把摘要改为 3 条要点，并在输出前增加一步字段检查。</p>' + notesQuote() +
        '<div class="vw-scope"><strong>影响范围</strong><p>新增 1 个节点 · 修改 1 个节点 · 删除 0 个节点</p><p>主图连线变化</p></div>' +
        '<ul class="vw-changes">' +
          '<li class="vw-change"><span class="vw-change-kind" data-k="edit">修改</span><b>a-4 · 生成摘要</b><span class="vw-diff">任务提示词：<del>把正文整理成摘要</del> → <ins>把正文整理成 3 条要点摘要</ins></span></li>' +
          '<li class="vw-change"><span class="vw-change-kind" data-k="add">新增</span><b>a-5 · 检查字段</b><span class="vw-diff">代码执行 · 插入在 a-4 与「输出摘要」之间</span></li>' +
          '<li class="vw-change"><span class="vw-change-kind">不变</span><b>a-1 · 接收网址</b><span class="vw-diff">固定节点，未改动</span></li>' +
        '</ul>' +
        '<p class="vw-muted">接受后将校验固定节点、引用、类型及版本，再保存新定义；拒绝则画布保持不变。</p>' +
        '<div class="vw-actions">' +
          '<button type="button" class="vw-btn vw-btn-sm" data-act="reject"' + (state.running ? ' disabled' : '') + '>拒绝修改</button>' +
          '<button type="button" class="vw-btn vw-btn-primary vw-btn-sm" data-act="accept"' + (state.running ? ' disabled' : '') + '>接受并应用</button>' +
        '</div>' + (state.running ? '<p class="vw-muted">运行结束后再处理提案。</p>' : '') + '</section>';
    } else if (p === 'accepted') {
      html += '<section class="vw-card" id="vw-focus-target" tabindex="-1"><div class="vw-result" data-tone="ok">' + svg('check') +
        '<div><p><strong>已接受并应用 · 已保存 v2</strong></p>' +
        '<ul class="vw-changes" style="margin-top:6px">' +
          '<li class="vw-change"><span class="vw-change-kind" data-k="add">新增</span>a-5 · 检查字段</li>' +
          '<li class="vw-change"><span class="vw-change-kind" data-k="edit">修改</span>a-4 · 生成摘要</li>' +
        '</ul>' +
        '<p class="vw-muted" style="margin-top:6px">结构编号随结构调整：「输出摘要」由 a-5 变为 a-6；节点身份与引用不变。</p></div></div></section>';
    } else if (p === 'rejected') {
      html += '<section class="vw-card" id="vw-focus-target" tabindex="-1"><div class="vw-result" data-tone="back">' + svg('undo') +
        '<div><p><strong>提案已退回</strong></p><p class="vw-muted">审核先于写入：画布与已保存的 v1 保持不变，提案内容没有写入。</p></div></div>' +
        '<div class="vw-actions"><button type="button" class="vw-btn vw-btn-sm" data-act="agent">再次交给 Agent</button></div></section>';
    }

    els.dock.innerHTML = html;
    if (els.dock.scrollHeight > els.dock.clientHeight) els.dock.scrollTop = els.dock.scrollHeight;
  }

  function render() { renderCanvas(); renderHead(); renderDock(); }

  function focusDockTarget() {
    var t = document.getElementById('vw-focus-target');
    if (t) t.focus({ preventScroll: true });
  }

  // ---------- 提示条 ----------
  var toastTimer = 0;
  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('is-on'); }, 2600);
  }

  // ---------- 流程：试做 → 拆成流程 ----------
  function startTrial() {
    closePop(false);
    state.phase = 'trial';
    state.trialDone = 0;
    render();
    var step = function () {
      state.trialDone += 1;
      if (state.trialDone >= TRIAL_STEPS.length) {
        later(startBuild, 500);
      } else {
        later(step, 700);
      }
      render();
    };
    later(step, 800);
  }

  function startBuild() {
    state.phase = 'build';
    state.visible = 0;
    render();
    var add = function () {
      state.visible += 1;
      if (state.visible >= state.nodes.length) {
        later(function () {
          state.phase = 'ready';
          state.revision = 1;
          render();
          toast('流程已创建并保存为 v1');
        }, 450);
      } else {
        later(add, 520);
      }
      render();
    };
    later(add, 300);
  }

  // ---------- 修改提案 ----------
  function askAgent() {
    if (state.running) return;
    closePop(false);
    if (state.phase === 'accepted') { toast('示意原型只准备了一份提案，可点「重新演示」再看一遍'); return; }
    if (state.phase === 'notice' || state.phase === 'review') { toast('已有 1 项修改请求待确认'); focusDockTarget(); return; }
    state.phase = 'thinking';
    render();
    later(function () {
      state.phase = 'notice';
      render();
      toast('Agent 提交了修改，等待你确认');
      focusDockTarget();
    }, 1100);
  }

  function accept() {
    if (state.running) return;
    var summary = nodeById('summary');
    summary.fields = [['模型', '跟随 DSH'], ['任务提示词', '把正文整理成 3 条要点摘要', true]];
    var idx = state.nodes.indexOf(summary);
    state.nodes.splice(idx + 1, 0, JSON.parse(JSON.stringify(CHECK_NODE)));
    state.visible = state.nodes.length;
    state.revision = 2;
    state.updated = { summary: true, check: true };
    state.status = {};
    state.ranOnce = false;
    state.phase = 'accepted';
    render();
    ['summary', 'check'].forEach(function (id) {
      var el = nodeEls[id];
      if (el) { el.classList.add('is-glow'); later(function () { el.classList.remove('is-glow'); }, 2800); }
    });
    toast('已接受并应用，已保存 v2');
    focusDockTarget();
  }

  function reject() {
    if (state.running) return;
    state.phase = 'rejected';
    render();
    toast('已拒绝修改，画布保持 v1 不变');
    focusDockTarget();
  }

  // ---------- 示意执行 ----------
  function runFlow() {
    if (state.running || state.revision === 0) return;
    closePop(false);
    state.running = true;
    state.status = {};
    render();
    var ids = state.nodes.map(function (n) { return n.id; });
    var i = 0;
    var tick = function () {
      if (i > 0) state.status[ids[i - 1]] = 'success';
      if (i < ids.length) {
        state.status[ids[i]] = 'running';
        i += 1;
        render();
        later(tick, 600);
      } else {
        state.running = false;
        state.ranOnce = true;
        render();
        toast('示意运行结束：节点状态为演示，未连接真实执行');
      }
    };
    tick();
  }

  // ---------- 节点配置浮层 ----------
  var popReturn = null;

  function openPop(id) {
    if (state.phase === 'build' || state.phase === 'trial') return;
    var node = nodeById(id);
    if (!node) return;
    popFor = id;
    popReturn = nodeEls[id] || null;
    els.popMeta.innerHTML =
      '<dt>节点编号</dt><dd>' + numberOf(id) + '</dd>' +
      '<dt>类型</dt><dd>' + KIND[node.kind] + '</dd>' +
      '<dt>节点名称</dt><dd>' + esc(node.title) + '</dd>' +
      (node.fixed ? '<dt>固定节点</dt><dd class="vw-fixed">保护它不被 Agent 自动修改</dd>' : '');
    els.popFields.innerHTML = node.fields.map(function (f) {
      return '<div class="vw-field' + (f[2] ? ' is-changed' : '') + '"><span>' + esc(f[0]) + '</span><code>' + esc(fieldText(f[1])) + '</code></div>';
    }).join('');
    els.noteInput.value = state.notes[id] || '';
    els.pop.hidden = false;
    placePop(id);
    renderCanvas();
    els.popClose.focus({ preventScroll: true });
  }

  function placePop(id) {
    var el = nodeEls[id];
    if (!el) return;
    var wrapRect = els.wrap.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    var pw = els.pop.offsetWidth, ph = els.pop.offsetHeight;
    var W = wrapRect.width, H = wrapRect.height, gap = 8;
    var nl = r.left - wrapRect.left, nr = r.right - wrapRect.left, nt = r.top - wrapRect.top, nb = r.bottom - wrapRect.top;
    var clampX = function (x) { return Math.max(gap, Math.min(x, W - pw - gap)); };
    var clampY = function (y) { return Math.max(gap, Math.min(y, H - ph - gap)); };
    var left, top;
    if (nb + gap + ph <= H - gap) { left = clampX(nl); top = nb + gap; }            // 节点下方
    else if (nt - gap - ph >= gap) { left = clampX(nl); top = nt - gap - ph; }      // 节点上方
    else if (nr + gap + pw <= W - gap) { left = nr + gap; top = clampY(nt); }       // 节点右侧
    else if (nl - gap - pw >= gap) { left = nl - gap - pw; top = clampY(nt); }      // 节点左侧
    else { left = clampX(nl); top = clampY(nb + gap); }                            // 窄屏：尽量贴近
    els.pop.style.left = left + 'px';
    els.pop.style.top = top + 'px';
  }

  function closePop(returnFocus) {
    if (els.pop.hidden) return;
    els.pop.hidden = true;
    var back = popReturn;
    popFor = null;
    popReturn = null;
    renderCanvas();
    if (returnFocus && back && document.body.contains(back)) back.focus({ preventScroll: true });
  }

  function saveNote() {
    var id = popFor;
    if (!id) return;
    var text = els.noteInput.value.trim();
    var had = !!state.notes[id];
    if (text) {
      state.notes[id] = text;
      if (state.noteOrder.indexOf(id) < 0) state.noteOrder.push(id);
    } else {
      delete state.notes[id];
      state.noteOrder = state.noteOrder.filter(function (x) { return x !== id; });
    }
    closePop(true);
    renderHead();
    renderCanvas();
    if (text) toast('已添加注释，仅保存到聊天草稿');
    else if (had) toast('已删除注释');
  }

  // ---------- 事件 ----------
  els.dock.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.dataset.act;
    if (act === 'trial') startTrial();
    else if (act === 'review') { state.phase = 'review'; render(); focusDockTarget(); }
    else if (act === 'accept') accept();
    else if (act === 'reject') reject();
    else if (act === 'agent') askAgent();
    else if (act === 'reset') reset();
  });
  els.agent.addEventListener('click', askAgent);
  els.run.addEventListener('click', runFlow);
  els.back.addEventListener('click', function () { toast('示意原型只还原画布页'); });
  els.popClose.addEventListener('click', function () { closePop(true); });
  els.noteCancel.addEventListener('click', function () { closePop(true); });
  els.noteSave.addEventListener('click', saveNote);
  els.noteInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !els.pop.hidden) { e.preventDefault(); closePop(true); }
  });
  document.addEventListener('pointerdown', function (e) {
    if (els.pop.hidden) return;
    if (els.pop.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.vw-node')) return;   // 点击其他节点会直接切换
    closePop(false);
  });
  els.canvas.addEventListener('scroll', function () { if (popFor) placePop(popFor); }, { passive: true });

  function setZoom(next) {
    zoom = Math.max(0.6, Math.min(1.6, Math.round(next * 10) / 10));
    renderCanvas();
    if (popFor) placePop(popFor);
  }
  els.zoomIn.addEventListener('click', function () { setZoom(zoom + 0.1); });
  els.zoomOut.addEventListener('click', function () { setZoom(zoom - 0.1); });
  els.zoomFit.addEventListener('click', function () { setZoom(1); els.canvas.scrollTo({ left: 0, top: 0 }); });

  var lastWidth = 0;
  function onResize() {
    var w = els.canvas.clientWidth;
    if (w === lastWidth) return;
    lastWidth = w;
    renderCanvas();
    if (popFor) placePop(popFor);
  }
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(els.canvas);
  else window.addEventListener('resize', onResize);

  function reset() {
    clearTimers();
    closePop(false);
    state = freshState();
    zoom = 1;
    render();
    var trialBtn = els.dock.querySelector('[data-act="trial"]');
    if (trialBtn) trialBtn.focus({ preventScroll: true });
  }

  state = freshState();
  render();
})();
