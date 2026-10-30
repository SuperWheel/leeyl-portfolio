// In-memory demo workspace. Tool nodes read and write here; nothing touches the
// visitor's disk or network.
export const WORKSPACE_ROOT = '/workspace'
const ORDERS = [
  { id: 'A-1001', status: 'paid', category: '图书', amountCents: 4590 },
  { id: 'A-1002', status: 'paid', category: '文具', amountCents: 1280 },
  { id: 'A-1003', status: 'refunded', category: '图书', amountCents: 3900 },
  { id: 'A-1004', status: 'paid', category: '数码配件', amountCents: 15900 },
  { id: 'A-1005', status: 'PAID', category: '文具', amountCents: 860 },
  { id: 'A-1006', status: 'paid', category: '图书', amountCents: 2650 },
  { id: 'A-1007', status: 'pending', category: '数码配件', amountCents: 9900 },
  { id: 'A-1008', status: 'paid', category: '文具', amountCents: 2400 },
]
const files = new Map<string, string>([
  ['data/orders.json', JSON.stringify(ORDERS, null, 2) + '\n'],
  ['data/README.md', '# 演示数据\n\norders.json 为虚构订单，仅用于浏览器内演示。\n'],
])
export function normalizePath(path: string): string {
  let value = String(path ?? '').trim().replace(/\\/g, '/')
  if (value.startsWith(WORKSPACE_ROOT + '/')) value = value.slice(WORKSPACE_ROOT.length + 1)
  value = value.replace(/^\.\//, '').replace(/\/+/g, '/').replace(/^\//, '')
  if (!value || value.split('/').includes('..')) throw new Error('请填写工作区内的相对文件路径，不接受上级目录')
  return value
}
export const vfs = {
  has: (path: string) => { try { return files.has(normalizePath(path)) } catch { return false } },
  read(path: string): string {
    const key = normalizePath(path)
    const text = files.get(key)
    if (text === undefined) throw new Error(`文件不存在：${key}`)
    return text
  },
  write(path: string, content: string): string { const key = normalizePath(path); files.set(key, content); return key },
  list(): string[] { return [...files.keys()].sort() },
  isDirectory(path: string): boolean { const key = normalizePath(path); return [...files.keys()].some(name => name.startsWith(key + '/')) },
}
