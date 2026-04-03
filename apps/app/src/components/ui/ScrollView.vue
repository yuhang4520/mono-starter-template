<template>
  <scroll-view
    class="h-full w-full"
    scroll-y
    :refresher-enabled="refresherEnabled"
    :refresher-triggered="isRefreshing"
    @refresherrefresh="onRefresh"
    @scrolltolower="onLoadMore"
  >
    <!-- Content Slot -->
    <slot />

    <UiEmpty v-if="isEmpty && !loading" />

    <!-- Loading / Finished States -->
    <view v-if="!isEmpty" class="center py-6">
      <view v-if="loading" class="flex items-center gap-2 text-xs text-gray-400">
        <view class="i-stash-loading animate-spin" />
        <text>加载中...</text>
      </view>
      <view v-else-if="finished" class="text-xs text-gray-400/60">
        <text>— 已经到底啦 —</text>
      </view>
    </view>

    <!-- Safe area padding -->
    <view class="h-10" />
  </scroll-view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  loading?: boolean
  finished?: boolean
  isEmpty?: boolean
  refresherEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  finished: false,
  isEmpty: false,
  refresherEnabled: true,
})

const emit = defineEmits(['refresh', 'loadMore'])

const isRefreshing = ref(false)

// Handle refreshing state externally
watch(() => props.loading, (newVal) => {
  if (!newVal) {
    isRefreshing.value = false
  }
})

function onRefresh() {
  if (isRefreshing.value)
    return
  isRefreshing.value = true
  emit('refresh')
}

function onLoadMore() {
  if (props.loading || props.finished)
    return
  emit('loadMore')
}
</script>

<style scoped>
.center {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
