<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getLegalConfig, needsLaunchConsent } from '@/utils/legal'
import { legalDocument, PRIVACY_PAGE } from '@/utils/legal-core'

definePage({ navigationStyle: 'default', navigationBarTitleText: '协议详情' })
const url = ref('')
const title = ref('协议详情')
const error = ref('')
onLoad((query) => {
  try {
    const document = legalDocument(query?.document)
    if (!document)
      throw new Error('协议类型无效')
    const config = getLegalConfig()
    url.value = document === 'privacy' ? config.privacyUrl : config.agreementUrl
    title.value = document === 'privacy' ? '隐私政策' : '用户协议'
    uni.setNavigationBarTitle({ title: title.value })
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法打开协议'
  }
})

function goBack() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else
    uni.reLaunch({ url: needsLaunchConsent() ? PRIVACY_PAGE : '/pages/login/login' })
}
</script>

<template>
  <view class="legal-page">
    <!-- #ifdef H5 -->
    <view class="legal-toolbar">
      <button size="mini" @click="goBack">
        返回
      </button><text>{{ title }}</text>
    </view>
    <iframe v-if="url" class="legal-frame" :src="url" :title="title" referrerpolicy="no-referrer" />
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <web-view v-if="url" :src="url" />
    <!-- #endif -->
    <view v-if="error" class="account-page">
      <text class="error-message">{{ error }}</text><button @click="goBack">
        返回
      </button>
    </view>
  </view>
</template>

<style scoped>
.legal-page {
  height: calc(100vh - var(--window-top, 0px));
  display: flex;
  flex-direction: column;
}
.legal-toolbar {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 16rpx 24rpx;
  background: #fff;
}
.legal-toolbar button {
  margin: 0;
}
.legal-frame {
  width: 100%;
  flex: 1;
  min-height: 0;
  border: 0;
  background: #fff;
}
</style>
