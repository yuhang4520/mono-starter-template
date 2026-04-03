<template>
  <view
    class="h-8 w-8 center rounded-full bg-black/40 text-white shadow-sm backdrop-blur-sm transition-transform active:scale-90"
    @click.stop="handlePreview"
  >
    <view class="h-5 w-5 text-white font-bold" :class="[iconType === 'image' ? 'i-stash-image' : 'i-material-symbols:screenshot-frame-2-rounded']" />
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  urls: string[]
  current?: string | number
  iconType?: 'image' | 'screen'
}>()

const emit = defineEmits(['success', 'fail'])

function handlePreview() {
  uni.previewImage({
    urls: props.urls,
    current: props.current,
    success: () => {
      emit('success')
    },
    fail: (err) => {
      emit('fail', err)
    },
  })
}
</script>
