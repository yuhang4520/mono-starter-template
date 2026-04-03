<template>
  <view
    class="touch-action-none relative h-screen w-screen flex flex-col overflow-hidden"
    :class="className"
    :style="{
      paddingLeft: `${props.paddingLeft}`,
      paddingRight: `${props.paddingRight}`,
    }"
  >
    <image
      :src="bgImage"
      mode="aspectFill"
      class="absolute left-0 top-0 z-0 h-full w-full bg-[rgb(60,104,203)]"
    />
    <UiLayoutGuard />
    <view class="z-1 h-full w-full">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  className: {
    type: String,
    default: '',
  },
  bgStyle: {
    type: String,
    default: 1,
  },
  paddingLeft: {
    type: String,
    default: '10px',
  },
  paddingRight: {
    type: String,
    default: '5px',
  },
})
const bgImage = computed(() => {
  const map: Record<string, string> = {
    0: '/static/img/overall_bg_0.jpg',
    1: '/static/img/overall_bg_1.jpg',
    2: '/static/img/overall_bg_2.jpg',
    3: '/static/img/overall_bg_3.jpg',
    lightGreen: '/static/img/overall_bg_light_green.jpg',
    lightBlue: '/static/img/overall_bg_light_blue.jpg',
  }

  return map[props.bgStyle] || map[1]
})
</script>
