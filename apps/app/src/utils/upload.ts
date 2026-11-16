import { getClientHeaders } from '../lib/clientHeaders'
import { getAccessToken, getAuthSessionVersion, handleAuthFailure, performTokenRefresh } from './auth'
import { AuthExpiredError, SessionChangedError } from './auth-core'

interface Response<T> { statusCode: number, data: T }

async function authenticated<T>(send: (token: string) => Promise<Response<T>>): Promise<T> {
  const version = getAuthSessionVersion()
  const assertCurrent = () => {
    if (version !== getAuthSessionVersion())
      throw new SessionChangedError()
  }
  const run = async () => {
    assertCurrent()
    const response = await send(getAccessToken())
    assertCurrent()

    return response
  }
  let response = await run()
  if (response.statusCode === 401) {
    try {
      await performTokenRefresh()
      response = await run()
    }
    catch (error) {
      if (error instanceof AuthExpiredError && version === getAuthSessionVersion())
        handleAuthFailure()
      throw error
    }
  }
  if (response.statusCode === 401) {
    handleAuthFailure()
    throw new AuthExpiredError()
  }
  if (response.statusCode >= 400) {
    const body = response.data as { error?: { message?: string }, message?: string }
    throw new Error(body?.error?.message || body?.message || `请求失败 (${response.statusCode})`)
  }

  return response.data
}

export async function uploadFile(filePath: string): Promise<string> {
  const response = await authenticated<{ key?: string }>(token => new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${import.meta.env.VITE_SERVER_URL}/api/upload`,
      filePath,
      name: 'file',
      timeout: 30000,
      header: { ...getClientHeaders(), Authorization: `Bearer ${token}` },
      success(res) {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(res.data) })
        }
        catch {
          reject(new Error('上传响应格式错误'))
        }
      },
      fail: () => reject(new Error('上传失败，请检查网络后重试')),
    })
  }))
  if (!response.key)
    throw new Error('上传未返回文件信息')

  return response.key
}

export async function getFileUrl(key: string): Promise<string> {
  const response = await authenticated<{ url?: string }>(token => new Promise((resolve, reject) => {
    uni.request({
      url: `${import.meta.env.VITE_SERVER_URL}/api/files?key=${encodeURIComponent(key)}`,
      timeout: 15000,
      header: { ...getClientHeaders(), Authorization: `Bearer ${token}` },
      success: res => resolve({ statusCode: res.statusCode, data: res.data as { url?: string } }),
      fail: () => reject(new Error('读取附件失败，请检查网络后重试')),
    })
  }))
  if (!response.url || !/^https?:\/\//.test(response.url))
    throw new Error('文件地址无效')

  return response.url
}
