<script setup lang="ts">
import { onBackPress } from '@dcloudio/uni-app'
import { ref } from 'vue'
import LegalLinks from '@/components/LegalLinks.vue'
import { getAccessToken } from '@/utils/auth'
import { acceptLegalTerms, needsLaunchConsent } from '@/utils/legal'

definePage({ navigationStyle: 'custom' })
const error = ref('')
onBackPress(() => needsLaunchConsent())

function accept() {
  try {
    acceptLegalTerms()
    uni.reLaunch({ url: getAccessToken() ? '/pages/index/index' : '/pages/login/login' })
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败，请重试'
  }
}

function refuse() {
  error.value = '你尚未同意协议，可以继续阅读；如不接受，请关闭应用。'
}
</script>

<template>
  <view class="account-page">
    <view class="account-heading">
      <text class="account-title">欢迎使用</text><text class="account-subtitle">请先了解我们如何提供服务及处理你的信息</text>
    </view>
    <view class="account-panel">
      <text class="field-label">服务协议和隐私政策</text>
      <text class="helper-text">请阅读以下协议，了解账号信息、图片附件的使用方式及你的选择。图片相关权限仅在你使用对应功能时申请。</text>
      <LegalLinks />
      <text v-if="error" class="error-message" role="alert">{{ error }}</text>
      <button class="primary-button" @click="accept">
        同意并继续
      </button>
      <button class="secondary-button" @click="refuse">
        暂不同意
      </button>
    </view>
  </view>
</template>
