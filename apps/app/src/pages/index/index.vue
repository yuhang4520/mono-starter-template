<script setup lang="ts">
import { onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import LegalLinks from '@/components/LegalLinks.vue'
import { trpc } from '@/lib/trpc'
import { useUserStore } from '@/store'
import { getAuthSessionVersion } from '@/utils/auth'
import { requireLogin } from '@/utils/authInterceptor'
import { needsLaunchConsent } from '@/utils/legal'
import { handlePhotoSelectionFailure } from '@/utils/photoPermission'
import { getFileUrl, uploadFile } from '@/utils/upload'

const userStore = useUserStore()
const loading = ref(false)
const uploading = ref(false)
const loggingOut = ref(false)
const errorMessage = ref('')
const uploadedKey = ref('')
const uploadedImage = ref('')
let active = true
let pageSession = getAuthSessionVersion()
const isCurrent = (version: number) => active && version === getAuthSessionVersion() && !needsLaunchConsent()
onUnload(() => {
  active = false
})

async function loadUser() {
  if (!active || !requireLogin() || loading.value)
    return
  const version = getAuthSessionVersion()
  loading.value = true
  errorMessage.value = ''
  try {
    const user = await trpc.auth.getMe.query()
    if (isCurrent(version))
      userStore.setUserInfo(user)
  }
  catch (error) {
    if (isCurrent(version))
      errorMessage.value = error instanceof Error ? error.message : '读取账号失败，请重试'
  }
  finally {
    if (isCurrent(version))
      loading.value = false
  }
}

onShow(() => {
  if (pageSession !== getAuthSessionVersion()) {
    pageSession = getAuthSessionVersion()
    uploadedKey.value = ''
    uploadedImage.value = ''
    errorMessage.value = ''
    loading.value = false
    uploading.value = false
    loggingOut.value = false
  }
  void loadUser()
})

function chooseImage() {
  if (!active || !requireLogin() || uploading.value || loggingOut.value)
    return
  const version = getAuthSessionVersion()
  uni.chooseImage({
    count: 1,
    sourceType: ['album'],
    sizeType: ['compressed'],
    fail: (error) => {
      if (isCurrent(version))
        handlePhotoSelectionFailure(error)
    },
    success: async (result) => {
      const path = result.tempFilePaths[0]
      if (!path || !isCurrent(version) || !requireLogin())
        return
      uploading.value = true
      errorMessage.value = ''
      try {
        const key = await uploadFile(path)
        if (!isCurrent(version))
          return
        const url = await getFileUrl(key)
        if (isCurrent(version)) {
          uploadedKey.value = key
          uploadedImage.value = url
        }
      }
      catch (error) {
        if (isCurrent(version))
          errorMessage.value = error instanceof Error ? error.message : '上传失败，请重试'
      }
      finally {
        if (isCurrent(version))
          uploading.value = false
      }
    },
  })
}

async function previewImage() {
  if (!active || !requireLogin())
    return
  const version = getAuthSessionVersion()
  try {
    // Request a fresh signature instead of retaining an expired URL.
    const url = await getFileUrl(uploadedKey.value)
    if (isCurrent(version))
      uni.previewImage({ urls: [url] })
  }
  catch (error) {
    if (isCurrent(version))
      errorMessage.value = error instanceof Error ? error.message : '无法预览附件'
  }
}

async function logout() {
  if (!active || loggingOut.value)
    return
  loggingOut.value = true
  const version = getAuthSessionVersion()
  try {
    await trpc.auth.logout.mutate()
  }
  catch {
    // Offline logout still removes this device's credentials.
  }
  finally {
    if (active && version === getAuthSessionVersion()) {
      userStore.logout()
      uploadedKey.value = ''
      uploadedImage.value = ''
      uni.reLaunch({ url: '/pages/login/login' })
    }
    if (active && version === getAuthSessionVersion())
      loggingOut.value = false
  }
}
</script>

<template>
  <view class="account-page">
    <view class="account-heading">
      <text class="account-title">我的账号</text>
      <text class="account-subtitle">管理账号资料和个人附件</text>
    </view>
    <view class="account-panel">
      <text class="field-label">{{ userStore.userInfo?.name || '读取账号中' }}</text>
      <text class="account-value">{{ userStore.userInfo?.phoneNumber || userStore.userInfo?.email || '—' }}</text>
      <button class="secondary-button" :loading="loading" :disabled="loading || loggingOut" @click="loadUser">
        刷新资料
      </button>
    </view>
    <view class="account-panel">
      <text class="field-label">图片附件</text>
      <text class="helper-text">支持 PNG、JPEG 和 WebP，单张不超过 10 MB。附件仅对当前账号开放。</text>
      <image v-if="uploadedImage" class="attachment-preview" :src="uploadedImage" mode="aspectFit" @click="previewImage" />
      <button class="primary-button" :loading="uploading" :disabled="uploading || loggingOut" @click="chooseImage">
        {{ uploadedImage ? '上传另一张图片' : '选择图片上传' }}
      </button>
      <button v-if="uploadedKey" class="secondary-button" @click="previewImage">
        预览附件
      </button>
    </view>
    <text v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</text>
    <button class="secondary-button" :loading="loggingOut" :disabled="loggingOut" @click="logout">
      退出登录
    </button>
    <view class="account-panel legal-panel">
      <text class="field-label">隐私与协议</text><LegalLinks />
    </view>
  </view>
</template>

<style scoped>
.legal-panel {
  margin-top: 28rpx;
}
.account-value {
  display: block;
  font-size: 30rpx;
  color: #64748b;
}
.attachment-preview {
  display: block;
  width: 100%;
  height: 320rpx;
  margin-top: 24rpx;
  background: #f3f6fb;
  border-radius: 12rpx;
}
</style>
