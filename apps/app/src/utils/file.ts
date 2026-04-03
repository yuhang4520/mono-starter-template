/**
 * 将本地文件读取为 ArrayBuffer (适配 Android, iOS, 微信小程序)
 * 参考了原生 Java IO 读取逻辑以提升 Android 端的稳定性
 */
export function readFileAsBuffer(filePath: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      reject(new Error('文件路径为空'))

      return
    }
    // 设置全局超时（5秒），防止任何环节静默挂起
    const timer = setTimeout(() => {
      reject(new Error('文件读取超时'))
    }, 5000)

    const clearAndReject = (err: any) => {
      clearTimeout(timer)
      reject(err)
    }

    const clearAndResolve = (buffer: ArrayBuffer) => {
      clearTimeout(timer)
      resolve(buffer)
    }

    // #ifdef MP-WEIXIN
    uni.getFileSystemManager().readFile({
      filePath,
      success: (res) => {
        clearAndResolve(res.data as ArrayBuffer)
      },
      fail: (err) => {
        clearAndReject(new Error(`小程序读取文件失败: ${err.errMsg}`))
      },
    })
    // #endif

    // Android/iOS
    // #ifdef APP-PLUS
    if (plus.os.name === 'Android') {
      if (filePath.startsWith('content://')) {
        clearAndReject(new Error('当前仅支持读取应用沙盒中的本地文件'))
      }
      else {
        plus.io.resolveLocalFileSystemURL(filePath, (entry: any) => {
          entry.file((file: any) => {
            if (!file.size || file.size <= 0) {
              return clearAndReject(new Error(`文件为空或无法读取: ${filePath}`))
            }

            const reader = new plus.io.FileReader()
            reader.onload = (e: any) => {
              const result = e?.target?.result
              if (typeof result !== 'string') {
                return clearAndReject(new Error('Android 文件读取失败: 返回结果为空'))
              }
              const base64 = result.includes(',') ? result.split(',')[1] : result
              if (!base64) {
                return clearAndReject(new Error('Android 文件读取失败: 无法解析 base64 数据'))
              }
              clearAndResolve(uni.base64ToArrayBuffer(base64))
            }
            reader.onerror = (err: any) => {
              clearAndReject(new Error(`Android 文件读取出错: ${err.message}`))
            }
              ; (reader as any).readAsDataURL(file)
          }, (err: any) => clearAndReject(new Error(`获取文件对象失败: ${err.message}`)))
        }, (err: any) => clearAndReject(new Error(`定位文件失败: ${err.message}`)))
      }
    }
    else {
      // iOS 端使用标准的 plus.io 读取，iOS 下 File 系统接口非常稳定
      plus.io.resolveLocalFileSystemURL(filePath, (entry: any) => {
        entry.file((file: any) => {
          const reader = new plus.io.FileReader()
          reader.onload = (e: any) => {
            clearAndResolve(e.target.result)
          }
          reader.onerror = (err: any) => {
            clearAndReject(new Error(`iOS 文件读取出错: ${err.message}`))
          }
            // 虽然之前有卡顿报告，但在 iOS 上 readAsArrayBuffer 是标准写法
            ; (reader as any).readAsArrayBuffer(file)
        }, (err: any) => clearAndReject(new Error(`获取文件对象失败: ${err.message}`)))
      }, (err: any) => clearAndReject(new Error(`定位文件失败: ${err.message}`)))
    }
    // #endif

    // 其他平台
    // #ifndef MP-WEIXIN || APP-PLUS
    clearAndReject(new Error('当前平台不支持该文件读取操作'))
    // #endif
  })
}
