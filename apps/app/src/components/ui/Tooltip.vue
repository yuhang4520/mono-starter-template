<template>
  <view class="relative inline-flex items-center">
    <!-- 触发区域 -->
    <view
      class="inline-flex active:opacity-70"
      @longpress="show"
      @touchend="hide"
      @touchcancel="hide"
    >
      <slot />
    </view>

    <!-- 提示框容器 -->
    <view
      v-show="visible"
      class="pointer-events-none absolute inset-x-0 z-100 flex justify-center"
      :class="[
        placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
      ]"
    >
      <!-- 提示框内容 -->
      <view
        class="pointer-events-auto relative whitespace-nowrap border border-white/10 rounded-lg bg-gray-900/95 px-3 py-1.5 text-[10px] text-white shadow-xl"
        @click.stop
      >
        <text v-if="content">{{ content }}</text>
        <slot v-else name="content" />

        <!-- 小箭头 -->
        <view
          class="absolute left-1/2 h-0 w-0 -translate-x-1/2"
          :class="[
            placement === 'top' ? 'top-full' : 'bottom-full',
          ]"
          :style="{
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: placement === 'top' ? '4px solid rgba(17, 24, 39, 0.95)' : 'none',
            borderBottom: placement === 'bottom' ? '4px solid rgba(17, 24, 39, 0.95)' : 'none',
          }"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  content?: string
  placement?: 'top' | 'bottom'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top',
  disabled: false,
})

const visible = ref(false)

function show(e: any) {
  if (props.disabled)
    return
  if (e && e.stopPropagation)
    e.stopPropagation()
  visible.value = true
}

function hide(e: any) {
  if (e && e.stopPropagation)
    e.stopPropagation()
  visible.value = false
}
</script>
