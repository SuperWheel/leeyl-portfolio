// Visible Workflow 子页 · 交互原型（全屏画布页还原）
// 只还原界面与交互：节点面板、节点配置、注释、修改提案、示意执行、缩放与缩略图、让 Agent 试做。
// 界面文字取自插件源码；不连接任何真实功能，不发起网络请求。
(function () {
  'use strict';

  var app = document.getElementById('vw-app');
  if (!app) return;
  var $ = function (id) { return document.getElementById(id); };
  var E = {
    viewport: $('vw-viewport'), world: $('vw-world'), edges: $('vw-edges'), nodes: $('vw-nodes'), stickies: $('vw-stickies'),
    float: $('vw-float'), topLeft: $('vw-top-left'), topRight: $('vw-top-right'), toolbar: $('vw-toolbar'),
    picker: $('vw-picker'), side: $('vw-side'), notice: $('vw-notice'), config: $('vw-config'),
    bottomLeft: $('vw-bottom-left'), bottomRight: $('vw-bottom-right'), notePop: $('vw-note-pop'), runs: $('vw-runs'),
    modal: $('vw-modal'), toast: $('vw-toast'), demoTrial: $('vw-demo-trial'), demoReset: $('vw-demo-reset')
  };
  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function wait(ms) { return reduceMQ.matches ? Math.min(ms, 120) : ms; }

  // ---------- 图标 ----------
  var P = {
    plus: '<path d="M8 3.5v9M3.5 8h9"/>',
    minus: '<path d="M3.5 8h9"/>',
    close: '<path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/>',
    chevL: '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
    chevD: '<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>',
    chevU: '<path d="m4.5 9.5 3.5-3.5 3.5 3.5"/>',
    doc: '<path d="M4 2.5h5.5L12 5v8.5H4z"/><path d="M6 7.5h4M6 10h4"/>',
    sticky: '<path d="M3 2.5h10v7l-4 4H3z"/><path d="M9 13.5v-4h4"/>',
    pointer: '<path d="m4 2.5 8.2 5.3-3.7.9 2 3.6-1.6.9-2-3.6-2.8 2.6z"/>',
    hand: '<path d="M5.5 8.2V4.2a1 1 0 0 1 2 0v3.3M7.5 7V3.2a1 1 0 0 1 2 0V7M9.5 7.2V4.4a1 1 0 0 1 2 0v4.4c0 2.6-1.7 4.7-4.1 4.7-1.8 0-2.9-1-3.9-2.7L2.6 8.4a1 1 0 0 1 1.7-1.1l1.2 1.5"/>',
    arrange: '<rect x="2.5" y="2.5" width="4.2" height="4.2" rx="1"/><rect x="9.3" y="2.5" width="4.2" height="4.2" rx="1"/><rect x="2.5" y="9.3" width="4.2" height="4.2" rx="1"/><rect x="9.3" y="9.3" width="4.2" height="4.2" rx="1"/>',
    list: '<path d="M6 4h7.5M6 8h7.5M6 12h7.5M2.8 4h.01M2.8 8h.01M2.8 12h.01"/>',
    settings: '<circle cx="8" cy="8" r="2.3"/><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2"/>',
    upload: '<path d="M8 10.5V3M5 5.8 8 3l3 2.8M3 10.5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2"/>',
    download: '<path d="M8 3v7.5M5 7.7l3 2.8 3-2.8M3 10.5v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2"/>',
    save: '<path d="M3.5 2.5h7l2 2v9h-9z"/><path d="M5.5 2.5v3h4v-3M5.5 13.5v-4h5v4"/>',
    saveAs: '<path d="M12.5 7V4.5l-2-2h-7v11H7"/><path d="M5.5 2.5v3h4v-3"/><path d="m9 13.5.4-1.9 3.1-3.1 1.5 1.5-3.1 3.1z"/>',
    comment: '<path d="M2.5 3.5h11V11H6.7l-3 2.3V11H2.5z"/>',
    copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>',
    trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.5"/>',
    brain: '<path d="M6.2 2.6a2.3 2.3 0 0 0-2.3 2.8 2.4 2.4 0 0 0 .2 4.5 2.3 2.3 0 0 0 3.9 1.6V4.2a1.6 1.6 0 0 0-1.8-1.6Z"/><path d="M9.8 2.6a2.3 2.3 0 0 1 2.3 2.8 2.4 2.4 0 0 1-.2 4.5A2.3 2.3 0 0 1 8 11.5"/>',
    play: '<path d="M5 3.2v9.6L12.6 8z"/>',
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    unlock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 4.8-1"/>',
    info: '<circle cx="8" cy="8" r="5.8"/><path d="M8 7.3V11M8 5h.01"/>',
    help: '<circle cx="8" cy="8" r="5.8"/><path d="M6.4 6.4a1.7 1.7 0 0 1 3.2.6c0 1.1-1.6 1.4-1.6 2.3M8 11h.01"/>',
    search: '<circle cx="7" cy="7" r="4.2"/><path d="m10.2 10.2 3.3 3.3"/>',
    undo: '<path d="M3 6.5h6.5a3.5 3.5 0 0 1 0 7H7"/><path d="M5.5 4 3 6.5 5.5 9"/>',
    redo: '<path d="M13 6.5H6.5a3.5 3.5 0 0 0 0 7H9"/><path d="M10.5 4 13 6.5 10.5 9"/>',
    history: '<path d="M2.8 8a5.2 5.2 0 1 0 1.5-3.7"/><path d="M2.6 2.8v2.6h2.6M8 5.5V8l1.8 1.2"/>',
    fit: '<path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/><rect x="5.5" y="5.5" width="5" height="5" rx="1"/>',
    check: '<path d="m3.5 8.5 3 3 6-7"/>',
    code: '<path d="M5.5 4.5 2.5 8l3 3.5M10.5 4.5l3 3.5-3 3.5"/>',
    exit: '<path d="M6 3H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1H6M7 8h6.5M10.5 5l3 3-3 3"/>',
    branch: '<path d="M4.5 2.5v11M4.5 5.5c0 2.2 1.6 3.3 4 3.3h3"/><path d="m9.6 6.8 2 2-2 2"/>',
    person: '<circle cx="8" cy="5.3" r="2.5"/><path d="M3.5 13.5a4.5 4.5 0 0 1 9 0"/>',
    loop: '<path d="M12.6 6.4A4.8 4.8 0 0 0 4 5M3.4 9.6A4.8 4.8 0 0 0 12 11"/><path d="M3.8 2.6V5h2.5M12.2 13.4V11H9.7"/>',
    merge: '<path d="m4 3 4 5 4-5M8 8v5.5"/>',
    filter: '<path d="M2.5 3.5h11l-4.3 5v4.5l-2.4-1V8.5z"/>',
    globe: '<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c1.6 1.6 2.2 3.4 2.2 5.5S9.6 11.9 8 13.5C6.4 11.9 5.8 10.1 5.8 8S6.4 4.1 8 2.5Z"/>',
    tool: '<path d="M10 2.5a3.2 3.2 0 0 0-3 4.3L2.8 11a1.5 1.5 0 0 0 2.1 2.1L9.2 9a3.2 3.2 0 0 0 4.3-3l-2 .6-1.6-1.6.6-2Z"/>',
    assign: '<path d="M3 6h10M3 10h10"/>'
  };
  function ic(name, size) {
    size = size || 16;
    return '<svg viewBox="0 0 16 16" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">' + P[name] + '</svg>';
  }
  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // ---------- 节点类型（名称、分组、颜色、说明取自源码 NODE_DEFINITIONS / NODE_LABELS） ----------
  var KINDS = [
    ['agent', 'Agent', '基础', 'violet', 'brain', '根据任务自主选择已授权工具，在限定步骤内完成任务。'],
    ['llm', '大语言模型', '基础', 'blue', 'brain', '默认使用 DSH 已配置的模型，也可为此节点指定模型；结合角色提示词和输入生成内容。'],
    ['knowledge', '知识检索', '基础', 'green', 'doc', '从指定的知识来源检索相关片段，供下游模型引用。'],
    ['output', '输出', '基础', 'orange', 'exit', '声明流程结果并输出内容。其他并行分支继续执行。'],
    ['classifier', '问题分类器', '问题理解', 'blue', 'branch', '通过模型理解输入，并路由到一个匹配的问题类别。'],
    ['if', '条件分支', '逻辑', 'cyan', 'branch', '按顺序检查条件组，执行第一个匹配分支或 ELSE。'],
    ['human', '人工介入', '逻辑', 'green', 'person', '暂停运行，等待用户填写表单并选择后续行动。'],
    ['iteration', '迭代', '逻辑', 'violet', 'arrange', '遍历输入数组，对每一项运行内部流程并收集输出。'],
    ['loop', '循环', '逻辑', 'violet', 'loop', '重复执行内部流程，直到条件成立或达到次数上限。'],
    ['code', '代码执行', '转换', 'blue', 'code', '用 JavaScript 或 Python 处理具名输入，返回结构化结果。'],
    ['template', '模板转换', '转换', 'blue', 'doc', '用模板和变量将上游数据转换为文本。'],
    ['aggregator', '变量聚合器', '转换', 'cyan', 'merge', '合并互斥分支，取实际执行分支的变量值。'],
    ['document', '文档提取器', '转换', 'green', 'doc', '从一个或多个文档提取文字，保留输入文件顺序。'],
    ['assigner', '变量赋值', '转换', 'cyan', 'assign', '设置或更新运行变量，用于传递状态或控制循环。'],
    ['extractor', '参数提取器', '转换', 'blue', 'filter', '使用模型从文本中提取符合指定类型的参数。'],
    ['http', 'HTTP 请求', '工具', 'orange', 'globe', '发送普通 HTTP 请求，或通过受保护凭据代理执行固定操作。'],
    ['list', '列表操作', '工具', 'cyan', 'list', '过滤、排序和截取数组，输出列表及首尾记录。'],
    ['input', '用户输入', '开始', 'blue', 'play', '定义执行时的输入字段，缺少必填信息时询问用户。'],
    ['tool', '工具', '工具', 'orange', 'tool', '运行宿主中可用的具体工具操作，参数由工具定义。']
  ];
  var K = {};
  KINDS.forEach(function (k) { K[k[0]] = { kind: k[0], label: k[1], group: k[2], color: k[3], icon: k[4], desc: k[5] }; });
  function badge(kind, small) {
    var d = K[kind];
    return '<span class="vw-badge tone-' + d.color + (small ? ' is-sm' : '') + '" aria-hidden="true">' + ic(d.icon, small ? 10 : 13) + '</span>';
  }

  // 内置工具（取自源码 builtin-tools.ts）
  var TOOLS = [
    { provider: '时间', ops: [['当前时间', '获取当前时间，可指定 IANA 时区。'], ['当前时间戳', '返回 Unix 秒和毫秒时间戳。'], ['时间戳转换', '将 Unix 时间戳转为日期时间。'], ['时区转换', '将带时区的 ISO 日期时间转换到指定时区。'], ['星期几', '返回日期所在星期；日期默认当前时刻。']] },
    { provider: 'JSON 处理', ops: [['解析 JSON', '将 JSON 文本解析为结构化值。'], ['生成 JSON 文本', '将 JSON 值序列化为文本。'], ['读取 JSON 路径', '通过点分隔键或数组下标读取 JSON 字段。'], ['合并 JSON 对象', '浅合并对象；右侧同名字段覆盖左侧。']] },
    { provider: 'HTML 处理', ops: [['提取网页正文', '从 HTML 中提取页面标题和可读正文，不执行脚本，不访问网络。'], ['提取网页列表/链接', '按 CSS 选择器从 HTML 中提取多条记录的文本或属性。']] },
    { provider: '文件', ops: [['文件信息', '统计当前工作区内一个文件的字节数、行数、行尾类型和 UTF-8 BOM；只读，不返回内容。']] }
  ];
  var TOOL_CATS = ['全部', '工具插件', 'Swagger API', '工作流', 'MCP'];

  // ---------- 示例流程 ----------
  var NODE_W = 220, NODE_H = 72, BOX_W = 430, BOX_H = 176, GAP = 40;
  function exampleNodes() {
    return [
      { id: 'n_input', kind: 'input', title: '接收网址列表', x: 40, y: 140,
        cfg: { fields: [{ name: 'urls', label: '网址列表', type: '段落', required: true }] } },
      { id: 'n_split', kind: 'code', title: '拆分网址', x: 300, y: 140,
        cfg: { map: '{\n  "urls": "{{input.urls}}"\n}', lang: 'JavaScript',
          code: "function main(inputs) {\n  var list = inputs.urls.split('\\n').filter(Boolean)\n  return { list: list }\n}", out: 'list' } },
      { id: 'n_batch', kind: 'iteration', title: '逐个整理', x: 560, y: 140,
        children: [{ kind: 'http', title: '抓取网页' }, { kind: 'tool', title: '提取网页正文' }, { kind: 'llm', title: '生成摘要' }],
        cfg: { iterator: 'n_split.list', parallel: false, concurrency: 2, output: 'n_sum.text', error: '终止迭代' } },
      { id: 'n_out', kind: 'output', title: '输出摘要表', x: 1030, y: 140,
        cfg: { text: '{{n_batch.output}}', name: 'result' } }
    ];
  }
  var EXAMPLE_EDGES = [['n_input', 'n_split'], ['n_split', 'n_batch'], ['n_batch', 'n_out']];
  var CHECK_NODE = { id: 'n_check', kind: 'code', title: '检查摘要', x: 1030, y: 140,
    cfg: { map: '{\n  "rows": "{{n_batch.output}}"\n}', lang: 'JavaScript',
      code: "function main(inputs) {\n  var rows = inputs.rows.filter(function (r) { return r && r.length })\n  return { rows: rows }\n}", out: 'rows' } };
  var OUT_AFTER = '{{n_check.rows}}';

  function defaultCfg(kind) {
    switch (kind) {
      case 'llm': return { model: '跟随 DSH', effort: '自动', preset: '不使用角色预设', prompt: '请处理以下内容：\n{{input.text}}' };
      case 'agent': return { prompt: '完成以下任务：\n{{input.text}}', maxSteps: 6 };
      case 'code': return { map: '{\n  "text": "{{input.text}}"\n}', lang: 'JavaScript', code: 'function main(inputs) {\n  return { result: inputs.text }\n}', out: 'result' };
      case 'template': return { map: '{\n  "text": "{{input.text}}"\n}', text: '{{text}}' };
      case 'output': return { text: '{{input.text}}', name: 'result' };
      case 'iteration': return { iterator: 'input.items', parallel: false, concurrency: 2, output: '', error: '终止迭代' };
      case 'loop': return { max: 10, until: true };
      case 'classifier': return { classes: ['类别 1', '类别 2'] };
      case 'if': return { cond: 'input.text 不为空' };
      case 'human': return { actions: ['通过', '需要修改'] };
      case 'http': return { method: 'GET', url: '' };
      case 'input': return { fields: [{ name: 'text', label: '输入文本', type: '段落', required: true }] };
      default: return {};
    }
  }
  function subLine(n) {
    var c = n.cfg || {};
    switch (n.kind) {
      case 'input': return (c.fields || []).map(function (f) { return f.name + (f.required ? ' *' : ''); }).join(' · ') || '用户输入';
      case 'code': {
        var keys = [];
        try { keys = Object.keys(JSON.parse(c.map || '{}')); } catch (e) { keys = []; }
        return c.lang + (keys.length ? ' · ' + keys.join(', ') : '');
      }
      case 'iteration': return (c.iterator || '未设置数组') + ' · ' + (c.parallel ? '并行 ' + c.concurrency : '顺序');
      case 'loop': return '最多 ' + c.max + ' 轮';
      case 'output': return c.name || 'result';
      case 'llm': return c.model + ' · ' + c.effort;
      case 'http': return c.method + (c.url ? ' · ' + c.url : '');
      case 'agent': return '最多 ' + c.maxSteps + ' 步';
      case 'tool': return '工作流内置';
      default: return K[n.kind].label;
    }
  }
  function isBox(n) { return n.kind === 'iteration' || n.kind === 'loop'; }
  function nodeW(n) { return isBox(n) ? BOX_W : NODE_W; }
  function nodeH(n) { return isBox(n) ? BOX_H : NODE_H; }

  // ---------- 状态 ----------
  var S, timers = [], seq = 0;
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function freshState() {
    return {
      title: '批量整理网页摘要', revision: 3, dirty: false,
      nodes: exampleNodes(), edges: clone(EXAMPLE_EDGES), notes: {}, noteOrder: [], stickies: [],
      selected: null, tab: 'settings', about: false,
      picker: false, pickerTab: 'nodes', search: '', agentOpen: false, toolCat: '全部', toolOpen: {},
      mode: 'pointer', view: { x: 0, y: 0, s: 0.8 }, minimap: true,
      proposal: { base: 3, at: Date.now() }, accepted: false, highlight: {},
      running: false, status: {}, child: {}, lastRun: {}, runs: [],
      history: [], future: [], trial: null, modal: false, notePop: null, runsPop: false
    };
  }
  function later(fn, ms) { timers.push(setTimeout(fn, wait(ms))); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function byId(id) { for (var i = 0; i < S.nodes.length; i++) if (S.nodes[i].id === id) return S.nodes[i]; return null; }
  function hasEdge(a, b) { return S.edges.some(function (e) { return e[0] === a && e[1] === b; }); }
  function narrow() { return app.classList.contains('is-narrow'); }

  function snapshot() { return clone({ nodes: S.nodes, edges: S.edges, notes: S.notes, noteOrder: S.noteOrder, stickies: S.stickies }); }
  function restore(snap) { S.nodes = snap.nodes; S.edges = snap.edges; S.notes = snap.notes; S.noteOrder = snap.noteOrder; S.stickies = snap.stickies; }
  function remember() { S.history.push(snapshot()); if (S.history.length > 40) S.history.shift(); S.future = []; }
  function touch() { S.dirty = true; }

  // 结构编号：主路径 a-N，其余独立路径依次 b、c…（规则见源码 docs/节点编号与引用规则.md）
  function numbers() {
    var map = {}, seen = {}, letters = 'abcdefghijklmnopqrstuvwxyz';
    var incoming = {}, next = {};
    S.edges.forEach(function (e) { incoming[e[1]] = true; next[e[0]] = e[1]; });
    var starts = S.nodes.filter(function (n) { return !incoming[n.id]; });
    starts.sort(function (a, b) {
      var ai = a.kind === 'input' ? 0 : 1, bi = b.kind === 'input' ? 0 : 1;
      return ai - bi || a.x - b.x || a.y - b.y;
    });
    var li = 0;
    starts.forEach(function (start) {
      if (seen[start.id]) return;
      var letter = letters[li++] || 'z', i = 1, cur = start.id;
      while (cur && !seen[cur]) { seen[cur] = true; map[cur] = letter + '-' + i++; cur = next[cur]; }
    });
    S.nodes.forEach(function (n) { if (!map[n.id]) map[n.id] = (letters[li++] || 'z') + '-1'; });
    return map;
  }
  function mainOrder() {
    var nums = numbers();
    return S.nodes.filter(function (n) { return /^a-/.test(nums[n.id]); })
      .sort(function (a, b) { return parseInt(nums[a.id].slice(2), 10) - parseInt(nums[b.id].slice(2), 10); })
      .map(function (n) { return n.id; });
  }

  // ---------- 视图 ----------
  function applyView() {
    E.world.style.transform = 'translate(' + S.view.x + 'px,' + S.view.y + 'px) scale(' + S.view.s + ')';
    var z = E.bottomRight.querySelector('.vw-zoom-value');
    if (z) z.textContent = Math.round(S.view.s * 100) + '%';
    renderMinimap();
  }
  function bounds(list) {
    list = list || S.nodes;
    var items = list.map(function (n) { return [n.x, n.y, n.x + nodeW(n), n.y + nodeH(n)]; })
      .concat(S.stickies.map(function (s) { return [s.x, s.y, s.x + 200, s.y + 110]; }));
    if (!items.length) return { x: 0, y: 0, w: 800, h: 400 };
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    items.forEach(function (b) { x1 = Math.min(x1, b[0]); y1 = Math.min(y1, b[1]); x2 = Math.max(x2, b[2]); y2 = Math.max(y2, b[3]); });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  function availRect() {
    var W = E.viewport.clientWidth, H = E.viewport.clientHeight;
    if (narrow()) return { l: 54, t: 112, r: W - 10, b: H - 60 };
    var right = W - 16 - (S.selected ? 340 : 0);
    return { l: 72, t: 72, r: right, b: H - 72 };
  }
  function fitView(list) {
    var b = bounds(list), a = availRect();
    var aw = Math.max(120, a.r - a.l), ah = Math.max(120, a.b - a.t);
    var s = Math.max(narrow() ? 0.55 : 0.5, Math.min(1, aw / (b.w + 40), ah / (b.h + 40)));
    S.view.s = Math.round(s * 100) / 100;
    var spare = aw - b.w * S.view.s;
    // 放不下时左对齐，先看到流程起点，再拖动或缩放查看其余部分
    S.view.x = a.l + (spare > 0 ? spare / 2 : 0) - b.x * S.view.s;
    S.view.y = a.t + (ah - b.h * S.view.s) / 2 - b.y * S.view.s;
    applyView();
  }
  function zoomBy(delta) {
    var W = E.viewport.clientWidth / 2, H = E.viewport.clientHeight / 2;
    var s0 = S.view.s, s1 = Math.max(0.3, Math.min(2, Math.round((s0 + delta) * 10) / 10));
    S.view.x = W - (W - S.view.x) * (s1 / s0);
    S.view.y = H - (H - S.view.y) * (s1 / s0);
    S.view.s = s1;
    applyView();
  }

  // ---------- 渲染：节点与连线 ----------
  function nodeHtml(n, nums) {
    var st = S.status[n.id];
    var status = st === 'running' ? '<span class="vw-st is-run"><i></i>运行中</span>' :
      st === 'success' ? '<span class="vw-st is-ok">' + ic('check', 12) + '已完成</span>' : '';
    var pin = S.noteOrder.indexOf(n.id);
    var html = '<div class="vw-node-head">' + badge(n.kind) +
      '<span class="vw-node-name"><span class="vw-node-no">' + nums[n.id] + ' · </span>' + esc(n.title) + '</span>' +
      (n.fixed ? '<span class="vw-node-lock" title="已固定">' + ic('lock', 12) + '</span>' : '') + status + '</div>' +
      '<div class="vw-node-sub">' + esc(subLine(n)) + '</div>';
    if (n.children) {
      var cs = S.child[n.id];
      html += '<div class="vw-box-body"><div class="vw-chips">' + n.children.map(function (c, i) {
        var cls = '';
        if (cs === i) cls = ' is-run';
        else if ((typeof cs === 'number' && cs > i) || st === 'success') cls = ' is-ok';
        return '<span class="vw-chip' + cls + '">' + badge(c.kind, true) + esc(c.title) + '</span>';
      }).join('') + '</div>' +
      '<button type="button" class="vw-box-edit" data-act="edit-inner">编辑内部流程 · ' + n.children.length + ' 个节点</button></div>';
    }
    html += '<span class="vw-port is-in" aria-hidden="true"></span><span class="vw-port is-out" aria-hidden="true"></span>';
    if (pin >= 0) html += '<button type="button" class="vw-pin" data-act="pin" aria-label="编辑第 ' + (pin + 1) + ' 条注释">' + (pin + 1) + '</button>';
    return html;
  }
  function renderNodes() {
    var nums = numbers();
    var ae = document.activeElement;
    var focusId = ae && ae.classList && ae.classList.contains('vw-node') ? ae.dataset.id : null;
    E.nodes.innerHTML = S.nodes.map(function (n) {
      var cls = 'vw-node' + (n.children ? ' is-box' : '') + (S.selected === n.id ? ' is-selected' : '') +
        (S.status[n.id] === 'running' ? ' is-running' : S.status[n.id] === 'success' ? ' is-done' : '') +
        (S.highlight[n.id] ? ' is-changed' : '') + (n.entering ? ' is-entering' : '');
      var label = nums[n.id] + ' ' + n.title + '，' + K[n.kind].label + (n.fixed ? '，固定节点' : '');
      return '<div class="' + cls + '" role="button" tabindex="0" data-id="' + n.id + '" aria-pressed="' + (S.selected === n.id) + '" aria-label="' + esc(label) + '" style="left:' + n.x + 'px;top:' + n.y + 'px;width:' + nodeW(n) + 'px;min-height:' + nodeH(n) + 'px">' + nodeHtml(n, nums) + '</div>';
    }).join('');
    S.nodes.forEach(function (n) {
      if (!n.entering) return;
      setTimeout(function () {
        n.entering = false;
        var el = E.nodes.querySelector('[data-id="' + n.id + '"]');
        if (el) el.classList.remove('is-entering');
      }, 30);
    });
    if (focusId) { var f = E.nodes.querySelector('[data-id="' + focusId + '"]'); if (f) f.focus({ preventScroll: true }); }
    renderEdges();
    renderStickies();
    renderMinimap();
  }
  function renderEdges() {
    var b = bounds();
    E.edges.setAttribute('width', Math.max(10, b.x + b.w + 400));
    E.edges.setAttribute('height', Math.max(10, b.y + b.h + 400));
    E.edges.innerHTML = S.edges.map(function (e) {
      var a = byId(e[0]), t = byId(e[1]);
      if (!a || !t) return '';
      var x1 = a.x + nodeW(a), y1 = a.y + 36, x2 = t.x, y2 = t.y + 36, dx = Math.max(40, Math.abs(x2 - x1) / 2);
      var hot = S.highlight[e[0]] || S.highlight[e[1]];
      var run = S.status[e[0]] === 'success' && S.status[e[1]];
      return '<path class="vw-edge' + (hot ? ' is-hot' : '') + (run ? ' is-run' : '') + '" d="M' + x1 + ' ' + y1 + ' C' + (x1 + dx) + ' ' + y1 + ' ' + (x2 - dx) + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>';
    }).join('');
  }
  function renderStickies() {
    E.stickies.innerHTML = S.stickies.map(function (s, i) {
      return '<div class="vw-sticky" style="left:' + s.x + 'px;top:' + s.y + 'px"><textarea aria-label="便签内容" data-sticky="' + i + '" placeholder="添加便签">' + esc(s.text) + '</textarea>' +
        '<button type="button" class="vw-sticky-del" data-act="sticky-del" data-i="' + i + '" aria-label="删除便签">' + ic('close', 12) + '</button></div>';
    }).join('');
  }

  // ---------- 渲染：固定界面 ----------
  function renderChrome() {
    var sel = S.selected ? byId(S.selected) : null;
    var busy = S.running || !!S.trial;
    E.topLeft.innerHTML =
      '<button type="button" class="vw-pane vw-ibtn is-pane" data-act="back" aria-label="返回工作流主页" title="返回工作流主页">' + ic('chevL') + '</button>' +
      '<div class="vw-pane vw-title-pill"><span class="vw-title-text">' + esc(S.title) + '</span>' +
        (S.dirty ? '<span class="vw-dirty" role="img" title="有未保存的修改" aria-label="有未保存的修改"></span>' : '') + '</div>' +
      '<div class="vw-pane vw-group" role="group" aria-label="保存操作">' +
        '<button type="button" class="vw-ibtn" data-act="save" aria-label="保存工作流" title="保存（⌘S / Ctrl+S）">' + ic('save') + '</button>' +
        '<button type="button" class="vw-ibtn" data-act="save-as" aria-label="工作流另存为" title="另存为（⌘⇧S / Ctrl+Shift+S）">' + ic('saveAs') + '</button></div>';

    E.topRight.innerHTML =
      (sel ? '<div class="vw-pane vw-group vw-selection" role="group" aria-label="所选节点操作"><span class="vw-sel-count">已选 1 个</span>' +
        '<button type="button" class="vw-tbtn" data-act="annotate" aria-label="添加注释" title="添加注释">' + ic('comment', 15) + '<span class="vw-label-text">添加注释</span></button>' +
        '<button type="button" class="vw-ibtn" data-act="copy" aria-label="复制节点" title="复制节点"' + (busy ? ' disabled' : '') + '>' + ic('copy', 15) + '</button>' +
        '<button type="button" class="vw-ibtn" data-act="delete" aria-label="删除节点" title="删除节点"' + (busy ? ' disabled' : '') + '>' + ic('trash', 15) + '</button></div>' : '') +
      '<div class="vw-pane vw-group" role="group" aria-label="工作流执行">' +
        '<button type="button" class="vw-tbtn" data-act="agent" aria-label="交给 Agent" title="交给 Agent"' + (busy || !S.nodes.length ? ' disabled' : '') + '>' + ic('brain', 15) + '<span class="vw-label-text">交给 Agent</span></button>' +
        '<button type="button" class="vw-run-btn" data-act="run"' + (busy || !S.nodes.length ? ' disabled' : '') + '>' + ic('play', 13) + '<span>' + (S.running ? '运行中' : '执行') + '</span></button></div>';

    var tools = [['add', '添加节点', 'plus', S.picker], ['sticky', '添加便签', 'sticky'], '|', ['pointer', '指针模式', 'pointer', S.mode === 'pointer'], ['hand', '手模式', 'hand', S.mode === 'hand'], '|',
      ['arrange', '整理画布', 'arrange'], ['templates', '工作流模板', 'list'], ['advanced', '高级设置', 'settings'], ['import', '导入流程 JSON', 'upload'], ['export', '导出', 'download']];
    E.toolbar.innerHTML = tools.map(function (t) {
      if (t === '|') return '<i class="vw-sep" aria-hidden="true"></i>';
      var pressed = t.length > 3 ? ' aria-pressed="' + !!t[3] + '"' : '';
      var dis = busy && (t[0] === 'add' || t[0] === 'arrange' || t[0] === 'sticky');
      return '<button type="button" class="vw-ibtn" data-tool="' + t[0] + '" aria-label="' + t[1] + '" title="' + t[1] + '"' + pressed + (dis ? ' disabled' : '') + '>' + ic(t[2]) + '</button>';
    }).join('');

    E.bottomLeft.innerHTML =
      '<button type="button" class="vw-ibtn" data-act="undo" aria-label="撤销" title="撤销"' + (S.history.length && !busy ? '' : ' disabled') + '>' + ic('undo') + '</button>' +
      '<button type="button" class="vw-ibtn" data-act="redo" aria-label="重做" title="重做"' + (S.future.length && !busy ? '' : ' disabled') + '>' + ic('redo') + '</button>' +
      '<button type="button" class="vw-tbtn" data-act="runs" aria-expanded="' + S.runsPop + '">' + ic('history', 15) + '<span>运行记录</span></button>';

    E.bottomRight.innerHTML =
      '<section class="vw-pane vw-minimap' + (S.minimap ? '' : ' is-collapsed') + '" aria-label="流程缩略图">' +
        '<header><span>流程缩略图</span><button type="button" class="vw-ibtn is-xs" data-act="minimap" aria-label="' + (S.minimap ? '收起缩略图' : '展开缩略图') + '" title="' + (S.minimap ? '收起缩略图' : '展开缩略图') + '">' + ic(S.minimap ? 'minus' : 'plus', 13) + '</button></header>' +
        (S.minimap ? '<svg class="vw-mini-svg" id="vw-mini-svg" role="img" aria-label="流程缩略图，点击可移动视口"></svg>' : '') + '</section>' +
      '<div class="vw-pane vw-zoom" role="group" aria-label="画布缩放">' +
        '<button type="button" class="vw-ibtn" data-act="zoom-out" aria-label="缩小画布" title="缩小画布">' + ic('minus') + '</button>' +
        '<span class="vw-zoom-value">' + Math.round(S.view.s * 100) + '%</span>' +
        '<button type="button" class="vw-ibtn" data-act="zoom-in" aria-label="放大画布" title="放大画布">' + ic('plus') + '</button>' +
        '<button type="button" class="vw-ibtn" data-act="fit" aria-label="适应画布" title="适应画布">' + ic('fit') + '</button></div>';
    app.classList.toggle('has-side', !!S.selected);
    renderMinimap();
  }

  function renderMinimap() {
    var svg = document.getElementById('vw-mini-svg');
    if (!svg) return;
    var b = bounds(), pad = 60;
    var vx = -S.view.x / S.view.s, vy = -S.view.y / S.view.s, vw = E.viewport.clientWidth / S.view.s, vh = E.viewport.clientHeight / S.view.s;
    var x1 = Math.min(b.x - pad, vx), y1 = Math.min(b.y - pad, vy), x2 = Math.max(b.x + b.w + pad, vx + vw), y2 = Math.max(b.y + b.h + pad, vy + vh);
    svg.setAttribute('viewBox', x1 + ' ' + y1 + ' ' + (x2 - x1) + ' ' + (y2 - y1));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.innerHTML = S.nodes.map(function (n) {
      return '<rect class="vw-mini-node' + (S.selected === n.id ? ' is-sel' : '') + '" x="' + n.x + '" y="' + (n.y + 20) + '" width="' + nodeW(n) + '" height="' + (n.children ? nodeH(n) - 40 : 32) + '" rx="8"/>';
    }).join('') + '<rect class="vw-mini-view" x="' + vx + '" y="' + vy + '" width="' + vw + '" height="' + vh + '" rx="10"/>';
    svg.dataset.vb = [x1, y1, x2 - x1, y2 - y1].join(',');
  }

  // ---------- 渲染：修改请求卡片（ProposalNotice） ----------
  function renderNotice() {
    var show = !!S.proposal && !S.trial;
    E.notice.hidden = !show;
    if (!show) return;
    E.notice.setAttribute('role', 'status');
    E.notice.setAttribute('aria-label', '待确认的工作流修改');
    E.notice.innerHTML = '<header><span class="vw-notice-badge">' + ic('doc', 14) + '修改请求</span><span class="vw-notice-count">1 项待确认</span></header>' +
      '<div class="vw-notice-body"><p>Agent 提交了修改，等待你确认。</p><button type="button" class="vw-dark-btn" data-act="review">查看修改</button></div>';
  }

  // ---------- 渲染：节点面板（NodePicker） ----------
  function renderPicker() {
    E.picker.hidden = !S.picker; app.classList.toggle('has-picker', !!S.picker);
    if (!S.picker) return;
    var tabs = [['nodes', '节点'], ['tools', '工具'], ['start', '开始'], ['snippets', 'Snippets']];
    var html = '<div class="vw-picker-head"><div class="vw-picker-tabs" role="tablist" aria-label="节点目录">' + tabs.map(function (t) {
      var on = S.pickerTab === t[0];
      return '<button type="button" role="tab" data-ptab="' + t[0] + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '">' + t[1] + '</button>';
    }).join('') + '</div><button type="button" class="vw-ibtn" data-act="picker-close" aria-label="关闭添加节点" title="关闭添加节点">' + ic('close') + '</button></div>';
    if (S.pickerTab === 'nodes' || S.pickerTab === 'tools') {
      var ph = S.pickerTab === 'tools' ? '搜索集成、工具操作' : '搜索节点';
      html += '<label class="vw-search">' + ic('search', 14) + '<input type="search" id="vw-picker-search" aria-label="' + (S.pickerTab === 'tools' ? '搜索工具' : '搜索节点') + '" placeholder="' + ph + '" value="' + esc(S.search) + '"></label>';
    }
    html += '<div class="vw-picker-scroll" id="vw-picker-scroll">' + pickerBody() + '</div>';
    E.picker.innerHTML = html;
  }
  function pickerBody() {
    var q = S.search.trim().toLowerCase();
    if (S.pickerTab === 'nodes') {
      var list = KINDS.map(function (k) { return K[k[0]]; }).filter(function (d) {
        return d.kind !== 'input' && d.kind !== 'tool' && (d.label + ' ' + d.desc).toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) return '<div class="vw-empty"><p>没有匹配的节点</p><button type="button" class="vw-tbtn is-outline" data-act="clear-search">清除搜索</button></div>';
      var groups = [];
      list.forEach(function (d) { if (groups.indexOf(d.group) < 0) groups.push(d.group); });
      return groups.map(function (g) {
        return '<section class="vw-pgroup"><h4>' + g + '</h4>' + list.filter(function (d) { return d.group === g; }).map(function (d) {
          if (d.kind === 'agent') {
            return '<button type="button" class="vw-prow" data-act="agent-toggle" aria-expanded="' + S.agentOpen + '" title="' + esc(d.desc) + '">' + badge(d.kind) + '<strong>' + d.label + '</strong>' + ic(S.agentOpen ? 'chevU' : 'chevD', 14) + '</button>' +
              (S.agentOpen ? '<button type="button" class="vw-prow vw-prow-sub" data-add="agent" aria-label="添加工具调用 Agent" title="使用选定模型和授权工具，按步骤完成任务。"><strong>工具调用 Agent</strong><span class="vw-padd">' + ic('plus', 13) + '添加</span></button>' : '');
          }
          return '<button type="button" class="vw-prow" data-add="' + d.kind + '" title="' + esc(d.desc) + '">' + badge(d.kind) + '<strong>' + d.label + '</strong></button>';
        }).join('') + '</section>';
      }).join('');
    }
    if (S.pickerTab === 'tools') {
      var cats = '<div class="vw-cats" role="group" aria-label="工具分类">' + TOOL_CATS.map(function (c) {
        return '<button type="button" class="vw-cat" data-cat="' + c + '" aria-pressed="' + (S.toolCat === c) + '">' + c + '</button>';
      }).join('') + '</div>';
      var show = S.toolCat === '全部' || S.toolCat === '工具插件';
      var rows = show ? TOOLS.map(function (t) {
        var ops = t.ops.filter(function (o) { return (t.provider + o[0] + o[1]).toLowerCase().indexOf(q) >= 0; });
        if (!ops.length) return '';
        var open = S.toolOpen[t.provider] || !!q;
        return '<div class="vw-tool"><button type="button" class="vw-prow" data-tool-open="' + esc(t.provider) + '" aria-expanded="' + open + '">' + badge('tool') + '<strong>' + esc(t.provider) + '</strong><small>工作流内置 · ' + t.ops.length + '</small>' + ic(open ? 'chevU' : 'chevD', 14) + '</button>' +
          (open ? ops.map(function (o) { return '<button type="button" class="vw-prow vw-prow-sub" data-add-tool="' + esc(o[0]) + '" title="' + esc(o[1]) + '"><strong>' + esc(o[0]) + '</strong><span class="vw-padd">' + ic('plus', 13) + '添加</span></button>'; }).join('') : '') + '</div>';
      }).join('') : '';
      if (!rows) rows = '<div class="vw-empty"><p>' + (show ? '没有匹配的工具' : '示意原型：该分类暂无示例工具') + '</p></div>';
      return cats + rows;
    }
    if (S.pickerTab === 'start') {
      var has = S.nodes.some(function (n) { return n.kind === 'input'; });
      return '<button type="button" class="vw-prow" data-add="input"' + (has ? ' disabled' : '') + ' title="手动执行时填写输入，或由对话提供参数。">' + badge('input') + '<strong>用户输入</strong>' + (has ? '<small>已添加</small>' : '') + '</button>' +
        '<p class="vw-picker-note">每个流程只有一个用户输入起点。</p>' +
        '<div class="vw-unavail"><strong>定时触发器 · Webhook</strong><p>示意原型：暂不提供。</p></div>';
    }
    return '<div class="vw-empty"><strong>还没有代码片段</strong><p>可在画布中复制现有节点组合。</p></div>';
  }

  // ---------- 渲染：节点配置面板 ----------
  function field(label, inner, help) {
    return '<div class="vw-field"><div class="vw-field-label">' + label + (help ? '<span class="vw-help" title="' + esc(help) + '">' + ic('help', 13) + '</span>' : '') + '</div>' + inner + '</div>';
  }
  function selectBox(key, label, value, options) {
    return '<div class="vw-select"><select data-f="' + key + '" aria-label="' + esc(label) + '">' + options.map(function (o) {
      return '<option' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>';
    }).join('') + '</select>' + ic('chevD', 14) + '</div>';
  }
  function textInput(key, label, value, placeholder) {
    return '<input class="vw-input" type="text" data-f="' + key + '" aria-label="' + esc(label) + '" value="' + esc(value) + '"' + (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '>';
  }
  function numInput(key, label, value, min, max) {
    return '<input class="vw-input" type="number" data-f="' + key + '" aria-label="' + esc(label) + '" value="' + value + '" min="' + min + '"' + (max ? ' max="' + max + '"' : '') + '>';
  }
  function highlightCode(text, lang) {
    var h = esc(text);
    h = h.replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="tk-s">$1</span>');
    if (lang !== 'JSON') h = h.replace(/\b(function|return|var|const|let|if|def)\b/g, '<span class="tk-k">$1</span>');
    return h;
  }
  function codeBox(lang, text, key, format) {
    var lines = String(text).split('\n');
    return '<div class="vw-code"><div class="vw-code-head">' + ic('code', 14) + '<span>' + esc(lang) + '</span><span class="vw-code-lines">' + lines.length + ' 行</span><span class="vw-spacer"></span>' +
      (format ? '<button type="button" class="vw-link-btn" data-act="format">格式化</button>' : '') +
      '<button type="button" class="vw-ibtn is-xs" data-act="copy-code" data-key="' + key + '" aria-label="复制" title="复制">' + ic('copy', 13) + '</button></div>' +
      '<div class="vw-code-body"><ol class="vw-code-nums" aria-hidden="true">' + lines.map(function (_, i) { return '<li>' + (i + 1) + '</li>'; }).join('') + '</ol>' +
      '<pre tabindex="0" aria-label="' + esc(lang) + ' 内容"><code>' + highlightCode(text, lang) + '</code></pre></div></div>';
  }
  function rows(items) { return '<div class="vw-rows">' + items.join('') + '</div>'; }
  function settingsBody(n) {
    var c = n.cfg || {}, h = '';
    switch (n.kind) {
      case 'input':
        h += field('输入字段', rows((c.fields || []).map(function (f) {
          return '<div class="vw-row"><code>' + esc(f.name) + '</code><span>' + esc(f.label) + '</span><span class="vw-row-tag">' + esc(f.type) + '</span>' + (f.required ? '<span class="vw-row-tag is-req">必填</span>' : '') + '</div>';
        })), '字段名用于变量引用；执行时只询问缺失的必填项。');
        break;
      case 'code':
        h += field('输入变量映射', codeBox('JSON', c.map, 'map', true));
        h += field('编程语言', selectBox('lang', '编程语言', c.lang, ['JavaScript', 'Python']));
        h += field('代码', codeBox(c.lang, c.code, 'code'));
        h += field('输出变量', rows(['<div class="vw-row"><code>' + esc(c.out) + '</code><span class="vw-row-tag">数组</span></div>']));
        break;
      case 'iteration':
        h += '<div class="vw-inner"><strong>内部流程</strong><p>' + n.children.length + ' 个节点 · 独立作用域</p><button type="button" class="vw-tbtn is-outline is-block" data-act="edit-inner">编辑内部流程</button></div>';
        h += field('遍历数组', textInput('iterator', '遍历数组', c.iterator, 'input.items'), '填写数组变量，例如 input.items。内部可用 item 和 index。');
        h += '<div class="vw-field vw-switch-row"><div class="vw-field-label">并行执行</div><button type="button" class="vw-switch" role="switch" aria-checked="' + !!c.parallel + '" aria-label="并行执行" data-act="parallel"><i></i></button></div>';
        if (c.parallel) h += field('并发数量', numInput('concurrency', '并发数量', c.concurrency, 1, 8));
        h += field('收集输出变量', textInput('output', '收集输出变量', c.output, '内部节点 ID.text'), '必填：填写内部节点稳定 ID 的变量路径，例如内部输出节点的 ID.text。');
        h += field('单项失败处理', selectBox('error', '单项失败处理', c.error, ['终止迭代', '保留空值并继续', '移除失败项并继续']));
        h += '<details class="vw-details"><summary>文件验收</summary><p class="vw-muted">' + (S.lastRun[n.id] ? '示意：本次运行未声明产出文件。' : '尚未运行。') + '</p></details>';
        h += '<details class="vw-details"><summary>可引用的变量</summary><ul class="vw-vars"><li><code>item</code>当前项</li><li><code>index</code>当前序号</li><li><code>n_split.list</code>拆分网址 · 输出</li><li><code>input.urls</code>用户输入</li></ul></details>';
        break;
      case 'output':
        h += field('输出内容', codeBox('模板', c.text, 'text'), '支持使用 {{变量路径}} 插入上游数据。');
        h += field('输出名称', textInput('name', '输出名称', c.name));
        break;
      case 'llm':
        h += field('模型', selectBox('model', '模型', c.model, ['跟随 DSH']));
        h += field('思考强度', selectBox('effort', '思考强度', c.effort, ['自动', '低', '中', '高']));
        h += field('角色预设', selectBox('preset', '角色预设', c.preset, ['不使用角色预设']));
        h += field('任务提示词', codeBox('提示词', c.prompt, 'prompt'));
        break;
      case 'agent':
        h += field('任务提示词', codeBox('提示词', c.prompt, 'prompt'));
        h += field('最多执行步骤', numInput('maxSteps', '最多执行步骤', c.maxSteps, 1));
        break;
      case 'template':
        h += field('输入变量映射', codeBox('JSON', c.map, 'map', true));
        h += field('模板内容', codeBox('模板', c.text, 'text'), '支持使用 {{变量路径}} 插入上游数据。');
        break;
      case 'http':
        h += field('请求方法', selectBox('method', '请求方法', c.method, ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']));
        h += field('请求地址', textInput('url', '请求地址', c.url, 'https://'), '可使用变量；请求实际通过宿主执行。');
        break;
      case 'loop':
        h += field('最大循环次数', numInput('max', '最大循环次数', c.max, 1));
        h += '<div class="vw-field vw-switch-row"><div class="vw-field-label">使用退出条件</div><button type="button" class="vw-switch" role="switch" aria-checked="' + !!c.until + '" aria-label="使用退出条件" data-act="until"><i></i></button></div>';
        break;
      case 'classifier':
        h += field('分类', rows(c.classes.map(function (x) { return '<div class="vw-row"><span>' + esc(x) + '</span></div>'; })));
        break;
      case 'if':
        h += field('条件分支', rows(['<div class="vw-row"><span class="vw-row-tag">IF</span><code>' + esc(c.cond) + '</code></div>', '<div class="vw-row"><span class="vw-row-tag">ELSE</span><span>以上条件均不满足时执行。</span></div>']));
        break;
      case 'human':
        h += field('行动按钮', rows(c.actions.map(function (x) { return '<div class="vw-row"><span>' + esc(x) + '</span></div>'; })));
        break;
      default:
        h += '<p class="vw-muted">示意原型只还原了部分节点的配置项。</p>';
    }
    return h;
  }
  function lastRunBody(n) {
    var r = S.lastRun[n.id];
    if (!r) return '<div class="vw-empty is-left"><p>此节点还没有运行记录</p></div>';
    return '<div class="vw-run-meta"><span class="vw-st is-ok">' + ic('check', 12) + '已完成</span><span class="vw-muted">示意数据</span></div>' +
      field('输入', codeBox('JSON', JSON.stringify(r.input, null, 2), 'run-in')) +
      field('输出', codeBox('JSON', JSON.stringify(r.output, null, 2), 'run-out'));
  }
  function renderConfig() {
    var n = S.selected ? byId(S.selected) : null;
    E.config.hidden = !n;
    if (!n) return;
    var nums = numbers(), d = K[n.kind];
    var remark = n.remark || '';
    var keepScroll = E.config.querySelector('.vw-config-body');
    var scrollTop = keepScroll && E.config.dataset.for === n.id ? keepScroll.scrollTop : 0;
    E.config.dataset.for = n.id;
    E.config.innerHTML =
      '<header class="vw-config-head">' + badge(n.kind) +
        '<div class="vw-config-titles"><span class="vw-config-kind">' + nums[n.id] + ' · ' + d.label + '</span>' +
        '<input class="vw-config-title" type="text" data-f="title" aria-label="节点名称" value="' + esc(n.title) + '"></div>' +
        '<div class="vw-config-tools">' +
          '<button type="button" class="vw-ibtn" data-act="lock" aria-pressed="' + !!n.fixed + '" aria-label="' + (n.fixed ? '取消固定节点' : '固定节点') + '" title="' + (n.fixed ? '取消固定节点' : '固定节点，保护它不被 Agent 自动修改') + '">' + ic(n.fixed ? 'lock' : 'unlock') + '</button>' +
          '<button type="button" class="vw-ibtn" data-act="about" aria-pressed="' + S.about + '" aria-label="关于此节点" title="关于此节点">' + ic('info') + '</button>' +
          '<button type="button" class="vw-ibtn" data-act="config-close" aria-label="关闭节点配置" title="关闭节点配置">' + ic('close') + '</button>' +
        '</div></header>' +
      '<div class="vw-config-body">' +
      '<p class="vw-config-desc">' + d.desc + '</p>' +
      (S.about ? '<div class="vw-about">节点身份 <code>' + n.id + '</code> · 结构编号 ' + nums[n.id] + '<br>结构编号随结构调整，变量引用使用稳定身份。' + (n.fixed ? '<br>已固定：保护它不被 Agent 自动修改。' : '') + '</div>' : '') +
      '<div class="vw-config-tabs" role="tablist" aria-label="节点配置页签">' +
        '<button type="button" role="tab" data-ctab="settings" aria-selected="' + (S.tab === 'settings') + '">设置</button>' +
        '<button type="button" role="tab" data-ctab="last" aria-selected="' + (S.tab === 'last') + '">上次运行</button></div>' +
      (S.tab === 'settings' ?
        '<div class="vw-remark"><div class="vw-remark-head"><span>备注</span><span class="vw-help" title="节点备注，仅作说明，不影响执行；可省略">' + ic('help', 13) + '</span><span class="vw-spacer"></span><span class="vw-remark-count" id="vw-remark-count">' + remark.length + ' 字符</span></div>' +
        '<textarea data-f="remark" aria-label="备注" placeholder="添加节点备注（可选）" rows="3">' + esc(remark) + '</textarea></div>' + settingsBody(n)
        : lastRunBody(n)) + '</div>';
    var body = E.config.querySelector('.vw-config-body');
    if (body) body.scrollTop = scrollTop;
  }

  // ---------- 渲染：弹层 ----------
  var TRIAL_STEPS = ['读取输入 <code>urls</code>', '第 1 次工具调用 · <code>workflow_http_request</code>', '第 2 次工具调用 · <code>workflow_html_extract_text</code>', '模型整理摘要', '核对产出 <code>result</code>'];
  function renderFloat() {
    if (!S.trial) { E.float.hidden = true; return; }
    E.float.hidden = false;
    var steps = TRIAL_STEPS.map(function (s, i) {
      var cls = i < S.trial.step ? 'is-ok' : i === S.trial.step ? 'is-run' : '';
      return '<li class="' + cls + '"><span class="vw-dot">' + (i < S.trial.step ? ic('check', 10) : '') + '</span><span>' + s + '</span></li>';
    }).join('');
    E.float.innerHTML = '<strong>' + (S.trial.phase === 'build' ? '试做跑通，由试做记录生成流程骨架' : 'Agent 正在试做本次任务') + '</strong>' +
      '<p class="vw-muted">先试后建：先用当前会话工具真实做一遍，跑通后再拆成流程。</p><ol class="vw-trial-steps">' + steps + '</ol>';
  }
  function renderRuns() {
    E.runs.hidden = !S.runsPop;
    if (!S.runsPop) return;
    E.runs.innerHTML = '<header><strong>运行记录</strong><button type="button" class="vw-ibtn is-xs" data-act="runs-close" aria-label="关闭运行详情" title="关闭运行详情">' + ic('close', 13) + '</button></header>' +
      (S.runs.length ? '<ul class="vw-run-list">' + S.runs.map(function (r) {
        return '<li><span class="vw-st is-ok">' + ic('check', 12) + '已完成</span><span>第 ' + r.no + ' 次运行</span><span class="vw-muted">' + r.at + '</span></li>';
      }).join('') + '</ul>' : '<p class="vw-muted">还没有运行记录</p>');
  }
  function renderModal() {
    if (!S.modal || !S.proposal) { E.modal.hidden = true; return; }
    E.modal.hidden = false;
    var nums = numbers();
    var conflict = S.proposal.base !== S.revision || !hasEdge('n_batch', 'n_out');
    var outNode = byId('n_out'), batch = byId('n_batch');
    var batchNo = nums.n_batch || 'a-3';
    var bump = function (k) { return batchNo.replace(/\d+$/, function (m) { return String(parseInt(m, 10) + k); }); };
    var addJson = JSON.stringify({ id: 'n_check', kind: 'code', title: '检查摘要', config: { language: 'javascript', outputs: ['rows'] } }, null, 2);
    var outTitle = outNode ? outNode.title : '输出摘要表';
    var before = JSON.stringify({ id: 'n_out', title: outTitle, config: { text: outNode ? outNode.cfg.text : '', outputName: 'result' } }, null, 2);
    var after = JSON.stringify({ id: 'n_out', title: outTitle, config: { text: OUT_AFTER, outputName: 'result' } }, null, 2);
    E.modal.innerHTML = '<div class="vw-modal" role="dialog" aria-modal="true" aria-labelledby="vw-modal-title">' +
      '<header class="vw-modal-head"><h3 id="vw-modal-title">查看修改提案</h3><button type="button" class="vw-ibtn" data-act="modal-close" aria-label="关闭修改提案" title="关闭修改提案">' + ic('close') + '</button></header>' +
      '<div class="vw-modal-body">' +
        '<div class="vw-modal-intro"><p>在「' + esc(batch ? batch.title : '逐个整理') + '」与「' + esc(outTitle) + '」之间新增「检查摘要」代码执行节点，去掉空摘要；输出改为读取检查后的结果。</p>' +
        '<p class="vw-muted">提案基础 v' + S.proposal.base + ' · 当前 v' + S.revision + ' · ' + new Date(S.proposal.at).toLocaleString('zh-CN') + '</p></div>' +
        (conflict ? '<p class="vw-error" role="alert">原流程已变化，当前提案无法直接接受。请让 Agent 基于最新版本重新生成；本提案会保留。</p>' : '') +
        '<div class="vw-scope"><strong>影响范围</strong><p>新增 1 个节点 · 修改 1 个节点 · 删除 0 个节点</p><p>主图连线变化</p></div>' +
        '<div class="vw-viewer"><div class="vw-viewer-title">新增：' + bump(1) + ' 检查摘要</div><pre>' + highlightCode(addJson, 'JSON') + '</pre></div>' +
        '<section class="vw-change"><h4>' + bump(2) + ' · ' + esc(outTitle) + '</h4><div class="vw-change-grid">' +
          '<div class="vw-viewer"><div class="vw-viewer-title">修改前</div><pre>' + highlightCode(before, 'JSON') + '</pre></div>' +
          '<div class="vw-viewer"><div class="vw-viewer-title">修改后</div><pre>' + highlightCode(after, 'JSON') + '</pre></div></div></section>' +
        '<details class="vw-details"><summary>查看完整定义差异</summary><p class="vw-muted">当前定义 ' + S.nodes.length + ' 个节点 · 提议定义 ' + (S.nodes.length + 1) + ' 个节点；固定节点未改动。</p></details>' +
        '<p class="vw-muted">修改不改变正在运行的快照。</p>' +
      '</div>' +
      '<footer class="vw-modal-foot"><button type="button" class="vw-tbtn is-outline" data-act="reject">拒绝修改</button>' +
        '<button type="button" class="vw-dark-btn" data-act="accept"' + (conflict ? ' disabled' : '') + '>接受并应用</button></footer></div>';
  }
  function renderNotePop() {
    var np = S.notePop;
    E.notePop.hidden = !np || !byId(np.id);
    if (E.notePop.hidden) return;
    var editing = !!S.notes[np.id];
    E.notePop.innerHTML = '<header><strong id="vw-note-title">' + (editing ? '编辑注释' : '添加注释') + '</strong><span class="vw-muted">' + numbers()[np.id] + ' ' + esc(byId(np.id).title) + '</span></header>' +
      '<textarea id="vw-note-text" rows="3" maxlength="120" aria-label="注释内容" placeholder="添加注释…">' + esc(S.notes[np.id] || '') + '</textarea>' +
      '<footer>' + (editing ? '<button type="button" class="vw-link-btn is-danger" data-act="note-delete">删除注释</button>' : '') +
      '<span class="vw-spacer"></span><button type="button" class="vw-tbtn is-outline" data-act="note-cancel">取消</button><button type="button" class="vw-dark-btn" data-act="note-save">保存</button></footer>';
    placeNotePop();
  }
  function placeNotePop() {
    if (!S.notePop || E.notePop.hidden) return;
    var el = E.nodes.querySelector('[data-id="' + S.notePop.id + '"]');
    var appR = app.getBoundingClientRect(), pw = E.notePop.offsetWidth, ph = E.notePop.offsetHeight;
    var left = 60, top = 80;
    if (el) {
      var r = el.getBoundingClientRect();
      left = r.left - appR.left; top = r.top - appR.top + Math.min(r.height, 80) + 8;
      if (top + ph > appR.height - 8) top = r.top - appR.top - ph - 8;
    }
    var maxLeft = appR.width - pw - 8 - (S.selected && !narrow() ? 340 : 0);
    E.notePop.style.left = Math.max(8, Math.min(left, maxLeft)) + 'px';
    E.notePop.style.top = Math.max(8, Math.min(top, appR.height - ph - 8)) + 'px';
  }

  function renderAll() {
    renderNotice(); renderChrome(); renderNodes(); renderPicker(); renderConfig(); renderFloat(); renderRuns(); renderModal(); renderNotePop();
    applyView();
  }

  // ---------- 提示条 ----------
  var toastTimer = 0;
  function toast(text) {
    E.toast.textContent = text;
    E.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { E.toast.classList.remove('is-on'); }, 2800);
  }

  // ---------- 操作 ----------
  function selectNode(id) {
    if (S.selected !== id) { S.tab = 'settings'; S.about = false; }
    S.selected = id;
    S.notePop = null;
    renderNotice(); renderChrome(); renderNodes(); renderConfig(); renderNotePop();
    ensureVisible(id);
  }
  // 配置面板打开后，若节点被遮住则平移画布
  function ensureVisible(id) {
    var n = byId(id);
    if (!n || narrow()) return;
    var a = availRect(), sx = S.view.x + n.x * S.view.s, ex = sx + nodeW(n) * S.view.s, shift = 0;
    if (ex > a.r) shift = a.r - ex - 16;
    if (sx + shift < a.l) shift = a.l - sx + 16;
    if (shift) { S.view.x += shift; applyView(); }
  }
  function deselect() {
    if (!S.selected) return;
    S.selected = null; S.notePop = null;
    renderChrome(); renderNodes(); renderConfig(); renderNotePop();
  }
  function centerPoint() {
    var a = availRect();
    return { x: ((a.l + a.r) / 2 - S.view.x) / S.view.s, y: ((a.t + a.b) / 2 - S.view.y) / S.view.s };
  }
  function addNode(kind, title) {
    remember();
    var c = centerPoint(), id = 'n_' + kind + '_' + (++seq);
    var n = { id: id, kind: kind, title: title || K[kind].label, x: Math.round(c.x - NODE_W / 2), y: Math.round(c.y - NODE_H / 2), cfg: defaultCfg(kind), entering: true };
    if (isBox(n)) n.children = [{ kind: 'output', title: '输出' }];
    freeSpot(n);
    S.nodes.push(n);
    touch();
    S.picker = false;
    renderPicker();
    selectNode(id);
    toast('已添加「' + n.title + '」，可在右侧配置');
  }
  // 找一个不与现有节点重叠的位置（向下错开）
  function freeSpot(n) {
    var hit = function () {
      return S.nodes.some(function (m) {
        return m !== n && n.x < m.x + nodeW(m) + 20 && n.x + nodeW(n) + 20 > m.x && n.y < m.y + nodeH(m) + 20 && n.y + nodeH(n) + 20 > m.y;
      });
    };
    for (var i = 0; i < 12 && hit(); i++) n.y += NODE_H + 28;
  }
  function copyNode() {
    var n = byId(S.selected);
    if (!n) return;
    remember();
    var c = clone(n);
    c.id = 'n_copy_' + (++seq); c.x = n.x + 40; c.y = n.y + nodeH(n) + 40; c.fixed = false; c.entering = true;
    freeSpot(c);
    S.nodes.push(c);
    touch();
    selectNode(c.id);
    toast('已复制节点');
  }
  function deleteNode() {
    var n = byId(S.selected);
    if (!n) return;
    remember();
    S.nodes = S.nodes.filter(function (x) { return x.id !== n.id; });
    S.edges = S.edges.filter(function (e) { return e[0] !== n.id && e[1] !== n.id; });
    delete S.notes[n.id];
    S.noteOrder = S.noteOrder.filter(function (x) { return x !== n.id; });
    S.selected = null;
    touch();
    renderAll();
    toast('已删除节点，可点左下角撤销');
  }
  function undo(redo) {
    var from = redo ? S.future : S.history, to = redo ? S.history : S.future;
    if (!from.length) return;
    to.push(snapshot());
    restore(from.pop());
    if (S.selected && !byId(S.selected)) S.selected = null;
    touch();
    renderAll();
  }
  function save() {
    if (S.dirty) { S.revision += 1; S.dirty = false; toast('已保存 · v' + S.revision); }
    else toast('已保存');
    renderChrome(); renderModal();
  }
  function arrange() {
    remember();
    var order = mainOrder(), x = 40;
    order.forEach(function (id) { var n = byId(id); n.x = x; n.y = 140; x += nodeW(n) + GAP; });
    var fx = 40;
    S.nodes.forEach(function (n) {
      if (order.indexOf(n.id) < 0) { n.x = fx; n.y = 140 + BOX_H + 80; fx += nodeW(n) + GAP; }
    });
    touch();
    renderNodes(); renderChrome();
    fitView();
  }
  function openModal() {
    if (!S.proposal) return;
    S.modal = true; S.notePop = null; S.picker = false;
    renderPicker(); renderNotePop(); renderModal();
    var b = E.modal.querySelector('[data-act="modal-close"]');
    if (b) b.focus();
  }
  function closeModal() {
    S.modal = false;
    renderModal();
    var r = E.notice.querySelector('[data-act="review"]') || E.topRight.querySelector('[data-act="agent"]');
    if (r) r.focus({ preventScroll: true });
  }
  function accept() {
    if (!S.proposal || S.proposal.base !== S.revision || !hasEdge('n_batch', 'n_out')) return;
    remember();
    var out = byId('n_out'), batch = byId('n_batch');
    var check = clone(CHECK_NODE);
    check.x = out.x; check.y = out.y; check.entering = true;
    S.nodes.forEach(function (n) { if (n.x >= out.x && n.id !== batch.id) n.x += NODE_W + GAP; });
    S.nodes.splice(S.nodes.indexOf(out), 0, check);
    S.edges = S.edges.filter(function (e) { return !(e[0] === batch.id && e[1] === out.id); });
    S.edges.push([batch.id, check.id], [check.id, out.id]);
    out.cfg.text = OUT_AFTER;
    S.revision += 1; S.dirty = false;
    S.proposal = null; S.accepted = true; S.modal = false;
    S.highlight = { n_check: true, n_out: true };
    later(function () { S.highlight = {}; renderNodes(); }, 4200);
    renderAll();
    fitView();
    toast('已接受并应用，已保存 v' + S.revision);
    var a = E.topRight.querySelector('[data-act="agent"]');
    if (a) a.focus({ preventScroll: true });
  }
  function reject() {
    S.proposal = null; S.modal = false;
    renderAll();
    toast('已拒绝修改，画布保持不变');
    var a = E.topRight.querySelector('[data-act="agent"]');
    if (a) a.focus({ preventScroll: true });
  }
  function askAgent() {
    var n = S.noteOrder.length;
    toast('已加入聊天草稿，尚未发送' + (n ? '（含 ' + n + ' 条注释）' : ''));
    if ((S.proposal && S.proposal.base === S.revision) || S.accepted || !hasEdge('n_batch', 'n_out')) return;
    var regen = !!S.proposal;
    later(function () {
      if (S.trial || (S.proposal && S.proposal.base === S.revision)) return;
      S.proposal = { base: S.revision, at: Date.now() };
      renderNotice(); renderChrome(); renderModal(); applyView();
      toast(regen ? '示意：Agent 基于最新版本 v' + S.revision + ' 重新生成了提案' : '示意：假设草稿已发送，Agent 提交了修改，等待你确认');
    }, 1800);
  }

  function runFlow() {
    if (S.running || S.trial) return;
    var order = mainOrder();
    if (!order.length) return;
    S.running = true; S.status = {}; S.child = {}; S.runsPop = false;
    S.notePop = null; S.picker = false;
    renderAll();
    var i = 0;
    var stepNode = function () {
      if (i >= order.length) {
        S.running = false;
        S.runs.unshift({ no: S.runs.length + 1, at: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
        renderChrome(); renderNodes(); renderConfig();
        toast('示意运行结束：节点状态为演示，未连接真实执行');
        return;
      }
      var id = order[i], n = byId(id);
      if (!n) { i += 1; stepNode(); return; }
      S.status[id] = 'running';
      renderNodes();
      var finish = function () {
        S.status[id] = 'success';
        delete S.child[id];
        S.lastRun[id] = fakeRun(n);
        if (S.selected === id && S.tab === 'last') renderConfig();
        i += 1;
        renderNodes();
        later(stepNode, 250);
      };
      if (n.children) {
        var c = 0;
        var stepChild = function () {
          if (c >= n.children.length) { finish(); return; }
          S.child[id] = c; renderNodes(); c += 1; later(stepChild, 520);
        };
        stepChild();
      } else later(finish, 650);
    };
    stepNode();
  }
  function fakeRun(n) {
    var urls = 'https://example.com/a\nhttps://example.com/b';
    switch (n.kind) {
      case 'input': return { input: { urls: urls }, output: { urls: urls } };
      case 'code': return n.id === 'n_check' ? { input: { rows: ['摘要 A', '摘要 B'] }, output: { rows: ['摘要 A', '摘要 B'] } } : { input: { urls: urls }, output: { list: ['https://example.com/a', 'https://example.com/b'] } };
      case 'iteration': return { input: { items: 2 }, output: { output: ['摘要 A', '摘要 B'] } };
      case 'output': return { input: { text: n.cfg.text }, output: { result: '| 网址 | 摘要 |' } };
      default: return { input: {}, output: { text: '示意输出' } };
    }
  }

  // ---------- 让 Agent 试做 ----------
  function startTrial() {
    clearTimers();
    var keepMini = S.minimap;
    S = freshState();
    S.minimap = keepMini;
    S.nodes = []; S.edges = []; S.revision = 0; S.proposal = null;
    S.trial = { step: 0, phase: 'trial' };
    renderAll();
    var tick = function () {
      S.trial.step += 1;
      renderFloat();
      if (S.trial.step < TRIAL_STEPS.length) later(tick, 750);
      else later(build, 600);
    };
    later(tick, 800);
  }
  function build() {
    S.trial.phase = 'build';
    renderFloat();
    var src = exampleNodes(), k = 0;
    fitView(src);
    var add = function () {
      var n = src[k];
      n.entering = true;
      S.nodes.push(n);
      if (k > 0) S.edges.push([src[k - 1].id, n.id]);
      k += 1;
      renderNodes(); renderChrome();
      if (k < src.length) later(add, 520);
      else later(function () {
        S.trial = null; S.revision = 1; S.dirty = false;
        renderAll(); fitView();
        toast('试做跑通：已生成流程并保存 v1。可以点「交给 Agent」提出修改');
      }, 600);
    };
    add();
  }
  function reset() {
    clearTimers();
    var keepMini = S.minimap;
    S = freshState();
    S.minimap = keepMini;
    renderAll();
    fitView();
  }

  // ---------- 事件 ----------
  function focusTool(name) { var b = E.toolbar.querySelector('[data-tool="' + name + '"]'); if (b) b.focus(); }
  function focusIn(root, sel) { var el = root.querySelector(sel); if (el) el.focus(); }

  app.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || !app.contains(t) || t.disabled) return;
    var act = t.dataset.act;
    if (t.dataset.tool) { onTool(t.dataset.tool); return; }
    if (t.dataset.ptab) { S.pickerTab = t.dataset.ptab; S.search = ''; renderPicker(); focusIn(E.picker, '[data-ptab="' + S.pickerTab + '"]'); return; }
    if (t.dataset.add) { addNode(t.dataset.add); return; }
    if (t.dataset.addTool) { addNode('tool', t.dataset.addTool); return; }
    if (t.dataset.toolOpen) { S.toolOpen[t.dataset.toolOpen] = !S.toolOpen[t.dataset.toolOpen]; renderPicker(); focusIn(E.picker, '[data-tool-open="' + t.dataset.toolOpen + '"]'); return; }
    if (t.dataset.cat) { S.toolCat = t.dataset.cat; renderPicker(); focusIn(E.picker, '[data-cat="' + S.toolCat + '"]'); return; }
    if (t.dataset.ctab) { S.tab = t.dataset.ctab; renderConfig(); focusIn(E.config, '[data-ctab="' + S.tab + '"]'); return; }
    switch (act) {
      case 'back': toast('示意原型只还原画布页'); break;
      case 'save': save(); break;
      case 'save-as': toast('示意原型未接入「另存为」'); break;
      case 'annotate':
        if (!S.selected) break;
        S.notePop = { id: S.selected }; renderNotePop();
        focusIn(E.notePop, 'textarea');
        break;
      case 'pin': {
        var nodeEl = t.closest('.vw-node');
        if (nodeEl) { selectNode(nodeEl.dataset.id); S.notePop = { id: nodeEl.dataset.id }; renderNotePop(); focusIn(E.notePop, 'textarea'); }
        break;
      }
      case 'note-save': saveNote(); break;
      case 'note-cancel': S.notePop = null; renderNotePop(); break;
      case 'note-delete': deleteNote(); break;
      case 'copy': copyNode(); break;
      case 'delete': deleteNode(); break;
      case 'agent': askAgent(); break;
      case 'run': runFlow(); break;
      case 'undo': undo(false); break;
      case 'redo': undo(true); break;
      case 'runs': S.runsPop = !S.runsPop; renderRuns(); renderChrome(); break;
      case 'runs-close': S.runsPop = false; renderRuns(); renderChrome(); focusIn(E.bottomLeft, '[data-act="runs"]'); break;
      case 'minimap': S.minimap = !S.minimap; renderChrome(); focusIn(E.bottomRight, '[data-act="minimap"]'); break;
      case 'zoom-in': zoomBy(0.1); break;
      case 'zoom-out': zoomBy(-0.1); break;
      case 'fit': fitView(); break;
      case 'review': openModal(); break;
      case 'modal-close': closeModal(); break;
      case 'accept': accept(); break;
      case 'reject': reject(); break;
      case 'picker-close': S.picker = false; renderPicker(); renderChrome(); focusTool('add'); break;
      case 'clear-search': S.search = ''; renderPicker(); focusIn(E.picker, '#vw-picker-search'); break;
      case 'agent-toggle': S.agentOpen = !S.agentOpen; renderPicker(); focusIn(E.picker, '[data-act="agent-toggle"]'); break;
      case 'config-close': {
        var id = S.selected; deselect();
        var ne = E.nodes.querySelector('[data-id="' + id + '"]'); if (ne) ne.focus({ preventScroll: true });
        break;
      }
      case 'lock': {
        var n = byId(S.selected); remember(); n.fixed = !n.fixed; touch();
        renderConfig(); renderNodes(); renderChrome();
        focusIn(E.config, '[data-act="lock"]');
        toast(n.fixed ? '已固定节点，保护它不被 Agent 自动修改' : '已取消固定节点');
        break;
      }
      case 'about': S.about = !S.about; renderConfig(); focusIn(E.config, '[data-act="about"]'); break;
      case 'parallel': case 'until': {
        var nn = byId(S.selected);
        remember(); nn.cfg[act] = !nn.cfg[act]; touch();
        renderConfig(); renderNodes(); renderChrome();
        focusIn(E.config, '[data-act="' + act + '"]');
        break;
      }
      case 'edit-inner': toast('示意原型未展开内部画布'); break;
      case 'format': toast('已格式化'); break;
      case 'copy-code': copyCode(t.dataset.key); break;
      case 'sticky-del': remember(); S.stickies.splice(+t.dataset.i, 1); touch(); renderStickies(); renderChrome(); break;
    }
  });

  function onTool(tool) {
    switch (tool) {
      case 'add':
        S.picker = !S.picker; S.search = '';
        renderPicker(); renderChrome();
        if (S.picker) focusIn(E.picker, '#vw-picker-search'); else focusTool('add');
        break;
      case 'sticky': {
        remember();
        var c = centerPoint();
        S.stickies.push({ x: Math.round(c.x - 100), y: Math.round(c.y + 70), text: '' });
        touch(); renderStickies(); renderChrome();
        var tas = E.stickies.querySelectorAll('textarea'); if (tas.length) tas[tas.length - 1].focus({ preventScroll: true });
        break;
      }
      case 'pointer': case 'hand':
        S.mode = tool; app.classList.toggle('is-hand', tool === 'hand'); renderChrome(); focusTool(tool); break;
      case 'arrange': arrange(); break;
      case 'templates': toast('示意原型未接入「工作流模板」'); break;
      case 'advanced': toast('示意原型未接入「高级设置」'); break;
      case 'import': toast('示意原型未接入「导入流程 JSON」'); break;
      case 'export': toast('示意原型未接入「导出」'); break;
    }
  }

  function saveNote() {
    var id = S.notePop && S.notePop.id, ta = document.getElementById('vw-note-text');
    if (!id || !ta) return;
    var text = ta.value.trim();
    if (!text) { deleteNote(); return; }
    S.notes[id] = text;
    if (S.noteOrder.indexOf(id) < 0) S.noteOrder.push(id);
    S.notePop = null;
    renderNotePop(); renderNodes();
    toast('已添加注释，仅保存到聊天草稿');
    focusIn(E.topRight, '[data-act="annotate"]');
  }
  function deleteNote() {
    var id = S.notePop && S.notePop.id;
    if (!id) return;
    var had = !!S.notes[id];
    delete S.notes[id];
    S.noteOrder = S.noteOrder.filter(function (x) { return x !== id; });
    S.notePop = null;
    renderNotePop(); renderNodes();
    if (had) toast('已删除注释');
  }
  function copyCode(key) {
    var n = byId(S.selected), text = '';
    if (n) {
      if (key === 'run-in' || key === 'run-out') { var r = S.lastRun[n.id]; text = r ? JSON.stringify(key === 'run-in' ? r.input : r.output, null, 2) : ''; }
      else text = (n.cfg && n.cfg[key]) || '';
    }
    var done = function () { toast('已复制'); }, fail = function () { toast('复制失败，请选择文字后复制。'); };
    try { navigator.clipboard.writeText(text).then(done, fail); } catch (err) { fail(); }
  }

  // 输入：节点名称、备注、配置字段、面板搜索、便签
  app.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'vw-picker-search') {
      S.search = t.value;
      var sc = document.getElementById('vw-picker-scroll'); if (sc) sc.innerHTML = pickerBody();
      return;
    }
    if (t.dataset.sticky != null) { var s = S.stickies[+t.dataset.sticky]; if (s) { s.text = t.value; if (!S.dirty) { touch(); renderChrome(); } } return; }
    var f = t.dataset.f, n = byId(S.selected);
    if (!f || !n || t.tagName === 'SELECT') return;
    if (!t.dataset.remembered) { remember(); t.dataset.remembered = '1'; }
    if (f === 'title') n.title = t.value || K[n.kind].label;
    else if (f === 'remark') { n.remark = t.value; var cnt = document.getElementById('vw-remark-count'); if (cnt) cnt.textContent = t.value.length + ' 字符'; }
    else n.cfg[f] = t.type === 'number' ? Number(t.value) : t.value;
    touch();
    renderNodes(); renderChrome();
  });
  app.addEventListener('change', function (e) {
    var t = e.target, f = t.dataset.f, n = byId(S.selected);
    if (t.tagName !== 'SELECT' || !f || !n) return;
    remember(); n.cfg[f] = t.value; touch();
    renderConfig(); renderNodes(); renderChrome();
    focusIn(E.config, 'select[data-f="' + f + '"]');
  });

  // 键盘
  app.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('vw-node') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectNode(t.dataset.id); return; }
    if (t.dataset && t.dataset.ptab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var tabs = ['nodes', 'tools', 'start', 'snippets'], i = tabs.indexOf(S.pickerTab);
      S.pickerTab = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; S.search = '';
      renderPicker(); focusIn(E.picker, '[data-ptab="' + S.pickerTab + '"]'); e.preventDefault(); return;
    }
    if (t.dataset && t.dataset.ctab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      S.tab = S.tab === 'settings' ? 'last' : 'settings'; renderConfig(); focusIn(E.config, '[data-ctab="' + S.tab + '"]'); e.preventDefault(); return;
    }
    if (t.id === 'vw-note-text' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (S.modal) { e.preventDefault(); closeModal(); return; }
    if (S.notePop) { e.preventDefault(); S.notePop = null; renderNotePop(); focusIn(E.topRight, '[data-act="annotate"]'); return; }
    if (S.runsPop) { e.preventDefault(); S.runsPop = false; renderRuns(); renderChrome(); focusIn(E.bottomLeft, '[data-act="runs"]'); return; }
    if (S.picker) { e.preventDefault(); S.picker = false; renderPicker(); renderChrome(); focusTool('add'); return; }
    if (S.selected && app.contains(document.activeElement)) {
      e.preventDefault();
      var id = S.selected; deselect();
      var el = E.nodes.querySelector('[data-id="' + id + '"]'); if (el) el.focus({ preventScroll: true });
    }
  });
  // 点外部关闭弹层
  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (!(t instanceof Element)) return;
    if (S.picker && !E.picker.contains(t) && !t.closest('[data-tool="add"]')) { S.picker = false; renderPicker(); renderChrome(); }
    if (S.notePop && !E.notePop.contains(t) && !t.closest('[data-act="annotate"]') && !t.closest('.vw-pin')) { S.notePop = null; renderNotePop(); }
    if (S.runsPop && !E.runs.contains(t) && !t.closest('[data-act="runs"]')) { S.runsPop = false; renderRuns(); renderChrome(); }
  });
  E.modal.addEventListener('pointerdown', function (e) { if (e.target === E.modal) closeModal(); });
  // 弹窗内焦点循环
  E.modal.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = E.modal.querySelectorAll('button:not([disabled]), summary');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // 画布：点选、拖动节点、平移
  var drag = null;
  E.viewport.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || S.trial) return;
    var t = e.target;
    if (t.closest('button, textarea, input, select')) return;
    var nodeEl = t.closest('.vw-node');
    if (nodeEl && S.mode === 'pointer') {
      var n = byId(nodeEl.dataset.id);
      drag = { type: 'node', id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false };
    } else {
      drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: S.view.x, oy: S.view.y, moved: false, onNode: nodeEl ? nodeEl.dataset.id : null };
    }
    try { E.viewport.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
  });
  E.viewport.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    if (!drag.moved && drag.type === 'node') remember();
    drag.moved = true;
    if (drag.type === 'node') {
      var n = byId(drag.id);
      n.x = Math.round(drag.ox + dx / S.view.s); n.y = Math.round(drag.oy + dy / S.view.s);
      var el = E.nodes.querySelector('[data-id="' + n.id + '"]');
      if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
      renderEdges(); renderMinimap();
    } else {
      S.view.x = drag.ox + dx; S.view.y = drag.oy + dy;
      applyView();
      app.classList.add('is-panning');
    }
    if (S.notePop) placeNotePop();
  });
  function endDrag() {
    if (!drag) return;
    var d = drag; drag = null;
    app.classList.remove('is-panning');
    if (d.type === 'node') {
      if (d.moved) { touch(); renderChrome(); } else selectNode(d.id);
    } else if (!d.moved) {
      if (d.onNode) selectNode(d.onNode); else deselect();
    }
  }
  E.viewport.addEventListener('pointerup', endDrag);
  E.viewport.addEventListener('pointercancel', function () { drag = null; app.classList.remove('is-panning'); });

  // 缩略图：点击或拖动移动视口
  E.bottomRight.addEventListener('pointerdown', function (e) {
    var svg = e.target instanceof Element ? e.target.closest('#vw-mini-svg') : null;
    if (!svg) return;
    e.preventDefault();
    var move = function (ev) {
      var vb = svg.dataset.vb.split(',').map(Number), r = svg.getBoundingClientRect();
      var k = Math.min(r.width / vb[2], r.height / vb[3]);
      var ox = (r.width - vb[2] * k) / 2, oy = (r.height - vb[3] * k) / 2;
      var wx = vb[0] + (ev.clientX - r.left - ox) / k, wy = vb[1] + (ev.clientY - r.top - oy) / k;
      S.view.x = E.viewport.clientWidth / 2 - wx * S.view.s;
      S.view.y = E.viewport.clientHeight / 2 - wy * S.view.s;
      applyView();
    };
    move(e);
    var up = function () { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });

  // 演示入口（页面上、示意窗口外）
  if (E.demoTrial) E.demoTrial.addEventListener('click', startTrial);
  if (E.demoReset) E.demoReset.addEventListener('click', function () { reset(); toast('已恢复示例流程'); });

  // 尺寸变化：窄屏切换与首次适应
  var lastW = 0;
  function onResize() {
    var w = app.clientWidth;
    if (!w || w === lastW) return;
    var first = lastW === 0;
    lastW = w;
    app.classList.toggle('is-narrow', w < 760);
    renderChrome();
    if (first) fitView(); else applyView();
    if (S.notePop) placeNotePop();
  }
  S = freshState();
  renderAll();
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(app);
  else window.addEventListener('resize', onResize);
  onResize();
})();
