<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { requireLogin } from '@/utils/authInterceptor'

definePage({ pageOrientation: 'portrait' })
const url = ref('')
const errorMessage = ref('')
onLoad((query) => {
  if (!requireLogin())
    return
  try {
    const target = decodeURIComponent(query?.url || '')
    if (!/^https:\/\/\S+$/i.test(target))
      throw new Error('仅支持 HTTPS 页面')
    url.value = target
  }
  catch {
    errorMessage.value = '页面地址无效'
  }
})
</script>

<template>
  <web-view v-if="url" :src="url" />
  <view v-else class="account-page">
    <text class="error-message">{{ errorMessage }}</text>
  </view>
</template>
