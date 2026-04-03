<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { checkAndRefreshToken } from '@/utils/auth'

onLaunch(() => {
  console.log('App Launch')
  // 设置全局音频播放选项，确保真机在静音模式下也能有声
  uni.setInnerAudioOption({
    obeyMuteSwitch: false,
    success: () => console.log('setInnerAudioOption success'),
    fail: e => console.log('setInnerAudioOption fail', e),
  })
})
onShow(() => {
  console.log('App Show')
  checkAndRefreshToken()
})
onHide(() => {
  console.log('App Hide')
})
</script>

<style>
#app {
  min-height: 100vh;
  overflow-x: hidden;
  background-color: rgb(60, 104, 203);
}
view,
scroll-view,
swiper-item,
text,
image,
input,
textarea,
label,
button {
  box-sizing: border-box;
}
</style>
