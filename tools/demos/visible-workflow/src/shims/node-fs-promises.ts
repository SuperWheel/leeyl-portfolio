// Read-only view of the in-memory demo workspace for the host import checks.
import { vfs, WORKSPACE_ROOT } from '../vfs.ts'
const missing = (path: string) => Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' })
const inside = (path: string) => path === WORKSPACE_ROOT || path.startsWith(WORKSPACE_ROOT + '/')
function meta(path: string) {
  if (path === WORKSPACE_ROOT) return { isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false }
  if (!inside(path)) throw missing(path)
  if (vfs.has(path)) return { isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false }
  if (vfs.isDirectory(path)) return { isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false }
  throw missing(path)
}
export async function realpath(path: string) { meta(path); return path }
export async function lstat(path: string) { return meta(path) }
export async function stat(path: string) { return meta(path) }
export default { realpath, lstat, stat }
