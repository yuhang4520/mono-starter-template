<template>
  <view class="flex items-center justify-center py-5">
    <image src="@img/empty.png" class="h-35 w-35" mode="heightFix" />
    <text v-if="text" class="text-center text-[16rpx] text-gray-800">
      {{ text }}
    </text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>
