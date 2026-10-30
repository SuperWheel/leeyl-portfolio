// CLI Worker Now 示意原型：只模拟界面与交互，不连接任何真实 CLI。
// 界面文案、CLI 名称、状态名与权限档位取自 dsh-cliworker-now 源码（i18n 与 CLI_LABELS）。
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  if (!$('cw-main-form')) return;

  // ---------- 源码中的标签 ----------
  // 13 种 CLI（src/shared/types.ts 中的 CLI_LABELS，去掉已移除的 Harness 入口）
  var CLIS = [
    { id: 'codex', label: 'Codex', mark: 'Cx' },
    { id: 'claude', label: 'Claude Code', mark: 'CC' },
    { id: 'kimi', label: 'Kimi', mark: 'K' },
    { id: 'zcode', label: 'ZCode', mark: 'Z' },
    { id: 'qoder', label: 'Qoder CLI', mark: 'Q' },
    { id: 'qodercn', label: 'Qoder CN CLI', mark: 'Qc' },
    { id: 'antigravity', label: 'Antigravity', mark: 'A' },
    { id: 'mimo', label: 'MiMo', mark: 'Mi' },
    { id: 'grok', label: 'Grok Build', mark: 'G' },
    { id: 'omp', label: 'OMP', mark: 'O' },
    { id: 'pi', label: 'Pi', mark: 'Pi' },
    { id: 'hermes', label: 'Hermes Agent', mark: 'H' },
    { id: 'opencode', label: 'OpenCode', mark: 'Oc' }
  ];
  var CLI_BY_ID = {};
  CLIS.forEach(function (c) { CLI_BY_ID[c.id] = c; });

  // 角色预设：“不使用角色预设”与七个内置小说角色（doc/role-presets.md）
  var NO_ROLE = '不使用角色预设';
  var ROLES = [NO_ROLE, '商业审稿人', '逻辑审校员', '文风审校员', '正文修订师', '剧情节点设计师', '剧情结构规划师', '小说主笔'];
  var ROLE_TASK = {
    '商业审稿人': '审阅第 3 章的商业节奏',
    '逻辑审校员': '检查第 3 章的前后矛盾',
    '文风审校员': '审校第 3 章的文风',
    '正文修订师': '按已授权问题修订第 3 章',
    '剧情节点设计师': '设计下一个剧情节点',
    '剧情结构规划师': '拆分第二卷的剧情结构',
    '小说主笔': '按已确认设计写第 4 章草稿'
  };
  var DEV_TASKS = [
    ['代码审查员', '检查登录错误处理'],
    ['测试补全员', '补全登录模块的单元测试'],
    ['文档整理员', '整理 README 安装说明'],
    ['方案调研员', '调研分页加载的实现方式']
  ];

  // 状态（panel 区 i18n）
  var STATUS = { queued: '排队中', running: '运行中', completed: '已完成', stopped: '已停止' };

  // 主对话权限预设与 Worker 三档（README「Worker 权限三档」+ i18n 档位名）
  var MAIN_PERMS = [
    { id: 'view', label: '仅可查看' },
    { id: 'workspace', label: '工作区内修改' },
    { id: 'full', label: '完全权限' }
  ];
  var LEVEL_DESC = {
    '询问': '读取和只读命令直接执行；改文件和有副作用的命令先问你，拒绝就不改。',
    '自动审批': '使用此 CLI 原生的自动审批，由 CLI 自行判断放行；它仍要确认的请求会问你。',
    '完全权限': '使用此 CLI 原生的完全权限，不再询问。',
    '仅工作区编辑': '工作区内的文件编辑自动批准；命令和工作区外的操作先问你。',
    '仅规划': '以原生规划模式运行，只出方案、不改文件。',
    '自动批准编辑': '文件编辑自动批准；命令先问你。'
  };
  function levelsFor(cli) {
    // 按 CLI 实际能力命名；null 表示该 CLI 没有这一档
    switch (cli) {
      case 'kimi': return ['仅工作区编辑', '自动审批', '完全权限'];
      case 'antigravity': return ['仅规划', '自动审批', '完全权限'];
      case 'hermes': return [null, '自动审批', '完全权限'];
      case 'zcode': case 'opencode': return ['询问', '仅工作区编辑', '完全权限'];
      case 'omp': case 'pi': return ['询问', '自动批准编辑', '完全权限'];
      default: return ['询问', '自动审批', '完全权限'];
    }
  }
  var MAIN_TO_LEVEL = { view: 0, workspace: 1, full: 2 };

  // ---------- 状态 ----------
  var MAX_RUNNING = 2; // 默认两个并发
  var state = {
    mainPerm: 'workspace',
    workers: [],
    filter: 'all',
    query: '',
    collapsed: {},
    openId: null,
    pick: { cli: 'codex', role: NO_ROLE, nameTouched: false, taskTouched: false }
  };
  var seq = 0;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 工具函数 ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function badge(cliId) {
    var c = CLI_BY_ID[cliId];
    var b = el('span', 'cw-badge', c.mark);
    b.setAttribute('aria-hidden', 'true');
    return b;
  }
  function svgCaret() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('class', 'cw-caret');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
    return s;
  }
  function svgChevron() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
    return s;
  }
  function statusEl(s) {
    var n = el('span', 'cw-status', STATUS[s]);
    n.setAttribute('data-s', s);
    return n;
  }
  function findWorker(id) {
    for (var i = 0; i < state.workers.length; i++) if (state.workers[i].id === id) return state.workers[i];
    return null;
  }
  // 只给新出现的节点加入场动画，重绘时不重复闪烁
  var seen = {};
  function mark(node, key) {
    if (!seen[key]) { seen[key] = true; node.classList.add('is-new'); }
    return node;
  }
  function scrollDown(box) { box.scrollTop = box.scrollHeight; }
  function delay(ms) { return reduceMotion ? Math.min(ms, 400) : ms; }

  // ---------- 主对话消息 ----------
  var mainBox = $('cw-main-messages');
  function mainMsg(kind, parts, extra) {
    var empty = mainBox.querySelector('.cw-empty-main');
    if (empty) empty.remove();
    var m = el('div', 'cw-msg ' + (kind === 'user' ? 'cw-msg-user' : 'cw-msg-bot'));
    parts.forEach(function (p) {
      if (typeof p === 'string') m.appendChild(document.createTextNode(p));
      else m.appendChild(el('b', null, p.b));
    });
    if (extra) m.appendChild(extra);
    mainBox.appendChild(m);
    scrollDown(mainBox);
    return m;
  }

  // ---------- Worker 生命周期 ----------
  function stepsFor(w, prompt) {
    var novel = w.role !== NO_ROLE;
    if (novel) {
      return [
        ['读取', '项目中指定的章节与设定'],
        ['按角色', '「' + w.role + '」的规则逐项检查'],
        ['整理', '问题清单与证据位置']
      ];
    }
    if (/测试/.test(prompt)) return [['搜索', 'tests/ 下的现有用例'], ['读取', 'src/auth/login.ts'], ['运行', 'npm test -- login']];
    if (/README|文档/.test(prompt)) return [['读取', 'README.md'], ['对照', '安装脚本与实际命令'], ['整理', '需要改写的段落']];
    if (/调研/.test(prompt)) return [['阅读', '项目现有列表组件'], ['比较', '两种分页做法'], ['整理', '推荐方案与取舍']];
    return [['搜索', 'src/ 中的登录相关文件'], ['读取', 'src/auth/login.ts'], ['检查', '错误分支与提示文案']];
  }

  function dispatch(opts) {
    seq += 1;
    var w = {
      id: 'w' + seq,
      cli: opts.cli,
      name: opts.name,
      role: opts.role,
      title: opts.task,
      level: null, // null = 跟随主对话
      status: 'new',
      turns: [],
      pending: []
    };
    state.workers.push(w);
    enqueueTurn(w, opts.task);
    renderList();
    return w;
  }

  function enqueueTurn(w, prompt) {
    var turn = { prompt: prompt, steps: [], reply: null, status: 'queued', started: 0, elapsed: 0, timers: [] };
    if (w.status === 'running' || w.status === 'queued') {
      w.pending.push(turn);
    } else {
      w.turns.push(turn);
      w.status = 'queued';
    }
    setTimeout(schedule, delay(700));
    refresh(w);
  }

  function runningCount() {
    return state.workers.filter(function (w) { return w.status === 'running'; }).length;
  }

  function schedule() {
    state.workers.forEach(function (w) {
      if (w.status === 'queued' && runningCount() < MAX_RUNNING) startTurn(w);
    });
    updateBgCount();
  }

  function startTurn(w) {
    var turn = w.turns[w.turns.length - 1];
    w.status = 'running';
    turn.status = 'running';
    turn.started = Date.now();
    var steps = stepsFor(w, turn.prompt);
    var gap = delay(1200);
    steps.forEach(function (s, i) {
      turn.timers.push(setTimeout(function () {
        turn.steps.push(s);
        refresh(w);
      }, gap * (i + 1)));
    });
    turn.timers.push(setTimeout(function () { finishTurn(w, turn); }, gap * (steps.length + 1)));
    refresh(w);
  }

  function finishTurn(w, turn) {
    turn.status = 'completed';
    turn.elapsed = Math.max(1, Math.round((Date.now() - turn.started) / 1000));
    turn.reply = w.role !== NO_ROLE
      ? '已按「' + w.role + '」完成：' + turn.prompt + '。（示意回复：这里显示 ' + CLI_BY_ID[w.cli].label + ' 的原生输出。）'
      : '已完成：' + turn.prompt + '。（示意回复：这里显示 ' + CLI_BY_ID[w.cli].label + ' 的原生输出。）';
    w.status = 'completed';
    var suggest = el('button', 'cw-suggest', '让' + w.name + '继续…');
    suggest.type = 'button';
    suggest.addEventListener('click', function () {
      var input = $('cw-main-input');
      input.value = '让' + w.name + '继续检查测试覆盖';
      input.focus();
    });
    var wrap = el('div');
    wrap.appendChild(suggest);
    mainMsg('bot', [{ b: w.name }, '（' + CLI_BY_ID[w.cli].label + '）已完成「' + turn.prompt + '」，结果回到主对话。'], wrap);
    if (w.pending.length) {
      w.turns.push(w.pending.shift());
      w.status = 'queued';
    }
    refresh(w);
    setTimeout(schedule, delay(400));
  }

  function stopWorker(w) {
    if (w.status !== 'running' && w.status !== 'queued') return;
    var turn = w.turns[w.turns.length - 1];
    turn.timers.forEach(clearTimeout);
    turn.status = 'stopped';
    turn.elapsed = turn.started ? Math.max(1, Math.round((Date.now() - turn.started) / 1000)) : 0;
    w.pending = [];
    w.status = 'stopped';
    refresh(w);
    setTimeout(schedule, delay(300));
  }

  function refresh(w) {
    renderList();
    updateBgCount();
    if (state.openId === w.id) renderDetail();
  }

  function updateBgCount() {
    var n = state.workers.filter(function (w) { return w.status === 'running' || w.status === 'queued'; }).length;
    $('cw-bg-count').textContent = n + ' 个后台任务';
  }

  // ---------- 侧栏列表 ----------
  function matchFilter(w) {
    var q = state.query.trim().toLowerCase();
    var hay = (CLI_BY_ID[w.cli].label + ' ' + w.name + ' ' + w.title + ' ' + w.role).toLowerCase();
    if (q && hay.indexOf(q) === -1) return false;
    if (state.filter === 'active') return w.status === 'running' || w.status === 'queued';
    if (state.filter === 'completed') return w.status === 'completed';
    if (state.filter === 'attention') return false; // 示意中没有失败、待核实或异常中断的任务；用户主动停止不计入异常
    return true;
  }

  function renderList() {
    var box = $('cw-groups');
    box.textContent = '';
    if (!state.workers.length) {
      var e = el('div', 'cw-side-empty');
      e.appendChild(el('p', null, '把想做的事，交给合适的伙伴。'));
      e.appendChild(el('p', null, '在主对话中发起任务，协作会在这里展开。'));
      box.appendChild(e);
      return;
    }
    var visible = state.workers.filter(matchFilter);
    if (!visible.length) {
      var none = el('div', 'cw-side-empty');
      none.appendChild(el('p', null, '没有符合条件的子 Agent。'));
      box.appendChild(none);
      return;
    }
    CLIS.forEach(function (c) {
      var list = visible.filter(function (w) { return w.cli === c.id; });
      if (!list.length) return;
      var g = mark(el('div', 'cw-group'), 'g-' + c.id);
      var head = el('button', 'cw-group-head');
      head.type = 'button';
      var open = !state.collapsed[c.id];
      head.setAttribute('aria-expanded', String(open));
      head.appendChild(badge(c.id));
      head.appendChild(el('span', null, c.label));
      head.appendChild(el('span', 'cw-group-count', list.length + ' 个 Agent'));
      head.appendChild(svgCaret());
      head.addEventListener('click', function () {
        state.collapsed[c.id] = open;
        renderList();
      });
      g.appendChild(head);
      if (open) {
        list.forEach(function (w) {
          var card = mark(el('button', 'cw-card'), 'c-' + w.id);
          card.type = 'button';
          card.setAttribute('data-id', w.id);
          card.setAttribute('aria-label', '打开 ' + w.name + '：' + w.title + '，' + STATUS[w.status]);
          var body = el('span', 'cw-card-body');
          var t = el('span', 'cw-card-title');
          t.appendChild(el('span', null, w.title));
          t.appendChild(statusEl(w.status));
          body.appendChild(t);
          body.appendChild(el('span', 'cw-card-meta', w.name + ' ｜ ' + (w.role === NO_ROLE ? '未使用角色预设' : '角色：' + w.role)));
          card.appendChild(body);
          card.appendChild(svgChevron());
          card.addEventListener('click', function () { openDetail(w.id); });
          g.appendChild(card);
        });
      }
      box.appendChild(g);
    });
  }

  // ---------- 侧栏详情 ----------
  function effectiveLevel(w) {
    var levels = levelsFor(w.cli);
    var idx = w.level != null ? w.level : MAIN_TO_LEVEL[state.mainPerm];
    if (!levels[idx]) idx = 1; // 没有这一档时就近取中档
    return { idx: idx, label: levels[idx] };
  }

  function openDetail(id) {
    state.openId = id;
    $('cw-list-view').hidden = true;
    $('cw-detail-view').hidden = false;
    renderDetail();
    $('cw-back').focus();
  }
  function closeDetail() {
    var id = state.openId;
    state.openId = null;
    closeAllMenus();
    $('cw-detail-view').hidden = true;
    $('cw-list-view').hidden = false;
    renderList();
    var card = $('cw-groups').querySelector('[data-id="' + id + '"]');
    if (card) card.focus();
  }

  function renderDetail() {
    var w = findWorker(state.openId);
    if (!w) return;
    $('cw-detail-title').textContent = w.name + ' ｜ ' + w.title;
    var box = $('cw-detail-messages');
    box.textContent = '';
    var all = w.turns.concat(w.pending);
    all.forEach(function (turn, ti) {
      var k = w.id + '-' + ti;
      box.appendChild(mark(el('div', 'cw-msg cw-msg-user', turn.prompt), k + 'u'));
      if (turn.status === 'queued') {
        box.appendChild(el('div', 'cw-turn-head', w.pending.indexOf(turn) > -1 ? '本轮结束后发送' : '排队中，等待空闲并发位…'));
        return;
      }
      var head = el('div', 'cw-turn-head');
      if (turn.status === 'running') {
        head.appendChild(document.createTextNode('运行中'));
        var dots = el('span', 'cw-typing');
        dots.setAttribute('aria-hidden', 'true');
        dots.appendChild(el('i')); dots.appendChild(el('i')); dots.appendChild(el('i'));
        head.appendChild(dots);
      } else if (turn.status === 'stopped') {
        head.textContent = '已停止';
      } else {
        head.textContent = '已完成，用时 ' + turn.elapsed + ' 秒';
      }
      box.appendChild(head);
      if (turn.steps.length) {
        var ul = el('ul', 'cw-steps');
        turn.steps.forEach(function (s, si) {
          var li = mark(el('li'), k + 's' + si);
          li.appendChild(document.createTextNode(s[0] + ' '));
          li.appendChild(el('code', null, s[1]));
          ul.appendChild(li);
        });
        box.appendChild(ul);
      }
      if (turn.reply) box.appendChild(mark(el('div', 'cw-msg cw-msg-bot', turn.reply), k + 'r'));
    });
    scrollDown(box);

    var lv = effectiveLevel(w);
    $('cw-worker-perm-label').textContent = lv.label + (w.level == null ? '（跟随主对话）' : '');
    $('cw-stop').hidden = !(w.status === 'running' || w.status === 'queued');
    var bar = $('cw-detail-status');
    bar.textContent = '';
    bar.appendChild(statusEl(w.status));
    bar.appendChild(el('span', null, CLI_BY_ID[w.cli].label + (w.role === NO_ROLE ? '' : ' · ' + w.role)));
  }

  // ---------- 菜单：通用开关、Esc、点外部关闭 ----------
  var openMenu = null; // { btn, panel }
  function closeAllMenus(returnFocus) {
    if (!openMenu) return;
    var m = openMenu;
    m.panel.hidden = true;
    m.btn.setAttribute('aria-expanded', 'false');
    openMenu = null;
    if (returnFocus) m.btn.focus();
  }
  function toggleMenu(btn, panel, build) {
    if (openMenu && openMenu.panel === panel) { closeAllMenus(true); return; }
    closeAllMenus();
    if (build) build();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    openMenu = { btn: btn, panel: panel };
    var first = panel.querySelector('[aria-checked="true"]') || panel.querySelector('button, input');
    if (first) first.focus();
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openMenu) { e.preventDefault(); closeAllMenus(true); }
  });
  document.addEventListener('pointerdown', function (e) {
    if (!openMenu) return;
    if (openMenu.panel.contains(e.target) || openMenu.btn.contains(e.target)) return;
    closeAllMenus();
  });
  function menuArrowKeys(panel) {
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var items = Array.prototype.slice.call(panel.querySelectorAll('.cw-menu-item'));
      var i = items.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      var next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
      next.focus();
    });
  }
  function menuNote(text) {
    var n = el('p', 'cw-menu-title', text);
    n.setAttribute('role', 'presentation');
    return n;
  }
  function menuItem(label, desc, checked, onPick, disabled) {
    var b = el('button', 'cw-menu-item');
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.setAttribute('aria-checked', String(!!checked));
    if (disabled) b.disabled = true;
    var mark = el('span', 'cw-menu-check', checked ? '✓' : '');
    mark.setAttribute('aria-hidden', 'true');
    b.appendChild(mark);
    var txt = el('span');
    txt.appendChild(document.createTextNode(label));
    if (desc) txt.appendChild(el('small', null, desc));
    b.appendChild(txt);
    b.addEventListener('click', function () { onPick(); closeAllMenus(true); });
    return b;
  }

  // 主对话权限
  var mainPermBtn = $('cw-main-perm-btn');
  var mainPermMenu = $('cw-main-perm-menu');
  menuArrowKeys(mainPermMenu);
  mainPermBtn.addEventListener('click', function () {
    toggleMenu(mainPermBtn, mainPermMenu, function () {
      mainPermMenu.textContent = '';
      MAIN_PERMS.forEach(function (p) {
        mainPermMenu.appendChild(menuItem(p.label, null, p.id === state.mainPerm, function () {
          state.mainPerm = p.id;
          $('cw-main-perm-label').textContent = p.label;
          if (state.openId) renderDetail();
        }));
      });
      mainPermMenu.appendChild(el('div', 'cw-menu-sep'));
      mainPermMenu.appendChild(menuNote('没选过档位的 Worker 跟随这里'));
    });
  });

  // Worker 权限
  var wPermBtn = $('cw-worker-perm-btn');
  var wPermMenu = $('cw-worker-perm-menu');
  menuArrowKeys(wPermMenu);
  wPermBtn.addEventListener('click', function () {
    var w = findWorker(state.openId);
    if (!w) return;
    toggleMenu(wPermBtn, wPermMenu, function () {
      wPermMenu.textContent = '';
      wPermMenu.appendChild(menuNote(CLI_BY_ID[w.cli].label + ' 的权限档位'));
      var cur = effectiveLevel(w).idx;
      levelsFor(w.cli).forEach(function (label, idx) {
        if (!label) return;
        wPermMenu.appendChild(menuItem(label, LEVEL_DESC[label], idx === cur, function () {
          w.level = idx;
          renderDetail();
        }));
      });
      if (w.level != null) {
        wPermMenu.appendChild(el('div', 'cw-menu-sep'));
        wPermMenu.appendChild(menuItem('恢复跟随主对话', null, false, function () {
          w.level = null;
          renderDetail();
        }));
      }
    });
  });

  // ---------- 派遣面板 ----------
  var dispatchBtn = $('cw-dispatch-btn');
  var dispatchPanel = $('cw-dispatch');
  var nameInput = $('cw-name-input');
  var taskInput = $('cw-task-input');
  var errBox = $('cw-dispatch-error');

  function nameTaken(name) {
    return state.workers.some(function (w) { return w.name === name; });
  }
  function suggestDefaults() {
    var p = state.pick;
    var name, task;
    if (p.role !== NO_ROLE) {
      name = p.role;
      task = ROLE_TASK[p.role];
    } else {
      var pair = DEV_TASKS.filter(function (d) { return !nameTaken(d[0]); })[0] || ['演示助手', '欢迎使用 CLI Worker'];
      name = pair[0];
      task = pair[1];
    }
    var base = name, n = 2;
    while (nameTaken(name)) { name = base + n; n += 1; }
    if (!p.nameTouched) nameInput.value = name;
    if (!p.taskTouched) taskInput.value = task;
  }
  function optButton(label, checked, onPick, prefix) {
    var b = el('button', 'cw-opt');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(checked));
    if (prefix) b.appendChild(prefix);
    b.appendChild(document.createTextNode(label));
    b.addEventListener('click', onPick);
    return b;
  }
  function buildDispatch() {
    var cliBox = $('cw-cli-options');
    cliBox.textContent = '';
    cliBox.setAttribute('role', 'radiogroup');
    cliBox.setAttribute('aria-label', 'CLI');
    CLIS.forEach(function (c) {
      cliBox.appendChild(optButton(c.label, c.id === state.pick.cli, function () {
        state.pick.cli = c.id;
        buildDispatch();
        cliBox.querySelector('[aria-checked="true"]').focus();
      }, badge(c.id)));
    });
    var roleBox = $('cw-role-options');
    roleBox.textContent = '';
    roleBox.setAttribute('role', 'radiogroup');
    roleBox.setAttribute('aria-label', '智能体预设');
    ROLES.forEach(function (r) {
      roleBox.appendChild(optButton(r, r === state.pick.role, function () {
        state.pick.role = r;
        buildDispatch();
        roleBox.querySelector('[aria-checked="true"]').focus();
      }));
    });
    suggestDefaults();
  }
  function openDispatch(cliId) {
    state.pick.nameTouched = false;
    state.pick.taskTouched = false;
    if (cliId) state.pick.cli = cliId;
    errBox.textContent = '';
    toggleMenu(dispatchBtn, dispatchPanel, buildDispatch);
  }
  dispatchBtn.addEventListener('click', function () { openDispatch(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-close-dispatch]'), function (b) {
    b.addEventListener('click', function () { closeAllMenus(true); });
  });
  nameInput.addEventListener('input', function () { state.pick.nameTouched = true; errBox.textContent = ''; });
  taskInput.addEventListener('input', function () { state.pick.taskTouched = true; });
  [nameInput, taskInput].forEach(function (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); doDispatch(); }
    });
  });
  $('cw-dispatch-go').addEventListener('click', doDispatch);

  function doDispatch() {
    var cli = CLI_BY_ID[state.pick.cli];
    var name = nameInput.value.trim();
    var task = taskInput.value.trim() || '处理一个示意任务';
    if (!name) { errBox.textContent = '请给智能体起一个名字。'; nameInput.focus(); return; }
    if (nameTaken(name)) { errBox.textContent = '「' + name + '」已被使用，名称需要唯一。'; nameInput.focus(); return; }
    var role = state.pick.role;
    closeAllMenus(true);
    var say = '用 ' + cli.label + ' ' + task + '，把这个智能体命名为“' + name + '”' + (role === NO_ROLE ? '。' : '，角色用「' + role + '」。');
    mainMsg('user', [say]);
    // README：主对话为「仅可查看」时，没选过档位的 Antigravity、Hermes 和 Kimi 拒绝派遣
    if (state.mainPerm === 'view' && (cli.id === 'antigravity' || cli.id === 'hermes' || cli.id === 'kimi')) {
      setTimeout(function () {
        mainMsg('bot', ['主对话当前为「仅可查看」，' + cli.label + ' 没有对应的只读档位，未派遣。可先把主对话权限调到「工作区内修改」。']);
      }, delay(500));
      return;
    }
    setTimeout(function () {
      var w = dispatch({ cli: cli.id, name: name, role: role, task: task });
      var busy = runningCount() >= MAX_RUNNING;
      mainMsg('bot', ['已派遣 ', { b: name }, '（' + cli.label + '）' + (busy ? '，当前已有 2 个任务在运行，先进入排队。' : '，可在右侧 CLI Worker 侧栏查看过程。')]);
      void w;
    }, delay(500));
  }

  // ---------- 主对话输入：按名称续聊 ----------
  $('cw-main-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('cw-main-input');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    mainMsg('user', [text]);
    // 名字越长越优先匹配，避免“代码审查员”与“代码审查员2”混淆
    var byName = state.workers.slice().sort(function (a, b) { return b.name.length - a.name.length; })
      .filter(function (w) { return text.indexOf(w.name) > -1; })[0];
    setTimeout(function () {
      if (byName) {
        var rest = text.replace(/^让/, '').replace(byName.name, '').replace(/^[，,\s]+/, '') || '继续';
        enqueueTurn(byName, rest);
        mainMsg('bot', ['已交给 ', { b: byName.name }, '（' + CLI_BY_ID[byName.cli].label + '）继续，沿用同一个会话。']);
        return;
      }
      var hitCli = CLIS.filter(function (c) { return text.toLowerCase().indexOf(c.label.toLowerCase()) > -1; })[0];
      if (hitCli) {
        mainMsg('bot', ['真实产品会在这里用问题卡片确认 ' + hitCli.label + ' 的模型、思考强度和角色；示意中请在面板里选择。']);
        openDispatch(hitCli.id);
        return;
      }
      if (state.workers.length) {
        mainMsg('bot', ['没有找到这个名字的智能体。可以续聊的有：' + state.workers.map(function (w) { return w.name; }).join('、') + '。']);
      } else {
        mainMsg('bot', ['还没有派出智能体。点「派遣 Worker」选一个 CLI，派出后就能按名字续聊。']);
      }
    }, delay(450));
  });

  // ---------- 详情输入 ----------
  $('cw-detail-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var w = findWorker(state.openId);
    var input = $('cw-detail-input');
    var text = input.value.trim();
    if (!w || !text) return;
    input.value = '';
    enqueueTurn(w, text);
  });
  $('cw-stop').addEventListener('click', function () {
    var w = findWorker(state.openId);
    if (w) stopWorker(w);
  });
  $('cw-back').addEventListener('click', closeDetail);

  // ---------- 搜索与筛选 ----------
  $('cw-search').addEventListener('input', function (e) {
    state.query = e.target.value;
    renderList();
  });
  Array.prototype.forEach.call(document.querySelectorAll('.cw-filters button'), function (b) {
    b.addEventListener('click', function () {
      state.filter = b.getAttribute('data-filter');
      Array.prototype.forEach.call(document.querySelectorAll('.cw-filters button'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      renderList();
    });
  });

  renderList();
})();
