<script setup lang="ts">
defineProps({
  className: { type: String, default: '' },
  backgroundColor: { type: String, default: '#f3f6fb' },
  paddingLeft: { type: String, default: '16px' },
  paddingRight: { type: String, default: '16px' },
})
</script>

<template>
  <view class="min-h-screen" :class="className" :style="{ backgroundColor, paddingLeft, paddingRight }">
    <slot />
  </view>
</template>
