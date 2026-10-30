// The workflow UI never renders Markdown math; this keeps KaTeX (and its fonts)
// out of the static demo while the real primitives module still links.
const escape = (text: string) => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
export default { renderToString: (value: string) => `<code>${escape(value)}</code>` }
