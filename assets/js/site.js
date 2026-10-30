// 共用脚本：主题切换、淡入动画、交互演示缩放。演示本身打包在各项目的 demo/ 目录。
(function () {
  const root = document.documentElement;
  const KEY = 'leeyl-theme';

  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch (e) { /* 隐私模式下无法读取，按系统主题显示 */ }

  function currentTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem(KEY, next); } catch (e) { /* 忽略 */ }
      });
    }

    // 演示按 1280×820 渲染，整体缩放到容器宽度，保持与桌面端一致的布局
    document.querySelectorAll('.demo-viewport').forEach(function (box) {
      const frame = box.querySelector('iframe');
      if (!frame) return;
      const fit = function () { frame.style.transform = 'scale(' + box.clientWidth / 1280 + ')'; };
      fit();
      if ('ResizeObserver' in window) new ResizeObserver(fit).observe(box);
      else window.addEventListener('resize', fit);
    });

    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  });
})();
