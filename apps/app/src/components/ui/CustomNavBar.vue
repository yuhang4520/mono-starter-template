<template>
  <view
    class="fixed left-0 right-0 top-0 z-50 flex items-center backdrop-blur-md transition-all duration-300"
    :style="{
      height: `${navHeight}px`,
      paddingTop: `${statusBarHeight}px`,
      paddingLeft: 'calc(env(safe-area-inset-left) + 16px)',
      paddingRight: 'calc(env(safe-area-inset-right) + 16px)',
      backgroundColor,
      color: textColor,
    }"
  >
    <view
      class="w-full flex items-center"
      :style="{
        height: `${menuButtonHeight}px`,
      }"
    >
      <view
        class="h-8 w-8 flex items-center justify-start transition-all active:scale-95 active:opacity-60"
        @click="handleBack"
      >
        <view class="i-starter-arrow-left h-8 w-8 text-white" />
      </view>

      <view class="pointer-events-none absolute inset-x-0 flex items-center justify-center">
        <text class="pointer-events-auto line-clamp-1 max-w-2/3 text-base font-bold tracking-wide">{{ title }}</text>
      </view>

      <view
        class="flex flex-1 items-center justify-end"
        :style="{
          paddingRight: isMP ? `${menuButtonWidth + 8}px` : '0',
        }"
      >
        <slot name="right" />
      </view>
    </view>
  </view>

  <view :style="{ height: `${navHeight}px` }" />
</template>

<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  backgroundColor: { type: String, default: 'transparent' },
  textColor: { type: String, default: '#fff' },
  confirmText: { type: String, default: '' },
  isNeedConfirm: { type: Boolean, default: false },
  disableBack: { type: Boolean, default: false },
})

const statusBarHeight = ref(0)
const navHeight = ref(44)
const menuButtonHeight = ref(44)
const menuButtonWidth = ref(0)
const isMP = ref(false)

onMounted(() => {
  const windowInfo = uni.getWindowInfo()
  const isLandscape = windowInfo.windowWidth > windowInfo.windowHeight

  // #ifdef MP-WEIXIN
  isMP.value = true
  const menuButtonInfo = uni.getMenuButtonBoundingClientRect()

  if (isLandscape) {
    // 横屏：固定高度 44px，状态栏视为 0
    statusBarHeight.value = 0
    navHeight.value = 44
    menuButtonHeight.value = 44
    menuButtonWidth.value = windowInfo.windowWidth - menuButtonInfo.left
  }
  else {
    // 竖屏：标准计算
    statusBarHeight.value = windowInfo.statusBarHeight || 0
    const topSpace = menuButtonInfo.top - statusBarHeight.value
    menuButtonHeight.value = menuButtonInfo.height + topSpace * 2
    navHeight.value = menuButtonHeight.value + statusBarHeight.value
    menuButtonWidth.value = windowInfo.windowWidth - menuButtonInfo.left
  }
  // #endif

  // #ifndef MP-WEIXIN
  statusBarHeight.value = isLandscape ? 0 : (windowInfo.statusBarHeight || 0)
  navHeight.value = 44 + statusBarHeight.value
  menuButtonHeight.value = 44
  // #endif
})

function handleBack() {
  if (props.disableBack) {
    return
  }
  if (props.isNeedConfirm && props.confirmText) {
    uni.showModal({
      title: '提示',
      content: props.confirmText,
      success: (res) => {
        if (res.confirm) {
          uni.navigateBack()
        }
      },
    })
  }
  else {
    uni.navigateBack()
  }
}
</script>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  overflow: hidden;
}
</style>
