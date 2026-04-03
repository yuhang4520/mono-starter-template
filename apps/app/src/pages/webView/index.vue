<template>
  <web-view v-if="url" :src="url" />
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'

definePage({
  pageOrientation: 'portrait',
})
const url = ref('')

onLoad((query) => {
  if (query && query.url) {
    url.value = decodeURIComponent(query.url)
  }
})
</script>

<style scoped></style>
