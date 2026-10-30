/**
 * 演示外壳：右上角“演示模式 · 示例数据”标记；在上传区下方提供“使用示例文件”，
 * 把一个占位示例文件交给源码里的 el-upload，走真实的上传 → 识别 → 核对流程。
 */
const SAMPLE_FILES = {
  pdf: { name: '示例公司D_2025年年度报告（示例）.pdf', type: 'application/pdf', body: '%PDF-1.4\n% 演示占位文件：内容为空，识别结果来自示例数据\n' },
  xlsx: {
    name: '示例三表数据（示例）.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: 'PK 演示占位文件：内容为空，预览来自示例数据',
  },
} as const

export function mountDemoBadge() {
  const badge = document.createElement('div')
  badge.className = 'fa-demo-badge'
  badge.tabIndex = 0
  badge.setAttribute('role', 'note')
  badge.innerHTML =
    '<span class="fa-demo-badge__dot" aria-hidden="true"></span>' +
    '<span>演示模式<span class="fa-demo-badge__text-long"> · 示例数据</span></span>' +
    '<span class="fa-demo-badge__tip">真实前端界面 + 浏览器内示例数据。示例公司A–D 及全部金额、比率、映射统计均为虚构，非任何真实公司财报；不连接后端与巨潮，数据只存在本页内存，刷新即恢复。</span>'
  document.body.appendChild(badge)

  const decorate = () => {
    document.querySelectorAll<HTMLElement>('.el-upload.is-drag').forEach((upload) => {
      if (upload.dataset.faDemo) return
      const input = upload.querySelector<HTMLInputElement>('input[type=file]')
      if (!input) return
      upload.dataset.faDemo = '1'
      const kind = (input.accept || '').includes('pdf') ? 'pdf' : 'xlsx'
      const sample = SAMPLE_FILES[kind]
      const row = document.createElement('div')
      row.className = 'fa-demo-sample'
      row.innerHTML = `演示版：手边没有文件？<button type="button">使用示例 ${kind === 'pdf' ? 'PDF' : 'Excel'}</button>`
      row.querySelector('button')!.addEventListener('click', () => {
        const dt = new DataTransfer()
        dt.items.add(new File([sample.body], sample.name, { type: sample.type }))
        input.files = dt.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
      upload.insertAdjacentElement('afterend', row)
    })
  }
  new MutationObserver(decorate).observe(document.getElementById('app') || document.body, { childList: true, subtree: true })
  decorate()
}
