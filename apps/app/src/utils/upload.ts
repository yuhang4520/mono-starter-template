import { getAccessToken } from './auth'

/**
 * 上传文件到服务器
 * @param filePath 本地文件路径
 * @param route 上传路由
 * @returns Promise<string> 返回服务器存储的 object key
 */
export async function uploadFile(filePath: string, route: string = 'recording'): Promise<string> {
  const token = getAccessToken()
  const serverUrl = import.meta.env.VITE_SERVER_URL || ''

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${serverUrl}/api/upload?route=${route}`,
      filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
      },
      success: (res) => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const data = JSON.parse(res.data)
            if (data.key) {
              resolve(data.key)
            }
            else {
              reject(new Error('上传成功但未返回文件 key'))
            }
          }
          catch (e) {
            reject(new Error('解析上传响应失败'))
          }
        }
        else {
          reject(new Error(`上传失败，状态码: ${res.statusCode}`))
        }
      },
      fail: (err) => {
        console.error('uni.uploadFile failed:', err)
        reject(err)
      },
    })
  })
}
