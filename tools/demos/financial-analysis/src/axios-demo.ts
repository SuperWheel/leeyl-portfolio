/**
 * 只替换源码 api/http.ts 的 axios 导入：给默认配置挂上浏览器内 mock adapter。
 * http.ts 里的 axios.create / 错误拦截器保持原样运行。
 */
import axios from 'axios'
import { mockAdapter } from './mock/adapter'

axios.defaults.adapter = mockAdapter

export default axios
export * from 'axios'
