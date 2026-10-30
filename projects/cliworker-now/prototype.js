// CLI Worker Now 示意原型：按 DeepSeek Harness 桌面端截图还原界面与交互，不连接任何真实 CLI。
// 界面文案、CLI 名称、状态名、权限档位与设置项取自 dsh-cliworker-now 源码（i18n-messages、CLI_LABELS、README）。
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  if (!$('cw-app')) return;

  // ---------- 源码中的标签 ----------
  // 顺序与「CLI Worker 设置 → CLI 连接」一致；模型名只用截图里出现过的，其余显示“默认模型”
  var CLIS = [
    { id: 'antigravity', label: 'Antigravity', short: 'agy', icon: 'antigravity.png', model: 'gemini-3.8-flash' },
    { id: 'codex', label: 'Codex', short: 'codex', icon: 'codex.png', model: 'GPT-6-Luna' },
    { id: 'claude', label: 'Claude Code', short: 'claude', icon: 'claude-code.png' },
    { id: 'kimi', label: 'Kimi', short: 'kimi', icon: 'kimi' },
    { id: 'mimo', label: 'MiMo', short: 'mimo', icon: 'mimo-code.png', model: 'mimo-v2.6-flash' },
    { id: 'zcode', label: 'ZCode', short: 'zcode', icon: 'zcode.png', mono: true, model: 'GLM-5.3-Flash' },
    { id: 'grok', label: 'Grok Build', short: 'grok', icon: 'grok.png', mono: true, model: 'grok-4.6' },
    { id: 'omp', label: 'OMP', short: 'omp', icon: 'omp.png' },
    { id: 'pi', label: 'Pi', short: 'pi', icon: 'pi.png', model: 'glm-5.3-flash' },
    { id: 'hermes', label: 'Hermes Agent', short: 'hermes', icon: 'hermes.png', mono: true },
    { id: 'opencode', label: 'OpenCode', short: 'opencode', icon: 'opencode.png', mono: true },
    { id: 'qoder', label: 'Qoder CLI', short: 'qoder', icon: 'qoder.png', mono: true },
    { id: 'qodercn', label: 'Qoder CN CLI', short: 'qodercn', icon: 'qoder.png', mono: true }
  ];
  var CLI = {};
  CLIS.forEach(function (c) { CLI[c.id] = c; c.model = c.model || '默认模型'; });
  // 主对话里点名 CLI 的写法（README：agy → Antigravity，glm / zhipu / 智谱 → ZCode，harmes → Hermes Agent）
  var CLI_ALIASES = [
    ['qoder cn', 'qodercn'], ['qodercn', 'qodercn'], ['claude code', 'claude'], ['grok build', 'grok'],
    ['hermes agent', 'hermes'], ['oh my pi', 'omp'], ['antigravity', 'antigravity'], ['opencode', 'opencode'],
    ['codex', 'codex'], ['claude', 'claude'], ['kimi', 'kimi'], ['mimo', 'mimo'], ['zcode', 'zcode'],
    ['grok', 'grok'], ['omp', 'omp'], ['hermes', 'hermes'], ['harmes', 'hermes'], ['qoder', 'qoder'],
    ['agy', 'antigravity'], ['glm', 'zcode'], ['zhipu', 'zcode'], ['智谱', 'zcode'], ['pi', 'pi']
  ];

  var NO_ROLE = '不使用角色预设';
  var ROLES = [
    ['商业审稿人', '章首承接、承诺兑现、节拍推进与章末吸引力；只报告不改稿。'],
    ['逻辑审校员', '认知、状态资源、因果、时空、规则关系和 POV 六类检查。'],
    ['文风审校员', '按作品风格与前章先例判断，保留误报放行规则，不自动改稿。'],
    ['正文修订师', '只执行作者授权的问题，保留修改边界、快照与差异清单。'],
    ['剧情节点设计师', '先给一页状态契约，确认后再展开节点设计。'],
    ['剧情结构规划师', '先给单元契约和紧凑节点链，按因果与状态变化拆分。'],
    ['小说主笔', '依据已确认设计写草稿，不覆盖待审、锁定或已发布正文。']
  ];
  var EFFORTS = ['Low', 'Medium', 'High'];
  var STATUS = { queued: '排队中', running: '运行中', completed: '已完成', stopped: '已停止' };
  var MAIN_PERMS = [['view', '仅可查看'], ['workspace', '工作区内修改'], ['full', '完全权限']];
  var MAIN_TO_LEVEL = { view: 0, workspace: 1, full: 2 };
  var LEVEL_DESC = {
    '询问': '读取和只读命令直接执行；改文件和有副作用的命令先问你，拒绝就不改。',
    '自动审批': '使用此 CLI 原生的自动审批，由 CLI 自行判断放行；它仍要确认的请求会问你。',
    '完全权限': '使用此 CLI 原生的完全权限，不再询问。',
    '仅工作区编辑': '工作区内的文件编辑自动批准；命令和工作区外的操作先问你。',
    '仅规划': '以原生规划模式运行，只出方案、不改文件。',
    '自动批准编辑': '文件编辑自动批准；命令先问你。'
  };
  function levelsFor(cli) {
    switch (cli) {
      case 'kimi': return ['仅工作区编辑', '自动审批', '完全权限'];
      case 'antigravity': return ['仅规划', '自动审批', '完全权限'];
      case 'hermes': return [null, '自动审批', '完全权限'];
      case 'zcode': case 'opencode': return ['询问', '仅工作区编辑', '完全权限'];
      case 'omp': case 'pi': return ['询问', '自动批准编辑', '完全权限'];
      default: return ['询问', '自动审批', '完全权限'];
    }
  }
  // 「Pi · 账号」截图中可见的服务商
  var PROVIDERS = [['A', 'Anthropic'], ['O', 'OpenAI'], ['O', 'OpenAI Codex（旧版）'], ['G', 'GitHub Copilot'], ['K', 'Kimi For Coding'],
    ['O', 'OpenRouter'], ['X', 'xAI'], ['D', 'DeepSeek'], ['月', '月之暗面（中国）'], ['M', 'Moonshot AI']];

  // ---------- 状态 ----------
  var state = {
    mainPerm: 'workspace',
    settings: { lang: '跟随 DSH', maxConc: 2, parallel: false, askModel: true, total: '30 分钟（默认）', idle: '不启用（默认）' },
    enabled: {},
    saved: {},
    workers: [],
    deleted: [],
    filter: 'all',
    query: '',
    collapsed: {},
    openId: null,
    spage: 'general',
    connOpen: true,
    provider: 0,
    rounds: 1,
    steps: 3,
    tok: 36.1
  };
  CLIS.forEach(function (c) { state.enabled[c.id] = true; });
  var seq = 0;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function delay(ms) { return reduceMotion ? Math.min(ms, 400) : ms; }

  // ---------- 工具 ----------
  var SVG = 'http://www.w3.org/2000/svg';
  var PATHS = {
    caret: '<path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    chevron: '<path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    copy: '<rect x="5" y="5" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3 10.5V4.5C3 3.7 3.7 3 4.5 3h6" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    up: '<path d="M5 7.5V13M5 7.5 7.5 3c.9 0 1.5.7 1.4 1.6L8.6 7H12c.8 0 1.3.7 1.2 1.5l-.7 3.6c-.1.5-.6.9-1.2.9H5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 7.5H5V13H2.5z" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    down: '<g transform="rotate(180 8 8)"><path d="M5 7.5V13M5 7.5 7.5 3c.9 0 1.5.7 1.4 1.6L8.6 7H12c.8 0 1.3.7 1.2 1.5l-.7 3.6c-.1.5-.6.9-1.2.9H5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M2.5 7.5H5V13H2.5z" fill="none" stroke="currentColor" stroke-width="1.3"/></g>',
    share: '<circle cx="12" cy="3.8" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="4" cy="8" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12.2" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m5.5 7.2 5-2.6M5.5 8.8l5 2.6" stroke="currentColor" stroke-width="1.3"/>',
    db: '<ellipse cx="8" cy="4" rx="5" ry="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    gauge: '<path d="M2.5 11a5.5 5.5 0 1 1 11 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="m8 11 2.5-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    ring: '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".35"/><path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    bubble: '<path d="M3 4.5C3 3.7 3.7 3 4.5 3h7c.8 0 1.5.7 1.5 1.5v5c0 .8-.7 1.5-1.5 1.5H7l-3 2.5V11h.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M5.5 6.5h5M5.5 8.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    gear: '<circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8.6 2.5h2.8l.5 2.1 1.6.9 2.1-.7 1.4 2.4-1.6 1.5v1.8l1.6 1.5-1.4 2.4-2.1-.7-1.6.9-.5 2.1H8.6l-.5-2.1-1.6-.9-2.1.7L3 12.1l1.6-1.5V8.8L3 7.3l1.4-2.4 2.1.7 1.6-.9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    user: '<circle cx="10" cy="7" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.8 17c.6-3.2 3.1-5 6.2-5s5.6 1.8 6.2 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    link: '<path d="M8.5 11.5 11.5 8.5M7.2 9.3 5.6 10.9a2.5 2.5 0 0 0 3.5 3.5l1.6-1.6M12.8 10.7l1.6-1.6a2.5 2.5 0 0 0-3.5-3.5L9.3 7.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    term: '<path d="m3.5 5 3 3-3 3M8 11.5h4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  function svg(name, cls, vb) {
    var s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', vb || '0 0 16 16');
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    s.innerHTML = PATHS[name];
    return s;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(cls, text) {
    var b = el('button', cls, text);
    b.type = 'button';
    return b;
  }
  function cliIcon(id) {
    var c = CLI[id];
    var wrap = el('span', 'cw-cli-ico');
    wrap.setAttribute('aria-hidden', 'true');
    if (c.icon === 'kimi') {
      var a = el('img', 'cw-k-light'); a.src = 'icons/kimi-light.png'; a.alt = '';
      var b = el('img', 'cw-k-dark'); b.src = 'icons/kimi-dark.png'; b.alt = '';
      wrap.appendChild(a); wrap.appendChild(b);
    } else {
      var i = el('img', c.mono ? 'cw-mono' : null); i.src = 'icons/' + c.icon; i.alt = '';
      wrap.appendChild(i);
    }
    return wrap;
  }
  function statusEl(s) {
    var n = el('span', 'cw-status', STATUS[s]);
    n.setAttribute('data-s', s);
    return n;
  }
  function now() {
    var d = new Date();
    return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }
  function minutesAgo(m) {
    var d = new Date(Date.now() - m * 60000);
    return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }
  function findWorker(id) {
    for (var i = 0; i < state.workers.length; i++) if (state.workers[i].id === id) return state.workers[i];
    return null;
  }
  function scrollDown(box) { box.scrollTop = box.scrollHeight; }
  var seen = {};
  function mark(node, key) {
    if (!seen[key]) { seen[key] = true; node.classList.add('is-new'); }
    return node;
  }
  function fmtTok(k) { return (Math.round(k * 10) / 10) + 'K tok'; }

  // ---------- 主对话 ----------
  var mainBox = $('cw-main-messages');
  function push(node) { mainBox.appendChild(node); scrollDown(mainBox); return node; }
  function userMsg(text, time) {
    push(el('div', 'cw-u is-new', text));
    var meta = el('div', 'cw-u-meta');
    meta.appendChild(el('span', null, time || now()));
    meta.appendChild(svg('copy'));
    push(meta);
  }
  function doneLine(text) {
    var b = el('div', 'cw-done', text);
    b.style.cursor = 'default';
    return push(b);
  }
  function botMsg(nodesOrText) {
    var m = el('div', 'cw-a is-new');
    (Array.isArray(nodesOrText) ? nodesOrText : [nodesOrText]).forEach(function (p) {
      if (typeof p === 'string') m.appendChild(document.createTextNode(p));
      else m.appendChild(p);
    });
    return push(m);
  }
  function actsRow(tok, time) {
    var r = el('div', 'cw-acts');
    r.setAttribute('aria-hidden', 'true');
    ['copy', 'up', 'down', 'share'].forEach(function (n) { r.appendChild(svg(n)); });
    var u = el('span'); u.appendChild(svg('db')); u.appendChild(document.createTextNode('用量 ' + fmtTok(tok)));
    r.appendChild(u);
    r.appendChild(el('span', null, time || now()));
    return r;
  }
  function bold(t) { return el('b', null, t); }
  function code(t) { return el('code', null, t); }

  function renderUsage() {
    var u = $('cw-main-usage');
    u.textContent = '';
    var a = el('span'); a.appendChild(svg('gauge')); a.appendChild(document.createTextNode(state.rounds + ' 轮 ' + state.steps + ' 步'));
    var b = el('span'); b.appendChild(svg('db')); b.appendChild(document.createTextNode(fmtTok(state.tok)));
    var c = el('span'); c.appendChild(svg('ring')); c.appendChild(document.createTextNode(Math.min(60, 1 + state.rounds * 2) + '%'));
    u.appendChild(a); u.appendChild(b); u.appendChild(c);
  }

  // ---------- Worker 生命周期 ----------
  function fileOf(text) {
    var m = /[\w.-]+\.txt/.exec(text);
    return m ? m[0] : null;
  }
  function stepsFor(w, prompt) {
    var f = fileOf(prompt);
    if (w.role !== NO_ROLE) return [['读取', '指定章节与设定'], ['检查', '按「' + w.role + '」的规则逐项核对'], ['整理', '问题清单与证据位置']];
    if (f) return [['写入文件', f], ['运行命令', 'cat ' + f], ['核对', '文件内容']];
    return [['读取', '任务上下文'], ['执行', '本轮指令'], ['整理', '结果']];
  }
  function replyFor(w, prompt) {
    var f = fileOf(prompt);
    var okText = CLI[w.cli].short.toUpperCase() + '-OK';
    if (w.role !== NO_ROLE) return ['已按「' + w.role + '」完成：' + prompt + '。（示意回复，真实产品显示 CLI 的原生输出）'];
    if (f) return ['已创建并读取 ', code(f), '，文件内容：', code(okText), '。'];
    return ['已完成：' + prompt + '。（示意回复，真实产品显示 CLI 的原生输出）'];
  }
  function newTurn(prompt) {
    return { prompt: prompt, time: now(), steps: [], reply: null, status: 'queued', started: 0, elapsed: 0, tok: 8 + Math.round(Math.random() * 300) / 10, open: false, timers: [] };
  }
  function createWorker(o) {
    seq += 1;
    var w = { id: 'w' + seq, cli: o.cli, name: o.name, title: o.title, role: o.role, model: o.model, effort: o.effort, level: null, status: 'new', turns: [], pending: [] };
    state.workers.push(w);
    return w;
  }
  function enqueue(w, prompt) {
    var t = newTurn(prompt);
    if (w.status === 'running' || w.status === 'queued') w.pending.push(t);
    else { w.turns.push(t); w.status = 'queued'; }
    refresh(w);
    setTimeout(schedule, delay(700));
  }
  function runningCount() { return state.workers.filter(function (w) { return w.status === 'running'; }).length; }
  function schedule() {
    state.workers.forEach(function (w) {
      if (w.status === 'queued' && runningCount() < state.settings.maxConc) startTurn(w);
    });
    updateCounts();
  }
  function startTurn(w) {
    var t = w.turns[w.turns.length - 1];
    w.status = 'running'; t.status = 'running'; t.started = Date.now();
    var steps = stepsFor(w, t.prompt), gap = delay(1200);
    steps.forEach(function (s, i) {
      t.timers.push(setTimeout(function () { t.steps.push(s); refresh(w); }, gap * (i + 1)));
    });
    t.timers.push(setTimeout(function () { finishTurn(w, t); }, gap * (steps.length + 1)));
    refresh(w);
  }
  function finishTurn(w, t) {
    t.status = 'completed';
    t.elapsed = Math.max(1, Math.round((Date.now() - t.started) / 1000));
    t.reply = replyFor(w, t.prompt);
    w.status = 'completed';
    reportToMain(w, t);
    if (w.pending.length) { w.turns.push(w.pending.shift()); w.status = 'queued'; }
    refresh(w);
    setTimeout(schedule, delay(400));
  }
  function stopWorker(w) {
    var t = w.turns[w.turns.length - 1];
    if (!t || (w.status !== 'running' && w.status !== 'queued')) return;
    t.timers.forEach(clearTimeout);
    t.status = 'stopped';
    t.elapsed = t.started ? Math.max(1, Math.round((Date.now() - t.started) / 1000)) : 0;
    w.pending = [];
    w.status = 'stopped';
    refresh(w);
    setTimeout(schedule, delay(300));
  }
  function reportToMain(w, t) {
    var pill = el('div', 'cw-bgpill is-new');
    pill.appendChild(svg('bubble'));
    pill.appendChild(el('span', null, '后台任务状态更新'));
    pill.appendChild(el('time', null, now()));
    push(pill);
    doneLine('已完成，用时 ' + (t.elapsed + 2) + ' 秒');
    var box = el('div', 'cw-a is-new');
    box.appendChild(el('p', null, '核查完成，任务结果汇报如下：'));
    var h = el('h4', null, '任务状态：✅ 完成（completed）');
    h.style.marginTop = '8px';
    box.appendChild(h);
    var tbl = el('table', 'cw-tbl');
    [['Worker', [code(w.name), '（' + CLI[w.cli].label + '，后续可用同名继续对话）']], ['任务内容', [t.prompt]], ['结果', t.reply]].forEach(function (r) {
      var tr = el('tr'); tr.appendChild(el('th', null, r[0]));
      var td = el('td');
      r[1].forEach(function (p) { td.appendChild(typeof p === 'string' ? document.createTextNode(p) : p.cloneNode(true)); });
      tr.appendChild(td); tbl.appendChild(tr);
    });
    box.appendChild(tbl);
    push(box);
    push(actsRow(t.tok + 4, now()));
    state.rounds += 1; state.steps += 2; state.tok += t.tok / 2;
    renderUsage();
    addFollowChip(w);
  }

  function refresh(w) {
    renderList();
    updateCounts();
    if (state.openId === w.id) renderDetail();
  }
  function updateCounts() {
    $('cw-sub-count').textContent = state.workers.length + ' 个子智能体';
  }

  // ---------- 右栏：列表 ----------
  function matchFilter(w) {
    var q = state.query.trim().toLowerCase();
    var hay = (CLI[w.cli].label + ' ' + w.name + ' ' + w.title + ' ' + w.model + ' ' + w.effort).toLowerCase();
    if (q && hay.indexOf(q) === -1) return false;
    if (state.filter === 'active') return w.status === 'running' || w.status === 'queued';
    if (state.filter === 'completed') return w.status === 'completed';
    if (state.filter === 'attention') return false; // 示意中没有失败或待核实；用户主动停止不计入异常
    return true;
  }
  function renderList() {
    var box = $('cw-groups');
    box.textContent = '';
    if (!state.workers.length) {
      var e = el('div', 'cw-empty');
      e.appendChild(el('p', null, '把想做的事，交给合适的伙伴。'));
      e.appendChild(el('p', null, '在主对话中发起任务，协作会在这里展开。'));
      box.appendChild(e);
      return;
    }
    var visible = state.workers.filter(matchFilter);
    if (!visible.length) {
      var n = el('div', 'cw-empty'); n.appendChild(el('p', null, '没有符合条件的子 Agent。')); box.appendChild(n);
      return;
    }
    CLIS.forEach(function (c) {
      var list = visible.filter(function (w) { return w.cli === c.id; });
      if (!list.length) return;
      var g = mark(el('div', 'cw-group'), 'g-' + c.id);
      var open = !state.collapsed[c.id];
      var head = btn('cw-group-head');
      head.setAttribute('aria-expanded', String(open));
      head.appendChild(cliIcon(c.id));
      head.appendChild(el('span', null, c.label));
      head.appendChild(el('span', 'cw-group-count', list.length + ' 个 Agent'));
      head.appendChild(svg('caret', 'cw-caret'));
      head.addEventListener('click', function () { state.collapsed[c.id] = open; renderList(); box.querySelector('[data-g="' + c.id + '"]').focus(); });
      head.setAttribute('data-g', c.id);
      g.appendChild(head);
      if (open) list.forEach(function (w) {
        var card = mark(btn('cw-card'), 'c-' + w.id);
        card.setAttribute('data-id', w.id);
        card.setAttribute('aria-label', w.title + '，' + STATUS[w.status] + '，' + w.name);
        var body = el('span', 'cw-card-body');
        var t = el('span', 'cw-card-title');
        t.appendChild(el('span', null, w.title));
        t.appendChild(statusEl(w.status));
        body.appendChild(t);
        var m = el('span', 'cw-card-meta');
        m.appendChild(el('span', null, w.name));
        m.appendChild(el('i', null, '|'));
        m.appendChild(el('span', null, w.model));
        m.appendChild(el('i', null, '·'));
        m.appendChild(el('span', null, w.effort));
        body.appendChild(m);
        card.appendChild(body);
        card.appendChild(svg('chevron'));
        card.addEventListener('click', function () { openDetail(w.id); });
        g.appendChild(card);
      });
      box.appendChild(g);
    });
  }

  // ---------- 右栏：Worker 原生对话 ----------
  function effectiveLevel(w) {
    var levels = levelsFor(w.cli);
    var idx = w.level != null ? w.level : MAIN_TO_LEVEL[state.mainPerm];
    if (!levels[idx]) idx = 1;
    return { idx: idx, label: levels[idx] };
  }
  function openDetail(id) {
    closeMenu();
    state.openId = id;
    $('cw-list-view').hidden = true;
    $('cw-detail-view').hidden = false;
    renderDetail();
    $('cw-back').focus();
  }
  function closeDetail() {
    var id = state.openId;
    state.openId = null;
    closeMenu();
    $('cw-detail-view').hidden = true;
    $('cw-list-view').hidden = false;
    renderList();
    var card = $('cw-groups').querySelector('[data-id="' + id + '"]');
    if (card) card.focus(); else $('cw-gear').focus();
  }
  function renderDetail() {
    var w = findWorker(state.openId);
    if (!w) return;
    $('cw-detail-title').textContent = w.name + '｜' + w.title;
    var box = $('cw-detail-messages');
    box.textContent = '';
    w.turns.concat(w.pending).forEach(function (t, ti) {
      var k = w.id + '-' + ti;
      box.appendChild(mark(el('div', 'cw-u', t.prompt), k + 'u'));
      var meta = el('div', 'cw-u-meta'); meta.appendChild(el('span', null, t.time)); meta.appendChild(svg('copy'));
      box.appendChild(meta);
      if (t.status === 'queued') {
        box.appendChild(el('div', 'cw-sysnote', w.pending.indexOf(t) > -1 ? '本轮结束后发送' : '排队中：等待空闲的同时对话位'));
        return;
      }
      if (t.status === 'running') {
        var r = el('div', 'cw-running');
        r.appendChild(document.createTextNode('运行中'));
        var dots = el('span', 'cw-typing'); dots.setAttribute('aria-hidden', 'true');
        dots.appendChild(el('i')); dots.appendChild(el('i')); dots.appendChild(el('i'));
        r.appendChild(dots);
        box.appendChild(r);
      } else {
        var d = btn('cw-done', t.status === 'stopped' ? '已停止，用时 ' + t.elapsed + ' 秒' : '已完成，用时 ' + t.elapsed + ' 秒');
        d.setAttribute('aria-expanded', String(t.open));
        d.appendChild(svg('caret', 'cw-caret'));
        d.addEventListener('click', function () { t.open = !t.open; renderDetail(); });
        box.appendChild(d);
      }
      if (t.steps.length && (t.status === 'running' || t.open)) {
        var ul = el('ul', 'cw-steps');
        t.steps.forEach(function (s, si) {
          var li = mark(el('li'), k + 's' + si);
          li.appendChild(document.createTextNode(s[0] + ' '));
          li.appendChild(code(s[1]));
          ul.appendChild(li);
        });
        box.appendChild(ul);
      }
      if (t.reply) {
        var a = mark(el('div', 'cw-a'), k + 'r');
        t.reply.forEach(function (p) { a.appendChild(typeof p === 'string' ? document.createTextNode(p) : p.cloneNode(true)); });
        box.appendChild(a);
        box.appendChild(actsRow(t.tok, t.time));
      }
    });
    scrollDown(box);

    $('cw-worker-perm-label').textContent = effectiveLevel(w).label;
    var model = $('cw-worker-model');
    model.textContent = w.model + ' ';
    model.appendChild(el('em', null, w.effort));
    model.appendChild(svg('caret', 'cw-caret'));
    syncDetailSend();

    var u = $('cw-detail-usage');
    u.textContent = '';
    u.appendChild(statusEl(w.status));
    var allTurns = w.turns.filter(function (t) { return t.status !== 'queued'; });
    var a1 = el('span'); a1.appendChild(svg('gauge')); a1.appendChild(document.createTextNode(allTurns.length + ' 轮 ' + allTurns.reduce(function (s, t) { return s + t.steps.length; }, 0) + ' 步'));
    var a2 = el('span'); a2.appendChild(svg('db')); a2.appendChild(document.createTextNode(fmtTok(allTurns.reduce(function (s, t) { return s + (t.reply ? t.tok : 0); }, 0))));
    u.appendChild(a1); u.appendChild(a2);
  }
  function syncDetailSend() {
    var w = findWorker(state.openId);
    var b = $('cw-detail-send');
    var hasText = !!$('cw-detail-input').value.trim();
    var stop = !!w && (w.status === 'running' || w.status === 'queued') && !hasText;
    b.classList.toggle('is-stop', stop);
    b.classList.toggle('is-ready', hasText);
    b.setAttribute('aria-label', stop ? '停止' : '发送');
  }

  // ---------- 菜单 ----------
  var openMenuRec = null;
  function closeMenu(returnFocus) {
    if (!openMenuRec) return;
    var m = openMenuRec;
    m.panel.hidden = true;
    m.btn.setAttribute('aria-expanded', 'false');
    openMenuRec = null;
    if (returnFocus) m.btn.focus();
  }
  function toggleMenu(b, panel, build) {
    if (openMenuRec && openMenuRec.panel === panel) { closeMenu(true); return; }
    closeMenu();
    panel.textContent = '';
    build(panel);
    panel.hidden = false;
    b.setAttribute('aria-expanded', 'true');
    openMenuRec = { btn: b, panel: panel };
    var first = panel.querySelector('[aria-checked="true"]') || panel.querySelector('button');
    if (first) first.focus();
  }
  function menuItem(label, desc, checked, onPick, prefix) {
    var b = btn('cw-menu-item');
    b.setAttribute('role', checked == null ? 'menuitem' : 'menuitemradio');
    if (checked != null) b.setAttribute('aria-checked', String(!!checked));
    if (checked != null) { var mk = el('span', 'cw-menu-check', checked ? '✓' : ''); mk.setAttribute('aria-hidden', 'true'); b.appendChild(mk); }
    if (prefix) b.appendChild(prefix);
    var tx = el('span'); tx.appendChild(document.createTextNode(label));
    if (desc) tx.appendChild(el('small', null, desc));
    b.appendChild(tx);
    b.addEventListener('click', function () { closeMenu(true); onPick(); });
    return b;
  }
  function menuNote(text, cls) {
    var n = el('p', cls || 'cw-menu-title', text);
    n.setAttribute('role', 'presentation');
    return n;
  }
  document.addEventListener('pointerdown', function (e) {
    if (!openMenuRec) return;
    if (openMenuRec.panel.contains(e.target) || openMenuRec.btn.contains(e.target)) return;
    closeMenu();
  });
  $('cw-app').addEventListener('keydown', function (e) {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && openMenuRec) {
      var items = Array.prototype.slice.call(openMenuRec.panel.querySelectorAll('.cw-menu-item'));
      var i = items.indexOf(document.activeElement);
      if (i > -1) { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
    }
  });

  // 主对话权限
  $('cw-main-perm-btn').addEventListener('click', function () {
    toggleMenu(this, $('cw-main-perm-menu'), function (p) {
      MAIN_PERMS.forEach(function (m) {
        p.appendChild(menuItem(m[1], null, m[0] === state.mainPerm, function () {
          state.mainPerm = m[0];
          $('cw-main-perm-label').textContent = m[1];
          if (state.openId) renderDetail();
        }));
      });
      p.appendChild(el('div', 'cw-menu-sep'));
      p.appendChild(menuNote('没选过档位的 Worker 跟随主对话'));
    });
  });
  // Worker 权限
  $('cw-worker-perm-btn').addEventListener('click', function () {
    var w = findWorker(state.openId);
    if (!w) return;
    toggleMenu(this, $('cw-worker-perm-menu'), function (p) {
      p.appendChild(menuNote(CLI[w.cli].label + ' 的权限档位' + (w.level == null ? '（当前跟随主对话）' : '')));
      var cur = effectiveLevel(w).idx;
      levelsFor(w.cli).forEach(function (label, idx) {
        if (!label) return;
        p.appendChild(menuItem(label, LEVEL_DESC[label], idx === cur, function () { w.level = idx; renderDetail(); }));
      });
      if (w.level != null) {
        p.appendChild(el('div', 'cw-menu-sep'));
        p.appendChild(menuItem('恢复跟随主对话', null, null, function () { w.level = null; renderDetail(); }));
      }
    });
  });
  // 子智能体下拉
  $('cw-sub-btn').addEventListener('click', function () {
    toggleMenu(this, $('cw-sub-menu'), function (p) {
      if (!state.workers.length) { p.appendChild(menuNote('还没有子智能体', 'cw-menu-empty')); return; }
      state.workers.forEach(function (w) {
        p.appendChild(menuItem(w.name + '｜' + w.title, CLI[w.cli].label + ' · ' + STATUS[w.status], null, function () { openDetail(w.id); }, cliIcon(w.cli)));
      });
    });
  });
  // 任务选项
  $('cw-opt-btn').addEventListener('click', function () {
    var w = findWorker(state.openId);
    if (!w) return;
    toggleMenu(this, $('cw-opt-menu'), function (p) {
      var del = menuItem('删除', null, null, function () {
        stopWorker(w);
        state.workers.splice(state.workers.indexOf(w), 1);
        state.deleted.unshift(w);
        updateCounts();
        closeDetail();
      });
      del.classList.add('is-danger');
      p.appendChild(del);
    });
  });
  // 已删除对话
  $('cw-trash').addEventListener('click', function () {
    toggleMenu(this, $('cw-trash-menu'), function (p) {
      p.appendChild(menuNote('已删除对话'));
      if (!state.deleted.length) { p.appendChild(menuNote('没有已删除的对话', 'cw-menu-empty')); return; }
      state.deleted.forEach(function (w) {
        p.appendChild(menuItem(w.name + '｜' + w.title, '恢复', null, function () {
          state.deleted.splice(state.deleted.indexOf(w), 1);
          w.status = w.status === 'new' ? 'completed' : w.status;
          state.workers.push(w);
          renderList(); updateCounts();
        }, cliIcon(w.cli)));
      });
    });
  });

  // ---------- 问题卡片与派遣 ----------
  function askSetup(cliId, done) {
    var c = CLI[cliId];
    var steps = [
      { q: '选择 ' + c.label + ' 的模型', opts: [c.model] },
      { q: '选择思考强度', opts: EFFORTS },
      { q: '选择智能体预设', opts: [NO_ROLE].concat(ROLES.map(function (r) { return r[0]; })) }
    ];
    var picks = [];
    var card = push(el('div', 'cw-qcard is-new'));
    card.setAttribute('role', 'group');
    function draw(i) {
      card.textContent = '';
      if (i >= steps.length) {
        card.appendChild(el('div', 'cw-qcard-done', '已确认：' + picks[0] + ' · ' + picks[1] + ' · ' + picks[2]));
        done({ model: picks[0], effort: picks[1], role: picks[2] });
        return;
      }
      var h = el('div', 'cw-qcard-head');
      h.appendChild(bold(steps[i].q));
      h.appendChild(el('small', null, '问题 ' + (i + 1) + ' / ' + steps.length));
      card.setAttribute('aria-label', steps[i].q);
      card.appendChild(h);
      var o = el('div', 'cw-qopts');
      steps[i].opts.forEach(function (opt) {
        var b = btn('cw-qopt', opt);
        b.addEventListener('click', function () { picks.push(opt); draw(i + 1); var f = card.querySelector('button'); if (f) f.focus(); });
        o.appendChild(b);
      });
      card.appendChild(o);
      scrollDown(mainBox);
    }
    draw(0);
  }
  function uniqueName(stem, explicit) {
    var all = state.workers.concat(state.deleted);
    var taken = function (n) { return all.some(function (w) { return w.name === n; }); };
    if (explicit && !taken(stem)) return stem;
    var i = 1;
    while (taken(stem + '-' + i)) i += 1;
    return stem + '-' + i;
  }
  function dispatchFromText(text, cliId) {
    var c = CLI[cliId];
    var nm = /命名为[“"「『]?([^”"」』，。,\s]+)/.exec(text);
    var name = nm ? uniqueName(nm[1], true) : uniqueName(c.short);
    var tm = new RegExp('用\\s*' + c.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*([^，,。]+)', 'i').exec(text);
    var title = (tm ? tm[1] : text).trim().slice(0, 28);
    if (!state.enabled[cliId]) {
      setTimeout(function () { botMsg(c.label + ' 已在「CLI Worker 设置 → CLI 连接」中关闭，未派遣。'); }, delay(400));
      return;
    }
    if (state.mainPerm === 'view' && (cliId === 'antigravity' || cliId === 'hermes' || cliId === 'kimi')) {
      setTimeout(function () { botMsg('主对话当前为「仅可查看」，' + c.label + ' 没有对应的只读档位，未派遣。'); }, delay(400));
      return;
    }
    var go = function (pick) {
      state.saved[cliId] = pick;
      var w = createWorker({ cli: cliId, name: name, title: title, role: pick.role, model: pick.model, effort: pick.effort });
      enqueue(w, title);
      var busy = runningCount() >= state.settings.maxConc;
      botMsg(['已派遣 ', code(name), '（' + c.label + ' · ' + pick.model + ' · ' + pick.effort + '）' +
        (busy ? '。已达到最高同时对话数，先进入排队。' : '，可在右侧 CLI Worker 面板查看过程。')]);
      state.rounds += 1; state.steps += 1; renderUsage();
    };
    setTimeout(function () {
      if (!state.settings.askModel && state.saved[cliId]) {
        var s = state.saved[cliId];
        push(el('div', 'cw-sysnote', '已关闭「调用前询问模型」：直接使用本项目的默认设定 ' + s.model + ' · ' + s.effort + ' · ' + s.role));
        go(s);
      } else {
        askSetup(cliId, go);
      }
    }, delay(450));
  }
  function detectCli(text) {
    var low = text.toLowerCase();
    for (var i = 0; i < CLI_ALIASES.length; i++) {
      var a = CLI_ALIASES[i][0];
      var re = /^[a-z ]+$/.test(a) ? new RegExp('(^|[^a-z])' + a + '([^a-z]|$)') : null;
      if (re ? re.test(low) : low.indexOf(a) > -1) return CLI_ALIASES[i][1];
    }
    return null;
  }
  function handleMain(text) {
    userMsg(text);
    var byName = state.workers.slice().sort(function (a, b) { return b.name.length - a.name.length; })
      .filter(function (w) { return text.indexOf(w.name) > -1; })[0];
    if (byName) {
      setTimeout(function () {
        var rest = text.replace(/^让\s*/, '').replace(byName.name, '').replace(/^[\s，,]+/, '') || '继续';
        enqueue(byName, rest);
        botMsg(['已交给 ', code(byName.name), '（' + CLI[byName.cli].label + '）继续，沿用同一个原生会话。']);
      }, delay(450));
      return;
    }
    var cli = detectCli(text);
    if (cli) { dispatchFromText(text, cli); return; }
    setTimeout(function () {
      botMsg(state.workers.length
        ? '没有找到这个名字的智能体。可以续聊的有：' + state.workers.map(function (w) { return w.name; }).join('、') + '。'
        : '请在消息里点名一个 CLI，例如“用 Codex 创建并读取 demo-codex.txt”。');
    }, delay(450));
  }
  function examplePrompt(cliId) {
    var c = CLI[cliId];
    var base = 'demo-' + c.short, f = base + '.txt', n = 2;
    while (state.workers.concat(state.deleted).some(function (w) { return w.title.indexOf(f) > -1; })) { f = base + '-' + n + '.txt'; n += 1; }
    return '用 ' + c.label + ' 创建并读取 ' + f + '，内容写 ' + c.short.toUpperCase() + '-OK';
  }

  // 示例指令行
  var tryRow = $('cw-try');
  var moreMenu = el('div', 'cw-menu cw-try-menu');
  moreMenu.id = 'cw-try-menu';
  moreMenu.setAttribute('role', 'menu');
  moreMenu.setAttribute('aria-label', '选择 CLI');
  moreMenu.hidden = true;
  tryRow.parentNode.appendChild(moreMenu);
  var followChips = [];
  function renderTry() {
    tryRow.textContent = '';
    tryRow.appendChild(el('span', null, '试试：'));
    followChips.slice(-2).forEach(function (w) {
      if (state.workers.indexOf(w) === -1) return;
      var b = btn('cw-try-chip', '让 ' + w.name + ' 继续');
      b.addEventListener('click', function () { handleMain('让 ' + w.name + ' 再读取一次 ' + (fileOf(w.title) || '结果') + ' 并确认内容'); });
      tryRow.appendChild(b);
    });
    ['codex', 'claude', 'pi'].forEach(function (id) {
      var b = btn('cw-try-chip');
      b.appendChild(cliIcon(id));
      b.appendChild(document.createTextNode('派遣 ' + CLI[id].label));
      b.addEventListener('click', function () { handleMain(examplePrompt(id)); });
      tryRow.appendChild(b);
    });
    var more = btn('cw-try-chip', '更多 CLI');
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-controls', 'cw-try-menu');
    more.appendChild(svg('caret', 'cw-caret'));
    more.addEventListener('click', function () {
      toggleMenu(more, moreMenu, function (p) {
        p.appendChild(menuNote('在主对话里点名 CLI 派遣'));
        CLIS.forEach(function (c) {
          p.appendChild(menuItem(c.label, null, null, function () { handleMain(examplePrompt(c.id)); }, cliIcon(c.id)));
        });
      });
    });
    tryRow.appendChild(more);
  }
  function addFollowChip(w) {
    followChips = followChips.filter(function (x) { return x !== w; });
    followChips.push(w);
    renderTry();
  }

  $('cw-main-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('cw-main-input');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    syncMainSend();
    handleMain(text);
  });
  function syncMainSend() {
    $('cw-main-form').querySelector('.cw-send').classList.toggle('is-ready', !!$('cw-main-input').value.trim());
  }
  $('cw-main-input').addEventListener('input', syncMainSend);
  $('cw-detail-input').addEventListener('input', syncDetailSend);
  $('cw-detail-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var w = findWorker(state.openId);
    if (!w) return;
    var input = $('cw-detail-input');
    var text = input.value.trim();
    if (!text) {
      if (w.status === 'running' || w.status === 'queued') stopWorker(w);
      return;
    }
    input.value = '';
    enqueue(w, text);
  });
  $('cw-back').addEventListener('click', closeDetail);
  $('cw-search').addEventListener('input', function (e) { state.query = e.target.value; renderList(); });
  Array.prototype.forEach.call(document.querySelectorAll('.cw-filters > button[data-filter]'), function (b) {
    b.addEventListener('click', function () {
      state.filter = b.getAttribute('data-filter');
      Array.prototype.forEach.call(document.querySelectorAll('.cw-filters > button[data-filter]'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      renderList();
    });
  });

  // ---------- 弹窗：CLI Worker 设置 ----------
  var modalStack = [];
  function openModal(id, opener) {
    closeMenu();
    var ov = $(id);
    ov.hidden = false;
    modalStack.push({ id: id, opener: opener });
    var d = ov.querySelector('.cw-dialog');
    var f = d.querySelector('[aria-current="true"], [aria-checked="true"], button, select, input');
    if (f) f.focus();
    if (window.innerWidth < 760) ov.scrollIntoView({ block: 'nearest' });
  }
  function closeModal(id) {
    var i = -1;
    modalStack.forEach(function (m, k) { if (m.id === id) i = k; });
    if (i < 0) return;
    var rec = modalStack.splice(i, 1)[0];
    $(id).hidden = true;
    if (rec.opener && document.body.contains(rec.opener)) rec.opener.focus();
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (b) {
    b.addEventListener('click', function () { closeModal(b.getAttribute('data-close')); });
  });
  ['cw-settings', 'cw-account'].forEach(function (id) {
    $(id).addEventListener('click', function (e) { if (e.target === $(id)) closeModal(id); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (openMenuRec) { e.preventDefault(); closeMenu(true); return; }
      if (modalStack.length) { e.preventDefault(); closeModal(modalStack[modalStack.length - 1].id); }
      return;
    }
    if (e.key === 'Tab' && modalStack.length) {
      var top = $(modalStack[modalStack.length - 1].id).querySelector('.cw-dialog');
      var f = Array.prototype.filter.call(top.querySelectorAll('button, select, input'), function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      else if (!top.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); }
    }
  });
  $('cw-gear').addEventListener('click', function () {
    renderSettings();
    openModal('cw-settings', this);
  });

  function renderSettings() {
    var nav = $('cw-snav');
    nav.textContent = '';
    function navItem(key, label, iconNode) {
      var b = btn('cw-snav-item');
      if (iconNode) b.appendChild(iconNode);
      b.appendChild(el('span', null, label));
      if (state.spage === key) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () {
        state.spage = key;
        renderSettings();
        var cur = nav.querySelector('[aria-current="true"]'); if (cur) cur.focus();
        if (key === 'cli:pi') openAccount(cur);
      });
      return b;
    }
    nav.appendChild(navItem('general', 'CLI Worker 设置', svg('gear', null, '0 0 20 20')));
    nav.appendChild(navItem('agents', '智能体设置', svg('user', null, '0 0 20 20')));
    var conn = btn('cw-snav-item');
    conn.appendChild(svg('link', null, '0 0 20 20'));
    conn.appendChild(el('span', null, 'CLI 连接'));
    conn.appendChild(svg('caret', 'cw-caret'));
    conn.setAttribute('aria-expanded', String(state.connOpen));
    conn.addEventListener('click', function () { state.connOpen = !state.connOpen; renderSettings(); nav.querySelector('[aria-expanded]').focus(); });
    nav.appendChild(conn);
    if (state.connOpen) CLIS.forEach(function (c) {
      var b = navItem('cli:' + c.id, c.label, cliIcon(c.id));
      b.classList.add('cw-snav-cli');
      var dot = el('span', 'cw-dot' + (state.enabled[c.id] ? '' : ' is-off'));
      dot.setAttribute('aria-label', state.enabled[c.id] ? '已连接' : '已关闭');
      b.appendChild(dot);
      nav.appendChild(b);
    });
    renderSettingsPage();
  }
  function selectRow(title, desc, options, value, onChange) {
    var row = el('div', 'cw-srow');
    var tx = el('div', 'cw-srow-text');
    tx.appendChild(el('b', null, title));
    if (desc) tx.appendChild(el('small', null, desc));
    row.appendChild(tx);
    var wrap = el('label', 'cw-select');
    var sel = el('select');
    sel.setAttribute('aria-label', title);
    options.forEach(function (o) { var op = el('option', null, String(o)); op.value = String(o); if (String(o) === String(value)) op.selected = true; sel.appendChild(op); });
    sel.addEventListener('change', function () { onChange(sel.value); });
    wrap.appendChild(sel);
    row.appendChild(wrap);
    return row;
  }
  function switchRow(title, desc, on, onChange) {
    var row = el('div', 'cw-srow');
    var tx = el('div', 'cw-srow-text');
    tx.appendChild(el('b', null, title));
    if (desc) tx.appendChild(el('small', null, desc));
    row.appendChild(tx);
    var sw = btn('cw-switch');
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(on));
    sw.setAttribute('aria-label', title);
    sw.addEventListener('click', function () {
      var v = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(v));
      onChange(v);
    });
    row.appendChild(sw);
    return row;
  }
  function pageHead(iconNode, title, sub) {
    var h = el('div', 'cw-spage-head');
    h.appendChild(iconNode);
    var t = el('div'); t.appendChild(el('h3', null, title)); t.appendChild(el('p', null, sub));
    h.appendChild(t);
    return h;
  }
  function renderSettingsPage() {
    var pg = $('cw-spage');
    pg.textContent = '';
    var s = state.settings;
    var hint = el('p', 'cw-hint');
    hint.setAttribute('role', 'status');
    if (state.spage === 'general') {
      var logo = el('img'); logo.src = 'icons/cliworker-now-logo.png'; logo.alt = '';
      pg.appendChild(pageHead(logo, 'CLI Worker 设置', '适用于所有 CLI 与对话'));
      pg.appendChild(el('p', 'cw-sgroup', '语言'));
      pg.appendChild(selectRow('界面语言', '跟随 DSH 时与 DeepSeek Harness 当前语言一致；只影响 CLI Worker 界面。', ['跟随 DSH', '中文', 'English'], s.lang, function (v) {
        s.lang = v; hint.textContent = v === 'English' ? '示意：真实产品保存后，所有已打开的 CLI Worker 面板会立即切换语言。' : '';
      }));
      pg.appendChild(el('p', 'cw-sgroup', '任务调度'));
      pg.appendChild(selectRow('最高同时对话数', '所有 CLI 共用；超出后新任务排队。调低不会中断进行中的任务。', [1, 2, 3, 4, 5, 6, 7, 8], s.maxConc, function (v) {
        s.maxConc = Number(v); schedule();
      }));
      pg.appendChild(switchRow('同目录写任务并行', '在项目副本中同时运行，完成后由主 Agent 合并回项目', s.parallel, function (v) { s.parallel = v; }));
      pg.appendChild(switchRow('调用前询问模型', '关闭后新对话直接使用项目的默认模型、强度与上次确认的角色；无有效设定时仍会询问', s.askModel, function (v) { s.askModel = v; }));
      pg.appendChild(el('p', 'cw-sgroup', '任务时限'));
      pg.appendChild(selectRow('总时限', '从任务开始计时，到时停止任务；修改只影响之后开始的任务', ['30 分钟（默认）', '1 小时', '2 小时', '4 小时', '8 小时', '不限制（最长 24 小时）'], s.total, function (v) { s.total = v; }));
      pg.appendChild(selectRow('空闲时限', 'CLI 连续这段时间没有任何事件（回复、工具、思考）时停止任务', ['不启用（默认）', '5 分钟', '10 分钟', '30 分钟'], s.idle, function (v) { s.idle = v; }));
      pg.appendChild(hint);
      return;
    }
    if (state.spage === 'agents') {
      var ic = el('span', 'cw-cli-ico'); ic.appendChild(svg('user', null, '0 0 20 20'));
      pg.appendChild(pageHead(ic, '智能体设置', '智能体预设管理：名称 / 概述 / 角色提示词'));
      var list = el('div', 'cw-presets');
      ROLES.forEach(function (r) {
        var c = el('div', 'cw-preset'); c.appendChild(el('b', null, r[0])); c.appendChild(el('p', null, r[1])); list.appendChild(c);
      });
      pg.appendChild(list);
      pg.appendChild(el('p', 'cw-hint', '内置七种小说创作角色；派遣时在“智能体预设”问题中选择。'));
      return;
    }
    var id = state.spage.slice(4), c = CLI[id];
    pg.appendChild(pageHead(cliIcon(id), c.label, '管理账号与模型偏好'));
    pg.appendChild(switchRow('启用 ' + c.label, null, state.enabled[id], function (v) {
      state.enabled[id] = v;
      var dot = $('cw-snav').querySelector('.cw-snav-item[aria-current="true"] .cw-dot');
      if (dot) { dot.classList.toggle('is-off', !v); dot.setAttribute('aria-label', v ? '已连接' : '已关闭'); }
    }));
    var acc = el('div', 'cw-srow');
    var tx = el('div', 'cw-srow-text');
    tx.appendChild(el('b', null, '账号与登录'));
    var st = el('small', 'cw-ok-text', '已登录');
    tx.appendChild(st);
    acc.appendChild(tx);
    var row = el('div', 'cw-btn-row');
    var accBtn = btn('cw-btn', id === 'pi' ? '账号' : '登录 / 切换账号');
    accBtn.addEventListener('click', function () {
      if (id === 'pi') openAccount(accBtn);
      else hint.textContent = '示意：真实产品会打开 ' + c.label + ' 的分步登录窗口。';
    });
    var termBtn = btn('cw-btn');
    termBtn.appendChild(svg('term'));
    termBtn.appendChild(document.createTextNode('账号终端'));
    termBtn.addEventListener('click', function () { hint.textContent = '示意：真实产品会打开 ' + c.label + ' 原生账号终端。'; });
    row.appendChild(accBtn); row.appendChild(termBtn);
    acc.appendChild(row);
    pg.appendChild(acc);
    pg.appendChild(el('p', 'cw-sgroup', '项目默认设置'));
    pg.appendChild(selectRow('新对话沿用的默认模型', '仅提供当前模型支持的选项', [c.model], c.model, function () {}));
    pg.appendChild(hint);
  }

  // Pi · 账号
  function openAccount(opener) {
    var box = $('cw-providers');
    box.textContent = '';
    $('cw-acc-note').textContent = '';
    PROVIDERS.forEach(function (p, i) {
      var b = btn('cw-prov');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i === state.provider));
      var m = el('span', 'cw-prov-mark', p[0]); m.setAttribute('aria-hidden', 'true');
      b.appendChild(m);
      b.appendChild(el('span', null, p[1]));
      b.addEventListener('click', function () {
        state.provider = i;
        Array.prototype.forEach.call(box.children, function (x, k) { x.setAttribute('aria-checked', String(k === i)); });
        $('cw-acc-note').textContent = '';
      });
      box.appendChild(b);
    });
    openModal('cw-account', opener);
  }
  $('cw-acc-go').addEventListener('click', function () {
    $('cw-acc-note').textContent = '示意：真实产品会在本窗口中继续 ' + PROVIDERS[state.provider][1] + ' 的授权或 API Key 填写；原型不连接任何账号。';
  });

  // ---------- 初始数据：与截图同类的测试任务 ----------
  function seed(cliId, title, model, elapsed, tok, mins) {
    var c = CLI[cliId];
    var w = createWorker({ cli: cliId, name: c.short + '-demo', title: title, role: NO_ROLE, model: model, effort: 'Low' });
    var t = newTurn(title);
    t.time = minutesAgo(mins);
    t.status = 'completed'; t.elapsed = elapsed; t.tok = tok;
    t.steps = stepsFor(w, title);
    t.reply = replyFor(w, title);
    w.turns.push(t);
    w.status = 'completed';
    seen['g-' + cliId] = true; seen['c-' + w.id] = true;
    return w;
  }
  var s1 = seed('antigravity', '创建并读取 demo-agy.txt', 'gemini-3.8-flash', 13, 21.9, 9);
  seed('mimo', '创建并读取 demo-mimo.txt', 'mimo-v2.6-flash', 16, 18.4, 7);
  seed('zcode', '创建并读取 demo-zcode.txt', 'GLM-5.3-Flash', 11, 15.2, 6);

  userMsg('用 Antigravity、MiMo 和 ZCode 各创建并读取一个 demo 文件，内容写各自的 CLI 名加 -OK。', minutesAgo(10));
  doneLine('已完成，用时 2 分 6 秒');
  botMsg([bold('三个子智能体都已完成。'), '每个 Worker 都在右侧 CLI Worker 面板中，点开卡片可以查看它的原生对话；也可以在这里按名字续聊，例如“让 ', code(s1.name), ' 再读取一次 demo-agy.txt”。']);
  push(actsRow(36.1, minutesAgo(5)));

  renderTry();
  renderUsage();
  renderList();
  updateCounts();
  $('cw-worker-perm-label').textContent = '';
})();
