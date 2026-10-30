// Minimal POSIX path functions for host helpers bundled into the browser demo.
const normalize = (path: string): string => {
  const absolute = path.startsWith('/'), out: string[] = []
  for (const part of path.split('/')) { if (!part || part === '.') continue; if (part === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else if (!absolute) out.push('..') } else out.push(part) }
  return (absolute ? '/' : '') + out.join('/') || (absolute ? '/' : '.')
}
export const sep = '/'
export const isAbsolute = (path: string) => path.startsWith('/')
export function resolve(...paths: string[]): string { let result = ''; for (const path of paths) { if (!path) continue; result = isAbsolute(path) ? path : result ? `${result}/${path}` : path } return normalize(isAbsolute(result) ? result : `/workspace/${result}`) }
export function join(...paths: string[]): string { return normalize(paths.filter(Boolean).join('/')) }
export function dirname(path: string): string { const value = normalize(path); const index = value.lastIndexOf('/'); return index <= 0 ? (isAbsolute(value) ? '/' : '.') : value.slice(0, index) }
export function basename(path: string): string { return normalize(path).split('/').pop() ?? '' }
export function relative(from: string, to: string): string {
  const a = resolve(from).split('/').filter(Boolean), b = resolve(to).split('/').filter(Boolean)
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/')
}
export default { sep, isAbsolute, resolve, join, dirname, basename, relative }
