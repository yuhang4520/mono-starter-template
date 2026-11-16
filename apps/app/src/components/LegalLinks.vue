<script setup lang="ts">
import { openLegalDocument } from '@/utils/legal'
</script>

<template>
  <view class="legal-links">
    <text class="legal-link" role="link" @click.stop="openLegalDocument('privacy')">《隐私政策》</text>
    <text>与</text>
    <text class="legal-link" role="link" @click.stop="openLegalDocument('user')">《用户协议》</text>
  </view>
</template>

<style scoped>
.legal-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  font-size: 26rpx;
  line-height: 1.8;
}
.legal-link {
  color: #315aab;
  text-decoration: underline;
}
</style>
